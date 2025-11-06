from pydantic import BaseModel
from uuid import UUID

class ResponseCreate(BaseModel):
    interview_id: UUID
    video_file_path: str
