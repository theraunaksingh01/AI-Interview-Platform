-- LTIMindtree profile — consolidating the two stale pre-merger draft slugs
-- (lnt-infotech, mindtree) into one correctly-named, current profile.
-- Keeping "mindtree" as the canonical slug, updating company name to reflect
-- the actual 2022 merger. Deleting the redundant lnt-infotech duplicate.

UPDATE company_profiles
SET
  company = 'LTIMindtree',
  description = 'LTIMindtree — formed from the 2022 merger of L&T Infotech and Mindtree, now one of India''s top 5 IT services companies, with strong domain expertise in BFSI, manufacturing, and hi-tech. Known for better work-life balance than the largest IT firms.',

  oa_pattern = '{
    "tracks": ["Graduate Engineer Trainee", "Premium AI/Coding Track"],
    "sections": [
      {"name": "Verbal Ability", "type": "mcq", "time_min": 10, "questions": 10},
      {"name": "Quantitative Aptitude", "type": "mcq", "time_min": 15, "questions": 12},
      {"name": "Logical Reasoning", "type": "mcq", "time_min": 15, "questions": 15},
      {"name": "Coding", "type": "coding", "time_min": 20, "questions": 2}
    ],
    "behaviors": ["0.25 negative marking per wrong answer", "50 total questions across the test", "Non-elimination paragraph writing exercise (300-400 words) follows the test, reviewed at HR stage"],
    "total_time": 60,
    "total_questions": 50
  }'::jsonb,

  hiring_process = '[
    {"name": "Online Test + Paragraph Writing", "step": 1, "duration": "60 min + writing", "description": "6-section MCQ test (verbal, quant, logical reasoning, coding) with 0.25 negative marking, followed by a non-elimination 300-400 word paragraph writing exercise reviewed during the HR round."},
    {"name": "Technical Interview", "step": 2, "duration": "30-40 min", "description": "Covers the programming language on your resume, Data Structures and Algorithms, Operating Systems, and DBMS."},
    {"name": "HR Interview", "step": 3, "duration": "15-20 min", "description": "Standard HR round — reviews your paragraph writing submission alongside typical HR questions (motivation, strengths, career goals)."}
  ]'::jsonb,

  hires_annually = '~5,000',
  salary_range = 'Rs.4-6.5 LPA',
  difficulty_range = 'Easy-Medium',
  is_published = true

WHERE slug = 'mindtree';

-- Delete the redundant pre-merger L&T Infotech duplicate
DELETE FROM company_profiles WHERE slug = 'lnt-infotech';
