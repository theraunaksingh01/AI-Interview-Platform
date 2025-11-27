# backend/tools/run_make_report.py
import os
import sys
from db.session import SessionLocal
# import report module in tasks folder
try:
    from tasks import report_pdf as report_mod
except Exception:
    # try import path fallback
    import importlib
    report_mod = importlib.import_module("tasks.report_pdf")

def call_report(iid: str):
    func = getattr(report_mod, "generate_report", None) or getattr(report_mod, "make_report", None) or getattr(report_mod, "create_report", None)
    if not func:
        raise RuntimeError("report task function not found in tasks.report_pdf (expected generate_report/make_report/create_report)")
    print("Calling report function for", iid)
    # If the function is a Celery task, it may accept delay/apply_async. If it's a plain func, call directly.
    try:
        # if it's a Celery task
        if hasattr(func, "delay"):
            print("Dispatching as Celery task (delay)...")
            res = func.delay(iid)
            print("Celery dispatched:", res)
        else:
            print("Calling function directly...")
            res = func(iid)
            print("Function returned:", res)
    except Exception as e:
        print("Error while calling report function:", e)
        raise

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python run_make_report.py <INTERVIEW_ID>")
        sys.exit(1)
    call_report(sys.argv[1])
