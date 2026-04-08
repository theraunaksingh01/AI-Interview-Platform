# backend/services/question_generator.py
"""
Question generator with rubric-aware balancing.
Ensures interview questions are distributed proportionally to rubric dimension weights.
"""

from typing import List, Dict, Any, Optional
from dataclasses import dataclass
import asyncio
import os

from services.llm_provider import gemini_chat


@dataclass
class QuestionSpec:
    dimension: str
    question_type: str  # "voice" or "code"
    count: int


def balance_questions_by_rubric(
    rubric_weights: Dict[str, Dict[str, Any]],
    total_questions: int = 8,
) -> Dict[str, int]:
    """
    Determine question count per rubric dimension based on weights.

    Example:
        rubric = {
            "dsa": {"label": "DSA", "weight": 30},
            "system_design": {"label": "System Design", "weight": 25},
            "communication": {"label": "Communication", "weight": 20},
            "problem_solving": {"label": "Problem Solving", "weight": 15},
            "culture_fit": {"label": "Culture Fit", "weight": 10}
        }

        With total_questions=8:
        - dsa: 30% of 8 = 2.4 → 2 questions
        - system_design: 25% of 8 = 2.0 → 2 questions
        - communication: 20% of 8 = 1.6 → 2 questions
        - problem_solving: 15% of 8 = 1.2 → 1 question
        - culture_fit: 10% of 8 = 0.8 → 1 question

    Args:
        rubric_weights: Rubric config with dimension weights
        total_questions: Total interview questions to generate

    Returns:
        Dict mapping dimension_key to question count
    """
    if not rubric_weights or total_questions < 1:
        return {}

    question_counts = {}
    allocated = 0

    # First pass: allocate proportional questions
    for dimension_key, config in rubric_weights.items():
        weight = config.get("weight", 0)
        count = round((weight / 100) * total_questions)
        question_counts[dimension_key] = max(1, count)  # At least 1 per dimension
        allocated += question_counts[dimension_key]

    # Second pass: adjust for rounding errors
    if allocated != total_questions:
        diff = total_questions - allocated
        dimensions = list(question_counts.keys())

        if diff > 0:
            # Add questions to dimensions with highest weights
            sorted_dims = sorted(
                dimensions,
                key=lambda d: rubric_weights[d].get("weight", 0),
                reverse=True
            )
            for i in range(abs(diff)):
                dim = sorted_dims[i % len(sorted_dims)]
                question_counts[dim] += 1
        elif diff < 0:
            # Remove questions from dimensions with lowest weights
            sorted_dims = sorted(
                dimensions,
                key=lambda d: rubric_weights[d].get("weight", 0)
            )
            for i in range(abs(diff)):
                dim = sorted_dims[i % len(sorted_dims)]
                if question_counts[dim] > 1:
                    question_counts[dim] -= 1

    return question_counts


def get_ai_scorer_prompt_with_rubric(
    rubric_weights: Dict[str, Dict[str, Any]],
    question: str,
    answer: str,
) -> str:
    """
    Generate AI scorer prompt with rubric context.

    Args:
        rubric_weights: Rubric config
        question: Interview question
        answer: Candidate's answer

    Returns:
        Prompt for Claude/LLM to score answer against rubric
    """
    rubric_context = "\n".join([
        f"- {v['label']} ({v['weight']}%): {v.get('description', '')}"
        for k, v in rubric_weights.items()
    ])

    prompt = f"""You are evaluating a candidate's interview answer.

The role's scoring rubric is:
{rubric_context}

Score the answer on each dimension from 0-10. Return strict JSON with this structure:
{{
  "dimension_scores": {{
    "{{dimension_key}}": 7.2,
    ...
  }},
  "overall_feedback": "...",
  "strengths": ["...", "..."],
  "improvements": ["...", "..."]
}}

Question: {question}

Candidate's answer:
{answer}

Return ONLY valid JSON, no other text."""

    return prompt


def generate_mock_questions(
    role_target: str,
    seniority: str,
    focus_area: str,
    count: int = 6,
) -> List[Dict[str, str]]:
    """Generate mock interview questions from role params without using JD/resume."""
    focus_map = {
        "dsa": "Focus heavily on data structures and algorithms problems.",
        "system_design": "Focus on system design and architecture questions.",
        "behavioral": "Focus on behavioral and situational questions using STAR method.",
        "mixed": "Mix of DSA (2), system design (2), and behavioral (2) questions.",
    }
    focus_instruction = focus_map.get((focus_area or "mixed").lower(), focus_map["mixed"])

    prompt = f"""Generate {count} interview questions for a {seniority} {role_target} position.
{focus_instruction}
For each question return JSON with: text, type (dsa/system_design/behavioral), difficulty (easy/medium/hard).
Return only a JSON array, no markdown, no explanation.
Example: [{{"text": "...", "type": "dsa", "difficulty": "medium"}}]"""

    fallback = [
        {"text": f"Tell me about yourself and your experience as a {role_target}.", "type": "behavioral", "difficulty": "easy"},
        {"text": "Describe a challenging technical problem you solved recently.", "type": "behavioral", "difficulty": "medium"},
        {"text": "Given an array of integers, find two numbers that add up to a target sum.", "type": "dsa", "difficulty": "easy"},
        {"text": "Design a URL shortening service like bit.ly.", "type": "system_design", "difficulty": "medium"},
        {"text": "Explain the difference between SQL and NoSQL databases.", "type": "behavioral", "difficulty": "easy"},
        {"text": "How would you optimize a slow database query?", "type": "system_design", "difficulty": "medium"},
    ]

    # Sort: voice/system-design first, actual coding last.
    def sort_key(q: Dict[str, str]) -> int:
        if str(q.get("type", "")).lower() in ("dsa", "coding", "code"):
            return 1
        return 0

    fallback.sort(key=sort_key)

    if not os.getenv("GEMINI_API_KEY"):
        return fallback[:count]

    try:
        result = asyncio.run(
            asyncio.wait_for(
                gemini_chat(
                    system_prompt="You are a senior technical interviewer. Return strict JSON only.",
                    user_prompt=prompt,
                    temperature=0.3,
                    max_output_tokens=1000,
                    timeout=8,
                ),
                timeout=10,
            )
        )
        parsed = result.get("parsed")
        if not isinstance(parsed, list):
            return fallback

        cleaned: List[Dict[str, str]] = []
        for item in parsed:
            if not isinstance(item, dict):
                continue
            text = str(item.get("text") or "").strip()
            q_type = str(item.get("type") or "behavioral").strip().lower()
            difficulty = str(item.get("difficulty") or "medium").strip().lower()
            if not text:
                continue
            if q_type not in {"dsa", "system_design", "behavioral"}:
                q_type = "behavioral"
            if difficulty not in {"easy", "medium", "hard"}:
                difficulty = "medium"
            cleaned.append({"text": text, "type": q_type, "difficulty": difficulty})

        if cleaned:
            cleaned.sort(key=sort_key)
            return cleaned[:count]
        return fallback[:count]
    except Exception:
        return fallback[:count]
