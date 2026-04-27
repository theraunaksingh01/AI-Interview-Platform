# backend/tasks/live_scoring.py

from celery import shared_task
from datetime import datetime
from decimal import Decimal
import json
import logging

from sqlalchemy import text

from db.session import SessionLocal
from services.live_scoring import run_live_question_scoring
from tasks.score_interview import aggregate_interview_scores

log = logging.getLogger(__name__)


@shared_task
def score_turn(turn_id: int):
    """
    Celery task: score a single candidate turn (Phase 6 live scoring).
    Uses plain SQL instead of ORM models for interviews / questions / scores.
    """
    db = SessionLocal()
    try:
        # 1) Load the turn row
        turn_row = db.execute(
            text(
                """
                SELECT id, interview_id, question_id, speaker, transcript
                FROM interview_turns
                WHERE id = :tid
                """
            ),
            {"tid": turn_id},
        ).mappings().first()

        if not turn_row:
            return {"error": "turn_not_found", "turn_id": turn_id}

        if turn_row["speaker"] != "candidate":
            return {"error": "not_candidate_turn", "turn_id": turn_id}

        interview_id = turn_row["interview_id"]
        question_id = turn_row["question_id"]
        transcript = turn_row["transcript"] or ""

        # 2) (Optional) load question text if needed by your scoring logic
        question_text = None
        if question_id is not None:
            q_row = db.execute(
                text(
                    """
                    SELECT question_text
                    FROM interview_questions
                    WHERE id = :qid
                    """
                ),
                {"qid": question_id},
            ).mappings().first()
            if q_row:
                question_text = q_row["question_text"]

        # 3) Call real LLM scoring (with fallback on failure)
        try:
            scoring_result = run_live_question_scoring(
                interview_id=interview_id,
                question_id=question_id,
                transcript=transcript,
                question_text=question_text,
            )
        except Exception:
            log.exception("[LIVE_SCORING] scoring call failed for turn %s", turn_id)
            return {"error": "scoring_failed", "turn_id": turn_id}

        if not scoring_result:
            return {"error": "scoring_result_empty", "turn_id": turn_id}

        tech = int(scoring_result.get("technical_score", 0))
        comm = int(scoring_result.get("communication_score", 0))
        comp = int(scoring_result.get("completeness_score", 0))
        overall = scoring_result.get("overall_score", 0)
        overall_dec = Decimal(str(overall))

        ai_feedback = scoring_result.get("ai_feedback", {}) or {}
        if isinstance(ai_feedback, str):
            try:
                ai_feedback_dict = json.loads(ai_feedback)
            except Exception:
                ai_feedback_dict = {}
        else:
            ai_feedback_dict = ai_feedback or {}
        llm_raw = scoring_result.get("llm_raw", "") or ""

        # 4) Insert a new row into interview_scores (simple version: one row per scoring)
        db.execute(
            text(
                """
                INSERT INTO interview_scores (
                    interview_id,
                    question_id,
                    technical_score,
                    communication_score,
                    completeness_score,
                    overall_score,
                    ai_feedback,
                    created_at,
                    llm_raw
                )
                VALUES (
                    :interview_id,
                    :question_id,
                    :technical_score,
                    :communication_score,
                    :completeness_score,
                    :overall_score,
                    cast(:ai_feedback as jsonb),
                    :created_at,
                    :llm_raw
                )
                """
            ),
            {
                "interview_id": interview_id,
                "question_id": question_id,
                "technical_score": tech,
                "communication_score": comm,
                "completeness_score": comp,
                "overall_score": overall_dec,
                "ai_feedback": json.dumps(ai_feedback_dict if isinstance(ai_feedback_dict, dict) else {}),
                "created_at": datetime.utcnow(),
                "llm_raw": llm_raw,
            },
        )

        # 5) Insert into interview_score_audit (optional but recommended)
        db.execute(
            text(
                """
                INSERT INTO interview_score_audit (
                    interview_id,
                    scored_at,
                    overall_score,
                    section_scores,
                    per_question,
                    model_meta,
                    prompt_hash,
                    prompt_text,
                    weights,
                    triggered_by,
                    task_id,
                    llm_raw_s3_key,
                    notes,
                    created_at
                )
                VALUES (
                    :interview_id,
                    :scored_at,
                    :overall_score,
                    cast(:section_scores as jsonb),
                    cast(:per_question as jsonb),
                    cast(:model_meta as jsonb),
                    :prompt_hash,
                    :prompt_text,
                    cast(:weights as jsonb),
                    :triggered_by,
                    :task_id,
                    :llm_raw_s3_key,
                    :notes,
                    :created_at
                )
                """
            ),
            {
                "interview_id": interview_id,
                "scored_at": datetime.utcnow(),
                "overall_score": overall_dec,
                "section_scores": json.dumps(scoring_result.get("section_scores") or {}),
                "per_question": json.dumps(scoring_result.get("per_question") or {}),
                "model_meta": json.dumps(scoring_result.get("model_meta") or {}),
                "prompt_hash": scoring_result.get("prompt_hash"),
                "prompt_text": scoring_result.get("prompt_text"),
                "weights": json.dumps(scoring_result.get("weights") or {}),
                "triggered_by": "live_turn",
                "task_id": None,
                "llm_raw_s3_key": None,
                "notes": f"Live scoring for turn_id={turn_id}",
                "created_at": datetime.utcnow(),
            },
        )

        db.commit()

        # Check if all questions for this interview are now scored
        # If yes, trigger aggregation
        try:
            total_qs = db.execute(text(
                "SELECT COUNT(*) FROM interview_questions WHERE interview_id = :iid"
            ), {"iid": interview_id}).scalar()

            scored_qs = db.execute(text(
                "SELECT COUNT(DISTINCT question_id) FROM interview_scores WHERE interview_id = :iid"
            ), {"iid": interview_id}).scalar()

            if scored_qs >= total_qs:
                # All questions scored — trigger aggregation
                aggregate_interview_scores.delay(str(interview_id))
                log.info("[LIVE_SCORING] All %s questions scored — triggered aggregation for %s", scored_qs, interview_id)
        except Exception as e:
            log.warning("[LIVE_SCORING] Could not check completion: %s", e)

        # 6) (optional) send a live WS notification — you can add later
        # broadcast_score_update(...)

        return {
            "ok": True,
            "turn_id": turn_id,
            "question_id": question_id,
            "scores": {
                "technical": tech,
                "communication": comm,
                "completeness": comp,
                "overall": float(overall_dec),
            },
        }

    finally:
        db.close()
