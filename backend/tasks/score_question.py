# backend/tasks/score_question.py
from __future__ import annotations
import json
import logging
import asyncio
from typing import Any, Dict, Optional
from sqlalchemy.orm import Session
from sqlalchemy import text
from db.session import SessionLocal
from celery_app import app
from celery import current_task
# import helpers/constants from the main scorer module
from tasks import score_interview as score_interview
from datetime import datetime

log = logging.getLogger(__name__)

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
            SELECT q.interview_id AS interview_id, q.id AS qid, q.type,
                   a.id AS aid, a.transcript, a.code_answer, a.code_output, a.test_results, a.cheat_flags
            FROM interview_questions q
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
            # Use constants/prompts from score_interview module
            qtype = (qrow.get("type") or "").lower()

            if qtype == "voice":
                transcript = (qrow["transcript"] or "").strip()
                if not transcript:
                    fb = {"communication": 0, "technical": 0, "completeness": 0,
                          "red_flags": ["No speech detected"], "summary": "No transcript"}
                    raw_resp = ""
                else:
                    fb, raw_resp = await score_interview._llm_json(score_interview.VOICE_USER_PROMPT.format(transcript=transcript))

                comm = score_interview._safe_int(fb.get("communication"), 0)
                tech = score_interview._safe_int(fb.get("technical"), 0)
                comp = score_interview._safe_int(fb.get("completeness"), 0)

            else:  # code
                tests = qrow["test_results"] or {}
                corr = score_interview._safe_int((tests or {}).get("correctness"), 0)
                code = qrow["code_answer"] or ""
                stdout = (qrow["code_output"] or "")[:1000]
                fb, raw_resp = await score_interview._llm_json(
                    score_interview.CODE_USER_PROMPT.format(code=code, stdout=stdout, correctness=corr)
                )

                tech = max(corr, score_interview._safe_int(fb.get("technical"), corr))
                comp = score_interview._safe_int(fb.get("completeness"), 50 if corr > 0 else 0)
                comm = 0

            # upsert into interview_scores
            try:
                perq_overall = round(score_interview.COMM_W * int(comm) + score_interview.TECH_W * int(tech) + score_interview.COMP_W * int(comp), 2)
                db.execute(text("""
                    INSERT INTO interview_scores
                      (interview_id, question_id, technical_score, communication_score,
                       completeness_score, overall_score, ai_feedback, llm_raw, created_at)
                    VALUES (:iid, :qid, :tech, :comm, :comp, :overall, CAST(:fb AS jsonb), :raw, now())
                    ON CONFLICT (interview_id, question_id) DO UPDATE
                    SET technical_score = EXCLUDED.technical_score,
                        communication_score = EXCLUDED.communication_score,
                        completeness_score = EXCLUDED.completeness_score,
                        overall_score = EXCLUDED.overall_score,
                        ai_feedback = EXCLUDED.ai_feedback,
                        llm_raw = EXCLUDED.llm_raw,
                        created_at = now()
                """), {
                    "iid": str(iid),
                    "qid": int(question_id),
                    "tech": int(tech),
                    "comm": int(comm),
                    "comp": int(comp),
                    "overall": float(perq_overall),
                    "fb": json.dumps(fb),
                    "raw": raw_resp,
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
