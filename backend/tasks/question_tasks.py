from __future__ import annotations
import os, json, random
from typing import Any
from sqlalchemy.orm import Session
from sqlalchemy import text
from db.session import SessionLocal
from celery_app import app
import httpx

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")

SYSTEM = "You write concise interview questions. Output strict JSON as an array."

def _fallback_generator(role_skills: list[str], resume_skills: list[str]) -> list[dict[str,Any]]:
    # deterministic simple set:
    qs = []
    focus = (resume_skills or [])[:3] or (role_skills or [])[:3]
    if not focus: focus = ["problem solving","communication"]
    qs.append({"type":"voice","question_text":f"Explain {focus[0]} in simple words.", "time_limit_seconds":120})
    qs.append({"type":"code","question_text":"Write code for Tower of Hanoi.", "time_limit_seconds":300})
    qs.append({"type":"voice","question_text":"Describe a project where you used " + ", ".join(focus) + ".", "time_limit_seconds":120})
    return qs

async def _llm_generate(role_title: str, jd_text: str, role_skills: list[str], resume_text: str, resume_skills: list[str]):
    if not OPENAI_API_KEY:
        return _fallback_generator(role_skills, resume_skills)

    prompt = f"""
Role: {role_title}
JD: {jd_text[:1200]}

Role skills: {role_skills}
Resume skills: {resume_skills}

Resume (truncated): {resume_text[:1500]}

Return 4-6 interview questions as compact JSON array.
Each item: {{"type":"voice|code","question_text":"...", "time_limit_seconds":int}}
Include at least 1 coding and 2 voice questions. No markdown, only JSON.
"""
    try:
        async with httpx.AsyncClient(timeout=60) as client:
            r = await client.post("https://api.openai.com/v1/chat/completions",
                headers={"Authorization": f"Bearer {OPENAI_API_KEY}"},
                json={
                    "model":"gpt-4o-mini",
                    "response_format":{"type":"json_object"},
                    "messages":[
                        {"role":"system","content":SYSTEM},
                        {"role":"user","content":prompt}
                    ],
                    "temperature":0.2
                }
            )
            r.raise_for_status()
            content = r.json()["choices"][0]["message"]["content"]
            obj = json.loads(content)
            # support either {"questions":[...]} or [...]
            arr = obj.get("questions") if isinstance(obj, dict) else obj
            if not isinstance(arr, list): raise ValueError("no list")
            # sanitize
            out=[]
            for q in arr:
                t=str(q.get("type","voice")).lower()
                if t not in ("voice","code"): t="voice"
                out.append({
                    "type": t,
                    "question_text": str(q.get("question_text","")).strip()[:500],
                    "time_limit_seconds": int(q.get("time_limit_seconds", 120 if t=="voice" else 300))
                })
            return out[:6]
    except Exception:
        return _fallback_generator(role_skills, resume_skills)

@app.task(name="tasks.generate_questions")
def generate_questions_task(interview_id: str) -> dict:
    db: Session = SessionLocal()
    try:
        # load interview + role + resume bundle
        row = db.execute(text("""
    SELECT i.id, i.role_id, i.resume_id,
           r.title, r.jd_text, r.skills AS role_skills,     -- if you don't have roles.skills, return [] from SQL
           cr.plain_text AS resume_text, cr.skills AS resume_skills
    FROM interviews i
    JOIN roles r ON r.id = i.role_id           -- ✅ roles, not job_roles
    JOIN candidate_resumes cr ON cr.id = i.resume_id
    WHERE i.id = :iid
"""), {"iid": str(interview_id)}).mappings().first()
        if not row:
            return {"ok": False, "error": "interview bundle not found"}

        # call LLM (or fallback)
        import asyncio
        qs = asyncio.run(
            _llm_generate(
                row["title"], row["jd_text"],
                row["role_skills"] or [], row["resume_text"] or "", row["resume_skills"] or []
            )
        )

        # idempotency: if questions exist -> replace or skip.
        db.execute(text("DELETE FROM interview_questions WHERE interview_id=:iid"), {"iid": str(interview_id)})

        for q in qs:
            db.execute(text("""
                INSERT INTO interview_questions (interview_id, question_text, type, time_limit_seconds, source, blueprint)
                VALUES (:iid, :qt, :tp, :ts, 'ai-generated', :bp)
            """), {
                "iid": str(interview_id),
                "qt": q["question_text"],
                "tp": q["type"],
                "ts": int(q["time_limit_seconds"]),
                "bp": json.dumps({
                    "role_skills": row["role_skills"] or [],
                    "resume_skills": row["resume_skills"] or []
                })
            })

        db.commit()
        return {"ok": True, "count": len(qs)}
    except Exception as e:
        db.rollback()
        return {"ok": False, "error": str(e)}
    finally:
        db.close()
