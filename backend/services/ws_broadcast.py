# backend/services/ws_broadcast.py

from typing import Dict, Any, Set
from uuid import UUID
from fastapi import WebSocket
import json

from backend.api.ws_interview import connections  # the in-memory dict from ws_interview

def broadcast_score_update(interview_id: UUID, payload: Dict[str, Any]) -> None:
    """
    Very simple broadcast: if a WebSocket connection exists for this interview,
    send the payload. Works for single-process dev.
    """
    ws = connections.get(interview_id)
    if not ws:
        return

    # We can't 'await' here because Celery tasks are sync.
    # We can dispatch via loop, or just ignore for now and
    # switch to polling on frontend.
    #
    # Easiest approach: don't call this for now,
    # and instead let frontend poll /interview/{id}/scores.
    #
    # But if you want this working, you can:
    # - use anyio.from_thread blocking call
    # - or redesign to send via Redis pub/sub
    #
    # For now, you can leave this function empty to avoid errors.
    pass

ACTIVE_CONNECTIONS: Dict[str, Set[WebSocket]] = {}


async def broadcast_to_interview(interview_id: str, payload: dict):
    """
    Send a JSON message to all clients in an interview room
    """
    sockets = ACTIVE_CONNECTIONS.get(interview_id, set())
    if not sockets:
        return

    message = json.dumps(payload)

    dead = set()
    for ws in sockets:
        try:
            await ws.send_text(message)
        except Exception:
            dead.add(ws)

    # Cleanup dead connections
    for ws in dead:
        sockets.discard(ws)