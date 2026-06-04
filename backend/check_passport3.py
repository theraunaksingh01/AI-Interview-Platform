from db.session import SessionLocal
from sqlalchemy import text
db = SessionLocal()

# Check mock_sessions columns
ms_cols = db.execute(text("""
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'mock_sessions'
    ORDER BY ordinal_position
""")).scalars().all()
print('mock_sessions:', ms_cols)

# Check interview_answers columns
ia_cols = db.execute(text("""
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'interview_answers'
    ORDER BY ordinal_position
""")).scalars().all()
print('interview_answers:', ia_cols)

# Check user_progress columns
up_cols = db.execute(text("""
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'user_progress'
    ORDER BY ordinal_position
""")).scalars().all()
print('user_progress:', up_cols)

# Get actual session data
rows = db.execute(text("""
    SELECT ms.user_id, ms.overall_score, ms.role_target,
           ms.communication_score, ms.completed_at
    FROM mock_sessions ms
    WHERE ms.status = 'completed'
    AND ms.overall_score IS NOT NULL
    ORDER BY ms.completed_at DESC
    LIMIT 5
""")).mappings().all()
print('sessions:')
for r in rows:
    print(dict(r))

db.close()
