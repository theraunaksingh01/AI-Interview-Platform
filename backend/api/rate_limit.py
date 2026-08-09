# backend/api/rate_limit.py
# Simple in-memory rate limiting for sensitive endpoints
# For production, replace with Redis-backed rate limiting

import time
from collections import defaultdict
from fastapi import HTTPException, Request
from functools import wraps

# In-memory store: {key: [(timestamp, count)]}
_rate_store: dict[str, list[float]] = defaultdict(list)

def rate_limit(max_requests: int, window_seconds: int, key_func=None):
    """
    Rate limit decorator for FastAPI endpoints.
    
    Usage:
        @router.post("/login")
        @rate_limit(max_requests=5, window_seconds=60)
        async def login(request: Request, ...):
    
    Args:
        max_requests: Maximum requests allowed in window
        window_seconds: Time window in seconds
        key_func: Optional function to extract rate limit key from request
                  Default: client IP address
    """
    def decorator(func):
        @wraps(func)
        async def wrapper(request: Request, *args, **kwargs):
            # Get rate limit key
            if key_func:
                key = key_func(request)
            else:
                # Use IP address as default key
                forwarded = request.headers.get("X-Forwarded-For")
                ip = forwarded.split(",")[0] if forwarded else request.client.host
                key = f"{func.__name__}:{ip}"

            now = time.time()
            window_start = now - window_seconds

            # Clean old entries
            _rate_store[key] = [t for t in _rate_store[key] if t > window_start]

            # Check limit
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

            # Record request
            _rate_store[key].append(now)
            return await func(request, *args, **kwargs)

        return wrapper
    return decorator


# ── Pre-configured limiters for common use cases ──────────────────────────────

def login_rate_limit():
    """5 attempts per minute per IP — prevents brute force."""
    return rate_limit(max_requests=5, window_seconds=60)

def code_execution_rate_limit():
    """10 code submissions per minute per IP — prevents abuse."""
    return rate_limit(max_requests=10, window_seconds=60)

def assessment_rate_limit():
    """3 assessment starts per hour per IP — prevents scraping."""
    return rate_limit(max_requests=3, window_seconds=3600)

def transcribe_rate_limit():
    """20 transcriptions per minute per IP — prevents Whisper abuse."""
    return rate_limit(max_requests=20, window_seconds=60)