# models/user.py
from pydantic import BaseModel, EmailStr, Field
from typing import List, Optional

class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=6)
    full_name: Optional[str] = None

class UserOut(BaseModel):
    id: int
    email: EmailStr
    full_name: Optional[str] = None
    college: Optional[str] = None
    year_of_study: Optional[str] = None
    branch: Optional[str] = None
    is_active: bool
    is_superuser: bool
    roles: List[str] = []
    plan: str = "free"
    onboarding_done: bool = False
    target_roles: List[str] = []
    self_level: Optional[str] = None
    placement_goal: Optional[str] = None
    target_companies: List[str] = []
    linkedin_url: Optional[str] = None
    github_url: Optional[str] = None

    class Config:
        from_attributes = True
