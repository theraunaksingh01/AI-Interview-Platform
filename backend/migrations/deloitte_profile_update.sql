-- Deloitte company profile completion
-- Fills description, oa_pattern, hiring_process based on real 2026 process
-- (Deloitte USI — the entity engineering freshers actually encounter)

UPDATE company_profiles
SET
  description = 'Deloitte USI (US-India) — one of the Big Four, hiring engineering graduates for Business Technology Analyst and Risk & Financial Advisory Analyst roles serving US-based clients from delivery centres across India.',

  oa_pattern = '{
    "tracks": ["Business Technology Analyst", "Risk and Financial Advisory Analyst"],
    "sections": [
      {"name": "Quantitative Aptitude", "type": "mcq", "time_min": 25, "questions": 20},
      {"name": "Logical Reasoning", "type": "mcq", "time_min": 20, "questions": 15},
      {"name": "Verbal Ability", "type": "mcq", "time_min": 20, "questions": 13},
      {"name": "Coding", "type": "coding", "time_min": 25, "questions": 1}
    ],
    "behaviors": ["Cutoff typically around 70th percentile", "AMCAT-format platform", "Coding section now integrated into main OA — no separate round"],
    "total_time": 90,
    "total_questions": 49
  }'::jsonb,

  hiring_process = '[
    {"name": "Online Assessment", "step": 1, "duration": "90 min", "description": "Quantitative, Logical Reasoning, Verbal Ability MCQs plus one coding question. Cutoff is typically around the 70th percentile."},
    {"name": "Technical + HR Interview", "step": 2, "duration": "30-40 min", "description": "Consolidated single round for most engineering tracks — OOP, data structures, project walkthrough, plus standard HR questions (why Deloitte, career goals, relocation). Older guides mention a separate GD/JAM round — this has been dropped from the current process."},
    {"name": "Offer", "step": 3, "duration": "—", "description": "Typical fresher offers for Deloitte USI technology consulting roles fall in the 6.5-8 LPA range."}
  ]'::jsonb

WHERE slug = 'deloitte';
