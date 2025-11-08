# backend/tasks/report_pdf.py
import io, os, json
from sqlalchemy.orm import Session
from sqlalchemy import text
from db.session import SessionLocal
from celery_app import app
from core.s3_client import get_s3_client
from core.config import settings
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas

COMPANY = os.getenv("REPORT_COMPANY_NAME", "AI Interview")
LOGO = os.getenv("REPORT_LOGO_PATH", "")

def _draw_wrapped(c, x, y, text, max_width=500, leading=14):
    from reportlab.pdfbase.pdfmetrics import stringWidth
    words = text.split()
    line=""; lines=[]
    for w in words:
        if stringWidth(line + (" " if line else "") + w, "Helvetica", 10) < max_width:
            line = (line + " " + w).strip()
        else:
            lines.append(line); line = w
    if line: lines.append(line)
    for ln in lines:
        c.drawString(x, y, ln); y -= leading
    return y

@app.task(name="tasks.generate_pdf")
def generate_pdf(interview_id: str) -> dict:
    db: Session = SessionLocal()
    try:
        row = db.execute(text("SELECT report, overall_score FROM interviews WHERE id=:id"),
                         {"id": str(interview_id)}).mappings().first()
        if not row or not row["report"]:
            return {"ok": False, "error": "No report available. Run scoring first."}
        report = row["report"]

        buf = io.BytesIO()
        c = canvas.Canvas(buf, pagesize=A4)
        width, height = A4

        # header
        y = height - 50
        c.setFont("Helvetica-Bold", 16); c.drawString(40, y, f"{COMPANY} — Interview Report"); y -= 20
        if LOGO and os.path.exists(LOGO):
            try: c.drawImage(LOGO, width-140, height-100, width=100, height=60, preserveAspectRatio=True, mask='auto')
            except Exception: pass
        c.setFont("Helvetica", 10)

        # overall & sections
        y -= 10
        c.drawString(40, y, f"Overall Score: {report.get('overall_score', 0)}"); y -= 14
        sec = report.get("section_scores", {})
        c.drawString(40, y, f"Technical: {sec.get('technical', 0)}  Communication: {sec.get('communication', 0)}  Completeness: {sec.get('completeness', 0)}"); y -= 18

        # red flags
        flags = report.get("red_flags", [])
        if flags:
            c.setFont("Helvetica-Bold", 10); c.drawString(40, y, "Red Flags:"); y -= 14; c.setFont("Helvetica", 10)
            y = _draw_wrapped(c, 40, y, ", ".join(flags)); y -= 6

        # per question
        c.setFont("Helvetica-Bold", 12); c.drawString(40, y, "Per Question Feedback"); y -= 18; c.setFont("Helvetica", 10)
        for item in report.get("per_question", []):
            y -= 8
            c.setFont("Helvetica-Bold", 10)
            c.drawString(40, y, f"Q#{item.get('question_id')} • {item.get('type').upper()}"); y -= 14
            c.setFont("Helvetica", 10)
            fb = item.get("ai_feedback") or {}
            summ = fb.get("summary") or "—"
            y = _draw_wrapped(c, 40, y, f"Feedback: {summ}")
            if y < 80: c.showPage(); y = height - 60

        c.showPage(); c.save()
        buf.seek(0)

        # store to S3/MinIO
        s3 = get_s3_client()
        bucket = settings.S3_BUCKET if hasattr(settings, "S3_BUCKET") else settings.s3_bucket
        key = f"reports/{interview_id}.pdf"
        s3.put_object(Bucket=bucket, Key=key, Body=buf.getvalue(), ContentType="application/pdf")

        db.execute(text("UPDATE interviews SET pdf_key=:k WHERE id=:id"), {"k": key, "id": str(interview_id)})
        db.commit()
        return {"ok": True, "pdf_key": key}
    except Exception as e:
        db.rollback()
        return {"ok": False, "error": str(e)}
    finally:
        db.close()
