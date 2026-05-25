from db.session import SessionLocal
from sqlalchemy import text
db = SessionLocal()
rows = db.execute(text("SELECT DISTINCT role_tag, COUNT(*) as count FROM questions GROUP BY role_tag ORDER BY count DESC")).mappings().all()
for r in rows:
    print(r['role_tag'], '-', r['count'])
db.close()
