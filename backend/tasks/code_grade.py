# minimal tasks/code_grade.py
from celery_app import app

@app.task(name="tasks.code_grade")
def code_grade_stub(*args, **kwargs):
    # stub — real implementation optional later
    return {"ok": False, "reason": "stub"}
