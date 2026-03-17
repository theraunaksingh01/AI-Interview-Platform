# backend/services/followup_generator.py
"""
Dynamic follow-up question generation, context-aware memory,
and adaptive difficulty for Phase 12.
"""
from __future__ import annotations

import asyncio
import json
import logging
import os
from typing import Any, Dict, List, Optional

from sqlalchemy import text
from sqlalchemy.orm import Session

from services.llm_provider import gemini_chat, _parse_json_robust

log = logging.getLogger(__name__)

# ---------------------
# Config
# ---------------------
AI_PROVIDER = os.getenv("AI_PROVIDER", "stub").lower()
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.0-flash")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
OLLAMA_URL = os.getenv("OLLAMA_URL", "http://127.0.0.1:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "tinyllama")

FOLLOWUP_TIMEOUT = int(os.getenv("FOLLOWUP_TIMEOUT", "8"))

# ---------------------
# Prompts
# ---------------------
FOLLOWUP_SYSTEM_PROMPT = (
    "You are a senior technical interviewer. Based on the candidate's answer, "
    "generate ONE concise follow-up question that probes deeper understanding. "
    "Return ONLY valid JSON. No markdown, no backticks."
)

FOLLOWUP_USER_PROMPT = """The candidate just answered an interview question. Generate one follow-up question.

Question Asked:
---
{question_text}
---

Candidate's Answer:
---
{transcript}
---

{context_section}

Difficulty: {difficulty_instruction}

Return JSON:
{{"followup_question": "your follow-up question text here", "reason": "brief reason for this follow-up"}}"""

DIFFICULTY_INSTRUCTIONS = {
    "harder": "Ask a more challenging follow-up about edge cases, scalability, trade-offs, or deeper technical details.",
    "easier": "Ask a simpler follow-up to help the candidate clarify their understanding or give a concrete example.",
    "same": "Ask a follow-up at a similar difficulty level to probe a different angle of the topic.",
}


# ---------------------
# Context Memory
# ---------------------
def build_context_memory(db: Session, interview_id: str, limit: int = 5) -> str:
    """Build a summary of prior Q&A pairs for context injection into the follow-up prompt."""
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
        """),
        {"iid": str(interview_id)},
    ).fetchall()

    if not rows:
        return ""

    # Take the last `limit` Q&A pairs and truncate each answer
    pairs = rows[-limit:]
    lines = []
    for i, r in enumerate(pairs, 1):
        q = (r[0] or "")[:150]
        a = (r[1] or "")[:200]
        if len(r[1] or "") > 200:
            a += "..."
        lines.append(f"Q{i}: {q}\nA{i}: {a}")

    return "Previous conversation:\n" + "\n\n".join(lines)


# ---------------------
# Adaptive Difficulty
# ---------------------
def get_difficulty_hint(db: Session, interview_id: str) -> str:
    """Compute difficulty direction based on running live scores."""
    rows = db.execute(
        text("""
            SELECT overall_score FROM interview_scores
            WHERE interview_id = :iid AND overall_score IS NOT NULL
            ORDER BY created_at DESC
            LIMIT 3
        """),
        {"iid": str(interview_id)},
    ).fetchall()

    if not rows:
        return "same"

    scores = [float(r[0]) for r in rows if r[0] is not None]
    if not scores:
        return "same"

    avg = sum(scores) / len(scores)
    if avg >= 75:
        return "harder"
    elif avg <= 40:
        return "easier"
    return "same"


def update_role_calibration(db: Session, role_id: int, overall_score: float) -> None:
    """Upsert role difficulty calibration after interview finalization."""
    if role_id is None:
        return
    try:
        db.execute(
            text("""
                INSERT INTO role_difficulty_calibration (role_id, avg_score, total_interviews, updated_at)
                VALUES (:rid, :score, 1, now())
                ON CONFLICT (role_id) DO UPDATE SET
                    avg_score = (
                        role_difficulty_calibration.avg_score * role_difficulty_calibration.total_interviews + :score
                    ) / (role_difficulty_calibration.total_interviews + 1),
                    total_interviews = role_difficulty_calibration.total_interviews + 1,
                    updated_at = now()
            """),
            {"rid": role_id, "score": float(overall_score)},
        )
        db.commit()
    except Exception:
        log.exception("Failed to update role_difficulty_calibration for role %s", role_id)
        try:
            db.rollback()
        except Exception:
            pass


# ---------------------
# Follow-up Check
# ---------------------
def has_followup_for_question(db: Session, question_id: int) -> bool:
    """Check if a follow-up already exists for this parent question."""
    row = db.execute(
        text("SELECT 1 FROM interview_questions WHERE parent_question_id = :qid LIMIT 1"),
        {"qid": question_id},
    ).scalar()
    return row is not None


# ---------------------
# Follow-up Generation
# ---------------------
async def _generate_followup_llm(
    question_text: str,
    transcript: str,
    context_memory: str,
    difficulty: str,
) -> Optional[Dict[str, Any]]:
    """Call LLM to generate a follow-up question. Returns dict or None."""
    context_section = context_memory if context_memory else "No prior conversation yet."
    difficulty_instruction = DIFFICULTY_INSTRUCTIONS.get(difficulty, DIFFICULTY_INSTRUCTIONS["same"])

    user_prompt = FOLLOWUP_USER_PROMPT.format(
        question_text=question_text,
        transcript=transcript,
        context_section=context_section,
        difficulty_instruction=difficulty_instruction,
    )

    if AI_PROVIDER == "stub":
        return {
            "followup_question": f"Can you elaborate on your approach and explain any trade-offs?",
            "reason": "stub follow-up",
        }

    if AI_PROVIDER == "gemini" and GEMINI_API_KEY:
        result = await gemini_chat(
            system_prompt=FOLLOWUP_SYSTEM_PROMPT,
            user_prompt=user_prompt,
            api_key=GEMINI_API_KEY,
            model=GEMINI_MODEL,
            max_output_tokens=256,
            timeout=FOLLOWUP_TIMEOUT,
        )
        parsed = result.get("parsed")
        if isinstance(parsed, dict) and "followup_question" in parsed:
            return parsed
        return None

    if AI_PROVIDER == "openai" and OPENAI_API_KEY:
        import httpx
        headers = {"Authorization": f"Bearer {OPENAI_API_KEY}"}
        payload = {
            "model": OPENAI_MODEL,
            "messages": [
                {"role": "system", "content": FOLLOWUP_SYSTEM_PROMPT},
                {"role": "user", "content": user_prompt},
            ],
            "temperature": 0.4,
            "max_tokens": 256,
        }
        async with httpx.AsyncClient(timeout=FOLLOWUP_TIMEOUT) as client:
            r = await client.post("https://api.openai.com/v1/chat/completions", headers=headers, json=payload)
            r.raise_for_status()
            raw = r.json()["choices"][0]["message"]["content"]
            parsed = _parse_json_robust(raw)
            if isinstance(parsed, dict) and "followup_question" in parsed:
                return parsed
        return None

    if AI_PROVIDER == "ollama":
        import httpx
        url = f"{OLLAMA_URL.rstrip('/')}/api/generate"
        prompt = FOLLOWUP_SYSTEM_PROMPT + "\n\n" + user_prompt
        payload = {"model": OLLAMA_MODEL, "prompt": prompt, "format": "json", "stream": False}
        async with httpx.AsyncClient(timeout=FOLLOWUP_TIMEOUT) as client:
            r = await client.post(url, json=payload)
            r.raise_for_status()
            body = r.json()
            resp = body.get("response") or ""
            parsed = _parse_json_robust(resp)
            if isinstance(parsed, dict) and "followup_question" in parsed:
                return parsed
        return None

    # Unknown provider — no follow-up
    return None


async def generate_followup(
    question_text: str,
    transcript: str,
    context_memory: str,
    difficulty: str,
) -> Optional[Dict[str, Any]]:
    """
    Generate a follow-up question with timeout protection.
    Returns {"followup_question": "...", "reason": "..."} or None.
    """
    try:
        result = await asyncio.wait_for(
            _generate_followup_llm(question_text, transcript, context_memory, difficulty),
            timeout=FOLLOWUP_TIMEOUT + 2,  # buffer beyond the HTTP timeout
        )
        return result
    except asyncio.TimeoutError:
        log.warning("Follow-up generation timed out after %ss", FOLLOWUP_TIMEOUT)
        return None
    except Exception:
        log.exception("Follow-up generation failed")
        return None


def generate_followup_sync(
    question_text: str,
    transcript: str,
    context_memory: str,
    difficulty: str,
) -> Optional[Dict[str, Any]]:
    """Sync wrapper for generate_followup (for use in non-async contexts)."""
    return asyncio.run(generate_followup(question_text, transcript, context_memory, difficulty))


def insert_followup_question(
    db: Session,
    interview_id: str,
    parent_question_id: int,
    followup_text: str,
) -> Optional[int]:
    """Insert a follow-up question into interview_questions. Returns the new question id."""
    try:
        row = db.execute(
            text("""
                INSERT INTO interview_questions
                    (interview_id, question_text, type, time_limit_seconds, parent_question_id, source)
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
        return row
    except Exception:
        log.exception("Failed to insert follow-up question for parent %s", parent_question_id)
        try:
            db.rollback()
        except Exception:
            pass
        return None
