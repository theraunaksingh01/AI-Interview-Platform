from __future__ import annotations

import os
import asyncio
from datetime import datetime
from uuid import UUID, uuid4
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.orm import Session

from db.session import get_db
from services.llm_provider import gemini_chat
from services.question_generator import generate_mock_questions


router = APIRouter(prefix="/api/mock", tags=["mock"])


class MockSessionStartRequest(BaseModel):
    role_target: str
    seniority: str
    company_type: Optional[str] = None
    focus_area: Optional[str] = None
    guest_token: Optional[str] = None
    duration_mins: Optional[int] = 45
    resume_uploaded: Optional[bool] = False


class MockHintRequest(BaseModel):
    session_id: str
    question_text: str = Field(min_length=3)
    hint_level: int = Field(ge=1, le=2)


class MockHintResponse(BaseModel):
    hint: str
    hint_level: int
    provider: str


class MockSessionCompleteResponse(BaseModel):
    session_id: str
    status: str
    completed_at: str


GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.0-flash")


def _heuristic_hint(question_text: str, hint_level: int) -> str:
    text_l = (question_text or "").lower()

    if "array" in text_l or "list" in text_l:
        return (
            "Start by naming the input shape and a single pass strategy before coding. "
            "Think about what temporary state you need to carry across elements."
            if hint_level == 1
            else "Try a linear scan with a hashmap/set to track complements or seen values. "
            "Call out time and space complexity before implementation."
        )

    if "string" in text_l:
        return (
            "Define exactly what a valid output looks like, then design pointer/index movement rules."
            if hint_level == 1
            else "A two-pointer or frequency-count approach is often enough; write a tiny example first "
            "and trace each index update."
        )

    return (
        "Break the problem into input parsing, core logic, and output formatting. "
        "State your approach in 2-3 steps before coding."
        if hint_level == 1
        else "Pick the simplest correct baseline first, then refine for edge cases and complexity. "
        "Mention one trade-off explicitly."
    )


async def _llm_hint(question_text: str, hint_level: int) -> Optional[str]:
    if not GEMINI_API_KEY:
        return None

    system_prompt = (
        "You are a coding interview coach. Give concise hints without giving full solutions. "
        "Return strict JSON only."
    )
    user_prompt = f"""
Question:
{question_text}

Hint level: {hint_level}

Rules:
- Level 1: conceptual nudge only.
- Level 2: stronger directional nudge but still no full algorithm or final code.
- Keep hint under 45 words.

Return JSON:
{{"hint":"..."}}
"""

    try:
        result = await asyncio.wait_for(
            gemini_chat(
                system_prompt=system_prompt,
                user_prompt=user_prompt,
                api_key=GEMINI_API_KEY,
                model=GEMINI_MODEL,
                temperature=0.2,
                max_output_tokens=120,
                timeout=6,
            ),
            timeout=7,
        )
    except Exception:
        return None

    parsed = result.get("parsed")
    if isinstance(parsed, dict):
        hint = (parsed.get("hint") or "").strip()
        if hint:
            return hint
    return None


@router.post("/session/start")
def start_mock_session(payload: MockSessionStartRequest, db: Session = Depends(get_db)):
    guest_token = payload.guest_token or str(uuid4())

    mock_row = db.execute(
        text(
            """
            INSERT INTO mock_sessions (
                guest_token,
                role_target,
                seniority,
                company_type,
                focus_area,
                resume_uploaded,
                duration_mins,
                status,
                started_at
            )
            VALUES (
                :guest_token,
                :role_target,
                :seniority,
                :company_type,
                :focus_area,
                :resume_uploaded,
                :duration_mins,
                'in_progress',
                :started_at
            )
            RETURNING id
            """
        ),
        {
            "guest_token": guest_token,
            "role_target": payload.role_target,
            "seniority": payload.seniority,
            "company_type": payload.company_type,
            "focus_area": payload.focus_area,
            "resume_uploaded": bool(payload.resume_uploaded),
            "duration_mins": payload.duration_mins or 45,
            "started_at": datetime.utcnow(),
        },
    ).mappings().first()

    has_mock_session_id_col = db.execute(
        text(
            """
            SELECT 1
            FROM information_schema.columns
            WHERE table_name = 'interviews' AND column_name = 'mock_session_id'
            LIMIT 1
            """
        )
    ).scalar() is not None

    if has_mock_session_id_col:
        interview_row = db.execute(
            text(
                """
                INSERT INTO interviews (mock_session_id, status, created_at)
                VALUES (:sid, 'in_progress', now())
                RETURNING id
                """
            ),
            {"sid": str(mock_row["id"])},
        ).mappings().first()
    else:
        interview_row = db.execute(
            text(
                """
                INSERT INTO interviews (status, created_at)
                VALUES ('in_progress', now())
                RETURNING id
                """
            )
        ).mappings().first()

    # Mock-only question generation (no JD/resume). This does not affect company flow.
    mock_questions = generate_mock_questions(
        role_target=payload.role_target,
        seniority=payload.seniority,
        focus_area=(payload.focus_area or "mixed"),
        count=6,
    )

    for q in mock_questions:
        raw_type = str(q.get("type") or "behavioral").lower()
        ws_type = "code" if raw_type == "dsa" else "voice"
        difficulty = str(q.get("difficulty") or "medium").lower()
        time_limit = 600 if ws_type == "code" else 120
        db.execute(
            text(
                """
                INSERT INTO interview_questions
                  (interview_id, question_text, type, time_limit_seconds, description, sample_cases, source)
                VALUES (:iid, :qt, :tp, :tl, :desc, CAST(:sc AS jsonb), :src)
                """
            ),
            {
                "iid": str(interview_row["id"]),
                "qt": str(q.get("text") or "").strip(),
                "tp": ws_type,
                "tl": time_limit,
                "desc": "",
                "sc": "[]",
                "src": f"mock:{raw_type}:{difficulty}",
            },
        )

    db.commit()

    return {
        "session_id": str(mock_row["id"]),
        "interview_id": str(interview_row["id"]),
        "guest_token": guest_token,
    }


@router.get("/session/{session_id}")
def get_mock_session(session_id: UUID, db: Session = Depends(get_db)):
    session = db.execute(
        text(
            """
            SELECT ms.*, i.id AS interview_id
            FROM mock_sessions ms
            LEFT JOIN interviews i ON i.mock_session_id = ms.id
            WHERE ms.id = :sid
            ORDER BY i.created_at DESC NULLS LAST
            LIMIT 1
            """
        ),
        {"sid": str(session_id)},
    ).mappings().first()

    if not session:
        raise HTTPException(status_code=404, detail="Mock session not found")

    return dict(session)


@router.post("/hint", response_model=MockHintResponse)
async def generate_mock_hint(payload: MockHintRequest, db: Session = Depends(get_db)):
    try:
        session_uuid = str(UUID(payload.session_id))
    except Exception:
        raise HTTPException(status_code=404, detail="Mock session not found")

    exists = db.execute(
        text("SELECT 1 FROM mock_sessions WHERE id = :sid LIMIT 1"),
        {"sid": session_uuid},
    ).scalar()

    if not exists:
        raise HTTPException(status_code=404, detail="Mock session not found")

    hint = await _llm_hint(payload.question_text, payload.hint_level)
    provider = "gemini" if hint else "fallback"

    if not hint:
        hint = _heuristic_hint(payload.question_text, payload.hint_level)

    return MockHintResponse(
        hint=hint,
        hint_level=payload.hint_level,
        provider=provider,
    )


@router.post("/session/{session_id}/complete", response_model=MockSessionCompleteResponse)
def complete_mock_session(session_id: UUID, db: Session = Depends(get_db)):
    row = db.execute(
        text(
            """
            UPDATE mock_sessions
            SET status = 'completed',
                completed_at = :completed_at
            WHERE id = :sid
            RETURNING id, status, completed_at
            """
        ),
        {"sid": str(session_id), "completed_at": datetime.utcnow()},
    ).mappings().first()

    if not row:
        raise HTTPException(status_code=404, detail="Mock session not found")

    db.commit()

    return MockSessionCompleteResponse(
        session_id=str(row["id"]),
        status=str(row["status"]),
        completed_at=row["completed_at"].isoformat() if row["completed_at"] else "",
    )
