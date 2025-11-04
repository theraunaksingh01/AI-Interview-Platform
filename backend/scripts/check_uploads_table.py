# scripts/check_uploads_table.py

import os, sys

# ensure parent dir (project root) is on sys.path
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

from db.session import SessionLocal
from db import models

db = SessionLocal()
try:
    print("Attempting query on Upload table...")
    print("Upload count:", db.query(models.Upload).count())
except Exception as e:
    import traceback
    traceback.print_exc()
finally:
    db.close()
