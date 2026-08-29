UPDATE company_profiles
SET
  description = 'Mphasis — IT services company hiring engineering graduates as Associate Software Engineers across application development, testing, infrastructure services, and its Digital Risk division, serving clients globally.',

  oa_pattern = '{
    "tracks": ["Associate Software Engineer"],
    "sections": [
      {"name": "Aptitude Test", "type": "mcq", "time_min": 45, "questions": 40}
    ],
    "behaviors": ["Each round is elimination-based", "Communication Test/GD may follow depending on drive"],
    "total_time": 45,
    "total_questions": 40
  }'::jsonb,

  hiring_process = '[
    {"name": "Aptitude Test", "step": 1, "duration": "45 min", "description": "Quantitative aptitude and logical reasoning MCQs — standard IT-services screening format."},
    {"name": "Communication Test / Group Discussion", "step": 2, "duration": "20-30 min", "description": "Assesses verbal communication and teamwork — format varies by drive, sometimes a written communication test instead of live GD."},
    {"name": "Personal Interview", "step": 3, "duration": "20-30 min", "description": "Technical fundamentals (programming language, basic DSA) combined with fit assessment against Mphasis values — passion, perseverance, perfection. Career ambition and long-term fit are specifically evaluated."},
    {"name": "Offer", "step": 4, "duration": "—", "description": "Selected candidates undergo verification before receiving the appointment letter. No probation period — structured onboarding and training instead."}
  ]'::jsonb,

  hires_annually = '1,500-2,500',
  salary_range = 'Rs.3.5-4.5 LPA',
  difficulty_range = 'Easy',
  is_published = true

WHERE slug = 'mphasis';
