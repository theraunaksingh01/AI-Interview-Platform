import sys
sys.path.insert(0, '.')
from tasks.generate_coaching_report import generate_coaching_report
result = generate_coaching_report('87d267c4-c5da-4af3-a372-13ee41087dea')
print('Result:', result)
