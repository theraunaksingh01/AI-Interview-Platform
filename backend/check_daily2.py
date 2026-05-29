from db.session import SessionLocal
from sqlalchemy import text
db = SessionLocal()
rows = db.execute(text("""
    SELECT id, scheduled_date, topic, difficulty, company_tag,
           LEFT(question_text, 60) as q
    FROM daily_questions
    ORDER BY scheduled_date ASC
""")).mappings().all()
for r in rows:
    print(r['scheduled_date'], '|', r['topic'], '|', r['difficulty'], '|', r['company_tag'], '|', r['q'])
db.close()
