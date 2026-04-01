"""
backend/api/candidates.py — Recruiter dashboard endpoints for candidate list, filtering, re-scoring, and actions
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import text
from pydantic import BaseModel
from uuid import UUID
from typing import Optional, List
from datetime import datetime

from api.deps import get_db, get_current_user
from models import JobApplicationOut, CandidateListItem, CandidateDetail

router = APIRouter(prefix="/api/company", tags=["candidates"])


# ============================================================================
# Pydantic Models for Requests
# ============================================================================

class RescoreRequest(BaseModel):
    score: float  # 0–10, 0.1 increments
    reason: str  # min 20 chars


class CandidateActionRequest(BaseModel):
    action: str  # "shortlist", "reject", "advanced"
    send_feedback: Optional[bool] = False


# ============================================================================
# GET /api/company/roles/{role_id}/candidates — List candidates for a role
# ============================================================================

@router.get("/roles/{role_id}/candidates")
def get_candidates(
    role_id: int,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
    status: Optional[str] = Query(None),  # invited, started, completed, shortlisted, rejected, advanced
    cheat_risk: Optional[str] = Query(None),  # low, medium, high, very_high
    min_score: Optional[float] = Query(None),
    sort_by: str = Query("score", regex="^(score|date|cheat_risk|name)$"),
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
):
    """
    Get ranked list of candidates for a role.
    Filters: status, cheat_risk, min_score
    Sort: score (desc), date (newest first), cheat_risk (high first), name (A-Z)
    """
    query = f"""
        SELECT
            ja.id AS application_id,
            ja.candidate_name,
            ja.candidate_email,
            ja.status,
            ja.completed_at,
            ja.attempt_number,
            i.overall_score,
            i.cheat_risk,
            i.rubric_scores
        FROM job_applications ja
        LEFT JOIN interviews i ON i.application_id = ja.id
        WHERE ja.job_id = :role_id
    """

    params = {"role_id": role_id}

    # Add filters
    if status:
        query += " AND ja.status = :status"
        params["status"] = status

    if cheat_risk:
        query += " AND i.cheat_risk = :cheat_risk"
        params["cheat_risk"] = cheat_risk

    if min_score is not None:
        query += " AND i.overall_score >= :min_score"
        params["min_score"] = min_score

    # Add sorting
    if sort_by == "score":
        query += " ORDER BY i.overall_score DESC"
    elif sort_by == "date":
        query += " ORDER BY ja.completed_at DESC NULLS LAST"
    elif sort_by == "cheat_risk":
        query += " ORDER BY CASE WHEN i.cheat_risk = 'very_high' THEN 0 WHEN i.cheat_risk = 'high' THEN 1 WHEN i.cheat_risk = 'medium' THEN 2 ELSE 3 END"
    elif sort_by == "name":
        query += " ORDER BY ja.candidate_name ASC"

    query += f" LIMIT :limit OFFSET :offset"
    params["limit"] = limit
    params["offset"] = offset

    rows = db.execute(text(query), params).mappings().all()

    items = [
        CandidateListItem(
            application_id=UUID(r["application_id"]),
            candidate_name=r["candidate_name"],
            candidate_email=r["candidate_email"],
            overall_score=float(r["overall_score"]) if r["overall_score"] else None,
            rubric_scores=r["rubric_scores"],
            cheat_risk=r["cheat_risk"],
            status=r["status"],
            completed_at=r["completed_at"],
            attempt_number=r["attempt_number"],
        )
        for r in rows
    ]

    total = db.execute(
        text("""
            SELECT COUNT(*) FROM job_applications ja
            LEFT JOIN interviews i ON i.application_id = ja.id
            WHERE ja.job_id = :role_id
        """),
        {"role_id": role_id},
    ).scalar()

    return {"items": items, "total": total}


# ============================================================================
# GET /api/company/roles/{role_id}/candidates/{app_id} — Get candidate detail
# ============================================================================

@router.get("/roles/{role_id}/candidates/{app_id}")
def get_candidate_detail(
    role_id: int,
    app_id: UUID,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """
    Get full candidate detail including all answers and cheat signals.
    """
    # Get job application
    app = db.execute(
        text("""
            SELECT * FROM job_applications
            WHERE id = :app_id AND job_id = :role_id
        """),
        {"app_id": str(app_id), "role_id": role_id},
    ).mappings().first()

    if not app:
        raise HTTPException(status_code=404, detail="Candidate not found")

    # Get interview session
    interview = db.execute(
        text("""
            SELECT * FROM interviews WHERE application_id = :app_id
        """),
        {"app_id": str(app_id)},
    ).mappings().first()

    # Build response
    detail = CandidateDetail(
        id=UUID(app["id"]),
        job_id=app["job_id"],
        candidate_email=app["candidate_email"],
        candidate_name=app["candidate_name"],
        attempt_number=app["attempt_number"],
        status=app["status"],
        invite_token=app["invite_token"],
        invited_at=app["invited_at"],
        started_at=app["started_at"],
        completed_at=app["completed_at"],
        overall_score=float(interview["overall_score"]) if interview and interview["overall_score"] else None,
        rubric_scores=interview.get("rubric_scores") if interview else None,
        cheat_score=float(interview["cheat_score"]) if interview and interview.get("cheat_score") else None,
        cheat_risk=interview.get("cheat_risk") if interview else None,
        ai_recommendation=interview.get("ai_recommendation") if interview else None,
        answers=[],  # Populated below
        cheat_signals=[],  # Populated below
    )

    # Get answers if interview exists
    if interview:
        answers = db.execute(
            text("""
                SELECT * FROM interview_answers WHERE interview_id = :interview_id
            """),
            {"interview_id": interview["id"]},
        ).mappings().all()
        detail.answers = [dict(a) for a in answers]

        # Get cheat signals
        signals = db.execute(
            text("""
                SELECT * FROM cheat_signals WHERE interview_id = :interview_id
            """),
            {"interview_id": interview["id"]},
        ).mappings().all()
        detail.cheat_signals = [dict(s) for s in signals]

    return detail


# ============================================================================
# PATCH /api/company/answers/{answer_id}/rescore — Re-score a single answer
# ============================================================================

@router.patch("/answers/{answer_id}/rescore")
def rescore_answer(
    answer_id: int,
    req: RescoreRequest,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """
    Re-score a single answer manually.
    Returns updated score and recalculated session overall_score.
    """
    if len(req.reason) < 20:
        raise HTTPException(status_code=400, detail="Reason must be at least 20 characters")

    # Get answer
    answer = db.execute(
        text("SELECT * FROM interview_answers WHERE id = :id"),
        {"id": answer_id},
    ).mappings().first()

    if not answer:
        raise HTTPException(status_code=404, detail="Answer not found")

    old_score = answer.get("ai_score")

    # Update answer with manual score
    db.execute(
        text("""
            UPDATE interview_answers
            SET manual_score = :score, score_source = 'manual'
            WHERE id = :id
        """),
        {"score": req.score, "id": answer_id},
    )

    # Get interview session to recalculate
    interview = db.execute(
        text("""
            SELECT i.* FROM interviews i
            JOIN interview_answers ia ON ia.interview_id = i.id
            WHERE ia.id = :answer_id
        """),
        {"answer_id": answer_id},
    ).mappings().first()

    if not interview:
        raise HTTPException(status_code=500, detail="Interview not found")

    # Recalculate session score using rubric
    app = db.execute(
        text("""
            SELECT ja.job_id FROM job_applications ja
            WHERE id = :app_id
        """),
        {"app_id": interview["application_id"]},
    ).mappings().first()

    if not app:
        raise HTTPException(status_code=500, detail="Application not found")

    # Get rubric weights for dimension-aware scoring
    role = db.execute(
        text("SELECT rubric_weights FROM roles WHERE id = :id"),
        {"id": app["job_id"]},
    ).mappings().first()

    rubric_weights = role.get("rubric_weights") if role else {}

    # Get all answers for this session
    all_answers = db.execute(
        text("""
            SELECT ia.* FROM interview_answers ia
            WHERE ia.interview_id = :interview_id
        """),
        {"interview_id": interview["id"]},
    ).mappings().all()

    # Compute dimension scores (average per dimension)
    dimension_scores = {}
    for ans in all_answers:
        if ans["id"] == answer_id:
            score = req.score  # Use new manual score
        else:
            score = ans.get("manual_score") or ans.get("ai_score") or 0

        # Get question dimension (would need to join interview_questions)
        question_row = db.execute(
            text("SELECT dimension FROM interview_questions WHERE id = :id"),
            {"id": ans["interview_question_id"]},
        ).mappings().first()

        dimension = question_row.get("dimension") if question_row else "general"

        if dimension not in dimension_scores:
            dimension_scores[dimension] = []
        dimension_scores[dimension].append(score)

    # Compute weighted score from dimension averages using rubric weights
    rubric_scores = {}
    for dim, scores in dimension_scores.items():
        rubric_scores[dim] = sum(scores) / len(scores) if scores else 0

    # Apply rubric weights to compute overall score
    new_overall_score = 0.0
    for dimension_key, dimension_config in rubric_weights.items():
        score = rubric_scores.get(dimension_key, 0.0)
        weight_percent = dimension_config.get("weight", 0) / 100.0
        new_overall_score += score * weight_percent
    new_overall_score = round(new_overall_score, 2)

    # Update interview overall_score
    db.execute(
        text("""
            UPDATE interviews
            SET overall_score = :score, rubric_scores = :rubric_scores
            WHERE id = :id
        """),
        {"score": new_overall_score, "rubric_scores": rubric_scores, "id": interview["id"]},
    )

    db.commit()

    return {
        "answer_id": answer_id,
        "old_score": old_score,
        "new_score": req.score,
        "new_session_overall": new_overall_score,
        "reason": req.reason,
    }


# ============================================================================
# POST /api/company/candidates/{app_id}/action — Advance / Reject / Shortlist
# ============================================================================

@router.post("/candidates/{app_id}/action")
def candidate_action(
    app_id: UUID,
    req: CandidateActionRequest,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """
    Update candidate status: shortlist, reject, or advanced.
    Sends emails for reject/advanced.
    """
    valid_actions = ["shortlist", "reject", "advanced"]
    if req.action not in valid_actions:
        raise HTTPException(status_code=400, detail=f"Invalid action. Must be one of {valid_actions}")

    # Get application
    app = db.execute(
        text("SELECT * FROM job_applications WHERE id = :id"),
        {"id": str(app_id)},
    ).mappings().first()

    if not app:
        raise HTTPException(status_code=404, detail="Candidate not found")

    # Update status
    new_status = req.action
    db.execute(
        text("""
            UPDATE job_applications
            SET status = :status
            WHERE id = :id
        """),
        {"status": new_status, "id": str(app_id)},
    )

    # TODO: Send email (integrate with email service)
    # if req.action == "reject":
    #     send_rejection_email(app["candidate_email"], feedback=req.send_feedback)
    # elif req.action == "advanced":
    #     send_advancement_email(app["candidate_email"])

    db.commit()

    return {"status": "ok", "new_status": new_status, "message": f"Candidate {req.action}d"}


# ============================================================================
# POST /api/company/candidates/bulk-action — Shortlist / Reject multiple
# ============================================================================

@router.post("/candidates/bulk-action")
def bulk_action(
    app_ids: List[UUID],
    action: str = Query(..., regex="^(shortlist|reject)$"),
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """
    Bulk action on multiple candidates.
    """
    app_ids_str = [str(id) for id in app_ids]

    db.execute(
        text(f"""
            UPDATE job_applications
            SET status = :status
            WHERE id = ANY(:ids)
        """),
        {"status": action, "ids": app_ids_str},
    )

    # TODO: Send bulk emails
    db.commit()

    return {"status": "ok", "action": action, "count": len(app_ids)}
