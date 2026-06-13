# backend/api/quick_prep.py
"""
Quick Prep API — voice-first revision mode.

POST /api/quick-prep/start    — generate concept list for a session
POST /api/quick-prep/respond  — evaluate student's response to a concept
POST /api/quick-prep/end       — finalize session, generate summary
"""

from __future__ import annotations

import json
import logging
import os
import random
from typing import Any, Optional
from uuid import UUID

import anthropic
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.orm import Session

from api.deps import get_current_user
from db.session import SessionLocal

log = logging.getLogger(__name__)

router = APIRouter(prefix="/api/quick-prep", tags=["quick-prep"])

QUICK_PREP_PLANS = {"pro", "max"}

# ─── Concept count by duration ─────────────────────────────────────────────────

DURATION_CONCEPT_COUNTS = {
    10: {"warmup": 1, "targeted": 8, "rapid_fire": 4},
    15: {"warmup": 1, "targeted": 13, "rapid_fire": 6},
    20: {"warmup": 1, "targeted": 18, "rapid_fire": 8},
}

FOCUS_TOPIC_MAP = {
    "technical": ["DBMS", "OS", "CN", "OOP"],
    "dsa_concepts": ["DSA"],
    "behavioral": ["Behavioral"],
    "mixed": None,  # all topics
    "auto": None,   # all topics, weighted by weak spots
}


# ─── Schemas ──────────────────────────────────────────────────────────────────

class StartRequest(BaseModel):
    company: Optional[str] = None
    duration_minutes: int = 15
    focus_area: str = "auto"  # auto|technical|dsa_concepts|behavioral|mixed


class RespondRequest(BaseModel):
    session_id: str
    concept_id: str
    mode: str  # "know_this" | "explain"
    transcript: str = ""


class EndRequest(BaseModel):
    session_id: str
    was_audio_only: bool = False


# ─── Helpers ──────────────────────────────────────────────────────────────────

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


def _get_weak_topics(db: Session, user_id: int) -> list[str]:
    """Topics where the student's average score is lowest across mock sessions."""
    rows = db.execute(
        text("""
            SELECT topic, AVG(score) as avg_score
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
            LIMIT 3
        """),
        {"uid": user_id},
    ).fetchall()
    return [r[0] for r in rows if r[0]]


def _get_strong_topics(db: Session, user_id: int) -> list[str]:
    """Topics where the student's average score is highest."""
    rows = db.execute(
        text("""
            SELECT topic, AVG(score) as avg_score
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
            HAVING AVG(score) >= 50
            ORDER BY avg_score DESC
            LIMIT 3
        """),
        {"uid": user_id},
    ).fetchall()
    return [r[0] for r in rows if r[0]]


def _get_recently_used_concepts(db: Session, user_id: int, limit: int = 1) -> set[str]:
    """Concept IDs covered in the user's last N Quick Prep sessions."""
    rows = db.execute(
        text("""
            SELECT concept_id FROM (
                SELECT qpcr.concept_id, qpcr.created_at
                FROM quick_prep_concept_results qpcr
                JOIN quick_prep_sessions qps ON qps.id = qpcr.session_id
                WHERE qps.user_id = :uid
                ORDER BY qpcr.created_at DESC
                LIMIT 50
            ) sub
        """),
        {"uid": user_id},
    ).fetchall()
    return {str(r[0]) for r in rows}


def _select_concepts(
    db: Session,
    user_id: int,
    duration_minutes: int,
    focus_area: str,
) -> dict[str, list[dict]]:
    """
    Select concepts for warmup, targeted revision, and rapid fire
    based on the algorithm in the spec.
    """
    counts = DURATION_CONCEPT_COUNTS.get(duration_minutes, DURATION_CONCEPT_COUNTS[15])

    weak_topics = _get_weak_topics(db, user_id)
    strong_topics = _get_strong_topics(db, user_id)
    recently_used = _get_recently_used_concepts(db, user_id)

    # Map mock interview topic names to quick_prep_concepts topic names
    topic_normalize = {
        "dsa": "DSA", "system_design": "System Design", "system-design": "System Design",
        "behavioral": "Behavioral", "dbms": "DBMS", "os": "OS", "cn": "CN",
        "oop": "OOP", "general": "DBMS",  # fallback
    }
    weak_topics_norm = [topic_normalize.get(t.lower(), t) for t in weak_topics]
    strong_topics_norm = [topic_normalize.get(t.lower(), t) for t in strong_topics]

    # Determine topic filter based on focus area
    allowed_topics = FOCUS_TOPIC_MAP.get(focus_area)

    def fetch_concepts(topics: Optional[list[str]], exclude_ids: set[str], limit: int) -> list[dict]:
        query = "SELECT id, concept_name, topic, subtopic, ask_prompt, good_answer_summary, refresher_short, refresher_full, interview_edge_tip, rapid_fire_prompt, rapid_fire_answer, key_terms, difficulty FROM quick_prep_concepts WHERE is_active = TRUE"
        params: dict[str, Any] = {}

        if topics:
            query += " AND topic = ANY(:topics)"
            params["topics"] = topics

        if exclude_ids:
            query += " AND id::text != ALL(:exclude)"
            params["exclude"] = list(exclude_ids)

        query += " ORDER BY random() LIMIT :limit"
        params["limit"] = limit

        rows = db.execute(text(query), params).mappings().all()
        return [dict(r) for r in rows]

    used_ids: set[str] = set()
    warmup: list[dict] = []
    targeted: list[dict] = []
    rapid_fire: list[dict] = []

    # ── Step 2: Warm-up — from strong topics ──────────────────────────────────
    warmup_topics = strong_topics_norm if strong_topics_norm else None
    warmup_candidates = fetch_concepts(warmup_topics or allowed_topics, recently_used | used_ids, counts["warmup"] + 2)
    if not warmup_candidates:
        warmup_candidates = fetch_concepts(allowed_topics, used_ids, counts["warmup"] + 2)
    warmup = warmup_candidates[:counts["warmup"]]
    used_ids.update(str(c["id"]) for c in warmup)

    # ── Step 3: Targeted revision ──────────────────────────────────────────────
    targeted_needed = counts["targeted"]

    # 40% weak topics
    n_weak = max(1, int(targeted_needed * 0.4))
    if weak_topics_norm:
        weak_concepts = fetch_concepts(weak_topics_norm, recently_used | used_ids, n_weak)
        targeted.extend(weak_concepts)
        used_ids.update(str(c["id"]) for c in weak_concepts)

    # 30% company-tested (we don't have company tagging yet — fallback to allowed topics)
    n_company = max(1, int(targeted_needed * 0.3))
    company_concepts = fetch_concepts(allowed_topics, recently_used | used_ids, n_company)
    targeted.extend(company_concepts)
    used_ids.update(str(c["id"]) for c in company_concepts)

    # Remaining — stale + safety net (general pool)
    remaining = targeted_needed - len(targeted)
    if remaining > 0:
        more_concepts = fetch_concepts(allowed_topics, used_ids, remaining)
        targeted.extend(more_concepts)
        used_ids.update(str(c["id"]) for c in more_concepts)

    # If still short (not enough concepts in DB), allow reuse from recently_used
    remaining = targeted_needed - len(targeted)
    if remaining > 0:
        more_concepts = fetch_concepts(allowed_topics, set(), remaining)
        # filter out duplicates already selected
        more_concepts = [c for c in more_concepts if str(c["id"]) not in used_ids]
        targeted.extend(more_concepts[:remaining])
        used_ids.update(str(c["id"]) for c in more_concepts[:remaining])

    targeted = targeted[:targeted_needed]

    # ── Step 4: Rapid fire — breadth, prefer concepts not yet used ─────────────
    rapid_needed = counts["rapid_fire"]
    rapid_concepts = fetch_concepts(allowed_topics, used_ids, rapid_needed)
    if len(rapid_concepts) < rapid_needed:
        # allow reuse if pool too small
        more = fetch_concepts(allowed_topics, set(), rapid_needed - len(rapid_concepts))
        more = [c for c in more if str(c["id"]) not in {str(x["id"]) for x in rapid_concepts}]
        rapid_concepts.extend(more)
    rapid_fire = rapid_concepts[:rapid_needed]

    return {
        "warmup": warmup,
        "targeted": targeted,
        "rapid_fire": rapid_fire,
    }


def _serialize_concept(c: dict, phase: str) -> dict:
    return {
        "id": str(c["id"]),
        "concept_name": c["concept_name"],
        "topic": c["topic"],
        "subtopic": c.get("subtopic"),
        "ask_prompt": c["ask_prompt"],
        "good_answer_summary": c["good_answer_summary"],
        "refresher_short": c["refresher_short"],
        "refresher_full": c["refresher_full"],
        "interview_edge_tip": c.get("interview_edge_tip"),
        "rapid_fire_prompt": c.get("rapid_fire_prompt"),
        "rapid_fire_answer": c.get("rapid_fire_answer"),
        "key_terms": c.get("key_terms") or [],
        "difficulty": c.get("difficulty"),
        "phase": phase,
    }


# ─── Endpoints ────────────────────────────────────────────────────────────────

@router.post("/start")
def start_session(
    payload: StartRequest,
    db: Session = Depends(_get_db),
    current_user=Depends(get_current_user),
) -> dict:
    """Generate a personalized concept list and create a session."""
    plan = _get_user_plan(db, current_user.id)
    if plan not in QUICK_PREP_PLANS:
        raise HTTPException(
            status_code=403,
            detail="quick_prep_requires_pro",
        )

    duration = payload.duration_minutes
    if duration not in DURATION_CONCEPT_COUNTS:
        duration = 15

    selection = _select_concepts(db, current_user.id, duration, payload.focus_area)

    all_concepts = (
        [_serialize_concept(c, "warmup") for c in selection["warmup"]]
        + [_serialize_concept(c, "targeted") for c in selection["targeted"]]
        + [_serialize_concept(c, "rapid_fire") for c in selection["rapid_fire"]]
    )

    if not all_concepts:
        raise HTTPException(status_code=404, detail="no_concepts_available")

    # Create session row
    session_row = db.execute(
        text("""
            INSERT INTO quick_prep_sessions
                (user_id, company, duration_minutes, focus_area)
            VALUES (:uid, :company, :duration, :focus)
            RETURNING id
        """),
        {
            "uid": current_user.id,
            "company": payload.company,
            "duration": duration,
            "focus": payload.focus_area,
        },
    ).scalar()
    db.commit()

    return {
        "session_id": str(session_row),
        "duration_minutes": duration,
        "total_concepts": len(all_concepts),
        "concepts": all_concepts,
    }


@router.post("/respond")
def respond_to_concept(
    payload: RespondRequest,
    db: Session = Depends(_get_db),
    current_user=Depends(get_current_user),
) -> dict:
    """
    Evaluate the student's response to a concept (or handle 'know_this' mode).
    Returns AI feedback text + result classification.
    """
    plan = _get_user_plan(db, current_user.id)
    if plan not in QUICK_PREP_PLANS:
        raise HTTPException(status_code=403, detail="quick_prep_requires_pro")

    # Load concept
    concept = db.execute(
        text("""
            SELECT id, concept_name, ask_prompt, good_answer_summary,
                   refresher_short, refresher_full, interview_edge_tip,
                   rapid_fire_prompt, rapid_fire_answer, key_terms
            FROM quick_prep_concepts
            WHERE id = CAST(:cid AS uuid)
        """),
        {"cid": payload.concept_id},
    ).mappings().first()

    if not concept:
        raise HTTPException(status_code=404, detail="concept_not_found")

    # "know_this" mode — just return the rapid-fire check, no Claude call needed
    if payload.mode == "know_this":
        return {
            "response_type": "rapid_check",
            "ai_text": concept["rapid_fire_prompt"] or f"Quick — explain {concept['concept_name']} in one sentence.",
            "result": "solid",  # tentative; finalized when rapid answer given
        }

    # "explain" mode — evaluate via Claude
    transcript = (payload.transcript or "").strip()

    if not transcript or len(transcript.split()) < 3:
        return {
            "response_type": "no_response",
            "ai_text": "I didn't catch that — want to try again, or should we move on?",
            "result": "skipped",
        }

    api_key = os.getenv("ANTHROPIC_API_KEY", "").strip()
    if not api_key:
        # Fallback — assume needs refresher
        return {
            "response_type": "needs_refresher",
            "ai_text": concept["refresher_short"],
            "result": "revised",
            "ask_repeat": True,
        }

    eval_prompt = f"""The student was asked to explain this concept: "{concept['concept_name']}"

What a good explanation covers: "{concept['good_answer_summary']}"

Key terms that should appear: {concept['key_terms']}

Student said: "{transcript}"

Evaluate in JSON only, no markdown:
{{"understood": true/false, "coverage": "full"|"partial"|"none", "missing_points": ["..."], "response_type": "solid"|"needs_refresher"|"needs_full_explanation"}}"""

    try:
        client = anthropic.Anthropic(api_key=api_key)
        response = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=200,
            messages=[{"role": "user", "content": eval_prompt}],
        )
        raw = ""
        for block in getattr(response, "content", []):
            if getattr(block, "type", "") == "text":
                raw += getattr(block, "text", "")

        clean = raw.strip()
        if clean.startswith("```"):
            clean = clean.split("```")[1]
            if clean.startswith("json"):
                clean = clean[4:]
        parsed = json.loads(clean.strip())

        response_type = parsed.get("response_type", "needs_refresher")

    except Exception as e:
        log.warning("[QUICK_PREP] Claude eval failed: %s", e)
        response_type = "needs_refresher"

    # Build AI response based on classification
    if response_type == "solid":
        ai_text = "Solid."
        if concept["interview_edge_tip"]:
            ai_text += f" One thing to add if they push deeper: {concept['interview_edge_tip']}"
        ai_text += " Moving on."
        return {
            "response_type": "solid",
            "ai_text": ai_text,
            "result": "solid",
            "ask_repeat": False,
        }

    elif response_type == "needs_refresher":
        ai_text = concept["refresher_short"]
        ai_text += " Can you say that back in your own words?"
        return {
            "response_type": "needs_refresher",
            "ai_text": ai_text,
            "result": "revised",
            "ask_repeat": True,
        }

    else:  # needs_full_explanation
        ai_text = concept["refresher_full"]
        ai_text += " Can you repeat the key takeaway?"
        return {
            "response_type": "needs_full_explanation",
            "ai_text": ai_text,
            "result": "new",
            "ask_repeat": True,
        }


@router.post("/log-result")
def log_concept_result(
    session_id: str,
    concept_id: str,
    result: str,
    student_transcript: str = "",
    db: Session = Depends(_get_db),
    current_user=Depends(get_current_user),
) -> dict:
    """Log the final result for a concept (called after repeat-back or skip)."""
    db.execute(
        text("""
            INSERT INTO quick_prep_concept_results
                (session_id, concept_id, result, student_transcript)
            VALUES (CAST(:sid AS uuid), CAST(:cid AS uuid), :result, :transcript)
        """),
        {
            "sid": session_id,
            "cid": concept_id,
            "result": result,
            "transcript": student_transcript,
        },
    )
    db.commit()
    return {"ok": True}


@router.post("/end")
def end_session(
    payload: EndRequest,
    db: Session = Depends(_get_db),
    current_user=Depends(get_current_user),
) -> dict:
    """Finalize session — aggregate results and generate summary."""
    # Aggregate results
    results = db.execute(
        text("""
            SELECT qpcr.result, qpc.concept_name, qpc.topic, qpc.refresher_short
            FROM quick_prep_concept_results qpcr
            JOIN quick_prep_concepts qpc ON qpc.id = qpcr.concept_id
            WHERE qpcr.session_id = CAST(:sid AS uuid)
        """),
        {"sid": payload.session_id},
    ).mappings().all()

    counts = {"solid": 0, "revised": 0, "new": 0, "skipped": 0}
    weak_concepts = []
    strong_topics_covered = set()

    for r in results:
        result = r["result"]
        if result in counts:
            counts[result] += 1
        if result in ("revised", "new"):
            weak_concepts.append({
                "concept_name": r["concept_name"],
                "topic": r["topic"],
                "refresher": r["refresher_short"],
            })
        elif result == "solid":
            strong_topics_covered.add(r["topic"])

    total_covered = sum(counts.values())

    # Get total quick prep sessions for confidence message
    total_sessions = db.execute(
        text("SELECT COUNT(*) FROM quick_prep_sessions WHERE user_id = :uid"),
        {"uid": current_user.id},
    ).scalar() or 1

    # Get total mock sessions for "you've done N real sessions" line
    mock_sessions = db.execute(
        text("SELECT COUNT(*) FROM mock_sessions WHERE user_id = :uid AND status = 'completed'"),
        {"uid": current_user.id},
    ).scalar() or 0

    # Build key reminders (top 2-4 weakest)
    key_reminders = weak_concepts[:4]

    # Confidence close message
    company_row = db.execute(
        text("SELECT company FROM quick_prep_sessions WHERE id = CAST(:sid AS uuid)"),
        {"sid": payload.session_id},
    ).scalar()

    if company_row:
        if mock_sessions > 0:
            closing = f"You've done {mock_sessions} practice session{'s' if mock_sessions != 1 else ''} preparing for {company_row}. You're more ready than you think. Go get it."
        else:
            closing = f"You just revised {total_covered} concepts for {company_row}. Walk in with confidence — you know more than you think."
    else:
        closing = f"You revised {total_covered} concepts just now. That's active recall — it sticks better than re-reading notes. Good luck."

    # Update session row with final counts
    db.execute(
        text("""
            UPDATE quick_prep_sessions
            SET concepts_covered = :covered,
                concepts_solid = :solid,
                concepts_revised = :revised,
                concepts_new = :new,
                concepts_skipped = :skipped,
                was_audio_only = :audio_only
            WHERE id = CAST(:sid AS uuid)
        """),
        {
            "covered": total_covered,
            "solid": counts["solid"],
            "revised": counts["revised"],
            "new": counts["new"],
            "skipped": counts["skipped"],
            "audio_only": payload.was_audio_only,
            "sid": payload.session_id,
        },
    )
    db.commit()

    return {
        "concepts_covered": total_covered,
        "solid": counts["solid"],
        "revised": counts["revised"],
        "new": counts["new"],
        "skipped": counts["skipped"],
        "key_reminders": key_reminders,
        "closing_message": closing,
        "total_quick_prep_sessions": total_sessions,
    }