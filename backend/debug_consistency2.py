from db.session import SessionLocal
from sqlalchemy import text
import json

db = SessionLocal()

resume_row = db.execute(text('''
    SELECT resume_data FROM resume_prep_sessions
    WHERE mock_session_id = CAST('8b7638b8-b654-40b9-8674-565f3acef92f' AS uuid)
''')).mappings().first()

resume_data = resume_row['resume_data']
if isinstance(resume_data, str):
    resume_data = json.loads(resume_data)

rows = db.execute(text('''
    SELECT iq.question_text, iq.topic, ia.transcript
    FROM interviews i
    JOIN interview_questions iq ON iq.interview_id = i.id
    LEFT JOIN interview_answers ia ON ia.interview_question_id = iq.id
    WHERE i.mock_session_id = CAST('8b7638b8-b654-40b9-8674-565f3acef92f' AS uuid)
    ORDER BY iq.position ASC
''')).mappings().all()

qa_pairs = chr(10).join(
    f\"Q: {r['question_text']}\nA: {(r['transcript'] or '')[:400]}\"
    for r in rows if r['transcript']
)
print('qa_pairs length:', len(qa_pairs))

from api.resume_prep import _claude_client, _strip_json_fence

projects_text = chr(10).join(
    f\"- {p.get('name')}: {', '.join(p.get('tech_stack', []))} — {p.get('description', '')}\"
    for p in resume_data.get('projects', [])
)

prompt = f'''Compare what this candidate's resume claims against what they actually said in their interview.

RESUME CLAIMS:
{projects_text}
Skills: {', '.join(resume_data.get('skills', []))}

INTERVIEW TRANSCRIPT:
{qa_pairs[:3000]}

Evaluate consistency. Return ONLY valid JSON, no markdown:
{{\"consistency_score\": <0-100>, \"summary\": \"...\", \"gaps\": [\"...\"]}}'''

try:
    client = _claude_client()
    response = client.messages.create(
        model='claude-haiku-4-5-20251001',
        max_tokens=400,
        messages=[{'role': 'user', 'content': prompt}],
    )
    raw = ''
    for block in getattr(response, 'content', []):
        if getattr(block, 'type', '') == 'text':
            raw += getattr(block, 'text', '')
    print('RAW RESPONSE:')
    print(raw)
    parsed = json.loads(_strip_json_fence(raw))
    print('PARSED OK:', parsed)
except Exception as e:
    import traceback
    print('EXCEPTION:', e)
    traceback.print_exc()

db.close()
