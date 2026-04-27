# backend/services/live_scoring.py
"""
Real-time per-turn scoring using the LLM provider.
Called by tasks/live_scoring.py (Celery) after each candidate turn.
"""
from __future__ import annotations

import asyncio
import json
import logging
import os
from typing import Optional

from sqlalchemy import text
from db.session import SessionLocal

log = logging.getLogger(__name__)

# Import scoring prompts and helpers from the main scorer
from tasks.score_interview import (
    SYSTEM_PROMPT,
    VOICE_USER_PROMPT,
    CODE_USER_PROMPT,
    VOICE_RUBRIC_KEYS,
    CODE_RUBRIC_KEYS,
    _llm_json as _score_llm_json,
    _normalize_to_rubric,
    _map_rubric_to_legacy,
    _rubric_overall,
)

# Lighter system prompt for live scoring (faster, fewer tokens)
LIVE_SYSTEM_PROMPT = (
    "You are an expert interviewer scoring a candidate's answer in real-time. "
    "Score strictly using the rubric. Return ONLY valid JSON. Be concise."
)

LIVE_VOICE_PROMPT = """Score this candidate answer.

Question: {question_text}

Answer:
---
{transcript}
---

Score each dimension 0-100:
1. technical_accuracy
2. problem_solving
3. communication_clarity
4. depth_of_knowledge
5. relevance

Return JSON:
{{"technical_accuracy": <0-100>, "problem_solving": <0-100>, "communication_clarity": <0-100>, "depth_of_knowledge": <0-100>, "relevance": <0-100>, "strengths": ["..."], "weaknesses": ["..."], "summary": "...", "hiring_signal": "strong_hire|hire|maybe|no_hire", "red_flags": []}}"""

LIVE_CODE_PROMPT = """Score this code submission.

Question: {question_text}

Code:
---
{transcript}
---

Score each dimension 0-100:
1. technical_accuracy
2. problem_solving
3. code_quality
4. completeness
5. relevance

Return JSON:
{{"technical_accuracy": <0-100>, "problem_solving": <0-100>, "code_quality": <0-100>, "completeness": <0-100>, "relevance": <0-100>, "strengths": ["..."], "weaknesses": ["..."], "summary": "...", "hiring_signal": "strong_hire|hire|maybe|no_hire", "red_flags": []}}"""


def _get_question_type(question_id) -> str:
    """Look up question type from DB."""
    if question_id is None:
        return "voice"
    db = SessionLocal()
    try:
        row = db.execute(
            text("SELECT type FROM interview_questions WHERE id = :qid"),
            {"qid": question_id},
        ).scalar()
        return (row or "voice").lower()
    finally:
        db.close()


def run_live_question_scoring(
    interview_id,
    question_id,
    transcript: str,
    question_text: str | None,
) -> dict:
    """
    Score a single candidate turn using the LLM.
    Falls back to heuristic scores on LLM failure.
    """
    qtype = _get_question_type(question_id)

    # Build the prompt
    # Truncate to keep prompt short enough for phi3:mini
    transcript_short = (transcript or "")[:800]
    log.info("[LIVE_SCORING] question_id=%s qtype=%s transcript_len=%s", 
             question_id, qtype, len(transcript or ""))
    question_short = (question_text or "N/A")[:200]

    if qtype == "code":
        prompt = LIVE_CODE_PROMPT.format(
            question_text=question_short,
            transcript=transcript_short,
        )
        rubric_keys = CODE_RUBRIC_KEYS
    else:
        prompt = LIVE_VOICE_PROMPT.format(
            question_text=question_short,
            transcript=transcript_short,
        )
        rubric_keys = VOICE_RUBRIC_KEYS

    # Call LLM (reuse the scoring module's _llm_json which handles provider routing)
    try:
        fb, raw = asyncio.run(_score_llm_json(prompt))
    except Exception as e:
        log.exception("[LIVE_SCORING] LLM call failed (%s) — using heuristic fallback", str(e))
        return _heuristic_fallback(transcript)

    # Normalize rubric
    fb = _normalize_to_rubric(fb)

    overall_check = _rubric_overall(fb, rubric_keys)
    if overall_check == 0 or overall_check is None:
        log.warning(
            "[LIVE_SCORING] LLM returned all-zero scores for q=%s - using heuristic",
            question_id,
        )
        return _heuristic_fallback(transcript)

    # Compute scores
    overall = _rubric_overall(fb, rubric_keys)
    tech, comm, comp = _map_rubric_to_legacy(fb, qtype)

    return {
        "technical_score": tech,
        "communication_score": comm,
        "completeness_score": comp,
        "overall_score": overall,
        "ai_feedback": fb,
        "llm_raw": raw,
        "section_scores": {
            "technical": tech,
            "communication": comm,
            "completeness": comp,
        },
        "per_question": {},
        "model_meta": {"provider": os.getenv("AI_PROVIDER", "stub")},
        "prompt_hash": None,
        "prompt_text": prompt[:500],
        "weights": {},
    }


def _heuristic_fallback(transcript: str) -> dict:
    """Simple word-count-based heuristic when LLM is unavailable."""
    words = len((transcript or "").split())
    base = min(60, 20 + words)  # longer answers get slightly higher base

    return {
        "technical_score": base,
        "communication_score": base + 5,
        "completeness_score": base - 5,
        "overall_score": base,
        "ai_feedback": {
            "summary": "Scored via heuristic fallback (LLM unavailable).",
            "strengths": [],
            "weaknesses": [],
            "red_flags": [],
            "hiring_signal": "maybe",
        },
        "llm_raw": "",
        "section_scores": {},
        "per_question": {},
        "model_meta": {"provider": "heuristic_fallback"},
        "prompt_hash": None,
        "prompt_text": None,
        "weights": {},
    }
