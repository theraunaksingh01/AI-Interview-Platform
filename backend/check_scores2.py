from db.session import SessionLocal
from sqlalchemy import text
db = SessionLocal()

# Check both tables for this session
rows = db.execute(text("""
    SELECT ms.id as session_id, ms.overall_score as ms_score,
           i.id as interview_id, i.overall_score as i_score
    FROM mock_sessions ms
    JOIN interviews i ON i.mock_session_id = ms.id
    WHERE ms.status = 'completed'
    ORDER BY ms.completed_at DESC
    LIMIT 3
""")).mappings().all()
for r in rows:
    print(f"session: {str(r['session_id'])[:8]} | ms.score: {r['ms_score']} | i.score: {r['i_score']}")
db.close()
