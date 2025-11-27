# backend/tools/inspect_and_run_report.py
"""
Run from backend/ folder:
  python tools\inspect_and_run_report.py <INTERVIEW_ID>

What it does:
 - Ensures backend root is on sys.path so "tasks" package imports work.
 - Imports tasks.report_pdf (or prints what's available).
 - Lists callables & celery-like tasks.
 - Prints interviews row for the given id and checks the pdf file exists (if pdf_key present).
 - Attempts to call a likely function (only if safe).
"""

import importlib, sys, os, inspect, json
from pathlib import Path

def ensure_path():
    # Add repository 'backend' root to sys.path so "tasks" imports work
    this_file = Path(__file__).resolve()
    backend_root = this_file.parents[1]  # backend/
    if str(backend_root) not in sys.path:
        sys.path.insert(0, str(backend_root))
    print("Added to sys.path:", backend_root)

def import_tasks_module():
    for modname in ("tasks.report_pdf", "tasks.report", "tasks.reports", "report_pdf", "report"):
        try:
            mod = importlib.import_module(modname)
            print(f"Imported module: {modname} -> {getattr(mod,'__file__',None)}")
            return mod
        except Exception as e:
            print(f"Failed importing {modname}: {e}")
    raise ModuleNotFoundError("Could not import tasks.report_pdf (tried several names)")

def list_callables(mod):
    items = []
    for name in sorted(dir(mod)):
        if name.startswith("_"):
            continue
        try:
            val = getattr(mod, name)
        except Exception as e:
            val = f"<error retrieving: {e}>"
        entry = {
            "name": name,
            "type": str(type(val)),
            "callable": callable(val),
            "has_delay": hasattr(val, "delay"),
            "has_apply_async": hasattr(val, "apply_async"),
            "has_name": hasattr(val, "name"),
        }
        items.append(entry)
    print("\n--- ATTRIBUTES (json) ---")
    print(json.dumps(items, indent=2))
    print("\n--- CALLABLES (first 40, with signature) ---")
    count = 0
    for name in sorted(dir(mod)):
        if name.startswith("_"):
            continue
        try:
            val = getattr(mod, name)
        except Exception:
            continue
        if callable(val):
            try:
                sig = str(inspect.signature(val))
            except Exception:
                sig = "<signature unavailable>"
            doc = (inspect.getdoc(val) or "").splitlines()
            doc_snip = doc[0] if doc else ""
            print(f"- {name} {sig}\n  doc: {doc_snip}\n")
            count += 1
            if count >= 40:
                break

def find_candidates(mod):
    candidates = []
    for name in dir(mod):
        if name.startswith("_"):
            continue
        try:
            val = getattr(mod, name)
        except Exception:
            continue
        if callable(val):
            candidates.append((name, val))
    # prefer celery-like
    celery = [(n,v) for (n,v) in candidates if hasattr(v, "delay") or hasattr(v, "apply_async")]
    if celery:
        return celery
    # prefer known names
    preferred = ("generate_report","make_report","create_report","generate_pdf","make_pdf","create_pdf","run_report","make_report_task")
    for p in preferred:
        for (n,v) in candidates:
            if n.lower() == p:
                return [(n,v)]
    # fallback: return first 5 callables
    return candidates[:5]

def try_call(candidate, iid):
    name, func = candidate
    print(f"\nAttempting to call candidate: {name} (callable={callable(func)})")
    try:
        if hasattr(func, "delay"):
            print("Detected .delay() on candidate -> calling .delay(iid)")
            res = func.delay(iid)
            print("delay() returned:", res)
            return True
        # direct call attempt (non-destructive)
        sig = None
        try:
            sig = inspect.signature(func)
            nparams = len(sig.parameters)
        except Exception:
            nparams = None
        # attempt safe calls: do not pass DB session, only pass iid if function expects 1 param
        if nparams == 0:
            print("Calling with no args...")
            res = func()
        elif nparams == 1:
            print("Calling with interview id as single arg...")
            res = func(iid)
        else:
            print("Function expects multiple args; not calling directly for safety.")
            return False
        print("Call result (repr):", repr(res)[:1000])
        return True
    except Exception as e:
        print("Call failed:", e)
        return False

def check_pdf_file(iid):
    # Try reading DB via SQLAlchemy if available - otherwise just look for file in standard locations
    # We'll try to import db.session to run a simple query, but don't fail hard if not present.
    try:
        import db.session
        from db.session import SessionLocal
        from sqlalchemy import text
        s = SessionLocal()
        r = s.execute(text("SELECT id, pdf_key FROM interviews WHERE id = :iid"), {"iid": iid}).fetchone()
        s.close()
        if r:
            print("DB row for interview:", dict(r))
            pdf_key = r["pdf_key"]
            if pdf_key:
                # try several likely paths
                candidates = [
                    Path(str(pdf_key)),
                    Path("reports") / Path(pdf_key).name,
                    Path("reports") / pdf_key,
                    Path(os.getcwd()) / pdf_key,
                    Path(os.getcwd()) / "reports" / Path(pdf_key).name,
                ]
                print("Checking candidate file paths:")
                found = False
                for p in candidates:
                    p = p.resolve()
                    exists = p.exists()
                    print(f" - {p} exists={exists}")
                    if exists:
                        found = True
                if not found:
                    print("PDF key exists in DB but file not found in common locations. Search repository for file name.")
        else:
            print("No DB row for interview id (or DB not configured).")
    except Exception as _e:
        print("Could not query DB (skipping). Reason:", _e)
        # fallback: try to find files in reports/
        print("Listing reports/ directory (cwd):", Path.cwd())
        rpt = Path("reports")
        if rpt.exists():
            print("reports/ contains:", [str(x) for x in rpt.iterdir()])
        else:
            print("reports/ directory not found in cwd")

def main():
    if len(sys.argv) < 2:
        print("Usage: python tools\\inspect_and_run_report.py <INTERVIEW_ID>")
        sys.exit(2)
    iid = sys.argv[1]
    ensure_path()
    try:
        mod = import_tasks_module()
    except Exception as e:
        print("Import failed:", e)
        return
    list_callables(mod)
    candidates = find_candidates(mod)
    print("\n--- CANDIDATES ---")
    for n, v in candidates:
        print(" -", n, "callable:", callable(v), "has_delay:", hasattr(v, "delay"))
    # check DB/pdf file
    print("\n--- CHECK PDF FILE ---")
    check_pdf_file(iid)
    # try to call first candidate (ask user permission)
    if candidates:
        print("\nWill attempt to invoke the first candidate if it looks safe.")
        ok = try_call(candidates[0], iid)
        print("Invocation result:", ok)
    else:
        print("No callable candidates found in module.")

if __name__ == "__main__":
    main()
