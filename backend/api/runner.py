# backend/api/runner.py
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
import subprocess
import tempfile
from typing import Optional, List

router = APIRouter(prefix="/code", tags=["code"])

# ------------ Models ------------
class RunIn(BaseModel):
    lang: str = Field(..., pattern="^(javascript|python|java|cpp)$")
    code: str
    stdin: Optional[str] = None

class RunOut(BaseModel):
    ok: bool
    exit_code: int
    stdout: str
    stderr: str

class TestCase(BaseModel):
    stdin: str
    expected_stdout: str

class GradeIn(BaseModel):
    question_slug: Optional[str] = None   # e.g. "tower-of-hanoi"
    question_id: Optional[int] = None     # optional: if you want to resolve slug server-side later
    lang: str
    code: str
    tests: List[TestCase] = []            # optional custom tests

class GradeOut(BaseModel):
    ok: bool
    exit_code: int
    stdout: str
    stderr: str
    correctness: int
    total: int
    passed: int

# ------------ Minimal local runner ------------
def _run_local(lang: str, code: str, stdin: Optional[str] = None) -> tuple[int, str, str]:
    """
    Simple local runner for demo/dev (no containers). Good enough for grading small tasks.
    """
    with tempfile.TemporaryDirectory() as td:
        if lang == "javascript":
            path = f"{td}/main.js"
            with open(path, "w", encoding="utf-8") as f:
                f.write(code)
            cmd = ["node", path]
        elif lang == "python":
            path = f"{td}/main.py"
            with open(path, "w", encoding="utf-8") as f:
                f.write(code)
            cmd = ["python", path]
        elif lang == "java":
            path = f"{td}/Main.java"
            with open(path, "w", encoding="utf-8") as f:
                f.write(code)
            javac = subprocess.run(["javac", path], capture_output=True, text=True)
            if javac.returncode != 0:
                return (javac.returncode, "", (javac.stderr or "").strip())
            cmd = ["java", "-cp", td, "Main"]
        elif lang == "cpp":
            path = f"{td}/main.cpp"
            exe = f"{td}/a.exe"
            with open(path, "w", encoding="utf-8") as f:
                f.write(code)
            gpp = subprocess.run(["g++", "-O2", path, "-o", exe], capture_output=True, text=True)
            if gpp.returncode != 0:
                return (gpp.returncode, "", (gpp.stderr or "").strip())
            cmd = [exe]
        else:
            raise ValueError("unsupported language")

        try:
            proc = subprocess.run(cmd, input=stdin or "", capture_output=True, text=True, timeout=10)
        except FileNotFoundError:
            return (127, "", f"runtime not found: {cmd[0]}")


# ------------ Endpoints ------------
@router.post("/run", response_model=RunOut)
def run(inb: RunIn):
    try:
        rc, out, err = _run_local(inb.lang, inb.code or "", inb.stdin)
        return {"ok": rc == 0, "exit_code": rc, "stdout": out, "stderr": err}
    except Exception as e:
        raise HTTPException(500, f"run failed: {e}")

@router.post("/grade", response_model=GradeOut)
def grade(inb: GradeIn):
    """
    Grader flow (priority):
      1) If tests[] provided: run each with stdin and compare stdout exactly.
      2) Else if question_slug is tower-of-hanoi: run with stdin='3' and compare the 10 standard moves.
      3) Else: just run once, return 100 if exit_code==0 (demo fallback).
    """
    code = inb.code or ""

    # 1) Explicit test cases provided by client
    if inb.tests:
        total = len(inb.tests)
        passed = 0
        last_rc, last_out, last_err = 0, "", ""

        for t in inb.tests:
            rc, out, err = _run_local(inb.lang, code, t.stdin)
            last_rc, last_out, last_err = rc, out, err
            # strict compare (trim trailing whitespace)
            if out.strip() == (t.expected_stdout or "").strip():
                passed += 1

        correctness = int(round(100 * (passed / total))) if total else 0
        ok = (passed == total) and (last_rc == 0)

        return {
            "ok": ok,
            "exit_code": last_rc,
            "stdout": last_out,
            "stderr": last_err,
            "correctness": correctness,
            "total": total,
            "passed": passed,
        }

    # 2) Built-in grader for Tower of Hanoi (slug variants)
    if (inb.question_slug or "").replace("_", "-") == "tower-of-hanoi":
        # Expected moves for n=3, A->C using B (10 moves)
        expected_lines = [
            "A -> C","A -> B","C -> B","A -> C","B -> A",
            "B -> C","A -> C","A -> B","A -> C","B -> C"
        ]
        rc, out, err = _run_local(inb.lang, code, "3")
        actual_lines = [l.strip() for l in (out or "").splitlines() if l.strip()]

        # Compare line-by-line; allow extra lines but grade on first 10
        compare_count = min(len(expected_lines), len(actual_lines))
        passed = sum(1 for i in range(compare_count) if actual_lines[i] == expected_lines[i])
        correctness = int(round(100 * (passed / len(expected_lines)))) if expected_lines else 0

        return {
            "ok": rc == 0 and correctness == 100,
            "exit_code": rc,
            "stdout": out,
            "stderr": err,
            "correctness": correctness,
            "total": len(expected_lines),
            "passed": passed,
        }

    # 3) Fallback: just run once; if it exits 0, give 100 for demo purposes
    rc, out, err = _run_local(inb.lang, code, None)
    correctness = 100 if rc == 0 else 0
    return {
        "ok": rc == 0,
        "exit_code": rc,
        "stdout": out,
        "stderr": err,
        "correctness": correctness,
        "total": 1,
        "passed": 1 if rc == 0 else 0,
    }
