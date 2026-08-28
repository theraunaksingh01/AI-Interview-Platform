# migrate_to_live_questions.py
# Copies questions from interview_question_bank into the `questions` table
# that mock interview's question_bank.py service actually queries.
#
# Run from backend/dsa_bank/:
#   python migrate_to_live_questions.py

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


# CORRECTED to match backend/api/mock.py's actual role_map exactly (verified
# against the real dict, not guessed). role_tags values here are what
# get_questions_for_session filters on via role_tags @> ARRAY[:role].
#
# Your import script's `role` field values (from the JSON question bank)
# need to map to these EXACT strings — check what values your JSON actually
# used for role: "SDE", "AI/ML Engineer", "Data Analyst" (per your own
# earlier description of the 3 roles) — mapped here to what mock.py expects.
ROLE_TAG_MAP = {
    "SDE": ["Backend Engineer", "Software Engineer"],
    "AI/ML Engineer": ["AI Engineer"],
    "Data Analyst": ["Data Engineer"],
    # Pass through common variants in case the JSON used different labels
    "Backend Engineer": ["Backend Engineer"],
    "Software Engineer": ["Software Engineer", "Backend Engineer"],
    "AI Engineer": ["AI Engineer"],
    "Data Engineer": ["Data Engineer"],
}


def migrate():
    conn = get_db_connection()
    cur = conn.cursor()

    cur.execute("""
        SELECT
            iqb.id, iqb.question_text, iqb.category, iqb.topic, iqb.subtopic,
            iqb.difficulty, iqb.type, iqb.role, iqb.is_language_specific,
            iqb.language_tag, iqb.expected_key_points, iqb.common_mistakes,
            iqb.follow_up_questions,
            ARRAY_AGG(DISTINCT iqbct.company) FILTER (WHERE iqbct.company IS NOT NULL) as companies
        FROM interview_question_bank iqb
        LEFT JOIN interview_question_bank_company_tags iqbct
            ON iqbct.question_id = iqb.id
        WHERE iqb.is_active = TRUE
        GROUP BY iqb.id
    """)
    rows = cur.fetchall()
    print(f"Found {len(rows)} questions to migrate")

    DIFFICULTY_MAP = {"easy": 2, "medium": 3, "hard": 4}

    migrated = 0
    skipped = 0
    unmapped_roles = set()

    for row in rows:
        (q_id, question_text, category, topic, subtopic, difficulty_str, q_type,
         role, is_lang_specific, language_tag, key_points, mistakes,
         follow_ups, companies) = row

        cur.execute(
            "SELECT id FROM questions WHERE question_text = %s",
            (question_text,)
        )
        if cur.fetchone():
            skipped += 1
            continue

        role_tags = ROLE_TAG_MAP.get(role)
        if role_tags is None:
            unmapped_roles.add(role)
            role_tags = [role] if role else []  # fallback: use raw value

        difficulty_int = DIFFICULTY_MAP.get(difficulty_str, 3)
        company_tags = companies if companies else []
        follow_ups_json = Json(follow_ups or [])

        try:
            cur.execute("""
                INSERT INTO questions
                    (question_text, type, topic, difficulty, role_tags,
                     is_fundamental, source, follow_up_questions,
                     assessment_type, company_tags, language_tag)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                question_text,
                q_type or "voice",
                topic or subtopic or category,
                difficulty_int,
                role_tags,
                False,
                "imported_2026",
                follow_ups_json,
                q_type or "voice",
                company_tags,
                language_tag,
            ))
            migrated += 1
        except Exception as e:
            print(f"FAILED [{q_id}]: {question_text[:50]} — {e}")
            conn.rollback()
            continue

        if migrated % 100 == 0:
            conn.commit()
            print(f"  ...{migrated} migrated so far")

    conn.commit()
    cur.close()
    conn.close()

    print(f"\n{'='*50}")
    print(f"Migrated: {migrated}")
    print(f"Skipped (already in questions table): {skipped}")
    if unmapped_roles:
        print(f"\n⚠ WARNING — these role values had NO mapping and used raw fallback:")
        for r in unmapped_roles:
            print(f"   '{r}'")
        print("These questions may not be reachable by mock interview's role filter.")
        print("Check the ROLE_TAG_MAP against your actual JSON role values.")
    print(f"{'='*50}")


if __name__ == "__main__":
    migrate()