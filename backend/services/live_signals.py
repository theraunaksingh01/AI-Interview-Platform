from collections import defaultdict
from typing import Dict, Optional
import time


# interview_id -> question_id -> live state
_LIVE_STATE: Dict[str, Dict[int, dict]] = defaultdict(dict)


FILLERS = {
    "uh", "um", "like", "you", "know",
    "basically", "actually", "so", "i mean", "right",
    "well", "hmm", "ah", "er",
}


# VERY light semantic expectations (can be upgraded later)
KEY_TERMS = {
    "dsa": ["data structure", "algorithm"],
    "api": ["endpoint", "request", "response"],
    "database": ["table", "row", "column", "query"],
}


def _detect_semantic_drift(
    question_text: Optional[str],
    live_text: str,
) -> Optional[dict]:
    """
    Detect if candidate is drifting away from core topic.
    Returns interrupt payload or None.
    """

    if not question_text:
        return None

    q = question_text.lower()
    t = live_text.lower()

    for key, expected_terms in KEY_TERMS.items():
        if key in q:
            if not any(term in t for term in expected_terms):
                return {
                    "interrupt": True,
                    "reason": "semantic_drift",
                    "followup": f"Can you clearly explain what {key.upper()} means?",
                }

    return None


MIN_WORDS_BEFORE_INTERRUPT = 30
MIN_SECONDS_BEFORE_INTERRUPT = 5

def update_live_answer(
    interview_id: str,
    question_id: int,
    text: str,
) -> dict:
    now = time.time()

    state = _LIVE_STATE[interview_id].setdefault(
        question_id,
        {
            "word_count": 0,
            "filler_count": 0,
            "last_text": "",
            "low_conf_streak": 0,
            "started_at": now,
            "last_interrupt_at": 0,
        }
    )

    words = text.lower().split()
    fillers = sum(1 for w in words if w in FILLERS)

    state["word_count"] = len(words)
    state["filler_count"] += fillers
    state["last_text"] = text

    elapsed = now - state["started_at"]

    # -----------------------------
    # Confidence
    # -----------------------------
    if state["word_count"] < 20:
        confidence = "low"
        state["low_conf_streak"] += 1
    elif state["filler_count"] > 8:
        confidence = "medium"
    else:
        confidence = "high"
        state["low_conf_streak"] = 0

    interrupt = False
    interrupt_reason = None
    followup = None

    # 🚫 HARD GUARDS
    if elapsed < MIN_SECONDS_BEFORE_INTERRUPT:
        return {
            "question_id": question_id,
            "confidence": confidence,
            "word_count": state["word_count"],
            "interrupt": False,
        }

    if state["word_count"] < MIN_WORDS_BEFORE_INTERRUPT:
        return {
            "question_id": question_id,
            "confidence": confidence,
            "word_count": state["word_count"],
            "interrupt": False,
        }

    # ⏱ Cooldown
    if now - state["last_interrupt_at"] < 6:
        return {
            "question_id": question_id,
            "confidence": confidence,
            "word_count": state["word_count"],
            "interrupt": False,
        }

    # 🔴 Real interrupt conditions
    if state["low_conf_streak"] >= 4:
        interrupt = True
        interrupt_reason = "low_confidence"
        followup = "Can you be more specific or give a concrete example?"

    if state["word_count"] > 150 and confidence != "high":
        interrupt = True
        interrupt_reason = "rambling"
        followup = "Let’s pause there. Can you summarize your main point?"

    if interrupt:
        state["last_interrupt_at"] = now

    return {
        "question_id": question_id,
        "confidence": confidence,
        "word_count": state["word_count"],
        "interrupt": interrupt,
        "interrupt_reason": interrupt_reason,
        "followup": followup,
    }



def clear_live_state(interview_id: str, question_id: int):
    """
    Clear live rolling state once a question is finalized.
    """
    _LIVE_STATE.get(interview_id, {}).pop(question_id, None)
    

def get_final_confidence(interview_id: str, question_id: int) -> str:
    state = _LIVE_STATE.get(interview_id, {}).get(question_id)
    if not state:
        return "medium"
    return state.get("confidence", "medium")

