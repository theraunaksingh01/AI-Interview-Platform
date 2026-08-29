INSERT INTO company_profiles (
  company, slug, logo_emoji, description,
  hires_annually, salary_range, difficulty_range, interview_style,
  most_asked_topics, what_they_value, common_questions, tips,
  oa_pattern, hiring_process, tier, is_published
)
VALUES (
  'Goldman Sachs',
  'goldman-sachs',
  '🏦',
  'Goldman Sachs India - Engineering Campus Hiring Program, hiring Software Engineer Analysts for its technology division. A major investment bank that hires heavily from engineering backgrounds, not just finance - its final round is distinctively called "Superday".',
  '~400-600 across campus and off-campus',
  'Rs.20-32 LPA',
  'Hard',
  'Structured, multi-stage process combining technical depth with genuine business/analytical thinking. Tier of college matters more here than at pure product companies - IIT/BITS candidates typically land the higher end of the salary band, NIT/Tier-2 candidates the lower end.',

  '["data structures and algorithms", "DBMS and SQL", "competitive programming style problems", "OOP concepts", "behavioral and situational judgment"]'::jsonb,

  ARRAY['Strong technical fundamentals combined with clear communication', 'Analytical thinking that extends beyond pure coding - Goldman values engineers who understand business context', 'Composure across multiple back-to-back interviews on Superday', 'Genuine interest in the intersection of technology and finance'],

  ARRAY['Standard DSA - arrays, trees, dynamic programming, competitive-programming-style problems', 'SQL query writing and DBMS fundamentals', 'OOP design questions in your language of choice', 'Why do you want to work at the intersection of tech and finance?', 'Describe a time you had to learn something completely new under time pressure'],

  ARRAY['Superday is Goldman Sachs distinctive final round - multiple back-to-back interviews in a single day, so build stamina by practicing several mock interviews consecutively, not just one at a time', 'A HireVue (recorded video interview) often comes before a live phone screen - practice answering confidently to a camera with no live interviewer reacting', 'Brush up on SQL and DBMS specifically - Goldman technical rounds lean more database-and-query-heavy than typical product companies', 'College tier genuinely affects starting offers here - IIT/BITS candidates should expect the top of the range, NIT/Tier-2 candidates the lower end, though performance in Superday can shift this', 'Prepare a genuine answer for why finance and tech - Goldman explicitly evaluates interest in this specific intersection, not generic why software engineering answers'],

  '{
    "tracks": ["Software Engineer Analyst"],
    "sections": [
      {"name": "Aptitude Test", "type": "mcq", "time_min": 30, "questions": 25},
      {"name": "Technical Test", "type": "coding", "time_min": 45, "questions": 2}
    ],
    "behaviors": ["Technical questions commonly cover C/C++, Java, Python, DBMS, and competitive programming", "Assessment platform varies by drive"],
    "total_time": 75,
    "total_questions": 27
  }'::jsonb,

  '[
    {"name": "Online Assessment", "step": 1, "duration": "75 min", "description": "Aptitude and analytical reasoning MCQs plus 1-2 coding problems covering DSA and competitive-programming-style questions."},
    {"name": "HireVue (Recorded Video Interview)", "step": 2, "duration": "20-30 min", "description": "Pre-recorded video responses to behavioral and situational prompts - no live interviewer, evaluated later by the hiring team."},
    {"name": "Phone Screen", "step": 3, "duration": "30-45 min", "description": "Live technical screen covering DSA, DBMS, and your resume and projects."},
    {"name": "Superday", "step": 4, "duration": "Full day", "description": "Goldman Sachs distinctive final-round format - multiple back-to-back interviews (technical and behavioral) in a single day, testing both depth and consistency across several conversations."}
  ]'::jsonb,

  2,
  true
);