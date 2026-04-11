# db/models.py
from sqlalchemy import (
    Column,
    Integer,
    String,
    Text,
    DateTime,
    Numeric,
    func,
    Table,
    ForeignKey,
    Boolean,
)
from sqlalchemy.orm import relationship
from .session import Base

import enum
from sqlalchemy.types import Enum as SAEnum
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql import ARRAY

from sqlalchemy import Column, Integer, String, Text, TIMESTAMP, JSON

from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid




# association table between users and roles
user_roles = Table(
    "user_roles",
    Base.metadata,
    Column("user_id", Integer, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
    Column("role_id", Integer, ForeignKey("roles.id", ondelete="CASCADE"), primary_key=True),
)


class Role(Base):
    __tablename__ = "roles"
    id = Column(Integer, primary_key=True)
    title = Column(String(200), nullable=False)
    level = Column(String(50))
    jd_text = Column(Text, nullable=False)
    rubric_weights = Column(JSONB, nullable=True)  # { "dsa": { "label": "...", "weight": 30, "description": "..." }, ... }
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # relationship back to users
    users = relationship("User", secondary=user_roles, back_populates="roles")


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    full_name = Column(String(255), nullable=True)
    hashed_password = Column(String, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    is_superuser = Column(Boolean, default=False, nullable=False)
    plan = Column(String(32), nullable=False, server_default="free")
    plan_expires = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # relationship to Role
    roles = relationship("Role", secondary=user_roles, back_populates="users")
    uploads = relationship("Upload", back_populates="user", cascade="all, delete")


# --- NEW: processing lifecycle enum ---
class UploadStatus(str, enum.Enum):
    pending = "pending"
    processing = "processing"
    done = "done"
    failed = "failed"


class Upload(Base):
    __tablename__ = "uploads"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    key = Column(String(length=1024), nullable=False, unique=True, index=True)  # S3 object key
    filename = Column(String(length=512), nullable=False)
    content_type = Column(String(length=255), nullable=True)
    size = Column(Integer, nullable=True)  # bytes

    # --- NEW: processing lifecycle fields ---
    status = Column(SAEnum(UploadStatus, native_enum=False), nullable=False, server_default="pending")
    processor_job_id = Column(String(255), nullable=True, index=True)
    transcript = Column(Text, nullable=True)
    ai_feedback = Column(JSONB, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    # relationship back to user
    user = relationship("User", back_populates="uploads")
    

class InterviewTurn(Base):
    __tablename__ = "interview_turns"

    id = Column(Integer, primary_key=True, index=True)

    # ✅ no ForeignKey() here – DB still has FK, but ORM doesn’t need to know
    interview_id = Column(UUID(as_uuid=True), nullable=False)
    question_id = Column(Integer, nullable=True)

    speaker = Column(String(16), nullable=False)  # 'candidate' or 'agent'

    started_at = Column(TIMESTAMP(timezone=True), default=datetime.utcnow, nullable=False)
    ended_at = Column(TIMESTAMP(timezone=True), nullable=True)

    transcript = Column(Text, nullable=True)
    asr_latency_ms = Column(Integer, nullable=True)
    audio_s3_key = Column(Text, nullable=True)
    meta = Column(JSON, nullable=False, default=dict)


class MockSession(Base):
    __tablename__ = "mock_sessions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    guest_token = Column(Text, nullable=True)
    role_target = Column(Text, nullable=False)
    seniority = Column(Text, nullable=False)
    company_type = Column(Text, nullable=True)
    focus_area = Column(Text, nullable=True)
    resume_uploaded = Column(Boolean, nullable=False, default=False)
    duration_mins = Column(Integer, nullable=True)
    status = Column(Text, nullable=False, default="in_progress")
    overall_score = Column(Numeric(4, 2), nullable=True)
    dsa_score = Column(Numeric(4, 2), nullable=True)
    system_design_score = Column(Numeric(4, 2), nullable=True)
    behavioral_score = Column(Numeric(4, 2), nullable=True)
    communication_score = Column(Numeric(4, 2), nullable=True)
    started_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class CommunicationReport(Base):
    __tablename__ = "communication_reports"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id = Column(UUID(as_uuid=True), ForeignKey("mock_sessions.id", ondelete="CASCADE"), nullable=False)
    avg_wpm = Column(Numeric(6, 2), nullable=True)
    total_filler_words = Column(Integer, nullable=True)
    filler_breakdown = Column(JSONB, nullable=True)
    total_silence_gaps = Column(Integer, nullable=True)
    longest_silence_sec = Column(Numeric(6, 2), nullable=True)
    star_avg_score = Column(Numeric(4, 2), nullable=True)
    heatmap_data = Column(JSONB, nullable=True)
    top_issues = Column(ARRAY(Text), nullable=True)
    top_strengths = Column(ARRAY(Text), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
