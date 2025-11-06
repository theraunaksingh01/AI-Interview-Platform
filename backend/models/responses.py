from sqlalchemy import Column, String, Text, ForeignKey
from uuid import uuid4
from db.session import Base   # <— use the same Base everyone else uses

class Responses(Base):
    __tablename__ = "responses"
    id = Column(String, primary_key=True, default=lambda: str(uuid4()))
    interview_id = Column(String, ForeignKey("interviews.id"))
    video_file_path = Column(Text)
    transcript = Column(Text, nullable=True)
    ai_feedback = Column(Text, nullable=True)
