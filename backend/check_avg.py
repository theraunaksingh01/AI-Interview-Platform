from db.session import SessionLocal
from sqlalchemy import text
db = SessionLocal()
rows = db.execute(text("""
    SELECT overall_score FROM mock_sessions
    WHERE status = 'completed'
    AND overall_score IS NOT NULL
    ORDER BY completed_at ASC
""")).mappings().all()
scores = [float(r['overall_score']) for r in rows]
print('scores:', scores)
print('avg:', round(sum(scores)/len(scores), 2) if scores else None)
print('best:', max(scores) if scores else None)
db.close()
