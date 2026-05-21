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
from tasks.score_interview import aggregate_interview_scores
from tasks.generate_coaching_report import generate_coaching_report
import logging
import anthropic

log = logging.getLogger(__name__)

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


class MockRetryRequest(BaseModel):
    session_id: str
    question_id: int
    previous_answer_id: int
    transcript: str
    attempt_number: int = Field(ge=2, le=3)


class FlagFeedbackRequest(BaseModel):
    answer_id: int
    flag_reason: str = ""
    flagged_text: str = ""


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
        return {"allowed": True, "plan": "guest"}

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

    if used_count >= 3:
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
            
            # Sync overall_score from interviews → mock_sessions
        try:
            db.execute(
                text("""
                    UPDATE mock_sessions ms
                    SET overall_score = (
                        SELECT i.overall_score
                        FROM interviews i
                        WHERE i.mock_session_id = ms.id
                        ORDER BY i.created_at DESC
                        LIMIT 1
                    )
                    WHERE ms.id = CAST(:sid AS uuid)
                      AND ms.overall_score IS NULL
                """),
                {"sid": session_id},
            )
        except Exception as e:
            log.warning("[MOCK] Failed to sync overall_score: %s", e)

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

    try:
        generate_coaching_report.delay(str(session_id))
        log.info("[MOCK] Enqueued generate_coaching_report for session %s", session_id)
    except Exception as e:
        log.warning("[MOCK] Could not enqueue generate_coaching_report: %s", e)


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
    # ── QB-5: Load questions from bank ───────────────────────
    from services.question_bank import get_questions_for_session

    # Map seniority to difficulty range
    difficulty_map = {
        "beginner": "beginner",
        "intermediate": "intermediate", 
        "advanced": "advanced",
    }
    difficulty = difficulty_map.get(
        str(payload.seniority or "").lower(), 
        "intermediate"
    )

    # Map company_type to company tag
    company_tag = None
    company_map = {
        "tcs": "tcs", "infosys": "infosys",
        "wipro": "wipro", "amazon": "amazon",
        "microsoft": "microsoft", "startup": "startup",
    }
    if payload.company_type:
        company_tag = company_map.get(
            str(payload.company_type).lower()
        )

    # Get candidate email for dedup
    candidate_email = None
    if user_id:
        user_row = db.execute(
            text("SELECT email FROM users WHERE id = :uid"),
            {"uid": user_id}
        ).mappings().first()
        if user_row:
            candidate_email = user_row["email"]

    # Total and code question counts
    total_count = payload.duration_mins // 3 if payload.duration_mins else 8
    total_count = max(5, min(total_count, 11))
    code_count = 2 if (payload.focus_area or "mixed") in ("dsa", "mixed") else 0

    # Map frontend role values to bank role_tags
    role_map = {
        "Software Engineer": "Backend Engineer",
        "Backend Engineer": "Backend Engineer", 
        "Frontend Engineer": "Frontend Engineer",
        "Full Stack Engineer": "Full Stack Engineer",
        "Data Engineer": "Data Engineer",
        "System Design Engineer": "Backend Engineer",
        "AI Engineer": "AI Engineer",
    }
    mapped_role = role_map.get(payload.role_target, payload.role_target)
    # Fetch from bank
    bank_questions = get_questions_for_session(
        db=db,
        role=mapped_role,
        difficulty=difficulty,
        company=company_tag,
        count=total_count,
        code_count=code_count,
        candidate_email=candidate_email,
        session_type="single",
    )

    # Fallback to Gemini stub if bank empty
    if not bank_questions:
        log.warning(
            "QB empty for role=%s difficulty=%s company=%s — "
            "falling back to generate_mock_questions",
            payload.role_target, difficulty, company_tag
        )
        bank_questions = [
            {
                "question_text": q.get("text", ""),
                "type": "voice" if str(q.get("type","")).lower() != "dsa" else "code",
                "difficulty": 3,
                "topic": "general",
                "question_bank_id": None,
                "source": "fallback",
            }
            for q in generate_mock_questions(
                role_target=payload.role_target,
                seniority=payload.seniority,
                focus_area=(payload.focus_area or "mixed"),
                count=total_count,
            )
        ]

    # Insert questions into interview_questions
    for pos, q in enumerate(bank_questions):
        ws_type = "code" if q.get("type") == "code" else "voice"
        time_limit = 600 if ws_type == "code" else 120
        qtext = str(q.get("question_text") or q.get("text") or "").strip()
        if not qtext:
            continue
        db.execute(
            text(
                """
                INSERT INTO interview_questions
                  (interview_id, question_text, type, 
                   time_limit_seconds, description, 
                   sample_cases, source, topic, difficulty,
                   question_bank_id, position)
                VALUES 
                  (:iid, :qt, :tp, :tl, :desc,
                   CAST(:sc AS jsonb), :src, :topic, :diff,
                   :qbid, :pos)
                """
            ),
            {
                "iid": str(interview_row["id"]),
                "qt": qtext,
                "tp": ws_type,
                "tl": time_limit,
                "desc": q.get("expected_answer_framework") or "",
                "sc": "[]",
                "src": q.get("source") or "bank",
                "topic": q.get("topic") or "general",
                "diff": q.get("difficulty") or 3,
                "qbid": q.get("id"),
                "pos": pos,
            },
        )

    # Update mock_session with question count and company
    db.execute(
        text(
            """
            UPDATE mock_sessions 
            SET question_count = :qc,
                target_company = :company
            WHERE id = :sid
            """
        ),
        {
            "qc": len(bank_questions),
            "company": company_tag,
            "sid": str(mock_row["id"]),
        }
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

    report = (
        db.query(CommunicationReport)
        .filter(CommunicationReport.session_id == session_uuid)
        .first()
    )

    coaching_report = getattr(session, "coaching_report", None)
    if isinstance(coaching_report, str):
        try:
            coaching_report = json.loads(coaching_report)
        except Exception:
            coaching_report = None
    questions_data = coaching_report.get("questions", []) if isinstance(coaching_report, dict) else []
    coaching_pending = len(questions_data) == 0

    return {
        "session": {
            "id": str(session.id),
            "role_target": session.role_target,
            "seniority": session.seniority,
            "status": session.status,
            "completed_at": session.completed_at,
            "overall_score": _safe_float(session.overall_score),
            "communication_score": _safe_float(session.communication_score),
            "specific_fix": getattr(session, "specific_fix", None),
            "coaching_pattern": coaching_report.get("pattern") if isinstance(coaching_report, dict) else None,
            "delivery_note": coaching_report.get("delivery_note") if isinstance(coaching_report, dict) else None,
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
        "questions": questions_data,
        "coaching_pending": coaching_pending,
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

    all_scores = [_safe_float(s.overall_score) for s in sessions if _safe_float(s.overall_score) is not None]
    best_score = max(all_scores) if all_scores else None
    avg_score = round(sum(all_scores) / len(all_scores), 2) if all_scores else None
    first_score = _safe_float(sessions[0].overall_score) if sessions else None
    latest_score = _safe_float(sessions[-1].overall_score) if sessions else None
    improvement = round(latest_score - first_score, 2) if (first_score is not None and latest_score is not None) else None
 
    # --- question_count + total_retries per session via SQL ---
    session_ids_str = [str(s.id) for s in sessions]
    qcount_rows = db.execute(
        text("""
            SELECT i.mock_session_id::text AS sid, COUNT(iq.id) AS qcount
            FROM interviews i
            JOIN interview_questions iq ON iq.interview_id = i.id
            WHERE i.mock_session_id = ANY(CAST(:ids AS uuid[]))
            GROUP BY i.mock_session_id
        """),
        {"ids": session_ids_str},
    ).mappings().all()
    qcount_map = {r["sid"]: int(r["qcount"]) for r in qcount_rows}
 
    retry_rows = db.execute(
        text("""
            SELECT i.mock_session_id::text AS sid, COUNT(ia.id) AS retries
            FROM interviews i
            JOIN interview_questions iq ON iq.interview_id = i.id
            JOIN interview_answers ia ON ia.interview_question_id = iq.id
            WHERE i.mock_session_id = ANY(CAST(:ids AS uuid[]))
              AND ia.attempt_number > 1
            GROUP BY i.mock_session_id
        """),
        {"ids": session_ids_str},
    ).mappings().all()
    retry_map = {r["sid"]: int(r["retries"]) for r in retry_rows}
 
    # --- weak_spots from user_progress if table exists ---
    weak_spots = None
    try:
        wp_row = db.execute(
            text("""
                SELECT weak_areas FROM user_progress
                WHERE user_id = :uid
                ORDER BY updated_at DESC LIMIT 1
            """),
            {"uid": user_id_int},
        ).mappings().first()
        if wp_row:
            weak_spots = wp_row["weak_areas"]
    except Exception:
        weak_spots = None
 
    sessions_payload = [
        {
            "id": str(s.id),
            "role_target": s.role_target,
            "seniority": s.seniority,
            "company_type": s.company_type,
            "focus_area": s.focus_area,
            "overall_score": _safe_float(s.overall_score),
            "dsa_score": _safe_float(s.dsa_score),
            "system_design_score": _safe_float(s.system_design_score),
            "behavioral_score": _safe_float(s.behavioral_score),
            "communication_score": _safe_float(s.communication_score),
            "completed_at": s.completed_at.isoformat() if s.completed_at else None,
            "report_available": str(s.id) in report_ids,
            "question_count": qcount_map.get(str(s.id), 0),
            "total_retries": retry_map.get(str(s.id), 0),
        }
        for s in sessions
    ]
 
    return {
        "sessions": sessions_payload,
        "latest_scores": latest_scores,
        "deltas": deltas,
        "streak": streak,
        "total_sessions": len(sessions),
        "best_score": best_score,
        "avg_score": avg_score,
        "improvement": improvement,
        "weak_spots": weak_spots,
        "milestones": milestones[-5:],
    }


@router.post("/retry")
def submit_retry_answer(
    payload: MockRetryRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user_optional),
):
    """Student retries the same question after feedback. Scores the new attempt and records improvement."""
    # 1. Fetch previous answer and question context
    prev = db.execute(
        text(
            """
        SELECT ia.*, iq.question_text, iq.interview_id,
               q.coaching_tips, q.ideal_answer_example,
               q.expected_answer_framework, q.star_required,
               q.id as question_bank_id
        FROM interview_answers ia
        JOIN interview_questions iq ON iq.id = ia.interview_question_id
        LEFT JOIN questions q ON q.id = iq.question_bank_id
        WHERE ia.id = :aid
        """
        ),
        {"aid": payload.previous_answer_id},
    ).mappings().first()

    if not prev:
        raise HTTPException(status_code=404, detail="Previous answer not found")

    # 2. Check attempt limit
    if payload.attempt_number > 3:
        raise HTTPException(status_code=400, detail="Maximum 3 attempts per question")

    # 3. Score the new attempt using Claude via anthropic
    scoring_prompt = f"""
You are coaching a student preparing for a job interview.

Question: {prev['question_text']}

This is attempt {payload.attempt_number} of 3.

Previous answer (attempt {payload.attempt_number - 1}):
"{prev.get('transcript', '')}"

Previous score: {prev.get('overall_score', 0)}/100

New answer (attempt {payload.attempt_number}):
"{payload.transcript}"

Evaluate the new answer on:
1. Technical accuracy (0-100)
2. Communication clarity (0-100)
3. Completeness (0-100)
4. STAR framework compliance (0-100) if behavioral

Also:
- What specifically improved from the previous attempt?
- What still needs work?
- One specific fix for the next attempt (if attempt < 3)
- Overall score (weighted: technical 60%, communication 30%, completeness 10%)

Respond ONLY in valid JSON:
{{
  "technical": <int>,
  "communication": <int>,
  "completeness": <int>,
  "star_compliance": <int or null>,
  "overall": <float>,
  "what_improved": "<specific improvement>",
  "still_needs_work": "<what remains weak>",
  "specific_fix": "<one actionable thing for next attempt>",
  "coaching_note": "<encouraging but honest 1-2 sentences>"
}}
"""

    api_key = os.getenv("ANTHROPIC_API_KEY", "").strip()
    scores = None
    if api_key:
        try:
            client = anthropic.Anthropic(api_key=api_key)
            response = client.messages.create(
                model="claude-haiku-4-5-20251001",
                max_tokens=800,
                messages=[{"role": "user", "content": scoring_prompt}],
            )
            text_payload = ""
            for block in getattr(response, "content", []):
                if getattr(block, "type", "") == "text":
                    text_payload += getattr(block, "text", "")

            raw = text_payload.strip()
            if raw.startswith("``"):
                parts = raw.split("``")
                if len(parts) >= 2:
                    raw = parts[1]
            scores = json.loads(raw)
        except Exception as e:
            log.warning("[MOCK.RETRY] Claude scoring failed: %s", e)

    if not scores:
        scores = {
            "technical": 50,
            "communication": 50,
            "completeness": 50,
            "star_compliance": None,
            "overall": 50.0,
            "what_improved": "Unable to assess improvement",
            "still_needs_work": "Keep practicing",
            "specific_fix": "Focus on giving specific examples",
            "coaching_note": "Good effort, keep going.",
        }

    prev_score = float(prev.get("overall_score") or 0)
    new_score = float(scores.get("overall") or 0)
    improvement = round(new_score - prev_score, 2)

    new_answer = db.execute(
        text(
            """
        INSERT INTO interview_answers (
            interview_question_id,
            transcript,
            overall_score,
            ai_feedback,
            attempt_number,
            parent_answer_id,
            retry_feedback,
            improvement_from_previous,
            specific_fix,
            star_compliance,
            feedback_confidence,
            is_followup
        ) VALUES (
            :qid, :transcript, :overall,
            CAST(:feedback AS jsonb),
            :attempt, :parent_id,
            :retry_feedback, :improvement,
            :specific_fix, :star,
            'high', false
        ) RETURNING id
        """
        ),
        {
            "qid": payload.question_id,
            "transcript": payload.transcript,
            "overall": new_score,
            "feedback": json.dumps(scores),
            "attempt": payload.attempt_number,
            "parent_id": payload.previous_answer_id,
            "retry_feedback": scores.get("what_improved", ""),
            "improvement": improvement,
            "specific_fix": scores.get("specific_fix", ""),
            "star": scores.get("star_compliance"),
        },
    ).mappings().first()

    db.execute(
        text(
            """
        INSERT INTO session_attempts (
            interview_question_id,
            interview_answer_id,
            attempt_number,
            transcript,
            score,
            specific_feedback,
            improvement_delta
        ) VALUES (
            :qid, :aid, :attempt,
            :transcript, :score,
            :feedback, :delta
        )
        """
        ),
        {
            "qid": payload.question_id,
            "aid": new_answer["id"],
            "attempt": payload.attempt_number,
            "transcript": payload.transcript,
            "score": new_score,
            "feedback": scores.get("specific_fix", ""),
            "delta": improvement,
        },
    )

    db.execute(
        text(
            """
        UPDATE mock_sessions ms
        SET total_retries = COALESCE(total_retries, 0) + 1
        FROM interviews i
        JOIN interview_questions iq ON iq.interview_id = i.id
        WHERE iq.id = :qid
        AND i.mock_session_id = ms.id
        """
        ),
        {"qid": payload.question_id},
    )

    db.commit()

    can_retry = payload.attempt_number < 3 and new_score < 70

    return {
        "answer_id": new_answer["id"],
        "attempt_number": payload.attempt_number,
        "scores": {
            "technical": scores.get("technical"),
            "communication": scores.get("communication"),
            "completeness": scores.get("completeness"),
            "overall": new_score,
        },
        "improvement": improvement,
        "what_improved": scores.get("what_improved"),
        "still_needs_work": scores.get("still_needs_work"),
        "specific_fix": scores.get("specific_fix"),
        "coaching_note": scores.get("coaching_note"),
        "can_retry": can_retry,
        "show_ideal_answer": payload.attempt_number >= 3,
        "ideal_answer_example": prev.get("ideal_answer_example") if payload.attempt_number >= 3 else None,
    }


@router.post("/flag-feedback")
def flag_feedback(
    payload: FlagFeedbackRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user_optional),
):
    user_id = getattr(current_user, "id", None)

    db.execute(
        text(
            """
        INSERT INTO coaching_feedback_flags
            (answer_id, user_id, flag_reason, flagged_text)
        VALUES (:aid, :uid, :reason, :text)
        """
        ),
        {"aid": payload.answer_id, "uid": user_id, "reason": payload.flag_reason, "text": payload.flagged_text},
    )

    db.execute(
        text(
            """
        UPDATE interview_answers
        SET feedback_flag_count = COALESCE(feedback_flag_count, 0) + 1,
            feedback_flagged = CASE
                WHEN COALESCE(feedback_flag_count, 0) + 1 >= 3 THEN true
                ELSE feedback_flagged
            END
        WHERE id = :aid
        """
        ),
        {"aid": payload.answer_id},
    )

    db.commit()
    return {"ok": True, "message": "Feedback flagged for review"}


@router.get("/retry-context/{question_id}")
def get_retry_context(
    question_id: int,
    db: Session = Depends(get_db),
):
    # Get question info
    question = db.execute(text("""
        SELECT 
            iq.question_text,
            iq.question_bank_id,
            q.coaching_tips,
            q.expected_answer_framework,
            q.star_required
        FROM interview_questions iq
        LEFT JOIN questions q ON q.id = iq.question_bank_id
        WHERE iq.id = :qid
    """), {"qid": question_id}).mappings().first()

    if not question:
        raise HTTPException(404, "Question not found")

    # Get latest answer score directly from interview_answers
    latest_score_row = db.execute(text("""
        SELECT 
            s.overall_score,
            s.ai_feedback,
            s.question_id,
            s.created_at
        FROM interview_scores s
        WHERE s.question_id = :qid
        ORDER BY s.created_at DESC
        LIMIT 1
    """), {"qid": question_id}).mappings().first()

    # Also check interview_answers for retry attempts
    latest_answer = db.execute(text("""
        SELECT 
            ia.id,
            ia.overall_score,
            ia.specific_fix,
            ia.attempt_number
        FROM interview_answers ia
        WHERE ia.interview_question_id = :qid
          AND ia.overall_score IS NOT NULL
        ORDER BY ia.created_at DESC
        LIMIT 1
    """), {"qid": question_id}).mappings().first()

    latest_score = None
    specific_fix = None
    attempt_count = 0

    # Prefer interview_answers (retry attempts) over interview_scores
    if latest_answer and latest_answer["overall_score"] is not None:
        latest_score = float(latest_answer["overall_score"])
        specific_fix = latest_answer.get("specific_fix")
        attempt_count = latest_answer.get("attempt_number") or 1
    elif latest_score_row and latest_score_row["overall_score"] is not None:
        latest_score = float(latest_score_row["overall_score"])
        # Extract specific_fix from ai_feedback JSONB if available
        try:
            feedback = latest_score_row["ai_feedback"]
            if isinstance(feedback, str):
                import json
                feedback = json.loads(feedback)
            if isinstance(feedback, dict):
                weaknesses = feedback.get("weaknesses", [])
                if weaknesses:
                    specific_fix = weaknesses[0] if isinstance(weaknesses, list) else str(weaknesses)
        except Exception:
            specific_fix = None
        attempt_count = 1
        
    return {
        "question_text": question["question_text"],
        "attempt_count": attempt_count,
        "latest_score": latest_score,
        "specific_fix": specific_fix,
        "coaching_tips": question["coaching_tips"],
        "expected_framework": question["expected_answer_framework"],
        "star_required": question["star_required"],
        "attempts_summary": [],
        "can_retry": attempt_count < 3,
    }