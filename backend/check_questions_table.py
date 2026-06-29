import sys
sys.path.insert(0, r"C:\Users\Hp\Desktop\AI-Interview-Platform\backend")
from db.session import SessionLocal
from sqlalchemy import text

db = SessionLocal()

print("=== questions table columns ===")
cols = db.execute(text(
    "SELECT column_name FROM information_schema.columns WHERE table_name='questions' ORDER BY ordinal_position"
)).fetchall()
for c in cols:
    print(f"  {c[0]}")

print("\n=== questions count ===")
count = db.execute(text("SELECT COUNT(*) FROM questions")).scalar()
print(f"  {count} rows")

if count > 0:
    print("\n=== sample rows ===")
    rows = db.execute(text("SELECT * FROM questions LIMIT 3")).mappings().all()
    for row in rows:
        for k, v in row.items():
            print(f"  {k}: {str(v)[:80]}")
        print("  ---")

db.close()