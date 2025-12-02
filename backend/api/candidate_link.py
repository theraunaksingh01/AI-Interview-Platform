# backend/api/candidate_link.py
from fastapi import APIRouter, File, UploadFile, Form, Depends, HTTPException
from fastapi.responses import JSONResponse
import os, jwt, datetime, uuid
from db.session import SessionLocal
from sqlalchemy import text
from tasks.question_tasks import generate_questions_ai  # existing task that consumes resume_text or interview_id
from core.config import settings as cfg  # optional, if you have
from core.s3_client import get_s3_client  # optional; if you already use upload route prefer delegating to it

router = APIRouter(prefix="/candidate", tags=["candidate"])

SECRET = os.getenv("APP_SECRET", os.getenv("SECRET_KEY", "dev-secret"))
FRONTEND_BASE = os.getenv("FRONTEND_BASE", "http://localhost:3000")

@router.post("/submit_and_get_link")
async def submit_and_get_link(
    name: str = Form(...),
    email: str = Form(...),
    interview_id: str = Form(None),
    resume: UploadFile = File(...),
):
    db = SessionLocal()
    try:
        # 1) create interview if not provided
        if not interview_id:
            interview_id = str(uuid.uuid4())
            try:
                db.execute(text("INSERT INTO interviews (id, candidate_name, candidate_email, created_at) VALUES (:id, :name, :email, now())"),
                           {"id": interview_id, "name": name, "email": email})
                db.commit()
            except Exception:
                db.rollback()

        # 2) store resume file: reuse your uploads flow if you have /uploads endpoint;
        #    simplified demo: write to local temp and store a record to link to interview
        try:
            content = await resume.read()
            # If you use your uploads endpoint, POST to it instead. For demo, save local:
            saved_key = f"demo_uploads/{interview_id}/{resume.filename}"
            # try S3 if available
            try:
                s3 = get_s3_client()
                bucket = getattr(cfg, "S3_BUCKET", None) or os.getenv("S3_BUCKET")
                if s3 and bucket:
                    s3.put_object(Bucket=bucket, Key=saved_key, Body=content, ContentType=resume.content_type)
                    # optionally insert a row in uploads table
                    db.execute(text("INSERT INTO uploads (interview_id, filename, s3_key, status, created_at) VALUES (:iid, :fn, :key, 'done', now())"),
                               {"iid": interview_id, "fn": resume.filename, "key": saved_key})
                    db.commit()
                else:
                    # fallback to local file (demo only)
                    os.makedirs(os.path.join("tmp_demo_uploads", interview_id), exist_ok=True)
                    path = os.path.join("tmp_demo_uploads", interview_id, resume.filename)
                    with open(path, "wb") as f:
                        f.write(content)
                    db.execute(text("INSERT INTO uploads (interview_id, filename, local_path, status, created_at) VALUES (:iid, :fn, :path, 'done', now())"),
                               {"iid": interview_id, "fn": resume.filename, "path": path})
                    db.commit()
            except Exception:
                # fallback local
                os.makedirs(os.path.join("tmp_demo_uploads", interview_id), exist_ok=True)
                path = os.path.join("tmp_demo_uploads", interview_id, resume.filename)
                with open(path, "wb") as f:
                    f.write(content)
                db.execute(text("INSERT INTO uploads (interview_id, filename, local_path, status, created_at) VALUES (:iid, :fn, :path, 'done', now())"),
                           {"iid": interview_id, "fn": resume.filename, "path": path})
                db.commit()
        except Exception as e:
            db.rollback()
            raise HTTPException(500, f"upload failed: {e}")

        # 3) enqueue generate_questions_ai (existing) for that interview
        try:
            # if your task signature is generate_questions_ai.delay(interview_id)
            generate_questions_ai.delay(interview_id)
        except Exception:
            # fallback: log - but continue to give link
            pass

        # 4) create signed token for candidate link (demo)
        exp = datetime.datetime.utcnow() + datetime.timedelta(hours=24)
        token_payload = {"interview_id": interview_id, "role": "candidate", "exp": int(exp.timestamp())}
        token = jwt.encode(token_payload, SECRET, algorithm="HS256")

        frontend_url = f"{FRONTEND_BASE}/candidate/interview?token={token}"
        return JSONResponse({"ok": True, "interview_id": interview_id, "frontend_url": frontend_url, "token": token})
    finally:
        db.close()
