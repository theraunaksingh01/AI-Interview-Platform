# ============================================
# import_interview_questions.py
# ============================================

import json
import sys
import os
import psycopg2
from psycopg2.extras import Json


def load_env():
    env_path = os.path.join(os.path.dirname(__file__), '..', '.env')
    if os.path.exists(env_path):
        with open(env_path) as f:
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


def create_tables(conn):
    cur = conn.cursor()
    cur.execute("""
        CREATE TABLE IF NOT EXISTS interview_question_bank (
            id SERIAL PRIMARY KEY,
            question_text TEXT NOT NULL,
            category VARCHAR(30) NOT NULL,
            topic VARCHAR(100),
            subtopic VARCHAR(100),
            difficulty VARCHAR(10) DEFAULT 'medium',
            type VARCHAR(10) DEFAULT 'voice',
            role VARCHAR(50) DEFAULT 'SDE',
            is_language_specific BOOLEAN DEFAULT FALSE,
            language_tag VARCHAR(20),
            times_reported INTEGER DEFAULT 1,
            expected_key_points TEXT[],
            common_mistakes TEXT[],
            follow_up_questions TEXT[],
            is_active BOOLEAN DEFAULT TRUE,
            created_at TIMESTAMP DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS interview_question_bank_company_tags (
            id SERIAL PRIMARY KEY,
            question_id INTEGER NOT NULL REFERENCES interview_question_bank(id) ON DELETE CASCADE,
            company VARCHAR(100) NOT NULL,
            role VARCHAR(100) DEFAULT 'SDE',
            round VARCHAR(50),
            source_url TEXT,
            confidence VARCHAR(20) DEFAULT 'likely',
            created_at TIMESTAMP DEFAULT NOW()
        );

        CREATE INDEX IF NOT EXISTS idx_iqb_category ON interview_question_bank(category);
        CREATE INDEX IF NOT EXISTS idx_iqb_topic ON interview_question_bank(topic);
        CREATE INDEX IF NOT EXISTS idx_iqb_difficulty ON interview_question_bank(difficulty);
        CREATE INDEX IF NOT EXISTS idx_iqb_role ON interview_question_bank(role);
        CREATE INDEX IF NOT EXISTS idx_iqbct_company ON interview_question_bank_company_tags(company);
        CREATE INDEX IF NOT EXISTS idx_iqbct_question ON interview_question_bank_company_tags(question_id);
    """)
    conn.commit()
    cur.close()
    print("Tables ready: interview_question_bank, interview_question_bank_company_tags")


def check_duplicate(cur, question_text):
    cur.execute(
        "SELECT id FROM interview_question_bank WHERE question_text = %s",
        (question_text,)
    )
    row = cur.fetchone()
    return row[0] if row else None


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

        existing_id = check_duplicate(cur, question_text)
        if existing_id:
            question_id = existing_id
            skipped += 1
        else:
            try:
                cur.execute("""
                    INSERT INTO interview_question_bank
                    (question_text, category, topic, subtopic, difficulty, type,
                     role, is_language_specific, language_tag, times_reported,
                     expected_key_points, common_mistakes, follow_up_questions, is_active)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, true)
                    RETURNING id
                """, (
                    question_text,
                    q.get('category', 'technical'),
                    q.get('topic', ''),
                    q.get('subtopic', ''),
                    q.get('difficulty', 'medium'),
                    q.get('type', 'voice'),
                    q.get('role', 'SDE'),
                    q.get('is_language_specific', False),
                    q.get('language_tag'),
                    q.get('times_reported', 1),
                    q.get('expected_key_points', []),
                    q.get('common_mistakes', []),
                    q.get('follow_up_questions', [])
                ))
                question_id = cur.fetchone()[0]
                imported += 1
            except Exception as e:
                conn.rollback()
                print(f"FAILED: {question_text[:50]} - {e}")
                failed += 1
                continue

        companies = q.get('companies', [])
        if not companies and q.get('company'):
            companies = [{
                "company": q['company'],
                "round": q.get('round', ''),
                "source_url": q.get('source_url', '')
            }]

        for comp in companies:
            company_name = comp.get('company', '').strip() if isinstance(comp, dict) else comp
            if not company_name:
                continue

            cur.execute("""
                SELECT id FROM interview_question_bank_company_tags
                WHERE question_id = %s AND company = %s
            """, (question_id, company_name))

            if not cur.fetchone():
                cur.execute("""
                    INSERT INTO interview_question_bank_company_tags
                    (question_id, company, role, round, source_url, confidence)
                    VALUES (%s, %s, %s, %s, %s, 'likely')
                """, (
                    question_id,
                    company_name,
                    q.get('role', 'SDE'),
                    comp.get('round', '') if isinstance(comp, dict) else '',
                    comp.get('source_url', '') if isinstance(comp, dict) else ''
                ))

        conn.commit()

    cur.close()
    conn.close()

    print(f"\n{'='*50}")
    print(f"New questions imported: {imported}")
    print(f"Already existed (tags merged): {skipped}")
    print(f"Failed: {failed}")
    print(f"{'='*50}")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python import_interview_questions.py <file.json>")
        print("       python import_interview_questions.py --create-tables")
        sys.exit(1)

    if sys.argv[1] == "--create-tables":
        conn = get_db_connection()
        create_tables(conn)
        conn.close()
    else:
        import_questions(sys.argv[1])