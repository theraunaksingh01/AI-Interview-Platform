from db.session import SessionLocal
from sqlalchemy import text
db = SessionLocal()
cols = db.execute(text("""
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'interview_questions'
    ORDER BY ordinal_position
""")).scalars().all()
print(cols)
db.close()
