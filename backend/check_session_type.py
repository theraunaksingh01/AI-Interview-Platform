from db.session import SessionLocal
from sqlalchemy import text
db = SessionLocal()
row = db.execute(text('''
    SELECT id, session_type, focus_area, resume_uploaded
    FROM mock_sessions
    WHERE id = '8b7638b8-b654-40b9-8674-565f3acef92f'
''')).mappings().first()
print(dict(row))
db.close()
