# backend/api/admin.py
"""
Admin Panel API — all endpoints.
Every route checks is_superuser — returns 403 otherwise.
"""

from __future__ import annotations

import json
import logging
from datetime import datetime, timezone, timedelta
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.orm import Session

from api.deps import get_current_user
from db.session import SessionLocal

log = logging.getLogger(__name__)

router = APIRouter(prefix="/api/admin", tags=["admin"])


# ─── DB + Auth helpers ────────────────────────────────────────────────────────

def _get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _require_admin(current_user=Depends(get_current_user)):
    if not current_user.is_superuser:
        raise HTTPException(status_code=403, detail="admin_only")
    return current_user


# ─── Overview ─────────────────────────────────────────────────────────────────

@router.get("/overview")
def get_overview(
    db: Session = Depends(_get_db),
    _=Depends(_require_admin),
) -> dict:
    today = datetime.now(timezone.utc).date()
    week_ago = today - timedelta(days=7)
    month_ago = today - timedelta(days=30)

    def scalar(q, params={}):
        try:
            return db.execute(text(q), params).scalar() or 0
        except Exception:
            db.rollback()
            return 0

    # Today
    users_today = scalar("SELECT COUNT(*) FROM users WHERE created_at::date = :d", {"d": today})
    sessions_today = scalar("SELECT COUNT(*) FROM mock_sessions WHERE created_at::date = :d", {"d": today})
    dsa_today = scalar("SELECT COUNT(*) FROM dsa_attempts WHERE created_at::date = :d", {"d": today})
    active_today = scalar("""
        SELECT COUNT(DISTINCT user_id) FROM mock_sessions
        WHERE created_at::date = :d
    """, {"d": today})

    # This week
    users_week = scalar("SELECT COUNT(*) FROM users WHERE created_at::date >= :d", {"d": week_ago})
    sessions_week = scalar("SELECT COUNT(*) FROM mock_sessions WHERE created_at::date >= :d", {"d": week_ago})
    dsa_week = scalar("SELECT COUNT(*) FROM dsa_attempts WHERE created_at::date >= :d", {"d": week_ago})

    # This month
    users_month = scalar("SELECT COUNT(*) FROM users WHERE created_at::date >= :d", {"d": month_ago})
    sessions_month = scalar("SELECT COUNT(*) FROM mock_sessions WHERE created_at::date >= :d", {"d": month_ago})
    dsa_month = scalar("SELECT COUNT(*) FROM dsa_attempts WHERE created_at::date >= :d", {"d": month_ago})

    # Totals
    total_users = scalar("SELECT COUNT(*) FROM users")
    total_sessions = scalar("SELECT COUNT(*) FROM mock_sessions")
    total_dsa = scalar("SELECT COUNT(*) FROM dsa_attempts")
    total_questions = scalar("SELECT COUNT(*) FROM interview_questions")
    total_dsa_questions = scalar("SELECT COUNT(*) FROM dsa_questions WHERE is_active = TRUE")

    # Plan distribution
    plan_dist = db.execute(text("""
        SELECT plan, COUNT(*) as count FROM users GROUP BY plan ORDER BY count DESC
    """)).mappings().all()

    # Signup trend (last 30 days)
    signup_trend = db.execute(text("""
        SELECT created_at::date as day, COUNT(*) as count
        FROM users
        WHERE created_at::date >= :d
        GROUP BY day ORDER BY day
    """), {"d": month_ago}).mappings().all()

    # Session trend (last 30 days)
    session_trend = db.execute(text("""
        SELECT created_at::date as day, COUNT(*) as count
        FROM mock_sessions
        WHERE created_at::date >= :d
        GROUP BY day ORDER BY day
    """), {"d": month_ago}).mappings().all()

    # DSA trend (last 30 days)
    dsa_trend = db.execute(text("""
        SELECT created_at::date as day, COUNT(*) as count
        FROM dsa_attempts
        WHERE created_at::date >= :d
        GROUP BY day ORDER BY day
    """), {"d": month_ago}).mappings().all()

    # Average session score
    avg_score = scalar("""
        SELECT ROUND(AVG(overall_score)::numeric, 1)
        FROM mock_sessions WHERE overall_score IS NOT NULL
    """)

    # Sessions by status
    session_status = db.execute(text("""
        SELECT status, COUNT(*) as count FROM mock_sessions GROUP BY status
    """)).mappings().all()

    # Top companies targeted
    top_companies = db.execute(text("""
        SELECT target_company, COUNT(*) as count
        FROM mock_sessions
        WHERE target_company IS NOT NULL AND target_company != ''
        GROUP BY target_company ORDER BY count DESC LIMIT 8
    """)).mappings().all()

    # Peer rooms
    peer_rooms_total = scalar("SELECT COUNT(*) FROM peer_rooms")
    peer_rooms_completed = scalar("SELECT COUNT(*) FROM peer_rooms WHERE status = 'completed'")

    return {
        "today": {
            "new_users": users_today,
            "sessions": sessions_today,
            "dsa_attempts": dsa_today,
            "active_users": active_today,
        },
        "week": {
            "new_users": users_week,
            "sessions": sessions_week,
            "dsa_attempts": dsa_week,
        },
        "month": {
            "new_users": users_month,
            "sessions": sessions_month,
            "dsa_attempts": dsa_month,
        },
        "totals": {
            "users": total_users,
            "sessions": total_sessions,
            "dsa_attempts": total_dsa,
            "interview_questions": total_questions,
            "dsa_questions": total_dsa_questions,
            "peer_rooms": peer_rooms_total,
            "peer_rooms_completed": peer_rooms_completed,
            "avg_session_score": avg_score,
        },
        "plan_distribution": [dict(r) for r in plan_dist],
        "signup_trend": [{"day": str(r["day"]), "count": r["count"]} for r in signup_trend],
        "session_trend": [{"day": str(r["day"]), "count": r["count"]} for r in session_trend],
        "dsa_trend": [{"day": str(r["day"]), "count": r["count"]} for r in dsa_trend],
        "session_status": [dict(r) for r in session_status],
        "top_companies": [dict(r) for r in top_companies],
    }


# ─── Users ────────────────────────────────────────────────────────────────────

@router.get("/users")
def get_users(
    search: str = "",
    plan: str = "",
    page: int = 1,
    per_page: int = 20,
    sort_by: str = "created_at",
    sort_dir: str = "desc",
    db: Session = Depends(_get_db),
    _=Depends(_require_admin),
) -> dict:
    allowed_sorts = {"created_at", "email", "plan", "full_name"}
    if sort_by not in allowed_sorts:
        sort_by = "created_at"
    sort_dir = "DESC" if sort_dir.lower() == "desc" else "ASC"

    where = ["1=1"]
    params: dict = {}
    if search:
        where.append("(u.email ILIKE :search OR u.full_name ILIKE :search OR u.college ILIKE :search)")
        params["search"] = f"%{search}%"
    if plan:
        where.append("u.plan = :plan")
        params["plan"] = plan

    where_clause = " AND ".join(where)

    total = db.execute(text(f"""
        SELECT COUNT(*) FROM users u WHERE {where_clause}
    """), params).scalar() or 0

    params["offset"] = (page - 1) * per_page
    params["limit"] = per_page

    rows = db.execute(text(f"""
        SELECT
            u.id, u.email, u.full_name, u.plan, u.is_active, u.is_superuser,
            u.college, u.branch, u.year_of_study, u.created_at, u.onboarding_done,
            COUNT(DISTINCT ms.id) as session_count,
            COUNT(DISTINCT da.id) FILTER (WHERE da.status = 'passed') as dsa_solved,
            MAX(ms.created_at) as last_session_at
        FROM users u
        LEFT JOIN mock_sessions ms ON ms.user_id = u.id
        LEFT JOIN dsa_attempts da ON da.user_id = u.id
        WHERE {where_clause}
        GROUP BY u.id
        ORDER BY u.{sort_by} {sort_dir}
        LIMIT :limit OFFSET :offset
    """), params).mappings().all()

    return {
        "users": [dict(r) for r in rows],
        "total": total,
        "page": page,
        "per_page": per_page,
        "pages": max(1, -(-total // per_page)),
    }


@router.get("/users/{user_id}")
def get_user_detail(
    user_id: int,
    db: Session = Depends(_get_db),
    _=Depends(_require_admin),
) -> dict:
    user = db.execute(text("""
        SELECT id, email, full_name, plan, is_active, is_superuser,
               college, branch, year_of_study, placement_goal,
               target_roles, self_level, onboarding_done, created_at,
               linkedin_url, github_url, target_companies
        FROM users WHERE id = :uid
    """), {"uid": user_id}).mappings().first()

    if not user:
        raise HTTPException(status_code=404, detail="user_not_found")

    # Sessions
    sessions = db.execute(text("""
        SELECT id, target_company, session_type, status, overall_score,
               dsa_score, behavioral_score, communication_score,
               technical_score, duration_mins, created_at
        FROM mock_sessions
        WHERE user_id = :uid
        ORDER BY created_at DESC LIMIT 20
    """), {"uid": user_id}).mappings().all()

    # DSA stats
    dsa_stats = db.execute(text("""
        SELECT
            COUNT(*) as total_attempts,
            COUNT(*) FILTER (WHERE status = 'passed') as solved,
            COUNT(DISTINCT question_id) FILTER (WHERE status = 'passed') as unique_solved,
            COUNT(*) FILTER (WHERE language = 'python') as python_attempts,
            COUNT(*) FILTER (WHERE language = 'java') as java_attempts,
            COUNT(*) FILTER (WHERE language = 'cpp') as cpp_attempts
        FROM dsa_attempts WHERE user_id = :uid
    """), {"uid": user_id}).mappings().first()

    # Quick prep sessions
    qp_sessions = db.execute(text("""
        SELECT id, company, duration_minutes, concepts_covered, created_at
        FROM quick_prep_sessions
        WHERE user_id = :uid
        ORDER BY created_at DESC LIMIT 10
    """), {"uid": user_id}).mappings().all()

    # Daily streak
    daily = db.execute(text("""
        SELECT COUNT(*) as total_daily, MAX(answered_at) as last_daily
        FROM daily_answers WHERE user_id = :uid
    """), {"uid": user_id}).mappings().first()

    return {
        "user": dict(user),
        "sessions": [dict(r) for r in sessions],
        "dsa_stats": dict(dsa_stats) if dsa_stats else {},
        "quick_prep_count": len(qp_sessions),
        "daily_stats": dict(daily) if daily else {},
    }


class UpdateUserPayload(BaseModel):
    plan: Optional[str] = None
    is_active: Optional[bool] = None
    is_superuser: Optional[bool] = None


@router.patch("/users/{user_id}")
def update_user(
    user_id: int,
    payload: UpdateUserPayload,
    db: Session = Depends(_get_db),
    _=Depends(_require_admin),
) -> dict:
    updates = {}
    if payload.plan is not None:
        if payload.plan not in ("free", "pro", "max"):
            raise HTTPException(status_code=400, detail="invalid_plan")
        updates["plan"] = payload.plan
    if payload.is_active is not None:
        updates["is_active"] = payload.is_active
    if payload.is_superuser is not None:
        updates["is_superuser"] = payload.is_superuser

    if not updates:
        return {"ok": True}

    set_clause = ", ".join(f"{k} = :{k}" for k in updates)
    updates["uid"] = user_id
    db.execute(text(f"UPDATE users SET {set_clause} WHERE id = :uid"), updates)
    db.commit()
    return {"ok": True}


# ─── Mock Sessions ────────────────────────────────────────────────────────────

@router.get("/sessions")
def get_sessions(
    page: int = 1,
    per_page: int = 20,
    company: str = "",
    status: str = "",
    session_type: str = "",
    db: Session = Depends(_get_db),
    _=Depends(_require_admin),
) -> dict:
    where = ["1=1"]
    params: dict = {}

    if company:
        where.append("ms.target_company ILIKE :company")
        params["company"] = f"%{company}%"
    if status:
        where.append("ms.status = :status")
        params["status"] = status
    if session_type:
        where.append("ms.session_type = :session_type")
        params["session_type"] = session_type

    where_clause = " AND ".join(where)

    total = db.execute(text(f"""
        SELECT COUNT(*) FROM mock_sessions ms WHERE {where_clause}
    """), params).scalar() or 0

    params["offset"] = (page - 1) * per_page
    params["limit"] = per_page

    rows = db.execute(text(f"""
        SELECT
            ms.id, ms.user_id, u.email, u.full_name,
            ms.target_company, ms.session_type, ms.status,
            ms.overall_score, ms.dsa_score, ms.behavioral_score,
            ms.communication_score, ms.technical_score,
            ms.duration_mins, ms.question_count,
            ms.created_at, ms.completed_at
        FROM mock_sessions ms
        LEFT JOIN users u ON u.id = ms.user_id
        WHERE {where_clause}
        ORDER BY ms.created_at DESC
        LIMIT :limit OFFSET :offset
    """), params).mappings().all()

    # Analytics
    avg_score = db.execute(text("""
        SELECT ROUND(AVG(overall_score)::numeric, 1)
        FROM mock_sessions WHERE overall_score IS NOT NULL
    """)).scalar() or 0

    score_dist = db.execute(text("""
        SELECT
            COUNT(*) FILTER (WHERE overall_score < 40) as poor,
            COUNT(*) FILTER (WHERE overall_score >= 40 AND overall_score < 60) as developing,
            COUNT(*) FILTER (WHERE overall_score >= 60 AND overall_score < 80) as good,
            COUNT(*) FILTER (WHERE overall_score >= 80) as excellent
        FROM mock_sessions WHERE overall_score IS NOT NULL
    """)).mappings().first()

    return {
        "sessions": [dict(r) for r in rows],
        "total": total,
        "page": page,
        "per_page": per_page,
        "pages": max(1, -(-total // per_page)),
        "avg_score": avg_score,
        "score_distribution": dict(score_dist) if score_dist else {},
    }


@router.get("/sessions/{session_id}")
def get_session_detail(
    session_id: int,
    db: Session = Depends(_get_db),
    _=Depends(_require_admin),
) -> dict:
    session = db.execute(text("""
        SELECT ms.*, u.email, u.full_name, u.college
        FROM mock_sessions ms
        LEFT JOIN users u ON u.id = ms.user_id
        WHERE ms.id = :sid
    """), {"sid": session_id}).mappings().first()

    if not session:
        raise HTTPException(status_code=404, detail="session_not_found")

    questions = db.execute(text("""
        SELECT iq.id, iq.question_text, iq.type, iq.position,
               ia.transcript, ia.score, ia.feedback,
               ia.technical_score, ia.communication_score,
               ia.completeness_score, ia.duration_seconds
        FROM interview_questions iq
        LEFT JOIN interview_answers ia ON ia.interview_question_id = iq.id
        WHERE iq.interview_id = (
            SELECT id FROM interviews WHERE session_id = :sid LIMIT 1
        )
        ORDER BY iq.position ASC
    """), {"sid": session_id}).mappings().all()

    interruptions = db.execute(text("""
        SELECT type, trigger_reason, directive, created_at
        FROM interruptions WHERE session_id = :sid
        ORDER BY created_at ASC
    """), {"sid": session_id}).mappings().all()

    return {
        "session": dict(session),
        "questions": [dict(q) for q in questions],
        "interruptions": [dict(i) for i in interruptions],
    }


# ─── DSA Practice ─────────────────────────────────────────────────────────────

@router.get("/dsa/problems")
def get_dsa_problems(
    topic: str = "",
    difficulty: str = "",
    page: int = 1,
    per_page: int = 30,
    sort_by: str = "solve_rate",
    sort_dir: str = "asc",
    db: Session = Depends(_get_db),
    _=Depends(_require_admin),
) -> dict:
    where = ["q.is_active = TRUE"]
    params: dict = {}
    if topic:
        where.append("q.topic = :topic")
        params["topic"] = topic
    if difficulty:
        where.append("q.difficulty = :difficulty")
        params["difficulty"] = difficulty

    where_clause = " AND ".join(where)

    params["offset"] = (page - 1) * per_page
    params["limit"] = per_page

    rows = db.execute(text(f"""
        SELECT
            q.id, q.problem_name, q.topic, q.difficulty, q.tags,
            COUNT(a.id) as total_attempts,
            COUNT(a.id) FILTER (WHERE a.status = 'passed') as solved_count,
            COUNT(DISTINCT a.user_id) as unique_users,
            CASE WHEN COUNT(a.id) > 0
                THEN ROUND(COUNT(a.id) FILTER (WHERE a.status = 'passed') * 100.0 / COUNT(a.id), 1)
                ELSE 0 END as solve_rate,
            ARRAY_AGG(DISTINCT ct.company) FILTER (WHERE ct.company IS NOT NULL) as companies
        FROM dsa_questions q
        LEFT JOIN dsa_attempts a ON a.question_id = q.id
        LEFT JOIN dsa_company_tags ct ON ct.question_id = q.id
        WHERE {where_clause}
        GROUP BY q.id
        ORDER BY solve_rate {sort_dir.upper()}, q.id ASC
        LIMIT :limit OFFSET :offset
    """), params).mappings().all()

    total = db.execute(text(f"""
        SELECT COUNT(*) FROM dsa_questions q WHERE {where_clause}
    """), {k: v for k, v in params.items() if k not in ("offset", "limit")}).scalar() or 0

    # Topic breakdown
    topic_stats = db.execute(text("""
        SELECT q.topic,
            COUNT(*) as total,
            COUNT(*) FILTER (WHERE q.difficulty = 'easy') as easy,
            COUNT(*) FILTER (WHERE q.difficulty = 'medium') as medium,
            COUNT(*) FILTER (WHERE q.difficulty = 'hard') as hard,
            COALESCE(SUM(a.attempt_count), 0) as attempts
        FROM dsa_questions q
        LEFT JOIN (
            SELECT question_id, COUNT(*) as attempt_count FROM dsa_attempts GROUP BY question_id
        ) a ON a.question_id = q.id
        WHERE q.is_active = TRUE
        GROUP BY q.topic ORDER BY total DESC
    """)).mappings().all()

    # Language distribution
    lang_dist = db.execute(text("""
        SELECT language, COUNT(*) as count FROM dsa_attempts GROUP BY language
    """)).mappings().all()

    return {
        "problems": [dict(r) for r in rows],
        "total": total,
        "page": page,
        "per_page": per_page,
        "pages": max(1, -(-total // per_page)),
        "topic_stats": [dict(r) for r in topic_stats],
        "language_distribution": [dict(r) for r in lang_dist],
    }


@router.get("/dsa/problems/{question_id}")
def get_dsa_problem_detail(
    question_id: int,
    db: Session = Depends(_get_db),
    _=Depends(_require_admin),
) -> dict:
    problem = db.execute(text("""
        SELECT q.*, d.problem_statement, d.function_signature,
               d.sample_cases, d.hidden_test_cases, d.hints_progressive,
               d.solution_code, d.solution_explanation, d.time_complexity,
               d.space_complexity, d.approach_tags, d.common_mistakes
        FROM dsa_questions q
        JOIN dsa_question_details d ON d.question_id = q.id
        WHERE q.id = :qid
    """), {"qid": question_id}).mappings().first()

    if not problem:
        raise HTTPException(status_code=404, detail="not_found")

    attempts = db.execute(text("""
        SELECT a.*, u.email
        FROM dsa_attempts a
        JOIN users u ON u.id = a.user_id
        WHERE a.question_id = :qid
        ORDER BY a.created_at DESC LIMIT 50
    """), {"qid": question_id}).mappings().all()

    # Failure analysis — which test case fails most
    failure_stats = db.execute(text("""
        SELECT status, COUNT(*) as count FROM dsa_attempts
        WHERE question_id = :qid GROUP BY status ORDER BY count DESC
    """), {"qid": question_id}).mappings().all()

    return {
        "problem": dict(problem),
        "attempts": [dict(a) for a in attempts],
        "failure_stats": [dict(f) for f in failure_stats],
    }


class UpdateDSAProblemPayload(BaseModel):
    problem_name: Optional[str] = None
    difficulty: Optional[str] = None
    is_active: Optional[bool] = None
    tags: Optional[list] = None


@router.patch("/dsa/problems/{question_id}")
def update_dsa_problem(
    question_id: int,
    payload: UpdateDSAProblemPayload,
    db: Session = Depends(_get_db),
    _=Depends(_require_admin),
) -> dict:
    updates = {}
    if payload.problem_name is not None:
        updates["problem_name"] = payload.problem_name
    if payload.difficulty is not None:
        if payload.difficulty not in ("easy", "medium", "hard"):
            raise HTTPException(status_code=400, detail="invalid_difficulty")
        updates["difficulty"] = payload.difficulty
    if payload.is_active is not None:
        updates["is_active"] = payload.is_active
    if payload.tags is not None:
        updates["tags"] = json.dumps(payload.tags)

    if not updates:
        return {"ok": True}

    set_clause = ", ".join(f"{k} = :{k}" for k in updates)
    updates["qid"] = question_id
    db.execute(text(f"UPDATE dsa_questions SET {set_clause} WHERE id = :qid"), updates)
    db.commit()
    return {"ok": True}


# ─── Question Bank ────────────────────────────────────────────────────────────

@router.get("/questions")
def get_questions(
    search: str = "",
    category: str = "",
    topic: str = "",
    difficulty: str = "",
    is_active: Optional[bool] = None,
    page: int = 1,
    per_page: int = 30,
    db: Session = Depends(_get_db),
    _=Depends(_require_admin),
) -> dict:
    where = ["1=1"]
    params: dict = {}

    if search:
        where.append("q.question_text ILIKE :search")
        params["search"] = f"%{search}%"
    if category:
        where.append("q.type = :category")
        params["category"] = category
    if topic:
        where.append("q.topic ILIKE :topic")
        params["topic"] = f"%{topic}%"
    if difficulty:
        where.append("q.difficulty = :difficulty")
        params["difficulty"] = difficulty
    

    where_clause = " AND ".join(where)

    total = db.execute(text(f"""
        SELECT COUNT(*) FROM interview_questions q WHERE {where_clause}
    """), params).scalar() or 0

    params["offset"] = (page - 1) * per_page
    params["limit"] = per_page

    rows = db.execute(text(f"""
        SELECT
            q.id, q.question_text, q.type, q.topic,
            q.difficulty, q.source, q.position,
            COUNT(ia.id) as times_served,
            ROUND(AVG(ia.overall_score)::numeric, 1) as avg_score
        FROM interview_questions q
        LEFT JOIN interview_answers ia ON ia.interview_question_id = q.id
        WHERE {where_clause}
        GROUP BY q.id
        ORDER BY q.id DESC
        LIMIT :limit OFFSET :offset
    """), params).mappings().all()

    # Category breakdown
    cat_breakdown = db.execute(text("""
        SELECT type, COUNT(*) as count, COUNT(*) FILTER (WHERE is_active) as active
        FROM interview_questions GROUP BY type ORDER BY count DESC
    """)).mappings().all()

    return {
        "questions": [dict(r) for r in rows],
        "total": total,
        "page": page,
        "per_page": per_page,
        "pages": max(1, -(-total // per_page)),
        "category_breakdown": [dict(r) for r in cat_breakdown],
    }


class UpdateQuestionPayload(BaseModel):
    question_text: Optional[str] = None
    difficulty: Optional[str] = None
    topic: Optional[str] = None
    


@router.patch("/questions/{question_id}")
def update_question(
    question_id: int,
    payload: UpdateQuestionPayload,
    db: Session = Depends(_get_db),
    _=Depends(_require_admin),
) -> dict:
    updates = {}
    if payload.question_text is not None:
        updates["question_text"] = payload.question_text
    if payload.difficulty is not None:
        updates["difficulty"] = payload.difficulty
    
    if payload.topic is not None:
        updates["topic"] = payload.topic
    if payload.subtopic is not None:
        updates["subtopic"] = payload.subtopic

    if not updates:
        return {"ok": True}

    set_clause = ", ".join(f"{k} = :{k}" for k in updates)
    updates["qid"] = question_id
    db.execute(text(f"UPDATE interview_questions SET {set_clause} WHERE id = :qid"), updates)
    db.commit()
    return {"ok": True}


# ─── Analytics ────────────────────────────────────────────────────────────────

@router.get("/analytics/retention")
def get_retention(
    db: Session = Depends(_get_db),
    _=Depends(_require_admin),
) -> dict:
    """Weekly cohort retention — what % of week-N signups are still active in week N+1, N+2, N+3, N+4"""
    cohorts = db.execute(text("""
        WITH cohort_users AS (
            SELECT
                id,
                date_trunc('week', created_at) as cohort_week
            FROM users
            WHERE created_at >= NOW() - INTERVAL '12 weeks'
        ),
        activity AS (
            SELECT DISTINCT user_id, date_trunc('week', created_at) as activity_week
            FROM mock_sessions
            WHERE created_at >= NOW() - INTERVAL '12 weeks'
            UNION
            SELECT DISTINCT user_id, date_trunc('week', created_at)
            FROM dsa_attempts
            WHERE created_at >= NOW() - INTERVAL '12 weeks'
        )
        SELECT
            TO_CHAR(c.cohort_week, 'Mon DD') as cohort,
            COUNT(DISTINCT c.id) as cohort_size,
            COUNT(DISTINCT a.user_id) FILTER (
                WHERE a.activity_week = c.cohort_week
            ) as week_0,
            COUNT(DISTINCT a.user_id) FILTER (
                WHERE a.activity_week = c.cohort_week + INTERVAL '1 week'
            ) as week_1,
            COUNT(DISTINCT a.user_id) FILTER (
                WHERE a.activity_week = c.cohort_week + INTERVAL '2 weeks'
            ) as week_2,
            COUNT(DISTINCT a.user_id) FILTER (
                WHERE a.activity_week = c.cohort_week + INTERVAL '3 weeks'
            ) as week_3,
            COUNT(DISTINCT a.user_id) FILTER (
                WHERE a.activity_week = c.cohort_week + INTERVAL '4 weeks'
            ) as week_4
        FROM cohort_users c
        LEFT JOIN activity a ON a.user_id = c.id
        GROUP BY c.cohort_week
        ORDER BY c.cohort_week DESC
        LIMIT 8
    """)).mappings().all()

    return {"cohorts": [dict(r) for r in cohorts]}


@router.get("/analytics/funnel")
def get_funnel(
    db: Session = Depends(_get_db),
    _=Depends(_require_admin),
) -> dict:
    """Drop-off funnel: signup → onboarding → first session → second session → paid"""
    total = db.execute(text("SELECT COUNT(*) FROM users")).scalar() or 0
    onboarded = db.execute(text("SELECT COUNT(*) FROM users WHERE onboarding_done = TRUE")).scalar() or 0
    had_session = db.execute(text("SELECT COUNT(DISTINCT user_id) FROM mock_sessions")).scalar() or 0
    had_two_sessions = db.execute(text("""
        SELECT COUNT(*) FROM (
            SELECT user_id FROM mock_sessions GROUP BY user_id HAVING COUNT(*) >= 2
        ) t
    """)).scalar() or 0
    paid = db.execute(text("SELECT COUNT(*) FROM users WHERE plan IN ('pro', 'max')")).scalar() or 0

    return {
        "funnel": [
            {"stage": "Signed up", "count": total, "pct": 100},
            {"stage": "Completed onboarding", "count": onboarded,
             "pct": round(onboarded / total * 100, 1) if total else 0},
            {"stage": "First session", "count": had_session,
             "pct": round(had_session / total * 100, 1) if total else 0},
            {"stage": "Second session", "count": had_two_sessions,
             "pct": round(had_two_sessions / total * 100, 1) if total else 0},
            {"stage": "Paid", "count": paid,
             "pct": round(paid / total * 100, 1) if total else 0},
        ]
    }


@router.get("/analytics/questions")
def get_question_analytics(
    db: Session = Depends(_get_db),
    _=Depends(_require_admin),
) -> dict:
    lowest_scores = db.execute(text("""
        SELECT q.id, q.question_text, q.type, q.topic, q.difficulty,
               ROUND(AVG(ia.overall_score)::numeric, 1) as avg_score,
               COUNT(ia.id) as times_served
        FROM interview_questions q
        JOIN interview_answers ia ON ia.interview_question_id = q.id
        WHERE ia.overall_score IS NOT NULL
        GROUP BY q.id
        HAVING COUNT(ia.id) >= 2
        ORDER BY avg_score ASC
        LIMIT 10
    """)).mappings().all()

    most_served = db.execute(text("""
        SELECT q.id, q.question_text, q.type, q.topic,
               COUNT(ia.id) as times_served,
               ROUND(AVG(ia.overall_score)::numeric, 1) as avg_score
        FROM interview_questions q
        JOIN interview_answers ia ON ia.interview_question_id = q.id
        GROUP BY q.id
        ORDER BY times_served DESC
        LIMIT 10
    """)).mappings().all()

    never_served = db.execute(text("""
        SELECT q.id, q.question_text, q.type, q.topic, q.difficulty
        FROM interview_questions q
        LEFT JOIN interview_answers ia ON ia.interview_question_id = q.id
        WHERE ia.id IS NULL
        LIMIT 20
    """)).mappings().all()

    topic_coverage = db.execute(text("""
        SELECT topic,
               COUNT(*) as total
        FROM interview_questions
        WHERE topic IS NOT NULL
        GROUP BY topic ORDER BY total DESC
    """)).mappings().all()

    return {
        "lowest_scoring_questions": [dict(r) for r in lowest_scores],
        "most_served_questions": [dict(r) for r in most_served],
        "never_served_questions": [dict(r) for r in never_served],
        "topic_coverage": [dict(r) for r in topic_coverage],
    }

# ─── Quick Prep ───────────────────────────────────────────────────────────────

@router.get("/quick-prep/concepts")
def get_qp_concepts(
    topic: str = "",
    page: int = 1,
    per_page: int = 30,
    db: Session = Depends(_get_db),
    _=Depends(_require_admin),
) -> dict:
    where = ["1=1"]
    params: dict = {}
    if topic:
        where.append("c.topic = :topic")
        params["topic"] = topic

    where_clause = " AND ".join(where)
    params["offset"] = (page - 1) * per_page
    params["limit"] = per_page

    rows = db.execute(text(f"""
        SELECT c.id, c.name, c.topic, c.subtopic, c.is_active,
               COUNT(r.id) as times_used,
               COUNT(r.id) FILTER (WHERE r.rating = 'solid') as solid_count,
               COUNT(r.id) FILTER (WHERE r.rating = 'revised') as revised_count,
               COUNT(r.id) FILTER (WHERE r.rating = 'new') as new_count
        FROM quick_prep_concepts c
        LEFT JOIN quick_prep_concept_results r ON r.concept_id = c.id
        WHERE {where_clause}
        GROUP BY c.id
        ORDER BY times_used DESC
        LIMIT :limit OFFSET :offset
    """), params).mappings().all()

    total = db.execute(text(f"""
        SELECT COUNT(*) FROM quick_prep_concepts c WHERE {where_clause}
    """), {k: v for k, v in params.items() if k not in ("offset", "limit")}).scalar() or 0

    return {
        "concepts": [dict(r) for r in rows],
        "total": total,
        "page": page,
        "per_page": per_page,
    }


# ─── Peer Practice ────────────────────────────────────────────────────────────

@router.get("/peer-rooms")
def get_peer_rooms(
    status: str = "",
    page: int = 1,
    per_page: int = 20,
    db: Session = Depends(_get_db),
    _=Depends(_require_admin),
) -> dict:
    where = ["1=1"]
    params: dict = {}
    if status:
        where.append("r.status = :status")
        params["status"] = status

    where_clause = " AND ".join(where)
    params["offset"] = (page - 1) * per_page
    params["limit"] = per_page

    rows = db.execute(text(f"""
        SELECT r.id, r.code, r.status, r.created_at,
               u.email as creator_email,
               COUNT(DISTINCT a.user_id) as participants
        FROM peer_rooms r
        LEFT JOIN users u ON u.id = r.creator_id
        LEFT JOIN peer_attempts a ON a.room_id = r.id
        WHERE {where_clause}
        GROUP BY r.id, u.email
        ORDER BY r.created_at DESC
        LIMIT :limit OFFSET :offset
    """), params).mappings().all()

    total = db.execute(text(f"""
        SELECT COUNT(*) FROM peer_rooms r WHERE {where_clause}
    """), {k: v for k, v in params.items() if k not in ("offset", "limit")}).scalar() or 0

    return {
        "rooms": [dict(r) for r in rows],
        "total": total,
        "page": page,
        "per_page": per_page,
    }


# ─── Daily Challenge ──────────────────────────────────────────────────────────

@router.get("/daily")
def get_daily_overview(
    db: Session = Depends(_get_db),
    _=Depends(_require_admin),
) -> dict:
    upcoming = db.execute(text("""
        SELECT dq.id, dq.date, dq.question_id,
               iq.question_text, iq.type, iq.topic, iq.difficulty
        FROM daily_questions dq
        LEFT JOIN interview_questions iq ON iq.id = dq.question_id
        WHERE dq.date >= CURRENT_DATE
        ORDER BY dq.date ASC LIMIT 14
    """)).mappings().all()

    participation = db.execute(text("""
        SELECT dq.date,
               COUNT(DISTINCT da.user_id) as participants,
               ROUND(AVG(da.score)::numeric, 1) as avg_score
        FROM daily_questions dq
        LEFT JOIN daily_answers da ON da.daily_question_id = dq.id
        WHERE dq.date >= CURRENT_DATE - INTERVAL '30 days'
        GROUP BY dq.date ORDER BY dq.date DESC LIMIT 30
    """)).mappings().all()

    return {
        "upcoming_challenges": [dict(r) for r in upcoming],
        "participation_trend": [dict(r) for r in participation],
    }


# ─── Cheat Sheet ──────────────────────────────────────────────────────────────

@router.get("/cheat-sheet")
def get_cheat_sheet_overview(
    db: Session = Depends(_get_db),
    _=Depends(_require_admin),
) -> dict:
    companies = db.execute(text("""
        SELECT cp.company, COUNT(DISTINCT cc.user_id) as unique_views,
               MAX(cc.created_at) as last_viewed
        FROM company_profiles cp
        LEFT JOIN cheat_sheet_cache cc ON cc.company = cp.company
        GROUP BY cp.company ORDER BY unique_views DESC
    """)).mappings().all()

    return {"companies": [dict(r) for r in companies]}


# ─── System stats (no real-time metrics, just DB-level) ───────────────────────

@router.get("/system")
def get_system_stats(
    db: Session = Depends(_get_db),
    _=Depends(_require_admin),
) -> dict:
    table_sizes = db.execute(text("""
        SELECT
            relname as table_name,
            n_live_tup as row_count,
            pg_size_pretty(pg_total_relation_size(relid)) as size
        FROM pg_stat_user_tables
        ORDER BY n_live_tup DESC
    """)).mappings().all()

    dsa_execution_stats = db.execute(text("""
        SELECT
            language,
            COUNT(*) as total,
            COUNT(*) FILTER (WHERE status = 'passed') as passed,
            COUNT(*) FILTER (WHERE status = 'tle') as tle,
            COUNT(*) FILTER (WHERE status = 'runtime_error') as runtime_error,
            COUNT(*) FILTER (WHERE status = 'compilation_error') as compilation_error,
            COUNT(*) FILTER (WHERE status = 'wrong_answer') as wrong_answer
        FROM dsa_attempts
        GROUP BY language
    """)).mappings().all()

    return {
        "table_sizes": [dict(r) for r in table_sizes],
        "dsa_execution_stats": [dict(r) for r in dsa_execution_stats],
    }