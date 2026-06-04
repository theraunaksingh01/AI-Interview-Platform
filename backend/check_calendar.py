from db.session import SessionLocal
from sqlalchemy import text
db = SessionLocal()
tables = db.execute(text("""
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name LIKE '%calendar%'
""")).scalars().all()
print('Calendar tables:', tables)

# Check user table for any interview_date column
cols = db.execute(text("""
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'users' AND column_name LIKE '%interview%'
""")).scalars().all()
print('User interview cols:', cols)
db.close()
