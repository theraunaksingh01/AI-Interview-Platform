# backend/tasks/generate_coaching_report.py
"""
Sprint 1: Post-session coaching report generation.

Fires after generate_communication_report completes for a mock session.
For each question:
  - reads transcript from interview_answers
  - reads score + ai_feedback from interview_scores
  - calls Claude: "what could they have said instead"
  - stores result in interview_scores.better_answer_example

At session level:
  - one Claude call: "what is the single most consistent weakness"
  - stores result in mock_sessions.coaching_report JSONB

Cost: ~₹3-5 per session (8 questions × haiku input/output).
"""

from __future__ import annotations

import json
import logging
import os
from typing import Any, Dict, List, Optional
from uuid import UUID

import anthropic
from celery_app import app
from db.session import SessionLocal
from sqlalchemy import text

log = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _claude_client() -> anthropic.Anthropic:
    api_key = os.getenv("ANTHROPIC_API_KEY", "").strip()
    if not api_key:
        raise RuntimeError("ANTHROPIC_API_KEY not set")
    return anthropic.Anthropic(api_key=api_key)


def _call_claude(client: anthropic.Anthropic, prompt: str, max_tokens: int = 600) -> str:
    """Single Claude call, returns plain text. Raises on failure."""
    response = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=max_tokens,
        messages=[{"role": "user", "content": prompt}],
    )
    text_out = ""
    for block in getattr(response, "content", []):
        if getattr(block, "type", "") == "text":
            text_out += getattr(block, "text", "")
    return text_out.strip()


def _parse_json_safe(raw: str) -> Optional[Dict[str, Any]]:
    """Strip markdown fences and parse JSON. Returns None on failure."""
    clean = raw.strip()
    if clean.startswith("```"):
        parts = clean.split("```")
        clean = parts[1] if len(parts) >= 2 else clean
        if clean.startswith("json"):
            clean = clean[4:]
    try:
        return json.loads(clean.strip())
    except Exception:
        return None


# ---------------------------------------------------------------------------
# Per-question: "what could they have said"
# ---------------------------------------------------------------------------

BETTER_ANSWER_PROMPT = """You are coaching an engineering student preparing for campus placements in India.

Question asked in the interview:
"{question_text}"

What the student actually said (score: {score}/100):
"{transcript}"

What was weak about their answer:
{weaknesses}

Write a BETTER ANSWER EXAMPLE the student could have given. Keep it:
- Concise (3-5 sentences max)
- Structured (what it is → how it works → example or trade-off)
- Natural spoken language, not a textbook definition
- Include one concrete example (from a project, or a relatable analogy)

Return ONLY the better answer text. No preamble, no labels, no JSON."""


def _generate_better_answer(
    client: anthropic.Anthropic,
    question_text: str,
    transcript: str,
    score: float,
    weaknesses: List[str],
) -> Optional[str]:
    weaknesses_text = "\n".join(f"- {w}" for w in weaknesses) if weaknesses else "- No specific weaknesses captured"
    prompt = BETTER_ANSWER_PROMPT.format(
        question_text=question_text,
        transcript=transcript or "(no transcript recorded)",
        score=int(score),
        weaknesses=weaknesses_text,
    )
    try:
        result = _call_claude(client, prompt, max_tokens=400)
        return result if result else None
    except Exception as e:
        log.warning("[COACHING_REPORT] better_answer generation failed: %s", e)
        return None


# ---------------------------------------------------------------------------
# Session level: one specific fix
# ---------------------------------------------------------------------------

SESSION_FIX_PROMPT = """You are reviewing a student's mock interview performance for campus placements.

Role they practiced for: {role_target}

Here is a summary of their answers across {question_count} questions:

{question_summaries}

Identify the SINGLE most consistent weakness across ALL answers — the one pattern that hurt them the most.

Return JSON only:
{{
  "specific_fix": "<one clear, actionable sentence — what they must change in their next practice>",
  "pattern": "<the underlying weakness in 3-5 words, e.g. 'no concrete examples given'>",
  "delivery_note": "<one sentence about their speaking style: WPM {avg_wpm}, {filler_count} filler words used>"
}}"""


def _generate_session_fix(
    client: anthropic.Anthropic,
    role_target: str,
    question_summaries: List[Dict[str, Any]],
    avg_wpm: Optional[float],
    filler_count: Optional[int],
) -> Dict[str, Any]:
    summaries_text = ""
    for i, q in enumerate(question_summaries, 1):
        summaries_text += (
            f"Q{i}: \"{q['question_text']}\"\n"
            f"Score: {q['score']}/100\n"
            f"Weaknesses: {', '.join(q['weaknesses']) if q['weaknesses'] else 'none captured'}\n\n"
        )

    prompt = SESSION_FIX_PROMPT.format(
        role_target=role_target or "Software Engineer",
        question_count=len(question_summaries),
        question_summaries=summaries_text.strip(),
        avg_wpm=round(avg_wpm) if avg_wpm else "unknown",
        filler_count=filler_count if filler_count is not None else "unknown",
    )
    try:
        raw = _call_claude(client, prompt, max_tokens=300)
        parsed = _parse_json_safe(raw)
        if parsed and "specific_fix" in parsed:
            return parsed
        # fallback: return raw as specific_fix
        return {"specific_fix": raw, "pattern": "", "delivery_note": ""}
    except Exception as e:
        log.warning("[COACHING_REPORT] session fix generation failed: %s", e)
        return {
            "specific_fix": "Focus on giving concrete examples from your projects for every answer.",
            "pattern": "no concrete examples",
            "delivery_note": "",
        }


# ---------------------------------------------------------------------------
# Main Celery task
# ---------------------------------------------------------------------------

@app.task(name="tasks.generate_coaching_report", bind=True, max_retries=2)
def generate_coaching_report(self, session_id: str) -> Dict[str, Any]:
    """
    Generate the full coaching report for a completed mock session.
    Called after generate_communication_report completes.
    """
    db = SessionLocal()
    try:
        # 1. Load session
        session_uuid = UUID(session_id)
        session_row = db.execute(
            text("SELECT id, role_target, overall_score FROM mock_sessions WHERE id = :sid"),
            {"sid": str(session_uuid)},
        ).mappings().first()

        if not session_row:
            log.error("[COACHING_REPORT] session not found: %s", session_id)
            return {"ok": False, "error": "session_not_found"}

        # 2. Load communication report for delivery stats
        comm_row = db.execute(
            text("SELECT avg_wpm, total_filler_words FROM communication_reports WHERE session_id = :sid"),
            {"sid": str(session_uuid)},
        ).mappings().first()
        avg_wpm = float(comm_row["avg_wpm"]) if comm_row and comm_row["avg_wpm"] else None
        filler_count = comm_row["total_filler_words"] if comm_row else None

        # 3. Load all questions + scores + transcripts for this session
        rows = db.execute(
            text("""
                SELECT
                    iq.id            AS question_id,
                    iq.question_text,
                    iq.position,
                    iq.topic,
                    s.overall_score  AS score,
                    s.ai_feedback,
                    s.id             AS score_row_id,
                    ia.transcript,
                    ia.wpm,
                    ia.filler_count
                FROM interviews i
                JOIN interview_questions iq ON iq.interview_id = i.id
                LEFT JOIN interview_scores s ON s.question_id = iq.id
                LEFT JOIN interview_answers ia ON ia.interview_question_id = iq.id
                WHERE i.mock_session_id = :sid
                ORDER BY iq.position ASC NULLS LAST, iq.id ASC
            """),
            {"sid": str(session_uuid)},
        ).mappings().all()

        if not rows:
            log.warning("[COACHING_REPORT] no questions found for session %s", session_id)
            return {"ok": False, "error": "no_questions"}

        # 4. Init Claude client once (reused across all questions)
        try:
            client = _claude_client()
        except RuntimeError as e:
            log.error("[COACHING_REPORT] %s", e)
            return {"ok": False, "error": str(e)}

        # 5. Per-question: generate better answer + store
        question_summaries: List[Dict[str, Any]] = []

        for row in rows:
            question_id = row["question_id"]
            question_text = row["question_text"] or ""
            score = float(row["score"] or 0)
            transcript = row["transcript"] or ""
            score_row_id = row["score_row_id"]

            # Extract weaknesses from ai_feedback JSONB
            ai_feedback = row["ai_feedback"] or {}
            if isinstance(ai_feedback, str):
                try:
                    ai_feedback = json.loads(ai_feedback)
                except Exception:
                    ai_feedback = {}
            weaknesses: List[str] = []
            if isinstance(ai_feedback, dict):
                raw_w = ai_feedback.get("weaknesses") or []
                if isinstance(raw_w, list):
                    weaknesses = [str(w) for w in raw_w if str(w).strip()]

            # Generate better answer
            better_answer = None
            if score_row_id:  # generate better answer even without transcript
                better_answer = _generate_better_answer(
                    client=client,
                    question_text=question_text,
                    transcript=transcript or "",  # empty string is fine
                    score=score,
                    weaknesses=weaknesses,
                )

            # Store in interview_scores.better_answer_example
            if better_answer and score_row_id:
                try:
                    db.execute(
                        text("""
                            UPDATE interview_scores
                            SET better_answer_example = :ba
                            WHERE id = :sid
                        """),
                        {"ba": better_answer, "sid": score_row_id},
                    )
                except Exception as e:
                    log.warning("[COACHING_REPORT] failed to store better_answer for q%s: %s", question_id, e)

            question_summaries.append({
                "question_id": question_id,
                "question_text": question_text,
                "score": score,
                "transcript": transcript,
                "weaknesses": weaknesses,
                "better_answer": better_answer,
                "wpm": row["wpm"],
                "filler_count": row["filler_count"],
                "topic": row["topic"],
                "position": row["position"],
            })

        # 6. Session-level: one specific fix
        session_fix = _generate_session_fix(
            client=client,
            role_target=session_row["role_target"] or "Software Engineer",
            question_summaries=question_summaries,
            avg_wpm=avg_wpm,
            filler_count=filler_count,
        )

        # 7. Store coaching_report JSONB on mock_sessions
        coaching_report_payload = {
            "specific_fix": session_fix.get("specific_fix", ""),
            "pattern": session_fix.get("pattern", ""),
            "delivery_note": session_fix.get("delivery_note", ""),
            "questions": [
                {
                    "question_id": q["question_id"],
                    "question_text": q["question_text"],
                    "score": q["score"],
                    "transcript": q["transcript"],
                    "weaknesses": q["weaknesses"],
                    "better_answer": q["better_answer"],
                    "wpm": q["wpm"],
                    "filler_count": q["filler_count"],
                    "topic": q["topic"],
                    "position": q["position"],
                }
                for q in question_summaries
            ],
        }

        db.execute(
            text("""
                UPDATE mock_sessions
                SET coaching_report = CAST(:report AS jsonb),
                    specific_fix = :fix
                WHERE id = :sid
            """),
            {
                "report": json.dumps(coaching_report_payload),
                "fix": session_fix.get("specific_fix", ""),
                "sid": str(session_uuid),
            },
        )
        db.commit()

        log.info(
            "[COACHING_REPORT] done for session %s — %d questions, fix: %s",
            session_id,
            len(question_summaries),
            session_fix.get("pattern", ""),
        )
        return {"ok": True, "session_id": session_id, "questions": len(question_summaries)}

    except Exception as e:
        log.exception("[COACHING_REPORT] failed for session %s: %s", session_id, e)
        try:
            db.rollback()
        except Exception:
            pass
        # Retry on transient failures
        try:
            raise self.retry(exc=e, countdown=30)
        except Exception:
            return {"ok": False, "error": str(e)}
    finally:
        db.close()