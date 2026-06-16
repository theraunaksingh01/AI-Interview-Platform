from db.session import SessionLocal
from sqlalchemy import text
db = SessionLocal()

# Topics and counts
rows = db.execute(text("""
    SELECT topic, subtopic, COUNT(*) as count
    FROM quick_prep_concepts
    GROUP BY topic, subtopic
    ORDER BY topic, subtopic
""")).fetchall()
print('Concepts by topic/subtopic:')
for r in rows:
    print(f'  {r[0]} / {r[1]}: {r[2]}')

# Check if topic_practice tables exist
tables = db.execute(text("""
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name LIKE '%topic_practice%'
""")).scalars().all()
print('Topic practice tables:', tables)

db.close()
