from pydantic import BaseModel, Field
from typing import Optional, Dict, Any

class RoleCreate(BaseModel):
    title: str = Field(..., min_length=2)
    level: str | None = None
    jd_text: str

class RoleOut(BaseModel):
    id: int
    title: str
    level: str | None
    jd_text: str
    rubric_weights: Optional[Dict[str, Any]] = None
    class Config:
        from_attributes = True

