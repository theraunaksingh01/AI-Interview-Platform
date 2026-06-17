from db.session import SessionLocal
from sqlalchemy import text
db = SessionLocal()
row = db.execute(text("""
    SELECT pg_get_constraintdef(oid)
    FROM pg_constraint
    WHERE conname = 'mock_sessions_session_type_check'
""")).scalar()
print('Constraint:', row)
db.close()
