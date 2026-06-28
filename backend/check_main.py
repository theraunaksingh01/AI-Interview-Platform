BASE = r"C:\Users\Hp\Desktop\AI-Interview-Platform\backend"
lines = open(BASE + r"\main.py", encoding="utf-8", errors="ignore").read().splitlines()

print("=== LINES 95-115 (app creation + middleware) ===")
for i, line in enumerate(lines[94:115], 95):
    print(f"{i:3}: {line}")

print("\n=== LINES 178-215 (middleware block) ===")
for i, line in enumerate(lines[177:215], 178):
    print(f"{i:3}: {line}")

print("\n=== LINES 218-270 (debug endpoints) ===")
for i, line in enumerate(lines[217:270], 218):
    print(f"{i:3}: {line}")