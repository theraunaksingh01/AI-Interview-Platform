# backend/api/runner.py
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from api.deps import get_current_user
import subprocess, tempfile, os, textwrap, shutil

router = APIRouter(prefix="/code", tags=["code"])

class RunIn(BaseModel):
    lang: str = Field(..., examples=["javascript", "python", "java", "cpp"])
    code: str
    stdin: str | None = ""  # visible testcase input from UI

class RunOut(BaseModel):
    ok: bool
    exit_code: int | None = None
    stdout: str = ""
    stderr: str = ""
    error: str | None = None

TIMEOUT = 10  # seconds

def _run(cmd: list[str], *, input_text: str = ""):
    try:
        proc = subprocess.run(
            cmd,
            input=input_text,
            text=True,
            capture_output=True,
            timeout=TIMEOUT,
        )
        return True, proc.returncode, (proc.stdout or ""), (proc.stderr or "")
    except subprocess.TimeoutExpired:
        return False, None, "", "Timeout (>10s)"
    except FileNotFoundError as e:
        return False, None, "", f"Interpreter not found: {e}"
    except Exception as e:
        return False, None, "", str(e)

@router.post("/run", response_model=RunOut)
def run_snippet(payload: RunIn, user=Depends(get_current_user)):
    lang = payload.lang.lower().strip()
    code = payload.code
    stdin = payload.stdin or ""

    # Simple local runners for demo. (Works without Docker.)
    if lang == "javascript":
        # Node inline
        prelude = "// sandbox-lite\n"
        ok, rc, out, err = _run(["node", "-e", prelude + code], input_text=stdin)
        return RunOut(ok=ok and rc == 0, exit_code=rc, stdout=out.strip(), stderr=err.strip(), error=None if ok else err)

    if lang == "python":
        ok, rc, out, err = _run(["python", "-c", code], input_text=stdin)
        return RunOut(ok=ok and rc == 0, exit_code=rc, stdout=out.strip(), stderr=err.strip(), error=None if ok else err)

    if lang == "java":
        # write Main.java -> javac -> java Main
        with tempfile.TemporaryDirectory() as d:
            src = os.path.join(d, "Main.java")
            with open(src, "w", encoding="utf-8") as f:
                f.write(code)
            ok, rc, out, err = _run(["javac", src])
            if not ok or rc != 0:
                return RunOut(ok=False, exit_code=rc, stdout="", stderr=err.strip() or out.strip(), error=None)
            ok, rc, out, err = _run(["java", "-cp", d, "Main"], input_text=stdin)
            return RunOut(ok=ok and rc == 0, exit_code=rc, stdout=out.strip(), stderr=err.strip(), error=None if ok else err)

    if lang == "cpp" or lang == "c++":
        with tempfile.TemporaryDirectory() as d:
            src = os.path.join(d, "main.cpp")
            exe = os.path.join(d, "main.exe" if os.name == "nt" else "main")
            with open(src, "w", encoding="utf-8") as f:
                f.write(code)
            ok, rc, out, err = _run(["g++", "-O2", "-std=c++17", src, "-o", exe])
            if not ok or rc != 0:
                return RunOut(ok=False, exit_code=rc, stdout="", stderr=err.strip() or out.strip(), error=None)
            ok, rc, out, err = _run([exe], input_text=stdin)
            return RunOut(ok=ok and rc == 0, exit_code=rc, stdout=out.strip(), stderr=err.strip(), error=None if ok else err)

    raise HTTPException(422, f"Unsupported lang '{lang}'. Use javascript|python|java|cpp")
