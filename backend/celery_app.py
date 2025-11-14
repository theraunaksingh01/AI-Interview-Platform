# backend/celery_app.py
from celery import Celery
from core.config import settings  # ← your pydantic Settings
import logging
import importlib.util

logger = logging.getLogger("celery_app")

BROKER = (
    getattr(settings, "celery_broker_url", None)
    or getattr(settings, "redis_url", None)
    or "redis://127.0.0.1:6379/0"
)
BACKEND = (
    getattr(settings, "celery_result_backend", None)
    or getattr(settings, "redis_url", None)
    or BROKER
)

# Candidate task modules (edit as you add files)
CANDIDATE_MODULES = [
    "tasks.transcribe",
    "tasks.resume_tasks",
    "tasks.question_tasks",
    "tasks.score_interview",
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
app.conf.task_ignore_result = True
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
