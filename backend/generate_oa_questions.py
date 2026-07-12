"""
Generate OA practice questions for TCS, Infosys, Wipro, Cognizant.
Each run generates one batch per company-section and saves to oa_questions_batch_N.json

Usage:
  cd backend
  $env:ANTHROPIC_API_KEY = "sk-ant-..."
  $env:DATABASE_URL = "postgresql://postgres:password@localhost:5432/ai_interview"
  python generate_oa_questions.py

Run multiple times — each run fetches existing questions from DB to avoid duplicates.
Output: oa_questions_batch_N.json where N = timestamp
"""
import anthropic
import json
import os
import time
import psycopg2
from datetime import datetime

client = anthropic.Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY"))


# ── Fetch existing questions from DB ──────────────────────────────────────────

def fetch_existing(company: str, section: str) -> list[str]:
    db_url = os.environ.get("DATABASE_URL", "").replace("postgresql+psycopg2://", "postgresql://")
    if not db_url:
        return []
    try:
        conn = psycopg2.connect(db_url)
        cur = conn.cursor()
        cur.execute(
            "SELECT question_text FROM oa_questions WHERE company = %s AND section = %s AND is_active = TRUE",
            (company, section)
        )
        rows = cur.fetchall()
        cur.close()
        conn.close()
        return [r[0][:120] for r in rows]
    except Exception as e:
        print(f"  Warning: {e}")
        return []


def existing_context(existing: list[str]) -> str:
    if not existing:
        return ""
    sample = existing[:15]
    lines = "\n".join(f"- {q}" for q in sample)
    return f"\n\nIMPORTANT: These questions ALREADY EXIST — generate COMPLETELY DIFFERENT questions with different numbers, scenarios, and topics:\n{lines}\n"


# ── TCS NQT Prompts ───────────────────────────────────────────────────────────

def tcs_numerical_prompt(ctx: str) -> str:
    return f"""Generate exactly 25 multiple-choice numerical ability questions for TCS NQT Foundation section practice.
{ctx}
TCS NQT Numerical style rules:
- Topics: percentages, profit/loss, time-work, speed-distance, number series, averages, ratios, simple/compound interest, pipes-cisterns, probability, permutation-combination
- Each question solvable in under 90 seconds with pen-paper calculation
- Numbers are always clean integers or simple fractions — no messy decimals
- 4 answer options all numerically close to each other (prevents guessing)
- Difficulty: 60% easy, 40% medium
- NO data interpretation or tables — pure calculation questions

Return ONLY valid JSON array, no markdown.
[{{"question_text":"...","options":["A","B","C","D"],"correct_option":0,"company":"tcs","section":"numerical","topic":"profit_loss","difficulty":"easy","explanation":"Step-by-step: ..."}}]"""


def tcs_verbal_prompt(ctx: str) -> str:
    return f"""Generate exactly 25 multiple-choice verbal ability questions for TCS NQT Foundation section practice.
{ctx}
TCS NQT Verbal style rules:
- Topics: sentence completion, error spotting, vocabulary (synonyms/antonyms), reading comprehension (short 3-4 line passages with 1-2 questions), grammar correction, one-word substitution, idioms
- TCS verbal is grammar-heavy — more subject-verb agreement, tense errors, articles than vocabulary
- Reading comprehension passages must be 3-4 sentences maximum
- Difficulty: 60% easy, 40% medium
- Options must be grammatically plausible distractors

Return ONLY valid JSON array, no markdown.
[{{"question_text":"...","options":["A","B","C","D"],"correct_option":0,"company":"tcs","section":"verbal","topic":"grammar","difficulty":"easy","explanation":"..."}}]"""


def tcs_reasoning_prompt(ctx: str) -> str:
    return f"""Generate exactly 25 multiple-choice reasoning ability questions for TCS NQT Foundation section practice.
{ctx}
TCS NQT Reasoning style rules:
- Topics: seating arrangements (linear and circular), blood relations (3+ step), coding-decoding (letter shift, symbol substitution), direction sense, number/letter series, analogies, syllogisms, data sufficiency, odd one out, ranking/positions
- Each question must be solvable in under 90 seconds
- Seating arrangement questions must include 5-6 people maximum
- Blood relation questions must have exactly one valid answer
- Difficulty: 50% easy, 50% medium

Return ONLY valid JSON array, no markdown.
[{{"question_text":"...","options":["A","B","C","D"],"correct_option":0,"company":"tcs","section":"reasoning","topic":"seating_arrangement","difficulty":"medium","explanation":"..."}}]"""


# ── Infosys Prompts ───────────────────────────────────────────────────────────

def infosys_reasoning_prompt(ctx: str) -> str:
    return f"""Generate exactly 25 multiple-choice reasoning ability questions for Infosys SE assessment practice.
{ctx}
Infosys reasoning style:
- Topics: logical deduction, syllogisms, blood relations, coding-decoding, series completion, analogies, direction sense, calendar problems, clocks
- Infosys reasoning is slightly more abstract than TCS — less seating arrangement, more logical deduction
- Each question solvable in 60-75 seconds
- Difficulty: 50% easy, 50% medium
- Individual section cutoffs apply — questions must be clearly answerable

Return ONLY valid JSON array, no markdown.
[{{"question_text":"...","options":["A","B","C","D"],"correct_option":0,"company":"infosys","section":"reasoning","topic":"logical_deduction","difficulty":"medium","explanation":"..."}}]"""


def infosys_quant_prompt(ctx: str) -> str:
    return f"""Generate exactly 25 multiple-choice quantitative ability questions for Infosys SE assessment practice.
{ctx}
Infosys quantitative style:
- Topics: arithmetic (percentages, profit/loss, SI/CI, time-work, speed-distance), algebra (equations, ratios, proportions), geometry basics (area, perimeter, basic mensuration), number theory (HCF, LCM, divisibility)
- Slightly harder than TCS numerical — more multi-step problems
- Each question solvable in under 90 seconds
- Difficulty: 40% easy, 60% medium
- Clean integer answers preferred

Return ONLY valid JSON array, no markdown.
[{{"question_text":"...","options":["A","B","C","D"],"correct_option":0,"company":"infosys","section":"quantitative","topic":"time_work","difficulty":"medium","explanation":"Step-by-step: ..."}}]"""


def infosys_verbal_prompt(ctx: str) -> str:
    return f"""Generate exactly 25 multiple-choice verbal ability questions for Infosys SE assessment practice.
{ctx}
Infosys verbal style:
- Topics: reading comprehension (medium-length 5-6 line passages, 2 questions per passage), sentence correction, fill in the blanks (contextual vocabulary), para-jumbles (4 sentences to arrange), synonyms/antonyms
- Infosys verbal tests comprehension more than TCS — longer passages, inferential questions
- Difficulty: 50% easy, 50% medium

Return ONLY valid JSON array, no markdown.
[{{"question_text":"...","options":["A","B","C","D"],"correct_option":0,"company":"infosys","section":"verbal","topic":"reading_comprehension","difficulty":"medium","explanation":"..."}}]"""


def infosys_pseudocode_prompt(ctx: str) -> str:
    return f"""Generate exactly 25 multiple-choice pseudocode/programming logic questions for Infosys SE assessment practice.
{ctx}
Infosys pseudocode style:
- Questions show 5-10 lines of pseudocode and ask for output, time complexity, or what the code does
- Topics: loops, conditionals, arrays, functions, recursion basics
- Pseudocode uses generic syntax (not language-specific) — IF/ELSE, FOR, WHILE, RETURN
- Some questions ask "what does this code compute?" rather than exact output
- Difficulty: 40% easy, 60% medium
- Wrong options must be plausible (off-by-one, wrong loop termination)

Return ONLY valid JSON array, no markdown.
[{{"question_text":"What is the output of the following pseudocode?\\n\\nX = 0\\nFOR I = 1 TO 5\\n  X = X + I\\nEND FOR\\nPRINT X","options":["10","15","20","25"],"correct_option":1,"company":"infosys","section":"pseudocode","topic":"loops","difficulty":"easy","explanation":"Sum of 1+2+3+4+5 = 15"}}]"""


# ── Wipro Prompts ─────────────────────────────────────────────────────────────

def wipro_aptitude_prompt(ctx: str) -> str:
    return f"""Generate exactly 25 multiple-choice aptitude questions for Wipro NLTH assessment practice.
{ctx}
Wipro NLTH aptitude style:
- Topics: arithmetic (all standard topics), logical reasoning (series, analogies, classification), verbal reasoning
- Mix of numerical and reasoning — Wipro combines both in one aptitude section
- Each question solvable in under 75 seconds
- Difficulty: 60% easy, 40% medium
- Clean, unambiguous questions — Wipro is considered more accessible than TCS/Infosys

Return ONLY valid JSON array, no markdown.
[{{"question_text":"...","options":["A","B","C","D"],"correct_option":0,"company":"wipro","section":"aptitude","topic":"number_series","difficulty":"easy","explanation":"..."}}]"""


def wipro_verbal_prompt(ctx: str) -> str:
    return f"""Generate exactly 25 multiple-choice verbal/communication questions for Wipro NLTH assessment practice.
{ctx}
Wipro NLTH verbal style:
- Topics: grammar correction, sentence completion, vocabulary (synonyms/antonyms), reading comprehension (short passages), error detection, email writing MCQs (choose the best professional email phrasing)
- Wipro specifically tests professional/business writing — include 5 email-style questions
- Email questions: show a business situation, ask which response is most professional
- Difficulty: 60% easy, 40% medium

Return ONLY valid JSON array, no markdown.
[{{"question_text":"...","options":["A","B","C","D"],"correct_option":0,"company":"wipro","section":"verbal","topic":"grammar","difficulty":"easy","explanation":"..."}}]"""


# ── Cognizant Prompts ─────────────────────────────────────────────────────────

def cognizant_quant_prompt(ctx: str) -> str:
    return f"""Generate exactly 25 multiple-choice quantitative aptitude questions for Cognizant GenC/GenC Next assessment practice.
{ctx}
Cognizant quantitative style:
- Topics: percentages, profit/loss, time-work, speed-distance, SI/CI, ratios, averages, number series, HCF/LCM
- Similar difficulty to TCS but slightly more application-based (word problems over pure calculation)
- Each question solvable in under 90 seconds
- Difficulty: 50% easy, 50% medium

Return ONLY valid JSON array, no markdown.
[{{"question_text":"...","options":["A","B","C","D"],"correct_option":0,"company":"cognizant","section":"quantitative","topic":"percentages","difficulty":"easy","explanation":"Step-by-step: ..."}}]"""


def cognizant_reasoning_prompt(ctx: str) -> str:
    return f"""Generate exactly 25 multiple-choice reasoning questions for Cognizant GenC/GenC Next assessment practice.
{ctx}
Cognizant reasoning style:
- Topics: logical reasoning, blood relations, coding-decoding, series, analogies, seating arrangement (simple), direction sense, classification
- Cognizant reasoning is similar difficulty to TCS but slightly more focused on logical deduction
- Each question solvable in under 75 seconds
- Difficulty: 50% easy, 50% medium

Return ONLY valid JSON array, no markdown.
[{{"question_text":"...","options":["A","B","C","D"],"correct_option":0,"company":"cognizant","section":"reasoning","topic":"blood_relations","difficulty":"medium","explanation":"..."}}]"""


def cognizant_verbal_prompt(ctx: str) -> str:
    return f"""Generate exactly 25 multiple-choice verbal ability questions for Cognizant GenC/GenC Next assessment practice.
{ctx}
Cognizant verbal style:
- Topics: reading comprehension, sentence correction, fill in the blanks, vocabulary, para-jumbles, error spotting
- Cognizant verbal is balanced between grammar and comprehension
- Difficulty: 50% easy, 50% medium

Return ONLY valid JSON array, no markdown.
[{{"question_text":"...","options":["A","B","C","D"],"correct_option":0,"company":"cognizant","section":"verbal","topic":"vocabulary","difficulty":"easy","explanation":"..."}}]"""


# ── Batch config ──────────────────────────────────────────────────────────────

BATCHES = [
    # TCS
    ("tcs",       "numerical",    tcs_numerical_prompt,        25),
    ("tcs",       "verbal",       tcs_verbal_prompt,           25),
    ("tcs",       "reasoning",    tcs_reasoning_prompt,        25),
    # Infosys
    ("infosys",   "reasoning",    infosys_reasoning_prompt,    25),
    ("infosys",   "quantitative", infosys_quant_prompt,        25),
    ("infosys",   "verbal",       infosys_verbal_prompt,       25),
    ("infosys",   "pseudocode",   infosys_pseudocode_prompt,   25),
    # Wipro
    ("wipro",     "aptitude",     wipro_aptitude_prompt,       25),
    ("wipro",     "verbal",       wipro_verbal_prompt,         25),
    # Cognizant
    ("cognizant", "quantitative", cognizant_quant_prompt,      25),
    ("cognizant", "reasoning",    cognizant_reasoning_prompt,  25),
    ("cognizant", "verbal",       cognizant_verbal_prompt,     25),
]

# ── Generate ──────────────────────────────────────────────────────────────────

all_questions = []

for company, section, prompt_fn, expected in BATCHES:
    print(f"\nGenerating {company}/{section} ({expected} questions)...")

    existing = fetch_existing(company, section)
    print(f"  Existing in DB: {len(existing)}")

    needed = max(0, 50 - len(existing))
    if needed == 0:
        print(f"  Already have 50+ questions for {company}/{section} — skipping")
        continue
    # Adjust expected count to only generate what's needed
    if needed < expected:
        print(f"  Only need {needed} more to reach 50")
        expected = needed

    ctx = existing_context(existing)
    prompt = prompt_fn(ctx)

    def clean_and_parse(raw: str) -> list:
        """Robustly clean Claude response and parse JSON."""
        raw = raw.strip()
        # Remove markdown fences
        if "```" in raw:
            parts = raw.split("```")
            for part in parts:
                part = part.strip()
                if part.startswith("json"):
                    part = part[4:].strip()
                if part.startswith("["):
                    raw = part
                    break
        # Find JSON array boundaries
        start = raw.find("[")
        end = raw.rfind("]")
        if start == -1 or end == -1 or end <= start:
            raise ValueError("No JSON array found in response")
        raw = raw[start:end+1]
        # Fix common issues
        raw = raw.replace("\n", "\n")  # normalize newlines
        return json.loads(raw)

    max_retries = 2
    for attempt in range(max_retries):
        try:
            response = client.messages.create(
                model="claude-sonnet-4-6",
                max_tokens=8000,
                messages=[{"role": "user", "content": prompt}]
            )
            raw = response.content[0].text.strip()

            try:
                questions = clean_and_parse(raw)
            except json.JSONDecodeError as je:
                if attempt < max_retries - 1:
                    print(f"  JSON parse error (attempt {attempt+1}), retrying...")
                    time.sleep(5)
                    continue
                else:
                    print(f"  ERROR: JSON parse failed after {max_retries} attempts: {je}")
                    break

            print(f"  Got {len(questions)} questions")

            valid = []
            for i, q in enumerate(questions):
                if not all(k in q for k in ["question_text", "options", "correct_option", "explanation"]):
                    print(f"  WARNING q{i}: missing fields")
                    continue
                if len(q["options"]) != 4:
                    print(f"  WARNING q{i}: not 4 options")
                    continue
                if not isinstance(q["correct_option"], int) or q["correct_option"] not in range(4):
                    print(f"  WARNING q{i}: invalid correct_option")
                    continue
                # Force company and section
                q["company"] = company
                q["section"] = section
                # Dedup check
                q_lower = q["question_text"].lower()[:60]
                if any(q_lower in ex.lower() for ex in existing):
                    print(f"  WARNING q{i}: too similar to existing")
                    continue
                valid.append(q)

            print(f"  Valid: {len(valid)}/{len(questions)}")
            all_questions.extend(valid)
            time.sleep(3)
            break  # success — exit retry loop

        except Exception as e:
            if attempt < max_retries - 1:
                print(f"  ERROR attempt {attempt+1}: {e}, retrying...")
                time.sleep(5)
            else:
                print(f"  ERROR after {max_retries} attempts: {e}")
            continue

# ── Save ──────────────────────────────────────────────────────────────────────

timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
output_file = f"oa_questions_{timestamp}.json"

with open(output_file, "w") as f:
    json.dump(all_questions, f, indent=2)

print(f"\nTotal: {len(all_questions)} questions")
print(f"Saved to {output_file}")
print("\nNext: review file, then run import_oa_questions.py")