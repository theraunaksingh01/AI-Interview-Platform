import requests
import os

OLLAMA_URL = os.getenv("OLLAMA_URL", "http://127.0.0.1:11434")
MODEL = os.getenv("OLLAMA_MODEL", "tinyllama")


def judge_live_answer(question: str, answer: str) -> dict:
    """
    Micro LLM judge for live interrupt decisions.
    Returns:
    {
        "interrupt": bool,
        "reason": str | None,
        "followup": str | None
    }
    """

    if not answer or len(answer.split()) < 15:
        return {"interrupt": False}

    prompt = f"""
You are a strict technical interviewer.

Question:
{question}

Candidate Answer:
{answer}

Evaluate quickly:
1. Is the answer incorrect?
2. Is it shallow or vague?
3. Is it off-topic?

Respond ONLY in JSON:

{{
  "interrupt": true/false,
  "reason": "wrong" | "shallow" | "off_topic" | null,
  "followup": "short interviewer follow-up question or null"
}}
"""

    try:
        response = requests.post(
            f"{OLLAMA_URL}/api/generate",
            json={
                "model": MODEL,
                "prompt": prompt,
                "stream": False,
            },
            timeout=5,
        )

        result = response.json()["response"]

        import json
        parsed = json.loads(result.strip())
        return parsed

    except Exception:
        return {"interrupt": False}