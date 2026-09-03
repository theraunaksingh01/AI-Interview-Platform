# import_daily_questions.py
# Imports questions into daily_questions, assigning sequential scheduled_date
# values starting from the next available date (today + 1, or continuing
# from the last scheduled date already in the table, whichever is later).
#
# Usage: python import_daily_questions.py <file1.json> [file2.json] [file3.json] [file4.json]
# Run from backend/dsa_bank/ — pass all batch files together so dates are
# assigned sequentially across the full combined set without gaps or overlaps.

import json
import sys
import os
from datetime import date, timedelta
import psycopg2


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


def import_questions(filepaths):
    conn = get_db_connection()
    cur = conn.cursor()

    # Find the next available date: max(existing scheduled_date, today) + 1
    cur.execute("SELECT MAX(scheduled_date) FROM daily_questions")
    max_existing = cur.fetchone()[0]
    today = date.today()
    start_date = max(max_existing, today) + timedelta(days=1) if max_existing else today

    print(f"Starting from date: {start_date}")

    all_questions = []
    for filepath in filepaths:
        with open(filepath, encoding='utf-8') as f:
            batch = json.load(f)
            all_questions.extend(batch)

    print(f"Total questions to schedule: {len(all_questions)}")

    imported = 0
    skipped = 0
    failed = 0
    current_date = start_date

    for q in all_questions:
        question_text = q.get('question_text', '').strip()
        if not question_text:
            continue

        # Check for exact duplicate question text anywhere in the table
        cur.execute(
            "SELECT id FROM daily_questions WHERE question_text = %s",
            (question_text,)
        )
        if cur.fetchone():
            skipped += 1
            continue

        try:
            cur.execute("""
                INSERT INTO daily_questions
                    (scheduled_date, question_text, topic, difficulty,
                     company_tag, answer_framework, model_answer)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
            """, (
                current_date,
                question_text,
                q.get('topic'),
                q.get('difficulty', 2),
                q.get('company_tag'),
                q.get('answer_framework', ''),
                q.get('model_answer', ''),
            ))
            imported += 1
            current_date += timedelta(days=1)
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
    print(f"Date range scheduled: {start_date} to {current_date - timedelta(days=1)}")
    print(f"{'='*50}")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python import_daily_questions.py <file1.json> [file2.json] ...")
        sys.exit(1)
    import_questions(sys.argv[1:])