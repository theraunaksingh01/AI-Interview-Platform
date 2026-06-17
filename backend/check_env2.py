import os
from dotenv import load_dotenv
from pathlib import Path
load_dotenv(Path(__file__).parent / '.env')
print('Key loaded:', bool(os.getenv('ANTHROPIC_API_KEY')))
