from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import select
from uuid import UUID

from db.session import get_db
from models.interview_timeline import InterviewTimeline


router = APIRouter(prefix="/api/interview", tags=["interview-replay"])


@router.get("/{interview_id}/replay")
def replay_interview(
    interview_id: UUID,
    db: Session = Depends(get_db),
):
    rows = (
        db.query(InterviewTimeline)
        .filter(InterviewTimeline.interview_id == interview_id)
        .order_by(InterviewTimeline.created_at.asc())
        .all()
    )

    events = [
        {
            "timestamp": row.created_at,
            "type": row.event_type,
            "question_id": row.question_id,
            "payload": row.payload or {},
        }
        for row in rows
    ]

    return {
        "interview_id": interview_id,
        "events": events,
    }
