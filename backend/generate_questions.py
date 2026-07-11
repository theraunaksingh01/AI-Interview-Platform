"""
Generate additional assessment questions — with duplicate prevention.
Pulls existing questions from DB and passes them as context to Claude
so it generates genuinely different questions.

Usage:
  cd backend
  $env:ANTHROPIC_API_KEY = "sk-ant-..."
  $env:DATABASE_URL = "postgresql://postgres:password@localhost:5432/ai_interview"
  python generate_questions.py

Output: questions_batch2.json (review before importing with import_questions.py)
"""
import anthropic
import json
import os
import time

try:
    import psycopg2
    HAS_DB = True
except ImportError:
    HAS_DB = False

client = anthropic.Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY"))


def fetch_existing_questions(section: str) -> list[str]:
    """Return list of existing question_text values for a section."""
    if not HAS_DB:
        return []
    db_url = os.environ.get("DATABASE_URL", "").replace("postgresql+psycopg2://", "postgresql://")
    if not db_url:
        return []
    try:
        conn = psycopg2.connect(db_url)
        cur = conn.cursor()
        cur.execute(
            "SELECT question_text FROM assessment_questions WHERE section = %s AND is_active = TRUE",
            (section,)
        )
        rows = cur.fetchall()
        cur.close()
        conn.close()
        return [r[0][:120] for r in rows]
    except Exception as e:
        print(f"  Warning: Could not fetch existing questions: {e}")
        return []


def build_existing_context(existing: list[str]) -> str:
    if not existing:
        return ""
    sample = existing[:20]
    lines = "\n".join(f"- {q}" for q in sample)
    return f"\n\nIMPORTANT: These questions ALREADY EXIST. Generate COMPLETELY DIFFERENT questions with different scenarios, numbers, and topics where possible. Do NOT generate similar versions of these:\n{lines}\n"


def aptitude_prompt(ctx: str) -> str:
    return f"""Generate exactly 25 multiple-choice aptitude questions for an Indian engineering student placement readiness diagnostic.
{ctx}
Topics (use DIFFERENT scenarios than existing):
- 4 percentages / profit & loss (different business scenarios)
- 4 time & work / speed & distance (trains, pipes, boats — not already covered)
- 4 number series / averages (different number patterns)
- 4 ratios & proportions (mixtures, partnerships)
- 4 logical reasoning — seating arrangement OR direction sense
- 4 coding-decoding OR data sufficiency
- 1 probability OR permutation & combination

Rules: easy (60%) medium (40%), exactly 4 options, one correct answer, step-by-step explanation.
Return ONLY valid JSON array, no markdown.
Format: [{{"question_text":"...","options":["A","B","C","D"],"correct_option":0,"section":"aptitude","topic":"percentages_profit_loss","difficulty":"easy","explanation":"Step-by-step: ..."}}]"""


def cs_prompt(ctx: str) -> str:
    return f"""Generate exactly 25 multiple-choice CS fundamentals questions for Indian engineering student placement readiness diagnostic.
{ctx}
Topics (avoid subtopics already covered, go deeper):
- 6 DBMS: ER diagrams, transactions ACID, indexing, views, triggers, stored procedures
- 6 OS: deadlock avoidance vs prevention, memory allocation, thrashing, semaphores, mutex
- 7 OOP: abstract class vs interface, constructor chaining, static methods, design patterns basics, method hiding
- 6 Computer Networks: subnetting, routing protocols, TCP handshake, HTTP methods, cookies vs sessions

Rules: easy (50%) medium (50%), conceptual no code, one correct answer, explain WHY correct and WHY others wrong.
Return ONLY valid JSON array, no markdown.
Format: [{{"question_text":"...","options":["A","B","C","D"],"correct_option":0,"section":"cs_fundamentals","topic":"dbms","difficulty":"easy","explanation":"..."}}]"""


def dsa_prompt(ctx: str) -> str:
    return f"""Generate exactly 25 multiple-choice programming and DSA pattern questions for Indian engineering student placement readiness diagnostic.
{ctx}
Topics (use DIFFERENT problems than existing):
- 6 best data structure for scenario: LRU cache, undo functionality, BFS traversal, expression evaluation, autocomplete, task scheduling
- 6 time/space complexity: BST operations, heap insert/delete, hash collisions, merge sort space, graph BFS/DFS
- 7 which approach: maximum subarray, detect cycle, two sum variants, LCS pattern, knapsack pattern, matrix traversal, interval merging
- 6 pseudocode output: nested loops with break/continue, string manipulation, recursion with return values, list operations

Rules: max 8 lines pseudocode, no ambiguous outputs, easy (40%) medium (60%).
Return ONLY valid JSON array, no markdown.
Format: [{{"question_text":"...","options":["A","B","C","D"],"correct_option":0,"section":"programming_dsa","topic":"time_complexity","difficulty":"medium","explanation":"..."}}]"""


def code_output_prompt(ctx: str) -> str:
    return f"""Generate exactly 25 multiple-choice code output prediction questions for Indian engineering student placement readiness diagnostic.
{ctx}
Rules:
- Python (15 questions): list comprehensions, dict operations, class methods, exception handling, string formatting, lambda, generators
- Java (10 questions): ArrayList, StringBuilder, inheritance, static vs instance, autoboxing, try-catch, wrapper classes
- Use DIFFERENT concepts than existing questions
- Max 10 lines of code, deterministic output, plausible wrong options (off-by-one, type errors, scope)
- Code must actually run without errors
- Format code with \\n for newlines inside JSON string

Return ONLY valid JSON array, no markdown.
Format: [{{"question_text":"What is the output?\\n\\n<code>","options":["A","B","C","D"],"correct_option":0,"section":"programming_dsa","topic":"code_output","difficulty":"easy","explanation":"..."}}]"""


BATCHES = [
    ("aptitude",        aptitude_prompt,    "aptitude",        25),
    ("cs_fundamentals", cs_prompt,          "cs_fundamentals", 25),
    ("dsa_pattern",     dsa_prompt,         "programming_dsa", 25),
    ("code_output",     code_output_prompt, "programming_dsa", 25),
]

all_questions = []

for batch_name, prompt_fn, db_section, expected in BATCHES:
    print(f"\nGenerating {batch_name} ({expected} questions)...")

    existing = fetch_existing_questions(db_section)
    print(f"  Found {len(existing)} existing in DB — passing as context")

    ctx = build_existing_context(existing)
    prompt = prompt_fn(ctx)

    try:
        response = client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=8000,
            messages=[{"role": "user", "content": prompt}]
        )
        raw = response.content[0].text.strip()

        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]

        questions = json.loads(raw.strip())
        print(f"  Got {len(questions)} questions")

        valid = []
        for i, q in enumerate(questions):
            if not all(k in q for k in ["question_text", "options", "correct_option", "section", "explanation"]):
                print(f"  WARNING q{i}: missing fields, skipping")
                continue
            if len(q["options"]) != 4:
                print(f"  WARNING q{i}: not 4 options, skipping")
                continue
            if not isinstance(q["correct_option"], int) or q["correct_option"] not in range(4):
                print(f"  WARNING q{i}: invalid correct_option, skipping")
                continue
            # Basic similarity check
            q_lower = q["question_text"].lower()[:80]
            is_dup = any(q_lower[:50] in ex.lower() for ex in existing)
            if is_dup:
                print(f"  WARNING q{i}: too similar to existing, skipping")
                continue
            valid.append(q)

        print(f"  Valid: {len(valid)}/{len(questions)}")
        all_questions.extend(valid)
        time.sleep(3)

    except Exception as e:
        print(f"  ERROR: {e}")
        continue

print(f"\nTotal new questions: {len(all_questions)}")

with open("questions_batch2.json", "w") as f:
    json.dump(all_questions, f, indent=2)

print("Saved to questions_batch2.json")
print("\nNext steps:")
print("1. Review questions_batch2.json")
print("2. Rename to questions.json OR update import_questions.py to read questions_batch2.json")
print("3. Run import_questions.py")