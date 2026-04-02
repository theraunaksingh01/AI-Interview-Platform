from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.orm import Session

from db.session import get_db


router = APIRouter(prefix="/api/interview", tags=["public-invite"])


def _has_job_applications_table(db: Session) -> bool:
    return (
        db.execute(
            text(
                """
                SELECT 1
                FROM information_schema.tables
                WHERE table_name = 'job_applications'
                LIMIT 1
                """
            )
        ).scalar()
        is not None
    )


@router.get("/{token}/validate")
def validate_invite(token: str, db: Session = Depends(get_db)):
    if not _has_job_applications_table(db):
        raise HTTPException(status_code=404, detail="Invalid or expired invite link")

    application = db.execute(
        text(
            """
            SELECT id, job_id, candidate_name, status
            FROM job_applications
            WHERE invite_token = :token
            LIMIT 1
            """
        ),
        {"token": token},
    ).mappings().first()

    if not application:
        raise HTTPException(status_code=404, detail="Invalid or expired invite link")

    if application["status"] == "completed":
        raise HTTPException(status_code=410, detail="This interview has already been completed")

    has_interview_duration = db.execute(
        text(
            """
            SELECT 1
            FROM information_schema.columns
            WHERE table_name = 'roles' AND column_name = 'interview_duration'
            LIMIT 1
            """
        )
    ).scalar() is not None

    if has_interview_duration:
        role = db.execute(
            text(
                """
                SELECT title, level, jd_text, rubric_weights, COALESCE(interview_duration, 45) AS duration_mins
                FROM roles
                WHERE id = :job_id
                LIMIT 1
                """
            ),
            {"job_id": application["job_id"]},
        ).mappings().first()
    else:
        role = db.execute(
            text(
                """
                SELECT title, level, jd_text, rubric_weights, 45 AS duration_mins
                FROM roles
                WHERE id = :job_id
                LIMIT 1
                """
            ),
            {"job_id": application["job_id"]},
        ).mappings().first()

    if not role:
        raise HTTPException(status_code=404, detail="Role not found for invite")

    return {
        "application_id": str(application["id"]),
        "candidate_name": application["candidate_name"],
        "role_title": role["title"],
        "seniority": role["level"],
        "jd_text": role["jd_text"],
        "rubric_weights": role["rubric_weights"],
        "duration_mins": int(role["duration_mins"] or 45),
    }


@router.post("/{token}/start")
def start_token_interview(token: str, db: Session = Depends(get_db)):
    if not _has_job_applications_table(db):
        raise HTTPException(status_code=404, detail="Invalid invite token")

    application = db.execute(
        text(
            """
            SELECT id, status
            FROM job_applications
            WHERE invite_token = :token
            LIMIT 1
            """
        ),
        {"token": token},
    ).mappings().first()

    if not application:
        raise HTTPException(status_code=404, detail="Invalid invite token")

    if application["status"] == "completed":
        raise HTTPException(status_code=410, detail="Already completed")

    db.execute(
        text(
            """
            UPDATE job_applications
            SET status = 'started', started_at = :started_at
            WHERE id = :app_id
            """
        ),
        {"app_id": application["id"], "started_at": datetime.utcnow()},
    )

    row = db.execute(
        text(
            """
            INSERT INTO interviews (application_id, status, created_at)
            VALUES (:app_id, 'in_progress', now())
            RETURNING id
            """
        ),
        {"app_id": application["id"]},
    ).mappings().first()

    db.commit()

    return {
        "interview_id": str(row["id"]),
        "application_id": str(application["id"]),
    }
