import os
from dotenv import load_dotenv
from pathlib import Path

# Load from backend/.env directly
load_dotenv(Path(__file__).parent / ".env")

key = os.getenv("ANTHROPIC_API_KEY", "NOT FOUND")
print("API KEY:", key[:20] + "..." if key != "NOT FOUND" else "NOT FOUND")

from services.followup_generator import generate_followup
result = generate_followup(
    question_text='What is a hash map?',
    transcript='A hash map stores key value pairs using a hash function to compute an index into a bucket array',
    score=6.5
)
print("Result:", result)
