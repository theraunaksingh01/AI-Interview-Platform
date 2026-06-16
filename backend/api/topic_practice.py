# backend/api/topic_practice.py
"""
Topic Practice API — focused voice-based drilling on specific topics.

POST /api/topic-practice/start    — start a session for a topic/subtopic
POST /api/topic-practice/respond  — evaluate student answer, return feedback
POST /api/topic-practice/end      — finalize session, return depth report
GET  /api/topic-practice/topics   — return topic tree
"""

from __future__ import annotations

import json
import logging
import os
import re
from typing import Any, Optional
from uuid import UUID

import anthropic
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.orm import Session

from api.deps import get_current_user
from db.session import SessionLocal

log = logging.getLogger(__name__)

router = APIRouter(prefix="/api/topic-practice", tags=["topic-practice"])

# ─── Topic tree ───────────────────────────────────────────────────────────────

TOPIC_TREE = {
    "DBMS": {
        "label": "DBMS",
        "icon": "🗄️",
        "color": "#5b21b6",
        "bg": "#ede9fe",
        "subtopics": [
            {"key": "all", "label": "All DBMS (mixed)"},
            {"key": "Transactions", "label": "Transactions & ACID"},
            {"key": "Schema Design", "label": "Normalization & Schema"},
            {"key": "SQL", "label": "SQL & Joins"},
            {"key": "Performance", "label": "Indexing & Performance"},
            {"key": "Scaling", "label": "Scaling & Replication"},
            {"key": "Database Types", "label": "SQL vs NoSQL"},
        ],
    },
    "OS": {
        "label": "Operating Systems",
        "icon": "⚙️",
        "color": "#92400e",
        "bg": "#fef3c7",
        "subtopics": [
            {"key": "all", "label": "All OS (mixed)"},
            {"key": "Processes", "label": "Processes & Threads"},
            {"key": "Concurrency", "label": "Concurrency & Deadlock"},
            {"key": "Memory Management", "label": "Memory & Paging"},
            {"key": "Scheduling", "label": "CPU Scheduling"},
            {"key": "File Systems", "label": "File Systems"},
            {"key": "OS Architecture", "label": "Kernel & System Calls"},
        ],
    },
    "Behavioral": {
        "label": "Behavioral & HR",
        "icon": "🎭",
        "color": "#065f46",
        "bg": "#d1fae5",
        "subtopics": [
            {"key": "all", "label": "All Behavioral (mixed)"},
            {"key": "Introduction", "label": "Tell Me About Yourself"},
            {"key": "STAR Method Stories", "label": "STAR Method Stories"},
            {"key": "Motivation Questions", "label": "Why This Company"},
            {"key": "Self Assessment", "label": "Strengths & Weaknesses"},
            {"key": "Leadership", "label": "Leadership & Initiative"},
        ],
    },
}

# ─── Tier gating ──────────────────────────────────────────────────────────────

FREE_SESSIONS_PER_MONTH = 3

# ─── Schemas ──────────────────────────────────────────────────────────────────

class StartRequest(BaseModel):
    topic: str
    subtopic: str = "all"
    question_count: int = 7


class RespondRequest(BaseModel):
    session_id: str
    concept_id: Optional[str] = None
    question_text: str
    transcript: str
    topic: str
    subtopic: Optional[str] = None


class EndRequest(BaseModel):
    session_id: str


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _get_user_plan(db: Session, user_id: int) -> str:
    row = db.execute(
        text("SELECT plan FROM users WHERE id = :uid"), {"uid": user_id}
    ).scalar()
    return (row or "free").lower()


def _check_free_limit(db: Session, user_id: int) -> bool:
    """Returns True if user is within free limit."""
    from datetime import datetime
    month_start = datetime.utcnow().replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    count = db.execute(
        text("""
            SELECT COUNT(*) FROM topic_practice_sessions
            WHERE user_id = :uid AND created_at >= :start
        """),
        {"uid": user_id, "start": month_start},
    ).scalar() or 0
    return int(count) < FREE_SESSIONS_PER_MONTH


def _fetch_concepts(
    db: Session,
    topic: str,
    subtopic: str,
    limit: int,
    exclude_recent: bool = True,
    user_id: Optional[int] = None,
) -> list[dict]:
    """Fetch concept cards for a topic/subtopic."""
    query = """
        SELECT id, concept_name, topic, subtopic, ask_prompt,
               good_answer_summary, refresher_short, refresher_full,
               interview_edge_tip, key_terms, difficulty
        FROM quick_prep_concepts
        WHERE is_active = TRUE AND topic = :topic
    """
    params: dict[str, Any] = {"topic": topic, "limit": limit}

    if subtopic and subtopic != "all":
        query += " AND subtopic = :subtopic"
        params["subtopic"] = subtopic

    # Avoid recently used concepts
    if exclude_recent and user_id:
        query += """
            AND id NOT IN (
                SELECT tpr.concept_id FROM topic_practice_results tpr
                JOIN topic_practice_sessions tps ON tps.id = tpr.session_id
                WHERE tps.user_id = :uid
                AND tpr.concept_id IS NOT NULL
                ORDER BY tpr.created_at DESC
                LIMIT 30
            )
        """
        params["uid"] = user_id

    query += " ORDER BY random() LIMIT :limit"

    rows = db.execute(text(query), params).mappings().all()
    result = [dict(r) for r in rows]

    # If not enough concepts, allow reuse
    if len(result) < limit and exclude_recent:
        result = _fetch_concepts(db, topic, subtopic, limit, exclude_recent=False)

    return result


def _generate_question(
    concept: dict,
    topic: str,
    is_behavioral: bool,
) -> str:
    """Use the concept's ask_prompt directly."""
    return concept["ask_prompt"]


def _evaluate_answer(
    question_text: str,
    transcript: str,
    concept: dict,
    topic: str,
    is_behavioral: bool,
) -> dict:
    """
    Evaluate student's answer via Claude Haiku.
    Returns: {result, score, feedback, missing_points}
    """
    if not transcript or len(transcript.strip().split()) < 5:
        return {
            "result": "skipped",
            "score": 0,
            "feedback": "No answer detected. Moving on.",
            "missing_points": [],
        }

    api_key = os.getenv("ANTHROPIC_API_KEY", "").strip()
    if not api_key:
        return _fallback_evaluation(transcript, concept)

    if is_behavioral:
        prompt = f"""You are evaluating a student's behavioral interview answer.

Question: "{question_text}"

What a strong answer covers:
"{concept.get('good_answer_summary', '')}"

Student's answer:
"{transcript[:800]}"

Evaluate and return JSON only — no markdown:
{{
  "score": <number 1-10>,
  "result": "solid" | "needs_work",
  "feedback": "<2-3 sentences of specific, honest feedback referencing what they said>",
  "missing_points": ["<specific thing they missed 1>", "<specific thing they missed 2>"]
}}

Be direct and specific. Reference exact things they said or didn't say."""

    else:
        prompt = f"""You are evaluating a technical interview answer about {topic}.

Question: "{question_text}"

Key concepts a strong answer should cover:
"{concept.get('good_answer_summary', '')}"

Key terms expected: {concept.get('key_terms', [])}

Student's answer:
"{transcript[:800]}"

Evaluate and return JSON only — no markdown:
{{
  "score": <number 1-10>,
  "result": "solid" | "needs_work",
  "feedback": "<2-3 sentences of specific technical feedback>",
  "missing_points": ["<concept they missed 1>", "<concept they missed 2>"]
}}

Be specific about what was correct and what was missing technically."""

    try:
        client = anthropic.Anthropic(api_key=api_key)
        response = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=300,
            messages=[{"role": "user", "content": prompt}],
        )
        raw = ""
        for block in getattr(response, "content", []):
            if getattr(block, "type", "") == "text":
                raw += getattr(block, "text", "")

        clean = raw.strip()
        clean = re.sub(r"^```[a-z]*\n?", "", clean)
        clean = re.sub(r"\n?```$", "", clean)
        parsed = json.loads(clean.strip())

        return {
            "result": parsed.get("result", "needs_work"),
            "score": min(10, max(0, float(parsed.get("score", 5)))),
            "feedback": parsed.get("feedback", ""),
            "missing_points": parsed.get("missing_points", []),
        }

    except Exception as e:
        log.warning("[TOPIC_PRACTICE] Claude eval failed: %s", e)
        return _fallback_evaluation(transcript, concept)


def _fallback_evaluation(transcript: str, concept: dict) -> dict:
    words = len(transcript.strip().split())
    score = min(6.0, max(2.0, words / 20))
    return {
        "result": "needs_work" if score < 5 else "solid",
        "score": score,
        "feedback": concept.get("refresher_short", "Review this concept and try again."),
        "missing_points": [],
    }


def _compute_depth(solid: int, total: int, topic: str) -> str:
    if total == 0:
        return "basic"
    pct = solid / total
    if pct >= 0.8:
        return "advanced"
    if pct >= 0.5:
        return "intermediate"
    return "basic"


# ─── Endpoints ────────────────────────────────────────────────────────────────

@router.get("/topics")
def get_topics() -> dict:
    """Return the topic tree for the topic selector UI."""
    return {"topics": TOPIC_TREE}


@router.post("/start")
def start_session(
    payload: StartRequest,
    db: Session = Depends(_get_db),
    current_user=Depends(get_current_user),
) -> dict:
    """Start a topic practice session."""
    plan = _get_user_plan(db, current_user.id)

    # Free tier limit check
    if plan == "free" and not _check_free_limit(db, current_user.id):
        raise HTTPException(
            status_code=403,
            detail="topic_practice_limit_reached",
        )

    topic = payload.topic
    subtopic = payload.subtopic
    count = min(payload.question_count, 10)

    # Validate topic
    if topic not in TOPIC_TREE:
        raise HTTPException(status_code=400, detail="invalid_topic")

    is_behavioral = topic == "Behavioral"

    # Fetch concepts
    concepts = _fetch_concepts(
        db, topic, subtopic, count,
        exclude_recent=True,
        user_id=current_user.id,
    )

    if not concepts:
        raise HTTPException(
            status_code=404,
            detail="no_concepts_available"
        )

    # Build question list
    questions = []
    for c in concepts:
        questions.append({
            "concept_id": str(c["id"]),
            "question_text": _generate_question(c, topic, is_behavioral),
            "concept_name": c["concept_name"],
            "topic": c["topic"],
            "subtopic": c.get("subtopic"),
            "difficulty": c.get("difficulty", "medium"),
            "refresher_short": c["refresher_short"],
            "interview_edge_tip": c.get("interview_edge_tip"),
        })

    # Create session row
    session_id = db.execute(
        text("""
            INSERT INTO topic_practice_sessions
                (user_id, topic, subtopic, questions_asked)
            VALUES (:uid, :topic, :subtopic, :count)
            RETURNING id
        """),
        {
            "uid": current_user.id,
            "topic": topic,
            "subtopic": subtopic if subtopic != "all" else None,
            "count": len(questions),
        },
    ).scalar()
    db.commit()

    return {
        "session_id": str(session_id),
        "topic": topic,
        "subtopic": subtopic,
        "is_behavioral": is_behavioral,
        "total_questions": len(questions),
        "questions": questions,
        "plan": plan,
    }


@router.post("/respond")
def respond(
    payload: RespondRequest,
    db: Session = Depends(_get_db),
    current_user=Depends(get_current_user),
) -> dict:
    """Evaluate student's answer and return feedback."""
    is_behavioral = payload.topic == "Behavioral"

    # Load concept if concept_id provided
    concept: dict = {}
    if payload.concept_id:
        row = db.execute(
            text("""
                SELECT id, concept_name, good_answer_summary, refresher_short,
                       refresher_full, interview_edge_tip, key_terms
                FROM quick_prep_concepts
                WHERE id = CAST(:cid AS uuid)
            """),
            {"cid": payload.concept_id},
        ).mappings().first()
        if row:
            concept = dict(row)

    # Evaluate
    evaluation = _evaluate_answer(
        question_text=payload.question_text,
        transcript=payload.transcript,
        concept=concept,
        topic=payload.topic,
        is_behavioral=is_behavioral,
    )

    # Build AI response text
    feedback = evaluation["feedback"]
    if evaluation["result"] == "solid" and concept.get("interview_edge_tip"):
        feedback += f" One thing to add if they push deeper: {concept['interview_edge_tip']}"

    refresher = ""
    if evaluation["result"] == "needs_work" and concept.get("refresher_short"):
        refresher = concept["refresher_short"]

    # Log result
    db.execute(
        text("""
            INSERT INTO topic_practice_results
                (session_id, concept_id, question_text, student_transcript,
                 ai_feedback, result, score)
            VALUES (
                CAST(:sid AS uuid),
                CAST(:cid AS uuid),
                :question, :transcript, :feedback, :result, :score
            )
        """),
        {
            "sid": payload.session_id,
            "cid": payload.concept_id,
            "question": payload.question_text,
            "transcript": payload.transcript,
            "feedback": feedback,
            "result": evaluation["result"],
            "score": evaluation["score"],
        },
    )
    db.commit()

    return {
        "result": evaluation["result"],
        "score": evaluation["score"],
        "feedback": feedback,
        "refresher": refresher,
        "missing_points": evaluation.get("missing_points", []),
        "show_refresher": evaluation["result"] == "needs_work",
    }


@router.post("/end")
def end_session(
    payload: EndRequest,
    db: Session = Depends(_get_db),
    current_user=Depends(get_current_user),
) -> dict:
    """Finalize session and return depth report."""
    # Load all results for this session
    results = db.execute(
        text("""
            SELECT tpr.result, tpr.score, tpr.question_text,
                   tpr.ai_feedback, tpr.missing_points,
                   qpc.concept_name, qpc.subtopic, qpc.refresher_short
            FROM topic_practice_results tpr
            LEFT JOIN quick_prep_concepts qpc ON qpc.id = tpr.concept_id
            WHERE tpr.session_id = CAST(:sid AS uuid)
            ORDER BY tpr.created_at ASC
        """),
        {"sid": payload.session_id},
    ).mappings().all()

    # Load session info
    session = db.execute(
        text("""
            SELECT topic, subtopic, questions_asked
            FROM topic_practice_sessions
            WHERE id = CAST(:sid AS uuid)
        """),
        {"sid": payload.session_id},
    ).mappings().first()

    if not results:
        return {
            "questions_asked": 0,
            "solid": 0,
            "needs_work": 0,
            "skipped": 0,
            "depth_reached": "basic",
            "avg_score": 0,
            "weak_concepts": [],
            "next_recommended": None,
        }

    solid = sum(1 for r in results if r["result"] == "solid")
    needs_work = sum(1 for r in results if r["result"] == "needs_work")
    skipped = sum(1 for r in results if r["result"] == "skipped")
    scores = [float(r["score"]) for r in results if r["score"] and r["result"] != "skipped"]
    avg_score = round(sum(scores) / len(scores), 1) if scores else 0

    total = len(results)
    depth = _compute_depth(solid, total, session["topic"] if session else "")

    # Weak concepts — what to review
    weak_concepts = [
        {
            "concept_name": r["concept_name"] or r["question_text"][:60],
            "subtopic": r["subtopic"],
            "refresher": r["refresher_short"],
        }
        for r in results
        if r["result"] == "needs_work"
    ][:4]

    # Recommend next subtopic
    topic = session["topic"] if session else ""
    current_subtopic = session["subtopic"] if session else None
    next_recommended = _recommend_next(topic, current_subtopic)

    # Update session with final counts
    db.execute(
        text("""
            UPDATE topic_practice_sessions
            SET questions_solid = :solid,
                questions_needs_work = :needs_work,
                questions_skipped = :skipped,
                depth_reached = :depth
            WHERE id = CAST(:sid AS uuid)
        """),
        {
            "solid": solid,
            "needs_work": needs_work,
            "skipped": skipped,
            "depth": depth,
            "sid": payload.session_id,
        },
    )
    db.commit()

    return {
        "topic": topic,
        "subtopic": current_subtopic,
        "questions_asked": total,
        "solid": solid,
        "needs_work": needs_work,
        "skipped": skipped,
        "depth_reached": depth,
        "avg_score": avg_score,
        "weak_concepts": weak_concepts,
        "next_recommended": next_recommended,
    }


def _recommend_next(topic: str, current_subtopic: Optional[str]) -> Optional[dict]:
    """Recommend the next subtopic to practice."""
    if topic not in TOPIC_TREE:
        return None

    subtopics = TOPIC_TREE[topic]["subtopics"]
    # Skip "all" option
    real_subtopics = [s for s in subtopics if s["key"] != "all"]

    if not current_subtopic:
        return real_subtopics[0] if real_subtopics else None

    # Find current and return next
    for i, s in enumerate(real_subtopics):
        if s["key"] == current_subtopic:
            next_idx = (i + 1) % len(real_subtopics)
            return real_subtopics[next_idx]

    return real_subtopics[0] if real_subtopics else None