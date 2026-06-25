# ============================================
# import_to_db.py — Fixed Version
# ============================================
# Save as: backend/dsa_bank/import_to_db.py
# Usage: python import_to_db.py validated/batch_01_arrays.json
#
# Uses psycopg2 (same driver your FastAPI backend uses via SQLAlchemy)
# Reads DATABASE_URL from backend/.env

import json
import uuid
import sys
import os
import re

# Load .env from parent directory (backend/.env)
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

try:
    import psycopg2
    from psycopg2.extras import Json
except ImportError:
    print("psycopg2 not installed. Run: pip install psycopg2-binary")
    sys.exit(1)


def get_db_connection():
    """Connect using DATABASE_URL from .env"""
    db_url = os.getenv("DATABASE_URL", "")
    
    if not db_url:
        host = os.getenv("DB_HOST", "localhost")
        port = os.getenv("DB_PORT", "5432")
        name = os.getenv("DB_NAME", "qued")
        user = os.getenv("DB_USER", "postgres")
        password = os.getenv("DB_PASSWORD", "")
        
        return psycopg2.connect(
            host=host, port=port, dbname=name,
            user=user, password=password
        )
    
    # Strip SQLAlchemy dialect prefix — psycopg2 needs plain postgresql://
    db_url = db_url.replace("postgresql+psycopg2://", "postgresql://")
    db_url = db_url.replace("postgresql+asyncpg://", "postgresql://")
    
    return psycopg2.connect(db_url)


def check_tables_exist(conn):
    """Check if required tables exist. Print CREATE statements if not."""
    cur = conn.cursor()
    
    required_tables = ['questions', 'question_dsa_details', 'question_company_tags']
    missing = []
    
    for table in required_tables:
        cur.execute("""
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = %s
            )
        """, (table,))
        if not cur.fetchone()[0]:
            missing.append(table)
    
    cur.close()
    
    if missing:
        print(f"❌ Missing tables: {', '.join(missing)}")
        print(f"\nCreate them first. SQL is in the schema documents.")
        print(f"Or run: python import_to_db.py --create-tables")
        return False
    return True


def create_tables(conn):
    """Create DSA-specific tables."""
    cur = conn.cursor()
    
    cur.execute("""
        CREATE TABLE IF NOT EXISTS dsa_questions (
            id SERIAL PRIMARY KEY,
            question_text TEXT NOT NULL,
            problem_name VARCHAR(200),
            difficulty VARCHAR(10) NOT NULL,
            topic VARCHAR(100) NOT NULL,
            subtopic VARCHAR(100),
            tags TEXT[],
            time_limit_minutes INTEGER DEFAULT 15,
            quality_score FLOAT DEFAULT 0.5,
            is_active BOOLEAN DEFAULT TRUE,
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW()
        );
        
        CREATE TABLE IF NOT EXISTS dsa_question_details (
            id SERIAL PRIMARY KEY,
            question_id INTEGER NOT NULL REFERENCES dsa_questions(id) ON DELETE CASCADE,
            problem_statement TEXT NOT NULL,
            input_format TEXT,
            output_format TEXT,
            function_signature TEXT,
            constraints JSONB,
            sample_cases JSONB,
            hidden_test_cases JSONB,
            solution_code JSONB,
            solution_explanation TEXT,
            time_complexity VARCHAR(50),
            space_complexity VARCHAR(50),
            brute_force_complexity JSONB,
            approach_tags TEXT[],
            edge_cases TEXT[],
            hints_progressive TEXT[],
            common_mistakes TEXT[],
            interview_followups JSONB,
            UNIQUE(question_id)
        );
        
        CREATE TABLE IF NOT EXISTS dsa_company_tags (
            id SERIAL PRIMARY KEY,
            question_id INTEGER NOT NULL REFERENCES dsa_questions(id) ON DELETE CASCADE,
            company VARCHAR(100) NOT NULL,
            role VARCHAR(100) DEFAULT 'SDE',
            role_level VARCHAR(50) DEFAULT 'fresher',
            confidence VARCHAR(20) DEFAULT 'likely',
            created_at TIMESTAMP DEFAULT NOW()
        );
        
        CREATE INDEX IF NOT EXISTS idx_dsa_questions_topic ON dsa_questions(topic);
        CREATE INDEX IF NOT EXISTS idx_dsa_questions_difficulty ON dsa_questions(difficulty);
        CREATE INDEX IF NOT EXISTS idx_dsa_company_tags_company ON dsa_company_tags(company);
        CREATE INDEX IF NOT EXISTS idx_dsa_company_tags_question ON dsa_company_tags(question_id);
    """)
    
    conn.commit()
    cur.close()
    print("✅ Tables created: dsa_questions, dsa_question_details, dsa_company_tags")


def check_duplicate(cur, problem_name, topic):
    """Check if this problem already exists."""
    cur.execute("""
        SELECT id FROM questions 
        WHERE question_summary = %s AND topic = %s AND category = 'dsa'
    """, (problem_name, topic))
    result = cur.fetchone()
    return result[0] if result else None


def parse_companies(companies_raw):
    """Parse company tags from various formats."""
    if not companies_raw:
        return []
    
    if isinstance(companies_raw, list):
        # Might be a list of single strings like ["Amazon Google Microsoft"]
        # or properly split like ["Amazon", "Google", "Microsoft"]
        all_companies = []
        for item in companies_raw:
            if isinstance(item, str):
                # Split on common delimiters
                parts = re.split(r'[,\+]', item)
                for part in parts:
                    company = part.strip()
                    if company and len(company) > 2:
                        all_companies.append(company)
        return all_companies
    
    if isinstance(companies_raw, str):
        parts = re.split(r'[,\+]', companies_raw)
        return [p.strip() for p in parts if p.strip() and len(p.strip()) > 2]
    
    return []


def import_batch(filepath):
    with open(filepath, encoding='utf-8') as f:
        problems = json.load(f)
    
    conn = get_db_connection()
    cur = conn.cursor()
    
    imported = 0
    skipped = 0
    failed = 0
    
    try:
        for p in problems:
            problem_name = p.get("problem_name", "Unknown")
            topic = p.get("topic", "")
            
            # Check for duplicates
            cur.execute("""
                SELECT id FROM dsa_questions 
                WHERE problem_name = %s AND topic = %s
            """, (problem_name, topic))
            existing = cur.fetchone()
            
            if existing:
                print(f"⏭  Skipped (duplicate): {problem_name}")
                skipped += 1
                continue
            
            try:
                # Insert into dsa_questions (RETURNING id for the auto-increment)
                cur.execute("""
                    INSERT INTO dsa_questions 
                    (question_text, problem_name, difficulty, topic, subtopic, 
                     tags, time_limit_minutes, is_active)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, true)
                    RETURNING id
                """, (
                    p.get("problem_statement", ""),
                    problem_name,
                    p.get("difficulty", "medium"),
                    topic,
                    ", ".join(p.get("approach_tags", [])),
                    p.get("approach_tags", []),
                    15
                ))
                
                question_id = cur.fetchone()[0]
                
                # Insert into dsa_question_details
                cur.execute("""
                    INSERT INTO dsa_question_details
                    (question_id, problem_statement, input_format, 
                     output_format, function_signature, constraints, 
                     sample_cases, hidden_test_cases, solution_code, 
                     solution_explanation, time_complexity, space_complexity, 
                     brute_force_complexity, approach_tags, edge_cases, 
                     hints_progressive, common_mistakes, interview_followups)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 
                            %s, %s, %s, %s, %s, %s, %s, %s)
                """, (
                    question_id,
                    p.get("problem_statement", ""),
                    p.get("input_format", ""),
                    p.get("output_format", ""),
                    p.get("function_signature", ""),
                    Json(p.get("constraints", {})),
                    Json(p.get("sample_cases", [])),
                    Json(p.get("hidden_test_cases", [])),
                    Json({
                        "python": p.get("solution_code", ""),
                        "brute_force_python": p.get("brute_force_code", "")
                    }),
                    p.get("solution_explanation", ""),
                    p.get("time_complexity", ""),
                    p.get("space_complexity", ""),
                    Json(p.get("brute_force_complexity", {})),
                    p.get("approach_tags", []),
                    p.get("edge_cases", []),
                    p.get("hints_progressive", []),
                    p.get("common_mistakes", []) if isinstance(p.get("common_mistakes"), list)
                        else [p.get("common_mistakes", "")],
                    Json(p.get("interview_followups", []))
                ))
                
                # Insert company tags
                companies = parse_companies(p.get("companies", []))
                for company in companies:
                    cur.execute("""
                        INSERT INTO dsa_company_tags
                        (question_id, company, role, role_level, confidence)
                        VALUES (%s, %s, 'SDE', 'fresher', 'likely')
                    """, (question_id, company))
                
                conn.commit()
                imported += 1
                
                company_str = f" ({len(companies)} companies)" if companies else ""
                print(f"✅ Imported: {problem_name}{company_str}")
                
            except Exception as e:
                conn.rollback()
                print(f"❌ Failed: {problem_name} — {e}")
                failed += 1
        
        print(f"\n{'='*50}")
        print(f"Imported: {imported}")
        print(f"Skipped (duplicates): {skipped}")
        print(f"Failed: {failed}")
        print(f"{'='*50}")
        
    finally:
        cur.close()
        conn.close()


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python import_to_db.py <batch_file.json>")
        print("       python import_to_db.py --create-tables")
        sys.exit(1)
    
    if sys.argv[1] == "--create-tables":
        conn = get_db_connection()
        create_tables(conn)
        conn.close()
    else:
        import_batch(sys.argv[1])