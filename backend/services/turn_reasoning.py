# services/turn_reasoning.py

from typing import Literal

Decision = Literal["probe", "next", "end"]


def decide_turn_action(
    transcript: str,
    confidence: str,
) -> Decision:
    """
    Decide what to do after candidate finishes answer.
    """

    if not transcript or len(transcript.split()) < 20:
        return "probe"

    if confidence == "high":
        return "next"

    if confidence == "low":
        return "probe"

    return "next"
