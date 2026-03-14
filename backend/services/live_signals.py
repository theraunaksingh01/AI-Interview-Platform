from collections import defaultdict
from typing import Dict, Optional
import time
import re
import logging

logger = logging.getLogger(__name__)


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

STOPWORDS = {
    "a", "an", "and", "are", "as", "at", "be", "by", "do", "for", "from",
    "how", "in", "is", "it", "of", "on", "or", "that", "the", "to", "what",
    "when", "where", "which", "why", "with", "you", "your", "can", "could", "would",
    "should", "explain", "describe", "tell", "me", "about",
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

    # Generic relevance guard: if answer is long enough but has little overlap
    # with core question keywords, ask for a focused answer.
    q_tokens = {
        tok
        for tok in re.findall(r"[a-zA-Z]{3,}", q)
        if tok not in STOPWORDS
    }
    t_tokens = set(re.findall(r"[a-zA-Z]{3,}", t))

    if len(live_text.split()) >= 15 and len(q_tokens) >= 2:
        overlap = len(q_tokens & t_tokens)
        overlap_ratio = overlap / max(1, len(q_tokens))
        if overlap_ratio < 0.10:
            return {
                "interrupt": True,
                "reason": "off_topic",
                "followup": "Please focus on the question. Can you answer with one relevant example?",
            }

    return None


MIN_WORDS_BEFORE_INTERRUPT = 6
MIN_SECONDS_BEFORE_INTERRUPT = 3
INTERRUPT_COOLDOWN_SECONDS = 15
REPEAT_MESSAGE_BLOCK_SECONDS = 30

WEAK_PHRASES = (
    "i think",
    "not sure",
    "kind of",
    "something like",
    "etc",
)

def update_live_answer(
    interview_id: str,
    question_id: int,
    text: str,
    question_text: Optional[str] = None,
) -> dict:
    now = time.time()

    state = _LIVE_STATE[interview_id].setdefault(
        question_id,
        {
            "word_count": 0,
            "filler_count": 0,
            "last_text": "",
            "confidence": "medium",
            "low_conf_streak": 0,
            "started_at": now,
            "last_interrupt_at": 0,
            "last_interrupt_text": None,
        }
    )

    words = text.lower().split()
    word_count = len(words)
    fillers = sum(1 for w in words if w in FILLERS)
    filler_ratio = (fillers / word_count) if word_count else 0.0
    unique_ratio = (len(set(words)) / word_count) if word_count else 1.0
    lower_text = text.lower()
    has_weak_phrase = any(phrase in lower_text for phrase in WEAK_PHRASES)
    weak_phrase_hits = sum(1 for phrase in WEAK_PHRASES if phrase in lower_text)

    state["word_count"] = word_count
    state["filler_count"] += fillers
    state["last_text"] = text

    elapsed = now - state["started_at"]

    # -----------------------------
    # Confidence
    # -----------------------------
    if state["word_count"] < 8 or filler_ratio >= 0.20 or has_weak_phrase:
        confidence = "low"
        state["low_conf_streak"] += 1
    elif state["word_count"] < 20 or filler_ratio >= 0.10:
        confidence = "medium"
        # Decay streak slowly instead of instant reset
        state["low_conf_streak"] = max(0, state["low_conf_streak"] - 1)
    else:
        confidence = "high"
        state["low_conf_streak"] = max(0, state["low_conf_streak"] - 1)

    state["confidence"] = confidence

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
    if now - state["last_interrupt_at"] < INTERRUPT_COOLDOWN_SECONDS:
        return {
            "question_id": question_id,
            "confidence": confidence,
            "word_count": state["word_count"],
            "interrupt": False,
        }

    # 🔴 Real interrupt conditions

    # Current confidence is low — interrupt immediately
    if confidence == "low":
        interrupt = True
        interrupt_reason = "low_confidence"
        followup = "Can you explain that more clearly with an example?"

    # Low confidence was detected recently (streak survives medium/high via decay)
    if not interrupt and state["low_conf_streak"] >= 1:
        interrupt = True
        interrupt_reason = "low_confidence_recent"
        followup = "Your answer seems uncertain. Can you provide a concrete example?"

    # Repetitive/low-information speech
    if state["word_count"] >= 10 and unique_ratio < 0.50:
        interrupt = True
        interrupt_reason = "repetitive_speech"
        followup = "I heard repetition. Please give one clear, concrete point."

    # Vague answer with weak phrases
    if state["word_count"] >= 8 and weak_phrase_hits >= 2:
        interrupt = True
        interrupt_reason = "vague_answer"
        followup = "Please avoid vague terms and give one specific example."

    # High filler ratio in a substantial answer
    if state["word_count"] >= 10 and filler_ratio >= 0.15:
        interrupt = True
        interrupt_reason = "high_filler"
        followup = "Try to express your answer more directly. What is the key point?"

    # Long rambling answer
    if state["word_count"] > 80 and confidence != "high":
        interrupt = True
        interrupt_reason = "rambling"
        followup = "Let’s pause there. Can you summarize your main point?"

    if not interrupt:
        semantic_interrupt = _detect_semantic_drift(question_text, text)
        if semantic_interrupt:
            interrupt = True
            interrupt_reason = semantic_interrupt["reason"]
            followup = semantic_interrupt["followup"]

    # Prevent repeated identical prompt spam even after cooldown expires.
    if (
        interrupt
        and followup
        and followup == state.get("last_interrupt_text")
        and (now - state["last_interrupt_at"]) < REPEAT_MESSAGE_BLOCK_SECONDS
    ):
        interrupt = False
        interrupt_reason = None
        followup = None

    if interrupt:
        state["last_interrupt_at"] = now
        state["last_interrupt_text"] = followup

    print(
        f"[LIVE_SIGNALS] Q{question_id} words={state['word_count']} "
        f"conf={confidence} streak={state['low_conf_streak']} filler={filler_ratio:.2f} "
        f"unique={unique_ratio:.2f} weak={weak_phrase_hits} elapsed={elapsed:.1f}s "
        f"interrupt={interrupt} reason={interrupt_reason}"
    )

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

