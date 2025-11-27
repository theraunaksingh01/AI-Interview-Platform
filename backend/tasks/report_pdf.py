# backend/tasks/report_pdf.py
import io
import os
import json
import traceback
from typing import Optional

from sqlalchemy.orm import Session
from sqlalchemy import text
from db.session import SessionLocal
from celery_app import app
from core.s3_client import get_s3_client
from core.config import settings
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas


COMPANY = os.getenv("REPORT_COMPANY_NAME", "AI Interview")
LOGO = os.getenv("REPORT_LOGO_PATH", "")  # optional path to logo image file


def _draw_wrapped(c: canvas.Canvas, x: float, y: float, text: str, max_width: int = 500, leading: int = 14):
    """
    Draw text with manual wrapping using reportlab stringWidth.
    Returns new y position after drawing.
    """
    from reportlab.pdfbase.pdfmetrics import stringWidth

    if text is None:
        return y

    # ensure it's a string
    text = str(text)
    words = text.split()
    line = ""
    lines = []
    for w in words:
        candidate = (line + " " + w).strip() if line else w
        if stringWidth(candidate, "Helvetica", 10) < max_width:
            line = candidate
        else:
            if line:
                lines.append(line)
            line = w
    if line:
        lines.append(line)

    for ln in lines:
        c.drawString(x, y, ln)
        y -= leading
    return y


@app.task(name="tasks.generate_pdf")
def generate_pdf(interview_id: str) -> dict:
    """
    Celery task:
      - read interviews.report from DB
      - render a PDF (reportlab)
      - upload to S3/MinIO at key reports/<interview_id>.pdf
      - update interviews.pdf_key
    Returns a dict with ok / error info (and presigned_url if available).
    """
    db: Optional[Session] = None
    buf = None
    try:
        db = SessionLocal()
        print(f"[generate_pdf] start for interview_id={interview_id}")

        row = db.execute(
            text("SELECT report, overall_score FROM interviews WHERE id = :id"),
            {"id": str(interview_id)},
        ).mappings().first()

        if not row:
            msg = "Interview not found"
            print(f"[generate_pdf] {msg}")
            return {"ok": False, "error": msg}

        report = row.get("report")
        if not report:
            msg = "No report available. Run scoring first."
            print(f"[generate_pdf] {msg}")
            return {"ok": False, "error": msg}

        # create PDF to bytes buffer
        buf = io.BytesIO()
        c = canvas.Canvas(buf, pagesize=A4)
        width, height = A4

        # Header
        y = height - 50
        c.setFont("Helvetica-Bold", 16)
        c.drawString(40, y, f"{COMPANY} — Interview Report")
        y -= 22

        # Optional logo (if path exists)
        if LOGO and os.path.exists(LOGO):
            try:
                c.drawImage(LOGO, width - 140, height - 100, width=100, height=60, preserveAspectRatio=True, mask="auto")
            except Exception as e:
                print(f"[generate_pdf] warning: failed drawing logo: {e}")

        c.setFont("Helvetica", 10)
        y -= 4

        # Overall + sections
        overall_score = report.get("overall_score") if isinstance(report, dict) else None
        c.drawString(40, y, f"Overall Score: {overall_score if overall_score is not None else '—'}")
        y -= 14
        sec = (report.get("section_scores") or {}) if isinstance(report, dict) else {}
        c.drawString(
            40,
            y,
            f"Technical: {sec.get('technical', '—')}    Communication: {sec.get('communication', '—')}    Completeness: {sec.get('completeness', '—')}",
        )
        y -= 18

        # Red flags (if any)
        flags = report.get("red_flags", []) if isinstance(report, dict) else []
        if flags:
            c.setFont("Helvetica-Bold", 10)
            c.drawString(40, y, "Red Flags:")
            y -= 14
            c.setFont("Helvetica", 10)
            y = _draw_wrapped(c, 40, y, ", ".join(flags))
            y -= 6

        # Per-question feedback
        c.setFont("Helvetica-Bold", 12)
        c.drawString(40, y, "Per Question Feedback")
        y -= 18
        c.setFont("Helvetica", 10)

        per_q = report.get("per_question", []) if isinstance(report, dict) else []
        for item in per_q:
            if y < 100:
                c.showPage()
                y = height - 60
                c.setFont("Helvetica", 10)

            qid = item.get("question_id", "—")
            qtype = str(item.get("type", "")).upper() if item.get("type") else ""
            c.setFont("Helvetica-Bold", 10)
            c.drawString(40, y, f"Q#{qid} • {qtype}")
            y -= 14
            c.setFont("Helvetica", 10)

            # question text if present
            qtext = item.get("question_text")
            if qtext:
                y = _draw_wrapped(c, 40, y, f"Question: {qtext}", max_width=480)
                y -= 6

            # AI feedback summary
            fb = item.get("ai_feedback") or {}
            summ = fb.get("summary") or "—"
            y = _draw_wrapped(c, 40, y, f"Feedback: {summ}", max_width=480)
            y -= 8

            # scores
            tech = fb.get("technical", item.get("technical", "—"))
            comm = fb.get("communication", item.get("communication", "—"))
            comp = fb.get("completeness", item.get("completeness", "—"))
            c.drawString(40, y, f"Technical: {tech}    Communication: {comm}    Completeness: {comp}")
            y -= 16

        # Finalize PDF
        c.showPage()
        c.save()
        buf.seek(0)
        pdf_bytes = buf.getvalue()

        # Upload to S3 / MinIO
        s3 = get_s3_client()
        bucket = getattr(settings, "S3_BUCKET", None) or getattr(settings, "s3_bucket", None)
        if not bucket:
            msg = "S3 bucket not configured (settings.S3_BUCKET or settings.s3_bucket)"
            print(f"[generate_pdf] {msg}")
            return {"ok": False, "error": msg}

        key = f"reports/{interview_id}.pdf"
        print(f"[generate_pdf] uploading to bucket={bucket} key={key} (size={len(pdf_bytes)} bytes)")

        # perform upload
        try:
            # boto3 style client: put_object
            s3.put_object(Bucket=bucket, Key=key, Body=pdf_bytes, ContentType="application/pdf")
        except Exception as e:
            tb = traceback.format_exc()
            msg = f"Failed to upload PDF to S3/MinIO: {e}"
            print(f"[generate_pdf] {msg}\n{tb}")
            return {"ok": False, "error": msg}

        # update DB with pdf_key only after successful upload
        try:
            db.execute(text("UPDATE interviews SET pdf_key = :k WHERE id = :id"), {"k": key, "id": str(interview_id)})
            db.commit()
        except Exception as e:
            db.rollback()
            tb = traceback.format_exc()
            msg = f"Uploaded but failed to update DB: {e}"
            print(f"[generate_pdf] {msg}\n{tb}")
            return {"ok": False, "error": msg}

        # try to generate presigned URL (best-effort)
        presigned = None
        try:
            expires = int(getattr(settings, "PRESIGNED_URL_EXPIRES", 900))
            # many clients (boto3) support generate_presigned_url
            if hasattr(s3, "generate_presigned_url"):
                presigned = s3.generate_presigned_url("get_object", Params={"Bucket": bucket, "Key": key}, ExpiresIn=expires)
        except Exception as e:
            # not critical; just log
            print(f"[generate_pdf] could not create presigned url: {e}")

        print(f"[generate_pdf] success: interview={interview_id} key={key}")
        return {"ok": True, "pdf_key": key, "bucket": bucket, "presigned_url": presigned}

    except Exception as e:
        tb = traceback.format_exc()
        print(f"[generate_pdf] fatal error: {e}\n{tb}")
        if db:
            try:
                db.rollback()
            except Exception:
                pass
        return {"ok": False, "error": str(e)}
    finally:
        # cleanup
        try:
            if buf:
                buf.close()
        except Exception:
            pass
        if db:
            try:
                db.close()
            except Exception:
                pass
