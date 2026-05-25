from db.session import SessionLocal
from sqlalchemy import text
db = SessionLocal()

# Check columns
cols = db.execute(text("""
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'questions'
    ORDER BY ordinal_position
""")).mappings().all()
for c in cols:
    print(c['column_name'], '-', c['data_type'])

print('---')

# Check sample data
rows = db.execute(text("""
    SELECT role_tags, company_tags, difficulty, topic, COUNT(*) as count 
    FROM questions 
    GROUP BY role_tags, company_tags, difficulty, topic
    LIMIT 20
""")).mappings().all()
for r in rows:
    print(r['role_tags'], '|', r['company_tags'], '|', r['difficulty'], '|', r['topic'], '|', r['count'])
db.close()
