# backend/tasks/score_interview.py
from __future__ import annotations
import os
import json
import logging
import re
import asyncio
from typing import Any, Dict, List, Optional, Tuple
from collections import defaultdict

from sqlalchemy.orm import Session
from sqlalchemy import text
from db.session import SessionLocal
from celery_app import app
import httpx
from sqlalchemy import Table, MetaData
# Celery helper to get current task id
from celery import current_task
import platform
from datetime import datetime

from services.llm_provider import gemini_chat
from services.followup_generator import update_role_calibration

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
AI_PROVIDER = os.getenv("AI_PROVIDER", "stub").lower()   # "stub" | "openai" | "ollama" | "gemini"
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.0-flash")

OLLAMA_URL = os.getenv("OLLAMA_URL", "http://127.0.0.1:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "tinyllama")

COMM_W = float(os.getenv("AI_COMM_WEIGHT", "0.30"))
TECH_W = float(os.getenv("AI_TECH_WEIGHT", "0.60"))
COMP_W = float(os.getenv("AI_COMP_WEIGHT", "0.10"))

SYSTEM_PROMPT = (
    "You are an expert technical interviewer evaluating a candidate's response. "
    "Score strictly using the rubric provided. Consider the job role and question context. "
    "Return ONLY valid JSON matching the exact schema requested. No markdown, no backticks."
)

VOICE_USER_PROMPT = """Evaluate this candidate's spoken answer to an interview question.

Job Role: {role_title} ({role_level})
Job Description Context: {jd_excerpt}

Question Asked:
---
{question_text}
---

Candidate's Answer Transcript:
---
{transcript}
---

Score each rubric dimension from 0 to 100:
1. Technical Accuracy: correctness of technical concepts, facts, and terminology
2. Problem Solving: structured thinking, approach to breaking down the problem
3. Communication Clarity: articulation, organization, conciseness of explanation
4. Depth of Knowledge: beyond-surface understanding, real-world experience shown
5. Relevance: how directly the answer addresses the specific question asked

Also provide:
- strengths: list of 2-4 specific things the candidate did well
- weaknesses: list of 1-3 specific areas for improvement
- summary: 2-3 sentence overall assessment
- hiring_signal: one of "strong_hire", "hire", "maybe", "no_hire"

Return JSON:
{{
  "technical_accuracy": <0-100>,
  "problem_solving": <0-100>,
  "communication_clarity": <0-100>,
  "depth_of_knowledge": <0-100>,
  "relevance": <0-100>,
  "strengths": ["string", ...],
  "weaknesses": ["string", ...],
  "summary": "string",
  "hiring_signal": "strong_hire|hire|maybe|no_hire",
  "red_flags": ["string", ...]
}}"""

CODE_USER_PROMPT = """Evaluate this candidate's code submission.

Job Role: {role_title} ({role_level})

Question Asked:
---
{question_text}
---

Code Submitted:
---
{code}
---

Program Output (first 50 lines):
---
{stdout}
---

Hidden-test Correctness: {correctness}%

Score each rubric dimension from 0 to 100:
1. Technical Accuracy: correct logic, proper data structures, algorithm choice
2. Problem Solving: approach, edge case handling, optimization awareness
3. Code Quality: readability, naming, structure, idioms
4. Completeness: covers all requirements, handles edge cases
5. Relevance: solves the actual problem stated

Return JSON:
{{
  "technical_accuracy": <0-100>,
  "problem_solving": <0-100>,
  "code_quality": <0-100>,
  "completeness": <0-100>,
  "relevance": <0-100>,
  "strengths": ["string", ...],
  "weaknesses": ["string", ...],
  "summary": "string",
  "hiring_signal": "strong_hire|hire|maybe|no_hire",
  "red_flags": ["string", ...]
}}"""

# Rubric dimensions and weights for overall score
VOICE_RUBRIC_KEYS = [
    "technical_accuracy", "problem_solving", "communication_clarity",
    "depth_of_knowledge", "relevance",
]
CODE_RUBRIC_KEYS = [
    "technical_accuracy", "problem_solving", "code_quality",
    "completeness", "relevance",
]
RUBRIC_WEIGHTS = {
    "technical_accuracy": 0.25,
    "problem_solving": 0.25,
    "communication_clarity": 0.15,
    "depth_of_knowledge": 0.20,
    "relevance": 0.15,
    "code_quality": 0.15,
    "completeness": 0.20,
}

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
        raw = json.dumps({
            "technical_accuracy": 70, "problem_solving": 65,
            "communication_clarity": 72, "depth_of_knowledge": 60,
            "relevance": 75, "code_quality": 68, "completeness": 70,
            "strengths": ["Clear structure", "Good examples"],
            "weaknesses": ["Could go deeper on edge cases"],
            "summary": "Solid answer with room for improvement in depth.",
            "hiring_signal": "hire",
            "red_flags": [],
        })
        return json.loads(raw), raw

    if AI_PROVIDER == "ollama":
        try:
            res = await _ollama_call_ndjson(prompt=prompt, model=OLLAMA_MODEL)
            raw_text = res.get("raw") or ""
            body = res.get("body")
            if isinstance(body, dict):
                if any(k in body for k in ("technical_accuracy", "problem_solving", "technical", "communication", "completeness")):
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

    if AI_PROVIDER == "gemini":
        try:
            result = await gemini_chat(
                system_prompt=SYSTEM_PROMPT,
                user_prompt=prompt,
                api_key=GEMINI_API_KEY,
                model=GEMINI_MODEL,
                max_output_tokens=1024,
            )
            raw_text = result.get("raw") or ""
            parsed = result.get("parsed")
            if isinstance(parsed, dict):
                return parsed, raw_text
            return {"summary": raw_text}, raw_text
        except Exception as e:
            log.exception("Gemini call failed: %s", e)
            return {"summary": f"gemini_error: {str(e)}", "technical": 0, "communication": 0, "completeness": 0, "red_flags": []}, str(e)

    log.warning("Unknown AI_PROVIDER=%s — using stub", AI_PROVIDER)
    raw = json.dumps({
        "technical_accuracy": 70, "problem_solving": 65,
        "communication_clarity": 72, "depth_of_knowledge": 60,
        "relevance": 75, "code_quality": 68, "completeness": 70,
        "strengths": ["Clear structure"], "weaknesses": ["Needs more depth"],
        "summary": "LLM stub", "hiring_signal": "hire", "red_flags": [],
    })
    return json.loads(raw), raw


def _normalize_to_rubric(fb: dict) -> dict:
    """
    Normalize LLM responses that use old 3-dimension keys (technical, communication,
    completeness) into the Phase 8 rubric format (technical_accuracy, problem_solving, etc.).
    Also filters out placeholder values and ensures legacy keys exist for backward compat.
    """
    rubric_keys = {"technical_accuracy", "problem_solving", "communication_clarity",
                   "depth_of_knowledge", "relevance", "code_quality", "completeness"}
    has_rubric = any(k in fb for k in rubric_keys)

    if not has_rubric:
        # Map old keys → rubric keys
        tech = _safe_int(fb.get("technical"), 0)
        comm = _safe_int(fb.get("communication"), 0)
        comp = _safe_int(fb.get("completeness"), 0)

        fb["technical_accuracy"] = tech
        fb["problem_solving"] = max(tech - 5, 0)
        fb["communication_clarity"] = comm
        fb["depth_of_knowledge"] = max(tech - 10, 0)
        fb["relevance"] = comp
        fb["code_quality"] = comm

    # Ensure legacy keys exist (review page reads these)
    if "technical" not in fb:
        ta = _safe_int(fb.get("technical_accuracy"), 0)
        ps = _safe_int(fb.get("problem_solving"), 0)
        fb["technical"] = round((ta + ps) / 2) if (ta or ps) else 0
    if "communication" not in fb:
        fb["communication"] = _safe_int(fb.get("communication_clarity"), 0)
    if "completeness" not in fb and "relevance" in fb:
        dk = _safe_int(fb.get("depth_of_knowledge"), 0)
        rel = _safe_int(fb.get("relevance"), 0)
        fb.setdefault("completeness", round((dk + rel) / 2) if (dk or rel) else 0)

    fb.setdefault("strengths", [])
    fb.setdefault("weaknesses", [])
    fb.setdefault("red_flags", [])
    # Filter out LLM placeholder values like "string", "string string", empty, etc.
    for list_key in ("strengths", "weaknesses", "red_flags"):
        if isinstance(fb.get(list_key), list):
            fb[list_key] = [s for s in fb[list_key]
                           if isinstance(s, str) and s.strip()
                           and s.strip().lower() not in ("string", "string string", "placeholder")]
    if not isinstance(fb.get("summary"), str):
        fb["summary"] = str(fb.get("summary", ""))
    # Clean hiring_signal placeholder patterns
    hs = fb.get("hiring_signal", "maybe")
    if isinstance(hs, str) and "|" in hs:
        hs = "maybe"
    fb["hiring_signal"] = hs if isinstance(hs, str) and hs in ("strong_hire", "hire", "maybe", "no_hire") else "maybe"
    return fb


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


def _rubric_overall(fb: dict, rubric_keys: List[str]) -> float:
    """Compute weighted overall from rubric scores in ai_feedback."""
    total = 0.0
    weight_sum = 0.0
    for k in rubric_keys:
        val = _safe_int(fb.get(k), -1)
        if val < 0:
            continue
        w = RUBRIC_WEIGHTS.get(k, 0.20)
        total += val * w
        weight_sum += w
    return round(total / weight_sum, 2) if weight_sum else 0.0


def _map_rubric_to_legacy(fb: dict, qtype: str) -> Tuple[int, int, int]:
    """Map 5-dimension rubric → legacy 3 columns (technical, communication, completeness)."""
    ta = _safe_int(fb.get("technical_accuracy"), 0)
    ps = _safe_int(fb.get("problem_solving"), 0)
    cc = _safe_int(fb.get("communication_clarity"), 0)
    dk = _safe_int(fb.get("depth_of_knowledge"), 0)
    rel = _safe_int(fb.get("relevance"), 0)
    cq = _safe_int(fb.get("code_quality"), 0)
    comp = _safe_int(fb.get("completeness"), 0)

    tech = round((ta + ps) / 2) if (ta or ps) else 0
    if qtype == "code":
        communication = cq
        completeness = round((comp + rel) / 2) if (comp or rel) else 0
    else:
        communication = cc
        completeness = round((dk + rel) / 2) if (dk or rel) else 0
    return tech, communication, completeness


def _compute_hiring_recommendation(overall: float, rubric_avgs: dict) -> str:
    """Compute hiring recommendation from overall score and rubric averages."""
    min_rubric = min(rubric_avgs.values()) if rubric_avgs else 0
    if overall >= 80 and min_rubric >= 60:
        return "strong_hire"
    elif overall >= 65 and min_rubric >= 40:
        return "hire"
    elif overall >= 45:
        return "maybe"
    else:
        return "no_hire"


def _fetch_role_context(db: Session, interview_id: str) -> Tuple[str, str, str]:
    """Fetch role title, level, and JD excerpt for the interview."""
    role_row = db.execute(text("""
        SELECT r.title AS role_title, r.level AS role_level, r.jd_text
        FROM interviews i
        LEFT JOIN roles r ON r.id = i.role_id
        WHERE i.id = :iid
    """), {"iid": str(interview_id)}).mappings().first()
    if not role_row:
        return "Software Engineer", "Mid-level", ""
    return (
        (role_row["role_title"] or "Software Engineer"),
        (role_row["role_level"] or "Mid-level"),
        ((role_row["jd_text"] or "")[:500]),
    )


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

    # Compute rubric breakdown from per-question ai_feedback
    rubric_totals: Dict[str, List[float]] = defaultdict(list)
    all_strengths: List[str] = []
    all_weaknesses: List[str] = []

    for q in perq:
        fb = q.get("ai_feedback") or {}
        if isinstance(fb, str):
            try:
                fb = json.loads(fb)
            except Exception:
                fb = {}
        for key in ["technical_accuracy", "problem_solving", "communication_clarity",
                     "depth_of_knowledge", "relevance", "code_quality", "completeness"]:
            val = fb.get(key)
            if isinstance(val, (int, float)):
                rubric_totals[key].append(val)
        all_strengths.extend(s for s in (fb.get("strengths") or [])
                             if isinstance(s, str) and s.strip()
                             and s.strip().lower() not in ("string", "string string", "placeholder"))
        all_weaknesses.extend(w for w in (fb.get("weaknesses") or [])
                              if isinstance(w, str) and w.strip()
                              and w.strip().lower() not in ("string", "string string", "placeholder"))

    rubric_averages = {
        k: round(sum(v) / len(v), 1) if v else 0
        for k, v in rubric_totals.items()
    }

    hiring_recommendation = _compute_hiring_recommendation(overall, rubric_averages)

    # Deduplicate strengths/weaknesses
    seen_s: set = set()
    unique_strengths = []
    for s in all_strengths:
        if s not in seen_s:
            seen_s.add(s)
            unique_strengths.append(s)
    seen_w: set = set()
    unique_weaknesses = []
    for w in all_weaknesses:
        if w not in seen_w:
            seen_w.add(w)
            unique_weaknesses.append(w)

    report = {
        "weights": {"technical": TECH_W, "completeness": COMP_W, "communication": COMM_W},
        "section_scores": {"technical": tech_avg, "completeness": comp_avg, "communication": comm_avg},
        "per_question": perq,
        "overall_score": overall,
        "penalty": 0,
        # Phase 8 additions
        "rubric_scores": rubric_averages,
        "hiring_recommendation": hiring_recommendation,
        "strengths": unique_strengths[:10],
        "weaknesses": unique_weaknesses[:10],
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
# Celery Task: score a single question (new)
# ------------------------------
@app.task(name="tasks.score_question")
def score_question(interview_question_id: int, triggered_by: str = "system") -> Dict[str, Any]:
    """
    Score a single question (interview_questions.id). This will:
      - find the latest answer for that question
      - call the LLM scorer for that single answer (voice or code)
      - update interview_answers.ai_feedback and llm_raw
      - upsert interview_scores for that question
      - recompute aggregate report for the interview and store into interviews.report
      - attempt to record an audit row (best-effort)
    Returns {"ok": True, "overall": new_overall} on success or {"ok": False, "error": ...}
    """
    db: Session = SessionLocal()
    try:
        row = db.execute(text("""
            SELECT q.id AS qid, q.interview_id, q.type, q.question_text,
                   a.id AS aid, a.transcript, a.code_answer, a.code_output, a.test_results, a.cheat_flags
            FROM interview_questions q
            LEFT JOIN LATERAL (
              SELECT z.*
              FROM interview_answers z
              WHERE z.interview_question_id = q.id
              ORDER BY z.created_at DESC NULLS LAST, z.id DESC
              LIMIT 1
            ) a ON TRUE
            WHERE q.id = :qid
            LIMIT 1
        """), {"qid": int(interview_question_id)}).mappings().first()

        if not row:
            return {"ok": False, "error": "question_not_found"}

        if not row["aid"]:
            return {"ok": False, "error": "no_answer_for_question"}

        interview_id = str(row["interview_id"])
        raw_resp = ""
        per_q_summary = None
        redflags = []

        role_title, role_level, jd_excerpt = _fetch_role_context(db, interview_id)
        question_text = (row["question_text"] or "").strip()

        async def _call_and_process():
            nonlocal raw_resp, per_q_summary, redflags
            if row["type"] == "voice":
                transcript = (row["transcript"] or "").strip()
                if not transcript:
                    fb = {"technical_accuracy": 0, "problem_solving": 0,
                          "communication_clarity": 0, "depth_of_knowledge": 0, "relevance": 0,
                          "strengths": [], "weaknesses": ["No speech detected"],
                          "summary": "No transcript", "hiring_signal": "no_hire",
                          "red_flags": ["No speech detected"]}
                    raw_resp = ""
                else:
                    fb, raw_resp = await _llm_json(VOICE_USER_PROMPT.format(
                        role_title=role_title, role_level=role_level,
                        jd_excerpt=jd_excerpt, question_text=question_text,
                        transcript=transcript,
                    ))
                fb = _normalize_to_rubric(fb)

                tech, comm, comp = _map_rubric_to_legacy(fb, "voice")
                perq_overall = _rubric_overall(fb, VOICE_RUBRIC_KEYS)

                per_q_summary = {
                    "question_id": row["qid"],
                    "type": "voice",
                    "ai_feedback": fb,
                    "technical": tech,
                    "communication": comm,
                    "completeness": comp,
                    "overall": perq_overall,
                }
                redflags = fb.get("red_flags") or []

            else:  # code
                tests = row["test_results"] or {}
                corr = _safe_int((tests or {}).get("correctness"), 0)
                code = row["code_answer"] or ""
                stdout = (row["code_output"] or "")[:1000]

                fb, raw_resp = await _llm_json(CODE_USER_PROMPT.format(
                    role_title=role_title, role_level=role_level,
                    question_text=question_text,
                    code=code, stdout=stdout, correctness=corr,
                ))
                fb = _normalize_to_rubric(fb)

                tech, comm, comp = _map_rubric_to_legacy(fb, "code")
                tech = max(corr, tech)
                perq_overall = _rubric_overall(fb, CODE_RUBRIC_KEYS)

                per_q_summary = {
                    "question_id": row["qid"],
                    "type": "code",
                    "ai_feedback": fb,
                    "technical": tech,
                    "communication": comm,
                    "completeness": comp,
                    "correctness": corr,
                    "overall": perq_overall,
                }
                redflags = fb.get("red_flags") or []

            await asyncio.sleep(0)
            return True

        asyncio.run(_call_and_process())

        # Update interview_answers with ai_feedback + llm_raw
        try:
            db.execute(text("""
                UPDATE interview_answers
                SET ai_feedback = :fb, llm_raw = :raw
                WHERE id = :aid
            """), {
                "fb": json.dumps(per_q_summary.get("ai_feedback") if per_q_summary else {}),
                "raw": raw_resp,
                "aid": row["aid"]
            })
        except Exception:
            log.exception("Failed to update interview_answers for aid=%s", row["aid"])

        # Upsert interview_scores for this question only
        try:
            tech_score = _safe_int(per_q_summary.get("technical"), 0)
            comm_score = _safe_int(per_q_summary.get("communication"), 0)
            comp_score = _safe_int(per_q_summary.get("completeness"), 0)
            overall_q = float(per_q_summary.get("overall", 0))

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
                "iid": interview_id,
                "qid": row["qid"],
                "tech": int(tech_score),
                "comm": int(comm_score),
                "comp": int(comp_score),
                "overall": float(overall_q),
                "fb": json.dumps(per_q_summary.get("ai_feedback") if per_q_summary else {}),
                "raw": raw_resp,
            })
            db.commit()
        except Exception:
            log.exception("Failed to upsert interview_scores for question %s", row["qid"])
            try:
                db.rollback()
            except Exception:
                pass

        # recompute aggregate report and update interviews table
        try:
            report = _aggregate_from_interview_scores(db, interview_id)
            db.execute(text("UPDATE interviews SET overall_score = :o, report = CAST(:r AS jsonb), status = 'scored' WHERE id = :iid"),
                       {"o": report["overall_score"], "r": json.dumps(report), "iid": interview_id})
            db.commit()
        except Exception:
            log.exception("Failed to aggregate after single-question scoring")
            try:
                db.rollback()
            except Exception:
                pass

        # record an audit row (best-effort)
        try:
            model_meta = {"provider": AI_PROVIDER, "model": (OLLAMA_MODEL if AI_PROVIDER == "ollama" else OPENAI_MODEL if AI_PROVIDER == "openai" else "stub")}
            weights = {"technical": TECH_W, "communication": COMM_W, "completeness": COMP_W}
            audit_id = _record_audit(
                db=db,
                interview_id=interview_id,
                overall_score=report.get("overall_score") if 'report' in locals() else None,
                section_scores=report.get("section_scores") if 'report' in locals() else {},
                per_question_summary=[per_q_summary] if per_q_summary else [],
                model_meta=model_meta,
                prompt_hash=None,
                prompt_text=None,
                weights=weights,
                triggered_by=triggered_by,
                task_id=getattr(current_task.request, "id", None),
                llm_raw_full={"interview_id": interview_id, "questions": [{"question_id": row["qid"], "llm_raw": raw_resp, "ai_feedback": per_q_summary.get("ai_feedback")}]},
                notes="single-question scoring"
            )
            if audit_id:
                log.info("Recorded interview_score_audit id=%s for interview=%s (single-question)", audit_id, interview_id)
        except Exception:
            log.exception("Failed to record audit for single-question scoring")

        # Return new overall to UI (or None)
        try:
            new_overall = report.get("overall_score")
        except Exception:
            new_overall = None

        return {"ok": True, "overall": new_overall}
    except Exception as e:
        db.rollback()
        log.exception("score_question failed for %s: %s", interview_question_id, e)
        return {"ok": False, "error": str(e)}
    finally:
        db.close()

# ------------------------------
# Celery Task (modified signature to accept triggered_by)
# ------------------------------
@app.task(name="tasks.score_interview")
def score_interview(interview_id: str, triggered_by: str = "system") -> Dict[str, Any]:
    db: Session = SessionLocal()
    try:
        # Backfill guard: ensure interview_answers has transcripts from live turns
        try:
            from services.answer_backfill import backfill_answers_from_turns
            backfill_answers_from_turns(db, interview_id)
        except Exception:
            log.exception("[BACKFILL] guard failed in score_interview")

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

        role_title, role_level, jd_excerpt = _fetch_role_context(db, interview_id)

        async def _score_all():
            for r in rows:
                if not r["aid"]:
                    log.info("No answer for question %s — skipping", r["qid"])
                    continue

                raw_resp = ""  # initialize per-question raw text
                question_text = (r["question_text"] or "").strip()

                if r["type"] == "voice":
                    transcript = (r["transcript"] or "").strip()
                    if not transcript:
                        fb = {"technical_accuracy": 0, "problem_solving": 0,
                              "communication_clarity": 0, "depth_of_knowledge": 0, "relevance": 0,
                              "strengths": [], "weaknesses": ["No speech detected"],
                              "summary": "No transcript", "hiring_signal": "no_hire",
                              "red_flags": ["No speech detected"]}
                        raw_resp = ""
                    else:
                        fb, raw_resp = await _llm_json(VOICE_USER_PROMPT.format(
                            role_title=role_title, role_level=role_level,
                            jd_excerpt=jd_excerpt, question_text=question_text,
                            transcript=transcript,
                        ))
                    fb = _normalize_to_rubric(fb)

                    tech, comm, comp = _map_rubric_to_legacy(fb, "voice")

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
                        perq_overall = _rubric_overall(fb, VOICE_RUBRIC_KEYS)

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
                            "tech": int(tech),
                            "comm": int(comm),
                            "comp": int(comp),
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

                    fb, raw_resp = await _llm_json(CODE_USER_PROMPT.format(
                        role_title=role_title, role_level=role_level,
                        question_text=question_text,
                        code=code, stdout=stdout, correctness=corr,
                    ))
                    fb = _normalize_to_rubric(fb)

                    tech, comm, comp = _map_rubric_to_legacy(fb, "code")
                    tech = max(corr, tech)

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

                    # UPSERT into interview_scores for code
                    try:
                        perq_overall = _rubric_overall(fb, CODE_RUBRIC_KEYS)

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
                            "tech": int(tech),
                            "comm": int(comm),
                            "comp": int(comp),
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
            db.execute(text("UPDATE interviews SET overall_score = :o, report = CAST(:r AS jsonb), status = 'scored' WHERE id = :iid"),
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

            # Phase 12: update role difficulty calibration
            try:
                role_row = db.execute(
                    text("SELECT role_id FROM interviews WHERE id = :iid"),
                    {"iid": str(interview_id)},
                ).scalar()
                if role_row:
                    update_role_calibration(db, role_row, report["overall_score"])
            except Exception:
                log.exception("Failed to update role calibration for interview %s", interview_id)

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
            db.execute(text("UPDATE interviews SET overall_score=:o, report=:r, status='scored' WHERE id=:iid"),
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
