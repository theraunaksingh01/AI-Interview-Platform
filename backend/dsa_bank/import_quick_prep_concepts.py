# import_quick_prep_concepts.py
# Imports concept entries into quick_prep_concepts table.
# Matches the real schema: concept_name, topic, subtopic, ask_prompt,
# good_answer_summary, refresher_short, refresher_full, interview_edge_tip,
# rapid_fire_prompt, rapid_fire_answer, key_terms (array), difficulty.
#
# Usage: python import_quick_prep_concepts.py <file1.json> [file2.json] ...
# Run from backend/dsa_bank/

import json
import sys
import os
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


def import_concepts(filepaths):
    conn = get_db_connection()
    cur = conn.cursor()

    all_concepts = []
    for filepath in filepaths:
        with open(filepath, encoding='utf-8') as f:
            batch = json.load(f)
            all_concepts.extend(batch)

    print(f"Total concepts to import: {len(all_concepts)}")

    imported = 0
    skipped = 0
    failed = 0

    for c in all_concepts:
        concept_name = c.get('concept_name', '').strip()
        if not concept_name:
            continue

        # Check for duplicate (same concept_name + topic)
        cur.execute(
            "SELECT id FROM quick_prep_concepts WHERE concept_name = %s AND topic = %s",
            (concept_name, c.get('topic', ''))
        )
        if cur.fetchone():
            skipped += 1
            continue

        try:
            cur.execute("""
                INSERT INTO quick_prep_concepts
                    (concept_name, topic, subtopic, ask_prompt, good_answer_summary,
                     refresher_short, refresher_full, interview_edge_tip,
                     rapid_fire_prompt, rapid_fire_answer, key_terms, difficulty, is_active)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, TRUE)
            """, (
                concept_name,
                c.get('topic', ''),
                c.get('subtopic'),
                c.get('ask_prompt', ''),
                c.get('good_answer_summary', ''),
                c.get('refresher_short', ''),
                c.get('refresher_full', ''),
                c.get('interview_edge_tip'),
                c.get('rapid_fire_prompt'),
                c.get('rapid_fire_answer'),
                c.get('key_terms', []),
                c.get('difficulty', 'medium'),
            ))
            imported += 1
        except Exception as e:
            conn.rollback()
            print(f"FAILED: {concept_name[:50]} - {e}")
            failed += 1
            continue

        conn.commit()

    cur.close()
    conn.close()

    print(f"\n{'='*50}")
    print(f"New concepts imported: {imported}")
    print(f"Already existed (skipped): {skipped}")
    print(f"Failed: {failed}")
    print(f"{'='*50}")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python import_quick_prep_concepts.py <file1.json> [file2.json] ...")
        sys.exit(1)
    import_concepts(sys.argv[1:])