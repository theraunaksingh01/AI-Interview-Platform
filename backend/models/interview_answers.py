from sqlalchemy import Column, Integer, Text, ForeignKey, JSON, TIMESTAMP
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from db.session import Base


class InterviewAnswer(Base):
    __tablename__ = "interview_answers"

    id = Column(Integer, primary_key=True, index=True)

    interview_question_id = Column(
        Integer,
        ForeignKey("interview_questions.id", ondelete="CASCADE"),
        nullable=False,
    )

    upload_id = Column(Integer)
    code_answer = Column(Text)
    transcript = Column(Text)

    ai_feedback = Column(JSON)
    red_flags = Column(JSON)
    cheat_flags = Column(JSON, default=list)

    llm_raw = Column(Text)
    code_output = Column(Text)
    test_results = Column(JSON)

    created_at = Column(
        TIMESTAMP(timezone=False),
        server_default=func.now(),
    )

    # 🔗 relationship
    question = relationship(
        "InterviewQuestion",
        back_populates="answers",
    )
