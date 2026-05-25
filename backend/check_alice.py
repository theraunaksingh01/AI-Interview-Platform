from db.session import SessionLocal
from sqlalchemy import text
db = SessionLocal()
row = db.execute(text("SELECT id, email, plan, plan_expires FROM users WHERE email = 'alice@example.com'")).mappings().first()
print(dict(row))
db.close()
