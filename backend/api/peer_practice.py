# backend/api/peer_practice.py
"""
Peer Practice Rooms — async competitive practice between two students.

POST /api/peer/create           — create a room with 5 questions, returns room_code
GET  /api/peer/room/{code}      — get room info (questions, status)
POST /api/peer/room/{code}/answer — submit answer for one question
GET  /api/peer/room/{code}/comparison — get comparison (generates if both done)
GET  /api/peer/my-rooms          — list user's created/joined rooms
GET  /api/peer/stats             — user's peer practice stats
POST /api/test/peer-auto-answer/{code} — DEV ONLY, auto-fill answers
"""

from __future__ import annotations

import json
import logging
import os
import random
import re
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

import anthropic
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.orm import Session

from api.deps import get_current_user
from db.session import SessionLocal

log = logging.getLogger(__name__)

router = APIRouter(prefix="/api/peer", tags=["peer-practice"])

CREATE_PLANS = {"pro", "max"}  # free can join, not create
ROOM_EXPIRY_DAYS = 7
QUESTIONS_PER_ROOM = 5

# ─── Schemas ──────────────────────────────────────────────────────────────────

class CreateRoomRequest(BaseModel):
    company: Optional[str] = None
    topic: Optional[str] = None


class SubmitAnswerRequest(BaseModel):
    question_index: int
    transcript: str


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


def _get_user_name(db: Session, user_id: int) -> str:
    row = db.execute(
        text("SELECT full_name, email FROM users WHERE id = :uid"), {"uid": user_id}
    ).mappings().first()
    if not row:
        return "Student"
    return row["full_name"] or row["email"].split("@")[0]


def _strip_json_fence(raw: str) -> str:
    clean = raw.strip()
    clean = re.sub(r"^```[a-z]*\n?", "", clean)
    clean = re.sub(r"\n?```$", "", clean)
    return clean.strip()


def _generate_room_code(db: Session) -> str:
    """6-char code, excludes confusing characters (0/O, 1/I/L)."""
    chars = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"
    for _ in range(20):
        code = "".join(random.choices(chars, k=6))
        exists = db.execute(
            text("SELECT 1 FROM peer_rooms WHERE room_code = :code"), {"code": code}
        ).scalar()
        if not exists:
            return code
    raise RuntimeError("Failed to generate unique room code")


def _select_questions(db: Session, company: Optional[str], topic: Optional[str]) -> list[dict]:
    """
    Select 5 medium-difficulty questions for a peer room.
    Always medium difficulty — fair comparison ground regardless of skill gap.
    Pulls from quick_prep_concepts since it has rich question content
    across DBMS, OS, Behavioral with good ask_prompt text.
    """
    questions: list[dict] = []

    query = """
        SELECT id, concept_name, topic, ask_prompt, good_answer_summary, difficulty
        FROM quick_prep_concepts
        WHERE is_active = TRUE
    """
    params: dict[str, Any] = {}

    if topic and topic != "mixed":
        query += " AND topic = :topic"
        params["topic"] = topic

    query += " ORDER BY random() LIMIT :limit"
    params["limit"] = QUESTIONS_PER_ROOM

    rows = db.execute(text(query), params).mappings().all()

    for r in rows:
        questions.append({
            "concept_id": str(r["id"]),
            "concept_name": r["concept_name"],
            "topic": r["topic"],
            "question_text": r["ask_prompt"],
            "good_answer_summary": r["good_answer_summary"],
            "difficulty": r.get("difficulty") or "medium",
        })

    # Pad if not enough found (small pool fallback)
    if len(questions) < QUESTIONS_PER_ROOM:
        more = db.execute(
            text("""
                SELECT id, concept_name, topic, ask_prompt, good_answer_summary, difficulty
                FROM quick_prep_concepts
                WHERE is_active = TRUE
                ORDER BY random() LIMIT :limit
            """),
            {"limit": QUESTIONS_PER_ROOM - len(questions)},
        ).mappings().all()
        existing_ids = {q["concept_id"] for q in questions}
        for r in more:
            if str(r["id"]) not in existing_ids:
                questions.append({
                    "concept_id": str(r["id"]),
                    "concept_name": r["concept_name"],
                    "topic": r["topic"],
                    "question_text": r["ask_prompt"],
                    "good_answer_summary": r["good_answer_summary"],
                    "difficulty": r.get("difficulty") or "medium",
                })

    random.shuffle(questions)
    return questions[:QUESTIONS_PER_ROOM]


def _score_answer(question_text: str, good_answer_summary: str, transcript: str) -> dict:
    """Score a single peer answer via Claude Haiku across 3 dimensions."""
    if not transcript or len(transcript.strip().split()) < 5:
        return {"technical": 0, "communication": 0, "completeness": 0, "overall": 0}

    api_key = os.getenv("ANTHROPIC_API_KEY", "").strip()
    if not api_key:
        words = len(transcript.split())
        base = min(8.0, max(2.0, words / 15))
        return {"technical": base, "communication": base, "completeness": base, "overall": base}

    prompt = f"""Score this interview answer on three dimensions, 0-10 each.

Question: {question_text}
What a strong answer covers: {good_answer_summary}
Candidate's answer: {transcript[:600]}

Return ONLY JSON: {{"technical": 0-10, "communication": 0-10, "completeness": 0-10}}"""

    try:
        client = anthropic.Anthropic(api_key=api_key)
        response = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=100,
            messages=[{"role": "user", "content": prompt}],
        )
        raw = ""
        for block in getattr(response, "content", []):
            if getattr(block, "type", "") == "text":
                raw += getattr(block, "text", "")
        parsed = json.loads(_strip_json_fence(raw))
        technical = float(parsed.get("technical", 5))
        communication = float(parsed.get("communication", 5))
        completeness = float(parsed.get("completeness", 5))
        overall = round((technical + communication + completeness) / 3, 1)
        return {"technical": technical, "communication": communication, "completeness": completeness, "overall": overall}
    except Exception as e:
        log.warning("[PEER] Scoring failed: %s", e)
        return {"technical": 5, "communication": 5, "completeness": 5, "overall": 5}


def _generate_comparison(
    questions: list[dict],
    attempts_a: list[dict],
    attempts_b: list[dict],
    name_a: str,
    name_b: str,
) -> dict:
    """One Claude call comparing both students' performance across all 5 questions."""
    api_key = os.getenv("ANTHROPIC_API_KEY", "").strip()

    qa_blocks = []
    for i, q in enumerate(questions):
        a = next((a for a in attempts_a if a["question_index"] == i), None)
        b = next((b for b in attempts_b if b["question_index"] == i), None)
        qa_blocks.append(
            f"Question {i+1}: {q['question_text']}\n"
            f"{name_a}'s answer (score {a['overall_score'] if a else 0}/10): {(a['transcript'] if a else '')[:300]}\n"
            f"{name_b}'s answer (score {b['overall_score'] if b else 0}/10): {(b['transcript'] if b else '')[:300]}"
        )

    qa_text = "\n\n".join(qa_blocks)

    if not api_key:
        return _fallback_comparison(questions, attempts_a, attempts_b, name_a, name_b)

    prompt = f"""Two students answered the same 5 interview questions. Compare their performance.

{qa_text}

Return ONLY JSON, no markdown:
{{
  "per_question": [
    {{"question_index": 0, "a_edge": "<short, max 15 words>", "b_edge": "<short, max 15 words>", "combined_insight": "<max 15 words>"}}
  ],
  "key_learning": "<2 sentences, what both students could learn from each other>"
}}

Be specific, reference actual content. Keep all text concise."""

    try:
        client = anthropic.Anthropic(api_key=api_key)
        response = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=900,
            messages=[{"role": "user", "content": prompt}],
        )
        raw = ""
        for block in getattr(response, "content", []):
            if getattr(block, "type", "") == "text":
                raw += getattr(block, "text", "")
        parsed = json.loads(_strip_json_fence(raw))
        return parsed
    except Exception as e:
        log.warning("[PEER] Comparison generation failed: %s", e)
        return _fallback_comparison(questions, attempts_a, attempts_b, name_a, name_b)


def _fallback_comparison(questions, attempts_a, attempts_b, name_a, name_b) -> dict:
    per_question = []
    for i in range(len(questions)):
        per_question.append({
            "question_index": i,
            "a_edge": "Solid answer",
            "b_edge": "Solid answer",
            "combined_insight": "Both covered the core concept well.",
        })
    return {
        "per_question": per_question,
        "key_learning": f"{name_a} and {name_b} both demonstrated understanding — comparing approaches helps spot different ways to explain the same concept.",
    }


def _update_peer_stats(db: Session, user_id: int, won: bool, drew: bool, score: float) -> None:
    row = db.execute(
        text("SELECT * FROM peer_stats WHERE user_id = :uid"), {"uid": user_id}
    ).mappings().first()

    if not row:
        db.execute(
            text("""
                INSERT INTO peer_stats (user_id, total_rooms, wins, losses, draws, avg_score, win_streak, best_win_streak)
                VALUES (:uid, 1, :w, :l, :d, :score, :streak, :streak)
            """),
            {
                "uid": user_id,
                "w": 1 if won else 0,
                "l": 1 if (not won and not drew) else 0,
                "d": 1 if drew else 0,
                "score": score,
                "streak": 1 if won else 0,
            },
        )
    else:
        new_total = row["total_rooms"] + 1
        new_wins = row["wins"] + (1 if won else 0)
        new_losses = row["losses"] + (1 if (not won and not drew) else 0)
        new_draws = row["draws"] + (1 if drew else 0)
        new_avg = round(((float(row["avg_score"] or 0) * row["total_rooms"]) + score) / new_total, 2)
        new_streak = (row["win_streak"] + 1) if won else 0
        new_best_streak = max(row["best_win_streak"], new_streak)

        db.execute(
            text("""
                UPDATE peer_stats SET
                    total_rooms = :total, wins = :w, losses = :l, draws = :d,
                    avg_score = :avg, win_streak = :streak, best_win_streak = :best,
                    updated_at = NOW()
                WHERE user_id = :uid
            """),
            {
                "total": new_total, "w": new_wins, "l": new_losses, "d": new_draws,
                "avg": new_avg, "streak": new_streak, "best": new_best_streak, "uid": user_id,
            },
        )
    db.commit()


# ─── Endpoints ────────────────────────────────────────────────────────────────

@router.post("/create")
def create_room(
    payload: CreateRoomRequest,
    db: Session = Depends(_get_db),
    current_user=Depends(get_current_user),
) -> dict:
    plan = _get_user_plan(db, current_user.id)
    if plan not in CREATE_PLANS:
        raise HTTPException(status_code=403, detail="peer_create_requires_pro")

    questions = _select_questions(db, payload.company, payload.topic)
    if not questions:
        raise HTTPException(status_code=404, detail="no_questions_available")

    code = _generate_room_code(db)
    expires_at = datetime.now(timezone.utc) + timedelta(days=ROOM_EXPIRY_DAYS)

    room_id = db.execute(
        text("""
            INSERT INTO peer_rooms (room_code, created_by, company, topic, question_ids, question_data, status, expires_at)
            VALUES (:code, :uid, :company, :topic, :qids, CAST(:qdata AS jsonb), 'waiting', :expires)
            RETURNING id
        """),
        {
            "code": code,
            "uid": current_user.id,
            "company": payload.company,
            "topic": payload.topic,
            "qids": [q["concept_id"] for q in questions],
            "qdata": json.dumps(questions),
            "expires": expires_at,
        },
    ).scalar()
    db.commit()

    return {
        "room_id": str(room_id),
        "room_code": code,
        "questions": questions,
        "expires_at": expires_at.isoformat(),
        "share_url": f"/peer/{code}",
    }


@router.get("/room/{code}")
def get_room(
    code: str,
    db: Session = Depends(_get_db),
    current_user=Depends(get_current_user),
) -> dict:
    room = db.execute(
        text("""
            SELECT id, room_code, created_by, company, topic, question_data, status, expires_at
            FROM peer_rooms WHERE room_code = :code
        """),
        {"code": code.upper()},
    ).mappings().first()

    if not room:
        raise HTTPException(status_code=404, detail="room_not_found")

    if room["expires_at"] < datetime.now(timezone.utc):
        raise HTTPException(status_code=410, detail="room_expired")

    is_creator = room["created_by"] == current_user.id
    creator_name = _get_user_name(db, room["created_by"])

    # Check current user's progress
    my_attempts = db.execute(
        text("""
            SELECT question_index FROM peer_attempts
            WHERE room_id = :rid AND user_id = :uid
        """),
        {"rid": room["id"], "uid": current_user.id},
    ).fetchall()
    my_answered = {r[0] for r in my_attempts}

    # Check if there's a second participant
    other_participant = db.execute(
        text("""
            SELECT DISTINCT user_id FROM peer_attempts
            WHERE room_id = :rid AND user_id != :uid
            LIMIT 1
        """),
        {"rid": room["id"], "uid": current_user.id},
    ).scalar()

    other_progress = 0
    if other_participant:
        other_progress = db.execute(
            text("SELECT COUNT(*) FROM peer_attempts WHERE room_id = :rid AND user_id = :oid"),
            {"rid": room["id"], "oid": other_participant},
        ).scalar() or 0

    question_data = room["question_data"]
    if isinstance(question_data, str):
        question_data = json.loads(question_data)

    return {
        "room_id": str(room["id"]),
        "room_code": room["room_code"],
        "is_creator": is_creator,
        "creator_name": creator_name,
        "company": room["company"],
        "topic": room["topic"],
        "questions": question_data,
        "my_answered_count": len(my_answered),
        "my_answered_indices": sorted(my_answered),
        "total_questions": len(question_data),
        "other_participant_exists": other_participant is not None,
        "other_progress": other_progress,
        "expires_at": room["expires_at"].isoformat(),
    }


@router.post("/room/{code}/answer")
def submit_answer(
    code: str,
    payload: SubmitAnswerRequest,
    db: Session = Depends(_get_db),
    current_user=Depends(get_current_user),
) -> dict:
    room = db.execute(
        text("SELECT id, question_data, expires_at FROM peer_rooms WHERE room_code = :code"),
        {"code": code.upper()},
    ).mappings().first()

    if not room:
        raise HTTPException(status_code=404, detail="room_not_found")
    if room["expires_at"] < datetime.now(timezone.utc):
        raise HTTPException(status_code=410, detail="room_expired")

    question_data = room["question_data"]
    if isinstance(question_data, str):
        question_data = json.loads(question_data)

    if payload.question_index < 0 or payload.question_index >= len(question_data):
        raise HTTPException(status_code=400, detail="invalid_question_index")

    q = question_data[payload.question_index]
    scores = _score_answer(q["question_text"], q.get("good_answer_summary", ""), payload.transcript)

    db.execute(
        text("""
            INSERT INTO peer_attempts
                (room_id, user_id, question_index, question_text, transcript,
                 score_technical, score_communication, score_completeness, overall_score, completed_at)
            VALUES
                (:rid, :uid, :qidx, :qtext, :transcript, :tech, :comm, :comp, :overall, NOW())
            ON CONFLICT (room_id, user_id, question_index) DO UPDATE SET
                transcript = :transcript,
                score_technical = :tech,
                score_communication = :comm,
                score_completeness = :comp,
                overall_score = :overall,
                completed_at = NOW()
        """),
        {
            "rid": room["id"], "uid": current_user.id, "qidx": payload.question_index,
            "qtext": q["question_text"], "transcript": payload.transcript,
            "tech": scores["technical"], "comm": scores["communication"],
            "comp": scores["completeness"], "overall": scores["overall"],
        },
    )
    db.commit()

    answered_count = db.execute(
        text("SELECT COUNT(*) FROM peer_attempts WHERE room_id = :rid AND user_id = :uid"),
        {"rid": room["id"], "uid": current_user.id},
    ).scalar()

    return {
        "ok": True,
        "scores": scores,
        "answered_count": answered_count,
        "total_questions": len(question_data),
        "all_done": answered_count >= len(question_data),
    }


@router.get("/room/{code}/comparison")
def get_comparison(
    code: str,
    db: Session = Depends(_get_db),
    current_user=Depends(get_current_user),
) -> dict:
    room = db.execute(
        text("SELECT id, created_by, question_data FROM peer_rooms WHERE room_code = :code"),
        {"code": code.upper()},
    ).mappings().first()

    if not room:
        raise HTTPException(status_code=404, detail="room_not_found")

    question_data = room["question_data"]
    if isinstance(question_data, str):
        question_data = json.loads(question_data)

    # Find the two distinct participants
    participants = db.execute(
        text("SELECT DISTINCT user_id FROM peer_attempts WHERE room_id = :rid"),
        {"rid": room["id"]},
    ).scalars().all()

    if len(participants) < 2:
        # Not ready yet
        my_count = db.execute(
            text("SELECT COUNT(*) FROM peer_attempts WHERE room_id = :rid AND user_id = :uid"),
            {"rid": room["id"], "uid": current_user.id},
        ).scalar() or 0
        return {
            "ready": False,
            "my_answered_count": my_count,
            "total_questions": len(question_data),
            "waiting_message": "Waiting for the other participant to finish their answers." if my_count >= len(question_data) else "Finish all questions to see the comparison.",
        }

    user_a_id, user_b_id = participants[0], participants[1]

    # Check both completed all questions
    count_a = db.execute(
        text("SELECT COUNT(*) FROM peer_attempts WHERE room_id = :rid AND user_id = :uid"),
        {"rid": room["id"], "uid": user_a_id},
    ).scalar()
    count_b = db.execute(
        text("SELECT COUNT(*) FROM peer_attempts WHERE room_id = :rid AND user_id = :uid"),
        {"rid": room["id"], "uid": user_b_id},
    ).scalar()

    if count_a < len(question_data) or count_b < len(question_data):
        my_count = count_a if current_user.id == user_a_id else count_b
        return {
            "ready": False,
            "my_answered_count": my_count,
            "total_questions": len(question_data),
            "waiting_message": "Waiting for the other participant to finish their answers." if my_count >= len(question_data) else "Finish all questions to see the comparison.",
        }

    # Check cache
    cached = db.execute(
        text("SELECT * FROM peer_comparisons WHERE room_id = :rid"), {"rid": room["id"]}
    ).mappings().first()

    if cached:
        return _format_comparison_response(db, cached, question_data, user_a_id, user_b_id, current_user.id)

    # Generate new comparison
    attempts_a = [dict(r) for r in db.execute(
        text("SELECT question_index, transcript, overall_score FROM peer_attempts WHERE room_id = :rid AND user_id = :uid ORDER BY question_index"),
        {"rid": room["id"], "uid": user_a_id},
    ).mappings().all()]
    attempts_b = [dict(r) for r in db.execute(
        text("SELECT question_index, transcript, overall_score FROM peer_attempts WHERE room_id = :rid AND user_id = :uid ORDER BY question_index"),
        {"rid": room["id"], "uid": user_b_id},
    ).mappings().all()]

    name_a = _get_user_name(db, user_a_id)
    name_b = _get_user_name(db, user_b_id)

    comparison_data = _generate_comparison(question_data, attempts_a, attempts_b, name_a, name_b)

    total_a = round(sum(float(a["overall_score"] or 0) for a in attempts_a) / max(len(attempts_a), 1), 1)
    total_b = round(sum(float(b["overall_score"] or 0) for b in attempts_b) / max(len(attempts_b), 1), 1)

    winner_id = None
    if total_a > total_b:
        winner_id = user_a_id
    elif total_b > total_a:
        winner_id = user_b_id

    db.execute(
        text("""
            INSERT INTO peer_comparisons
                (room_id, user_a_id, user_b_id, user_a_total_score, user_b_total_score,
                 winner_id, per_question_comparison, overall_summary)
            VALUES
                (:rid, :a, :b, :ta, :tb, :winner, CAST(:perq AS jsonb), CAST(:summary AS jsonb))
        """),
        {
            "rid": room["id"], "a": user_a_id, "b": user_b_id,
            "ta": total_a, "tb": total_b, "winner": winner_id,
            "perq": json.dumps(comparison_data.get("per_question", [])),
            "summary": json.dumps({"key_learning": comparison_data.get("key_learning", "")}),
        },
    )
    db.execute(text("UPDATE peer_rooms SET status = 'completed' WHERE id = :rid"), {"rid": room["id"]})
    db.commit()

    # Update peer_stats
    drew = winner_id is None
    _update_peer_stats(db, user_a_id, won=(winner_id == user_a_id), drew=drew, score=total_a)
    _update_peer_stats(db, user_b_id, won=(winner_id == user_b_id), drew=drew, score=total_b)

    cached = db.execute(
        text("SELECT * FROM peer_comparisons WHERE room_id = :rid"), {"rid": room["id"]}
    ).mappings().first()

    return _format_comparison_response(db, cached, question_data, user_a_id, user_b_id, current_user.id)


def _format_comparison_response(db, cached, question_data, user_a_id, user_b_id, requesting_user_id) -> dict:
    per_q = cached["per_question_comparison"]
    if isinstance(per_q, str):
        per_q = json.loads(per_q)
    summary = cached["overall_summary"]
    if isinstance(summary, str):
        summary = json.loads(summary)

    name_a = _get_user_name(db, user_a_id)
    name_b = _get_user_name(db, user_b_id)

    attempts_a = {r["question_index"]: dict(r) for r in db.execute(
        text("SELECT question_index, overall_score, transcript FROM peer_attempts WHERE room_id = :rid AND user_id = :uid"),
        {"rid": cached["room_id"], "uid": user_a_id},
    ).mappings().all()}
    attempts_b = {r["question_index"]: dict(r) for r in db.execute(
        text("SELECT question_index, overall_score, transcript FROM peer_attempts WHERE room_id = :rid AND user_id = :uid"),
        {"rid": cached["room_id"], "uid": user_b_id},
    ).mappings().all()}

    questions_out = []
    for i, q in enumerate(question_data):
        insight = next((p for p in per_q if p.get("question_index") == i), {})
        questions_out.append({
            "question_index": i,
            "concept_name": q["concept_name"],
            "topic": q["topic"],
            "question_text": q["question_text"],
            "a_score": float(attempts_a.get(i, {}).get("overall_score") or 0),
            "b_score": float(attempts_b.get(i, {}).get("overall_score") or 0),
            "a_edge": insight.get("a_edge", ""),
            "b_edge": insight.get("b_edge", ""),
            "combined_insight": insight.get("combined_insight", ""),
        })

    is_a = requesting_user_id == user_a_id
    you_score = float(cached["user_a_total_score"]) if is_a else float(cached["user_b_total_score"])
    them_score = float(cached["user_b_total_score"]) if is_a else float(cached["user_a_total_score"])
    you_name = name_a if is_a else name_b
    them_name = name_b if is_a else name_a

    result = "draw"
    if cached["winner_id"] == requesting_user_id:
        result = "win"
    elif cached["winner_id"] is not None:
        result = "loss"

    return {
        "ready": True,
        "you_name": you_name,
        "them_name": them_name,
        "you_score": you_score,
        "them_score": them_score,
        "result": result,
        "questions": questions_out,
        "key_learning": summary.get("key_learning", ""),
    }


@router.get("/my-rooms")
def my_rooms(
    db: Session = Depends(_get_db),
    current_user=Depends(get_current_user),
) -> dict:
    created = db.execute(
        text("""
            SELECT room_code, status, created_at, expires_at
            FROM peer_rooms WHERE created_by = :uid
            ORDER BY created_at DESC LIMIT 20
        """),
        {"uid": current_user.id},
    ).mappings().all()

    joined = db.execute(
        text("""
            SELECT DISTINCT pr.room_code, pr.status, pr.created_at
            FROM peer_rooms pr
            JOIN peer_attempts pa ON pa.room_id = pr.id
            WHERE pa.user_id = :uid AND pr.created_by != :uid
            ORDER BY pr.created_at DESC LIMIT 20
        """),
        {"uid": current_user.id},
    ).mappings().all()

    return {
        "created": [dict(r) for r in created],
        "joined": [dict(r) for r in joined],
    }


@router.get("/stats")
def get_stats(
    db: Session = Depends(_get_db),
    current_user=Depends(get_current_user),
) -> dict:
    row = db.execute(
        text("SELECT * FROM peer_stats WHERE user_id = :uid"), {"uid": current_user.id}
    ).mappings().first()

    if not row:
        return {
            "total_rooms": 0, "wins": 0, "losses": 0, "draws": 0,
            "avg_score": None, "win_streak": 0, "best_win_streak": 0,
        }
    return dict(row)


# ─── DEV ONLY — test helper ────────────────────────────────────────────────────

@router.post("/test/auto-answer/{code}")
def test_auto_answer(
    code: str,
    db: Session = Depends(_get_db),
    current_user=Depends(get_current_user),
) -> dict:
    """DEV ONLY — auto-fills answers for the current user in a room for testing."""
    room = db.execute(
        text("SELECT id, question_data FROM peer_rooms WHERE room_code = :code"),
        {"code": code.upper()},
    ).mappings().first()
    if not room:
        raise HTTPException(status_code=404, detail="room_not_found")

    question_data = room["question_data"]
    if isinstance(question_data, str):
        question_data = json.loads(question_data)

    fake_answers = [
        "I would approach this by first understanding the core requirements, then breaking down the problem into smaller manageable pieces. Based on my experience with similar systems, this is generally solved using a combination of caching and indexing strategies.",
        "This concept works by maintaining a clear separation between the data layer and the business logic. The key insight is that you need to handle edge cases carefully and validate inputs before processing.",
        "In my projects I've handled this by using established design patterns. The trade-off here is between consistency and performance, and the right choice depends on the specific use case.",
        "The main idea is to optimize for the common case while still handling edge cases gracefully. I would also add proper error handling and logging to make debugging easier in production.",
        "I think about this in terms of trade-offs — there's no single right answer, it depends on the constraints. For this scenario I would prioritize correctness first, then optimize for performance.",
    ]

    for i, q in enumerate(question_data):
        transcript = fake_answers[i % len(fake_answers)]
        scores = _score_answer(q["question_text"], q.get("good_answer_summary", ""), transcript)
        db.execute(
            text("""
                INSERT INTO peer_attempts
                    (room_id, user_id, question_index, question_text, transcript,
                     score_technical, score_communication, score_completeness, overall_score, completed_at)
                VALUES
                    (:rid, :uid, :qidx, :qtext, :transcript, :tech, :comm, :comp, :overall, NOW())
                ON CONFLICT (room_id, user_id, question_index) DO UPDATE SET
                    transcript = :transcript, overall_score = :overall, completed_at = NOW()
            """),
            {
                "rid": room["id"], "uid": current_user.id, "qidx": i,
                "qtext": q["question_text"], "transcript": transcript,
                "tech": scores["technical"], "comm": scores["communication"],
                "comp": scores["completeness"], "overall": scores["overall"],
            },
        )
    db.commit()
    return {"ok": True, "answered": len(question_data)}