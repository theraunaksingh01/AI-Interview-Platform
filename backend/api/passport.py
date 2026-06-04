# backend/api/passport.py
"""
Skill Passport API
GET /api/passport/my  — aggregated passport data for current user
"""

from __future__ import annotations

import logging
from datetime import date, datetime
from decimal import Decimal
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.orm import Session

from api.deps import get_current_user
from db.session import SessionLocal

log = logging.getLogger(__name__)

router = APIRouter(prefix="/api/passport", tags=["passport"])


def _get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _safe_float(v: Any) -> float | None:
    if v is None:
        return None
    try:
        return float(v)
    except Exception:
        return None


def _score_band(score: float | None) -> str:
    if score is None:
        return "Not assessed"
    if score >= 80: return "Expert"
    if score >= 65: return "Strong"
    if score >= 50: return "Developing"
    if score >= 35: return "Beginner"
    return "Needs work"


def _improvement(scores: list[float]) -> float | None:
    """Calculate improvement from first 2 sessions to last 2."""
    if len(scores) < 2:
        return None
    early = sum(scores[:2]) / len(scores[:2])
    recent = sum(scores[-2:]) / len(scores[-2:])
    return round(recent - early, 1)


@router.get("/my")
def get_passport(
    db: Session = Depends(_get_db),
    current_user=Depends(get_current_user),
) -> dict:
    """Return aggregated skill passport for the current user."""
    uid = current_user.id

    # ── All completed sessions ─────────────────────────────────────────────────
    sessions = db.execute(text("""
        SELECT
            overall_score, dsa_score, system_design_score,
            behavioral_score, communication_score, technical_score,
            structure_score, avg_wpm, total_filler_words,
            role_target, target_company, completed_at
        FROM mock_sessions
        WHERE user_id = :uid
          AND status = 'completed'
          AND overall_score IS NOT NULL
        ORDER BY completed_at ASC
    """), {"uid": uid}).mappings().all()

    # ── User info ──────────────────────────────────────────────────────────────
    user_row = db.execute(text("""
        SELECT full_name, email, college, year_of_study,
               branch, target_roles, self_level, plan
        FROM users WHERE id = :uid
    """), {"uid": uid}).mappings().first()

    # ── User progress / streak ─────────────────────────────────────────────────
    progress = db.execute(text("""
        SELECT streak_days, longest_streak, total_sessions,
               best_overall_score, avg_overall_7d,
               avg_technical_7d, avg_communication_7d
        FROM user_progress
        WHERE user_id = :uid
        ORDER BY updated_at DESC LIMIT 1
    """), {"uid": uid}).mappings().first()

    # ── Daily answers ──────────────────────────────────────────────────────────
    daily_count = db.execute(text("""
        SELECT COUNT(*) FROM daily_answers WHERE user_id = :uid
    """), {"uid": uid}).scalar() or 0

    if not sessions and not progress:
        return {
            "has_data": False,
            "user": {
                "name": getattr(current_user, "full_name", None) or "Student",
                "email": getattr(current_user, "email", ""),
                "plan": getattr(current_user, "plan", "free"),
            },
            "message": "Complete at least one mock session to generate your Skill Passport.",
        }

    # ── Aggregate scores ───────────────────────────────────────────────────────
    total_sessions = len(sessions)

    overall_scores  = [_safe_float(s["overall_score"])       for s in sessions if s["overall_score"]]
    dsa_scores      = [_safe_float(s["dsa_score"])           for s in sessions if s["dsa_score"]]
    sd_scores       = [_safe_float(s["system_design_score"]) for s in sessions if s["system_design_score"]]
    beh_scores      = [_safe_float(s["behavioral_score"])    for s in sessions if s["behavioral_score"]]
    comm_scores     = [_safe_float(s["communication_score"]) for s in sessions if s["communication_score"]]
    tech_scores     = [_safe_float(s["technical_score"])     for s in sessions if s["technical_score"]]

    avg = lambda lst: round(sum(lst) / len(lst), 1) if lst else None
    best = lambda lst: round(max(lst), 1) if lst else None

    avg_overall  = avg(overall_scores)
    best_overall = best(overall_scores)
    improvement  = _improvement(overall_scores)

    # WPM and filler averages
    wpm_vals     = [_safe_float(s["avg_wpm"]) for s in sessions if s["avg_wpm"]]
    filler_vals  = [_safe_float(s["total_filler_words"]) for s in sessions if s["total_filler_words"] is not None]
    avg_wpm      = avg(wpm_vals)
    avg_fillers  = avg(filler_vals)

    # Trend data for chart (last 10 sessions)
    trend = [
        {
            "session": i + 1,
            "score": _safe_float(s["overall_score"]),
            "date": s["completed_at"].strftime("%d %b") if s["completed_at"] else None,
        }
        for i, s in enumerate(sessions[-10:])
    ]

    # Roles practiced
    roles_practiced = list({s["role_target"] for s in sessions if s["role_target"]})

    # Companies practiced
    companies_practiced = list({s["target_company"] for s in sessions if s["target_company"]})

    # Topic scores
    topic_scores = {
        "dsa":            {"score": avg(dsa_scores),   "band": _score_band(avg(dsa_scores)),   "sessions": len(dsa_scores)},
        "system_design":  {"score": avg(sd_scores),    "band": _score_band(avg(sd_scores)),    "sessions": len(sd_scores)},
        "behavioral":     {"score": avg(beh_scores),   "band": _score_band(avg(beh_scores)),   "sessions": len(beh_scores)},
        "communication":  {"score": avg(comm_scores),  "band": _score_band(avg(comm_scores)),  "sessions": len(comm_scores)},
        "technical":      {"score": avg(tech_scores),  "band": _score_band(avg(tech_scores)),  "sessions": len(tech_scores)},
    }

    # Readiness score: weighted average of available topic scores
    readiness_inputs = [v["score"] for v in topic_scores.values() if v["score"] is not None]
    readiness = round(avg(readiness_inputs) or avg_overall or 0)

    # Streak info
    streak        = int(progress["streak_days"] or 0) if progress else 0
    longest       = int(progress["longest_streak"] or 0) if progress else 0

    # First and latest session dates
    first_session  = sessions[0]["completed_at"] if sessions else None
    latest_session = sessions[-1]["completed_at"] if sessions else None

    return {
        "has_data": True,
        "generated_at": datetime.utcnow().isoformat(),
        "user": {
            "name": getattr(current_user, "full_name", None) or user_row.get("full_name") or "Student",
            "email": getattr(current_user, "email", ""),
            "college": user_row.get("college") if user_row else None,
            "year_of_study": user_row.get("year_of_study") if user_row else None,
            "plan": getattr(current_user, "plan", "free"),
        },
        "readiness_score": readiness,
        "readiness_band": _score_band(readiness),
        "overall": {
            "avg_score": avg_overall,
            "best_score": best_overall,
            "improvement": improvement,
            "total_sessions": total_sessions,
        },
        "topic_scores": topic_scores,
        "communication": {
            "avg_wpm": avg_wpm,
            "avg_fillers": avg_fillers,
            "wpm_band": (
                "Too slow" if avg_wpm and avg_wpm < 100 else
                "Ideal" if avg_wpm and avg_wpm <= 180 else
                "Too fast" if avg_wpm else "Not assessed"
            ),
        },
        "streak": {
            "current": streak,
            "longest": longest,
            "daily_answered": int(daily_count),
        },
        "history": {
            "trend": trend,
            "first_session": first_session.strftime("%d %b %Y") if first_session else None,
            "latest_session": latest_session.strftime("%d %b %Y") if latest_session else None,
            "roles_practiced": roles_practiced,
            "companies_practiced": companies_practiced,
        },
    }