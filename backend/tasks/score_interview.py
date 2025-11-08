# backend/tasks/score_interview.py
from __future__ import annotations
import os, json, math
from typing import Any, Dict, List
from sqlalchemy.orm import Session
from sqlalchemy import text
from db.session import SessionLocal
from celery_app import app
import httpx

COMM_W = float(os.getenv("AI_COMM_WEIGHT", "0.30"))
TECH_W = float(os.getenv("AI_TECH_WEIGHT", "0.60"))
COMP_W = float(os.getenv("AI_COMP_WEIGHT", "0.10"))

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")

SYSTEM_PROMPT = """You are an expert technical interviewer. Score answers strictly and return compact JSON."""

VOICE_USER_PROMPT = """Score the candidate's spoken answer.

Answer Transcript:
---
{transcript}
---

Return JSON with:
{{
  "communication": 0-100,
  "technical": 0-100,
  "completeness": 0-100,
  "red_flags": [strings],
  "summary": "2-3 sentences"
}}"""

CODE_USER_PROMPT = """Score the candidate's code & reasoning.

Code:
---
{code}
---

Observed Program Output (first 50 lines):
---
{stdout}
---

Hidden-test Correctness: {correctness}%

Return JSON:
{{
  "technical": 0-100,
  "completeness": 0-100,
  "summary": "1-2 sentences of constructive feedback"
}}"""

def _safe_int(x, default=0):
    try: return int(x)
    except Exception: return default

async def _llm_json(prompt: str) -> Dict[str, Any]:
    if not OPENAI_API_KEY:
        # fallback: deterministic stub (no internet / for local dev)
        return {"communication": 70, "technical": 70, "completeness": 70, "red_flags": [], "summary": "LLM stub"}
    # OpenAI-compatible JSON call
    url = "https://api.openai.com/v1/chat/completions"
    headers = {"Authorization": f"Bearer {OPENAI_API_KEY}"}
    payload = {
        "model": "gpt-4o-mini",
        "response_format": {"type": "json_object"},
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": prompt},
        ],
        "temperature": 0.2,
    }
    async with httpx.AsyncClient(timeout=60) as client:
        r = await client.post(url, headers=headers, json=payload)
        r.raise_for_status()
        txt = r.json()["choices"][0]["message"]["content"]
        try:
            return json.loads(txt)
        except Exception:
            return {"summary": txt}

def _penalty_from_flags(flags: List[str]) -> int:
    # simple example: -5 per flag up to -20
    return -min(20, 5 * len(flags or []))

def _cap(x): return max(0, min(100, int(round(x))))

@app.task(name="tasks.score_interview")
def score_interview(interview_id: str) -> Dict[str, Any]:
    db: Session = SessionLocal()
    try:
        # load questions + latest answers (FK is interview_question_id)
        rows = db.execute(text("""
            SELECT
              q.id AS qid, q.type, q.question_text,
              a.id AS aid, a.transcript, a.code_answer, a.code_output, a.test_results, a.cheat_flags
            FROM interview_questions q
            LEFT JOIN LATERAL (
              SELECT z.*
              FROM interview_answers z
              WHERE z.interview_question_id = q.id
              ORDER BY z.created_at DESC NULLS LAST, z.id DESC
              LIMIT 1
            ) a ON TRUE
            WHERE q.interview_id = :iid
            ORDER BY q.id ASC
        """), {"iid": str(interview_id)}).mappings().all()


        per_q = []
        comm_scores = []
        tech_scores = []
        comp_scores = []
        redflags_all = []

        import asyncio
        async def _score_all():
            tasks = []
            for r in rows:
                if not r["aid"]:
                    continue
                if r["type"] == "voice":
                    transcript = (r["transcript"] or "").strip()
                    if not transcript:
                        fb = {"communication": 0, "technical": 0, "completeness": 0,
                              "red_flags": ["No speech detected"], "summary": "No transcript"}
                    else:
                        fb = await _llm_json(VOICE_USER_PROMPT.format(transcript=transcript))
                    comm = _safe_int(fb.get("communication"), 0)
                    tech = _safe_int(fb.get("technical"), 0)
                    comp = _safe_int(fb.get("completeness"), 0)
                    per_q.append({"question_id": r["qid"], "type": "voice", "ai_feedback": fb})
                    comm_scores.append(comm); tech_scores.append(tech); comp_scores.append(comp)
                    redflags_all.extend(fb.get("red_flags") or [])
                    # save ai_feedback on answer
                    db.execute(text("UPDATE interview_answers SET ai_feedback = :fb WHERE id = :aid"),
                               {"fb": json.dumps(fb), "aid": r["aid"]})
                else:  # code
                    tests = r["test_results"] or {}
                    corr = _safe_int((tests or {}).get("correctness"), 0)
                    # optional LLM feedback on code:
                    code = r["code_answer"] or ""
                    stdout = (r["code_output"] or "")[:1000]
                    fb = await _llm_json(CODE_USER_PROMPT.format(code=code, stdout=stdout, correctness=corr))
                    tech = max(corr, _safe_int(fb.get("technical"), corr))  # keep at least correctness
                    comp = _safe_int(fb.get("completeness"), 50 if corr>0 else 0)
                    per_q.append({"question_id": r["qid"], "type": "code", "ai_feedback": fb, "correctness": corr})
                    tech_scores.append(tech); comp_scores.append(comp)
                    db.execute(text("UPDATE interview_answers SET ai_feedback = :fb WHERE id = :aid"),
                               {"fb": json.dumps(fb), "aid": r["aid"]})
                # merge cheat flags
                flags = r["cheat_flags"] or []
                if isinstance(flags, str):
                    try: flags = json.loads(flags)
                    except Exception: flags = []
                redflags_all.extend(flags)

            await asyncio.sleep(0)  # yield
            return True

        asyncio.run(_score_all()); db.commit()

        # aggregate (if no comm_scores, use 0)
        comm = _cap(sum(comm_scores)/len(comm_scores)) if comm_scores else 0
        tech = _cap(sum(tech_scores)/len(tech_scores)) if tech_scores else 0
        comp = _cap(sum(comp_scores)/len(comp_scores)) if comp_scores else 0
        base = COMM_W*comm + TECH_W*tech + COMP_W*comp
        penalty = _penalty_from_flags(list(dict.fromkeys(redflags_all)))
        overall = _cap(base + penalty)

        report = {
            "weights": {"communication": COMM_W, "technical": TECH_W, "completeness": COMP_W},
            "section_scores": {"communication": comm, "technical": tech, "completeness": comp},
            "penalty": penalty,
            "overall_score": overall,
            "red_flags": list(dict.fromkeys(redflags_all)),
            "per_question": per_q,
        }

        db.execute(text("UPDATE interviews SET overall_score=:o, report=:r WHERE id=:iid"),
                   {"o": int(overall), "r": json.dumps(report), "iid": str(interview_id)})
        db.commit()
        return {"ok": True, "overall": overall}
    except Exception as e:
        db.rollback()
        return {"ok": False, "error": str(e)}
    finally:
        db.close()
