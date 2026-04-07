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
) -> None:
    # Follow-up generation is cancelled for submitted answers to avoid races
    # with next-question delivery.
    if not FOLLOWUP_ENABLED or not question_id or not transcript_text.strip():
        return
    if get_interview_state(interview_id).get("answer_submitted", False):
        return


async def _send_next_or_complete(db: Session, interview_id: UUID, websocket: WebSocket) -> None:
    next_q = get_next_question(db, interview_id)
    if next_q:
        await send_agent_question(db, interview_id, next_q, websocket)
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
    rows = db.execute(
        text("""
            SELECT id, question_text, type, description, sample_cases,
                   time_limit_seconds, source, parent_question_id
            FROM interview_questions
            WHERE interview_id = :iid
            ORDER BY id ASC
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
            return {
                "id": r.id,
                "question_text": r.question_text,
                "type": r.type,
                "description": r.description or "",
                "sample_cases": r.sample_cases if r.sample_cases else [],
                "time_limit_seconds": r.time_limit_seconds or (600 if r.type == "code" else 120),
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
                asyncio.create_task(_queue_followup_task(interview_id, question_id, transcript_text))

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
                              (interview_id, question_id, code_answer, code_output, test_results)
                            VALUES (:iid, :qid, :code, :output, CAST(:tr AS jsonb))
                            ON CONFLICT (interview_id, question_id) DO UPDATE
                              SET code_answer = EXCLUDED.code_answer,
                                  code_output = EXCLUDED.code_output,
                                  test_results = EXCLUDED.test_results
                        """),
                        {
                            "iid": interview_id,
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
