# backend/celery_app.py
import os
import sys
import logging
from dotenv import load_dotenv

logging.basicConfig(stream=sys.stdout, level=logging.INFO)
_log = logging.getLogger("env_loader")

# Candidate .env locations (in order)
#  - PROJECT_ROOT/.env
#  - BACKEND_DIR/.env
#  - current working directory .env
BASE_DIR = os.path.dirname(os.path.abspath(__file__))        # backend/
PROJECT_ROOT = os.path.dirname(BASE_DIR)                     # project root (parent of backend)
CWD = os.getcwd()

cand_paths = [
    os.path.join(PROJECT_ROOT, ".env"),
    os.path.join(BASE_DIR, ".env"),
    os.path.join(CWD, ".env"),
]

loaded_from = None
for p in cand_paths:
    try:
        if os.path.exists(p):
            load_dotenv(p, override=True)
            loaded_from = p
            _log.info(f"Loaded .env from: {p}")
            break
    except Exception as e:
        _log.exception("Failed to load .env from %s: %s", p, e)

# Fallback: try load_dotenv() (searches CWD+parents)
if not loaded_from:
    try:
        load_dotenv(override=False)
        _log.info("Called load_dotenv() fallback (no explicit path)")
    except Exception as e:
        _log.exception("Fallback load_dotenv() failed: %s", e)

_log.info(f"[ENV] AI_PROVIDER={os.getenv('AI_PROVIDER')}, OLLAMA_URL={os.getenv('OLLAMA_URL')}, OLLAMA_MODEL={os.getenv('OLLAMA_MODEL')}")
# ---------------------------------------------------------

from celery import Celery
from core.config import settings  # ← your pydantic Settings
import logging
import importlib.util
import os, sys, logging
from dotenv import load_dotenv





logger = logging.getLogger("celery_app")

BROKER = (
    getattr(settings, "celery_broker_url", None)
    or getattr(settings, "redis_url", None)
    or os.getenv("CELERY_BROKER_URL")
    or "redis://127.0.0.1:6379/0"
)
BACKEND = (
    getattr(settings, "celery_result_backend", None)
    or getattr(settings, "redis_url", None)
    or os.getenv("CELERY_RESULT_BACKEND")
    or BROKER
)

# Candidate task modules (edit as you add files)
CANDIDATE_MODULES = [
    "tasks.transcribe",
    "tasks.resume_tasks",
    "tasks.question_tasks",
    "tasks.score_interview",
    "tasks.score_question",
    "tasks.report_pdf",
    "tasks.code_grade",   # keep here if/when you add tasks/code_grade.py
]

def _module_exists(modname: str) -> bool:
    try:
        return importlib.util.find_spec(modname) is not None
    except Exception:
        return False

# Filter to only modules that can be imported from the current working directory / PYTHONPATH
INCLUDE_MODULES = [m for m in CANDIDATE_MODULES if _module_exists(m)]

missing = [m for m in CANDIDATE_MODULES if m not in INCLUDE_MODULES]
if missing:
    logger.warning("Celery will skip missing task modules: %s", missing)

app = Celery(
    "ai_interview_platform",
    broker=BROKER,
    backend=BACKEND,
    include=INCLUDE_MODULES,
)

# sensible dev defaults
app.conf.task_acks_late = True
app.conf.worker_prefetch_multiplier = 1
app.conf.broker_connection_retry_on_startup = True

# <-- IMPORTANT: enable result backend so AsyncResult and /interview/task/... work
app.conf.task_ignore_result = False
app.conf.result_backend = BACKEND
app.conf.result_expires = 3600 * 24
app.conf.result_extended = False

# Defensive import: try to import modules so their tasks register now and we get logs for any import errors.
def _ensure_imports():
    for m in INCLUDE_MODULES:
        try:
            __import__(m)
            logger.info("Imported tasks module: %s", m)
        except Exception as e:
            logger.exception("Failed to import tasks module '%s': %s", m, e)

_ensure_imports()
