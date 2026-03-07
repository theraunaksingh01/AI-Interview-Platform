# services/semantic_evaluator.py

import subprocess
import json
from typing import Dict


OLLAMA_MODEL = "tinyllama"


def call_ollama(prompt: str) -> str:
    """
    Calls local Ollama model and returns raw output.
    """
    result = subprocess.run(
        ["ollama", "run", OLLAMA_MODEL],
        input=prompt.encode(),
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )

    return result.stdout.decode().strip()


def build_prompt(role_title: str, question: str, transcript: str) -> str:
    return f"""
You are a strict technical interviewer.

Role: {role_title}

Question:
{question}

Candidate Answer:
{transcript}

Evaluate the answer strictly on a 0-5 scale for each category.

Return ONLY valid JSON with this exact structure:

{{
  "rubric_scores": {{
    "concept_understanding": int,
    "problem_solving": int,
    "technical_accuracy": int,
    "clarity": int
  }},
  "strengths": [string],
  "weaknesses": [string],
  "overall_score": float
}}

Do not include explanations.
Do not include markdown.
Return JSON only.
"""


def evaluate_answer(
    role_title: str,
    question: str,
    transcript: str,
) -> Dict:

    if not transcript.strip():
        return {
            "rubric_scores": {
                "concept_understanding": 0,
                "problem_solving": 0,
                "technical_accuracy": 0,
                "clarity": 0,
            },
            "strengths": [],
            "weaknesses": ["No answer provided"],
            "overall_score": 0.0,
        }

    prompt = build_prompt(role_title, question, transcript)

    raw_output = call_ollama(prompt)

    try:
        parsed = json.loads(raw_output)
        return parsed
    except Exception:
        # Fallback if model output invalid JSON
        return {
            "rubric_scores": {
                "concept_understanding": 2,
                "problem_solving": 2,
                "technical_accuracy": 2,
                "clarity": 2,
            },
            "strengths": [],
            "weaknesses": ["Evaluation parsing failed"],
            "overall_score": 2.0,
        }