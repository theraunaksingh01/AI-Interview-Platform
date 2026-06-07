# backend/services/interruption_engine.py
"""
Smart Interruption Engine for Qued mock interviews.

Detects when a student's live answer needs a nudge and generates
a short contextual directive (not a question) via Claude Haiku.

Rules from spec:
- Max 1 interruption per question
- Max 3 interruptions per session
- Min 20s gap between interruptions
- Suppress if delivery interruption fired in last 15s
- Never fire in first 15s of an answer
- Directive must be under 15 words and never end with ?
"""
from __future__ import annotations

import logging
import os
import random
import re
import time
from dataclasses import dataclass, field
from typing import Dict, List, Optional

import anthropic

log = logging.getLogger(__name__)

# ─── Trigger types ────────────────────────────────────────────────────────────

TRIGGER_VAGUE        = "VAGUE"
TRIGGER_BREADTH_DUMP = "BREADTH_DUMP"
TRIGGER_STALLING     = "STALLING"
TRIGGER_SILENCE      = "SILENCE"
TRIGGER_RAMBLING     = "RAMBLING"

# Priority order: SILENCE > STALLING > VAGUE > BREADTH_DUMP > RAMBLING
TRIGGER_PRIORITY = {
    TRIGGER_SILENCE:      1,
    TRIGGER_STALLING:     2,
    TRIGGER_VAGUE:        3,
    TRIGGER_BREADTH_DUMP: 4,
    TRIGGER_RAMBLING:     5,
}

# ─── Tech keyword set for VAGUE detection ─────────────────────────────────────

TECH_KEYWORDS = {
    # Languages
    "python", "java", "javascript", "typescript", "golang", "rust", "cpp", "c++",
    # Data structures
    "array", "hashmap", "hashtable", "tree", "graph", "queue", "stack", "heap",
    "linked list", "trie", "bst", "binary search",
    # Databases
    "sql", "nosql", "postgres", "mysql", "mongodb", "redis", "cassandra",
    "index", "query", "schema", "transaction", "acid",
    # Systems
    "api", "rest", "grpc", "kafka", "rabbitmq", "nginx", "docker", "kubernetes",
    "microservices", "load balancer", "cdn", "cache", "sharding", "replication",
    # ML/AI
    "model", "neural", "gradient", "embedding", "transformer", "inference",
    "training", "dataset", "accuracy", "precision", "recall",
    # Concepts with numbers
    "o(n)", "o(log", "o(1)", "big o", "complexity", "latency", "throughput",
    "99th percentile", "p99", "sla", "rps", "qps",
}

FILLER_PHRASES = {
    "basically", "you know", "like", "actually", "sort of", "kind of",
    "um", "uh", "er", "hmm", "right", "okay", "so yeah", "i mean",
}

# ─── Fallback directives ──────────────────────────────────────────────────────

FALLBACK_DIRECTIVES: Dict[str, List[str]] = {
    TRIGGER_VAGUE: [
        "Be specific about that last part.",
        "Give me a concrete example of that.",
        "Walk me through the actual steps.",
    ],
    TRIGGER_BREADTH_DUMP: [
        "Pick one and go deeper on it.",
        "Focus on the most important one.",
        "Which of those matters most here?",
    ],
    TRIGGER_STALLING: [
        "Take a moment, then give me your core idea.",
        "What's the first concrete step?",
        "Start with what you're sure about.",
    ],
    TRIGGER_SILENCE: [
        "It's okay to think out loud.",
        "Start with what comes to mind first.",
        "Even a partial answer is fine — go ahead.",
    ],
    TRIGGER_RAMBLING: [
        "Try to wrap up your main point.",
        "Summarize that in one sentence.",
        "What's the key takeaway here?",
    ],
}

TRIGGER_DESCRIPTIONS: Dict[str, str] = {
    TRIGGER_VAGUE:        "being abstract without specific details or examples",
    TRIGGER_BREADTH_DUMP: "listing multiple items without going deep on any of them",
    TRIGGER_STALLING:     "using filler words and not making progress",
    TRIGGER_SILENCE:      "has gone silent and appears stuck",
    TRIGGER_RAMBLING:     "has been speaking for over 90 seconds and needs to conclude",
}

INTERRUPTION_SYSTEM_PROMPT = (
    "You are an interviewer. Generate a single short directive to redirect "
    "the candidate's current answer. Rules: "
    "1. DIRECTIVE ONLY — do not ask a question. "
    "2. Reference something specific from their transcript. "
    "3. Maximum 12 words. "
    "4. Guide them deeper into what they're already discussing. "
    "5. Do not introduce any new topic. "
    "6. NEVER end with a question mark. "
    "Respond with ONLY the directive text. Nothing else."
)


# ─── Session state ────────────────────────────────────────────────────────────

@dataclass
class InterruptionState:
    """Tracks interruption state per session."""
    session_interruptions: int = 0          # total this session (max 3)
    question_interruptions: int = 0         # this question (max 1)
    last_interruption_ts: float = 0.0       # unix timestamp
    last_delivery_ts: float = 0.0           # last delivery interruption
    question_start_ts: float = field(default_factory=time.time)
    answer_start_ts: float = 0.0
    silence_start_ts: float = 0.0           # when silence began
    fired_triggers: set = field(default_factory=set)  # triggers fired this question

    def reset_for_question(self) -> None:
        self.question_interruptions = 0
        self.answer_start_ts = 0.0
        self.silence_start_ts = 0.0
        self.fired_triggers = set()
        self.question_start_ts = time.time()


# ─── Trigger detection ────────────────────────────────────────────────────────

def detect_trigger(
    transcript: str,
    speaking_seconds: float,
    silence_seconds: float,
    state: InterruptionState,
) -> Optional[str]:
    """
    Evaluate all triggers. Returns the highest-priority trigger that fires,
    or None if no trigger applies.
    """
    # Never fire in first 15 seconds
    if speaking_seconds < 15:
        return None

    candidates = []

    words = transcript.lower().split()
    word_count = len(words)

    # ── SILENCE ──────────────────────────────────────────────────────────────
    if (
        silence_seconds >= 6
        and TRIGGER_SILENCE not in state.fired_triggers
        and word_count > 5  # must have started answering
    ):
        candidates.append(TRIGGER_SILENCE)

    # ── STALLING ─────────────────────────────────────────────────────────────
    recent = " ".join(words[-30:])  # last ~30 words
    filler_count = sum(1 for f in FILLER_PHRASES if f in recent)
    if (
        filler_count >= 3
        and speaking_seconds >= 15
        and TRIGGER_STALLING not in state.fired_triggers
    ):
        candidates.append(TRIGGER_STALLING)

    # ── VAGUE ─────────────────────────────────────────────────────────────────
    if speaking_seconds >= 30 and TRIGGER_VAGUE not in state.fired_triggers:
        last_30s_words = set(" ".join(words[-60:]).lower().split())
        has_tech = any(kw in last_30s_words or any(kw in w for w in last_30s_words) for kw in TECH_KEYWORDS)
        has_number = any(w.replace(".", "").replace(",", "").isdigit() for w in last_30s_words)
        if not has_tech and not has_number:
            candidates.append(TRIGGER_VAGUE)

    # ── BREADTH_DUMP ──────────────────────────────────────────────────────────
    if (
        speaking_seconds >= 20
        and TRIGGER_BREADTH_DUMP not in state.fired_triggers
    ):
        # Count distinct items listed in recent 20s window (~40 words)
        recent_words = words[-40:]
        recent_text = " ".join(recent_words)
        # Simple heuristic: count "and" + comma-separated items
        comma_items = recent_text.count(",")
        and_count = recent_words.count("and")
        if comma_items >= 3 or and_count >= 4:
            candidates.append(TRIGGER_BREADTH_DUMP)

    # ── RAMBLING ─────────────────────────────────────────────────────────────
    if (
        speaking_seconds >= 90
        and TRIGGER_RAMBLING not in state.fired_triggers
    ):
        candidates.append(TRIGGER_RAMBLING)

    if not candidates:
        return None

    # Return highest priority candidate
    return min(candidates, key=lambda t: TRIGGER_PRIORITY.get(t, 99))


# ─── Cap checking ─────────────────────────────────────────────────────────────

def can_interrupt(state: InterruptionState) -> bool:
    """Check all global caps and timing rules."""
    now = time.time()

    if state.session_interruptions >= 3:
        return False
    if state.question_interruptions >= 1:
        return False
    if now - state.last_interruption_ts < 20:
        return False
    if now - state.last_delivery_ts < 15:
        return False
    return True


# ─── Directive generation ─────────────────────────────────────────────────────

def generate_directive(
    trigger: str,
    question_text: str,
    transcript_so_far: str,
    role: str = "Software Engineer",
    company: str = "the company",
) -> str:
    """
    Generate a contextual directive via Claude Haiku.
    Falls back to predefined directive if Claude fails.
    """
    api_key = os.getenv("ANTHROPIC_API_KEY", "").strip()
    if not api_key:
        return _fallback_directive(trigger)

    user_prompt = (
        f"You are a {company} interviewer for a {role} position.\n"
        f"Trigger context: The candidate is {TRIGGER_DESCRIPTIONS[trigger]}.\n\n"
        f"Question: {question_text[:300]}\n"
        f"Candidate's answer so far: {transcript_so_far[:500]}\n\n"
        f"Generate ONE short directive (max 12 words, no question mark)."
    )

    try:
        client = anthropic.Anthropic(api_key=api_key)
        response = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=60,
            timeout=4,  # tight timeout — interruptions must be fast
            messages=[
                {"role": "user", "content": INTERRUPTION_SYSTEM_PROMPT + "\n\n" + user_prompt}
            ],
        )
        raw = ""
        for block in getattr(response, "content", []):
            if getattr(block, "type", "") == "text":
                raw += getattr(block, "text", "")

        directive = raw.strip().strip('"').strip("'")

        # Validation rules from spec
        if not directive:
            return _fallback_directive(trigger)
        if directive.endswith("?"):
            # Remove question mark and use as-is, or fallback
            directive = directive.rstrip("?").strip()
            if not directive:
                return _fallback_directive(trigger)

        word_count = len(directive.split())
        if word_count > 15:
            # Truncate to first sentence
            sentences = re.split(r"[.!]", directive)
            directive = sentences[0].strip() if sentences else directive
            if len(directive.split()) > 15:
                return _fallback_directive(trigger)

        return directive

    except Exception as e:
        log.warning("[INTERRUPTION] Claude call failed: %s — using fallback", e)
        return _fallback_directive(trigger)


def _fallback_directive(trigger: str) -> str:
    options = FALLBACK_DIRECTIVES.get(trigger, FALLBACK_DIRECTIVES[TRIGGER_VAGUE])
    return random.choice(options)


# ─── Delivery interruption check ──────────────────────────────────────────────

def check_delivery_interruption(
    wpm: float,
    filler_count_30s: int,
    state: InterruptionState,
) -> Optional[str]:
    """
    Check delivery-based nudges (WPM, fillers).
    These are predefined — no Claude call needed.
    Returns directive text or None.
    """
    now = time.time()

    # Suppress if content interruption fired recently
    if now - state.last_interruption_ts < 15:
        return None

    if wpm > 170:
        state.last_delivery_ts = now
        return "You're speaking a bit fast — try to slow down."
    if wpm < 90 and wpm > 0:
        state.last_delivery_ts = now
        return "You can pick up the pace a little."
    if filler_count_30s >= 5:
        state.last_delivery_ts = now
        return "Watch the filler words — try pausing instead."

    return None


# ─── Main entry point ─────────────────────────────────────────────────────────

def process_transcript_chunk(
    transcript: str,
    speaking_seconds: float,
    silence_seconds: float,
    wpm: float,
    filler_count_30s: int,
    question_text: str,
    role: str,
    company: str,
    state: InterruptionState,
) -> Optional[Dict]:
    """
    Main function called from the WebSocket handler on each transcript chunk.
    Returns interruption dict or None.

    Return format:
    {
        "type": "content" | "delivery",
        "trigger": "VAGUE" | ...,
        "text": "directive text here",
        "is_fallback": bool
    }
    """
    now = time.time()

    # ── Delivery interruption first ───────────────────────────────────────────
    delivery = check_delivery_interruption(wpm, filler_count_30s, state)
    if delivery:
        return {
            "type": "delivery",
            "trigger": "DELIVERY",
            "text": delivery,
            "is_fallback": True,
        }

    # ── Content interruption ──────────────────────────────────────────────────
    if not can_interrupt(state):
        return None

    trigger = detect_trigger(transcript, speaking_seconds, silence_seconds, state)
    if not trigger:
        return None

    # Generate directive
    is_fallback = False
    text = generate_directive(trigger, question_text, transcript, role, company)
    if text in [d for opts in FALLBACK_DIRECTIVES.values() for d in opts]:
        is_fallback = True

    # Update state
    state.session_interruptions += 1
    state.question_interruptions += 1
    state.last_interruption_ts = now
    state.fired_triggers.add(trigger)

    return {
        "type": "content",
        "trigger": trigger,
        "text": text,
        "is_fallback": is_fallback,
    }