# scripts/create_user_and_attach_role.py
# Usage: python scripts/create_user_and_attach_role.py alice@example.com S3cr3tPa$$ admin
import os, sys
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import sys
from db.session import SessionLocal
from db import models
from core.security import hash_password  # ensure you have core/security.py (from earlier step)

def main(email, plain_password, role_name="user"):
    db = SessionLocal()
    try:
        # create or get role
        role = db.query(models.Role).filter(models.Role.title == role_name).first()
        if not role:
            role = models.Role(title=role_name, level="n/a", jd_text=f"auto-created role {role_name}")
            db.add(role)
            db.commit()
            db.refresh(role)

        # create user
        user = db.query(models.User).filter(models.User.email == email).first()
        if user:
            print("User already exists:", user.email)
        else:
            hashed = hash_password(plain_password)
            user = models.User(email=email, hashed_password=hashed, full_name=None)
            user.roles.append(role)
            db.add(user)
            db.commit()
            db.refresh(user)
            print("Created user:", user.email, "id:", user.id)
    finally:
        db.close()

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python scripts/create_user_and_attach_role.py <email> <password> [role]")
    else:
        email = sys.argv[1]
        pw = sys.argv[2]
        role = sys.argv[3] if len(sys.argv) > 3 else "user"
        main(email, pw, role)
