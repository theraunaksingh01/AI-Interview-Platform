from __future__ import annotations

from datetime import datetime
from uuid import UUID, uuid4
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.orm import Session

from db.session import get_db


router = APIRouter(prefix="/api/mock", tags=["mock"])


class MockSessionStartRequest(BaseModel):
    role_target: str
    seniority: str
    company_type: Optional[str] = None
    focus_area: Optional[str] = None
    guest_token: Optional[str] = None
    duration_mins: Optional[int] = 45
    resume_uploaded: Optional[bool] = False


@router.post("/session/start")
def start_mock_session(payload: MockSessionStartRequest, db: Session = Depends(get_db)):
    guest_token = payload.guest_token or str(uuid4())

    row = db.execute(
        text(
            """
            INSERT INTO mock_sessions (
                guest_token,
                role_target,
                seniority,
                company_type,
                focus_area,
                resume_uploaded,
                duration_mins,
                status,
                started_at
            )
            VALUES (
                :guest_token,
                :role_target,
                :seniority,
                :company_type,
                :focus_area,
                :resume_uploaded,
                :duration_mins,
                'in_progress',
                :started_at
            )
            RETURNING id
            """
        ),
        {
            "guest_token": guest_token,
            "role_target": payload.role_target,
            "seniority": payload.seniority,
            "company_type": payload.company_type,
            "focus_area": payload.focus_area,
            "resume_uploaded": bool(payload.resume_uploaded),
            "duration_mins": payload.duration_mins or 45,
            "started_at": datetime.utcnow(),
        },
    ).mappings().first()

    db.commit()

    return {
        "session_id": str(row["id"]),
        "guest_token": guest_token,
    }


@router.get("/session/{session_id}")
def get_mock_session(session_id: UUID, db: Session = Depends(get_db)):
    session = db.execute(
        text("SELECT * FROM mock_sessions WHERE id = :sid"),
        {"sid": str(session_id)},
    ).mappings().first()

    if not session:
        raise HTTPException(status_code=404, detail="Mock session not found")

    return dict(session)
