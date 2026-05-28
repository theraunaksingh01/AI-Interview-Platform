from db.session import SessionLocal
from sqlalchemy import text
db = SessionLocal()
tables = db.execute(text("""
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public'
    ORDER BY table_name
""")).scalars().all()
for t in tables:
    print(t)
db.close()
