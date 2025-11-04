# scripts/create_user.py
import sys, os
sys.path.append(os.path.dirname(os.path.dirname(__file__)))

import argparse
from db.session import SessionLocal
from db import models as db_models
from core.security import hash_password as get_password_hash


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("email")
    parser.add_argument("password")
    parser.add_argument("--superuser", action="store_true")
    args = parser.parse_args()

    db = SessionLocal()
    try:
        user = db.query(db_models.User).filter(db_models.User.email == args.email).one_or_none()
        if user:
            # reset password
            user.hashed_password = get_password_hash(args.password)
            user.is_active = True
            if args.superuser:
                user.is_superuser = True
            db.add(user)
            db.commit()
            print(f"Updated user {user.email} (id={user.id})")
        else:
            # create new
            user = db_models.User(
                email=args.email,
                full_name=None,
                hashed_password=get_password_hash(args.password),
                is_active=True,
                is_superuser=bool(args.superuser),
            )
            db.add(user)
            db.commit()
            db.refresh(user)
            print(f"Created user {user.email} (id={user.id})")
    finally:
        db.close()

if __name__ == "__main__":
    main()
