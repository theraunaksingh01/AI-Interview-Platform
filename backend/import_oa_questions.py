"""
Import OA questions from JSON file into oa_questions table.

Usage:
  cd backend
  $env:DATABASE_URL = "postgresql://postgres:password@localhost:5432/ai_interview"
  python import_oa_questions.py oa_questions_20260711_123456.json
"""
import json
import os
import sys
import psycopg2

if len(sys.argv) < 2:
    print("Usage: python import_oa_questions.py <filename.json>")
    sys.exit(1)

filename = sys.argv[1]
db_url = os.environ.get("DATABASE_URL", "").replace("postgresql+psycopg2://", "postgresql://")

if not db_url:
    print("ERROR: DATABASE_URL not set")
    sys.exit(1)

with open(filename) as f:
    questions = json.load(f)

conn = psycopg2.connect(db_url)
cur = conn.cursor()

inserted = 0
skipped = 0

for q in questions:
    try:
        cur.execute("""
            INSERT INTO oa_questions
                (question_text, question_type, company, section, topic,
                 options, correct_option, difficulty, explanation, is_active)
            VALUES (%s, 'mcq', %s, %s, %s, %s, %s, %s, %s, TRUE)
        """, (
            q["question_text"],
            q.get("company", "tcs"),
            q.get("section", "numerical"),
            q.get("topic"),
            json.dumps(q["options"]),
            q["correct_option"],
            q.get("difficulty", "medium"),
            q.get("explanation", ""),
        ))
        inserted += 1
    except Exception as e:
        print(f"Skipped: {e}")
        skipped += 1

conn.commit()
cur.close()
conn.close()

print(f"Done: {inserted} inserted, {skipped} skipped")

# Show current counts
conn2 = psycopg2.connect(db_url)
cur2 = conn2.cursor()
cur2.execute("SELECT company, section, COUNT(*) FROM oa_questions GROUP BY company, section ORDER BY company, section")
rows = cur2.fetchall()
cur2.close()
conn2.close()

print("\nCurrent OA question counts:")
for company, section, count in rows:
    status = "✓ Good" if count >= 50 else f"Need {50 - count} more"
    print(f"  {company}/{section}: {count} ({status})")