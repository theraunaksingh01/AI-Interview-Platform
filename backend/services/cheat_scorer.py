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
import math
from scipy import stats
import statistics


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


import statistics
