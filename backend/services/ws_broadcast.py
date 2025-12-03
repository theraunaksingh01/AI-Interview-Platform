# backend/services/ws_broadcast.py

from typing import Dict, Any
from uuid import UUID

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
