# db/models.py
from sqlalchemy import (
    Column,
    Integer,
    String,
    Text,
    DateTime,
    func,
    Table,
    ForeignKey,
    Boolean,
)
from sqlalchemy.orm import relationship
from .session import Base

import enum
from sqlalchemy.types import Enum as SAEnum


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

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    # relationship back to user
    user = relationship("User", back_populates="uploads")
