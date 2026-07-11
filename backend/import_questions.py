"""
Import questions.json into assessment_questions table.
Run from backend directory:
  python import_questions.py

Expects questions.json in the same directory.
"""
import json
import os
import sys
import psycopg2

DB_URL = os.environ.get("DATABASE_URL")
if not DB_URL:
    print("ERROR: DATABASE_URL not set")
    sys.exit(1)

with open("questions.json") as f:
    questions = json.load(f)

conn = psycopg2.connect(DB_URL)
cur = conn.cursor()

inserted = 0
skipped = 0

for q in questions:
    try:
        cur.execute("""
            INSERT INTO assessment_questions
                (question_text, question_type, section, topic,
                 options, correct_option, difficulty, explanation, is_active)
            VALUES (%s, 'mcq', %s, %s, %s, %s, %s, %s, TRUE)
        """, (
            q["question_text"],
            q["section"],
            q.get("topic"),
            json.dumps(q["options"]),
            q["correct_option"],
            q.get("difficulty", "medium"),
            q.get("explanation", ""),
        ))
        inserted += 1
    except Exception as e:
        print(f"Skipped question: {e}")
        skipped += 1

conn.commit()
cur.close()
conn.close()

print(f"Done: {inserted} inserted, {skipped} skipped")