# backend/tasks/question_tasks.py
from __future__ import annotations
import os, json, random, re, asyncio
from typing import Any, Dict, List

from sqlalchemy.orm import Session
from sqlalchemy import text
from db.session import SessionLocal
from celery_app import app
import httpx

# ------------------------------
# Config
# ------------------------------
AI_PROVIDER = os.getenv("AI_PROVIDER", "stub").lower()   # "stub" (default) | "openai" | "ollama"
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4o-mini")

OLLAMA_URL = os.getenv("OLLAMA_URL", "http://127.0.0.1:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "llama3")

NUM_QUESTIONS = int(os.getenv("AI_Q_COUNT", "3"))

SYS_PROMPT = (
    "You are a senior interviewer. Create concise, unambiguous interview questions "
    "with a mix of 'voice' and 'code'. Return strict JSON."
)

USER_TPL = """Job Description:
---
{jd}

Candidate Resume:
---
{resume}

Return JSON as:
{{
  "questions": [
    {{
      "type": "voice" | "code",
      "question_text": "string",
      "time_limit_seconds": 120 or 300,
      "slug": "kebab-case-identifier"
    }},
    ...
  ]
}}
Aim for {n} questions total. Prefer resume-related topics and at least one coding question appropriate to the JD.
"""

# ------------------------------
# Helpers
# ------------------------------
def _kw(text: str) -> list[str]:
    text = (text or "").lower()
    toks = re.findall(r"[a-zA-Z][a-zA-Z0-9+\-#\.]{1,}", text)
    # unique order-preserving
    return list(dict.fromkeys(toks))[:300]

def _stub_make_questions(jd: str, resume: str, n: int) -> Dict[str, Any]:
    """
    Smarter stub: vary by JD/resume keywords so you don't see the same questions every time.
    Guarantees at least 1 code + 1 voice when n >= 2.
    """
    kw = set(_kw((jd or "") + " " + (resume or "")))

    # Guess tech/domain to personalize phrasing
    stack = (
        "FastAPI/PostgreSQL" if any(k in kw for k in ["fastapi", "postgres", "sql", "db"])
        else "React/Node.js" if any(k in kw for k in ["react", "node", "javascript", "js"])
        else "Python/Data" if any(k in kw for k in ["python", "pandas", "numpy", "ml"])
        else "general backend"
    )
    domain = (
        "e-commerce" if "ecommerce" in kw
        else "content platform" if "cms" in kw
        else "SaaS product"
    )

    VOICE_POOL = [
        (f"Walk me through a recent project where you used {stack}. What was your role and impact?", 120, "project-deep-dive"),
        (f"How would you design a scalable API for a {domain}? Mention trade-offs and data modeling.", 120, "system-design-scalable-api"),
        ("Explain time and space complexity of your last data structure choice in a project.", 120, "ds-complexity-explain"),
        ("Describe how you would debug a production incident end-to-end. What signals and tools?", 120, "prod-debug-playbook"),
        ("Explain database normalization vs indexing with a tiny example.", 120, "normalization-vs-indexing"),
    ]

    CODE_POOL = [
        ("Implement LRU Cache (get/put) with O(1) ops.", 600, "lru-cache"),
        ("Validate balanced parentheses with a stack.", 300, "balanced-parentheses"),
        ("Merge K sorted lists efficiently.", 600, "merge-k-lists"),
        ("Top K frequent elements.", 300, "top-k-frequent"),
        ("Two-sum with optimal time.", 300, "two-sum"),
        ("Write code for Tower of Hanoi.", 300, "tower-of-hanoi"),
    ]

    random.shuffle(VOICE_POOL)
    random.shuffle(CODE_POOL)

    # ensure 1 voice + 1 code if possible
    chosen: List[Dict[str, Any]] = []
    if n >= 2:
        v = VOICE_POOL[0]
        c = CODE_POOL[0]
        chosen.extend([
            {"type": "voice", "question_text": v[0], "time_limit_seconds": v[1], "slug": v[2]},
            {"type": "code", "question_text": c[0], "time_limit_seconds": c[1], "slug": c[2]},
        ])
        # fill rest from mixed pools
        rest_pool = VOICE_POOL[1:] + CODE_POOL[1:]
        random.shuffle(rest_pool)
        for t in rest_pool:
            if len(chosen) >= n: break
            if len(t) == 3:  # voice
                chosen.append({"type": "voice", "question_text": t[0], "time_limit_seconds": t[1], "slug": t[2]})
            else:
                # defensive, though our tuples are length 3
                chosen.append({"type": "voice", "question_text": t[0], "time_limit_seconds": t[1], "slug": "voice-generic"})
    else:
        # n == 1: pick best-fit (prefer voice deep-dive)
        v = VOICE_POOL[0]
        chosen.append({"type": "voice", "question_text": v[0], "time_limit_seconds": v[1], "slug": v[2]})

    return {"questions": chosen[:n]}

async def _llm_json(jd: str, resume: str, n: int) -> Dict[str, Any]:
    # STUB path (default) or OpenAI without key
    if AI_PROVIDER == "stub" or (AI_PROVIDER == "openai" and not OPENAI_API_KEY):
        return _stub_make_questions(jd, resume, n)

    # OLLAMA path
    if AI_PROVIDER == "ollama":
        payload = {
            "model": OLLAMA_MODEL,
            "format": "json",
            "prompt": f"{SYS_PROMPT}\n\n" + USER_TPL.format(jd=jd, resume=resume, n=n),
            "stream": False,
        }
        async with httpx.AsyncClient(timeout=120) as client:
            r = await client.post(f"{OLLAMA_URL}/api/generate", json=payload)
            r.raise_for_status()
            data = r.json()
            txt = data.get("response", "{}")
            try:
                return json.loads(txt)
            except Exception:
                return {"questions": []}

    # OpenAI path
    headers = {"Authorization": f"Bearer {OPENAI_API_KEY}"}
    payload = {
        "model": OPENAI_MODEL,
        "response_format": {"type": "json_object"},
        "messages": [
            {"role": "system", "content": SYS_PROMPT},
            {"role": "user", "content": USER_TPL.format(jd=jd, resume=resume, n=n)},
        ],
        "temperature": 0.3,
    }
    async with httpx.AsyncClient(timeout=120) as client:
        r = await client.post("https://api.openai.com/v1/chat/completions", headers=headers, json=payload)
        r.raise_for_status()
        txt = r.json()["choices"][0]["message"]["content"]
        try:
            return json.loads(txt)
        except Exception:
            return {"questions": []}

# ------------------------------
# Celery Task
# ------------------------------
@app.task(name="tasks.generate_questions_ai")
def generate_questions_ai(interview_id: str, n: int | None = None) -> dict:
    """
    Load JD + resume_text → LLM → insert rows into interview_questions.
    """
    db: Session = SessionLocal()
    try:
        # Load role JD and resume id
        r = db.execute(text("""
            SELECT i.id, i.role_id, i.resume_id,
                   COALESCE(r.jd_text, '') AS jd_text
            FROM interviews i
            LEFT JOIN roles r ON r.id = i.role_id
            WHERE i.id = :iid
        """), {"iid": str(interview_id)}).mappings().first()
        if not r:
            return {"ok": False, "error": "interview not found"}

        # Pull resume text from candidate_resumes (your extractor should have filled this)
        resume_row = db.execute(text("""
            SELECT COALESCE(cr.resume_text, '') AS resume_text
            FROM candidate_resumes cr
            WHERE cr.id = :rid
        """), {"rid": r["resume_id"]}).mappings().first()
        resume_text = (resume_row or {}).get("resume_text") or ""

        # Ask model (or stub)
        llm_out = asyncio.run(_llm_json(r["jd_text"] or "", resume_text or "", int(n or NUM_QUESTIONS)))
        qlist: List[dict] = (llm_out or {}).get("questions", [])
        if not isinstance(qlist, list):
            qlist = []

        # Insert questions
        inserted = 0
        for q in qlist:
            qtype = (q.get("type") or "voice").lower()
            qt = (q.get("question_text") or "").strip()
            if not qt:
                continue
            tl = int(q.get("time_limit_seconds") or (300 if qtype == "code" else 120))
            slug = q.get("slug") or None

            db.execute(text("""
                INSERT INTO interview_questions (interview_id, question_text, type, time_limit_seconds, slug)
                VALUES (:iid, :qt, :tp, :tl, :slug)
            """), {"iid": str(interview_id), "qt": qt, "tp": qtype, "tl": tl, "slug": slug})
            inserted += 1

        db.commit()
        return {"ok": True, "count": inserted, "provider": AI_PROVIDER}
    except Exception as e:
        db.rollback()
        return {"ok": False, "error": str(e)}
    finally:
        db.close()
