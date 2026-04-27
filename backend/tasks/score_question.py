# backend/tasks/score_question.py
from __future__ import annotations
import json
import logging
import asyncio
import re
from typing import Any, Dict, Optional
from sqlalchemy.orm import Session
from sqlalchemy import text
from db.session import SessionLocal
from celery_app import app
from celery import current_task
# import helpers/constants from the main scorer module
from tasks import score_interview as score_interview
from datetime import datetime
from services.llm_provider import get_llm_response

log = logging.getLogger(__name__)
logger = log


def parse_score_response(raw: str) -> dict | None:
    if not raw:
        return None
    clean = raw.strip()

    # Remove markdown fences (phi3:mini always wraps in ```json ... ```)
    clean = re.sub(r"```json", "", clean)
    clean = re.sub(r"```", "", clean)
    clean = clean.strip()

    # Find JSON object boundaries
    start = clean.find("{")
    end = clean.rfind("}")
    if start == -1 or end == -1:
        logger.error(f"No JSON object found in LLM response: {raw[:200]}")
        return None

    json_str = clean[start:end+1]

    # Attempt 1: standard parse
    try:
        return json.loads(json_str)
    except json.JSONDecodeError:
        pass

    # Attempt 2: field-by-field regex extraction
    # Handles truncated/corrupted field names from phi3
    result = {}
    for field, pattern in [
        ("technical_score",     r'"technical_score"\s*:\s*(\d+)'),
        ("communication_score", r'"communication_score"\s*:\s*(\d+)'),
        ("completeness_score",  r'"completeness_score"\s*:\s*(\d+)'),
        ("overall_score",       r'"overall_score"\s*:\s*(\d+)'),
        ("hiring_signal",       r'"hiring_signal"\s*:\s*"([^"]+)"'),
        ("summary",             r'"summary"\s*:\s*"([^"]+)"'),
    ]:
        m = re.search(pattern, json_str)
        if m:
            val = m.group(1)
            result[field] = int(val) if field.endswith("score") else val

    for field in ["strengths", "weaknesses"]:
        m = re.search(r'"' + field + r'"\s*:\s*\[([^\]]*)\]', json_str)
        if m:
            result[field] = re.findall(r'"([^"]+)"', m.group(1))

    if result.get("overall_score"):
        logger.warning(f"Used regex fallback parser for LLM response")
        return result

    logger.error(f"parse_score_response failed both attempts: {raw[:300]}")
    return None

@app.task(name="tasks.score_question")
def score_question(question_id: int, interview_id: Optional[str] = None, triggered_by: str = "system") -> Dict[str, Any]:
    """
    Score a single question. Args order: (question_id, interview_id).
    If interview_id omitted, derive from the DB via question row.
    Runs async LLM call via asyncio.run and writes a single interview_scores row,
    then recomputes interview-level aggregate report.
    """
    db: Session = SessionLocal()
    try:
        # Fetch the question and latest answer for that question
        qrow = db.execute(text("""
             SELECT q.interview_id AS interview_id, q.id AS qid, q.type, q.question_text,
                 COALESCE(r.title, 'Software Engineer') AS role_title,
                   a.id AS aid, a.transcript, a.code_answer, a.code_output, a.test_results, a.cheat_flags
            FROM interview_questions q
             LEFT JOIN interviews i ON i.id = q.interview_id
             LEFT JOIN roles r ON r.id = i.role_id
            LEFT JOIN LATERAL (
              SELECT z.*
              FROM interview_answers z
              WHERE z.interview_question_id = q.id
              ORDER BY z.created_at DESC NULLS LAST, z.id DESC
              LIMIT 1
            ) a ON TRUE
            WHERE q.id = :qid
            LIMIT 1
        """), {"qid": int(question_id)}).mappings().first()

        if not qrow:
            return {"ok": False, "error": "question not found"}

        iid = interview_id or str(qrow["interview_id"])

        async def _run_single():
            if not qrow["aid"]:
                return {"ok": False, "error": "no answer found for question"}

            raw_resp = ""
            fb = {}

            qtype = (qrow.get("type") or "").lower()
            role_title = (qrow.get("role_title") or "Software Engineer").strip()
            question_text = (qrow.get("question_text") or "").strip()

            # Get transcript and code content up front.
            transcript = (qrow.get("transcript") or "")
            code = (qrow.get("code_answer") or "")

            # Skip if no meaningful answer was given.
            if len(transcript.strip().split()) < 5:
                logger.info(
                    "Skipping score for answer %s - transcript too short or empty (%s chars)",
                    qrow["aid"],
                    len(transcript.strip()),
                )
                # For coding questions, allow code-only scoring if code is present.
                if len(code.strip()) < 10:
                    logger.info(
                        "Answer %s has no transcript and no code - skipping entirely",
                        qrow["aid"],
                    )
                    return {
                        "ok": True,
                        "skipped": True,
                        "reason": "transcript_too_short_and_no_code",
                    }

            # Only proceed with scoring if we have real transcript or code content.
            content_to_score = transcript.strip() or code.strip()
            if not content_to_score:
                return {
                    "ok": True,
                    "skipped": True,
                    "reason": "empty_answer_content",
                }

            if qtype == "voice":
                candidate_answer = transcript.strip()
            else:
                tests = qrow["test_results"] or {}
                corr = score_interview._safe_int((tests or {}).get("correctness"), 0)
                code = code.strip()
                stdout = (qrow["code_output"] or "")[:1200]
                candidate_answer = (
                    f"Code Submission:\n{code}\n\n"
                    f"Program Output:\n{stdout}\n\n"
                    f"Test Correctness: {corr}%"
                )

            prompt = f"""You are an expert technical interviewer.
Evaluate this interview answer honestly and return ONLY a JSON object.

Role: {role_title}
Question: {question_text}
Candidate Answer: {candidate_answer}

Return ONLY valid JSON with no explanation or markdown:
{{
  "technical_score": <integer 0-100>,
  "communication_score": <integer 0-100>,
  "completeness_score": <integer 0-100>,
  "overall_score": <integer 0-100>,
  "strengths": ["<specific strength>", "<specific strength>"],
  "weaknesses": ["<specific weakness to improve>"],
  "summary": "<2-3 sentence honest evaluation>",
  "hiring_signal": "hire|maybe|no_hire",
  "depth_of_knowledge": <integer 0-100>,
  "problem_solving": <integer 0-100>,
  "technical_accuracy": <integer 0-100>,
  "communication_clarity": <integer 0-100>,
  "red_flags": []
}}"""

            answer_id = int(qrow["aid"])

            def _stub_score() -> Dict[str, Any]:
                return {
                    "technical_score": 68,
                    "communication_score": 68,
                    "completeness_score": 68,
                    "overall_score": 68,
                    "strengths": ["Structured response"],
                    "weaknesses": ["Need deeper technical detail"],
                    "summary": "Fallback score due to parse failure.",
                    "hiring_signal": "maybe",
                    "depth_of_knowledge": 65,
                    "problem_solving": 66,
                    "technical_accuracy": 68,
                    "communication_clarity": 68,
                    "red_flags": [],
                }

            # Always try real scoring first.
            raw_resp = get_llm_response(prompt) or ""
            parsed = None
            if raw_resp:
                maybe_parsed = parse_score_response(raw_resp)
                if maybe_parsed and maybe_parsed.get("overall_score") is not None:
                    parsed = maybe_parsed

            # Only fall back to stub if LLM unavailable/unparseable.
            if not parsed:
                logger.warning("LLM unavailable - using stub score")
                parsed = _stub_score()

            tech = score_interview._safe_int(parsed.get("technical_score"), 0)
            comm = score_interview._safe_int(parsed.get("communication_score"), 0)
            comp = score_interview._safe_int(parsed.get("completeness_score"), 0)
            perq_overall = score_interview._safe_int(
                parsed.get("overall_score"),
                round((tech + comm + comp) / 3) if (tech or comm or comp) else 0,
            )
            fb = dict(parsed)
            fb.setdefault("strengths", [])
            fb.setdefault("weaknesses", [])
            fb.setdefault("summary", "")

            rubric_compact = {
                "technical": int(tech),
                "communication": int(comm),
                "completeness": int(comp),
            }

            await asyncio.sleep(0)

            # upsert into interview_scores
            try:
                fb_json = json.dumps(fb)
                upd = db.execute(text("""
                    UPDATE interview_scores
                    SET technical_score = :tech,
                        communication_score = :comm,
                        completeness_score = :comp,
                        overall_score = :overall,
                        ai_feedback = CAST(:fb AS jsonb),
                        llm_raw = :raw
                    WHERE interview_id = :iid
                      AND question_id = :qid
                """), {
                    "iid": str(iid),
                    "qid": int(question_id),
                    "tech": int(tech),
                    "comm": int(comm),
                    "comp": int(comp),
                    "overall": float(perq_overall),
                    "fb": fb_json,
                    "raw": raw_resp,
                })

                if (upd.rowcount or 0) == 0:
                    db.execute(text("""
                        INSERT INTO interview_scores
                          (interview_id, question_id, technical_score, communication_score,
                           completeness_score, overall_score, ai_feedback, llm_raw, created_at)
                        VALUES (:iid, :qid, :tech, :comm, :comp, :overall, CAST(:fb AS jsonb), :raw, now())
                    """), {
                        "iid": str(iid),
                        "qid": int(question_id),
                        "tech": int(tech),
                        "comm": int(comm),
                        "comp": int(comp),
                        "overall": float(perq_overall),
                        "fb": fb_json,
                        "raw": raw_resp,
                    })

                db.execute(text("""
                    UPDATE interview_answers
                    SET ai_feedback = :fb,
                        llm_raw = :raw,
                        overall_score = :overall,
                        rubric_scores = CAST(:rubric AS jsonb),
                        strengths = CAST(:strengths AS jsonb),
                        weaknesses = CAST(:weaknesses AS jsonb)
                    WHERE id = :aid
                """), {
                    "fb": json.dumps(fb),
                    "raw": raw_resp,
                    "overall": float(perq_overall),
                    "rubric": json.dumps(rubric_compact),
                    "strengths": json.dumps(fb.get("strengths") or []),
                    "weaknesses": json.dumps(fb.get("weaknesses") or []),
                    "aid": int(qrow["aid"]),
                })

                db.commit()
            except Exception as e:
                log.exception("Failed to upsert interview_scores in score_question: %s", e)
                db.rollback()
                return {"ok": False, "error": str(e)}

            # update interview overall/report (recompute aggregate)
            try:
                report = score_interview._aggregate_from_interview_scores(db, iid)
                db.execute(text("UPDATE interviews SET overall_score = :o, report = CAST(:r AS jsonb) WHERE id = :iid"),
                           {"o": report["overall_score"], "r": json.dumps(report), "iid": str(iid)})
                db.commit()
            except Exception:
                db.rollback()

            # Authoritative aggregation for evaluation view: interviews.score_details from interview_answers.
            try:
                score_interview._aggregate_from_interview_answers(db, iid)
            except Exception:
                db.rollback()
                log.exception("Failed to aggregate interview %s from interview_answers", iid)

            return {"ok": True, "overall": report.get("overall_score") if 'report' in locals() and report else perq_overall}

        # Run async part
        result = asyncio.run(_run_single())
        return result

    except Exception as e:
        log.exception("score_question failed: %s", e)
        try:
            db.rollback()
        except Exception:
            pass
        return {"ok": False, "error": str(e)}
    finally:
        db.close()
