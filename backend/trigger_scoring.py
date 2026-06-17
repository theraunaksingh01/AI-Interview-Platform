from celery_app import app as celery_app
from db.session import SessionLocal
from sqlalchemy import text

db = SessionLocal()
interview_id = '68f4cade-8083-4ecb-ab37-28daf124a425'

# Get all turn ids for this interview
turns = db.execute(text('''
    SELECT id FROM interview_turns WHERE interview_id = :iid AND speaker = 'candidate'
'''), {'iid': interview_id}).fetchall()

print('Found', len(turns), 'turns to score')

from tasks.live_scoring import score_turn
for t in turns:
    score_turn.delay(t[0])
    print('Queued scoring for turn', t[0])

db.close()
