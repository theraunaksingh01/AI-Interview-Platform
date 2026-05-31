from db.session import SessionLocal
from sqlalchemy import text
db = SessionLocal()
row = db.execute(text("SELECT id, email, plan FROM users WHERE email = 'alice@example.com'")).mappings().first()
print('alice:', dict(row))
db.close()
