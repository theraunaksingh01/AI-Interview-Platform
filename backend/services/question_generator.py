# backend/services/question_generator.py
"""
Question generator with rubric-aware balancing.
Ensures interview questions are distributed proportionally to rubric dimension weights.
"""

from typing import List, Dict, Any, Optional
from dataclasses import dataclass


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
