import os, json
from dotenv import load_dotenv
load_dotenv()

from db.session import SessionLocal
from sqlalchemy import text
from tasks.generate_coaching_report import _generate_coach_note, _claude_client

db = SessionLocal()

# Get the most recent completed session with questions
session = db.execute(text("""
    SELECT ms.id, ms.user_id, ms.role_target, ms.coaching_report
    FROM mock_sessions ms
    WHERE ms.status = 'completed'
    AND ms.overall_score IS NOT NULL
    AND ms.coaching_report IS NOT NULL
    ORDER BY ms.completed_at DESC
    LIMIT 1
""")).mappings().first()

if not session:
    print("No sessions found")
    db.close()
    exit()

print("Session:", str(session['id'])[:8], "Role:", session['role_target'])

# Extract question summaries from existing coaching_report
report = session['coaching_report']
if isinstance(report, str):
    report = json.loads(report)
questions = report.get('questions', []) if isinstance(report, dict) else []
print("Questions:", len(questions))

# Generate coach note
client = _claude_client()
note = _generate_coach_note(
    client=client,
    user_id=session['user_id'],
    current_session_id=str(session['id']),
    role_target=session['role_target'] or 'Software Engineer',
    current_summaries=questions,
    db=db,
)

print("Coach note generated:")
print(note)

if note:
    db.execute(
        text("UPDATE mock_sessions SET coach_note = :note WHERE id = CAST(:sid AS uuid)"),
        {"note": note, "sid": str(session['id'])},
    )
    db.commit()
    print("Stored successfully")
    print("Session ID:", str(session['id']))
    print("Report URL: http://localhost:3000/mock/report/" + str(session['id']))

db.close()
