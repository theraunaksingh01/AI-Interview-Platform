from db.session import SessionLocal
from sqlalchemy import text
db = SessionLocal()

# Check resume_prep_sessions row
row = db.execute(text('''
    SELECT mock_session_id, resume_data FROM resume_prep_sessions
    WHERE mock_session_id = '8b7638b8-b654-40b9-8674-565f3acef92f'
''')).mappings().first()
print('resume_prep_sessions row exists:', row is not None)

# Check the transcript query exactly as resume_prep.py runs it
rows = db.execute(text('''
    SELECT iq.question_text, iq.topic, ia.transcript
    FROM interviews i
    JOIN interview_questions iq ON iq.interview_id = i.id
    LEFT JOIN interview_answers ia ON ia.interview_question_id = iq.id
    WHERE i.mock_session_id = CAST('8b7638b8-b654-40b9-8674-565f3acef92f' AS uuid)
    ORDER BY iq.position ASC
''')).mappings().all()
print('Questions found:', len(rows))
for r in rows[:3]:
    print('  transcript present:', r['transcript'] is not None, '-', (r['transcript'] or '')[:50])

db.close()
