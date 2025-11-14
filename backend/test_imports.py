# file: test_imports.py
import importlib, importlib.util, sys, os
print("cwd:", os.getcwd())
modules = [
    "tasks.transcribe",
    "tasks.resume_tasks",
    "tasks.question_tasks",
    "tasks.score_interview",
    "tasks.report_pdf",
    "tasks.code_grade",
]
for m in modules:
    spec = importlib.util.find_spec(m)
    print(m, "->", "FOUND" if spec else "MISSING")
    if spec:
        try:
            module = importlib.import_module(m)
            print("  import OK")
        except Exception as e:
            import traceback
            print("  import FAILED:")
            traceback.print_exc()
