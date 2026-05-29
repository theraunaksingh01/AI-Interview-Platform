from db.session import SessionLocal
from sqlalchemy import text
db = SessionLocal()

# Check tables
tables = db.execute(text("""
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name LIKE '%daily%'
""")).scalars().all()
print('Daily tables:', tables)

# Check user_progress for streak columns
cols = db.execute(text("""
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'user_progress'
""")).scalars().all()
print('user_progress cols:', cols)

# Check questions table sample
rows = db.execute(text("""
    SELECT id, question_text, type, topic, difficulty, role_tags, company_tags
    FROM questions LIMIT 5
""")).mappings().all()
for r in rows:
    print(r['id'], '|', r['topic'], '|', r['difficulty'], '|', r['role_tags'], '|', str(r['question_text'])[:60])

db.close()
