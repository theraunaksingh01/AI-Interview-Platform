# backend/core/logging.py
import json
import logging
from typing import Any, Mapping

class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        payload: dict[str, Any] = {
            "level": record.levelname,
            "logger": record.name,
            "msg": record.getMessage(),
        }
        if record.exc_info:
            payload["exc_info"] = self.formatException(record.exc_info)
        # optional extra fields
        for key, val in getattr(record, "__dict__", {}).items():
            if key not in ("args", "msg", "levelname", "name", "exc_info"):
                # but skip private & huge objects
                if not key.startswith("_"):
                    payload[key] = val
        return json.dumps(payload, ensure_ascii=False)

def setup_json_logging(level: int = logging.INFO):
    root = logging.getLogger()
    root.handlers.clear()
    h = logging.StreamHandler()
    h.setFormatter(JsonFormatter())
    root.addHandler(h)
    root.setLevel(level)
