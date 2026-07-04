# backend/api/feedback.py
from __future__ import annotations

from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.orm import Session

from api.deps import get_current_user_optional
from db.session import get_db

router = APIRouter(prefix="/api/feedback", tags=["feedback"])


# ─── Schemas ─────────────────────────────────────────────────────────────────

class SessionFeedbackRequest(BaseModel):
    session_id: str
    score_fairness: Optional[str] = None        # "too_harsh" | "about_right" | "too_easy"
    question_relevance: Optional[str] = None    # "yes" | "somewhat" | "no"
    wanted_topic: Optional[str] = None          # "behavioural" | "dsa" | "system_design" | "networking"
    would_recommend: Optional[str] = None       # "yes" | "maybe" | "no"
    free_text: Optional[str] = None


VALID_FAIRNESS    = {"too_harsh", "about_right", "too_easy"}
VALID_RELEVANCE   = {"yes", "somewhat", "no"}
VALID_TOPIC       = {"behavioural", "dsa", "system_design", "networking"}
VALID_RECOMMEND   = {"yes", "maybe", "no"}


# ─── Submit feedback ──────────────────────────────────────────────────────────

@router.post("/session")
def submit_session_feedback(
    payload: SessionFeedbackRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user_optional),
):
    # Validate session_id
    try:
        session_uuid = str(UUID(payload.session_id))
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid session_id")

    # Check session exists and belongs to user (if logged in)
    session_row = db.execute(
        text("SELECT user_id FROM mock_sessions WHERE id = :sid LIMIT 1"),
        {"sid": session_uuid},
    ).mappings().first()

    if not session_row:
        raise HTTPException(status_code=404, detail="Session not found")

    user_id = getattr(current_user, "id", None)

    # Validate enum fields
    if payload.score_fairness and payload.score_fairness not in VALID_FAIRNESS:
        raise HTTPException(status_code=400, detail="Invalid score_fairness value")
    if payload.question_relevance and payload.question_relevance not in VALID_RELEVANCE:
        raise HTTPException(status_code=400, detail="Invalid question_relevance value")
    if payload.wanted_topic and payload.wanted_topic not in VALID_TOPIC:
        raise HTTPException(status_code=400, detail="Invalid wanted_topic value")
    if payload.would_recommend and payload.would_recommend not in VALID_RECOMMEND:
        raise HTTPException(status_code=400, detail="Invalid would_recommend value")

    # Idempotent — one feedback per session per user
    existing = db.execute(
        text("""
            SELECT id FROM session_feedback
            WHERE session_id = :sid
              AND (user_id = :uid OR (:uid IS NULL AND user_id IS NULL))
            LIMIT 1
        """),
        {"sid": session_uuid, "uid": user_id},
    ).mappings().first()

    if existing:
        # Update instead of duplicate
        db.execute(
            text("""
                UPDATE session_feedback SET
                    score_fairness     = COALESCE(:sf,  score_fairness),
                    question_relevance = COALESCE(:qr,  question_relevance),
                    wanted_topic       = COALESCE(:wt,  wanted_topic),
                    would_recommend    = COALESCE(:wr,  would_recommend),
                    free_text          = COALESCE(:ft,  free_text)
                WHERE id = :id
            """),
            {
                "sf":  payload.score_fairness,
                "qr":  payload.question_relevance,
                "wt":  payload.wanted_topic,
                "wr":  payload.would_recommend,
                "ft":  (payload.free_text or "").strip() or None,
                "id":  existing["id"],
            },
        )
    else:
        db.execute(
            text("""
                INSERT INTO session_feedback
                    (session_id, user_id, score_fairness, question_relevance,
                     wanted_topic, would_recommend, free_text)
                VALUES
                    (:sid, :uid, :sf, :qr, :wt, :wr, :ft)
            """),
            {
                "sid": session_uuid,
                "uid": user_id,
                "sf":  payload.score_fairness,
                "qr":  payload.question_relevance,
                "wt":  payload.wanted_topic,
                "wr":  payload.would_recommend,
                "ft":  (payload.free_text or "").strip() or None,
            },
        )

    db.commit()
    return {"ok": True}


# ─── Check if user has already submitted feedback for a session ───────────────

@router.get("/session/{session_id}/exists")
def check_feedback_exists(
    session_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user_optional),
):
    try:
        session_uuid = str(UUID(session_id))
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid session_id")

    user_id = getattr(current_user, "id", None)

    row = db.execute(
        text("""
            SELECT id FROM session_feedback
            WHERE session_id = :sid
              AND (user_id = :uid OR (:uid IS NULL AND user_id IS NULL))
            LIMIT 1
        """),
        {"sid": session_uuid, "uid": user_id},
    ).mappings().first()

    return {"exists": row is not None}


# ─── Admin: list all feedback ─────────────────────────────────────────────────

@router.get("/admin/list")
def list_feedback(
    limit: int = 50,
    offset: int = 0,
    score_fairness: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user_optional),
):
    if not getattr(current_user, "is_superuser", False):
        raise HTTPException(status_code=403, detail="Admin only")

    where = "WHERE 1=1"
    params: dict = {"limit": limit, "offset": offset}

    if score_fairness:
        where += " AND sf.score_fairness = :sf"
        params["sf"] = score_fairness

    rows = db.execute(
        text(f"""
            SELECT
                sf.id,
                sf.session_id,
                sf.user_id,
                u.email          AS user_email,
                ms.role_target,
                ms.seniority,
                sf.score_fairness,
                sf.question_relevance,
                sf.wanted_topic,
                sf.would_recommend,
                sf.free_text,
                sf.created_at
            FROM session_feedback sf
            LEFT JOIN users        u  ON u.id  = sf.user_id
            LEFT JOIN mock_sessions ms ON ms.id = sf.session_id
            {where}
            ORDER BY sf.created_at DESC
            LIMIT :limit OFFSET :offset
        """),
        params,
    ).mappings().all()

    total = db.execute(
        text(f"""
            SELECT COUNT(*) FROM session_feedback sf {where}
        """),
        {k: v for k, v in params.items() if k not in ("limit", "offset")},
    ).scalar()

    # NPS-style summary
    recommend_counts = db.execute(
        text("""
            SELECT would_recommend, COUNT(*) as cnt
            FROM session_feedback
            WHERE would_recommend IS NOT NULL
            GROUP BY would_recommend
        """)
    ).mappings().all()

    recommend_summary = {r["would_recommend"]: r["cnt"] for r in recommend_counts}

    return {
        "total": total,
        "items": [dict(r) for r in rows],
        "recommend_summary": recommend_summary,
    }