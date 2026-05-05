#!/usr/bin/env python3
"""Seed questions from a JSON file into the `questions` table.

Usage:
  python scripts/seed_questions.py path/to/questions.json "Role Name"

This script reads DATABASE_URL from backend/.env (or environment if set),
connects with psycopg2, and inserts new questions while skipping duplicates
based on case-insensitive question_text comparison.
"""
import sys
import os
import json
from pathlib import Path

try:
    import psycopg2
    from psycopg2.extras import Json
except Exception as e:
    print("psycopg2 is required. Install with: pip install psycopg2-binary")
    raise


def read_env_file(env_path: Path) -> dict:
    vals = {}
    if not env_path.exists():
        return vals
    with env_path.open("r", encoding="utf-8") as fh:
        for line in fh:
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            if "=" not in line:
                continue
            k, v = line.split("=", 1)
            vals[k.strip()] = v.strip().strip('"').strip("'")
    return vals


def main():
    if len(sys.argv) < 3:
        print("Usage: python scripts/seed_questions.py path/to/questions.json \"Role Name\"")
        sys.exit(2)

    file_path = Path(sys.argv[1])
    role_name = sys.argv[2]

    if not file_path.exists():
        print(f"File not found: {file_path}")
        sys.exit(1)

    # Load DATABASE_URL from backend/.env if present
    repo_root = Path(__file__).resolve().parents[2]
    env_path = repo_root / "backend" / ".env"
    env = read_env_file(env_path)
    database_url = os.getenv("DATABASE_URL") or env.get("DATABASE_URL")
    if not database_url:
        print("DATABASE_URL not found in environment or backend/.env")
        sys.exit(1)

    # Read JSON file
    with file_path.open("r", encoding="utf-8") as fh:
        try:
            questions = json.load(fh)
        except Exception as e:
            print(f"Failed to parse JSON: {e}")
            sys.exit(1)

    # Handle wrapped formats
    if isinstance(questions, dict):
        # Try common wrapper keys
        for key in ["questions", "data", "items", "results"]:
            if key in questions:
                questions = questions[key]
                break
            
    # Handle nested arrays [[{...}]]
    if isinstance(questions, list) and len(questions) > 0:
        if isinstance(questions[0], list):
            questions = questions[0]
    
    if not isinstance(questions, list):
        print("JSON file must contain a top-level array")
        sys.exit(1)

    # Strip SQLAlchemy driver prefix
    db_url = database_url.replace("postgresql+psycopg2://", "postgresql://")
    conn = psycopg2.connect(db_url)
    cur = conn.cursor()

    inserted = 0
    skipped = 0

    for q in questions:
        if not isinstance(q, dict):
            print(f"Skipping non-dict item: {type(q)}")
            continue
        question_text = q.get("question_text") or q.get("text") or q.get("question")
        if not question_text:
            print("Skipping item with no question_text")
            continue

        # Check duplicate (case-insensitive lower comparison)
        cur.execute("SELECT 1 FROM questions WHERE lower(question_text) = lower(%s) LIMIT 1", (question_text,))
        if cur.fetchone():
            skipped += 1
            continue

        q_type = q.get("type")
        topic = q.get("topic")
        difficulty = q.get("difficulty")
        is_fundamental = bool(q.get("is_fundamental", False))
        expected_answer_framework = q.get("expected_answer_framework")
        follow_up_questions = q.get("follow_up_questions") or []
        red_flag_answers = q.get("red_flag_answers") or []

        role_tags = '{' + role_name + '}'
        source = "seeded"
        quality_score = 0.8

        # Insert row
        try:
            cur.execute("""
                INSERT INTO questions (
                    question_text, type, topic, difficulty,
                    is_fundamental, expected_answer_framework,
                    follow_up_questions, red_flag_answers,
                    role_tags, source, quality_score
                ) VALUES (
                    %s, %s, %s, %s,
                    %s, %s,
                    %s::jsonb, %s,
                    %s::text[], %s, %s
                )
            """, (
                question_text,
                q_type or 'voice',
                topic or 'general-behavior',
                int(difficulty) if difficulty else 3,
                is_fundamental,
                expected_answer_framework or '',
                json.dumps(follow_up_questions),      # → jsonb
                red_flag_answers if isinstance(red_flag_answers, str) 
                    else json.dumps(red_flag_answers),
                [role_name],                           # → text[] (pass as Python list)
                'seeded',
                0.8
            ))
            conn.commit()
            inserted += 1
        except Exception as e:
            conn.rollback()
            print(f"Failed to insert question: {e}")

    cur.close()
    conn.close()

    print(f"Inserted {inserted}, Skipped {skipped} duplicates")


if __name__ == "__main__":
    main()
