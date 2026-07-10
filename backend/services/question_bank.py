"""Question bank retrieval and adaptation helpers.

This module uses raw SQL via SQLAlchemy text() with an existing Session.
"""

from __future__ import annotations

import json
import logging
import random
from typing import Any, Optional

from sqlalchemy import text
from sqlalchemy.orm import Session

log = logging.getLogger(__name__)


def _difficulty_range(difficulty: str) -> tuple[int, int]:
    d = (difficulty or "").lower().strip()
    if d == "beginner":
        return 1, 2
    if d == "intermediate":
        return 2, 4
    if d == "advanced":
        return 3, 5
    return 1, 5


def _parse_followups(value: Any) -> list[Any]:
    if value is None:
        return []
    if isinstance(value, list):
        return value
    if isinstance(value, str):
        try:
            parsed = json.loads(value)
            return parsed if isinstance(parsed, list) else []
        except Exception:
            return []
    return []


def _assessment_clause(session_type: str) -> tuple[str, dict[str, Any]]:
    st = (session_type or "single").strip().lower()
    if st in {"behavioral", "dsa", "system_design"}:
        return " AND (assessment_type = :session_type OR assessment_type IS NULL) ", {"session_type": st}
    return "", {}


def _language_clause(preferred_language: Optional[str]) -> tuple[str, dict[str, Any]]:
    """
    Build a WHERE clause that filters code questions by language_tag.

    Rules:
    - If preferred_language is set: include questions where language_tag matches
      OR language_tag is NULL/empty (language-agnostic questions).
      Exclude questions tagged with a DIFFERENT specific language.
    - If preferred_language is None/empty: no language filter applied —
      all questions are eligible (existing behaviour preserved).
    """
    if not preferred_language:
        return "", {}
    return (
        " AND (language_tag IS NULL OR language_tag = '' OR language_tag = :preferred_language) ",
        {"preferred_language": preferred_language.lower().strip()},
    )


def _fetch_questions(
    db: Session,
    qtype: str,
    limit_count: int,
    min_diff: int,
    max_diff: int,
    role: Optional[str] = None,
    company: Optional[str] = None,
    exclude_ids: Optional[list[int]] = None,
    session_type: str = "single",
    apply_company_filter: bool = True,
    require_role: bool = True,
    preferred_language: Optional[str] = None,
) -> list[dict[str, Any]]:
    if limit_count <= 0:
        return []

    assessment_sql, assessment_params = _assessment_clause(session_type)

    # Language filter only applies to code questions
    if qtype == "code":
        language_sql, language_params = _language_clause(preferred_language)
    else:
        language_sql, language_params = "", {}

    role_sql = " AND role_tags @> ARRAY[:role]::text[] " if require_role else ""
    company_sql = ""
    if apply_company_filter:
        company_sql = (
            """
            AND (
                :company IS NULL
                OR company_tags @> ARRAY[:company]::text[]
                OR company_tags = '{}'::text[]
            )
            """
        )

    order_sql = " ORDER BY quality_score DESC, RANDOM() "
    if apply_company_filter:
        order_sql = (
            """
            ORDER BY
                CASE
                    WHEN :company IS NOT NULL AND company_tags @> ARRAY[:company]::text[] THEN 0
                    ELSE 1
                END,
                quality_score DESC,
                RANDOM()
            """
        )

    query = text(
        f"""
        SELECT *
        FROM questions
        WHERE type = :qtype
          AND difficulty BETWEEN :min_diff AND :max_diff
          AND (
            COALESCE(array_length(CAST(:exclude_ids AS int[]), 1), 0) = 0
            OR id <> ALL(CAST(:exclude_ids AS int[]))
          )
          {role_sql}
          {company_sql}
          {assessment_sql}
          {language_sql}
        {order_sql}
        LIMIT :limit_count
        """
    )

    params: dict[str, Any] = {
        "qtype": qtype,
        "min_diff": min_diff,
        "max_diff": max_diff,
        "exclude_ids": exclude_ids or [],
        "limit_count": limit_count,
        "role": role,
        "company": company,
    }
    params.update(assessment_params)
    params.update(language_params)

    rows = db.execute(query, params).mappings().all()
    return [dict(r) for r in rows]


def _normalize_question_row(row: dict[str, Any], company: Optional[str]) -> dict[str, Any]:
    out = dict(row)
    out["follow_up_questions"] = _parse_followups(out.get("follow_up_questions"))

    company_tags = out.get("company_tags") or []
    if isinstance(company_tags, str):
        try:
            company_tags = json.loads(company_tags)
        except Exception:
            company_tags = []

    out["source"] = "bank"
    out["company_specific"] = bool(company) and isinstance(company_tags, list) and company in company_tags
    return out


def get_questions_for_session(
    db: Session,
    role: str,
    difficulty: str,
    company: str | None,
    count: int = 8,
    code_count: int = 2,
    candidate_email: str | None = None,
    session_type: str = "single",
    preferred_language: Optional[str] = None,
) -> list[dict[str, Any]]:
    """Retrieve balanced question bank rows with fallbacks and optional repeat-avoidance."""
    try:
        min_diff, max_diff = _difficulty_range(difficulty)
        count = max(0, int(count))
        code_count = max(0, min(int(code_count), count))
        voice_count = max(0, count - code_count)

        # Normalise preferred_language — only accept known values
        known_languages = {"python", "java", "cpp"}
        if preferred_language and preferred_language.lower().strip() not in known_languages:
            log.warning(
                "[QUESTION_BANK] Unknown preferred_language=%s — ignoring", preferred_language
            )
            preferred_language = None
        elif preferred_language:
            preferred_language = preferred_language.lower().strip()

        exclusion_ids: list[int] = []
        if candidate_email:
            seen_rows = db.execute(
                text(
                    """
                    SELECT question_id
                    FROM candidate_question_history
                    WHERE candidate_email = :email
                      AND seen_at > now() - interval '30 days'
                    """
                ),
                {"email": candidate_email},
            ).mappings().all()
            exclusion_ids = [int(r["question_id"]) for r in seen_rows if r.get("question_id") is not None]

        log.info(
            "[QUESTION_BANK] role=%s diff=%s(%s-%s) company=%s count=%s code=%s "
            "lang=%s exclude=%s session_type=%s",
            role, difficulty, min_diff, max_diff, company,
            count, code_count, preferred_language, len(exclusion_ids), session_type,
        )

        used_ids: set[int] = set(exclusion_ids)

        # ── Voice questions — no language filter ──────────────────────────────
        voice_rows = _fetch_questions(
            db=db,
            qtype="voice",
            limit_count=voice_count,
            min_diff=min_diff,
            max_diff=max_diff,
            role=role,
            company=company,
            exclude_ids=list(used_ids),
            session_type=session_type,
            apply_company_filter=True,
            require_role=True,
            preferred_language=None,   # language filter does not apply to voice
        )
        used_ids.update(int(r["id"]) for r in voice_rows if r.get("id") is not None)

        # ── Code questions — WITH language filter ─────────────────────────────
        code_rows = _fetch_questions(
            db=db,
            qtype="code",
            limit_count=code_count,
            min_diff=min_diff,
            max_diff=max_diff,
            role=role,
            company=company,
            exclude_ids=list(used_ids),
            session_type=session_type,
            apply_company_filter=True,
            require_role=True,
            preferred_language=preferred_language,
        )
        used_ids.update(int(r["id"]) for r in code_rows if r.get("id") is not None)

        # ── Fallback 1 voice: remove company filter ───────────────────────────
        if len(voice_rows) < voice_count:
            need = voice_count - len(voice_rows)
            log.warning("[QUESTION_BANK] voice fallback #1 triggered: need=%s", need)
            more = _fetch_questions(
                db=db,
                qtype="voice",
                limit_count=need,
                min_diff=min_diff,
                max_diff=max_diff,
                role=role,
                company=None,
                exclude_ids=list(used_ids),
                session_type=session_type,
                apply_company_filter=False,
                require_role=True,
                preferred_language=None,
            )
            voice_rows.extend(more)
            used_ids.update(int(r["id"]) for r in more if r.get("id") is not None)

        # ── Fallback 2 voice: remove role filter too ──────────────────────────
        if len(voice_rows) < voice_count:
            need = voice_count - len(voice_rows)
            log.warning("[QUESTION_BANK] voice fallback #2 triggered: need=%s", need)
            more = _fetch_questions(
                db=db,
                qtype="voice",
                limit_count=need,
                min_diff=min_diff,
                max_diff=max_diff,
                role=None,
                company=None,
                exclude_ids=list(used_ids),
                session_type=session_type,
                apply_company_filter=False,
                require_role=False,
                preferred_language=None,
            )
            voice_rows.extend(more)
            used_ids.update(int(r["id"]) for r in more if r.get("id") is not None)

        # ── Fallback 1 code: remove company filter, keep language ─────────────
        if len(code_rows) < code_count:
            need = code_count - len(code_rows)
            log.warning("[QUESTION_BANK] code fallback #1 triggered: need=%s", need)
            more = _fetch_questions(
                db=db,
                qtype="code",
                limit_count=need,
                min_diff=min_diff,
                max_diff=max_diff,
                role=role,
                company=None,
                exclude_ids=list(used_ids),
                session_type=session_type,
                apply_company_filter=False,
                require_role=True,
                preferred_language=preferred_language,
            )
            code_rows.extend(more)
            used_ids.update(int(r["id"]) for r in more if r.get("id") is not None)

        # ── Fallback 2 code: remove role filter, keep language ────────────────
        if len(code_rows) < code_count:
            need = code_count - len(code_rows)
            log.warning("[QUESTION_BANK] code fallback #2 triggered: need=%s", need)
            more = _fetch_questions(
                db=db,
                qtype="code",
                limit_count=need,
                min_diff=min_diff,
                max_diff=max_diff,
                role=None,
                company=None,
                exclude_ids=list(used_ids),
                session_type=session_type,
                apply_company_filter=False,
                require_role=False,
                preferred_language=preferred_language,
            )
            code_rows.extend(more)
            used_ids.update(int(r["id"]) for r in more if r.get("id") is not None)

        # ── Fallback 3 code: drop language filter entirely if still not enough ─
        if len(code_rows) < code_count:
            need = code_count - len(code_rows)
            log.warning(
                "[QUESTION_BANK] code fallback #3 triggered (language filter dropped): need=%s", need
            )
            more = _fetch_questions(
                db=db,
                qtype="code",
                limit_count=need,
                min_diff=min_diff,
                max_diff=max_diff,
                role=None,
                company=None,
                exclude_ids=list(used_ids),
                session_type=session_type,
                apply_company_filter=False,
                require_role=False,
                preferred_language=None,   # give up on language filter as last resort
            )
            code_rows.extend(more)
            used_ids.update(int(r["id"]) for r in more if r.get("id") is not None)

        # ── Shuffle voice only, keep code at end ──────────────────────────────
        random.shuffle(voice_rows)
        result_rows = voice_rows + code_rows
        result = [_normalize_question_row(r, company) for r in result_rows]

        # ── Record history for repeat-avoidance ───────────────────────────────
        if candidate_email:
            for row in result_rows:
                qid = row.get("id")
                if qid is None:
                    continue
                db.execute(
                    text(
                        """
                        INSERT INTO candidate_question_history
                            (candidate_email, question_id, mock_session_id)
                        VALUES (:email, :qid, :mock_session_id)
                        ON CONFLICT (candidate_email, question_id) DO UPDATE
                        SET seen_at = now()
                        """
                    ),
                    {
                        "email": candidate_email,
                        "qid": int(qid),
                        "mock_session_id": None,
                    },
                )

        return result
    except Exception as exc:
        log.warning("[QUESTION_BANK] get_questions_for_session failed: %s", exc)
        return []


def update_question_stats(db: Session, question_id: int, score: float) -> None:
    """Update usage and quality metrics for a question after scoring."""
    try:
        db.execute(
            text(
                """
                UPDATE questions SET
                  times_used = COALESCE(times_used, 0) + 1,
                  avg_score = CASE
                    WHEN avg_score IS NULL THEN :score
                    ELSE (avg_score * COALESCE(times_used, 0) + :score) / (COALESCE(times_used, 0) + 1)
                  END,
                  quality_score = CASE
                    WHEN COALESCE(times_used, 0) >= 5 AND COALESCE(avg_score, 0) >= 70
                      THEN LEAST(COALESCE(quality_score, 0.8) + 0.05, 1.0)
                    WHEN COALESCE(times_used, 0) >= 5 AND COALESCE(avg_score, 0) < 40
                      THEN GREATEST(COALESCE(quality_score, 0.8) - 0.05, 0.1)
                    ELSE COALESCE(quality_score, 0.8)
                  END
                WHERE id = :question_id
                """
            ),
            {"question_id": question_id, "score": score},
        )
    except Exception as exc:
        log.warning("[QUESTION_BANK] update_question_stats failed for id=%s: %s", question_id, exc)


def get_follow_up_question(
    db: Session,
    question_id: int,
    score: float,
    attempt_number: int,
) -> dict[str, Any] | None:
    """Select an inline follow-up prompt from the question bank when performance is weak."""
    try:
        if score >= 70 or attempt_number >= 3:
            return None

        row = db.execute(
            text(
                """
                SELECT follow_up_questions, difficulty
                FROM questions
                WHERE id = :question_id
                """
            ),
            {"question_id": question_id},
        ).mappings().first()

        if not row:
            return None

        follow_ups = _parse_followups(row.get("follow_up_questions"))
        if not follow_ups:
            return None

        idx = 0 if attempt_number <= 1 else 1
        chosen = follow_ups[idx] if idx < len(follow_ups) else follow_ups[0]

        if not isinstance(chosen, dict):
            return None

        question_text = chosen.get("text")
        if not question_text:
            return None

        return {
            "question_text": question_text,
            "type": "voice",
            "difficulty": chosen.get("difficulty", row.get("difficulty")),
            "topic": chosen.get("topic", ""),
            "source": "follow_up",
            "parent_question_id": question_id,
        }
    except Exception as exc:
        log.warning("[QUESTION_BANK] get_follow_up_question failed for id=%s: %s", question_id, exc)
        return None


def get_weak_spots(db: Session, user_id: int) -> list[str]:
    """Return up to 3 weakest topics from recent mock activity."""
    try:
        rows = db.execute(
            text(
                """
                SELECT
                  iq.topic,
                  AVG(ia.overall_score) as avg_score,
                  COUNT(*) as attempts
                FROM interview_answers ia
                JOIN interview_questions iq ON iq.id = ia.interview_question_id
                JOIN interviews i ON i.id = iq.interview_id
                JOIN mock_sessions ms ON ms.id::text = i.mock_session_id::text
                WHERE ms.user_id = :user_id
                  AND ia.created_at > now() - interval '30 days'
                GROUP BY iq.topic
                HAVING COUNT(*) >= 2
                ORDER BY avg_score ASC
                LIMIT 3
                """
            ),
            {"user_id": user_id},
        ).mappings().all()

        return [str(r["topic"]) for r in rows if r.get("topic")]
    except Exception as exc:
        log.warning("[QUESTION_BANK] get_weak_spots failed for user_id=%s: %s", user_id, exc)
        return []