# ============================================================
 
"""
Interruption directive generation endpoint.
Called by the frontend when a trigger fires during live answer.
Returns a short contextual directive (not a question).
"""
 
from __future__ import annotations
 
import logging
import os
from typing import Optional
 
from fastapi import APIRouter
from pydantic import BaseModel
 
from services.interruption_engine import (
    generate_directive,
    FALLBACK_DIRECTIVES,
    TRIGGER_VAGUE,
)
import random
 
log = logging.getLogger(__name__)
 
router = APIRouter(prefix="/api/interview", tags=["interruption"])
 
 
class InterruptionRequest(BaseModel):
    question: str
    transcript_so_far: str
    trigger_type: str
    role: str = "Software Engineer"
    company: str = "the company"
 
 
@router.post("/interruption")
def get_interruption_directive(payload: InterruptionRequest) -> dict:
    """
    Generate a contextual interruption directive via Claude Haiku.
    Falls back to predefined if Claude fails.
    """
    trigger = payload.trigger_type.upper()
 
    # Validate trigger type
    valid_triggers = {"VAGUE", "BREADTH_DUMP", "STALLING", "SILENCE", "RAMBLING"}
    if trigger not in valid_triggers:
        trigger = TRIGGER_VAGUE
 
    directive = generate_directive(
        trigger=trigger,
        question_text=payload.question[:400],
        transcript_so_far=payload.transcript_so_far[:600],
        role=payload.role,
        company=payload.company,
    )
 
    # Check if it was a fallback
    fallbacks = FALLBACK_DIRECTIVES.get(trigger, [])
    is_fallback = directive in fallbacks
 
    log.info(
        "[INTERRUPTION] trigger=%s fallback=%s directive=%r",
        trigger, is_fallback, directive[:60],
    )
 
    return {
        "directive": directive,
        "trigger": trigger,
        "is_fallback": is_fallback,
    }
