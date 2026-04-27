"""
Anti-Cheat Scoring Engine - Server-side scoring algorithm
Implements the full spec from AI_INTERVIEW_PLATFORM.md Section 5.2

Signal categories are weighted differently:
- Category A (timing): 2.0x multiplier
- Category B (content): 1.5x multiplier
- Category C (browser): 2.5x multiplier (highest risk)
- Category D (consistency): 1.8x multiplier
"""

from typing import List, Dict, Any, Tuple, Optional
from dataclasses import dataclass
import statistics
import json
import logging
import os
import re

import httpx
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from core.config import settings
import asyncio


@dataclass
class SignalWeight:
    """Weight mapping for each signal"""
    base_weight: float  # 0-50 base points for signal
    category: str  # A, B, C, D


# Signal registry with base weights
SIGNAL_REGISTRY: Dict[str, SignalWeight] = {
    # Category A - Timing Signals
    "TIME_TO_FIRST_WORD": SignalWeight(base_weight=15, category="A"),
    "HIGH_DELIVERY_SPEED": SignalWeight(base_weight=12, category="A"),
    "NO_HESITATION_PATTERN": SignalWeight(base_weight=14, category="A"),
    "UNIFORM_ANSWER_TIMING": SignalWeight(base_weight=10, category="A"),
    "CODE_TIME_TO_FIRST_KEYSTROKE": SignalWeight(base_weight=13, category="A"),

    # Category B - Content Entropy Signals
    "HIGH_PERPLEXITY_SCORE": SignalWeight(base_weight=12, category="B"),
    "LOW_LEXICAL_DIVERSITY": SignalWeight(base_weight=10, category="B"),
    "UNIFORM_SENTENCE_STRUCTURE": SignalWeight(base_weight=9, category="B"),
    "FILLER_WORD_ABSENCE": SignalWeight(base_weight=8, category="B"),
    "PERFECT_ANSWER_COMPLETENESS": SignalWeight(base_weight=5, category="B"),

    # Category C - Browser/Environment Signals
    "TAB_FOCUS_LOST": SignalWeight(base_weight=15, category="C"),
    "PASTE_EVENT": SignalWeight(base_weight=14, category="C"),
    "KEYSTROKE_GAP": SignalWeight(base_weight=12, category="C"),
    "UNUSUAL_IDE_INPUT": SignalWeight(base_weight=16, category="C"),
    "SCREEN_SHARE_ACTIVE": SignalWeight(base_weight=11, category="C"),

    # Category D - Cross-Answer Consistency Signals
    "VOCABULARY_LEVEL_SHIFT": SignalWeight(base_weight=13, category="D"),
    "ANSWER_QUALITY_CLIFF": SignalWeight(base_weight=11, category="D"),
    "RESUME_ANSWER_INCONSISTENCY": SignalWeight(base_weight=14, category="D"),
    "FOLLOW_UP_DEGRADATION": SignalWeight(base_weight=12, category="D"),
}


class CheatScoringEngine:
    """
    Computes cheat probability scores for answers and sessions.
    Per-answer scoring gives nuance: candidate might use AI for code but not behavior
    """

    # Category multipliers per spec
    CATEGORY_MULTIPLIERS = {
        "A": 2.0,  # Timing signals (highest multiplier)
        "B": 1.5,  # Content entropy
        "C": 2.5,  # Browser signals (highest risk)
        "D": 1.8,  # Consistency signals
    }

    # Risk level bands
    RISK_LEVELS = {
        (0, 20): ("Low Risk", "low", "green"),
        (21, 45): ("Medium Risk", "medium", "yellow"),
        (46, 70): ("High Risk", "high", "orange"),
        (71, 100): ("Very High Risk", "very_high", "red"),
    }

    def __init__(self):
        pass

    def score_answer(
        self,
        answer_id: int,
        signals: List[Dict[str, Any]],
        transcript: str = "",
        code: str = "",
        answer_type: str = "behavioral",  # behavioral, dsa, system_design
    ) -> Tuple[float, str, Dict[str, Any]]:
        """
        Score a single answer for cheat probability.

        Args:
            answer_id: UUID of the answer
            signals: List of CheatSignal objects (dicts) collected during answer
            transcript: Full transcript of voice response
            code: Code submission if coding question
            answer_type: Type of answer (affects weighting in session score)

        Returns:
            (cheat_score: 0-100, risk_level: str, details: dict)
        """
        cheat_score = 0.0
        fired_signals = []

        # Step 1: Score all detected signals
        for signal in signals:
            signal_type = signal.get("signal_type")
            signal_category = signal.get("signal_category")
            weight_info = SIGNAL_REGISTRY.get(signal_type)

            if not weight_info:
                continue

            # Get signal weight info
            base_weight = weight_info.base_weight
            multiplier = self.CATEGORY_MULTIPLIERS.get(signal_category, 1.0)

            # Weighted score contribution
            signal_score = base_weight * multiplier
            cheat_score += signal_score

            fired_signals.append({
                "signal_type": signal_type,
                "category": signal_category,
                "base_weight": base_weight,
                "multiplier": multiplier,
                "contribution": signal_score,
                "details": signal.get("details", {}),
            })

        # Step 2: Content-based analysis (Category B - requires transcript)
        if transcript:
            content_signals = self._analyze_content(transcript)
            for csignal in content_signals:
                weight_info = SIGNAL_REGISTRY.get(csignal["signal_type"])
                if weight_info:
                    base_weight = weight_info.base_weight
                    multiplier = self.CATEGORY_MULTIPLIERS["B"]  # Category B
                    signal_score = base_weight * multiplier * (csignal.get("confidence", 1.0))
                    cheat_score += signal_score
                    fired_signals.append({
                        **csignal,
                        "base_weight": base_weight,
                        "multiplier": multiplier,
                        "contribution": signal_score,
                    })

        # Cap score at 100
        cheat_score = min(cheat_score, 100.0)

        # Step 3: Determine risk level
        risk_level, risk_key, color = self._get_risk_level(cheat_score)

        details = {
            "cheat_score": round(cheat_score, 2),
            "risk_level": risk_level,
            "risk_key": risk_key,
            "color": color,
            "answer_type": answer_type,
            "fired_signals": fired_signals,
            "signal_count": len(fired_signals),
        }

        return cheat_score, risk_key, details

    def score_session(
        self,
        session_answers: List[Dict[str, Any]],
    ) -> Tuple[float, str, Dict[str, Any]]:
        """
        Score entire session (weighted average of answers).

        Technical answers (coding, system design) carry 2x weight.
        Behavioral answers carry 1x weight.

        Args:
            session_answers: List of answers with scores and types

        Returns:
            (session_cheat_score: 0-100, risk_level: str, details: dict)
        """
        if not session_answers:
            return 0.0, "low", {}

        weight_sum = 0.0
        weighted_score = 0.0
        answer_details = []

        for answer in session_answers:
            answer_type = answer.get("answer_type", "behavioral")
            cheat_score = answer.get("cheat_score", 0.0)

            # Weight multiplier
            weight = 2.0 if answer_type in ["dsa", "system_design", "coding"] else 1.0

            weighted_score += cheat_score * weight
            weight_sum += weight
            answer_details.append({
                "answer_id": answer.get("answer_id"),
                "answer_type": answer_type,
                "cheat_score": cheat_score,
                "weight": weight,
            })

        session_score = (weighted_score / weight_sum) if weight_sum > 0 else 0.0
        session_score = min(session_score, 100.0)

        risk_level, risk_key, color = self._get_risk_level(session_score)

        return session_score, risk_key, {
            "session_cheat_score": round(session_score, 2),
            "risk_level": risk_level,
            "color": color,
            "answer_breakdown": answer_details,
            "total_answers": len(session_answers),
            "flagged_answers": sum(1 for a in session_answers if a.get("cheat_score", 0) > 45),
        }

    def compute_session_score_with_rubric(
        self,
        rubric_scores: Dict[str, float],
        rubric_weights: Dict[str, Dict[str, Any]],
    ) -> float:
        """
        Compute weighted session score using rubric dimensions.

        Args:
            rubric_scores: Per-dimension scores (e.g., {"dsa": 7.2, "system_design": 6.8})
            rubric_weights: Rubric config (e.g., {"dsa": {"label": "...", "weight": 30}, ...})

        Returns:
            Weighted overall score (0-10)
        """
        if not rubric_weights or not rubric_scores:
            return 0.0

        weighted_sum = 0.0

        for dimension_key, dimension_config in rubric_weights.items():
            score = rubric_scores.get(dimension_key, 0.0)
            weight_percent = dimension_config.get("weight", 0) / 100.0
            weighted_sum += score * weight_percent

        return round(weighted_sum, 2)


    def _analyze_content(self, transcript: str) -> List[Dict[str, Any]]:
        """
        Analyze transcript for Category B signals (content entropy).

        Detects:
        - Lexical diversity (AI uses more vocabulary)
        - Sentence uniformity (AI has consistent structure)
        - Filler word patterns
        - Answer completeness
        """
        signals = []

        # Filler word analysis
        filler_words = ["um", "uh", "like", "you know", "basically", "actually", "so"]
        filler_count = sum(
            len([w for w in transcript.lower().split() if w in filler_words])
        )
        word_count = len(transcript.split())

        if word_count > 50 and filler_count == 0:
            # Zero fillers in long answer
            signals.append({
                "signal_type": "FILLER_WORD_ABSENCE",
                "confidence": 0.7,
                "details": {"word_count": word_count, "filler_count": filler_count},
            })

        # Lexical diversity (Type-Token Ratio)
        unique_words = len(set(word.lower() for word in transcript.split()))
        ttr = unique_words / word_count if word_count > 0 else 0
        if ttr > 0.6 and word_count > 100:  # Very high diversity = AI
            signals.append({
                "signal_type": "LOW_LEXICAL_DIVERSITY",
                "confidence": 0.5,  # Medium confidence
                "details": {"ttr": round(ttr, 3), "word_count": word_count},
            })

        # Sentence uniformity (average sentence length)
        sentences = [s.strip() for s in transcript.split('.') if s.strip()]
        if len(sentences) > 2:
            sentence_lengths = [len(s.split()) for s in sentences]
            variance = statistics.variance(sentence_lengths) if len(sentence_lengths) > 1 else 0
            mean_len = statistics.mean(sentence_lengths)

            # Low variance = uniform = suspicious
            if variance < mean_len * 0.2 and mean_len > 15:
                signals.append({
                    "signal_type": "UNIFORM_SENTENCE_STRUCTURE",
                    "confidence": 0.4,  # Lower confidence
                    "details": {
                        "variance": round(variance, 2),
                        "mean_length": round(mean_len, 1),
                    },
                })

        return signals

    def _get_risk_level(self, score: float) -> Tuple[str, str, str]:
        """Map cheat score to risk level"""
        for (min_score, max_score), (name, key, color) in self.RISK_LEVELS.items():
            if min_score <= score <= max_score:
                return name, key, color
        return "Unknown", "unknown", "gray"


# Global scorer instance
cheat_scorer = CheatScoringEngine()


log = logging.getLogger(__name__)
logger = log

_CLAUDE_MODEL = "claude-haiku-4-5-20251001"
_CLAUDE_API_URL = "https://api.anthropic.com/v1/messages"


async def _maybe_await(value: Any) -> Any:
    if hasattr(value, "__await__"):
        return await value
    return value


async def _db_execute(db: Any, sql: str, params: Optional[Dict[str, Any]] = None) -> Any:
    result = db.execute(text(sql), params or {})
    return await _maybe_await(result)


async def _db_commit(db: Any) -> None:
    try:
        rv = db.commit()
        await _maybe_await(rv)
    except Exception:
        # Best-effort: this job must never fail the caller.
        log.exception("Category D commit failed")


def _parse_json_robust(raw_text: str) -> Any:
    text_value = (raw_text or "").strip()
    if not text_value:
        return None

    if text_value.startswith("```"):
        text_value = re.sub(r"^```(?:json)?\\s*\\n?", "", text_value)
        text_value = re.sub(r"\\n?```\\s*$", "", text_value)
        text_value = text_value.strip()

    try:
        return json.loads(text_value)
    except Exception:
        pass

    match = re.search(r"(\{[\s\S]*\}|\[[\s\S]*\])", text_value, flags=re.S)
    if not match:
        return None
    try:
        return json.loads(match.group(1))
    except Exception:
        return None


async def _claude_json(prompt: str, max_tokens: int = 800) -> dict | None:
    import re, json as _json, httpx
    raw = None

    # Try Claude first
    if getattr(settings, 'ANTHROPIC_API_KEY', ''):
        try:
            import anthropic
            client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)
            msg = client.messages.create(
                model="claude-haiku-4-5-20251001",
                max_tokens=max_tokens,
                messages=[{"role": "user", "content": prompt}]
            )
            raw = msg.content[0].text
        except Exception as e:
            logger.warning(f"Claude failed in _claude_json: {e}")

    # Fallback to Ollama
    if not raw:
        try:
            model = getattr(settings, 'OLLAMA_MODEL', 'phi3:mini')
            r = httpx.post(
                "http://localhost:11434/api/generate",
                json={"model": model, "prompt": prompt, "stream": False},
                timeout=400.0
            )
            raw = r.json().get("response", "")
            logger.info(f"_claude_json used Ollama: {len(raw)} chars")
        except Exception as e:
            logger.warning(f"Ollama failed in _claude_json: {e}")
            return None

    if not raw:
        return None

    # Parse — handles markdown fences and both {} and []
    clean = raw.strip()
    clean = re.sub(r"```json\s*", "", clean)
    clean = re.sub(r"```\s*", "", clean)
    clean = clean.strip()

    # Try object first, then array
    for start_char, end_char in [('{', '}'), ('[', ']')]:
        start = clean.find(start_char)
        end = clean.rfind(end_char)
        if start != -1 and end != -1 and end > start:
            try:
                return _json.loads(clean[start:end+1])
            except _json.JSONDecodeError:
                continue

    # Regex field extraction fallback
    logger.error(f"_claude_json parse failed: {raw[:200]}")
    return None


def _clamp_01(value: float) -> float:
    return max(0.0, min(1.0, float(value)))


def _mean(values: List[float]) -> float:
    return (sum(values) / len(values)) if values else 0.0


def _phrase_hits(text_value: str, phrases: List[str]) -> int:
    low = (text_value or "").lower()
    return sum(low.count(p) for p in phrases)


async def compute_category_d_signals(
    session_id: str,
    db: AsyncSession,
) -> dict:
    """
    Fetches all answers for session_id from interview tables.
    Returns category D composite signal dict and writes to cheat_signals.
    Only intended for B2B interviews, never mock_sessions.
    """
    d1_score: Optional[float] = None
    d2_score: Optional[float] = None
    d3_score: Optional[float] = 0.0
    d4_score: Optional[float] = None
    d5_score: Optional[float] = None
    d6_score: Optional[float] = None

    contradictions: List[Dict[str, Any]] = []
    skill_breakdown: List[Dict[str, Any]] = []
    mismatches: List[Dict[str, Any]] = []
    initial_avg_depth = 0.0
    followup_avg_depth = 0.0

    result = {
        "d1_consistency": d1_score,
        "d1_contradictions": contradictions,
        "d2_degradation": d2_score,
        "d2_initial_depth": initial_avg_depth,
        "d2_followup_depth": followup_avg_depth,
        "d3_resume_mismatch": d3_score,
        "d3_skill_breakdown": skill_breakdown,
        "d3_mismatches": mismatches,
        "d4_velocity": d4_score,
        "d5_knowledge_boundary": d5_score,
        "d6_register_shift": d6_score,
        "composite": 0.0,
        "flag": False,
        "confidence": "low",
    }

    try:
        interview = (await _db_execute(
            db,
            """
            SELECT id, mock_session_id, role_id, resume_id, application_id
            FROM interviews
            WHERE id = CAST(:sid AS uuid)
            LIMIT 1
            """,
            {"sid": str(session_id)},
        )).mappings().first()

        if not interview:
            log.info("Category D skipped: interview not found for session_id=%s", session_id)
            return result

        if interview.get("mock_session_id") is not None:
            log.info("Category D skipped for mock-linked interview session_id=%s", session_id)
            return result

        answer_rows = (await _db_execute(
            db,
            """
            SELECT
              a.id AS answer_id,
              q.id AS question_id,
              q.question_text,
              q.parent_question_id,
              COALESCE(a.transcript, a.code_answer, '') AS answer_text,
              COALESCE(a.is_followup, (q.parent_question_id IS NOT NULL), false) AS is_followup,
              a.created_at
            FROM interview_answers a
            JOIN interview_questions q ON q.id = a.interview_question_id
            WHERE q.interview_id = CAST(:sid AS uuid)
            ORDER BY a.created_at ASC NULLS LAST, q.id ASC, a.id ASC
            """,
            {"sid": str(session_id)},
        )).mappings().all()

        if not answer_rows:
            log.info("Category D skipped: no answers for session_id=%s", session_id)
            return result

        answers: List[Dict[str, Any]] = []
        for idx, row in enumerate(answer_rows, start=1):
            answer_text = (row.get("answer_text") or "").strip()
            answers.append({
                "answer_id": row.get("answer_id"),
                "question_text": (row.get("question_text") or "").strip(),
                "answer_text": answer_text,
                "is_followup": bool(row.get("is_followup")),
                "question_index": idx,
                "word_count": len(answer_text.split()) if answer_text else 0,
            })

        # Context fetch: resume and JD text.
        context_row = (await _db_execute(
            db,
            """
            SELECT
              COALESCE(cr.plain_text, '') AS resume_text,
              COALESCE(r.jd_text, jr.jd_text, '') AS jd_text,
              ja.candidate_email,
              ja.candidate_name
            FROM interviews i
            LEFT JOIN candidate_resumes cr ON cr.id = i.resume_id
            LEFT JOIN roles r ON r.id = i.role_id
            LEFT JOIN job_roles jr ON jr.id = i.role_id
            LEFT JOIN job_applications ja ON ja.id = i.application_id
            WHERE i.id = CAST(:sid AS uuid)
            LIMIT 1
            """,
            {"sid": str(session_id)},
        )).mappings().first() or {}
        resume_text = (context_row.get("resume_text") or "").strip()

        # D1: Cross-answer consistency
        if len(answers) >= 4:
            answer_texts = [a.get("answer_text") or "" for a in answers if a.get("answer_text")]
            if len(answer_texts) > 6:
                truncated_answers = [
                    f"Q{i+1}: {a[:200]}" for i, a in enumerate(answer_texts)
                ]
                numbered_answers = "\n".join(truncated_answers)
            else:
                numbered_answers = "\n".join(f"Q{i+1}: {a[:200]}" for i, a in enumerate(answer_texts))
            if numbered_answers.strip():
                prompt_d1 = (
                    "You are analyzing interview answers for internal consistency.\n"
                    "Here are the answers in order:\n"
                    f"{numbered_answers}\n"
                    "Identify any factual contradictions where the candidate claims two incompatible things.\n"
                    "A contradiction is when a specific claim in one answer is logically incompatible with a claim in another.\n"
                    "Do NOT flag things that are merely different topics.\n"
                    "Return ONLY valid JSON: {\"contradictions\": [{\"answer_a\": int, \"answer_b\": int, \"explanation\": str}]}\n"
                    "Return {\"contradictions\": []} if none found."
                )
                try:
                    d1_obj = await _claude_json(prompt_d1, max_tokens=800)
                    d1_contras = d1_obj.get("contradictions", []) if isinstance(d1_obj, dict) else []
                    contradictions = d1_contras if isinstance(d1_contras, list) else []
                    d1_score = _clamp_01(len(contradictions) * 0.25)
                except Exception:
                    log.exception("Category D D1 call failed for session_id=%s", session_id)
                    contradictions = []
                    d1_score = None

        # D2: Follow-up degradation
        hedge_words = [
            "i think", "i believe", "maybe", "probably", "not sure",
            "i guess", "could be", "it depends", "i'm not sure", "perhaps",
        ]
        initial = [a for a in answers if not a.get("is_followup")]
        followups = [a for a in answers if a.get("is_followup")]

        if len(followups) >= 2:
            init_depths: List[float] = []
            follow_depths: List[float] = []

            for bucket, source in ((init_depths, initial), (follow_depths, followups)):
                for a in source:
                    wc = max(1, int(a.get("word_count") or 0))
                    hd = _phrase_hits(a.get("answer_text") or "", hedge_words) / float(wc)
                    bucket.append(float(wc) * (1.0 - hd))

            initial_avg_depth = _mean(init_depths)
            followup_avg_depth = _mean(follow_depths)
            if initial_avg_depth > 0:
                d2_score = _clamp_01((initial_avg_depth - followup_avg_depth) / initial_avg_depth)
            else:
                d2_score = 0.0

        # D3: Resume-answer mismatch
        if not resume_text:
            d3_score = 0.0
            skill_breakdown = []
            mismatches = []
        else:
            extracted_skills: List[Dict[str, Any]] = []
            try:
                prompt_d3_extract = (
                    "Extract the top 5 technical skill claims from this resume as a JSON list.\n"
                    "Each item: {\"skill\": str, \"claimed_level\": str (e.g. '3 years', 'led team', 'expert')}\n"
                    f"Resume: {resume_text}\n"
                    "Return ONLY valid JSON: {\"skills\": [...]}"
                )
                d3_skills_obj = await asyncio.wait_for(
                    _claude_json(prompt_d3_extract, max_tokens=400),
                    timeout=90.0
                )
                if isinstance(d3_skills_obj, dict) and isinstance(d3_skills_obj.get("skills"), list):
                    extracted_skills = d3_skills_obj.get("skills", [])[:5]
            except asyncio.TimeoutError:
                log.warning("Category D D3 extraction timed out — skipping D3 for session_id=%s", session_id)
                extracted_skills = []
            except Exception:
                log.exception("Category D D3 extraction failed for session_id=%s", session_id)
                extracted_skills = []

            per_skill_matches: List[float] = []
            for skill in extracted_skills:
                if not isinstance(skill, dict):
                    continue
                skill_name = str(skill.get("skill") or "").strip()
                claimed_level = str(skill.get("claimed_level") or "").strip()
                if not skill_name:
                    continue

                low_skill = skill_name.lower()
                related_answers = [a for a in answers if low_skill in (a.get("answer_text") or "").lower()]
                if not related_answers:
                    continue

                answer_text = max(related_answers, key=lambda a: int(a.get("word_count") or 0)).get("answer_text") or ""
                match_score = 0.0
                reason = ""

                try:
                    prompt_d3_match = (
                        f"Resume claims: {skill_name} at level {claimed_level}.\n"
                        f"Interview answer about this skill: {answer_text[:300]}\n"
                        "On a scale 0.0-1.0, how much does the answer quality match the claimed experience level?\n"
                        "1.0 = perfectly matches, 0.0 = completely contradicts the claim.\n"
                        "Return ONLY valid JSON: {\"match_score\": float, \"reason\": str}"
                    )
                    d3_match_obj = await asyncio.wait_for(
                        _claude_json(prompt_d3_match, max_tokens=200),
                        timeout=60.0
                    )
                    if isinstance(d3_match_obj, dict):
                        match_score = float(d3_match_obj.get("match_score", 0.0) or 0.0)
                        reason = str(d3_match_obj.get("reason") or "")
                except asyncio.TimeoutError:
                    log.warning("Category D D3 skill match timed out for skill=%s — skipping", skill_name)
                    continue
                except Exception:
                    log.exception("Category D D3 skill scoring failed for skill=%s session_id=%s", skill_name, session_id)
                    continue

                match_score = _clamp_01(match_score)
                per_skill_matches.append(match_score)
                item = {
                    "skill": skill_name,
                    "claimed_level": claimed_level,
                    "match_score": match_score,
                    "reason": reason,
                }
                skill_breakdown.append(item)
                if match_score < 0.5:
                    mismatches.append(item)

            d3_score = _clamp_01(1.0 - _mean(per_skill_matches)) if per_skill_matches else 0.0

        # Schema checks for optional D4-D6 inputs.
        answer_col_rows = (await _db_execute(
            db,
            """
            SELECT column_name
            FROM information_schema.columns
            WHERE table_name = 'interview_answers'
            """,
            {},
        )).mappings().all()
        answer_cols = {r["column_name"] for r in answer_col_rows}

        question_col_rows = (await _db_execute(
            db,
            """
            SELECT column_name
            FROM information_schema.columns
            WHERE table_name = 'interview_questions'
            """,
            {},
        )).mappings().all()
        question_cols = {r["column_name"] for r in question_col_rows}

        # D4: Answer velocity anomaly
        if "time_to_first_word" in answer_cols:
            d4_rows = (await _db_execute(
                db,
                """
                SELECT q.question_text, a.time_to_first_word
                FROM interview_answers a
                JOIN interview_questions q ON q.id = a.interview_question_id
                WHERE q.interview_id = CAST(:sid AS uuid)
                  AND a.time_to_first_word IS NOT NULL
                ORDER BY a.created_at ASC NULLS LAST, q.id ASC, a.id ASC
                """,
                {"sid": str(session_id)},
            )).mappings().all()

            complex_total = 0
            complex_fast = 0
            for row in d4_rows:
                q_wc = len(((row.get("question_text") or "").strip()).split())
                ttfw = float(row.get("time_to_first_word") or 0.0)
                if q_wc > 20:
                    complex_total += 1
                    if ttfw < 1.5:
                        complex_fast += 1
            if complex_total >= 3:
                d4_score = _clamp_01(complex_fast / float(complex_total))

        # D5: Knowledge boundary inconsistency
        answer_score_col = "answer_score" if "answer_score" in answer_cols else ("overall_score" if "overall_score" in answer_cols else None)
        topic_col = "topic" if "topic" in question_cols else None
        difficulty_col = "difficulty" if "difficulty" in question_cols else None
        if answer_score_col and topic_col and difficulty_col:
            d5_rows = (await _db_execute(
                db,
                f"""
                SELECT
                  q.{topic_col} AS topic,
                  q.{difficulty_col} AS difficulty,
                  a.{answer_score_col} AS answer_score
                FROM interview_answers a
                JOIN interview_questions q ON q.id = a.interview_question_id
                WHERE q.interview_id = CAST(:sid AS uuid)
                  AND q.{topic_col} IS NOT NULL
                  AND q.{difficulty_col} IS NOT NULL
                  AND a.{answer_score_col} IS NOT NULL
                """,
                {"sid": str(session_id)},
            )).mappings().all()

            by_topic: Dict[str, List[Dict[str, Any]]] = {}
            for row in d5_rows:
                topic = str(row.get("topic") or "").strip()
                if not topic:
                    continue
                by_topic.setdefault(topic, []).append({
                    "difficulty": str(row.get("difficulty") or "").strip().lower(),
                    "score": float(row.get("answer_score") or 0.0),
                })

            anomaly_values: List[float] = []
            difficulty_rank = {"easy": 1, "medium": 2, "hard": 3}
            for _, items in by_topic.items():
                if len(items) < 2:
                    continue
                for i in range(len(items)):
                    for j in range(i + 1, len(items)):
                        a_item = items[i]
                        b_item = items[j]
                        ra = difficulty_rank.get(a_item["difficulty"], 0)
                        rb = difficulty_rank.get(b_item["difficulty"], 0)
                        if ra == 0 or rb == 0 or ra == rb:
                            continue
                        hard = a_item if ra > rb else b_item
                        easy = b_item if ra > rb else a_item
                        if hard["score"] > easy["score"]:
                            anomaly_values.append(hard["score"] - easy["score"])

            if anomaly_values:
                d5_score = _clamp_01(_mean(anomaly_values) / 10.0)

        # D6: Vocabulary register shift
        timeline_silence_count = (await _db_execute(
            db,
            """
            SELECT COUNT(*) AS cnt
            FROM interview_timeline
            WHERE interview_id = CAST(:sid AS uuid)
              AND payload::text ILIKE '%silence%'
            """,
            {"sid": str(session_id)},
        )).scalar() or 0
        if int(timeline_silence_count or 0) > 0:
            fillers = ["um", "uh", "like", "so", "basically", "you know"]

            def _formality(s: str) -> float:
                s = (s or "").strip()
                wc = max(1, len(s.split()))
                segments = [z.strip() for z in re.split(r"[.!?]", s) if z.strip()]
                sentence_count = max(1, len(segments))
                avg_sentence_len = wc / float(sentence_count)
                filler_density = _phrase_hits(s, fillers) / float(wc)
                return avg_sentence_len * (1.0 - filler_density)

            first_two = [a for a in answers[:2] if (a.get("answer_text") or "").strip()]
            baseline = _mean([_formality(a["answer_text"]) for a in first_two]) if first_two else 0.0

            all_segments = [a["answer_text"] for a in answers if (a.get("answer_text") or "").strip()]
            if baseline > 0 and all_segments:
                flagged = sum(1 for seg in all_segments if _formality(seg) > baseline * 2.0)
                d6_score = _clamp_01(flagged / float(len(all_segments)))

        # Composite with dynamic weight normalization.
        available = {
            "D1": d1_score,
            "D2": d2_score,
            "D3": d3_score,
            "D4": d4_score,
            "D5": d5_score,
            "D6": d6_score,
        }
        weights = {
            "D1": 0.20,
            "D2": 0.25,
            "D3": 0.20,
            "D4": 0.15,
            "D5": 0.10,
            "D6": 0.10,
        }
        active_keys = [k for k, v in available.items() if v is not None]
        if active_keys:
            active_weight_sum = sum(weights[k] for k in active_keys)
            composite = sum(float(available[k]) * (weights[k] / active_weight_sum) for k in active_keys)
        else:
            composite = 0.0
        composite = _clamp_01(composite)

        flag = composite > 0.50
        confidence = "low" if composite < 0.30 else ("medium" if composite < 0.50 else "high")

        result = {
            "d1_consistency": d1_score,
            "d1_contradictions": contradictions,
            "d2_degradation": d2_score,
            "d2_initial_depth": initial_avg_depth,
            "d2_followup_depth": followup_avg_depth,
            "d3_resume_mismatch": d3_score,
            "d3_skill_breakdown": skill_breakdown,
            "d3_mismatches": mismatches,
            "d4_velocity": d4_score,
            "d5_knowledge_boundary": d5_score,
            "d6_register_shift": d6_score,
            "composite": composite,
            "flag": flag,
            "confidence": confidence,
        }

        # Persist best-effort to cheat_signals using the first answer in session.
        first_answer_id = answers[0].get("answer_id") if answers else None
        if first_answer_id is not None:
            signal_weight = "high" if composite >= 0.7 else ("medium" if composite >= 0.4 else "low")
            payload_data = {
                "session_id": str(session_id),
                "signal_type": "category_d",
                "signals": result,
                "evidence": {
                    "contradictions": contradictions,
                    "skill_breakdown": skill_breakdown,
                    "mismatches": mismatches,
                },
            }
            try:
                await _db_execute(
                    db,
                    """
                    INSERT INTO cheat_signals
                      (interview_answer_id, signal_type, signal_category, weight, details, payload)
                    VALUES
                      (:aid, :stype, :scat, :weight, CAST(:details AS jsonb), CAST(:payload AS jsonb))
                    """,
                    {
                        "aid": int(first_answer_id),
                        "stype": "category_d",
                        "scat": "D",
                        "weight": signal_weight,
                        "details": json.dumps({"session_id": str(session_id), "composite": composite}),
                        "payload": json.dumps(payload_data),
                    },
                )
                await _db_commit(db)
            except Exception:
                log.exception("Category D persist failed for session_id=%s", session_id)

        return result
    except Exception:
        # Never raise from this background-style worker.
        log.exception("Category D computation failed for session_id=%s", session_id)
        return result
