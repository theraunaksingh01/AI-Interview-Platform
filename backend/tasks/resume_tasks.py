# backend/tasks/resume_tasks.py
from __future__ import annotations
import io
import os
import json
from sqlalchemy.orm import Session
from sqlalchemy import text
from db.session import SessionLocal
from celery_app import app
from core.s3_client import get_s3_client

# Optional parsers (best-effort)
def _extract_text(bytes_data: bytes, filename: str, content_type: str | None) -> str:
    name = (filename or "").lower()
    ct = (content_type or "").lower()

    # DOCX
    try:
        if name.endswith(".docx") or "word" in ct:
            from docx import Document
            bio = io.BytesIO(bytes_data)
            doc = Document(bio)
            return "\n".join([p.text for p in doc.paragraphs]).strip()
    except Exception:
        pass

    # PDF
    try:
        if name.endswith(".pdf") or "pdf" in ct:
            import pdfplumber
            bio = io.BytesIO(bytes_data)
            text_acc = []
            with pdfplumber.open(bio) as pdf:
                for page in pdf.pages:
                    text_acc.append(page.extract_text() or "")
            return "\n".join(text_acc).strip()
    except Exception:
        pass

    # Fallback as plain text
    try:
        return bytes_data.decode("utf-8", errors="ignore")
    except Exception:
        return ""


@app.task(name="tasks.extract_resume_text")
def extract_resume_text(resume_id: int) -> dict:
    """
    Load candidate_resumes -> uploads -> fetch object from S3 → extract text →
    save back to candidate_resumes.resume_text (if applicable) and update uploads row.

    Works for either:
      - interviews.resume_id -> candidate_resumes.id  (preferred), or
      - interviews.resume_id -> uploads.id           (fallback)
    """
    db: Session = SessionLocal()
    upload_id = None
    try:
        # Try candidate_resumes join first (and capture upload_id)
        row = db.execute(text("""
            SELECT cr.id AS resume_id, u.id AS upload_id, u.key, u.filename, u.content_type
            FROM candidate_resumes cr
            JOIN uploads u ON u.id = cr.upload_id
            WHERE cr.id = :rid
        """), {"rid": resume_id}).mappings().first()

        # fallback: if interviews.resume_id actually points to uploads
        if not row:
            row = db.execute(text("""
                SELECT :rid AS resume_id, u.id AS upload_id, u.key, u.filename, u.content_type
                FROM uploads u
                WHERE u.id = :rid
            """), {"rid": resume_id}).mappings().first()

        if not row or not row.get("key"):
            return {"ok": False, "error": "resume upload key not found"}

        upload_id = row.get("upload_id")

        # Download object from S3
        s3 = get_s3_client()
        bucket = os.getenv("S3_BUCKET") or "ai-interview-uploads"
        bio = io.BytesIO()
        try:
            s3.download_fileobj(bucket, row["key"], bio)
        except Exception as e:
            # mark upload failed and write ai_feedback
            fb = {"summary": "S3 download failed", "error": str(e)}
            try:
                if upload_id:
                    db.execute(text("""
                        UPDATE uploads
                           SET status = 'failed',
                               ai_feedback = :fb,
                               updated_at = now()
                         WHERE id = :uid
                    """), {"fb": json.dumps(fb), "uid": upload_id})
                    db.commit()
            except Exception:
                db.rollback()
            return {"ok": False, "error": f"S3 download failed: {e}"}

        # Extract text
        text_body = ""
        try:
            text_body = _extract_text(bio.getvalue(), row.get("filename") or "", row.get("content_type") or "")
        except Exception as e:
            # extraction error: mark upload failed
            fb = {"summary": "resume extraction failed", "error": str(e)}
            try:
                if upload_id:
                    db.execute(text("""
                        UPDATE uploads
                           SET status = 'failed',
                               ai_feedback = :fb,
                               updated_at = now()
                         WHERE id = :uid
                    """), {"fb": json.dumps(fb), "uid": upload_id})
                    db.commit()
            except Exception:
                db.rollback()
            return {"ok": False, "error": f"extraction failed: {e}"}

        # Save back to candidate_resumes (if exists)
        try:
            db.execute(text("""
                UPDATE candidate_resumes
                   SET resume_text = :txt
                 WHERE id = :rid
            """), {"txt": text_body[:200000], "rid": row["resume_id"]})
            db.commit()
        except Exception:
            db.rollback()  # ignore if candidate_resumes doesn't exist or update fails

        # Also update the uploads row so UI shows 'done' and transcript/ai_feedback
        try:
            fb = {"summary": "Resume text extracted", "chars": len(text_body)}
            if upload_id:
                db.execute(text("""
                    UPDATE uploads
                       SET status = 'done',
                           transcript = :txt,
                           ai_feedback = :fb,
                           updated_at = now()
                     WHERE id = :uid
                """), {
                    "txt": (text_body[:200000] if text_body else ""),
                    "fb": json.dumps(fb),
                    "uid": upload_id,
                })
                db.commit()
        except Exception:
            db.rollback()  # don't fail entirely - we've already saved resume_text if possible

        return {"ok": True, "chars": len(text_body)}
    except Exception as e:
        db.rollback()
        # if we have an upload_id, mark it failed and save the exception for debugging
        try:
            if upload_id:
                db.execute(text("""
                    UPDATE uploads
                       SET status = 'failed',
                           ai_feedback = :fb,
                           updated_at = now()
                     WHERE id = :uid
                """), {"fb": json.dumps({"summary": "task error", "error": str(e)}), "uid": upload_id})
                db.commit()
        except Exception:
            db.rollback()
        return {"ok": False, "error": str(e)}
    finally:
        db.close()
