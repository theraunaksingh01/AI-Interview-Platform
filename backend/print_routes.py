import main
app = main.app
for r in app.routes:
    methods = ",".join(sorted(getattr(r, "methods", []))) if getattr(r, "methods", None) else ""
    print(f"{r.path:40s}  {methods:20s}")
