# backend/models/interview_questions.py

from sqlalchemy import Column, Integer, Text, ForeignKey, Boolean, JSON
from sqlalchemy.orm import relationship

from db.session import Base


class InterviewQuestion(Base):
    __tablename__ = "interview_questions"

    id = Column(Integer, primary_key=True, index=True)

    interview_id = Column(
        Integer,
        ForeignKey("interviews.id", ondelete="CASCADE"),
        nullable=False,
    )

    question_text = Column(Text, nullable=False)

    question_type = Column(Text)  # "voice", "code"
    difficulty = Column(Text)

    # ⚠️ metadata is RESERVED → map safely
    meta = Column("metadata", JSON)

    is_active = Column(Boolean, default=True)

    # 🔗 relationship
    answers = relationship(
        "InterviewAnswer",
        back_populates="question",
        cascade="all, delete-orphan",
    )
