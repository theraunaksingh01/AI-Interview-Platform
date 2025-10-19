from sqlalchemy import Column, Integer, String, Text, DateTime, func
from .session import Base

class Role(Base):
    __tablename__ = "roles"
    id = Column(Integer, primary_key=True)
    title = Column(String(200), nullable=False)
    level = Column(String(50))
    jd_text = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
