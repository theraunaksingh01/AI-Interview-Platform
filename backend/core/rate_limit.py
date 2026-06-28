# backend/core/rate_limit.py
"""
Rate limiting via slowapi (built on limits library).
Import `limiter` and apply @limiter.limit() to endpoints.
"""

from slowapi import Limiter
from slowapi.util import get_remote_address

# Key function: identify requests by IP address
limiter = Limiter(key_func=get_remote_address, default_limits=["200/minute"])