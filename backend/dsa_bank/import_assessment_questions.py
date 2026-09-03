# import_assessment_questions.py
# Imports MCQ questions into the assessment_questions table.
# Matches the real schema: question_text, question_type, section, topic,
# options (jsonb), correct_option, difficulty, explanation.
#
# Usage: python import_assessment_questions.py <file.json>
# Run from backend/dsa_bank/

import json
import sys
import os
import psycopg2
from psycopg2.extras import Json


def load_env():
    env_path = os.path.join(os.path.dirname(__file__), '..', '.env')
    if os.path.exists(env_path):
        with open(env_path, encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#') and '=' in line:
                    key, value = line.split('=', 1)
                    os.environ.setdefault(key.strip(), value.strip())


load_env()


def get_db_connection():
    db_url = os.getenv("DATABASE_URL", "")
    db_url = db_url.replace("postgresql+psycopg2://", "postgresql://")
    db_url = db_url.replace("postgresql+asyncpg://", "postgresql://")
    if db_url:
        return psycopg2.connect(db_url)
    return psycopg2.connect(
        host=os.getenv("DB_HOST", "localhost"),
        port=os.getenv("DB_PORT", "5432"),
        dbname=os.getenv("DB_NAME", "ai_interview"),
        user=os.getenv("DB_USER", "postgres"),
        password=os.getenv("DB_PASSWORD", "")
    )


def import_questions(filepath):
    with open(filepath, encoding='utf-8') as f:
        questions = json.load(f)

    conn = get_db_connection()
    cur = conn.cursor()

    imported = 0
    skipped = 0
    failed = 0

    for q in questions:
        question_text = q.get('question_text', '').strip()
        if not question_text:
            continue

        # Check for duplicate
        cur.execute(
            "SELECT id FROM assessment_questions WHERE question_text = %s",
            (question_text,)
        )
        if cur.fetchone():
            skipped += 1
            continue

        try:
            cur.execute("""
                INSERT INTO assessment_questions
                    (question_text, question_type, section, topic,
                     options, correct_option, difficulty, explanation, is_active)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, TRUE)
            """, (
                question_text,
                q.get('question_type', 'mcq'),
                q.get('section'),
                q.get('topic'),
                Json(q.get('options', [])),
                q.get('correct_option'),
                q.get('difficulty', 'medium'),
                q.get('explanation', ''),
            ))
            imported += 1
        except Exception as e:
            conn.rollback()
            print(f"FAILED: {question_text[:50]} - {e}")
            failed += 1
            continue

        conn.commit()

    cur.close()
    conn.close()

    print(f"\n{'='*50}")
    print(f"New questions imported: {imported}")
    print(f"Already existed (skipped): {skipped}")
    print(f"Failed: {failed}")
    print(f"{'='*50}")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python import_assessment_questions.py <file.json>")
        sys.exit(1)
    import_questions(sys.argv[1])