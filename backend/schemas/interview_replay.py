from typing import List, Dict, Any
from pydantic import BaseModel
from datetime import datetime
from uuid import UUID


class ReplayEvent(BaseModel):
    timestamp: datetime
    type: str
    question_id: int | None
    payload: Dict[str, Any]


class InterviewReplay(BaseModel):
    interview_id: UUID
    events: List[ReplayEvent]
