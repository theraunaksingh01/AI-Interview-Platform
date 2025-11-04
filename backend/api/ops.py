# backend/api/ops.py
from fastapi import APIRouter
import redis, os

router = APIRouter(prefix="/ops", tags=["ops"])

@router.get("/queue")
def queue_status():
    url = os.getenv("REDIS_URL", "redis://127.0.0.1:6379/0")
    try:
        r = redis.Redis.from_url(url, socket_connect_timeout=0.5)
        r.ping()
        return {"redis": "online"}
    except Exception:
        return {"redis": "offline"}
