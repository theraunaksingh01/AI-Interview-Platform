import json
from db.session import SessionLocal
from sqlalchemy import text

db = SessionLocal()

with open('quick_prep_concepts_batch1_dbms_os.json') as f:
    data = json.load(f)

concepts = data['concepts']
inserted = 0

for c in concepts:
    db.execute(
        text('''
            INSERT INTO quick_prep_concepts
                (concept_name, topic, subtopic, ask_prompt, good_answer_summary,
                 refresher_short, refresher_full, interview_edge_tip,
                 rapid_fire_prompt, rapid_fire_answer, key_terms, difficulty)
            VALUES
                (:name, :topic, :subtopic, :ask, :summary,
                 :short, :full, :edge,
                 :rf_prompt, :rf_answer, :terms, :diff)
        '''),
        {
            'name': c['concept_name'],
            'topic': c['topic'],
            'subtopic': c.get('subtopic'),
            'ask': c['ask_prompt'],
            'summary': c['good_answer_summary'],
            'short': c['refresher_short'],
            'full': c['refresher_full'],
            'edge': c.get('interview_edge_tip'),
            'rf_prompt': c.get('rapid_fire_prompt'),
            'rf_answer': c.get('rapid_fire_answer'),
            'terms': c.get('key_terms', []),
            'diff': c.get('difficulty', 'medium'),
        }
    )
    inserted += 1

db.commit()
print(f'Inserted {inserted} concepts')

# Verify
count = db.execute(text('SELECT COUNT(*) FROM quick_prep_concepts')).scalar()
topics = db.execute(text('SELECT topic, COUNT(*) FROM quick_prep_concepts GROUP BY topic')).fetchall()
print(f'Total in DB: {count}')
for t in topics:
    print(f'  {t[0]}: {t[1]}')

db.close()
