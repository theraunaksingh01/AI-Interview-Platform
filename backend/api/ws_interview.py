from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text
from uuid import UUID
from datetime import datetime
import logging
import asyncio

from db.session import get_db
from db.models import InterviewTurn
from tasks.live_scoring import score_turn

from services.tts_service import synthesize_speech
from utils.audio_storage import save_agent_audio_file
from services.ws_broadcast import ACTIVE_CONNECTIONS


router = APIRouter()
logger = logging.getLogger(__name__)


async def send_json_safe(ws: WebSocket, payload: dict):
    try:
        await ws.send_json(payload)
    except Exception:
        logger.exception("[WS] send failed")


def get_next_question(db: Session, interview_id: UUID):
    rows = db.execute(
        text("""
            SELECT id, question_text
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
            return {"id": r.id, "question_text": r.question_text}

    return None


@router.websocket("/ws/interview/{interview_id}")
async def interview_ws(
    websocket: WebSocket,
    interview_id: UUID,
    db: Session = Depends(get_db),
):
    await websocket.accept()
    logger.info("[WS] connected %s", interview_id)

    ACTIVE_CONNECTIONS.setdefault(str(interview_id), set()).add(websocket)

    try:
        await handle_on_connect(db, interview_id, websocket)

        while True:
            msg = await websocket.receive_json()

            if msg.get("type") == "candidate_text":
                turn = InterviewTurn(
                    interview_id=interview_id,
                    question_id=msg.get("question_id"),
                    speaker="candidate",
                    transcript=msg.get("text") or "",
                    started_at=datetime.utcnow(),
                    ended_at=datetime.utcnow(),
                )
                db.add(turn)
                db.commit()
                db.refresh(turn)

                score_turn.delay(turn.id)

                next_q = get_next_question(db, interview_id)
                if next_q:
                    await send_agent_question(db, interview_id, next_q, websocket)
                else:
                    await send_json_safe(
                        websocket,
                        {
                            "type": "agent_message",
                            "text": "Thanks, this completes your interview.",
                            "done": True,
                        },
                    )

            elif msg.get("type") == "ping":
                await send_json_safe(websocket, {"type": "pong"})

    except WebSocketDisconnect:
        logger.info("[WS] disconnected %s", interview_id)

    finally:
        ACTIVE_CONNECTIONS.get(str(interview_id), set()).discard(websocket)


async def handle_on_connect(db: Session, interview_id: UUID, ws: WebSocket):
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

    await send_json_safe(ws, {"type": "agent_message", "text": greeting})

    try:
        audio_bytes = await asyncio.to_thread(synthesize_speech, greeting)
        if audio_bytes:
            audio_path = await asyncio.to_thread(
                save_agent_audio_file, audio_bytes, str(interview_id)
            )
            await send_json_safe(
                ws,
                {
                    "type": "agent_message",
                    "text": greeting,
                    "audio_url": audio_path,
                },
            )
    except Exception:
        logger.exception("[TTS] greeting failed")

    first_q = get_next_question(db, interview_id)
    if first_q:
        await send_agent_question(db, interview_id, first_q, ws)


async def send_agent_question(db: Session, interview_id: UUID, q: dict, ws: WebSocket):
    qid = q["id"]
    text_q = q["question_text"]

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

    await send_json_safe(
        ws,
        {
            "type": "agent_message",
            "question_id": qid,
            "text": text_q,
        },
    )

    try:
        audio = await asyncio.to_thread(synthesize_speech, text_q)
        if audio:
            path = await asyncio.to_thread(save_agent_audio_file, audio)
            await send_json_safe(
                ws,
                {
                    "type": "agent_message",
                    "question_id": qid,
                    "text": text_q,
                    "audio_url": path,
                },
            )
    except Exception:
        logger.exception("[TTS] question failed")
