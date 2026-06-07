from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends
from starlette.websockets import WebSocketState
from sqlalchemy.orm import Session
from sqlalchemy import text
from uuid import UUID
from datetime import datetime
import logging
import asyncio
import os

from services.timeline_logger import log_timeline_event
from db.session import get_db
from db.models import InterviewTurn
from tasks.live_scoring import score_turn

from services.tts_service import synthesize_speech
from utils.audio_storage import save_agent_audio_file
from services.ws_broadcast import (
    register_connection,
    unregister_connection,
)

from services.answer_backfill import backfill_answers_from_turns
from services.timeline_logger import log_timeline_event
from services.interview_runtime_state import (
    clear_interview_state,
    get_interview_state,
    set_active_question,
    set_answer_submitted,
)

from services.followup_generator import (
    build_context_memory,
    get_difficulty_hint,
    generate_followup,
    has_followup_for_question,
    insert_followup_question,
)

FOLLOWUP_ENABLED = os.getenv("FOLLOWUP_ENABLED", "true").lower() in ("true", "1", "yes")


router = APIRouter()
logger = logging.getLogger(__name__)


CODING_LIKE_QUESTION_TYPES = {"code", "coding", "dsa", "system_design", "system-design"}


def _normalize_question_type(question_type: str | None) -> str:
    return (question_type or "").strip().lower().replace("-", "_")


def _is_coding_like_question_type(question_type: str | None) -> bool:
    return _normalize_question_type(question_type) in {qt.replace("-", "_") for qt in CODING_LIKE_QUESTION_TYPES}


async def send_json_safe(ws: WebSocket, payload: dict):
    try:
        await ws.send_json(payload)
    except Exception:
        logger.exception("[WS] send failed")


async def _queue_scoring_task(turn_id: int) -> None:
    try:
        score_turn.delay(turn_id)
    except Exception:
        logger.exception("[Celery] score_turn failed to queue — continuing interview")


async def _queue_followup_task(
    interview_id: UUID,
    question_id: int | None,
    transcript_text: str,
    score: float = 5.0,
    role: str = "Software Engineer",
    company: str = "the company",
    plan: str = "free",
) -> None:
    """
    Generate and insert a follow-up question if eligible.
    Runs as a background asyncio task after the student submits an answer.
    """
    from services.followup_generator import (
        generate_followup,
        has_followup_for_question,
        insert_followup_question,
        get_session_followup_count,
        FOLLOWUP_PLANS,
    )

    # Plan gate — follow-ups only for Pro/Max
    if plan not in FOLLOWUP_PLANS:
        logger.info("[followup] plan=%s not eligible for follow-ups", plan)
        return

    if not FOLLOWUP_ENABLED or not question_id or not transcript_text.strip():
        return

    state = get_interview_state(interview_id)
    if state.get("answer_submitted", False):
        return

    db = None
    try:
        from db.session import SessionLocal
        db = SessionLocal()

        # Check session cap
        followup_count = get_session_followup_count(db, str(interview_id))
        if followup_count >= 3:
            logger.info("[followup] session cap reached (%d)", followup_count)
            return

        # Check if already has follow-up for this question
        if has_followup_for_question(db, question_id):
            logger.info("[followup] already has follow-up for q=%d", question_id)
            return

        # Get question text
        q_row = db.execute(
            text("SELECT question_text FROM interview_questions WHERE id = :qid"),
            {"qid": question_id},
        ).mappings().first()

        if not q_row:
            return

        question_text = q_row["question_text"]

        # Generate follow-up decision via Claude
        result = generate_followup(
            question_text=question_text,
            transcript=transcript_text,
            score=score,
            role=role,
            company=company,
            interview_id=str(interview_id),
            db=db,
        )

        if not result or not result.get("followup"):
            logger.info("[followup] no follow-up warranted for q=%d", question_id)
            return

        followup_q = result.get("question", "").strip()
        if not followup_q:
            return

        # Insert follow-up question into interview_questions
        new_q_id = insert_followup_question(
            db=db,
            interview_id=str(interview_id),
            parent_question_id=question_id,
            followup_text=followup_q,
        )

        if new_q_id:
            logger.info(
                "[followup] inserted follow-up q=%d (parent=%d) for interview=%s",
                new_q_id, question_id, interview_id,
            )
        else:
            logger.warning("[followup] failed to insert follow-up for q=%d", question_id)

    except Exception:
        logger.exception("[followup] unexpected error for interview=%s", interview_id)
    finally:
        if db:
            try:
                db.close()
            except Exception:
                pass


async def _send_next_or_complete(db: Session, interview_id: UUID, websocket: WebSocket) -> None:
    next_q = get_next_question(db, interview_id)
    if next_q:
        await send_agent_question(db, interview_id, next_q, websocket)
        set_answer_submitted(interview_id, False)
        return

    await send_json_safe(
        websocket,
        {
            "type": "agent_message",
            "text": "Thanks, this completes your interview.",
            "done": True,
        },
    )
    try:
        backfill_answers_from_turns(db, interview_id)
    except Exception:
        logger.exception("[BACKFILL] failed on interview done")


def get_next_question(db: Session, interview_id: UUID):
    question_order_exists = db.execute(
        text("""
            SELECT EXISTS (
                SELECT 1
                FROM information_schema.columns
                WHERE table_name = 'interview_questions'
                  AND column_name = 'question_order'
            )
        """)
    ).scalar()

    order_clause = "question_order ASC NULLS LAST, id ASC" if question_order_exists else "id ASC"

    rows = db.execute(
        text(f"""
            SELECT id, question_text, type, description, sample_cases,
                   time_limit_seconds, source, parent_question_id
            FROM interview_questions
            WHERE interview_id = :iid
            ORDER BY {order_clause}
        """),
        {"iid": interview_id},
    ).fetchall()

    if not rows:
        return None

    answered = db.execute(
        text("""
            SELECT DISTINCT question_id
            FROM interview_turns
            WHERE interview_id = :iid
              AND speaker = 'candidate'
              AND question_id IS NOT NULL
        """),
        {"iid": interview_id},
    ).fetchall()

    answered_ids = {r.question_id for r in answered if r.question_id}

    for r in rows:
        if r.id not in answered_ids:
            is_coding = _is_coding_like_question_type(r.type)
            time_limit = int(r.time_limit_seconds or 0)
            if is_coding:
                time_limit = max(600, time_limit)
            else:
                time_limit = time_limit or 120
            return {
                "id": r.id,
                "question_text": r.question_text,
                "type": r.type,
                "description": r.description or "",
                "sample_cases": r.sample_cases if r.sample_cases else [],
                "time_limit_seconds": time_limit,
                "source": r.source or "",
                "parent_question_id": r.parent_question_id,
                "is_followup": r.parent_question_id is not None,
            }

    return None


@router.websocket("/ws/interview/{interview_id}")
async def interview_ws(
    websocket: WebSocket,
    interview_id: UUID,
    db: Session = Depends(get_db),
):
    if websocket.client_state == WebSocketState.CONNECTING:
        await websocket.accept()
    logger.info("[WS] connected %s", interview_id)

    await register_connection(interview_id, websocket)
    set_answer_submitted(interview_id, False)

    try:
        await handle_on_connect(db, interview_id, websocket)

        if websocket.client_state != WebSocketState.CONNECTED:
            return

        while True:
            try:
                msg = await websocket.receive_json()
            except (WebSocketDisconnect, RuntimeError):
                logger.info("[WS] receive loop ended for %s", interview_id)
                break

            if msg.get("type") == "candidate_text":
                question_id = msg.get("question_id")
                transcript_text = msg.get("text") or ""
                set_answer_submitted(interview_id, True)

                turn = InterviewTurn(
                    interview_id=interview_id,
                    question_id=question_id,
                    speaker="candidate",
                    transcript=transcript_text,
                    started_at=datetime.utcnow(),
                    ended_at=datetime.utcnow(),
                )
                db.add(turn)
                db.commit()
                db.refresh(turn)

                # Deliver the next question immediately; scoring/follow-up work is non-blocking.
                await _send_next_or_complete(db, interview_id, websocket)
                asyncio.create_task(_queue_scoring_task(turn.id))

                # Get score from interview_scores if available
                _score = 5.0
                try:
                    score_row = db.execute(
                        text("""
                            SELECT overall_score FROM interview_scores
                            WHERE interview_id = :iid
                            ORDER BY created_at DESC LIMIT 1
                        """),
                        {"iid": interview_id},
                    ).scalar()
                    if score_row:
                        _score = float(score_row)
                except Exception:
                    pass

                # Get plan from interview metadata
                _plan = "free"
                try:
                    plan_row = db.execute(
                        text("""
                            SELECT u.plan FROM interviews i
                            JOIN users u ON u.id = i.user_id
                            WHERE i.id = :iid
                        """),
                        {"iid": interview_id},
                    ).scalar()
                    if plan_row:
                        _plan = plan_row
                except Exception:
                    pass

                asyncio.create_task(_queue_followup_task(
                    interview_id, question_id, transcript_text,
                    score=_score, plan=_plan,
                ))

            elif msg.get("type") == "candidate_code":
                # Handle code submission from LeetCode-style IDE
                code_text = msg.get("code") or ""
                lang = msg.get("lang") or "python"
                test_results = msg.get("test_results") or []
                set_answer_submitted(interview_id, True)

                turn = InterviewTurn(
                    interview_id=interview_id,
                    question_id=msg.get("question_id"),
                    speaker="candidate",
                    transcript=f"[CODE ({lang})]\n{code_text}",
                    started_at=datetime.utcnow(),
                    ended_at=datetime.utcnow(),
                )
                db.add(turn)
                db.commit()
                db.refresh(turn)

                # Upsert interview_answers with code data
                try:
                    import json as _json
                    db.execute(
                        text("""
                            INSERT INTO interview_answers
                              (interview_question_id, code_answer, code_output, test_results)
                            VALUES (:qid, :code, :output, CAST(:tr AS jsonb))
                            ON CONFLICT DO NOTHING
                        """),
                        {
                            "qid": msg.get("question_id"),
                            "code": code_text,
                            "output": msg.get("output", ""),
                            "tr": _json.dumps(test_results),
                        },
                    )

                    db.execute(
                        text("""
                            UPDATE interview_answers
                            SET code_answer = :code,
                                code_output = :output,
                                test_results = CAST(:tr AS jsonb)
                            WHERE interview_question_id = :qid
                        """),
                        {
                            "qid": msg.get("question_id"),
                            "code": code_text,
                            "output": msg.get("output", ""),
                            "tr": _json.dumps(test_results),
                        },
                    )
                    db.commit()
                except Exception:
                    db.rollback()
                    logger.exception("[WS] failed to upsert interview_answers for code")

                await _send_next_or_complete(db, interview_id, websocket)
                asyncio.create_task(_queue_scoring_task(turn.id))

            elif msg.get("type") == "ping":
                await send_json_safe(websocket, {"type": "pong"})

    except WebSocketDisconnect:
        logger.info("[WS] disconnected %s", interview_id)

    finally:
        unregister_connection(interview_id)
        clear_interview_state(interview_id)
        # Safety-net: backfill answers on any disconnect
        try:
            backfill_answers_from_turns(db, interview_id)
        except Exception:
            logger.exception("[BACKFILL] safety-net failed on disconnect")


async def handle_on_connect(db: Session, interview_id: UUID, ws: WebSocket):
    # Validate interview exists before creating any turns.
    interview_row = db.execute(
        text("SELECT id, status FROM interviews WHERE id = :iid LIMIT 1"),
        {"iid": interview_id},
    ).mappings().first()

    if not interview_row:
        if ws.client_state == WebSocketState.CONNECTED:
            await send_json_safe(
                ws,
                {
                    "type": "error",
                    "message": f"Interview {interview_id} not found",
                },
            )
            await ws.close(code=4004)
        return

    # Check if there are already turns for this interview (reconnect scenario)
    existing_turns = db.execute(
        text("SELECT COUNT(*) FROM interview_turns WHERE interview_id = :iid"),
        {"iid": interview_id},
    ).scalar()

    if not existing_turns:
        # First connection: send greeting
        greeting = "Hi! We'll start your interview now. Please answer in detail."

        db.add(
            InterviewTurn(
                interview_id=interview_id,
                speaker="agent",
                transcript=greeting,
                started_at=datetime.utcnow(),
                ended_at=datetime.utcnow(),
            )
        )
        db.commit()

        audio_url = None
        try:
            audio_bytes = await asyncio.to_thread(synthesize_speech, greeting)
            if audio_bytes:
                audio_path = await asyncio.to_thread(
                    save_agent_audio_file, audio_bytes, str(interview_id)
                )
                audio_url = audio_path
        except Exception:
            logger.exception("[TTS] greeting failed")

        greeting_msg: dict = {"type": "agent_message", "text": greeting}
        if audio_url:
            greeting_msg["audio_url"] = audio_url
        await send_json_safe(ws, greeting_msg)

    # Send the next unanswered question (works for both fresh and reconnect)
    first_q = get_next_question(db, interview_id)
    if first_q:
        await send_agent_question(db, interview_id, first_q, ws)
    else:
        if str(interview_row.get("status") or "").lower() == "completed":
            await send_json_safe(
                ws,
                {
                    "type": "agent_message",
                    "text": "This interview has already been completed. Thank you!",
                    "done": True,
                },
            )
        else:
            await send_json_safe(
                ws,
                {
                    "type": "agent_message",
                    "text": "Welcome! We are preparing your questions. Please stay connected.",
                },
            )


async def send_agent_question(db: Session, interview_id: UUID, q: dict, ws: WebSocket):
    qid = q["id"]
    text_q = q["question_text"]

    # Only create agent turn if one doesn't already exist for this question
    existing_agent_turn = db.execute(
        text("""
            SELECT id FROM interview_turns
            WHERE interview_id = :iid AND question_id = :qid AND speaker = 'agent'
            LIMIT 1
        """),
        {"iid": interview_id, "qid": qid},
    ).scalar()

    if not existing_agent_turn:
        db.add(
            InterviewTurn(
                interview_id=interview_id,
                question_id=qid,
                speaker="agent",
                transcript=text_q,
                started_at=datetime.utcnow(),
                ended_at=datetime.utcnow(),
            )
        )
        db.commit()

        log_timeline_event(
            db,
            interview_id=interview_id,
            question_id=qid,
            event_type="agent_question",
            payload={"text": text_q},
        )

    # Generate TTS first so we send text + audio in ONE message (avoids
    # the frontend triggering candidate recording before audio plays).
    audio_url = None
    try:
        audio = await asyncio.to_thread(synthesize_speech, text_q)
        if audio:
            path = await asyncio.to_thread(save_agent_audio_file, audio)
            audio_url = path
    except Exception:
        logger.exception("[TTS] question failed")

    question_msg: dict = {
        "type": "agent_message",
        "question_id": qid,
        "question_type": q.get("type", "voice"),
        "text": text_q,
        "is_followup": q.get("is_followup", False),
    }
    if q.get("parent_question_id"):
        question_msg["parent_question_id"] = q["parent_question_id"]
    # Include code question metadata
    if q.get("type") == "code":
        question_msg["description"] = q.get("description", "")
        question_msg["sample_cases"] = q.get("sample_cases", [])
        question_msg["time_limit_seconds"] = q.get("time_limit_seconds", 600)
    if audio_url:
        question_msg["audio_url"] = audio_url

    set_active_question(interview_id, qid)
    await send_json_safe(ws, question_msg)


async def _try_generate_followup(
    db: Session,
    interview_id: UUID,
    question_id: int,
    transcript: str,
    ws: WebSocket,
) -> bool:
    """
    Attempt to generate a dynamic follow-up for a voice question.
    Returns True if a follow-up was sent, False otherwise.
    """
    try:
        if get_interview_state(interview_id).get("answer_submitted", False):
            return False

        # Only follow up on voice questions
        qtype = db.execute(
            text("SELECT type, question_text, parent_question_id FROM interview_questions WHERE id = :qid"),
            {"qid": question_id},
        ).fetchone()

        if not qtype:
            return False

        # Skip if: not voice, already is a follow-up, or follow-up already exists
        if qtype.type != "voice":
            return False
        if _is_coding_like_question_type(qtype.type):
            return False
        if qtype.parent_question_id is not None:
            return False
        if has_followup_for_question(db, question_id):
            return False

        # Build context and difficulty
        context = build_context_memory(db, str(interview_id))
        difficulty = get_difficulty_hint(db, str(interview_id))

        # Generate follow-up (async with timeout)
        result = await generate_followup(
            question_text=qtype.question_text or "",
            transcript=transcript,
            context_memory=context,
            difficulty=difficulty,
        )

        if not result or not result.get("followup_question"):
            return False

        followup_text = result["followup_question"].strip()
        if not followup_text:
            return False

        # Insert into DB
        new_qid = insert_followup_question(
            db, str(interview_id), question_id, followup_text
        )

        if not new_qid:
            return False

        logger.info(
            "[FOLLOWUP] Generated for Q%s -> new Q%s (difficulty=%s)",
            question_id, new_qid, difficulty,
        )

        # The follow-up is now in interview_questions and will be served
        # by get_next_question() since it has a higher ID
        if get_interview_state(interview_id).get("answer_submitted", False):
            return False

        next_q = get_next_question(db, interview_id)
        if next_q and next_q["id"] == new_qid:
            await send_agent_question(db, interview_id, next_q, ws)
            return True

        return False

    except Exception:
        logger.exception("[FOLLOWUP] failed for Q%s — skipping", question_id)
        return False
