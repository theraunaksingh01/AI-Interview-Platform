KEY_TERMS = {
    "dsa": ["data structure", "algorithm"],
    "api": ["endpoint", "request", "response"],
}

def detect_semantic_drift(question_text: str, live_text: str):
    q = question_text.lower()
    t = live_text.lower()

    for key, expected in KEY_TERMS.items():
        if key in q:
            if not any(e in t for e in expected):
                return {
                    "interrupt": True,
                    "reason": f"Answer drifting from {key.upper()} definition",
                    "followup": f"Can you clearly explain what {key.upper()} means?"
                }

    return {"interrupt": False}
