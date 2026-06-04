from db.session import SessionLocal
from sqlalchemy import text
db = SessionLocal()
rows = db.execute(text("""
    SELECT ms.id, ms.overall_score,
           ms.role_target, ms.seniority,
           ia.technical_accuracy, ia.communication_clarity,
           ia.problem_solving, ia.depth_of_knowledge
    FROM mock_sessions ms
    LEFT JOIN interview_answers ia ON ia.interview_id = (
        SELECT id FROM interviews WHERE mock_session_id = ms.id LIMIT 1
    )
    WHERE ms.status = 'completed'
    AND ms.overall_score IS NOT NULL
    LIMIT 3
""")).mappings().all()
for r in rows:
    print(dict(r))
db.close()
