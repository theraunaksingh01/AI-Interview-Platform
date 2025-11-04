import os
from celery import Celery

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")

celery_app = Celery(
    "ai_interview_platform",
    broker=REDIS_URL,
    backend=os.getenv("CELERY_RESULT_BACKEND", REDIS_URL),
    include=["tasks.transcribe"],
)

# sensible dev defaults
celery_app.conf.task_acks_late = True
celery_app.conf.worker_prefetch_multiplier = 1
celery_app.conf.broker_connection_retry_on_startup = True
celery_app.conf.task_ignore_result = True
celery_app.conf.result_extended = False
