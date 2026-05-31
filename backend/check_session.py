from db.session import SessionLocal
from sqlalchemy import text
db = SessionLocal()

# Check if session exists in mock_sessions
row = db.execute(text("""
    SELECT ms.id, ms.status, ms.overall_score, ms.user_id,
           i.id as interview_id, i.overall_score as i_score
    FROM mock_sessions ms
    LEFT JOIN interviews i ON i.mock_session_id = ms.id
    WHERE ms.id = '44f08521-ead1-4832-b308-789084811f76'
""")).mappings().first()
print('mock_session:', dict(row) if row else 'NOT FOUND')

# Check LIVE_VOICE_PROMPT has calibration
db.close()
