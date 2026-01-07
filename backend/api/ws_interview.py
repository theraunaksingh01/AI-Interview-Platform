from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import Dict, Any
from uuid import UUID
from datetime import datetime
import logging

from db.session import get_db
from db.models import InterviewTurn
from tasks.live_scoring import score_turn

from services.tts_service import synthesize_speech
from utils.audio_storage import save_agent_audio_file

import asyncio


router = APIRouter()
logger = logging.getLogger(__name__)

# simple in-memory connection registry (ok for single process dev)
connections: Dict[UUID, WebSocket] = {}


async def send_json_safe(ws: WebSocket, payload: Dict[str, Any]) -> None:
    """
    Safe wrapper around ws.send_json — catches and logs exceptions.
    """
    try:
        await ws.send_json(payload)
    except Exception as e:
        # connection likely closed or send failed
        logger.exception("[WS] send_json failed: %s", e)


def get_next_question(db: Session, interview_id: UUID):
    """
    Fetch the next unanswered question for this interview using plain SQL.
    Returns a dict: {"id": <int>, "question_text": <str>} or None.
    """

    logger.info(f"[get_next_question] interview_id={interview_id}")

    rows = db.execute(
        text(
            """
            SELECT id, question_text
            FROM interview_questions
            WHERE interview_id = :iid
            ORDER BY id ASC
            """
        ),
        {"iid": interview_id},
    ).fetchall()

    logger.info(f"[get_next_question] raw question rows={rows}")

    if not rows:
        return None

    answered_rows = db.execute(
        text(
            """
            SELECT DISTINCT question_id
            FROM interview_turns
            WHERE interview_id = :iid
              AND speaker = 'candidate'
              AND question_id IS NOT NULL
            """
        ),
        {"iid": interview_id},
    ).fetchall()

    answered_ids = {r.question_id for r in answered_rows if r.question_id is not None}
    logger.info(f"[get_next_question] answered_ids={answered_ids}")

    for r in rows:
        if r.id not in answered_ids:
            logger.info(f"[get_next_question] next question id={r.id}")
            return {"id": r.id, "question_text": r.question_text}

    logger.info("[get_next_question] all questions answered")
    return None


@router.websocket("/ws/interview/{interview_id}")
async def interview_ws(
    websocket: WebSocket,
    interview_id: UUID,
    db: Session = Depends(get_db),
):
    await websocket.accept()
    logger.info(f"[WS] interview_ws connected interview_id={interview_id} ws_id={id(websocket)}")

    # validate interview exists
    row = db.execute(
        text("SELECT 1 FROM interviews WHERE id = :iid"),
        {"iid": interview_id},
    ).scalar()

    if row is None:
        logger.warning(f"[WS] interview not found: {interview_id}")
        await send_json_safe(websocket, {"type": "error", "message": "Interview not found"})
        await websocket.close()
        return

    connections[interview_id] = websocket
    logger.info(f"[WS] stored connection id={id(websocket)} for interview={interview_id}")

    # send greeting + first question
    await handle_on_connect(db, interview_id, websocket)

    try:
        while True:
            message = await websocket.receive_json()
            mtype = message.get("type")
            logger.info(f"[WS] received message type={mtype} data={message}")

            if mtype == "candidate_text":
                answer_text = message.get("text") or ""
                question_id = message.get("question_id")

                turn = InterviewTurn(
                    interview_id=interview_id,
                    question_id=question_id,
                    speaker="candidate",
                    started_at=datetime.utcnow(),
                    ended_at=datetime.utcnow(),
                    transcript=answer_text,
                )
                db.add(turn)
                db.commit()
                db.refresh(turn)

                async_score = score_turn.delay(turn.id)

                await send_json_safe(
                    websocket,
                    {
                        "type": "scoring_started",
                        "turn_id": turn.id,
                        "question_id": question_id,
                        "task_id": async_score.id,
                    },
                )

                # send next question
                next_q = get_next_question(db, interview_id)
                if next_q:
                    await send_agent_question(db, interview_id, next_q, websocket)
                else:
                    await send_json_safe(
                        websocket,
                        {
                            "type": "agent_message",
                            "role": "agent",
                            "text": "Thanks, this completes your interview.",
                            "done": True,
                        },
                    )
                    db.execute(
                        text("UPDATE interviews SET status = 'completed' WHERE id = :iid"),
                        {"iid": interview_id},
                    )
                    db.commit()

            elif mtype == "ping":
                await send_json_safe(websocket, {"type": "pong"})

            else:
                await send_json_safe(
                    websocket,
                    {"type": "error", "message": f"Unknown message type: {mtype}"},
                )

    except WebSocketDisconnect:
        logger.info(f"[WS] disconnect interview_id={interview_id} ws_id={id(websocket)}")
        connections.pop(interview_id, None)
    except Exception as e:
        # unexpected exception — log and cleanup
        logger.exception("[WS] unexpected error in interview_ws: %s", e)
        connections.pop(interview_id, None)
        try:
            await websocket.close()
        except Exception:
            pass


async def handle_on_connect(
    db: Session,
    interview_id: UUID,
    ws: WebSocket,
) -> None:
    """Send initial greeting + first question, with optional TTS (run in thread)."""
    greeting_text = "Hi! We'll start your interview now. Please answer in detail."
    logger.info(f"[WS] handle_on_connect for interview_id={interview_id}")
    

    greeting_turn = InterviewTurn(
        interview_id=interview_id,
        speaker="agent",
        transcript=greeting_text,
        started_at=datetime.utcnow(),
        ended_at=datetime.utcnow(),
    )
    db.add(greeting_turn)
    db.commit()

    # Send greeting immediately (text) so client receives it fast
    payload = {
        "type": "agent_message",
        "role": "agent",
        "text": greeting_text,
    }

    await send_json_safe(ws, payload)
    logger.info("[WS] sent greeting text for interview=%s", interview_id)

    # Generate TTS in background thread so we don't block the event loop.
    # If it succeeds, save file and then send an "audio_ready" agent_message that includes the audio_url.
    async def gen_and_send_audio():
        try:
            audio_bytes = await asyncio.to_thread(synthesize_speech, greeting_text)
            if audio_bytes:
                audio_path = await asyncio.to_thread(save_agent_audio_file, audio_bytes)
                # send a follow-up message that includes audio_url but not required for text display
                await send_json_safe(
                    ws,
                    {
                        "type": "agent_message",
                        "role": "agent",
                        "text": greeting_text,
                        "audio_url": audio_path,
                    },
                )
                logger.info("[WS] sent greeting audio_url=%s for interview=%s", audio_path, interview_id)
        except Exception as e:
            logger.exception("[WS] TTS generation failed for greeting: %s", e)

    # Start the background job but don't await it here
    asyncio.create_task(gen_and_send_audio())

    # small delay so frontend finishes processing greeting and starting speech
    await asyncio.sleep(0.8)

    # now fetch and send first question (text). TTS for question will also be backgrounded in send_agent_question
    first_q = get_next_question(db, interview_id)
    logger.info(f"[WS] first_q={first_q}")

    if first_q:
        await send_agent_question(db, interview_id, first_q, ws)
    else:
        await send_json_safe(
            ws,
            {
                "type": "agent_message",
                "role": "agent",
                "text": "No questions are configured for this interview.",
                "done": True,
            },
        )


async def send_agent_question(
    db: Session,
    interview_id: UUID,
    question: dict,
    ws: WebSocket,
) -> None:
    """
    Create an 'agent' turn for this question and send it to the client,
    with optional TTS audio_url generated in background.
    """
    logger.info(
        f"[WS] send_agent_question interview_id={interview_id} qid={question['id']} text={question['question_text']}"
    )

    turn = InterviewTurn(
        interview_id=interview_id,
        question_id=question["id"],
        speaker="agent",
        transcript=question["question_text"],
        started_at=datetime.utcnow(),
        ended_at=datetime.utcnow(),
    )
    db.add(turn)
    db.commit()

    # Send the question text immediately
    payload = {
        "type": "agent_message",
        "role": "agent",
        "question_id": question["id"],
        "text": question["question_text"],
    }

    logger.info(f"[WS] about to send agent_message qid={question['id']} to interview={interview_id}")
    await send_json_safe(ws, payload)
    logger.info("[WS] send_json attempted for qid=%s", question["id"])

    # generate audio in background without blocking
    async def gen_and_attach_audio():
        try:
            audio_bytes = await asyncio.to_thread(synthesize_speech, question["question_text"])
            if not audio_bytes:
                logger.info("[WS] synthesize_speech returned no audio for qid=%s", question["id"])
                return
            audio_path = await asyncio.to_thread(save_agent_audio_file, audio_bytes)
            # send a follow-up message that includes audio_url (client will play it if present)
            await send_json_safe(
                ws,
                {
                    "type": "agent_message",
                    "role": "agent",
                    "question_id": question["id"],
                    "text": question["question_text"],
                    "audio_url": audio_path,
                },
            )
            logger.info("[WS] sent question audio_url=%s for qid=%s", audio_path, question["id"])
        except Exception as e:
            logger.exception("[WS] TTS generation failed for question %s: %s", question["id"], e)

    asyncio.create_task(gen_and_attach_audio())
