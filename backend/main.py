# backend/main.py
"""
Defensive FastAPI startup: try to include real routers but never crash the whole app.
If an import fails, the exception is captured and exposed at /__startup_error for easy debugging.
"""
import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from api import ops as ops_router
from core.request_id import RequestIDMiddleware
from core.logging import setup_json_logging
from api import responses
from db.init_db import init_db
from db.session import Base, engine
from db import models as db_models        
from models.responses import Responses
from api import transcribe
from api import uploads_me, uploads
from api import transcribe_upload
from api import score




app = FastAPI(title="AI Interview Platform API")

app.include_router(ops_router.router)

app.include_router(responses.router)

app.include_router(transcribe.router)

app.include_router(transcribe_upload.router)

app.include_router(score.router)


app.include_router(uploads.router)

app.include_router(uploads_me.router)

init_db()


app.add_middleware(RequestIDMiddleware)

setup_json_logging()

Base.metadata.create_all(bind=engine)



# Read CORS env (simple comma-separated fallback)
cors_env = os.getenv("CORS_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000")
if cors_env.strip().startswith("["):
    try:
        # allow JSON style
        import json
        ALLOWED_ORIGINS = json.loads(cors_env)
    except Exception:
        ALLOWED_ORIGINS = [s.strip() for s in cors_env.strip("[]").split(",") if s.strip()]
else:
    ALLOWED_ORIGINS = [s.strip() for s in cors_env.split(",") if s.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Minimal endpoints (always present)
@app.get("/health")
def health():
    return {"ok": True}

# Demo uploads route (keeps UI from blocking)
@app.get("/uploads")
def list_uploads_demo():
    return [
        {"id": 1, "filename": "demo_resume.pdf", "status": "done"},
        {"id": 2, "filename": "example.mp4", "status": "processing"},
    ]

# Storage for a startup/import error if any
_startup_import_error = None

# Attempt to import & include your real routers. Do this inside try/except so failure
# doesn't kill the app; instead we capture the error and expose it at /__startup_error.
try:
    # Import routers (these should exist in your project)
    from api.roles import router as roles_router
    from api import auth as auth_router
    from api import uploads as uploads_router
    from api import uploads_proxy as uploads_proxy_router
    from api import uploads_me as uploads_me_router

    # Include them unconditionally
    app.include_router(roles_router)
    app.include_router(auth_router.router)
    app.include_router(uploads_router.router)
    app.include_router(uploads_proxy_router.router)
    app.include_router(uploads_me_router.router)

except Exception as exc:  # capture import/startup error for diagnostics
    _startup_import_error = exc

@app.get("/__startup_error")
def startup_error():
    """
    If the automatic router import failed, this returns the exception repr for fast debugging.
    """
    if _startup_import_error is None:
        return {"ok": True, "error": None}
    return {
        "ok": False,
        "error": repr(_startup_import_error),
        "type": type(_startup_import_error).__name__,
    }
