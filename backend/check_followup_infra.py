from db.session import SessionLocal
from sqlalchemy import text
db = SessionLocal()
# Check if interruptions or follow_ups tables exist
tables = db.execute(text("""
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name IN ('interruptions','follow_ups','session_answers')
""")).scalars().all()
print('existing tables:', tables)

# Check what mock session flow uses for storing answers
cols = db.execute(text("""
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'interview_answers'
    ORDER BY ordinal_position
""")).scalars().all()
print('interview_answers cols:', cols)
db.close()
