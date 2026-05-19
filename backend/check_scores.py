from db.session import SessionLocal
from sqlalchemy import text
db = SessionLocal()
rows = db.execute(text("""
    SELECT id, overall_score, communication_score, completed_at
    FROM mock_sessions
    WHERE status = 'completed'
    ORDER BY completed_at DESC
    LIMIT 5
""")).mappings().all()
for r in rows:
    print(r['id'], '| overall:', r['overall_score'], '| comm:', r['communication_score'])
db.close()
