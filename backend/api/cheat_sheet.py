# backend/api/cheat_sheet.py
"""
Cheat Sheet API — personalized one-page company prep reference.

GET /api/cheat-sheet/{company}        — full cheat sheet, cached 24h
POST /api/cheat-sheet/{company}/refresh — force regeneration
GET /api/cheat-sheet/companies         — list of companies with profiles
"""

from __future__ import annotations

import json
import logging
import os
import re
from datetime import datetime, timedelta
from typing import Any, Optional

import anthropic
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.orm import Session

from api.deps import get_current_user
from db.session import SessionLocal

log = logging.getLogger(__name__)

router = APIRouter(prefix="/api/cheat-sheet", tags=["cheat-sheet"])

CHEAT_SHEET_PLANS = {"max"}
CACHE_HOURS = 24


def _get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _get_user_plan(db: Session, user_id: int) -> str:
    row = db.execute(
        text("SELECT plan FROM users WHERE id = :uid"), {"uid": user_id}
    ).scalar()
    return (row or "free").lower()


def _strip_json_fence(raw: str) -> str:
    clean = raw.strip()
    clean = re.sub(r"^```[a-z]*\n?", "", clean)
    clean = re.sub(r"\n?```$", "", clean)
    return clean.strip()


# ─── Data gathering functions ──────────────────────────────────────────────────

def _get_strong_topics(db: Session, user_id: int, company: str | None, limit: int = 3) -> list[dict]:
    """Topics where the student's average score is >= 7.0 (on 0-10 scale, scores stored 0-100 so >=70)."""
    rows = db.execute(
        text("""
            SELECT topic, AVG(score) as avg_score, COUNT(*) as cnt
            FROM (
                SELECT
                    COALESCE(iq.topic, 'general') as topic,
                    s.overall_score as score
                FROM mock_sessions ms
                JOIN interviews i ON i.mock_session_id = ms.id
                JOIN interview_questions iq ON iq.interview_id = i.id
                LEFT JOIN interview_scores s ON s.question_id = iq.id
                WHERE ms.user_id = :uid
                  AND ms.status = 'completed'
                  AND s.overall_score IS NOT NULL
            ) sub
            GROUP BY topic
            HAVING AVG(score) >= 70
            ORDER BY avg_score DESC
            LIMIT :limit
        """),
        {"uid": user_id, "limit": limit},
    ).fetchall()
    return [{"topic": r[0], "avg_score": round(float(r[1]) / 10, 1), "session_count": r[2]} for r in rows]


def _get_weak_topics(db: Session, user_id: int, limit: int = 5) -> list[dict]:
    """Topics with lowest average scores, regardless of threshold."""
    rows = db.execute(
        text("""
            SELECT topic, AVG(score) as avg_score, COUNT(*) as cnt
            FROM (
                SELECT
                    COALESCE(iq.topic, 'general') as topic,
                    s.overall_score as score
                FROM mock_sessions ms
                JOIN interviews i ON i.mock_session_id = ms.id
                JOIN interview_questions iq ON iq.interview_id = i.id
                LEFT JOIN interview_scores s ON s.question_id = iq.id
                WHERE ms.user_id = :uid
                  AND ms.status = 'completed'
                  AND s.overall_score IS NOT NULL
            ) sub
            GROUP BY topic
            ORDER BY avg_score ASC
            LIMIT :limit
        """),
        {"uid": user_id, "limit": limit},
    ).fetchall()
    return [{"topic": r[0], "avg_score": round(float(r[1]) / 10, 1), "session_count": r[2]} for r in rows]


def _get_recent_revised_concepts(db: Session, user_id: int, days: int = 7) -> list[dict]:
    """Quick Prep concepts marked 'revised' or 'new' in the last N days."""
    cutoff = datetime.utcnow() - timedelta(days=days)
    rows = db.execute(
        text("""
            SELECT qpc.concept_name, qpc.topic, qpc.refresher_short, qpcr.result
            FROM quick_prep_concept_results qpcr
            JOIN quick_prep_sessions qps ON qps.id = qpcr.session_id
            JOIN quick_prep_concepts qpc ON qpc.id = qpcr.concept_id
            WHERE qps.user_id = :uid
              AND qpcr.result IN ('revised', 'new')
              AND qpcr.created_at >= :cutoff
            ORDER BY qpcr.created_at DESC
            LIMIT 6
        """),
        {"uid": user_id, "cutoff": cutoff},
    ).mappings().all()
    return [dict(r) for r in rows]


def _get_company_profile(db: Session, company: str) -> Optional[dict]:
    row = db.execute(
        text("""
            SELECT company, interview_pattern, most_asked_topics, interview_style,
                   difficulty_range, typical_duration, what_they_value,
                   common_questions, tips
            FROM company_profiles
            WHERE LOWER(company) = LOWER(:company)
        """),
        {"company": company},
    ).mappings().first()
    return dict(row) if row else None


def _get_coaching_patterns(db: Session, user_id: int, limit: int = 3) -> list[str]:
    """Recent coach_note / specific_fix text from sessions, as raw pattern strings."""
    rows = db.execute(
        text("""
            SELECT specific_fix, coach_note
            FROM mock_sessions
            WHERE user_id = :uid
              AND status = 'completed'
              AND (specific_fix IS NOT NULL OR coach_note IS NOT NULL)
            ORDER BY completed_at DESC
            LIMIT :limit
        """),
        {"uid": user_id, "limit": limit},
    ).mappings().all()

    patterns = []
    for r in rows:
        if r["specific_fix"]:
            patterns.append(r["specific_fix"])
    return patterns[:limit]


def _get_best_intro(db: Session, user_id: int) -> Optional[dict]:
    """Best-scored 'introduction' topic answer, from Topic Practice or mock sessions."""
    # Try topic_practice_results first (introduction subtopic)
    row = db.execute(
        text("""
            SELECT tpr.student_transcript, tpr.score
            FROM topic_practice_results tpr
            JOIN topic_practice_sessions tps ON tps.id = tpr.session_id
            JOIN quick_prep_concepts qpc ON qpc.id = tpr.concept_id
            WHERE tps.user_id = :uid
              AND qpc.subtopic = 'Introduction'
              AND tpr.student_transcript IS NOT NULL
              AND tpr.student_transcript != ''
            ORDER BY tpr.score DESC
            LIMIT 1
        """),
        {"uid": user_id},
    ).mappings().first()

    if row and row["student_transcript"]:
        return {"text": row["student_transcript"], "score": float(row["score"] or 0)}

    # Fallback: mock session "introduction" topic transcript with highest score
    row2 = db.execute(
        text("""
            SELECT ia.transcript, s.overall_score
            FROM mock_sessions ms
            JOIN interviews i ON i.mock_session_id = ms.id
            JOIN interview_questions iq ON iq.interview_id = i.id
            LEFT JOIN interview_answers ia ON ia.interview_question_id = iq.id
            LEFT JOIN interview_scores s ON s.question_id = iq.id
            WHERE ms.user_id = :uid
              AND iq.topic = 'introduction'
              AND ia.transcript IS NOT NULL
              AND ia.transcript != ''
            ORDER BY s.overall_score DESC NULLS LAST
            LIMIT 1
        """),
        {"uid": user_id},
    ).mappings().first()

    if row2 and row2["transcript"]:
        return {"text": row2["transcript"], "score": float(row2["overall_score"] or 0) / 10}

    return None


def _get_company_stats(db: Session, user_id: int, company: str) -> dict:
    """Session count, question coverage, score trend for this specific company."""
    sessions = db.execute(
        text("""
            SELECT overall_score, completed_at
            FROM mock_sessions
            WHERE user_id = :uid
              AND status = 'completed'
              AND (target_company = :company OR target_company IS NULL)
              AND overall_score IS NOT NULL
            ORDER BY completed_at ASC
        """),
        {"uid": user_id, "company": company},
    ).fetchall()

    total_sessions = db.execute(
        text("SELECT COUNT(*) FROM mock_sessions WHERE user_id = :uid AND status = 'completed'"),
        {"uid": user_id},
    ).scalar() or 0

    revised_count = db.execute(
        text("""
            SELECT COUNT(*) FROM quick_prep_concept_results qpcr
            JOIN quick_prep_sessions qps ON qps.id = qpcr.session_id
            WHERE qps.user_id = :uid
        """),
        {"uid": user_id},
    ).scalar() or 0

    scores = [float(s[0]) for s in sessions if s[0] is not None]
    score_trend = None
    if len(scores) >= 2:
        score_trend = {"start": round(scores[0] / 10, 1), "latest": round(scores[-1] / 10, 1)}

    return {
        "session_count": total_sessions,
        "company_session_count": len(sessions),
        "score_trend": score_trend,
        "concepts_revised": int(revised_count),
    }


def _generate_reminder_lines(weak_spots: list[dict], revised: list[dict]) -> list[dict]:
    """Use Claude Haiku to compress weak topics into one-line memory triggers."""
    if not weak_spots and not revised:
        return []

    api_key = os.getenv("ANTHROPIC_API_KEY", "").strip()
    if not api_key:
        return [
            {"topic": w["topic"], "reminder": f"Review {w['topic']} fundamentals before your interview"}
            for w in weak_spots[:4]
        ]

    topics_context = []
    for w in weak_spots:
        topics_context.append(f"- {w['topic']} (scored {w['avg_score']}/10 across {w['session_count']} attempts)")
    for r in revised:
        topics_context.append(f"- {r['concept_name']} ({r['topic']}) — recently revised in Quick Prep, marked '{r['result']}'")

    context_text = "\n".join(topics_context[:6])

    prompt = f"""A student preparing for technical interviews is weak on or recently revised these topics:

{context_text}

For each topic, write a single-line memory trigger — maximum 15 words. Not an explanation, a recall prompt that helps someone who studied this recently remember the key point.

Example format:
Indexing -> speeds reads (B-tree, O(log n)), slows writes
TCP vs UDP -> TCP reliable ordered, UDP fast no guarantee

Return ONLY a JSON array, no markdown: [{{"topic": "...", "reminder": "..."}}]"""

    try:
        client = anthropic.Anthropic(api_key=api_key)
        response = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=400,
            messages=[{"role": "user", "content": prompt}],
        )
        raw = ""
        for block in getattr(response, "content", []):
            if getattr(block, "type", "") == "text":
                raw += getattr(block, "text", "")
        parsed = json.loads(_strip_json_fence(raw))
        if isinstance(parsed, list):
            return parsed[:6]
    except Exception as e:
        log.warning("[CHEAT_SHEET] Reminder generation failed: %s", e)

    return [
        {"topic": w["topic"], "reminder": f"Review {w['topic']} fundamentals before your interview"}
        for w in weak_spots[:4]
    ]


def _get_cached(db: Session, user_id: int, company: str) -> Optional[dict]:
    row = db.execute(
        text("""
            SELECT content, expires_at FROM cheat_sheet_cache
            WHERE user_id = :uid AND LOWER(company) = LOWER(:company)
        """),
        {"uid": user_id, "company": company},
    ).mappings().first()
    if not row:
        return None
    if row["expires_at"] < datetime.utcnow():
        return None
    content = row["content"]
    if isinstance(content, str):
        content = json.loads(content)
    return content


def _save_cache(db: Session, user_id: int, company: str, content: dict) -> None:
    now = datetime.utcnow()
    expires = now + timedelta(hours=CACHE_HOURS)
    db.execute(
        text("""
            INSERT INTO cheat_sheet_cache (user_id, company, content, generated_at, expires_at)
            VALUES (:uid, :company, CAST(:content AS jsonb), :gen, :exp)
            ON CONFLICT (user_id, company) DO UPDATE SET
                content = CAST(:content AS jsonb),
                generated_at = :gen,
                expires_at = :exp
        """),
        {
            "uid": user_id,
            "company": company,
            "content": json.dumps(content),
            "gen": now,
            "exp": expires,
        },
    )
    db.commit()


def _build_cheat_sheet(db: Session, user_id: int, company: str, user_name: str) -> dict:
    strengths = _get_strong_topics(db, user_id, company)
    weak_spots = _get_weak_topics(db, user_id)
    revised = _get_recent_revised_concepts(db, user_id)
    company_profile = _get_company_profile(db, company)
    patterns = _get_coaching_patterns(db, user_id)
    intro = _get_best_intro(db, user_id)
    stats = _get_company_stats(db, user_id, company)

    has_strengths = len(strengths) > 0
    has_weak = len(weak_spots) > 0 or len(revised) > 0
    has_patterns = stats["session_count"] >= 5 and len(patterns) > 0

    reminders = _generate_reminder_lines(weak_spots, revised) if has_weak else []

    return {
        "company": company,
        "user_name": user_name,
        "generated_at": datetime.utcnow().isoformat(),
        "strengths": {
            "available": has_strengths,
            "data": strengths if has_strengths else None,
            "unlock_hint": "Complete 3 mock interviews to unlock your strengths analysis." if not has_strengths else None,
        },
        "reminders": {
            "available": len(reminders) > 0,
            "data": reminders,
            "unlock_hint": "Practice topic drills or Quick Prep to see your weak spots here." if not reminders else None,
        },
        "company_intel": {
            "available": company_profile is not None,
            "data": company_profile,
        },
        "patterns": {
            "available": has_patterns,
            "data": patterns if has_patterns else None,
            "unlock_hint": "After 5 sessions, Qued will identify your recurring patterns." if not has_patterns else None,
        },
        "intro": {
            "available": intro is not None,
            "data": intro,
            "unlock_hint": "Practice \"Tell me about yourself\" in Topic Practice to see your polished intro here." if not intro else None,
        },
        "stats": {
            "available": stats["session_count"] > 0,
            "data": stats,
        },
    }


# ─── Endpoints ────────────────────────────────────────────────────────────────

@router.get("/companies")
def list_companies(db: Session = Depends(_get_db)) -> dict:
    """Return all companies with profiles available."""
    rows = db.execute(
        text("SELECT company FROM company_profiles ORDER BY company ASC")
    ).scalars().all()
    return {"companies": rows}


@router.get("/{company}")
def get_cheat_sheet(
    company: str,
    db: Session = Depends(_get_db),
    current_user=Depends(get_current_user),
) -> dict:
    plan = _get_user_plan(db, current_user.id)
    if plan not in CHEAT_SHEET_PLANS:
        raise HTTPException(status_code=403, detail="cheat_sheet_requires_max")

    cached = _get_cached(db, current_user.id, company)
    if cached:
        cached["from_cache"] = True
        return cached

    user_name = getattr(current_user, "full_name", None) or "Student"
    content = _build_cheat_sheet(db, current_user.id, company, user_name)
    _save_cache(db, current_user.id, company, content)
    content["from_cache"] = False
    return content


@router.post("/{company}/refresh")
def refresh_cheat_sheet(
    company: str,
    db: Session = Depends(_get_db),
    current_user=Depends(get_current_user),
) -> dict:
    plan = _get_user_plan(db, current_user.id)
    if plan not in CHEAT_SHEET_PLANS:
        raise HTTPException(status_code=403, detail="cheat_sheet_requires_max")

    user_name = getattr(current_user, "full_name", None) or "Student"
    content = _build_cheat_sheet(db, current_user.id, company, user_name)
    _save_cache(db, current_user.id, company, content)
    content["from_cache"] = False
    return content