from sqlalchemy import Column, Integer, String, ForeignKey, Numeric, TIMESTAMP, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from sqlalchemy.dialects.postgresql import JSONB

from db.session import Base


class CheatSignal(Base):
    __tablename__ = "cheat_signals"

    id = Column(Integer, primary_key=True, index=True)

    # Foreign keys - reference interview_answers for answer-level tracking
    interview_answer_id = Column(
        Integer,
        ForeignKey("interview_answers.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Signal metadata
    signal_type = Column(String(50), nullable=False, index=True)  # TAB_FOCUS_LOST, PASTE_EVENT, KEYSTROKE_GAP, etc.
    signal_category = Column(String(1), nullable=False, index=True)  # A (timing), B (content), C (browser), D (consistency)
    weight = Column(String(10), nullable=False)  # low, medium, high

    # Signal details (contextual info)
    # Example: {"timestamp": 82400, "duration": 14000, "target": "input", "question_id": 5}
    details = Column(JSONB, nullable=True)

    # Timestamps
    fired_at = Column(TIMESTAMP(timezone=False), server_default=func.now(), nullable=False)
    created_at = Column(TIMESTAMP(timezone=False), server_default=func.now(), nullable=False)

    # Relationships
    answer = relationship(
        "InterviewAnswer",
        back_populates="cheat_signals",
        foreign_keys=[interview_answer_id],
    )
