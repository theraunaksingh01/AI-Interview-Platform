from sqlalchemy import Column, Integer, Text, JSON, DateTime
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func

from db.session import Base   # ✅ correct base import


class InterviewTimeline(Base):
    __tablename__ = "interview_timeline"

    id = Column(Integer, primary_key=True, index=True)
    interview_id = Column(UUID(as_uuid=True), nullable=False)
    question_id = Column(Integer, nullable=True)
    event_type = Column(Text, nullable=False)
    payload = Column(JSON, nullable=True)
    created_at = Column(DateTime, server_default=func.now())
