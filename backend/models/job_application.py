from pydantic import BaseModel
from uuid import UUID
from datetime import datetime
from typing import Optional


class JobApplicationOut(BaseModel):
    """Full job application model"""
    id: UUID
    job_id: int
    candidate_email: str
    candidate_name: Optional[str] = None
    attempt_number: int
    status: str  # invited / started / completed / shortlisted / rejected / advanced
    invite_token: str
    invited_at: datetime
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None

    # Joined from interviews table
    overall_score: Optional[float] = None
    rubric_scores: Optional[dict] = None
    cheat_score: Optional[float] = None
    cheat_risk: Optional[str] = None
    ai_recommendation: Optional[str] = None

    class Config:
        from_attributes = True


class CandidateListItem(BaseModel):
    """Lightweight model for ranked candidate list — no transcripts"""
    application_id: UUID
    candidate_name: Optional[str] = None
    candidate_email: str
    overall_score: Optional[float] = None
    rubric_scores: Optional[dict] = None
    cheat_risk: Optional[str] = None
    status: str
    completed_at: Optional[datetime] = None
    attempt_number: int


class CandidateDetail(JobApplicationOut):
    """Full model for detail panel — includes answers and signals"""
    answers: list = []  # list of InterviewAnswer with cheat signals
    cheat_signals: list = []  # all CheatSignal records for this session
