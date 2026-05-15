from db.session import SessionLocal
from sqlalchemy import text
db = SessionLocal()

row = db.execute(text("SELECT coaching_report, specific_fix FROM mock_sessions WHERE id = '87d267c4-c5da-4af3-a372-13ee41087dea'")).mappings().first()
print('coaching_report:', row['coaching_report'])
print('specific_fix:', row['specific_fix'])

rows = db.execute(text("""
    SELECT iq.question_text, ia.transcript, s.overall_score
    FROM interviews i
    JOIN interview_questions iq ON iq.interview_id = i.id
    LEFT JOIN interview_scores s ON s.question_id = iq.id
    LEFT JOIN interview_answers ia ON ia.interview_question_id = iq.id
    WHERE i.mock_session_id = '87d267c4-c5da-4af3-a372-13ee41087dea'
    ORDER BY iq.position
""")).mappings().all()
for r in rows:
    print('Q:', r['question_text'][:50], '| score:', r['overall_score'], '| transcript:', str(r['transcript'])[:40])
db.close()
