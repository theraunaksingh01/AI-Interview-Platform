import anthropic, os, sys
sys.path.insert(0, '.')
from dotenv import load_dotenv
load_dotenv('.env')
key = os.getenv('ANTHROPIC_API_KEY')
print(f'Key found: {key[:20]}...' if key else 'NO KEY FOUND')
client = anthropic.Anthropic(api_key=key)
msg = client.messages.create(
    model='claude-haiku-4-5-20251001',
    max_tokens=50,
    messages=[{'role': 'user', 'content': 'Say hello'}]
)
print(msg.content[0].text)
print('SUCCESS - Claude API working')
