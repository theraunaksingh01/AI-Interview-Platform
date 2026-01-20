from sqlalchemy.orm import Session
from typing import Optional, Dict, Any
from uuid import UUID

from models.interview_timeline import InterviewTimeline


def log_timeline_event(
    db: Session,
    *,
    interview_id: UUID,
    event_type: str,
    payload: Dict[str, Any] | None = None,
    question_id: Optional[int] = None,
):
    event = InterviewTimeline(
        interview_id=interview_id,
        question_id=question_id,
        event_type=event_type,
        payload=payload or {},
    )
    db.add(event)
    db.commit()
