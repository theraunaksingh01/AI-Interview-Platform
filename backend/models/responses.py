from sqlalchemy import Column, String, Text
from uuid import uuid4
from db.session import Base   # <— use the same Base everyone else uses

class Responses(Base):
    __tablename__ = "responses"
    id = Column(String, primary_key=True, default=lambda: str(uuid4()))
    upload_id = Column(String)  # Reference the upload/interview
    video_file_path = Column(Text)
    transcript = Column(Text, nullable=True)
    ai_feedback = Column(Text, nullable=True)
