from db.session import SessionLocal
from sqlalchemy import text
db = SessionLocal()
rows = db.execute(text("""
    SELECT DISTINCT unnest(company_tags) as company, COUNT(*) as count
    FROM questions
    WHERE company_tags != '{}'
    GROUP BY company
    ORDER BY count DESC
""")).mappings().all()
for r in rows:
    print(r['company'], '-', r['count'])
db.close()
