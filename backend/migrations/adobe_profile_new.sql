INSERT INTO company_profiles (
  company, slug, logo_emoji, description,
  hires_annually, salary_range, difficulty_range, interview_style,
  most_asked_topics, what_they_value, common_questions, tips,
  oa_pattern, hiring_process, tier, is_published
)
VALUES (
  'Adobe',
  'adobe',
  '🎨',
  'Adobe India — Software Development Engineer (MTS) roles across product engineering, cloud infrastructure, and AI features, largely serving Creative Cloud products like Photoshop and Premiere Pro. Distinctive emphasis on performance and code optimization, since Adobe''s tools run on millions of professional devices.',
  '~300-400 across campus and off-campus',
  'Rs.35-45 LPA',
  'Hard',
  'DSA-heavy with an unusually strong focus on code optimization and performance — Adobe interviewers push specifically on making algorithms run efficiently, not just correctly, since their software runs performance-critical creative workflows. System design fundamentals are asked even at fresher level.',

  '["arrays, strings, trees, graphs, dynamic programming", "time and space complexity optimization", "system design basics (even for freshers)", "OOP and design patterns", "C++/Java proficiency"]'::jsonb,

  ARRAY['Code that runs efficiently, not just correctly — Adobe explicitly probes for optimization', 'Strong fundamentals in C++, Java, or Python with genuine depth, not surface familiarity', 'Clean, maintainable code and comfort with code review discussions', 'Creative, product-minded problem solving — Adobe frames itself as hiring "inventors," not just coders'],

  ARRAY['Optimize a given algorithm from a brute-force to a faster time complexity', 'How would you design a scalable file storage and sync system? (system design, even for freshers)', 'Standard DSA — trees, graphs, dynamic programming problems', 'Walk through a project and the specific trade-offs and optimizations you made', 'Behavioral: how do you handle tight deadlines and team disagreements?'],

  ARRAY['Adobe interviewers have low tolerance for "good enough" — always discuss how you would optimize your first working solution further, even if it already passes', 'Prepare at least a basic system design framework even for fresher/SDE-1 roles — Adobe asks conceptual scalability questions earlier than most companies', 'Be ready to discuss your project''s performance trade-offs in real depth, not just what it does', 'Pick one language (Java, C++, or Python) and go deep rather than spreading thin across all three', 'The full loop typically takes 2-3 weeks end-to-end from OA to offer'],

  '{
    "tracks": ["Software Development Engineer (MTS)"],
    "sections": [
      {"name": "Coding Problems", "type": "coding", "time_min": 90, "questions": 3}
    ],
    "behaviors": ["2-3 DSA problems, medium difficulty", "Some drives split into aptitude + coding blocks", "Eligibility: 7.5+ CGPA or 75% typical, no active backlogs"],
    "total_time": 90,
    "total_questions": 3
  }'::jsonb,

  '[
    {"name": "Online Coding Round", "step": 1, "duration": "90 min", "description": "2-3 DSA problems, medium difficulty. Some drives include a split aptitude + coding format."},
    {"name": "Technical Interview 1", "step": 2, "duration": "60 min", "description": "DSA-focused with a strong push toward optimization — expect follow-up questions asking you to improve your solution''s time or space complexity after you get a working answer."},
    {"name": "Technical Interview 2", "step": 3, "duration": "60 min", "description": "System design fundamentals (even for freshers) plus project deep-dive — expect questions on scalability and trade-offs in whatever you have built."},
    {"name": "HR / Behavioral Round", "step": 4, "duration": "30 min", "description": "Team dynamics, handling deadlines, and alignment with Adobe''s values around creativity and innovation."}
  ]'::jsonb,

  2,
  true
);
