# backend/tasks/score_interview.py
from __future__ import annotations
import os
import json
import logging
import re
import asyncio
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy.orm import Session
from sqlalchemy import text
from db.session import SessionLocal
from celery_app import app
import httpx
from sqlalchemy import Table, MetaData
# Celery helper to get current task id
from celery import current_task

# Optional external helpers (keep compatibility if you add them later)
try:
    from score_utils import grade_transcript_with_llm, grade_code_answer  # type: ignore
except Exception:
    grade_transcript_with_llm = None
    grade_code_answer = None

# NEW imports for S3 + settings + typing
try:
    from core.s3_client import get_s3_client
    from core.config import settings
except Exception:
    # If project layout differs, S3 upload will be skipped
    get_s3_client = None
    settings = None

log = logging.getLogger(__name__)
if not log.handlers:
    logging.basicConfig(level=logging.INFO)

# ------------------------------
# Config (read from env / .env)
# ------------------------------
AI_PROVIDER = os.getenv("AI_PROVIDER", "stub").lower()   # "stub" | "openai" | "ollama"
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4o-mini")

OLLAMA_URL = os.getenv("OLLAMA_URL", "http://127.0.0.1:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "tinyllama")

COMM_W = float(os.getenv("AI_COMM_WEIGHT", "0.30"))
TECH_W = float(os.getenv("AI_TECH_WEIGHT", "0.60"))
COMP_W = float(os.getenv("AI_COMP_WEIGHT", "0.10"))

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

# ------------------------------
# LLM callers
# (unchanged)
# ------------------------------
async def _ollama_call_ndjson(prompt: str, model: str, timeout: int = 90) -> Dict[str, Any]:
    url = f"{OLLAMA_URL.rstrip('/')}/api/generate"
    payload = {"model": model, "prompt": prompt, "format": "json", "stream": False}
    async with httpx.AsyncClient(timeout=timeout) as client:
        r = await client.post(url, json=payload)
        r.raise_for_status()
        raw = r.content.decode(errors="ignore")
        lines = [ln.strip() for ln in raw.splitlines() if ln.strip()]
        if lines:
            last = lines[-1]
            try:
                return {"raw": last, "body": json.loads(last)}
            except Exception:
                m = re.search(r"(\{[\s\S]*\}|\[[\s\S]*\])", raw, flags=re.S)
                if m:
                    blob = m.group(1)
                    try:
                        return {"raw": blob, "body": json.loads(blob)}
                    except Exception:
                        log.debug("Failed to json.loads matched blob from Ollama NDJSON")
                try:
                    return {"raw": raw, "body": r.json()}
                except Exception:
                    return {"raw": raw, "body": None}
        else:
            try:
                return {"raw": raw, "body": r.json()}
            except Exception:
                return {"raw": raw, "body": None}


async def _openai_call(prompt: str, model: str, timeout: int = 60) -> Tuple[Optional[dict], str]:
    if not OPENAI_API_KEY:
        return None, ""
    headers = {"Authorization": f"Bearer {OPENAI_API_KEY}"}
    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": prompt},
        ],
        "temperature": 0.2,
        "max_tokens": 800,
    }
    async with httpx.AsyncClient(timeout=timeout) as client:
        r = await client.post("https://api.openai.com/v1/chat/completions", headers=headers, json=payload)
        r.raise_for_status()
        raw = r.json()["choices"][0]["message"]["content"]
        try:
            parsed = json.loads(raw)
            return parsed, raw
        except Exception:
            return {"summary": raw}, raw


async def _llm_json(prompt: str) -> Tuple[Dict[str, Any], str]:
    if AI_PROVIDER == "stub":
        raw = json.dumps({"technical": 70, "communication": 70, "completeness": 70, "red_flags": [], "summary": "LLM stub"})
        return json.loads(raw), raw

    if AI_PROVIDER == "ollama":
        try:
            res = await _ollama_call_ndjson(prompt=prompt, model=OLLAMA_MODEL)
            raw_text = res.get("raw") or ""
            body = res.get("body")
            if isinstance(body, dict):
                if any(k in body for k in ("technical", "communication", "completeness")):
                    return body, raw_text
                resp = body.get("response") or body.get("text") or None
                if isinstance(resp, str):
                    try:
                        parsed = json.loads(resp)
                        if isinstance(parsed, dict):
                            return parsed, resp
                    except Exception:
                        m = re.search(r"(\{[\s\S]*\}|\[[\s\S]*\])", resp, flags=re.S)
                        if m:
                            try:
                                parsed2 = json.loads(m.group(1))
                                if isinstance(parsed2, dict):
                                    return parsed2, resp
                            except Exception:
                                pass
                return body, raw_text
            elif isinstance(body, str):
                try:
                    parsed = json.loads(body)
                    return parsed, body
                except Exception:
                    m = re.search(r"(\{[\s\S]*\}|\[[\s\S]*\])", body, flags=re.S)
                    if m:
                        try:
                            parsed2 = json.loads(m.group(1))
                            return parsed2, body
                        except Exception:
                            pass
                    return {"summary": body}, body
            else:
                return {"summary": raw_text}, raw_text
        except Exception as e:
            log.exception("Ollama call failed: %s", e)
            return {"summary": f"ollama_error: {str(e)}", "technical": 0, "communication": 0, "completeness": 0, "red_flags": []}, str(e)

    if AI_PROVIDER == "openai":
        parsed, raw = await _openai_call(prompt=prompt, model=OPENAI_MODEL)
        if parsed is None:
            return {"summary": "openai_missing_key", "technical": 0, "communication": 0, "completeness": 0, "red_flags": []}, raw
        return parsed, raw

    log.warning("Unknown AI_PROVIDER=%s — using stub", AI_PROVIDER)
    raw = json.dumps({"technical": 70, "communication": 70, "completeness": 70, "red_flags": [], "summary": "LLM stub"})
    return json.loads(raw), raw


# ------------------------------
# Utility helpers
# ------------------------------
def _safe_int(x, default=0):
    try:
        return int(x)
    except Exception:
        return default


def _penalty_from_flags(flags: List[str]) -> int:
    return -min(20, 5 * len(flags or []))


def _cap(x):
    return max(0, min(100, int(round(x))))


def _aggregate_from_interview_scores(db: Session, interview_id: str) -> Dict[str, Any]:
    row = db.execute(text("""
        SELECT
          AVG(technical_score) AS tech_avg,
          AVG(communication_score) AS comm_avg,
          AVG(completeness_score) AS comp_avg,
          JSONB_AGG(
            JSONB_BUILD_OBJECT(
              'question_id', question_id,
              'technical', technical_score,
              'communication', communication_score,
              'completeness', completeness_score,
              'overall', overall_score,
              'ai_feedback', ai_feedback
            )
            ORDER BY id
          ) FILTER (WHERE id IS NOT NULL) AS perq
        FROM interview_scores
        WHERE interview_id = :iid
    """), {"iid": str(interview_id)}).mappings().first()

    tech_avg = float(row["tech_avg"] or 0)
    comm_avg = float(row["comm_avg"] or 0)
    comp_avg = float(row["comp_avg"] or 0)
    perq = row["perq"] or []

    overall = round((tech_avg * TECH_W) + (comm_avg * COMM_W) + (comp_avg * COMP_W), 2)

    report = {
        "weights": {"technical": TECH_W, "completeness": COMP_W, "communication": COMM_W},
        "section_scores": {"technical": tech_avg, "completeness": comp_avg, "communication": comm_avg},
        "per_question": perq,
        "overall_score": overall,
        "penalty": 0
    }
    return report


# ------------------------------
# Helper: record audit 
# ------------------------------
def _record_audit(db: Session, interview_id: str, overall_score: float, section_scores: dict,
                  per_question_summary: list, model_meta: dict, prompt_hash: Optional[str],
                  prompt_text: Optional[str], weights: dict, triggered_by: str, task_id: Optional[str],
                  llm_raw_full: Optional[dict], notes: Optional[str] = None) -> Optional[int]:
    """
    Record an audit row using SQLAlchemy Core table reflection + insert().
    Commits the session after inserting so other connections can see the row.
    Returns inserted audit id or None. Non-fatal on errors (logs and returns None).
    """
    llm_raw_s3_key = None

    # 1) S3 upload (best-effort)
    try:
        if llm_raw_full is not None and get_s3_client and settings:
            try:
                s3 = get_s3_client()
                bucket = getattr(settings, "S3_BUCKET", None) or getattr(settings, "s3_bucket", None)
                if s3 and bucket:
                    safe_task_id = (task_id or "task").replace("/", "_")
                    key = f"llm_raw/{interview_id}/{safe_task_id}.json"
                    s3.put_object(Bucket=bucket, Key=key, Body=json.dumps(llm_raw_full).encode("utf-8"), ContentType="application/json")
                    llm_raw_s3_key = key
            except Exception as e:
                log.exception("llm_raw S3 upload failed: %s", e)
                notes = (notes or "") + f" | llm_raw upload failed: {e}"
    except Exception:
        pass

    # 2) Insert via reflection
    try:
        meta = MetaData()
        audit_table = Table("interview_score_audit", meta, autoload_with=db.bind)
        ins = audit_table.insert().returning(audit_table.c.id)
        payload = {
            "interview_id": str(interview_id),
            "overall_score": float(overall_score) if overall_score is not None else None,
            "section_scores": section_scores or {},
            "per_question": per_question_summary or [],
            "model_meta": model_meta or {},
            "prompt_hash": prompt_hash,
            "prompt_text": prompt_text,
            "weights": weights or {},
            "triggered_by": triggered_by,
            "task_id": task_id,
            "llm_raw_s3_key": llm_raw_s3_key,
            "notes": notes,
        }
        res = db.execute(ins, payload)
        row = res.fetchone()
        # commit so other sessions can see the row
        try:
            db.commit()
        except Exception as e:
            log.exception("Failed to commit audit insert: %s", e)
        if row:
            try:
                return int(row[0])
            except Exception:
                return None
    except Exception as e:
        log.exception("Failed to insert interview_score_audit (reflection path): %s", e)
        try:
            db.rollback()
        except Exception:
            pass
        return None

    return None

# ------------------------------
# Celery Task (modified signature to accept triggered_by)
# ------------------------------
@app.task(name="tasks.score_interview")
def score_interview(interview_id: str, triggered_by: str = "system") -> Dict[str, Any]:
    db: Session = SessionLocal()
    try:
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
        comm_scores: List[int] = []
        tech_scores: List[int] = []
        comp_scores: List[int] = []
        redflags_all: List[str] = []

        # collect full raw outputs per question for S3 bundle
        llm_raw_full_questions: List[dict] = []

        async def _score_all():
            for r in rows:
                if not r["aid"]:
                    log.info("No answer for question %s — skipping", r["qid"])
                    continue

                raw_resp = ""  # initialize per-question raw text

                if r["type"] == "voice":
                    transcript = (r["transcript"] or "").strip()
                    if not transcript:
                        fb = {"communication": 0, "technical": 0, "completeness": 0,
                              "red_flags": ["No speech detected"], "summary": "No transcript"}
                        raw_resp = ""
                    else:
                        fb, raw_resp = await _llm_json(VOICE_USER_PROMPT.format(transcript=transcript))

                    comm = _safe_int(fb.get("communication"), 0)
                    tech = _safe_int(fb.get("technical"), 0)
                    comp = _safe_int(fb.get("completeness"), 0)

                    # include a preview of raw in per-question summary
                    preview = None
                    try:
                        preview = (raw_resp[:500] + "...") if raw_resp else None
                    except Exception:
                        preview = None

                    per_q.append({"question_id": r["qid"], "type": "voice", "ai_feedback": fb, "llm_raw_preview": preview})
                    comm_scores.append(comm); tech_scores.append(tech); comp_scores.append(comp)
                    redflags_all.extend(fb.get("red_flags") or [])

                    # update answer with ai_feedback + llm_raw
                    try:
                        db.execute(text("""
                            UPDATE interview_answers
                            SET ai_feedback = :fb, llm_raw = :raw
                            WHERE id = :aid
                        """), {
                            "fb": json.dumps(fb),
                            "raw": raw_resp,
                            "aid": r["aid"]
                        })
                    except Exception:
                        log.exception("Failed to update interview_answers for aid=%s", r["aid"])

                    # UPSERT into interview_scores
                    try:
                        technical = _safe_int(tech, 0)
                        communication = _safe_int(comm, 0)
                        completeness = _safe_int(comp, 0)
                        perq_overall = round(COMM_W * communication + TECH_W * technical + COMP_W * completeness, 2)

                        db.execute(text("""
                            INSERT INTO interview_scores
                              (interview_id, question_id, technical_score, communication_score,
                               completeness_score, overall_score, ai_feedback, llm_raw, created_at)
                            VALUES (:iid, :qid, :tech, :comm, :comp, :overall, CAST(:fb AS jsonb), :raw, now())
                            ON CONFLICT (interview_id, question_id) DO UPDATE
                            SET technical_score = EXCLUDED.technical_score,
                                communication_score = EXCLUDED.communication_score,
                                completeness_score = EXCLUDED.completeness_score,
                                overall_score = EXCLUDED.overall_score,
                                ai_feedback = EXCLUDED.ai_feedback,
                                llm_raw = EXCLUDED.llm_raw,
                                created_at = now()
                        """), {
                            "iid": str(interview_id),
                            "qid": r["qid"],
                            "tech": int(technical),
                            "comm": int(communication),
                            "comp": int(completeness),
                            "overall": float(perq_overall),
                            "fb": json.dumps(fb),
                            "raw": raw_resp,
                        })
                    except Exception:
                        log.exception("Failed to upsert interview_scores for question %s", r["qid"])

                else:  # code
                    tests = r["test_results"] or {}
                    corr = _safe_int((tests or {}).get("correctness"), 0)
                    code = r["code_answer"] or ""
                    stdout = (r["code_output"] or "")[:1000]

                    fb, raw_resp = await _llm_json(CODE_USER_PROMPT.format(code=code, stdout=stdout, correctness=corr))

                    tech = max(corr, _safe_int(fb.get("technical"), corr))
                    comp = _safe_int(fb.get("completeness"), 50 if corr > 0 else 0)

                    preview = None
                    try:
                        preview = (raw_resp[:500] + "...") if raw_resp else None
                    except Exception:
                        preview = None

                    per_q.append({"question_id": r["qid"], "type": "code", "ai_feedback": fb, "correctness": corr, "llm_raw_preview": preview})
                    tech_scores.append(tech); comp_scores.append(comp)
                    redflags_all.extend(fb.get("red_flags") or [])

                    # update answer with ai_feedback + llm_raw
                    try:
                        db.execute(text("""
                            UPDATE interview_answers
                            SET ai_feedback = :fb, llm_raw = :raw
                            WHERE id = :aid
                        """), {
                            "fb": json.dumps(fb),
                            "raw": raw_resp,
                            "aid": r["aid"]
                        })
                    except Exception:
                        log.exception("Failed to update interview_answers (code) for aid=%s", r["aid"])

                    # UPSERT into interview_scores for code (communication = 0)
                    try:
                        technical = _safe_int(tech, 0)
                        communication = 0
                        completeness = _safe_int(comp, 0)
                        perq_overall = round(TECH_W * technical + COMP_W * completeness + COMM_W * communication, 2)

                        db.execute(text("""
                            INSERT INTO interview_scores
                              (interview_id, question_id, technical_score, communication_score,
                               completeness_score, overall_score, ai_feedback, llm_raw, created_at)
                            VALUES (:iid, :qid, :tech, :comm, :comp, :overall, CAST(:fb AS jsonb), :raw, now())
                            ON CONFLICT (interview_id, question_id) DO UPDATE
                            SET technical_score = EXCLUDED.technical_score,
                                communication_score = EXCLUDED.communication_score,
                                completeness_score = EXCLUDED.completeness_score,
                                overall_score = EXCLUDED.overall_score,
                                ai_feedback = EXCLUDED.ai_feedback,
                                llm_raw = EXCLUDED.llm_raw,
                                created_at = now()
                        """), {
                            "iid": str(interview_id),
                            "qid": r["qid"],
                            "tech": int(technical),
                            "comm": int(communication),
                            "comp": int(completeness),
                            "overall": float(perq_overall),
                            "fb": json.dumps(fb),
                            "raw": raw_resp,
                        })
                    except Exception:
                        log.exception("Failed to upsert interview_scores for code question %s", r["qid"])

                # merge cheat flags (common)
                flags = r["cheat_flags"] or []
                if isinstance(flags, str):
                    try:
                        flags = json.loads(flags)
                    except Exception:
                        flags = []
                redflags_all.extend(flags)

                # collect full llm_raw per question for S3 bundle (keep raw_resp and ai_feedback)
                try:
                    llm_raw_full_questions.append({
                        "question_id": r["qid"],
                        "type": r["type"],
                        "ai_feedback": per_q[-1].get("ai_feedback") if per_q else None,
                        "llm_raw": raw_resp
                    })
                except Exception:
                    # defensive: don't let this block scoring
                    log.debug("Failed to append llm_raw_full for q %s", r["qid"])

            await asyncio.sleep(0)
            return True

        # run scoring
        asyncio.run(_score_all())
        db.commit()

        # compute aggregated fallback values
        comm = _cap(sum(comm_scores)/len(comm_scores)) if comm_scores else 0
        tech = _cap(sum(tech_scores)/len(tech_scores)) if tech_scores else 0
        comp = _cap(sum(comp_scores)/len(comp_scores)) if comp_scores else 0
        base = COMM_W * comm + TECH_W * tech + COMP_W * comp
        penalty = _penalty_from_flags(list(dict.fromkeys(redflags_all)))
        overall = _cap(base + penalty)

        # Build llm_raw_full bundle for S3 (includes metadata + per-question raw)
        try:
            # Try to fetch prompt_hash/prompt_text if your scoring uses templates.
            prompt_hash = None
            prompt_text = None
            model_meta = {"provider": AI_PROVIDER, "model": (OLLAMA_MODEL if AI_PROVIDER == "ollama" else OPENAI_MODEL if AI_PROVIDER == "openai" else "stub")}
            weights = {"technical": TECH_W, "communication": COMM_W, "completeness": COMP_W}
            task_id = None
            try:
                task_id = getattr(current_task.request, "id", None) or None
            except Exception:
                task_id = None

            llm_raw_bundle = {
                "interview_id": interview_id,
                "task_id": task_id,
                "model_meta": model_meta,
                "prompt_hash": prompt_hash,
                "prompt_text": prompt_text,
                "weights": weights,
                "questions": llm_raw_full_questions
            }
        except Exception:
            llm_raw_bundle = None

        # Recompute report from interview_scores (preferred single source of truth)
        try:
            report = _aggregate_from_interview_scores(db, interview_id)
            db.execute(text("UPDATE interviews SET overall_score = :o, report = CAST(:r AS jsonb) WHERE id = :iid"),
                       {"o": report["overall_score"], "r": json.dumps(report), "iid": str(interview_id)})
            db.commit()

            # RECORD AUDIT (best-effort, won't break scoring)
            try:
                audit_id = _record_audit(
                    db=db,
                    interview_id=str(interview_id),
                    overall_score=report.get("overall_score"),
                    section_scores=report.get("section_scores"),
                    per_question_summary=report.get("per_question"),
                    model_meta=model_meta,
                    prompt_hash=prompt_hash,
                    prompt_text=prompt_text,
                    weights=weights,
                    triggered_by=triggered_by,
                    task_id=task_id,
                    llm_raw_full=llm_raw_bundle,
                    notes="scoring completed (aggregate)"
                )
                if audit_id:
                    log.info("Recorded interview_score_audit id=%s for interview=%s", audit_id, interview_id)
            except Exception:
                log.exception("Failed to record audit after aggregate report")

            return {"ok": True, "overall": report["overall_score"]}
        except Exception:
            log.exception("Failed to aggregate from interview_scores; falling back to computed values")
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

            # RECORD AUDIT for fallback path (best-effort)
            try:
                task_id = getattr(current_task.request, "id", None) if not task_id else task_id
                audit_id = _record_audit(
                    db=db,
                    interview_id=str(interview_id),
                    overall_score=overall,
                    section_scores=report.get("section_scores"),
                    per_question_summary=report.get("per_question"),
                    model_meta={"provider": AI_PROVIDER},
                    prompt_hash=None,
                    prompt_text=None,
                    weights={"technical": TECH_W, "communication": COMM_W, "completeness": COMP_W},
                    triggered_by=triggered_by,
                    task_id=task_id,
                    llm_raw_full=llm_raw_bundle,
                    notes="scoring completed (fallback)"
                )
                if audit_id:
                    log.info("Recorded interview_score_audit id=%s for interview=%s (fallback)", audit_id, interview_id)
            except Exception:
                log.exception("Failed to record audit in fallback path")

            return {"ok": True, "overall": overall}

    except Exception as e:
        db.rollback()
        log.exception("score_interview failed for %s: %s", interview_id, e)
        return {"ok": False, "error": str(e)}
    finally:
        db.close()
