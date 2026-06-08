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
# Personal coach note (last 3 sessions)
# ---------------------------------------------------------------------------

def _generate_coach_note(
    client: anthropic.Anthropic,
    user_id: int,
    current_session_id: str,
    role_target: str,
    current_summaries: list,
    db,
) -> str | None:
    """
    Generate a personalized coaching note by analyzing
    the student's last 3 sessions including the current one.
    Uses Claude Sonnet for deeper analysis.
    Returns a 3-4 sentence coaching note or None on failure.
    """
    try:
        prev_sessions = db.execute(
            text("""
                SELECT ms.id, ms.overall_score, ms.role_target,
                       ms.specific_fix, ms.completed_at,
                       ms.coaching_report
                FROM mock_sessions ms
                WHERE ms.user_id = :uid
                  AND ms.status = 'completed'
                  AND ms.overall_score IS NOT NULL
                  AND ms.id != CAST(:sid AS uuid)
                ORDER BY ms.completed_at DESC
                LIMIT 2
            """),
            {"uid": user_id, "sid": current_session_id},
        ).mappings().all()

        total_sessions = db.execute(
            text("""
                SELECT COUNT(*) FROM mock_sessions
                WHERE user_id = :uid AND status = 'completed'
            """),
            {"uid": user_id},
        ).scalar() or 1

        history_parts = []

        for i, prev in enumerate(reversed(prev_sessions), 1):
            score = float(prev["overall_score"] or 0)
            fix = prev["specific_fix"] or ""
            report = prev["coaching_report"] or {}
            if isinstance(report, str):
                try:
                    report = json.loads(report)
                except Exception:
                    report = {}

            questions = report.get("questions", []) if isinstance(report, dict) else []
            topic_scores: dict = {}
            for q in questions:
                topic = q.get("topic", "general")
                s = float(q.get("score", 0) or 0)
                if topic not in topic_scores:
                    topic_scores[topic] = []
                topic_scores[topic].append(s)

            topic_summary = ", ".join(
                f"{t}: {sum(v)/len(v):.0f}" for t, v in topic_scores.items() if v
            ) if topic_scores else "no breakdown available"

            history_parts.append(
                f"Session {i} (previous): Overall {score:.0f}/100 | Topics: {topic_summary} | Key fix: {fix[:100]}"
            )

        current_score = sum(q["score"] for q in current_summaries if q["score"]) / max(len(current_summaries), 1)
        current_topic_scores: dict = {}
        for q in current_summaries:
            topic = q.get("topic", "general") or "general"
            s = float(q.get("score", 0) or 0)
            if topic not in current_topic_scores:
                current_topic_scores[topic] = []
            current_topic_scores[topic].append(s)

        current_topic_summary = ", ".join(
            f"{t}: {sum(v)/len(v):.0f}" for t, v in current_topic_scores.items() if v
        ) if current_topic_scores else "no breakdown"

        all_weaknesses = []
        for q in current_summaries:
            all_weaknesses.extend(q.get("weaknesses", []))
        weakness_summary = ", ".join(set(all_weaknesses[:6])) if all_weaknesses else "none recorded"

        history_parts.append(
            f"Session {len(history_parts)+1} (current): Overall {current_score:.0f}/100 | Topics: {current_topic_summary} | Weaknesses: {weakness_summary}"
        )

        session_history = "\n".join(history_parts)

        prompt = f"""You are a personal interview coach for an Indian engineering student.

Student profile:
- Role target: {role_target}
- Total sessions completed: {total_sessions}

Session history (oldest to newest):
{session_history}

Write a personal coaching note for this student. Rules:
1. Exactly 3-4 sentences. No bullet points. No headers. Plain text only.
2. Sentence 1: Acknowledge their progress honestly. If scores improved say so with numbers. If not, be honest but kind.
3. Sentence 2: Identify the ONE recurring pattern that is limiting them across sessions. Be specific — name the exact topic and exact behavior, not vague advice.
4. Sentence 3: Give ONE concrete exercise to do before their next session. Must be actionable in under 30 minutes. Reference what they actually did wrong.
5. Sentence 4 (optional): One sentence of genuine encouragement. Only include if it feels earned — don't be sycophantic.

Tone: Direct, honest, like a good senior who wants them to succeed. Not corporate, not generic.
DO NOT say "Great job" or "Keep it up" or "You're doing amazing."
DO reference specific topics and scores from the data above."""

        response = client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=300,
            messages=[{"role": "user", "content": prompt}],
        )

        note = ""
        for block in getattr(response, "content", []):
            if getattr(block, "type", "") == "text":
                note += getattr(block, "text", "")

        note = note.strip()
        if not note or len(note) < 20:
            return None

        return note

    except Exception as e:
        log.warning("[COACH_AGENT] Failed to generate coach note: %s", e)
        return None


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
            text("SELECT id, user_id, role_target, seniority, status FROM mock_sessions WHERE id = :sid"),
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
                """),
                {"sid": str(session_uuid)},
            )
        except Exception as e:
            log.warning("[COACHING_REPORT] Failed to sync overall_score: %s", e)

        db.commit()

        try:
            user_id = session_row["user_id"]
            coach_note = _generate_coach_note(
                client=client,
                user_id=user_id,
                current_session_id=str(session_uuid),
                role_target=session_row["role_target"] or "Software Engineer",
                current_summaries=question_summaries,
                db=db,
            )
            if coach_note:
                db.execute(
                    text("UPDATE mock_sessions SET coach_note = :note WHERE id = CAST(:sid AS uuid)"),
                    {"note": coach_note, "sid": str(session_uuid)},
                )
                db.commit()
                log.info("[COACH_AGENT] stored coach note for session %s", session_id)
        except Exception as e:
            log.warning("[COACH_AGENT] non-fatal error: %s", e)

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