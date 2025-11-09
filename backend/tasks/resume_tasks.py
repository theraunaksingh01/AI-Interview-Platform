from __future__ import annotations
import io, os, re, json, tempfile
import fitz  # PyMuPDF
from sqlalchemy.orm import Session
from sqlalchemy import text
from db.session import SessionLocal
from celery_app import app
from core.s3_client import get_s3_client
from core.config import settings

# naive keyword bank (expand as needed)
SKILL_BANK = {
  "fastapi","django","flask","python","javascript","typescript","react","next.js","node",
  "java","spring","c++","docker","kubernetes","aws","gcp","azure",
  "postgres","mysql","mongodb","redis","celery","rabbitmq","graphql","rest","s3","minio",
  "whisper","nlp","pandas","numpy","pytorch","tensorflow"
}

def _extract_text_from_pdf_bytes(pdf_bytes: bytes) -> str:
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    text = []
    for page in doc: text.append(page.get_text("text"))
    return "\n".join(text)

def _infer_skills(text: str) -> list[str]:
    lower = text.lower()
    found = []
    for kw in SKILL_BANK:
        if kw.lower() in lower:
            found.append(kw.lower())
    # dedupe preserve order
    return list(dict.fromkeys(found))

@app.task(name="tasks.parse_resume")
def parse_resume_task(resume_id: int) -> dict:
    db: Session = SessionLocal()
    try:
        # join to get upload key
        row = db.execute(text("""
            SELECT r.id, u.key AS upload_key
            FROM candidate_resumes r
            LEFT JOIN uploads u ON u.id = r.upload_id
            WHERE r.id = :rid
        """), {"rid": resume_id}).mappings().first()
        if not row or not row["upload_key"]:
            return {"ok": False, "error": "resume/upload not found"}

        s3 = get_s3_client()
        bucket = settings.S3_BUCKET if hasattr(settings, "S3_BUCKET") else settings.s3_bucket
        buf = io.BytesIO()
        s3.download_fileobj(bucket, row["upload_key"], buf)
        text_plain = _extract_text_from_pdf_bytes(buf.getvalue())
        skills = _infer_skills(text_plain)

        db.execute(text("""
            UPDATE candidate_resumes
            SET plain_text=:t, skills=:s, parsed=:p
            WHERE id=:rid
        """), {"t": text_plain, "s": skills, "p": json.dumps({"length": len(text_plain)}), "rid": resume_id})
        db.commit()
        return {"ok": True, "skills": skills}
    except Exception as e:
        db.rollback()
        return {"ok": False, "error": str(e)}
    finally:
        db.close()
