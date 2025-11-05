# backend/core/request_id.py
import uuid
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.types import ASGIApp
from typing import Callable

HEADER = "X-Request-ID"

class RequestIDMiddleware(BaseHTTPMiddleware):
    def __init__(self, app: ASGIApp, header_name: str = HEADER):
        super().__init__(app)
        self.header_name = header_name

    async def dispatch(self, request, call_next: Callable):
        req_id = request.headers.get(self.header_name) or str(uuid.uuid4())
        # stash on scope so handlers/loggers can use it
        request.state.request_id = req_id
        response = await call_next(request)
        response.headers[self.header_name] = req_id
        return response
