from db.session import SessionLocal
from sqlalchemy import text
import uuid

db = SessionLocal()

interview_id = '68f4cade-8083-4ecb-ab37-28daf124a425'
session_id = '8b7638b8-b654-40b9-8674-565f3acef92f'

questions = db.execute(text('''
    SELECT id, question_text, position FROM interview_questions
    WHERE interview_id = :iid ORDER BY position
'''), {'iid': interview_id}).mappings().all()

# Realistic-ish fake answers per question, mix of good and weak
fake_answers = [
    'I am a software engineer with experience across full stack development, cloud infrastructure, and DevOps automation. I worked at Microsoft and Amazon building tools that improved developer productivity. I am drawn to backend engineering because I enjoy solving problems around scale, reliability, and system design.',
    'The DevOps LLM Bot reads pull request context and generates CI workflow YAML files automatically using a language model. It integrates with the GitHub Actions API and reduces the time developers spend writing boilerplate CI configuration.',
    'The hardest part was handling cases where the LLM generated invalid YAML syntax. I added a validation layer that checks the generated workflow against GitHub Actions schema before committing it, and if it fails validation we fall back to a template.',
    'The solution uses Azure AD for authentication, KeyVault to store secrets, VNet to isolate network traffic, and APIM to expose a secure API gateway. Access control is enforced through Azure AD roles.',
    'We used Redis for caching frequently accessed credential metadata so we did not have to hit KeyVault for every request, since KeyVault has rate limits. CosmosDB stored audit logs of every access event.',
    'I designed the overall architecture and made the key decisions about which Azure services to use. I worked with two other engineers who helped implement the API layer while I focused on the security model.',
    'As a Technology Consultant I worked across IoT device provisioning and cloud governance policies, mostly using Azure Policy and Azure Resource Manager templates to enforce compliance across teams.',
    'I want to focus more deeply on backend systems and distributed systems specifically. My past roles touched many areas but I want to specialize in building scalable backend services.',
]

for q, answer in zip(questions, fake_answers):
    # Insert interview_turns (what ws_interview normally creates)
    db.execute(text('''
        INSERT INTO interview_turns (interview_id, question_id, speaker, transcript, started_at, ended_at)
        VALUES (:iid, :qid, 'candidate', :transcript, now(), now())
    '''), {'iid': interview_id, 'qid': q['id'], 'transcript': answer})

    # Insert interview_answers directly too (some flows read from here)
    db.execute(text('''
        INSERT INTO interview_answers (interview_question_id, transcript)
        VALUES (:qid, :transcript)
        ON CONFLICT DO NOTHING
    '''), {'qid': q['id'], 'transcript': answer})

db.commit()
print('Inserted', len(questions), 'fake answers')

# Mark interview and session as completed
db.execute(text('''
    UPDATE interviews SET status = 'completed' WHERE id = :iid
'''), {'iid': interview_id})

db.execute(text('''
    UPDATE mock_sessions SET status = 'completed', completed_at = now() WHERE id = :sid
'''), {'sid': session_id})

db.commit()
print('Marked session as completed')

db.close()
