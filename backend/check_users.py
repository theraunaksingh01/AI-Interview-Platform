from db.session import SessionLocal
from sqlalchemy import text
db = SessionLocal()
cols = db.execute(text("""
    SELECT column_name, data_type 
    FROM information_schema.columns
    WHERE table_name = 'users'
    ORDER BY ordinal_position
""")).mappings().all()
for c in cols:
    print(c['column_name'], '-', c['data_type'])
db.close()
