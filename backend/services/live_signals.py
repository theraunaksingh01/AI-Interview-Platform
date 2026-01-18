from collections import defaultdict
from typing import Dict, Optional


# interview_id -> question_id -> live state
_LIVE_STATE: Dict[str, Dict[int, dict]] = defaultdict(dict)


FILLER_WORDS = {
    "uh", "um", "like", "you", "know",
    "basically", "actually", "so",
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


def update_live_answer(
    interview_id: str,
    question_id: int,
    text: str,
) -> dict:
    state = _LIVE_STATE[interview_id].setdefault(
        question_id,
        {
            "word_count": 0,
            "filler_count": 0,
            "last_text": "",
            "drift_score": 0,
        }
    )

    words = text.lower().split()
    state["word_count"] = len(words)
    state["last_text"] = text

    fillers = {
        "uh", "um", "like", "you", "know",
        "basically", "actually", "so"
    }

    state["filler_count"] += sum(1 for w in words if w in fillers)

    # 🔍 Semantic drift heuristic (simple but effective)
    if len(words) > 20 and state["filler_count"] > 5:
        state["drift_score"] += 1
    else:
        state["drift_score"] = max(0, state["drift_score"] - 1)

    confidence = "high"
    if state["word_count"] < 15:
        confidence = "low"
    elif state["drift_score"] > 2:
        confidence = "medium"

    interrupt = state["drift_score"] >= 4

    return {
        "question_id": question_id,
        "word_count": state["word_count"],
        "filler_count": state["filler_count"],
        "confidence": confidence,
        "interrupt": interrupt,
        "interrupt_reason": "semantic_drift" if interrupt else None,
        "followup": "Can you focus on the core concept of the question?"
        if interrupt
        else None,
    }



def clear_live_state(interview_id: str, question_id: int):
    """
    Clear live rolling state once a question is finalized.
    """
    _LIVE_STATE.get(interview_id, {}).pop(question_id, None)
