from db.session import SessionLocal
from sqlalchemy import text
db = SessionLocal()
cols = db.execute(text("""
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'mock_sessions'
    AND column_name = 'coach_note'
""")).scalars().all()
print('coach_note exists:', cols)
db.close()
