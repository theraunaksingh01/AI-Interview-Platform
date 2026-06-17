from db.session import SessionLocal
from sqlalchemy import text

db = SessionLocal()

# Check users table for target_companies
cols = db.execute(text("""
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'users' AND column_name LIKE '%compan%'
""")).scalars().all()
print('users company cols:', cols)

# Check if company_profiles or cheat_sheet tables already exist
tables = db.execute(text("""
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public'
    AND (table_name LIKE '%company_profile%' OR table_name LIKE '%cheat_sheet%')
""")).scalars().all()
print('existing tables:', tables)

# Check mock_sessions for topic/company linkage we can aggregate from
cols2 = db.execute(text("""
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'mock_sessions'
    AND column_name LIKE '%compan%'
""")).scalars().all()
print('mock_sessions company cols:', cols2)

# Check interview_questions topic column
cols3 = db.execute(text("""
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'interview_questions'
    AND column_name IN ('topic', 'company_tags', 'company')
""")).scalars().all()
print('interview_questions topic/company cols:', cols3)

db.close()