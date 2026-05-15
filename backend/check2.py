from db.session import SessionLocal
from sqlalchemy import text
import json
db = SessionLocal()
row = db.execute(text("SELECT coaching_report, specific_fix FROM mock_sessions WHERE id = '87d267c4-c5da-4af3-a372-13ee41087dea'")).mappings().first()
print('specific_fix:', row['specific_fix'])
cr = row['coaching_report']
if cr:
    print('coaching_report keys:', list(cr.keys()))
    print('questions count:', len(cr.get('questions', [])))
else:
    print('coaching_report is STILL None')
db.close()
