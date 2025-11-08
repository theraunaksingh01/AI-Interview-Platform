# backend/api/runner.py
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
import subprocess, tempfile, textwrap, shlex

router = APIRouter(prefix="/code", tags=["code"])

# ------------ Models ------------
class RunIn(BaseModel):
    lang: str = Field(..., pattern="^(javascript|python|java|cpp)$")
    code: str
    stdin: str | None = None

class RunOut(BaseModel):
    ok: bool
    exit_code: int
    stdout: str
    stderr: str

class GradeIn(BaseModel):
    lang: str = Field(..., pattern="^(javascript|python|java|cpp)$")
    code: str
    question_slug: str  # e.g. "tower_of_hanoi"

class GradeOut(BaseModel):
    ok: bool
    exit_code: int
    stdout: str
    stderr: str
    correctness: int
    total: int
    passed: int

# ------------ Minimal local runner ------------
def _run_local(lang: str, code: str, stdin: str | None = None) -> tuple[int, str, str]:
    """
    Simple local runner for demo/dev (no containers). Good enough for grading Hanoi n=3.
    """
    with tempfile.TemporaryDirectory() as td:
        if lang == "javascript":
            path = f"{td}/main.js"
            with open(path, "w", encoding="utf-8") as f: f.write(code)
            cmd = ["node", path]
        elif lang == "python":
            path = f"{td}/main.py"
            with open(path, "w", encoding="utf-8") as f: f.write(code)
            cmd = ["python", path]
        elif lang == "java":
            path = f"{td}/Main.java"
            with open(path, "w", encoding="utf-8") as f: f.write(code)
            # compile + run
            javac = subprocess.run(["javac", path], capture_output=True, text=True)
            if javac.returncode != 0:
                return (javac.returncode, "", javac.stderr)
            cmd = ["java", "-cp", td, "Main"]
        elif lang == "cpp":
            path = f"{td}/main.cpp"
            exe = f"{td}/a.exe"
            with open(path, "w", encoding="utf-8") as f: f.write(code)
            gpp = subprocess.run(["g++", "-O2", path, "-o", exe], capture_output=True, text=True)
            if gpp.returncode != 0:
                return (gpp.returncode, "", gpp.stderr)
            cmd = [exe]
        else:
            raise ValueError("unsupported language")

        proc = subprocess.run(
            cmd,
            input=stdin or "",
            capture_output=True,
            text=True,
            timeout=10
        )
        return (proc.returncode, proc.stdout.strip(), proc.stderr.strip())

# ------------ Endpoints ------------
@router.post("/run", response_model=RunOut)
def run(inb: RunIn):
    try:
        code = inb.code if inb.code is not None else ""
        rc, out, err = _run_local(inb.lang, code, inb.stdin)
        return {"ok": rc == 0, "exit_code": rc, "stdout": out, "stderr": err}
    except Exception as e:
        raise HTTPException(500, f"run failed: {e}")

@router.post("/grade", response_model=GradeOut)
def grade(inb: GradeIn):
    """
    Very simple grader for demo:
      - Supports question_slug="tower_of_hanoi"
      - Expects the user's program to print moves for n=3, source A, target C, aux B (like our starter code)
      - Compares first 10 lines against expected sequence
    """
    # Prepare tiny harness per language to force a standard call if missing.
    # If user's code already prints required output, that's fine—we just run it as-is.
    code = inb.code

    # Expected for n=3 Hanoi (10 moves):
    expected = [
        "A -> C","A -> B","C -> B","A -> C","B -> A",
        "B -> C","A -> C","A -> B","A -> C","B -> C"
    ]

    if inb.question_slug != "tower_of_hanoi":
        # fallback: just run and mark 0 correctness (or 100 if exit_code=0) – demo behavior
        rc, out, err = _run_local(inb.lang, code, None)
        corr = 100 if rc == 0 else 0
        return {
            "ok": rc == 0,
            "exit_code": rc,
            "stdout": out,
            "stderr": err,
            "correctness": corr,
            "total": 1,
            "passed": 1 if corr == 100 else 0,
        }

    # Run the code
    rc, out, err = _run_local(inb.lang, code, None)
    lines = [l.strip() for l in (out or "").splitlines() if l.strip()]

    # Compare first N=10 lines against expected
    total = min(len(expected), len(lines)) or len(expected)
    passed = sum(1 for i in range(min(len(expected), len(lines))) if lines[i] == expected[i])
    correctness = int(round(100 * (passed / len(expected)))) if expected else 0

    return {
        "ok": rc == 0,
        "exit_code": rc,
        "stdout": out,
        "stderr": err,
        "correctness": correctness,
        "total": len(expected),
        "passed": passed,
    }
