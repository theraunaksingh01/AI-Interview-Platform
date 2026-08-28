# backend/api/rate_limit.py
# REWRITTEN — uses FastAPI's native Depends() pattern instead of a decorator.
# This composes correctly with FastAPI's schema generation regardless of
# what parameter types (File, Pydantic models, Query, etc.) the endpoint uses,
# since Depends() is a first-class FastAPI concept, not a generic wrapper
# that confuses Pydantic's introspection.

import time
from collections import defaultdict
from fastapi import HTTPException, Request

_rate_store: dict[str, list[float]] = defaultdict(list)


def _check_rate_limit(request: Request, max_requests: int, window_seconds: int, name: str):
    forwarded = request.headers.get("X-Forwarded-For")
    ip = forwarded.split(",")[0] if forwarded else request.client.host
    key = f"{name}:{ip}"

    now = time.time()
    window_start = now - window_seconds
    _rate_store[key] = [t for t in _rate_store[key] if t > window_start]

    if len(_rate_store[key]) >= max_requests:
        oldest = min(_rate_store[key])
        retry_after = int(window_seconds - (now - oldest)) + 1
        raise HTTPException(
            status_code=429,
            detail={
                "error": "rate_limit_exceeded",
                "message": f"Too many requests. Try again in {retry_after} seconds.",
                "retry_after": retry_after,
            },
            headers={"Retry-After": str(retry_after)},
        )

    _rate_store[key].append(now)


# ── Dependency factories ────────────────────────────────────────────────────
# Usage in an endpoint:
#
#   @router.post("/register")
#   def register(payload: RegisterPayload, db=Depends(get_db), _rl=Depends(login_rate_limit_dep)):
#       ...
#
# The _rl parameter name doesn't matter — FastAPI just needs it declared as
# a Depends() so the check runs before the endpoint body executes.

def login_rate_limit_dep(request: Request):
    _check_rate_limit(request, max_requests=5, window_seconds=60, name="login")


def code_execution_rate_limit_dep(request: Request):
    _check_rate_limit(request, max_requests=10, window_seconds=60, name="code_exec")


def assessment_rate_limit_dep(request: Request):
    _check_rate_limit(request, max_requests=3, window_seconds=3600, name="assessment")


def transcribe_rate_limit_dep(request: Request):
    _check_rate_limit(request, max_requests=20, window_seconds=60, name="transcribe")


def referral_claim_rate_limit_dep(request: Request):
    _check_rate_limit(request, max_requests=5, window_seconds=3600, name="referral_claim")


def oa_start_rate_limit_dep(request: Request):
    _check_rate_limit(request, max_requests=10, window_seconds=3600, name="oa_start")


def oa_submit_rate_limit_dep(request: Request):
    _check_rate_limit(request, max_requests=30, window_seconds=3600, name="oa_submit")


def peer_room_rate_limit_dep(request: Request):
    _check_rate_limit(request, max_requests=10, window_seconds=3600, name="peer_room")