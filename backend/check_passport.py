from db.session import SessionLocal
from sqlalchemy import text
db = SessionLocal()
row = db.execute(text("""
    SELECT ms.user_id,
           COUNT(ms.id) as total_sessions,
           AVG(ms.overall_score) as avg_score,
           MAX(ms.overall_score) as best_score,
           MIN(ms.completed_at) as first_session,
           MAX(ms.completed_at) as last_session,
           up.streak_days, up.longest_streak
    FROM mock_sessions ms
    LEFT JOIN user_progress up ON up.user_id = ms.user_id
    WHERE ms.status = 'completed'
    AND ms.overall_score IS NOT NULL
    GROUP BY ms.user_id, up.streak_days, up.longest_streak
    LIMIT 3
""")).mappings().all()
for r in rows:
    print(dict(r))
db.close()
