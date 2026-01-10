from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import Dict, Any
from uuid import UUID
from datetime import datetime
import logging
import asyncio

from db.session import get_db
from db.models import InterviewTurn
from tasks.live_scoring import score_turn

from services.tts_service import synthesize_speech
from utils.audio_storage import save_agent_audio_file

router = APIRouter()
logger = logging.getLogger(__name__)

connections: Dict[UUID, WebSocket] = {}


async def send_json_safe(ws: WebSocket, payload: Dict[str, Any]) -> None:
    try:
        await ws.send_json(payload)
    except Exception:
        logger.exception("[WS] send_json failed")


def get_next_question(db: Session, interview_id: UUID):
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

    if not rows:
        return None

    answered = db.execute(
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
    logger.info("[WS] connected interview_id=%s", interview_id)

    exists = db.execute(
        text("SELECT 1 FROM interviews WHERE id = :iid"),
        {"iid": interview_id},
    ).scalar()

    if not exists:
        await send_json_safe(websocket, {"type": "error", "message": "Interview not found"})
        await websocket.close()
        return

    connections[interview_id] = websocket

    # Greeting + first question (strict order)
    await handle_on_connect(db, interview_id, websocket)

    try:
        while True:
            msg = await websocket.receive_json()
            mtype = msg.get("type")

            if mtype == "candidate_text":
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

                score_task = score_turn.delay(turn.id)

                await send_json_safe(
                    websocket,
                    {
                        "type": "scoring_started",
                        "turn_id": turn.id,
                        "question_id": turn.question_id,
                        "task_id": score_task.id,
                    },
                )

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
                    db.execute(
                        text("UPDATE interviews SET status='completed' WHERE id=:iid"),
                        {"iid": interview_id},
                    )
                    db.commit()

            elif mtype == "ping":
                await send_json_safe(websocket, {"type": "pong"})

    except WebSocketDisconnect:
        connections.pop(interview_id, None)
        logger.info("[WS] disconnected interview_id=%s", interview_id)


async def handle_on_connect(db: Session, interview_id: UUID, ws: WebSocket):
    greeting = "Hi! We'll start your interview now. Please answer in detail."

    # save greeting turn
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

    # 1️⃣ Send greeting text immediately
    await send_json_safe(
        ws,
        {
            "type": "agent_message",
            "text": greeting,
        },
    )

    # 2️⃣ Try generating audio (SAFE)
    audio_path = None
    try:
        audio_bytes = await asyncio.to_thread(synthesize_speech, greeting)
        if audio_bytes:
            audio_path = await asyncio.to_thread(
                save_agent_audio_file, audio_bytes, str(interview_id)
            )
    except Exception as e:
        logger.exception("[TTS] Greeting synthesis failed: %s", e)

    # 3️⃣ Send greeting audio ONLY if it exists
    if audio_path:
        await send_json_safe(
            ws,
            {
                "type": "agent_message",
                "text": greeting,
                "audio_url": audio_path,
            },
        )

    # 4️⃣ Send first question
    first_q = get_next_question(db, interview_id)
    if first_q:
        await send_agent_question(db, interview_id, first_q, ws)
    else:
        await send_json_safe(
            ws,
            {
                "type": "agent_message",
                "text": "No questions configured.",
                "done": True,
            },
        )



async def send_agent_question(
    db: Session,
    interview_id: UUID,
    question: dict,
    ws: WebSocket,
):
    qid = question["id"]
    qtext = question["question_text"]

    db.add(
        InterviewTurn(
            interview_id=interview_id,
            question_id=qid,
            speaker="agent",
            transcript=qtext,
            started_at=datetime.utcnow(),
            ended_at=datetime.utcnow(),
        )
    )
    db.commit()

    # 1️⃣ Send question text
    await send_json_safe(
        ws,
        {
            "type": "agent_message",
            "question_id": qid,
            "text": qtext,
        },
    )
    
    # 2️⃣ Generate audio
    audio_bytes = await asyncio.to_thread(synthesize_speech, qtext)
    if audio_bytes:
        audio_path = await asyncio.to_thread(save_agent_audio_file, audio_bytes)
    
        # 🔥 SEND AUDIO AS SEPARATE EVENT
        await send_json_safe(
            ws,
            {
                "type": "agent_message",
                "role": "agent",
                "text": qtext,
                "question_id": qid,
                "audio_url": audio_path,
            },
        )

    
