# backend/api/dsa_practice.py
"""
DSA Practice API

GET  /api/dsa/topics                 — topic list with counts + user progress
GET  /api/dsa/problems/{topic}       — problem list for a topic
GET  /api/dsa/problem/{id}           — full problem detail
POST /api/dsa/run/{id}               — run against sample cases (no attempt saved)
POST /api/dsa/submit/{id}            — run against all hidden test cases, save attempt
GET  /api/dsa/attempts/{id}          — user's attempt history for a problem
GET  /api/dsa/stats                  — user's overall DSA stats
"""

from __future__ import annotations

import json
import logging
import os
import re
import subprocess
import sys
import tempfile
from datetime import datetime, timezone
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.orm import Session

from api.deps import get_current_user
from db.session import SessionLocal
from core.code_safety import validate_code

log = logging.getLogger(__name__)

router = APIRouter(prefix="/api/dsa", tags=["dsa-practice"])

FREE_DAILY_LIMIT = 3


# ─── DB helpers ───────────────────────────────────────────────────────────────

def _get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _get_user_plan(db: Session, user_id: int) -> str:
    row = db.execute(
        text("SELECT plan FROM users WHERE id = :uid"), {"uid": user_id}
    ).scalar()
    return (row or "free").lower()


def _check_free_limit(db: Session, user_id: int) -> bool:
    today = datetime.now(timezone.utc).date()
    count = db.execute(
        text("""
            SELECT COUNT(*) FROM dsa_attempts
            WHERE user_id = :uid AND created_at::date = :today
        """),
        {"uid": user_id, "today": today},
    ).scalar() or 0
    return int(count) < FREE_DAILY_LIMIT


# ─── Schemas ──────────────────────────────────────────────────────────────────

class RunRequest(BaseModel):
    code: str
    language: str = "python"


class SubmitRequest(BaseModel):
    code: str
    language: str = "python"
    hints_revealed: int = 0


# ─── Subprocess executor ──────────────────────────────────────────────────────

def _run_python(code: str, timeout: int = 5) -> dict:
    with tempfile.NamedTemporaryFile(mode="w", suffix=".py", delete=False) as f:
        f.write(code)
        path = f.name
    try:
        result = subprocess.run(
            [sys.executable, path],
            capture_output=True, text=True, timeout=timeout
        )
        return {
            "status": "ok" if result.returncode == 0 else "runtime_error",
            "stdout": result.stdout.strip(),
            "stderr": result.stderr.strip(),
        }
    except subprocess.TimeoutExpired:
        return {"status": "tle", "stdout": "", "stderr": "Time limit exceeded"}
    except Exception as e:
        return {"status": "runtime_error", "stdout": "", "stderr": str(e)}
    finally:
        try:
            os.unlink(path)
        except Exception:
            pass


def _run_java(code: str, timeout: int = 10) -> dict:
    tmpdir = tempfile.mkdtemp()
    try:
        path = os.path.join(tmpdir, "Main.java")
        with open(path, "w") as f:
            f.write(code)

        # Compile
        compile_result = subprocess.run(
            ["javac", path],
            capture_output=True, text=True, timeout=15
        )
        if compile_result.returncode != 0:
            return {
                "status": "compilation_error",
                "stdout": "",
                "stderr": compile_result.stderr.strip(),
            }

        # Run
        try:
            result = subprocess.run(
                ["java", "-cp", tmpdir, "Main"],
                capture_output=True, text=True, timeout=timeout
            )
            return {
                "status": "ok" if result.returncode == 0 else "runtime_error",
                "stdout": result.stdout.strip(),
                "stderr": result.stderr.strip(),
            }
        except subprocess.TimeoutExpired:
            return {"status": "tle", "stdout": "", "stderr": "Time limit exceeded"}
    except Exception as e:
        return {"status": "runtime_error", "stdout": "", "stderr": str(e)}
    finally:
        import shutil
        try:
            shutil.rmtree(tmpdir)
        except Exception:
            pass


def _run_cpp(code: str, timeout: int = 5) -> dict:
    tmpdir = tempfile.mkdtemp()
    try:
        src = os.path.join(tmpdir, "solution.cpp")
        exe = os.path.join(tmpdir, "solution.exe" if os.name == "nt" else "solution")

        with open(src, "w") as f:
            f.write(code)

        # Compile
        compile_result = subprocess.run(
            ["g++", "-o", exe, src, "-std=c++17"],
            capture_output=True, text=True, timeout=15
        )
        if compile_result.returncode != 0:
            return {
                "status": "compilation_error",
                "stdout": "",
                "stderr": compile_result.stderr.strip(),
            }

        # Run
        try:
            result = subprocess.run(
                [exe],
                capture_output=True, text=True, timeout=timeout
            )
            return {
                "status": "ok" if result.returncode == 0 else "runtime_error",
                "stdout": result.stdout.strip(),
                "stderr": result.stderr.strip(),
            }
        except subprocess.TimeoutExpired:
            return {"status": "tle", "stdout": "", "stderr": "Time limit exceeded"}
    except Exception as e:
        return {"status": "runtime_error", "stdout": "", "stderr": str(e)}
    finally:
        import shutil
        try:
            shutil.rmtree(tmpdir)
        except Exception:
            pass


def execute_code(source_code: str, language: str, timeout: int = 5) -> dict:
    """Single entry point for all languages. Swap internals here when moving to Judge0."""
    if language == "python":
        return _run_python(source_code, timeout)
    elif language == "java":
        return _run_java(source_code, timeout)
    elif language == "cpp":
        return _run_cpp(source_code, timeout)
    return {"status": "runtime_error", "stdout": "", "stderr": f"Unsupported language: {language}"}


# ─── Test harness builders ────────────────────────────────────────────────────

def _extract_func_name(func_signature: str, language: str = "python") -> str:
    if language == "python":
        m = re.search(r"def\s+(\w+)\s*\(", func_signature or "")
        return m.group(1) if m else "solution"
    m = re.search(r"\s+(\w+)\s*\(", func_signature or "")
    return m.group(1) if m else "solution"


def _build_python_harness(student_code: str, func_name: str, test_input: dict) -> str:
    return f"""import json

{student_code}

try:
    test_input = {json.dumps(test_input)}
    result = {func_name}(**test_input)
    print(json.dumps(result))
except Exception as e:
    print(f"RUNTIME_ERROR: {{e}}")
"""


def _java_literal(val: Any) -> str:
    if isinstance(val, bool):
        return "true" if val else "false"
    if isinstance(val, int):
        return str(val)
    if isinstance(val, float):
        return f"{val}f"
    if isinstance(val, str):
        return f'"{val}"'
    if isinstance(val, list):
        if val and isinstance(val[0], int):
            inner = ",".join(str(x) for x in val)
            return f"new int[]{{{inner}}}"
        inner = ",".join(_java_literal(x) for x in val)
        return f"new Object[]{{{inner}}}"
    return str(val)


def _cpp_literal(val: Any) -> str:
    if isinstance(val, bool):
        return "true" if val else "false"
    if isinstance(val, (int, float)):
        return str(val)
    if isinstance(val, str):
        return f'"{val}"'
    if isinstance(val, list):
        inner = ",".join(_cpp_literal(x) for x in val)
        return f"{{{inner}}}"
    return str(val)


def _build_java_harness(student_code: str, func_name: str, test_input: dict) -> str:
    args_str = ", ".join(_java_literal(v) for v in test_input.values())
    return f"""import java.util.*;
import java.util.Arrays;

public class Main {{
    {student_code}

    public static void main(String[] args) {{
        Main sol = new Main();
        Object result = sol.{func_name}({args_str});
        if (result instanceof int[]) {{
            System.out.println(Arrays.toString((int[]) result));
        }} else if (result instanceof List) {{
            System.out.println(result.toString());
        }} else {{
            System.out.println(result);
        }}
    }}
}}
"""


def _build_cpp_harness(student_code: str, func_name: str, test_input: dict) -> str:
    args_str = ", ".join(_cpp_literal(v) for v in test_input.values())
    return f"""#include <bits/stdc++.h>
using namespace std;

class Solution {{
public:
    {student_code}
}};

int main() {{
    Solution sol;
    auto result = sol.{func_name}({args_str});
    cout << result << endl;
    return 0;
}}
"""


def _build_harness(student_code: str, language: str, func_name: str, test_input: dict) -> str:
    if language == "python":
        return _build_python_harness(student_code, func_name, test_input)
    elif language == "java":
        return _build_java_harness(student_code, func_name, test_input)
    elif language == "cpp":
        return _build_cpp_harness(student_code, func_name, test_input)
    return student_code


def _compare_output(actual_str: str, expected: Any) -> bool:
    try:
        actual = json.loads(actual_str)
    except (json.JSONDecodeError, ValueError):
        try:
            actual = int(actual_str.strip())
        except ValueError:
            try:
                actual = float(actual_str.strip())
            except ValueError:
                actual = actual_str.strip()

    if actual == expected:
        return True
    if isinstance(actual, float) and isinstance(expected, (int, float)):
        return abs(actual - expected) < 1e-4
    if isinstance(actual, list) and isinstance(expected, list):
        try:
            return sorted(str(x) for x in actual) == sorted(str(x) for x in expected)
        except Exception:
            pass
    if str(actual).strip() == str(expected).strip():
        return True
    return False


def _run_test_case(
    student_code: str,
    language: str,
    func_name: str,
    test_case: dict,
) -> dict:
    test_input = test_case.get("input", {})
    expected = test_case.get("expected_output")

    full_code = _build_harness(student_code, language, func_name, test_input)
    result = execute_code(full_code, language)

    if result["status"] in ("tle", "compilation_error", "runtime_error"):
        return {
            "passed": False,
            "status": result["status"],
            "actual": None,
            "expected": expected,
            "error": result.get("stderr", ""),
        }

    stdout = result["stdout"]

    if "RUNTIME_ERROR:" in stdout:
        return {
            "passed": False,
            "status": "runtime_error",
            "actual": None,
            "expected": expected,
            "error": stdout.replace("RUNTIME_ERROR: ", ""),
        }

    passed = _compare_output(stdout, expected)
    return {
        "passed": passed,
        "status": "passed" if passed else "wrong_answer",
        "actual": stdout,
        "expected": expected,
        "error": result.get("stderr", "") if not passed else "",
    }


# ─── Endpoints ────────────────────────────────────────────────────────────────

@router.get("/topics")
def get_topics(
    db: Session = Depends(_get_db),
    current_user=Depends(get_current_user),
) -> dict:
    rows = db.execute(
        text("""
            SELECT
                q.topic,
                COUNT(DISTINCT q.id) as total,
                COUNT(DISTINCT q.id) FILTER (WHERE q.difficulty = 'easy') as easy_count,
                COUNT(DISTINCT q.id) FILTER (WHERE q.difficulty = 'medium') as medium_count,
                COUNT(DISTINCT q.id) FILTER (WHERE q.difficulty = 'hard') as hard_count,
                COUNT(DISTINCT a.question_id) FILTER (WHERE a.status = 'passed') as solved
            FROM dsa_questions q
            LEFT JOIN dsa_attempts a ON a.question_id = q.id AND a.user_id = :uid AND a.status = 'passed'
            WHERE q.is_active = TRUE
            GROUP BY q.topic
            ORDER BY q.topic
        """),
        {"uid": current_user.id},
    ).mappings().all()

    TOPIC_META = {
        "Arrays":                   {"icon": "📊", "color": "#1D4ED8", "bg": "#DBEAFE"},
        "Strings":                  {"icon": "📝", "color": "#065F46", "bg": "#D1FAE5"},
        "Linked List":              {"icon": "🔗", "color": "#92400E", "bg": "#FEF3C7"},
        "Binary Trees":             {"icon": "🌲", "color": "#065F46", "bg": "#D1FAE5"},
        "BST":                      {"icon": "🔍", "color": "#5B21B6", "bg": "#EDE9FE"},
        "Graph":                    {"icon": "🕸️",  "color": "#9D174D", "bg": "#FCE7F3"},
        "Dynamic Programming":      {"icon": "⚡",  "color": "#1D4ED8", "bg": "#DBEAFE"},
        "Stack & Queue":            {"icon": "📚", "color": "#92400E", "bg": "#FEF3C7"},
        "Heaps":                    {"icon": "🏔️",  "color": "#065F46", "bg": "#D1FAE5"},
        "Binary Search":            {"icon": "🎯", "color": "#5B21B6", "bg": "#EDE9FE"},
        "Recursion & Backtracking": {"icon": "🔄", "color": "#9D174D", "bg": "#FCE7F3"},
        "Trie":                     {"icon": "🌿", "color": "#1D4ED8", "bg": "#DBEAFE"},
    }

    topics = []
    for r in rows:
        meta = TOPIC_META.get(r["topic"], {"icon": "💻", "color": "#374151", "bg": "#F3F4F6"})
        topics.append({
            "topic": r["topic"],
            "total": r["total"],
            "easy_count": r["easy_count"],
            "medium_count": r["medium_count"],
            "hard_count": r["hard_count"],
            "solved": r["solved"],
            **meta,
        })

    return {"topics": topics}


@router.get("/problems/{topic}")
def get_problems(
    topic: str,
    difficulty: Optional[str] = None,
    company: Optional[str] = None,
    db: Session = Depends(_get_db),
    current_user=Depends(get_current_user),
) -> dict:
    query = """
        SELECT
            q.id, q.problem_name, q.difficulty, q.topic, q.subtopic,
            q.tags, q.time_limit_minutes,
            CASE WHEN EXISTS (
                SELECT 1 FROM dsa_attempts a
                WHERE a.question_id = q.id AND a.user_id = :uid AND a.status = 'passed'
            ) THEN TRUE ELSE FALSE END as solved,
            ARRAY_AGG(DISTINCT ct.company) FILTER (WHERE ct.company IS NOT NULL) as companies
        FROM dsa_questions q
        LEFT JOIN dsa_company_tags ct ON ct.question_id = q.id
        WHERE q.is_active = TRUE AND q.topic = :topic
    """
    params: dict[str, Any] = {"uid": current_user.id, "topic": topic}

    if difficulty:
        query += " AND q.difficulty = :difficulty"
        params["difficulty"] = difficulty

    if company:
        query += " AND EXISTS (SELECT 1 FROM dsa_company_tags ct2 WHERE ct2.question_id = q.id AND ct2.company = :company)"
        params["company"] = company

    query += """
        GROUP BY q.id
        ORDER BY CASE q.difficulty WHEN 'easy' THEN 1 WHEN 'medium' THEN 2 WHEN 'hard' THEN 3 END, q.id
    """

    rows = db.execute(text(query), params).mappings().all()
    return {"topic": topic, "problems": [dict(r) for r in rows], "total": len(rows)}


@router.get("/problem/{question_id}")
def get_problem(
    question_id: int,
    db: Session = Depends(_get_db),
    current_user=Depends(get_current_user),
) -> dict:
    plan = _get_user_plan(db, current_user.id)

    q = db.execute(
        text("""
            SELECT q.*, d.problem_statement, d.input_format, d.output_format,
                   d.function_signature, d.constraints, d.sample_cases,
                   d.time_complexity, d.space_complexity,
                   d.approach_tags, d.hints_progressive, d.common_mistakes,
                   d.interview_followups, d.solution_code, d.solution_explanation,
                   d.edge_cases
            FROM dsa_questions q
            JOIN dsa_question_details d ON d.question_id = q.id
            WHERE q.id = :qid AND q.is_active = TRUE
        """),
        {"qid": question_id},
    ).mappings().first()

    if not q:
        raise HTTPException(status_code=404, detail="problem_not_found")

    companies = db.execute(
        text("SELECT DISTINCT company FROM dsa_company_tags WHERE question_id = :qid"),
        {"qid": question_id},
    ).scalars().all()

    best = db.execute(
        text("""
            SELECT status, test_cases_passed, test_cases_total, language,
                   hints_revealed, created_at
            FROM dsa_attempts
            WHERE user_id = :uid AND question_id = :qid
            ORDER BY CASE status WHEN 'passed' THEN 0 ELSE 1 END, created_at DESC
            LIMIT 1
        """),
        {"uid": current_user.id, "qid": question_id},
    ).mappings().first()

    today_count = db.execute(
        text("""
            SELECT COUNT(*) FROM dsa_attempts
            WHERE user_id = :uid AND created_at::date = CURRENT_DATE
        """),
        {"uid": current_user.id},
    ).scalar() or 0

    can_see_hints = plan in ("pro", "max")
    can_see_solution = plan == "max"

    qd = dict(q)
    if not can_see_solution:
        qd["solution_code"] = None
        qd["solution_explanation"] = None
    if not can_see_hints:
        qd["hints_progressive"] = None

    return {
        "id": qd["id"],
        "problem_name": qd["problem_name"],
        "difficulty": qd["difficulty"],
        "topic": qd["topic"],
        "subtopic": qd.get("subtopic"),
        "tags": qd.get("tags") or [],
        "companies": list(companies),
        "time_limit_minutes": qd.get("time_limit_minutes") or 20,
        "problem_statement": qd["problem_statement"],
        "input_format": qd.get("input_format"),
        "output_format": qd.get("output_format"),
        "constraints": qd.get("constraints"),
        "sample_cases": qd.get("sample_cases") or [],
        "time_complexity": qd.get("time_complexity"),
        "space_complexity": qd.get("space_complexity"),
        "approach_tags": qd.get("approach_tags") or [],
        "hints_progressive": qd.get("hints_progressive"),
        "common_mistakes": qd.get("common_mistakes"),
        "interview_followups": qd.get("interview_followups"),
        "solution_code": qd.get("solution_code"),
        "solution_explanation": qd.get("solution_explanation"),
        "edge_cases": qd.get("edge_cases"),
        "function_signature": qd.get("function_signature") or "",
        "can_see_hints": can_see_hints,
        "can_see_solution": can_see_solution,
        "plan": plan,
        "today_attempts": int(today_count),
        "free_limit": FREE_DAILY_LIMIT,
        "best_attempt": dict(best) if best else None,
    }


@router.post("/run/{question_id}")
def run_code(
    question_id: int,
    payload: RunRequest,
    db: Session = Depends(_get_db),
    current_user=Depends(get_current_user),
) -> dict:
    """Run against sample cases only. No attempt saved."""
    if payload.language not in ("python", "java", "cpp"):
        raise HTTPException(status_code=400, detail="unsupported_language")
    validate_code(payload.code, payload.language)
    
    validate_code(payload.code, payload.language)

    detail = db.execute(
        text("""
            SELECT d.sample_cases, d.function_signature
            FROM dsa_question_details d
            JOIN dsa_questions q ON q.id = d.question_id
            WHERE d.question_id = :qid AND q.is_active = TRUE
        """),
        {"qid": question_id},
    ).mappings().first()

    if not detail:
        raise HTTPException(status_code=404, detail="problem_not_found")

    sample_cases = detail["sample_cases"] or []
    if isinstance(sample_cases, str):
        sample_cases = json.loads(sample_cases)

    func_sig = detail["function_signature"] or ""
    func_name = _extract_func_name(func_sig, payload.language)

    results = []
    for i, tc in enumerate(sample_cases[:3]):
        result = _run_test_case(payload.code, payload.language, func_name, tc)
        results.append({
            "case_number": i + 1,
            "input": tc.get("input"),
            "expected": tc.get("expected_output"),
            "actual": result.get("actual"),
            "passed": result["passed"],
            "status": result["status"],
            "error": result.get("error", ""),
        })

    return {
        "results": results,
        "all_passed": all(r["passed"] for r in results),
        "cases_run": len(results),
    }


@router.post("/submit/{question_id}")
def submit_code(
    question_id: int,
    payload: SubmitRequest,
    db: Session = Depends(_get_db),
    current_user=Depends(get_current_user),
) -> dict:
    """Run against all hidden test cases. Save attempt."""
    plan = _get_user_plan(db, current_user.id)

    if plan == "free" and not _check_free_limit(db, current_user.id):
        raise HTTPException(status_code=403, detail="daily_limit_reached")

    if payload.language not in ("python", "java", "cpp"):
        raise HTTPException(status_code=400, detail="unsupported_language")
    validate_code(payload.code, payload.language)

    detail = db.execute(
        text("""
            SELECT d.hidden_test_cases, d.sample_cases, d.function_signature
            FROM dsa_question_details d
            JOIN dsa_questions q ON q.id = d.question_id
            WHERE d.question_id = :qid AND q.is_active = TRUE
        """),
        {"qid": question_id},
    ).mappings().first()

    if not detail:
        raise HTTPException(status_code=404, detail="problem_not_found")

    hidden = detail["hidden_test_cases"] or []
    samples = detail["sample_cases"] or []
    if isinstance(hidden, str):
        hidden = json.loads(hidden)
    if isinstance(samples, str):
        samples = json.loads(samples)

    all_cases = samples + hidden
    func_sig = detail["function_signature"] or ""
    func_name = _extract_func_name(func_sig, payload.language)

    passed_count = 0
    first_failure = None
    final_status = "passed"

    for i, tc in enumerate(all_cases):
        result = _run_test_case(payload.code, payload.language, func_name, tc)
        if result["passed"]:
            passed_count += 1
        else:
            if first_failure is None:
                first_failure = {
                    "case_number": i + 1,
                    "input": tc.get("input"),
                    "expected": tc.get("expected_output"),
                    "actual": result.get("actual"),
                    "status": result["status"],
                    "error": result.get("error", ""),
                }
            if final_status == "passed":
                final_status = result["status"]

    if passed_count == len(all_cases):
        final_status = "passed"
    elif passed_count > 0:
        final_status = "partial"

    already_solved = db.execute(
        text("""
            SELECT 1 FROM dsa_attempts
            WHERE user_id = :uid AND question_id = :qid AND status = 'passed'
            LIMIT 1
        """),
        {"uid": current_user.id, "qid": question_id},
    ).scalar()
    is_first_solve = (final_status == "passed") and (not already_solved)

    db.execute(
        text("""
            INSERT INTO dsa_attempts
                (user_id, question_id, language, code, status,
                 test_cases_passed, test_cases_total, hints_revealed, is_first_solve)
            VALUES
                (:uid, :qid, :lang, :code, :status,
                 :passed, :total, :hints, :first_solve)
        """),
        {
            "uid": current_user.id,
            "qid": question_id,
            "lang": payload.language,
            "code": payload.code,
            "status": final_status,
            "passed": passed_count,
            "total": len(all_cases),
            "hints": payload.hints_revealed,
            "first_solve": is_first_solve,
        },
    )
    db.commit()

    return {
        "status": final_status,
        "passed": passed_count,
        "total": len(all_cases),
        "is_first_solve": is_first_solve,
        "first_failure": first_failure,
        "message": (
            "All test cases passed! 🎉" if final_status == "passed"
            else f"{passed_count}/{len(all_cases)} test cases passed"
        ),
    }


@router.get("/attempts/{question_id}")
def get_attempts(
    question_id: int,
    db: Session = Depends(_get_db),
    current_user=Depends(get_current_user),
) -> dict:
    rows = db.execute(
        text("""
            SELECT id, language, status, test_cases_passed, test_cases_total,
                   hints_revealed, is_first_solve, created_at
            FROM dsa_attempts
            WHERE user_id = :uid AND question_id = :qid
            ORDER BY created_at DESC LIMIT 20
        """),
        {"uid": current_user.id, "qid": question_id},
    ).mappings().all()
    return {"attempts": [dict(r) for r in rows]}


@router.get("/stats")
def get_stats(
    db: Session = Depends(_get_db),
    current_user=Depends(get_current_user),
) -> dict:
    row = db.execute(
        text("""
            SELECT
                COUNT(DISTINCT question_id) FILTER (WHERE status = 'passed') as solved,
                COUNT(DISTINCT question_id) FILTER (
                    WHERE status = 'passed' AND question_id IN (
                        SELECT id FROM dsa_questions WHERE difficulty = 'easy'
                    )
                ) as easy_solved,
                COUNT(DISTINCT question_id) FILTER (
                    WHERE status = 'passed' AND question_id IN (
                        SELECT id FROM dsa_questions WHERE difficulty = 'medium'
                    )
                ) as medium_solved,
                COUNT(DISTINCT question_id) FILTER (
                    WHERE status = 'passed' AND question_id IN (
                        SELECT id FROM dsa_questions WHERE difficulty = 'hard'
                    )
                ) as hard_solved,
                COUNT(*) as total_submissions,
                COUNT(*) FILTER (WHERE status = 'passed') as accepted_submissions
            FROM dsa_attempts
            WHERE user_id = :uid
        """),
        {"uid": current_user.id},
    ).mappings().first()

    return dict(row) if row else {
        "solved": 0, "easy_solved": 0, "medium_solved": 0, "hard_solved": 0,
        "total_submissions": 0, "accepted_submissions": 0,
    }