# app/api/ws_interview.py

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Dict, Any
from uuid import UUID
from datetime import datetime

from db.session import get_db
from sqlalchemy import text
from db.models import InterviewTurn

from tasks.live_scoring import score_turn


router = APIRouter()

# simple in-memory connection registry (ok for single process dev)
connections: Dict[UUID, WebSocket] = {}

async def send_json_safe(ws: WebSocket, payload: Dict[str, Any]) -> None:
    try:
        await ws.send_json(payload)
    except RuntimeError:
        # connection is probably closed
        pass

def get_next_question(db: Session, interview_id: UUID):
    """
    Fetch the next unanswered question for this interview using plain SQL.
    Returns a dict: {"id": <int>, "question_text": <str>} or None.
    """
    # Get all questions for this interview
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

    # get IDs of questions already answered by candidate
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

    # pick the first question not yet answered
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
    # accept the socket
    await websocket.accept()

    # validate interview using plain SQL (no ORM Interview class)
    row = db.execute(
        text("SELECT 1 FROM interviews WHERE id = :iid"),
        {"iid": interview_id},
    ).scalar()

    if row is None:
        await websocket.send_json({"type": "error", "message": "Interview not found"})
        await websocket.close()
        return

    connections[interview_id] = websocket

    # on connect: send greeting + first question
    await handle_on_connect(db, interview_id, websocket)

    try:
        while True:
            message = await websocket.receive_json()
            mtype = message.get("type")

            if mtype == "candidate_text":
                # candidate finished answering a question
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
                # unrecognized message type
                await send_json_safe(
                    websocket,
                    {"type": "error", "message": f"Unknown message type: {mtype}"},
                )

    except WebSocketDisconnect:
        # cleanup
        connections.pop(interview_id, None)


async def handle_on_connect(
    db: Session,
    interview_id: UUID,
    ws: WebSocket,
) -> None:
    """Send initial greeting + first question."""
    greeting_text = "Hi! We'll start your interview now. Please answer in detail."

    greeting_turn = InterviewTurn(
        interview_id=interview_id,
        speaker="agent",
        transcript=greeting_text,
        started_at=datetime.utcnow(),
        ended_at=datetime.utcnow(),
    )
    db.add(greeting_turn)
    db.commit()

    await send_json_safe(
        ws,
        {
            "type": "agent_message",
            "role": "agent",
            "text": greeting_text,
        },
    )

    # first question
    first_q = get_next_question(db, interview_id)
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
    Create an 'agent' turn for this question and send it to the client.
    `question` is a dict with keys: id, question_text
    """
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

    await send_json_safe(
        ws,
        {
            "type": "agent_message",
            "role": "agent",
            "question_id": question["id"],
            "text": question["question_text"],
        },
    )
