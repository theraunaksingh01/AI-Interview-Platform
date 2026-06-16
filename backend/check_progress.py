from db.session import SessionLocal
from sqlalchemy import text
db = SessionLocal()
cols = db.execute(text("""
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'user_progress'
    ORDER BY ordinal_position
""")).scalars().all()
print('user_progress cols:', cols)
db.close()
