# backend/services/live_scoring.py

def run_live_question_scoring(
    interview_id,
    question_id,
    transcript: str,
    question_text: str | None,
) -> dict:
    """
    Wrap your existing Phase 5 scoring logic here.
    For now you can leave a dummy implementation.
    """
    # TODO: replace with real scoring call
    return {
        "technical_score": 3,
        "communication_score": 4,
        "completeness_score": 3,
        "overall_score": 3.5,
        "ai_feedback": {
            "summary": "Good explanation, could include more detail.",
        },
        "llm_raw": "{... raw ...}",
        "section_scores": {},
        "per_question": {},
        "model_meta": {},
        "prompt_hash": None,
        "prompt_text": None,
        "weights": {},
    }
