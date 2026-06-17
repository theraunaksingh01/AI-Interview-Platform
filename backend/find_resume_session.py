from db.session import SessionLocal
from sqlalchemy import text
db = SessionLocal()

# Find your resume_prep session
session = db.execute(text('''
    SELECT ms.id as session_id, i.id as interview_id
    FROM mock_sessions ms
    JOIN interviews i ON i.mock_session_id = ms.id
    WHERE ms.session_type = 'resume_prep'
    ORDER BY ms.created_at DESC
    LIMIT 1
''')).mappings().first()

print('Session:', session['session_id'])
print('Interview:', session['interview_id'])

# Get the questions
questions = db.execute(text('''
    SELECT id, question_text, position FROM interview_questions
    WHERE interview_id = :iid ORDER BY position
'''), {'iid': session['interview_id']}).mappings().all()

for q in questions:
    print(q['position'], '-', q['question_text'][:80])

db.close()
