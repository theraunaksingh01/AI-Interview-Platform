# backend/services/live_interrupt.py

from typing import Dict, Optional

# interview_id:question_id → rolling text buffer
LIVE_TRANSCRIPTS: Dict[str, str] = {}

MAX_WORDS = 120  # ~45–60 seconds speaking


def _key(interview_id: str, question_id: int) -> str:
    return f"{interview_id}:{question_id}"


def append_text(interview_id: str, question_id: int, text: str) -> None:
    key = _key(interview_id, question_id)
    prev = LIVE_TRANSCRIPTS.get(key, "")
    merged = (prev + " " + text).strip()

    # keep last ~2000 chars
    LIVE_TRANSCRIPTS[key] = merged[-2000:]


def should_interrupt(
    interview_id: str,
    question_id: int,
    question_text: str,
) -> Optional[str]:
    key = _key(interview_id, question_id)
    transcript = LIVE_TRANSCRIPTS.get(key, "")

    if not transcript:
        return None

    words = transcript.split()

    # 1️⃣ Too long / rambling
    if len(words) > MAX_WORDS:
        return "Let me pause you there. Can you summarize your main point?"

    # 2️⃣ Vagueness
    vague = ["basically", "kind of", "something like", "etc"]
    if any(v in transcript.lower() for v in vague):
        return "Can you be more specific?"

    # 3️⃣ Question-specific probe (example)
    if "binary search" in question_text.lower():
        if "sorted" not in transcript.lower():
            return "Binary search works on which type of array?"

    return None


def clear_live(interview_id: str, question_id: int) -> None:
    LIVE_TRANSCRIPTS.pop(_key(interview_id, question_id), None)
