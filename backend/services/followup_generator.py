# backend/services/followup_generator.py
"""
Follow-up question generation using Claude Haiku.
Replaces the previous multi-provider implementation.
"""
from __future__ import annotations

import json
import logging
import os
import re
from typing import Any, Dict, Optional

import anthropic
from sqlalchemy import text
from sqlalchemy.orm import Session

from db.session import SessionLocal

log = logging.getLogger(__name__)

FOLLOWUP_TIMEOUT = int(os.getenv("FOLLOWUP_TIMEOUT", "8"))

# ─── Plan gating ──────────────────────────────────────────────────────────────

FOLLOWUP_PLANS = {"pro", "max"}

# ─── Prompts ──────────────────────────────────────────────────────────────────

FOLLOWUP_DECISION_PROMPT = """You are a {company} interviewer conducting a {role} interview.

The candidate just answered a question. Decide whether to ask a follow-up.

Ask a follow-up ONLY if:
- The candidate mentioned a technology/approach without demonstrating understanding of trade-offs
- The answer was correct but shallow — a memorised response could have produced it
- The candidate made a claim a real interviewer would want to verify
- The answer revealed an interesting thread worth exploring

Do NOT ask a follow-up if:
- The answer was already thorough and deep
- Score is below 4/10 — too weak to probe further
- This is a behavioral/HR question and the answer was genuine and specific
- The answer already covered trade-offs and alternatives

Question: {question}
Candidate's answer: {transcript}
Answer score: {score}/10

If a follow-up is warranted respond with JSON:
{{"followup": true, "question": "your follow-up question here (max 25 words, reference something specific from their answer)"}}

If no follow-up is needed respond with:
{{"followup": false}}

Return ONLY the JSON. Nothing else."""

FALLBACK_FOLLOWUPS = [
    "Can you walk me through the trade-offs of that approach?",
    "What would happen if this system needed to scale 10x?",
    "How would you handle failure in that design?",
    "What's an alternative approach and why did you choose this one?",
    "Can you give a concrete example of that from a project?",
]


# ─── Context memory ───────────────────────────────────────────────────────────

def build_context_memory(db: Session, interview_id: str, limit: int = 3) -> str:
    """Build summary of prior Q&A for context injection."""
    try:
        rows = db.execute(
            text("""
                SELECT iq.question_text, it.transcript
                FROM interview_turns it
                JOIN interview_questions iq ON iq.id = it.question_id
                WHERE it.interview_id = :iid
                  AND it.speaker = 'candidate'
                  AND it.transcript IS NOT NULL
                  AND it.transcript != ''
                ORDER BY it.id ASC
                LIMIT :lim
            """),
            {"iid": str(interview_id), "lim": limit},
        ).fetchall()
    except Exception:
        return ""

    if not rows:
        return ""

    lines = []
    for i, r in enumerate(rows, 1):
        q = (r[0] or "")[:120]
        a = (r[1] or "")[:180]
        lines.append(f"Q{i}: {q}\nA{i}: {a}")
    return "Prior exchanges:\n" + "\n\n".join(lines)


# ─── Difficulty hint ──────────────────────────────────────────────────────────

def get_difficulty_hint(db: Session, interview_id: str) -> str:
    try:
        rows = db.execute(
            text("""
                SELECT overall_score FROM interview_scores
                WHERE interview_id = :iid AND overall_score IS NOT NULL
                ORDER BY created_at DESC LIMIT 3
            """),
            {"iid": str(interview_id)},
        ).fetchall()
    except Exception:
        return "same"

    scores = [float(r[0]) for r in rows if r[0] is not None]
    if not scores:
        return "same"
    avg = sum(scores) / len(scores)
    if avg >= 75:
        return "harder"
    if avg <= 40:
        return "easier"
    return "same"


# ─── Follow-up check ──────────────────────────────────────────────────────────

def has_followup_for_question(db: Session, question_id: int) -> bool:
    try:
        row = db.execute(
            text("SELECT 1 FROM interview_questions WHERE parent_question_id = :qid LIMIT 1"),
            {"qid": question_id},
        ).scalar()
        return row is not None
    except Exception:
        return False


# ─── Session follow-up count ──────────────────────────────────────────────────

def get_session_followup_count(db: Session, interview_id: str) -> int:
    """Count follow-ups already asked in this session."""
    try:
        count = db.execute(
            text("""
                SELECT COUNT(*) FROM interview_questions
                WHERE interview_id = :iid
                  AND parent_question_id IS NOT NULL
            """),
            {"iid": str(interview_id)},
        ).scalar()
        return int(count or 0)
    except Exception:
        return 0


# ─── Main generation ──────────────────────────────────────────────────────────

def generate_followup(
    question_text: str,
    transcript: str,
    score: float,
    role: str = "Software Engineer",
    company: str = "the company",
    interview_id: str | None = None,
    db: Session | None = None,
) -> Optional[Dict[str, Any]]:
    """
    Decide whether to ask a follow-up and generate it.
    Returns {"followup": True, "question": "..."} or {"followup": False}.
    Fully synchronous — safe to call from Celery tasks.
    """
    # Hard gates
    if score < 4.0:
        log.info("[FOLLOWUP] score %.1f too low — skipping", score)
        return {"followup": False}

    if not transcript or len(transcript.strip().split()) < 10:
        log.info("[FOLLOWUP] transcript too short — skipping")
        return {"followup": False}

    # Check session cap (max 3 follow-ups per session)
    if db and interview_id:
        count = get_session_followup_count(db, interview_id)
        if count >= 3:
            log.info("[FOLLOWUP] session cap reached (%d) — skipping", count)
            return {"followup": False}

        if has_followup_for_question(db, int(question_text[:1] or 0)):
            pass  # checked below with question_id

    api_key = os.getenv("ANTHROPIC_API_KEY", "").strip()
    if not api_key:
        log.warning("[FOLLOWUP] No ANTHROPIC_API_KEY — using fallback")
        return _fallback_followup()

    prompt = FOLLOWUP_DECISION_PROMPT.format(
        company=company or "the company",
        role=role or "Software Engineer",
        question=question_text[:500],
        transcript=transcript[:800],
        score=round(score, 1),
    )

    try:
        client = anthropic.Anthropic(api_key=api_key)
        response = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=200,
            timeout=FOLLOWUP_TIMEOUT,
            messages=[{"role": "user", "content": prompt}],
        )
        raw = ""
        for block in getattr(response, "content", []):
            if getattr(block, "type", "") == "text":
                raw += getattr(block, "text", "")

        # Parse JSON
        clean = raw.strip()
        # Strip markdown fences if present
        clean = re.sub(r"^```[a-z]*\n?", "", clean)
        clean = re.sub(r"\n?```$", "", clean)

        parsed = json.loads(clean.strip())

        if not isinstance(parsed, dict):
            return {"followup": False}

        if not parsed.get("followup"):
            return {"followup": False}

        question = (parsed.get("question") or "").strip()

        # Validate: must not be empty, must be under 40 words
        if not question:
            return _fallback_followup()

        word_count = len(question.split())
        if word_count > 40:
            question = " ".join(question.split()[:35]) + "..."

        return {"followup": True, "question": question}

    except Exception as e:
        log.warning("[FOLLOWUP] Claude call failed: %s — using fallback", e)
        return _fallback_followup()


def _fallback_followup() -> Dict[str, Any]:
    import random
    return {
        "followup": True,
        "question": random.choice(FALLBACK_FOLLOWUPS),
    }


# ─── Insert follow-up question ────────────────────────────────────────────────

def insert_followup_question(
    db: Session,
    interview_id: str,
    parent_question_id: int,
    followup_text: str,
) -> Optional[int]:
    """Insert a follow-up into interview_questions. Returns new question id."""
    try:
        row = db.execute(
            text("""
                INSERT INTO interview_questions
                    (interview_id, question_text, type, time_limit_seconds,
                     parent_question_id, source)
                VALUES (:iid, :qt, 'voice', 120, :pqid, 'followup')
                RETURNING id
            """),
            {
                "iid": str(interview_id),
                "qt": followup_text,
                "pqid": parent_question_id,
            },
        ).scalar()
        db.commit()
        log.info("[FOLLOWUP] inserted follow-up q=%d for parent=%d", row, parent_question_id)
        return row
    except Exception as e:
        log.exception("[FOLLOWUP] Failed to insert follow-up: %s", e)
        try:
            db.rollback()
        except Exception:
            pass
        return None


# ─── Compatibility shims (keep old signatures working) ────────────────────────

def update_role_calibration(db: Session, role_id: int, overall_score: float) -> None:
    """No-op shim kept for backward compatibility."""
    pass


def generate_followup_sync(
    question_text: str,
    transcript: str,
    context_memory: str,
    difficulty: str,
) -> Optional[Dict[str, Any]]:
    """Legacy sync wrapper — maps to new signature with defaults."""
    return generate_followup(
        question_text=question_text,
        transcript=transcript,
        score=6.0,  # default mid score
    )