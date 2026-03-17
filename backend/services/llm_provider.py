# backend/services/llm_provider.py
"""
Shared LLM provider helpers used across question generation, scoring, and follow-ups.
Currently provides the Gemini (Google AI Studio) caller.
"""
from __future__ import annotations

import asyncio
import json
import logging
import os
import re
from typing import Any, Dict, Optional, Tuple

import httpx

log = logging.getLogger(__name__)

# ---------------------
# Config
# ---------------------
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.0-flash")
GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models"


async def gemini_chat(
    system_prompt: str,
    user_prompt: str,
    api_key: Optional[str] = None,
    model: Optional[str] = None,
    temperature: float = 0.3,
    max_output_tokens: int = 1024,
    timeout: int = 60,
) -> Dict[str, Any]:
    """
    Call Google AI Studio Gemini API and return parsed JSON response.

    Returns dict with keys:
        - "parsed": the parsed JSON object (dict/list) or None
        - "raw": the raw text from the model
    """
    key = api_key or GEMINI_API_KEY
    mdl = model or GEMINI_MODEL

    if not key:
        raise RuntimeError("GEMINI_API_KEY not set")

    url = f"{GEMINI_BASE_URL}/{mdl}:generateContent?key={key}"

    payload: Dict[str, Any] = {
        "contents": [
            {
                "parts": [{"text": user_prompt}],
            }
        ],
        "generationConfig": {
            "responseMimeType": "application/json",
            "temperature": temperature,
            "maxOutputTokens": max_output_tokens,
        },
    }

    # Gemini supports systemInstruction at the top level
    if system_prompt:
        payload["systemInstruction"] = {
            "parts": [{"text": system_prompt}],
        }

    MAX_RETRIES = 4
    RETRY_DELAYS = [10, 20, 30, 60]  # seconds — Gemini free tier is 15 RPM

    async with httpx.AsyncClient(timeout=timeout) as client:
        for attempt in range(MAX_RETRIES + 1):
            r = await client.post(url, json=payload)
            if r.status_code == 429 and attempt < MAX_RETRIES:
                wait = RETRY_DELAYS[attempt]
                log.warning("Gemini 429 rate-limited, retrying in %ds (attempt %d/%d)", wait, attempt + 1, MAX_RETRIES)
                await asyncio.sleep(wait)
                continue
            r.raise_for_status()
            body = r.json()
            break

    # Extract text from response
    raw_text = ""
    try:
        raw_text = body["candidates"][0]["content"]["parts"][0]["text"]
    except (KeyError, IndexError, TypeError):
        log.warning("Gemini response missing expected structure: %s", body)
        return {"parsed": None, "raw": json.dumps(body)}

    # Parse JSON from the text
    parsed = _parse_json_robust(raw_text)
    return {"parsed": parsed, "raw": raw_text}


def _parse_json_robust(text: str) -> Optional[Any]:
    """Try multiple strategies to extract JSON from LLM output."""
    text = text.strip()

    # Strip markdown code fences if present
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*\n?", "", text)
        text = re.sub(r"\n?```\s*$", "", text)
        text = text.strip()

    # Direct parse
    try:
        return json.loads(text)
    except Exception:
        pass

    # Find first JSON object or array
    m = re.search(r"(\{[\s\S]*\}|\[[\s\S]*\])", text, flags=re.S)
    if m:
        try:
            return json.loads(m.group(1))
        except Exception:
            pass

    return None
