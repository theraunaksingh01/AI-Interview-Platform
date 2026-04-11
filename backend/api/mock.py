from __future__ import annotations

import os
import asyncio
import json
from datetime import datetime, timedelta
from uuid import UUID, uuid4
from typing import Optional, Any

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.orm import Session

from api.deps import get_current_user_optional
from core.config import settings
from db.models import CommunicationReport, MockSession, User
from db.session import SessionLocal
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


class MockCompleteRequest(BaseModel):
    avg_wpm: Optional[float] = None
    filler_breakdown: Optional[dict[str, int]] = None
    total_filler_words: Optional[int] = None
    total_silence_gaps: Optional[int] = None
    full_transcript: Optional[str] = None


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


def _safe_float(value: Any) -> Optional[float]:
    if value is None:
        return None
    try:
        return float(value)
    except Exception:
        return None


def _score_delta(current: Any, previous: Any) -> Optional[float]:
    curr = _safe_float(current)
    prev = _safe_float(previous)
    if curr is None or prev is None:
        return None
    return round(curr - prev, 2)


def check_mock_limit(user_id: Optional[int], db: Session) -> dict[str, Any]:
    if not user_id:
        # Guest users are not allowed in Phase 2e.
        raise HTTPException(status_code=403, detail="signup_required")

    user = db.query(User).filter(User.id == int(user_id)).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if str(getattr(user, "plan", "free") or "free").lower() == "pro":
        return {"allowed": True, "plan": "pro"}

    month_start = datetime.utcnow().replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    used_count = (
        db.query(MockSession)
        .filter(
            MockSession.user_id == int(user_id),
            MockSession.started_at >= month_start,
            MockSession.status != "abandoned",
        )
        .count()
    )

    if used_count >= 1:
        raise HTTPException(status_code=403, detail="limit_reached")

    return {"allowed": True, "plan": "free"}


def _fallback_comm_feedback() -> tuple[float, list[str], list[str]]:
    return (
        6.0,
        [
            "Keep answers more structured.",
            "Reduce filler words in long responses.",
            "Add concrete examples with outcomes.",
        ],
        [
            "Completed the interview flow.",
            "Attempted questions with clear intent.",
        ],
    )


def generate_communication_report(
    session_id: str,
    avg_wpm: float,
    filler_breakdown: dict[str, int],
    total_filler_words: int,
    total_silence_gaps: int,
    full_transcript: str,
    db_url: Optional[str] = None,
) -> None:
    db = SessionLocal()
    lock_key = f"comm_report:{session_id}"
    try:
        # Hard idempotency: serialize report writes per session to prevent duplicate rows.
        db.execute(
            text("SELECT pg_advisory_lock(hashtext(:k))"),
            {"k": lock_key},
        )

        star_score = 0.0
        top_issues: list[str] = []
        top_strengths: list[str] = []

        if full_transcript and len(full_transcript.strip()) > 50:
            prompt = f"""Analyze this interview transcript and return JSON only:
{{
  \"star_avg_score\": <0-10 float, how well STAR method was used>,
  \"top_issues\": [\"issue1\", \"issue2\", \"issue3\"],
  \"top_strengths\": [\"strength1\", \"strength2\", \"strength3\"]
}}
Be specific and actionable.
Transcript: {full_transcript[:3000]}"""

            try:
                import anthropic  # type: ignore

                api_key = os.getenv("ANTHROPIC_API_KEY", "").strip()
                if not api_key:
                    raise RuntimeError("ANTHROPIC_API_KEY not configured")

                client = anthropic.Anthropic(api_key=api_key)
                response = client.messages.create(
                    model="claude-haiku-4-5-20251001",
                    max_tokens=500,
                    messages=[{"role": "user", "content": prompt}],
                )
                text_payload = ""
                for block in getattr(response, "content", []):
                    if getattr(block, "type", "") == "text":
                        text_payload += getattr(block, "text", "")

                parsed = json.loads(text_payload)
                star_score = float(parsed.get("star_avg_score", 0) or 0)
                top_issues = [str(x) for x in (parsed.get("top_issues") or [])][:3]
                top_strengths = [str(x) for x in (parsed.get("top_strengths") or [])][:3]
            except Exception:
                star_score, top_issues, top_strengths = _fallback_comm_feedback()
        else:
            star_score, top_issues, top_strengths = _fallback_comm_feedback()

        heatmap_data = [{"minute": i, "intensity": 0.6} for i in range(10)]

        existing = (
            db.query(CommunicationReport)
            .filter(CommunicationReport.session_id == UUID(session_id))
            .first()
        )

        if existing:
            existing.avg_wpm = avg_wpm
            existing.total_filler_words = total_filler_words
            existing.filler_breakdown = filler_breakdown
            existing.total_silence_gaps = total_silence_gaps
            existing.longest_silence_sec = 0
            existing.star_avg_score = max(0, min(10, star_score))
            existing.heatmap_data = heatmap_data
            existing.top_issues = top_issues
            existing.top_strengths = top_strengths
        else:
            db.add(
                CommunicationReport(
                    session_id=UUID(session_id),
                    avg_wpm=avg_wpm,
                    total_filler_words=total_filler_words,
                    filler_breakdown=filler_breakdown,
                    total_silence_gaps=total_silence_gaps,
                    longest_silence_sec=0,
                    star_avg_score=max(0, min(10, star_score)),
                    heatmap_data=heatmap_data,
                    top_issues=top_issues,
                    top_strengths=top_strengths,
                )
            )

        db.commit()
    except Exception:
        db.rollback()
    finally:
        try:
            db.execute(
                text("SELECT pg_advisory_unlock(hashtext(:k))"),
                {"k": lock_key},
            )
            db.commit()
        except Exception:
            db.rollback()
        db.close()


@router.post("/session/start")
def start_mock_session(
    payload: MockSessionStartRequest,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user_optional),
):
    user_id = getattr(current_user, "id", None)
    check_mock_limit(user_id, db)
    guest_token = None if user_id else (payload.guest_token or str(uuid4()))

    mock_row = db.execute(
        text(
            """
            INSERT INTO mock_sessions (
                user_id,
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
                :user_id,
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
            "user_id": user_id,
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


@router.post("/session/{session_id}/complete")
async def complete_mock_session(
    session_id: str,
    body: MockCompleteRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    try:
        session_uuid = UUID(session_id)
    except Exception:
        raise HTTPException(status_code=404, detail="Mock session not found")

    session = db.query(MockSession).filter(MockSession.id == session_uuid).first()
    if not session:
        raise HTTPException(status_code=404, detail="Mock session not found")

    existing_report = (
        db.query(CommunicationReport)
        .filter(CommunicationReport.session_id == session_uuid)
        .first()
    )

    session.status = "completed"
    session.completed_at = datetime.utcnow()

    if body.avg_wpm is not None:
        session.communication_score = max(0, min(10, body.avg_wpm / 20.0))

    db.commit()

    filler_breakdown = body.filler_breakdown or {}
    total_filler_words = (
        body.total_filler_words
        if body.total_filler_words is not None
        else sum(int(v or 0) for v in filler_breakdown.values())
    )
    total_silence_gaps = body.total_silence_gaps or 0

    if not existing_report:
        background_tasks.add_task(
            generate_communication_report,
            session_id=str(session_uuid),
            avg_wpm=float(body.avg_wpm or 0),
            filler_breakdown=filler_breakdown,
            total_filler_words=int(total_filler_words),
            total_silence_gaps=int(total_silence_gaps),
            full_transcript=(body.full_transcript or ""),
            db_url=settings.DATABASE_URL,
        )

    return {
        "status": "completed",
        "report_url": f"/mock/report/{session_uuid}",
        "session_id": str(session_uuid),
        "idempotent": existing_report is not None,
    }


@router.get("/report/{session_id}")
def get_mock_report(
    session_id: str,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user_optional),
):
    try:
        session_uuid = UUID(session_id)
    except Exception:
        raise HTTPException(status_code=404, detail="Mock session not found")

    session = db.query(MockSession).filter(MockSession.id == session_uuid).first()
    if not session:
        raise HTTPException(status_code=404, detail="Mock session not found")

    if current_user and str(session.user_id) == str(current_user.id):
        user = db.query(User).filter(User.id == current_user.id).first()
        if user and str(getattr(user, "plan", "free") or "free").lower() == "free":
            return {
                "session": {
                    "id": str(session.id),
                    "role_target": session.role_target,
                },
                "report": None,
                "report_pending": False,
                "locked": True,
                "lock_reason": "upgrade_required",
            }

    report = (
        db.query(CommunicationReport)
        .filter(CommunicationReport.session_id == session_uuid)
        .first()
    )

    return {
        "session": {
            "id": str(session.id),
            "role_target": session.role_target,
            "seniority": session.seniority,
            "status": session.status,
            "completed_at": session.completed_at,
            "overall_score": _safe_float(session.overall_score),
            "communication_score": _safe_float(session.communication_score),
        },
        "report": {
            "avg_wpm": _safe_float(report.avg_wpm) if report else None,
            "total_filler_words": report.total_filler_words if report else None,
            "filler_breakdown": report.filler_breakdown if report else {},
            "total_silence_gaps": report.total_silence_gaps if report else None,
            "star_avg_score": _safe_float(report.star_avg_score) if report else None,
            "top_issues": report.top_issues if report else [],
            "top_strengths": report.top_strengths if report else [],
            "heatmap_data": report.heatmap_data if report else [],
        }
        if report
        else None,
        "report_pending": report is None,
        "locked": False,
    }


@router.get("/dashboard/{user_id}")
def get_dashboard(user_id: str, db: Session = Depends(get_db)):
    try:
        user_id_int = int(user_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid user_id")

    sessions = (
        db.query(MockSession)
        .filter(
            MockSession.user_id == user_id_int,
            MockSession.status == "completed",
            MockSession.completed_at.isnot(None),
        )
        .order_by(MockSession.completed_at.asc())
        .all()
    )

    if not sessions:
        return {
            "sessions": [],
            "latest_scores": {},
            "deltas": {},
            "streak": 0,
            "total_sessions": 0,
            "milestones": [],
        }

    session_ids = [s.id for s in sessions if s.id is not None]
    report_rows = (
        db.query(CommunicationReport.session_id)
        .filter(CommunicationReport.session_id.in_(session_ids))
        .all()
    )
    report_ids = {str(r[0]) for r in report_rows}

    latest = sessions[-1]
    previous = sessions[-2] if len(sessions) >= 2 else None

    latest_scores = {
        "dsa": _safe_float(latest.dsa_score),
        "system_design": _safe_float(latest.system_design_score),
        "behavioral": _safe_float(latest.behavioral_score),
        "communication": _safe_float(latest.communication_score),
        "overall": _safe_float(latest.overall_score),
    }

    deltas = {
        "dsa": _score_delta(latest.dsa_score, previous.dsa_score if previous else None),
        "system_design": _score_delta(
            latest.system_design_score,
            previous.system_design_score if previous else None,
        ),
        "behavioral": _score_delta(latest.behavioral_score, previous.behavioral_score if previous else None),
        "communication": _score_delta(latest.communication_score, previous.communication_score if previous else None),
    }

    streak = 0
    today = datetime.utcnow().date()
    check_date = today
    session_dates = sorted(
        {s.completed_at.date() for s in sessions if s.completed_at is not None},
        reverse=True,
    )
    for d in session_dates:
        if d == check_date or d == check_date - timedelta(days=1):
            streak += 1
            check_date = d
        else:
            break

    milestones: list[dict[str, Any]] = []
    for s in sessions:
        dimensions = [
            ("DSA", s.dsa_score),
            ("System Design", s.system_design_score),
            ("Behavioral", s.behavioral_score),
            ("Communication", s.communication_score),
        ]
        for dim, raw_score in dimensions:
            score = _safe_float(raw_score)
            if score is not None and score >= 7.0 and s.completed_at is not None:
                milestones.append(
                    {
                        "type": "score_milestone",
                        "message": f"Your {dim} score reached {score:.1f}!",
                        "session_id": str(s.id),
                        "achieved_at": s.completed_at.isoformat(),
                    }
                )

    sessions_payload = [
        {
            "id": str(s.id),
            "role_target": s.role_target,
            "seniority": s.seniority,
            "focus_area": s.focus_area,
            "overall_score": _safe_float(s.overall_score),
            "dsa_score": _safe_float(s.dsa_score),
            "system_design_score": _safe_float(s.system_design_score),
            "behavioral_score": _safe_float(s.behavioral_score),
            "communication_score": _safe_float(s.communication_score),
            "completed_at": s.completed_at.isoformat() if s.completed_at else None,
            "report_available": str(s.id) in report_ids,
        }
        for s in sessions
    ]

    return {
        "sessions": sessions_payload,
        "latest_scores": latest_scores,
        "deltas": deltas,
        "streak": streak,
        "total_sessions": len(sessions),
        "milestones": milestones[-5:],
    }
