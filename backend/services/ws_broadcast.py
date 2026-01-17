# services/ws_broadcast.py

from typing import Dict, Any
from uuid import UUID
from fastapi import WebSocket
import logging

logger = logging.getLogger(__name__)

# 🔑 SINGLE SOURCE OF TRUTH
ACTIVE_CONNECTIONS: Dict[UUID, WebSocket] = {}


async def register_connection(interview_id: UUID, ws: WebSocket):
    ACTIVE_CONNECTIONS[interview_id] = ws
    logger.info("[WS] registered interview_id=%s", interview_id)


def unregister_connection(interview_id: UUID):
    ACTIVE_CONNECTIONS.pop(interview_id, None)
    logger.info("[WS] unregistered interview_id=%s", interview_id)


async def broadcast_to_interview(interview_id: UUID, payload: Dict[str, Any]):
    ws = ACTIVE_CONNECTIONS.get(interview_id)
    if not ws:
        logger.warning("[WS] no active connection for interview_id=%s", interview_id)
        return

    try:
        await ws.send_json(payload)
    except Exception:
        logger.exception("[WS] broadcast failed interview_id=%s", interview_id)
