import sys
sys.path.insert(0, r"C:\Users\Hp\Desktop\AI-Interview-Platform\backend")
from db.session import SessionLocal
from sqlalchemy import text

db = SessionLocal()

print("=== interview_questions columns ===")
cols = db.execute(text(
    "SELECT column_name FROM information_schema.columns WHERE table_name='interview_questions' ORDER BY ordinal_position"
)).fetchall()
for c in cols:
    print(f"  {c[0]}")

# Sample row to see actual data
print("\n=== sample row ===")
row = db.execute(text("SELECT * FROM interview_questions LIMIT 1")).mappings().first()
if row:
    for k, v in row.items():
        print(f"  {k}: {str(v)[:60]}")

db.close()