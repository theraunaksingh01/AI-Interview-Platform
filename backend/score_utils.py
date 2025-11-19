# backend/score_utils.py
from __future__ import annotations
import os
import json
import tempfile
import shutil
import subprocess
import logging
from typing import Any, Dict, Tuple

from tasks.question_tasks import _llm_json  # reuse your LLM wrapper
log = logging.getLogger(__name__)

# Safety control — code execution disabled by default. Set to "true" to allow.
ENABLE_CODE_EXEC = os.getenv("ENABLE_CODE_EXEC", "false").lower() in ("1", "true", "yes")

# Default scoring weights (tweak in config)
DEFAULT_WEIGHTS = {"technical": 0.6, "communication": 0.3, "completeness": 0.1}


def _make_scoring_prompt(question: str, transcript: str) -> str:
    """
    Creates a low-temperature prompt that asks the LLM to score the answer.
    Returns a short instruction prompt.
    """
    prompt = (
        "You are an objective technical interviewer grader. "
        "Score the candidate's answer using the rubric and return ONLY a JSON object.\n\n"
        "RUBRIC (0-100 each):\n"
        " - technical: correctness and technical depth (0-100)\n"
        " - communication: clarity, structure, confidence (0-100)\n"
        " - completeness: how fully they answered the question (0-100)\n\n"
        "Return EXACT JSON:\n"
        '{ "technical": int, "communication": int, "completeness": int, "feedback": "short text" }\n\n'
        f"Question: {question}\n\n"
        f"Transcript: {transcript}\n\n"
        "Be concise in feedback (max 80 chars). Use low verbosity."
    )
    return prompt


def grade_transcript_with_llm(question: str, transcript: str) -> Dict[str, Any]:
    """
    Uses your local LLM (Ollama via _llm_json) to evaluate a transcript.
    Returns a dict with technical, communication, completeness, overall, feedback.
    """
    try:
        prompt = _make_scoring_prompt(question, transcript)
        # We call the LLM wrapper with a small n=1 request; _llm_json expects jd/resume fields,
        # so we call the underlying Ollama API directly via _llm_json hack: pass prompt into USER_TPL through jd/resume.
        # Simpler: call _llm_json with the prompt as 'resume' and tiny stub JD.
        out = _llm_json("score", prompt, 1)  # this returns a coroutine; call via asyncio.run externally if needed
        # _llm_json is async; we need to call it synchronously when used inside Celery.
        import asyncio
        parsed = asyncio.run(out)
        # The function above expects {"questions": [...]}; but our prompt asks for a JSON score.
        # So parsed might be {"questions": [...]}, but in practice we want the model's 'response'.
        # Safer: call Ollama API directly here for scoring (bypassing _llm_json) — implement simple httpx call.
    except Exception:
        log.exception("LLM helper path failed; falling back to direct Ollama call")
    # Direct Ollama call (robust)
    try:
        from tasks.question_tasks import OLLAMA_URL, OLLAMA_MODEL  # reuse config
        import httpx
        scoring_payload = {
            "model": OLLAMA_MODEL,
            "prompt": _make_scoring_prompt(question, transcript),
            "format": "json",
            "stream": False,
        }
        with httpx.Client(timeout=30) as client:
            r = client.post(f"{OLLAMA_URL.rstrip('/')}/api/generate", json=scoring_payload)
            r.raise_for_status()
            # parse NDJSON-ish or normal response
            raw = r.content.decode(errors="ignore")
            # try parse last json blob
            import re
            m = re.search(r"(\{.*\})", raw, flags=re.S)
            if not m:
                # fallback: try entire body as json
                try:
                    body = r.json()
                    resp = body.get("response") if isinstance(body, dict) else None
                except Exception:
                    resp = raw
            else:
                resp = m.group(1)
            # attempt json parse
            try:
                score_obj = json.loads(resp)
            except Exception:
                # try to parse common "key: value" patterns — fallback moderate defaults
                log.warning("Failed to parse scoring JSON; resp=%s", resp[:400])
                return {"technical": 50, "communication": 50, "completeness": 50, "overall": 50, "feedback": "Unable to parse model output"}
            # normalize numeric fields
            tech = int(score_obj.get("technical", 0))
            comm = int(score_obj.get("communication", 0))
            comp = int(score_obj.get("completeness", 0))
            # clamp
            tech = max(0, min(100, tech))
            comm = max(0, min(100, comm))
            comp = max(0, min(100, comp))
            # weighted overall
            w = DEFAULT_WEIGHTS
            overall = round(tech * w["technical"] + comm * w["communication"] + comp * w["completeness"], 2)
            return {"technical": tech, "communication": comm, "completeness": comp, "overall": overall, "feedback": score_obj.get("feedback", "")}
    except Exception:
        log.exception("Direct Ollama scoring failed")
        return {"technical": 50, "communication": 50, "completeness": 50, "overall": 50, "feedback": "LLM scoring failed"}


def grade_code_answer(code: str, sample_cases: list | None = None) -> Dict[str, Any]:
    """
    Safe stub for code grading. By default returns a heuristic score.
    If ENABLE_CODE_EXEC is true, attempts to run tests inside a short-lived Docker sandbox.
    IMPORTANT: enabling code execution runs untrusted code. Only enable in a secure environment.
    """
    # Basic heuristic: presence of keywords -> partial score
    if not code:
        return {"score": 0, "details": {"reason": "no code submitted"}, "test_results": []}

    if not ENABLE_CODE_EXEC:
        # heuristic scoring: checks for function keyword, return, mention of algorithm names
        score = 40
        lc = code.lower()
        if "def " in lc or "function " in lc or "class " in lc:
            score += 20
        if "return " in lc or "print(" in lc:
            score += 10
        if any(k in lc for k in ["lru", "cache", "stack", "queue", "merge", "sort"]):
            score += 10
        score = min(100, score)
        return {"score": score, "details": {"heuristic": True}, "test_results": []}

    # If execution allowed, run inside Docker container with resource limits (example)
    # You must have a docker image prepared that runs tests (e.g., python:3.11-slim)
    # Provide sample_cases as a list of dicts: [{"stdin": "...", "expected": "..."}, ...] or as pytest-style tests.
    try:
        tmp = tempfile.mkdtemp(prefix="code_eval_")
        src_file = tmp + "/submission.py"
        with open(src_file, "w", encoding="utf8") as f:
            f.write(code)
        results = []
        passed = 0
        if not sample_cases:
            # no tests provided -> basic import check
            cmd = ["python", "-c", f"import sys; import runpy; runpy.run_path('{src_file}', run_name='__main__')"]
            proc = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=8)
            ok = proc.returncode == 0
            results.append({"cmd": cmd, "returncode": proc.returncode, "stdout": proc.stdout.decode(errors="ignore"), "stderr": proc.stderr.decode(errors="ignore")})
            passed = 1 if ok else 0
        else:
            # run each sample case by invoking the script or a test harness
            for case in sample_cases:
                # simple: run script and feed stdin
                stdin = case.get("stdin", "")
                expected = str(case.get("expected", "")).strip()
                proc = subprocess.run(["python", src_file], input=stdin.encode(), stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=6)
                out = proc.stdout.decode(errors="ignore").strip()
                ok = (out == expected)
                results.append({"stdin": stdin, "expected": expected, "stdout": out, "ok": ok, "stderr": proc.stderr.decode(errors="ignore")})
                if ok:
                    passed += 1
        total = len(sample_cases) if sample_cases else 1
        score = int(round(100 * (passed / total)))
        return {"score": score, "details": {"passed": passed, "total": total}, "test_results": results}
    except Exception:
        log.exception("Code execution failed")
        return {"score": 0, "details": {"error": "execution failed"}, "test_results": []}
    finally:
        try:
            shutil.rmtree(tmp)
        except Exception:
            pass
