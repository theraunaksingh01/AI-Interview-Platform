UPDATE company_profiles
SET
  description = 'IBM India — global technology leader hiring for the Associate Systems Engineer (ASE) role across cloud infrastructure, managed services, and AI-augmented platform engineering, with structured campus and off-campus hiring tracks.',

  oa_pattern = '{
    "tracks": ["Associate Systems Engineer"],
    "sections": [
      {"name": "Coding Test", "type": "coding", "time_min": 30, "questions": 2},
      {"name": "English Language Assessment", "type": "mcq", "time_min": 10, "questions": 10},
      {"name": "Learning Agility / Cognitive Ability", "type": "mcq", "time_min": 20, "questions": 15}
    ],
    "behaviors": ["Every round is eliminatory — must clear each stage to progress", "No negative marking", "HackerRank platform for coding round"],
    "total_time": 60,
    "total_questions": 27
  }'::jsonb,

  hiring_process = '[
    {"name": "Online Coding Test", "step": 1, "duration": "30 min", "description": "2 coding problems on HackerRank — array/string manipulation and DSA fundamentals, in Java, C, C++, Python, or Node.js."},
    {"name": "English Language Assessment", "step": 2, "duration": "10 min", "description": "Grammar, vocabulary, sentence correction, reading comprehension — evaluates communication ability for client-facing work."},
    {"name": "Group Discussion", "step": 3, "duration": "15-20 min", "description": "Campus drives only. Topic-based discussion on abstract, current affairs, business, or tech topics — assesses communication and leadership. Off-campus applicants typically skip this round."},
    {"name": "Technical + HR Interview", "step": 4, "duration": "30-40 min", "description": "Combined round covering DSA, DBMS, OS, networking, OOP, project walkthrough, plus standard HR questions (motivation, strengths/weaknesses, relocation willingness). IBM maintains a fixed compensation structure for freshers — salary is not negotiated."}
  ]'::jsonb

WHERE slug = 'ibm';
