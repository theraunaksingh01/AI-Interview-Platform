# backend/api/runner_client.py
"""
Client for the isolated code-runner service.
The main backend sends code over HTTP and gets output back. Student code never
runs inside the main backend process or environment.

Env vars on the MAIN backend:
  RUNNER_URL    e.g. http://runner.railway.internal:8080   (private network)
  RUNNER_TOKEN  same value as on the runner service
"""
from __future__ import annotations

import os

import httpx

RUNNER_URL = os.getenv("RUNNER_URL", "").rstrip("/")
RUNNER_TOKEN = os.getenv("RUNNER_TOKEN", "")


class RunnerUnavailable(Exception):
    pass


def run_remote(language: str, code: str, stdin: str = "", time_limit: float = 5.0) -> dict:
    """
    Returns {stdout, stderr, returncode, timed_out, truncated, stage}.
    Raises RunnerUnavailable if the runner is down, busy or misconfigured.
    """
    if not RUNNER_URL or not RUNNER_TOKEN:
        raise RunnerUnavailable("runner_not_configured")
    try:
        r = httpx.post(
            f"{RUNNER_URL}/run",
            json={"language": language, "code": code, "stdin": stdin, "time_limit": time_limit},
            headers={"X-Runner-Token": RUNNER_TOKEN},
            timeout=time_limit + 30,  # compile time + queueing
        )
    except httpx.HTTPError as e:
        raise RunnerUnavailable(f"runner_unreachable: {e.__class__.__name__}")
    if r.status_code == 429:
        raise RunnerUnavailable("runner_busy")
    if r.status_code != 200:
        raise RunnerUnavailable(f"runner_error_{r.status_code}")
    return r.json()