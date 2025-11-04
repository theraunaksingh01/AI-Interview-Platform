# scripts/check_db.py
import os, sys
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

from db.session import SessionLocal
from db import models

def main():
    db = SessionLocal()
    users = db.query(models.User).all()
    print("Users:")
    for u in users:
        roles = [r.title for r in u.roles]
        print(f"  id={u.id} email={u.email} roles={roles} is_active={getattr(u,'is_active',None)} is_superuser={getattr(u,'is_superuser',None)}")
    print("\nRoles:")
    roles = db.query(models.Role).all()
    for r in roles:
        print(f"  id={r.id} title={r.title} level={r.level}")
    db.close()

if __name__ == "__main__":
    main()
