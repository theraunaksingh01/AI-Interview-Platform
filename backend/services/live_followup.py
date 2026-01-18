# services/live_followup.py

from typing import Optional, Dict

FOLLOWUP_COOLDOWN_SECONDS = 6


def decide_followup(
    confidence: str,
    word_count: int,
    last_text: str,
) -> Optional[Dict]:
    """
    Decide whether AI should ask a follow-up or interrupt.
    Returns payload or None.
    """

    # 🔴 Very weak / stuck
    if confidence == "low" and word_count < 20:
        return {
            "type": "ai_interrupt",
            "text": "Could you explain that more simply?",
            "reason": "low_confidence",
        }

    # 🟡 Medium confidence → clarify
    if confidence == "medium" and word_count > 40:
        return {
            "type": "ai_interrupt",
            "text": "Can you give a concrete example?",
            "reason": "needs_example",
        }

    # 🟢 High confidence → probe deeper
    if confidence == "high" and word_count > 60:
        return {
            "type": "ai_interrupt",
            "text": "Can you go deeper into the trade-offs involved?",
            "reason": "probe_depth",
        }

    
    return None
