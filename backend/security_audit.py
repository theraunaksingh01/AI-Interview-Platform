import os
import sys

BASE = r"C:\Users\Hp\Desktop\AI-Interview-Platform\backend"
sys.path.insert(0, BASE)

results = {}

# ─── 1. Password hashing ──────────────────────────────────────────────────────
auth_file = os.path.join(BASE, "api", "auth.py")
if os.path.exists(auth_file):
    content = open(auth_file, encoding="utf-8", errors="ignore").read()
    if "bcrypt" in content:
        results["password_hashing"] = "✅ bcrypt"
    elif "argon2" in content:
        results["password_hashing"] = "✅ argon2"
    elif "pbkdf2" in content.lower():
        results["password_hashing"] = "✅ pbkdf2"
    elif "md5" in content.lower():
        results["password_hashing"] = "❌ MD5 — INSECURE"
    elif "sha256" in content.lower() or "sha1" in content.lower():
        results["password_hashing"] = "⚠️ SHA — not ideal for passwords"
    elif "passlib" in content:
        results["password_hashing"] = "✅ passlib (check scheme)"
    else:
        results["password_hashing"] = "❓ unknown — check auth.py manually"
    # Show the relevant lines
    for line in content.splitlines():
        if any(x in line.lower() for x in ["hash", "bcrypt", "passlib", "crypt", "md5", "sha"]):
            print("  auth.py:", line.strip())
else:
    results["password_hashing"] = "❓ auth.py not found"

# ─── 2. Rate limiting ─────────────────────────────────────────────────────────
main_file = os.path.join(BASE, "main.py")
rate_found = []
for fname in ["main.py", "api/auth.py", "core/rate_limit.py", "core/middleware.py"]:
    fpath = os.path.join(BASE, fname)
    if os.path.exists(fpath):
        c = open(fpath, encoding="utf-8", errors="ignore").read()
        if any(x in c for x in ["slowapi", "ratelimit", "rate_limit", "limiter", "RateLimiter", "throttle"]):
            rate_found.append(fname)
results["rate_limiting"] = f"✅ Found in: {rate_found}" if rate_found else "❌ No rate limiting found"

# ─── 3. Code execution input validation ───────────────────────────────────────
dsa_file = os.path.join(BASE, "api", "dsa_practice.py")
if os.path.exists(dsa_file):
    c = open(dsa_file, encoding="utf-8", errors="ignore").read()
    checks = []
    if "len(" in c and "code" in c:
        checks.append("length check")
    if "import os" in c or "subprocess" in c.lower():
        checks.append("uses subprocess (runs as current user — no sandbox)")
    if "blacklist" in c.lower() or "forbidden" in c.lower() or "sanitize" in c.lower():
        checks.append("keyword blacklist")
    if "timeout" in c:
        checks.append("timeout present")
    results["code_execution_safety"] = checks if checks else ["❌ no validation found"]
    print("\n  dsa_practice.py subprocess/exec lines:")
    for line in c.splitlines():
        if any(x in line for x in ["subprocess", "exec(", "eval(", "os.system", "timeout"]):
            print("   ", line.strip())
else:
    results["code_execution_safety"] = "❓ dsa_practice.py not found"

# ─── 4. Stack traces exposed ──────────────────────────────────────────────────
if os.path.exists(main_file):
    c = open(main_file, encoding="utf-8", errors="ignore").read()
    if "debug=True" in c or "DEBUG=True" in c:
        results["stack_traces"] = "❌ debug=True — stack traces exposed"
    elif "exception_handler" in c or "HTTPException" in c:
        results["stack_traces"] = "⚠️ Check exception handlers — may expose detail"
    else:
        results["stack_traces"] = "✅ debug not True in main.py"
    # Check for generic exception handlers
    for line in c.splitlines():
        if "exception_handler" in line or "debug" in line.lower():
            print("  main.py:", line.strip())

# ─── 5. CORS configuration ────────────────────────────────────────────────────
if os.path.exists(main_file):
    c = open(main_file, encoding="utf-8", errors="ignore").read()
    if 'allow_origins=["*"]' in c or "allow_origins=['*']" in c:
        results["cors"] = "❌ allow_origins=['*'] — open to all origins"
    elif "allow_origins" in c:
        for line in c.splitlines():
            if "allow_origins" in line:
                results["cors"] = f"⚠️ check: {line.strip()}"
                print("  main.py CORS:", line.strip())
                break
    else:
        results["cors"] = "❓ no CORSMiddleware found"

# ─── 6. SQL injection (raw string formatting) ─────────────────────────────────
sql_risks = []
api_dir = os.path.join(BASE, "api")
if os.path.exists(api_dir):
    for fname in os.listdir(api_dir):
        if fname.endswith(".py"):
            fc = open(os.path.join(api_dir, fname), encoding="utf-8", errors="ignore").read()
            # Look for f-strings or % formatting inside text() calls
            lines = fc.splitlines()
            for i, line in enumerate(lines):
                if "text(" in line and ("f\"" in line or "f'" in line or "%" in line):
                    sql_risks.append(f"{fname}:{i+1}: {line.strip()[:80]}")
results["sql_injection"] = sql_risks if sql_risks else "✅ No obvious f-string SQL found"

# ─── Print summary ────────────────────────────────────────────────────────────
print("\n" + "="*60)
print("SECURITY AUDIT SUMMARY")
print("="*60)
for k, v in results.items():
    print(f"\n{k.upper().replace('_', ' ')}:")
    if isinstance(v, list):
        for item in v:
            print(f"  • {item}")
    else:
        print(f"  {v}")