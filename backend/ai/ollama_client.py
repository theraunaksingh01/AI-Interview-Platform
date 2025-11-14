# backend/ai/ollama_client.py
import os
import requests
from typing import Any, Dict

OLLAMA_URL = os.getenv("OLLAMA_URL", "http://127.0.0.1:11434")
OLLAMA_GENERATE_PATH = "/api/generate"
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "tinyllama")  

class OllamaError(Exception):
    pass

def generate_json(prompt: str, model: str = None, timeout: int = 60) -> Dict[str, Any]:
    """
    Calls Ollama /api/generate with format=json to ensure we get valid JSON output.
    Returns parsed JSON from the model response (the 'response' field or full body).
    """
    model = model or OLLAMA_MODEL
    url = f"{OLLAMA_URL}{OLLAMA_GENERATE_PATH}"
    payload = {
        "model": model,
        "prompt": prompt,
        "format": "json",
        "stream": False,
        # optionally tweak inference options here
        "options": {"temperature": 0.7, "top_k": 50}
    }

    try:
        resp = requests.post(url, json=payload, timeout=timeout)
        resp.raise_for_status()
    except Exception as e:
        raise OllamaError(f"Request to Ollama failed: {e}")

    # Ollama returns a JSON body. If it includes a 'response' string containing JSON,
    # try to parse that; otherwise return the whole JSON body.
    body = resp.json()
    # Common pattern: {"model": "...", "created_at": "...", "response": "{ ... }", "done": true}
    if isinstance(body.get("response"), str):
        import json
        try:
            parsed = json.loads(body["response"])
            return parsed
        except Exception:
            # If response is already a JSON object (rare), or not parseable, return raw
            return body
    return body
