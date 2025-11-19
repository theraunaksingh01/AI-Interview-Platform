# backend/tasks/score_interview.py
from __future__ import annotations
import os, json, math
from typing import Any, Dict, List
from sqlalchemy.orm import Session
from sqlalchemy import text
from db.session import SessionLocal
from celery_app import app
import httpx
from score_utils import grade_transcript_with_llm, grade_code_answer


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

async def _llm_json(prompt: str):
    """
    Return (parsed_json, raw_text)
    """
    # Stub fallback
    if not OPENAI_API_KEY:
        raw = '{"technical":70,"communication":70,"completeness":70,"red_flags":[],"summary":"LLM stub"}'
        return json.loads(raw), raw

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

        raw = r.json()["choices"][0]["message"]["content"]
        try:
            parsed = json.loads(raw)
        except Exception:
            parsed = {"summary": raw}

        return parsed, raw


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
                        fb, raw_resp = await _llm_json(VOICE_USER_PROMPT.format(transcript=transcript))

                    comm = _safe_int(fb.get("communication"), 0)
                    tech = _safe_int(fb.get("technical"), 0)
                    comp = _safe_int(fb.get("completeness"), 0)
                    per_q.append({"question_id": r["qid"], "type": "voice", "ai_feedback": fb})
                    comm_scores.append(comm); tech_scores.append(tech); comp_scores.append(comp)
                    redflags_all.extend(fb.get("red_flags") or [])
                    # save ai_feedback on answer
                    db.execute(text("""
                        UPDATE interview_answers
                        SET ai_feedback = :fb, llm_raw = :raw
                        WHERE id = :aid
                    """), {
                        "fb": json.dumps(fb),
                        "raw": raw_resp,
                        "aid": r["aid"]
                    })

                    # persist per-question score into interview_scores
                    try:
                        # compute per-question numeric fields in a consistent way
                        if r["type"] == "voice":
                            technical = _safe_int(tech, 0)
                            communication = _safe_int(comm, 0)
                            completeness = _safe_int(comp, 0)
                            perq_overall = int(round(COMM_W * communication + TECH_W * technical + COMP_W * completeness))
                        else:
                            # code question: technical = tech, communication unknown -> 0, completeness = comp
                            technical = _safe_int(tech, 0)
                            communication = 0
                            completeness = _safe_int(comp, 0)
                            perq_overall = int(round(TECH_W * technical + COMP_W * completeness + COMM_W * communication))

                        db.execute(text("""
                            INSERT INTO interview_scores
                              (interview_id, question_id, technical_score, communication_score,
                               completeness_score, overall_score, ai_feedback, llm_raw)
                            VALUES (:iid, :qid, :tech, :comm, :comp, :overall, CAST(:fb AS jsonb), :raw)
                        """), {
                            "iid": str(interview_id),
                            "qid": r["qid"],
                            "tech": technical,
                            "comm": communication,
                            "comp": completeness,
                            "overall": perq_overall,
                            "fb": json.dumps(fb),
                            "raw": raw_resp,
                        })

                    except Exception:
                        math.log.exception("Failed to insert into interview_scores for question %s", r["qid"])

                else:  # code
                    tests = r["test_results"] or {}
                    corr = _safe_int((tests or {}).get("correctness"), 0)
                    # optional LLM feedback on code:
                    code = r["code_answer"] or ""
                    stdout = (r["code_output"] or "")[:1000]
                    fb, raw_resp = await _llm_json(CODE_USER_PROMPT.format(code=code, stdout=stdout, correctness=corr))

                    tech = max(corr, _safe_int(fb.get("technical"), corr))  # keep at least correctness
                    comp = _safe_int(fb.get("completeness"), 50 if corr>0 else 0)
                    per_q.append({"question_id": r["qid"], "type": "code", "ai_feedback": fb, "correctness": corr})
                    tech_scores.append(tech); comp_scores.append(comp)
                    db.execute(text("""
                        UPDATE interview_answers
                        SET ai_feedback = :fb, llm_raw = :raw
                        WHERE id = :aid
                    """), {
                        "fb": json.dumps(fb),
                        "raw": raw_resp,
                        "aid": r["aid"]
                    })
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
