from db.session import SessionLocal
from sqlalchemy import text
db = SessionLocal()
rows = db.execute(text("""
    SELECT ms.id as sid, ms.overall_score as ms_overall,
           i.overall_score as i_overall, i.status
    FROM mock_sessions ms
    JOIN interviews i ON i.mock_session_id = ms.id
    WHERE ms.status = 'completed'
    ORDER BY ms.completed_at DESC
    LIMIT 5
""")).mappings().all()
for r in rows:
    print('session:', r['sid'], '| ms.overall:', r['ms_overall'], '| interview.overall:', r['i_overall'], '| status:', r['status'])
db.close()
