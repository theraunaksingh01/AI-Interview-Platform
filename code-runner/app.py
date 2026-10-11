"""
Cractal code runner: a tiny service that compiles and runs student code.

Design rules:
  * It holds NO secrets and has NO database access. The only variable it needs
    is RUNNER_TOKEN, which only lets a caller use this service.
  * Student code runs in a child process with a minimal environment, a private
    temp directory, hard resource limits, and its whole process group is killed
    on timeout.
  * Run it as a non-root user (the Dockerfile does) and keep it on the private
    network, not the public internet.
"""
from __future__ import annotations

import hmac
import os
import re
import shutil
import signal
import subprocess
import tempfile
import threading
from typing import Optional

from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel, Field

RUNNER_TOKEN = os.environ.get("RUNNER_TOKEN", "")
MAX_CONCURRENT = int(os.environ.get("RUNNER_MAX_CONCURRENT", "4"))
MAX_CODE_BYTES = 64 * 1024
MAX_STDIN_BYTES = 256 * 1024
MAX_OUTPUT_BYTES = 64 * 1024
MAX_TIME_LIMIT = 10.0
COMPILE_TIMEOUT = 20
MEM_LIMIT_MB = int(os.environ.get("RUNNER_MEM_MB", "256"))

# Only these variables reach student code. No secrets, no proxy settings.
SAFE_ENV_KEYS = ("PATH", "LANG", "LC_ALL")

app = FastAPI(title="cractal-runner", docs_url=None, redoc_url=None, openapi_url=None)
_slots = threading.BoundedSemaphore(MAX_CONCURRENT)


class RunRequest(BaseModel):
    language: str
    code: str
    stdin: str = ""
    time_limit: float = Field(default=5.0, gt=0)


def _safe_env(tmp: str) -> dict:
    env = {k: os.environ[k] for k in SAFE_ENV_KEYS if k in os.environ}
    env["HOME"] = tmp
    env["TMPDIR"] = tmp
    return env


def _limited(cmd: list[str], cpu_seconds: int, java: bool) -> list[str]:
    """Wrap a command with hard resource limits using prlimit (no preexec_fn, thread-safe)."""
    wrapped = [
        "prlimit",
        "--core=0",
        f"--cpu={cpu_seconds}:{cpu_seconds + 1}",
        f"--fsize={10 * 1024 * 1024}",
        "--nofile=128",
        "--nproc=256",
    ]
    if not java:
        # The JVM reserves a lot of address space, so it is limited with -Xmx instead.
        wrapped.append(f"--as={MEM_LIMIT_MB * 1024 * 1024}")
    return wrapped + ["--"] + cmd


def _clip(b: bytes) -> tuple[str, bool]:
    clipped = len(b) > MAX_OUTPUT_BYTES
    return b[:MAX_OUTPUT_BYTES].decode("utf-8", errors="replace"), clipped


def _run(cmd: list[str], tmp: str, stdin: str, timeout: float, java: bool = False) -> dict:
    proc = subprocess.Popen(
        _limited(cmd, int(timeout) + 1, java),
        cwd=tmp,
        env=_safe_env(tmp),
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        start_new_session=True,  # own process group so we can kill everything it spawns
    )
    timed_out = False
    try:
        out, err = proc.communicate(stdin.encode("utf-8", errors="replace"), timeout=timeout)
    except subprocess.TimeoutExpired:
        timed_out = True
        try:
            os.killpg(proc.pid, signal.SIGKILL)
        except ProcessLookupError:
            pass
        out, err = proc.communicate()
    finally:
        # Make sure nothing the program spawned survives.
        try:
            os.killpg(proc.pid, signal.SIGKILL)
        except (ProcessLookupError, PermissionError):
            pass
    so, c1 = _clip(out or b"")
    se, c2 = _clip(err or b"")
    return {
        "stdout": so,
        "stderr": se,
        "returncode": proc.returncode,
        "timed_out": timed_out,
        "truncated": c1 or c2,
    }


def _compile_error(res: dict) -> dict:
    return {**res, "stage": "compile"}


@app.get("/health")
def health():
    return {"ok": True}


@app.post("/run")
def run(req: RunRequest, x_runner_token: Optional[str] = Header(default=None)) -> dict:
    if not RUNNER_TOKEN:
        raise HTTPException(status_code=503, detail="runner_not_configured")
    if not x_runner_token or not hmac.compare_digest(x_runner_token, RUNNER_TOKEN):
        raise HTTPException(status_code=401, detail="bad_token")
    if req.language not in ("python", "java", "cpp"):
        raise HTTPException(status_code=400, detail="unsupported_language")
    if len(req.code.encode("utf-8")) > MAX_CODE_BYTES:
        raise HTTPException(status_code=413, detail="code_too_large")
    if len(req.stdin.encode("utf-8")) > MAX_STDIN_BYTES:
        raise HTTPException(status_code=413, detail="stdin_too_large")

    limit = min(req.time_limit, MAX_TIME_LIMIT)

    if not _slots.acquire(blocking=False):
        raise HTTPException(status_code=429, detail="runner_busy")
    tmp = tempfile.mkdtemp(prefix="run_")
    try:
        os.chmod(tmp, 0o700)
        if req.language == "python":
            with open(os.path.join(tmp, "main.py"), "w", encoding="utf-8") as f:
                f.write(req.code)
            res = _run(["python3", "-I", "main.py"], tmp, req.stdin, limit)
            return {**res, "stage": "run"}

        if req.language == "cpp":
            with open(os.path.join(tmp, "main.cpp"), "w", encoding="utf-8") as f:
                f.write(req.code)
            comp = _run(["g++", "-O2", "-std=c++17", "-o", "prog", "main.cpp"], tmp, "", COMPILE_TIMEOUT)
            if comp["returncode"] != 0 or comp["timed_out"]:
                return _compile_error(comp)
            res = _run(["./prog"], tmp, req.stdin, limit)
            return {**res, "stage": "run"}

        # java
        m = re.search(r"public\s+(?:final\s+)?class\s+([A-Za-z_]\w*)", req.code)
        cls = m.group(1) if m else "Main"
        with open(os.path.join(tmp, f"{cls}.java"), "w", encoding="utf-8") as f:
            f.write(req.code)
        comp = _run(["javac", "-J-Xmx256m", f"{cls}.java"], tmp, "", COMPILE_TIMEOUT, java=True)
        if comp["returncode"] != 0 or comp["timed_out"]:
            return _compile_error(comp)
        res = _run(
            ["java", f"-Xmx{MEM_LIMIT_MB}m", "-Xss512k", "-XX:+UseSerialGC", "-cp", tmp, cls],
            tmp, req.stdin, limit, java=True,
        )
        return {**res, "stage": "run"}
    finally:
        shutil.rmtree(tmp, ignore_errors=True)
        _slots.release()