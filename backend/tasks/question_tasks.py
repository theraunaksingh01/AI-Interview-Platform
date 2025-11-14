# backend/tasks/question_tasks.py
from __future__ import annotations
import os
import json
import random
import re
import asyncio
import logging
from typing import Any, Dict, List, Optional

from sqlalchemy.orm import Session
from sqlalchemy import text
from db.session import SessionLocal
from celery_app import app
import httpx

log = logging.getLogger(__name__)
if not log.handlers:
    # basic config if not already configured by app
    logging.basicConfig(level=logging.INFO)

# ------------------------------
# Config
# ------------------------------
AI_PROVIDER = os.getenv("AI_PROVIDER", "stub").lower()   # "stub" (default) | "openai" | "ollama"
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4o-mini")

OLLAMA_URL = os.getenv("OLLAMA_URL", "http://127.0.0.1:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "tinyllama:latest")
NUM_QUESTIONS = int(os.getenv("AI_Q_COUNT", "3"))

SYS_PROMPT = (
    "You are a senior interviewer. Create concise, unambiguous interview questions "
    "with a mix of 'voice' and 'code'. Return strict JSON and nothing else."
)

# NOTE: template uses double braces to escape literal JSON in str.format()
USER_TPL = """You will be given a Job Description and a Candidate Resume. Produce **ONLY** a JSON object with a top-level key "questions" whose value is an ARRAY of question objects. Each question must be either type \"voice\" (spoken answer) or \"code\" (programming task). Do NOT output any other question types or any commentary.

Each question object MUST have these keys:
- id: short unique id (string)
- type: one of \"voice\" or \"code\"
- question_text: full question body
- time_limit_seconds: integer (seconds)
- tags: array of short tag strings (optional)

Return exactly this JSON. No markdown, no backticks, no commentary.

Example:
{{
  "questions": [
    {{
      "id": "q1",
      "type": "voice",
      "question_text": "Walk me through a recent project where you used FastAPI. What was your role and impact?",
      "time_limit_seconds": 120,
      "tags": ["fastapi","system-design"]
    }},
    {{
      "id": "q2",
      "type": "code",
      "question_text": "Implement an LRU cache with get/put operations in your preferred language. Provide complexity notes.",
      "time_limit_seconds": 600,
      "tags": ["python","algorithms"]
    }}
  ]
}}

Now produce {n} questions tailored to the JD and resume provided below.
Job Description:
---
{jd}

Candidate Resume:
---
{resume}
"""

# ------------------------------
# Helpers
# ------------------------------
def _kw(text_in: str) -> List[str]:
    text = (text_in or "").lower()
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

    chosen: List[Dict[str, Any]] = []
    if n >= 2:
        v = VOICE_POOL[0]
        c = CODE_POOL[0]
        chosen.extend([
            {"type": "voice", "question_text": v[0], "time_limit_seconds": v[1], "slug": v[2]},
            {"type": "code", "question_text": c[0], "time_limit_seconds": c[1], "slug": c[2]},
        ])
        rest_pool: List[tuple] = VOICE_POOL[1:] + CODE_POOL[1:]
        random.shuffle(rest_pool)
        for t in rest_pool:
            if len(chosen) >= n:
                break
            chosen.append({"type": "voice", "question_text": t[0], "time_limit_seconds": t[1], "slug": t[2]})
    else:
        v = VOICE_POOL[0]
        chosen.append({"type": "voice", "question_text": v[0], "time_limit_seconds": v[1], "slug": v[2]})

    return {"questions": chosen[:n]}


def _parse_plain_text_questions(text_blob: str, n: int) -> Dict[str, Any]:
    """
    Heuristic fallback: parse numbered or dashed lists into question objects.
    Returns {"questions": [...]} with up to n items.
    """
    if not text_blob:
        return {"questions": []}

    lines = [ln.strip() for ln in text_blob.splitlines() if ln.strip()]
    # Combine consecutive lines into paragraphs where lines don't start with 1. or -
    paras = []
    cur = []
    for ln in lines:
        if re.match(r"^\d+[\).\-\:]\s+", ln) or ln.startswith("- ") or ln.startswith("* "):
            if cur:
                paras.append(" ".join(cur))
            cur = [re.sub(r"^\d+[\).\-\:]\s+", "", ln)]
        else:
            cur.append(ln)
    if cur:
        paras.append(" ".join(cur))

    questions = []
    for i, p in enumerate(paras[:n]):
        # choose type by keywords
        low = p.lower()
        qtype = "voice"
        if any(k in low for k in ["implement", "write code", "function", "solve", "algorithm", "return"]):
            qtype = "code"
        elif any(k in low for k in ["explain", "describe", "walk me through", "how would you"]):
            qtype = "voice"
        title = (p[:60] + "...") if len(p) > 60 else p
        qid = f"f{i+1}"
        questions.append({
            "id": qid,
            "type": qtype,
            "title": title,
            "question_text": p,
            "time_limit_seconds": 600 if qtype == "code" else 120,
            "tags": []
        })
    return {"questions": questions}


async def _ollama_call_ndjson(prompt: str, model: str, timeout: int = 120) -> Dict[str, Any]:
    """
    Call Ollama and handle NDJSON / chunked responses robustly.
    Returns parsed dict (often contains 'response' key) or empty dict on failure.
    """
    url = f"{OLLAMA_URL.rstrip('/')}/api/generate"
    payload = {"model": model, "prompt": prompt, "format": "json", "stream": False}
    async with httpx.AsyncClient(timeout=timeout) as client:
        r = await client.post(url, json=payload)
        r.raise_for_status()
        content_type = r.headers.get("Content-Type", "")
        raw = r.content.decode(errors="ignore")
        # If NDJSON chunked response, extract the last JSON-like line or first JSON blob
        if "ndjson" in content_type or ("{" in raw and raw.strip().startswith("{") is False):
            lines = [ln.strip() for ln in raw.splitlines() if ln.strip()]
            if not lines:
                return {}
            # Try last line -> often contains the generated response
            last = lines[-1]
            try:
                return json.loads(last)
            except Exception:
                # fallback: find any JSON blob in raw
                m = re.search(r"(\{.*\}|\[.*\])", raw, flags=re.S)
                if m:
                    try:
                        return json.loads(m.group(1))
                    except Exception:
                        log.exception("Failed to parse JSON from NDJSON response")
                        return {}
                log.warning("Could not parse NDJSON response from Ollama")
                return {}
        else:
            try:
                return r.json()
            except Exception:
                log.exception("Failed to parse JSON body from Ollama")
                return {}


async def _openai_call(prompt: str, model: str, timeout: int = 120) -> Dict[str, Any]:
    # Minimal OpenAI path (kept for completeness). If using OpenAI, ensure API key present.
    if not OPENAI_API_KEY:
        raise RuntimeError("OPENAI_API_KEY not set")

    headers = {"Authorization": f"Bearer {OPENAI_API_KEY}"}
    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": SYS_PROMPT},
            {"role": "user", "content": prompt},
        ],
        "temperature": 0.3,
        "max_tokens": 800,
    }
    async with httpx.AsyncClient(timeout=timeout) as client:
        r = await client.post("https://api.openai.com/v1/chat/completions", headers=headers, json=payload)
        r.raise_for_status()
        data = r.json()
        return {"response": data["choices"][0]["message"]["content"]}


async def _llm_json(jd: str, resume: str, n: int) -> Dict[str, Any]:
    """
    Unified LLM caller returning a dict with shape {"questions": [...]}
    Falls back to stub when provider not configured.
    """
    if AI_PROVIDER == "stub" or (AI_PROVIDER == "openai" and not OPENAI_API_KEY):
        log.info("Using stub questions (AI_PROVIDER=%s)", AI_PROVIDER)
        return _stub_make_questions(jd, resume, n)

    prompt = SYS_PROMPT + "\n\n" + USER_TPL.format(jd=jd or "", resume=resume or "", n=n)

    # OLLAMA path (handle NDJSON)
    if AI_PROVIDER == "ollama":
        try:
            body = await _ollama_call_ndjson(prompt=prompt, model=OLLAMA_MODEL)
            # Ollama frequently returns {"model":..., "created_at":..., "response": "<string or json>", ...}
            resp_field = body.get("response") if isinstance(body, dict) else None
            if isinstance(resp_field, str):
                resp_str = resp_field.strip()
                # Try direct JSON parse
                try:
                    parsed = json.loads(resp_str)
                    # if parsed looks like a raw array -> wrap
                    if isinstance(parsed, list):
                        return {"questions": parsed}
                    if isinstance(parsed, dict) and "questions" in parsed:
                        return {"questions": parsed["questions"]}
                    # unknown dict shape -> try to find 'questions' key inside
                    m = re.search(r"\"questions\"\s*:\s*(\[[\s\S]*\])", resp_str, flags=re.S)
                    if m:
                        try:
                            return json.loads("{" + m.group(0) + "}")  # best-effort
                        except Exception:
                            pass
                except Exception:
                    # Try to extract any JSON blob inside string
                    m = re.search(r"(\[.*\]|\{.*\})", resp_str, flags=re.S)
                    if m:
                        try:
                            parsed2 = json.loads(m.group(1))
                            if isinstance(parsed2, list):
                                return {"questions": parsed2}
                            if isinstance(parsed2, dict) and "questions" in parsed2:
                                return {"questions": parsed2["questions"]}
                        except Exception:
                            pass

                # Fallback: try parsing as plain text (numbered list etc.)
                fb = _parse_plain_text_questions(resp_str, n)
                if fb.get("questions"):
                    return fb

                return {"questions": []}
            elif isinstance(body, dict) and "questions" in body and isinstance(body["questions"], list):
                return {"questions": body["questions"]}
            elif isinstance(body, list):
                return {"questions": body}
            else:
                return {"questions": []}
        except Exception as e:
            log.exception("Ollama call failed: %s", e)
            return {"questions": []}

    # OpenAI path
    if AI_PROVIDER == "openai":
        try:
            body = await _openai_call(prompt=prompt, model=OPENAI_MODEL)
            raw = body.get("response")
            if isinstance(raw, str):
                raw_str = raw.strip()
                try:
                    return json.loads(raw_str)
                except Exception:
                    m = re.search(r"(\[.*\]|\{.*\})", raw_str, flags=re.S)
                    if m:
                        try:
                            return json.loads(m.group(1))
                        except Exception:
                            log.exception("OpenAI parse error")
                            return {"questions": []}
                    return {"questions": []}
            elif isinstance(raw, dict):
                return raw
            return {"questions": []}
        except Exception as e:
            log.exception("OpenAI call failed: %s", e)
            return {"questions": []}

    # Unknown provider fallback
    log.warning("Unknown AI_PROVIDER=%s — using stub", AI_PROVIDER)
    return _stub_make_questions(jd, resume, n)


# ------------------------------
# Celery Task
# ------------------------------
@app.task(name="tasks.generate_questions_ai")
def generate_questions_ai(interview_id: str, n: Optional[int] = None) -> Dict[str, Any]:
    """
    Load JD + resume_text → LLM → insert rows into interview_questions.
    interview_id: interviews.id (string/uuid)
    n: desired question count (optional)
    """
    db: Session = SessionLocal()
    try:
        # Fetch interview and role JD
        r = db.execute(text("""
            SELECT i.id, i.role_id, i.resume_id,
                   COALESCE(r.jd_text, '') AS jd_text
            FROM interviews i
            LEFT JOIN roles r ON r.id = i.role_id
            WHERE i.id = :iid
        """), {"iid": str(interview_id)}).mappings().first()
        if not r:
            log.warning("Interview %s not found", interview_id)
            return {"ok": False, "error": "interview not found"}

        if not r["resume_id"]:
            log.warning("Interview %s missing resume_id", interview_id)
            return {"ok": False, "error": "resume_id missing on interview"}

        # Pull resume text (your schema uses plain_text)
        resume_row = db.execute(text("""
            SELECT COALESCE(cr.plain_text, '') AS resume_text
            FROM candidate_resumes cr
            WHERE cr.id = :rid
        """), {"rid": r["resume_id"]}).mappings().first()
        resume_text = (resume_row or {}).get("resume_text") or ""

        # call LLM (run async code from sync context)
        qcount = int(n or NUM_QUESTIONS)
        llm_out = asyncio.run(_llm_json(r["jd_text"] or "", resume_text or "", qcount))
        qlist_raw: List[dict] = (llm_out or {}).get("questions", [])
        if not isinstance(qlist_raw, list):
            log.warning("LLM returned unexpected questions type: %s", type(qlist_raw))
            qlist_raw = []

        # NORMALIZE: only allow "voice" or "code". Map everything else -> "voice".
        cleaned_questions: List[dict] = []
        for item in qlist_raw:
            if not isinstance(item, dict):
                continue
            # normalize text
            q_text = (item.get("question_text") or item.get("question") or "").strip()
            q_type_raw = (item.get("type") or "").lower()
            # prefer explicit type hints
            if "code" in q_type_raw or "program" in q_type_raw or "algo" in q_type_raw:
                q_type = "code"
            elif "voice" in q_type_raw or "speak" in q_type_raw or "audio" in q_type_raw:
                q_type = "voice"
            else:
                # heuristics based on question text to decide code vs voice
                qt_lower = q_text.lower()
                if any(k in qt_lower for k in ["implement", "write code", "function", "solve", "return", "complexity", "algorithm", "leetcode", "merge", "sort", "stack", "queue"]):
                    q_type = "code"
                else:
                    q_type = "voice"

            # normalize time_limit
            try:
                q_tl = int(item.get("time_limit_seconds") or (600 if q_type == "code" else 120))
            except Exception:
                q_tl = 600 if q_type == "code" else 120

            cleaned_questions.append({
                "type": q_type,
                "question_text": q_text,
                "time_limit_seconds": q_tl,
                "raw": item
            })

        qlist = cleaned_questions

        # Defensive sanitize & insert
        inserted = 0
        for q in qlist:
            try:
                # compute values outside the DB block so they exist for logging/errors
                qtype = (q.get("type") or "voice").lower()
                qt = (q.get("question_text") or "").strip()
                if not qt:
                    log.debug("Skipping empty question_text from LLM output: %s", q)
                    continue
                # time limit fallback
                try:
                    tl = int(q.get("time_limit_seconds", 300 if qtype == "code" else 120))
                except Exception:
                    tl = 300 if qtype == "code" else 120

                # Insert row — use nested transaction (SAVEPOINT) so a failing row doesn't abort the whole batch
                try:
                    with db.begin_nested():
                        db.execute(text("""
                            INSERT INTO interview_questions
                              (interview_id, question_text, type, time_limit_seconds)
                            VALUES (:iid, :qt, :tp, :tl)
                        """), {"iid": str(interview_id), "qt": qt, "tp": qtype, "tl": tl})
                    inserted += 1
                except Exception:
                    # log the problematic question and continue inserting remaining ones
                    log.exception("Failed to insert question (continuing): %s", q)
                    continue
            except Exception:
                # catch any unexpected processing error for this q and continue
                log.exception("Unhandled error processing LLM question: %s", q)
                continue

        if inserted == 0:
            db.rollback()
            msg = "no questions inserted (check LLM output and DB schema/constraints)"
            log.error(msg)
            return {"ok": False, "count": 0, "provider": AI_PROVIDER, "error": msg}

        db.commit()
        return {"ok": True, "count": inserted, "provider": AI_PROVIDER}
    except Exception as e:
        db.rollback()
        log.exception("generate_questions_ai failed for interview %s: %s", interview_id, e)
        return {"ok": False, "error": str(e)}
    finally:
        db.close()
