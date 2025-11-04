# backend/celery_app.py
from celery import Celery
from core.config import settings  # ← use your pydantic Settings

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

app = Celery(
    "ai_interview_platform",
    broker=BROKER,
    backend=BACKEND,
    include=["tasks.transcribe"],  # keep your module path
)

# sensible dev defaults
app.conf.task_acks_late = True
app.conf.worker_prefetch_multiplier = 1
app.conf.broker_connection_retry_on_startup = True
app.conf.task_ignore_result = True
app.conf.result_extended = False
