-- New Google company profile — genuinely FAANG-tier hiring bar,
-- distinctive Hiring Committee review process and Googleyness round.

INSERT INTO company_profiles (
  company, slug, logo_emoji, description,
  hires_annually, salary_range, difficulty_range, interview_style,
  most_asked_topics, what_they_value, common_questions, tips,
  oa_pattern, hiring_process, tier, is_published
)
VALUES (
  'Google',
  'google',
  '🔍',
  'Google India — SDE (L3, New Grad) roles at India''s most selective tech employer. Approximately 0.2% of applicants get hired; among candidates who reach onsite interviews, roughly 20-30% succeed. Consistently high technical bar with a distinctive committee-based hiring process.',
  '~200-400 (extremely selective)',
  'Rs.25-45 LPA',
  'Hard',
  'Highly technical and structured. Interviewers narrate expectations clearly, but the bar for correctness, code quality, and communicating your reasoning out loud is genuinely high. A single weak round does not automatically mean rejection — a hiring committee reviews all feedback together.',

  '["DSA - arrays, trees, graphs, dynamic programming", "system design fundamentals (even for L3)", "Googleyness and leadership", "clean code and edge case handling", "time and space complexity trade-offs", "communicating your thought process aloud"]'::jsonb,

  ARRAY['Structured problem-solving over memorized solutions', 'Communicating your reasoning clearly while coding', 'Handling ambiguity and asking clarifying questions', 'Code quality and edge case awareness, not just a working solution', 'Genuine intellectual curiosity ("Googleyness")'],

  ARRAY['Two Sum variations and array/hashmap problems', 'Tree and graph traversal problems (BFS/DFS)', 'Dynamic programming — classic patterns (knapsack, longest subsequence)', 'Design a URL shortener or rate limiter (conceptual system design for L3)', 'Tell me about a time you dealt with ambiguity or changing requirements'],

  ARRAY['Practice explaining your approach out loud before writing any code — Google interviewers evaluate your reasoning, not just the final answer', 'Write clean, complete, runnable code — partial pseudocode is marked down even if the logic is correct', 'Always state time and space complexity without being asked', 'For system design questions even at L3 level, structure your answer: clarify requirements first, then design, then discuss trade-offs', 'A single weak interview does not mean rejection — the hiring committee reviews your full performance across all rounds together', 'If rejected, you can reapply after 6-12 months — many successful hires got in on a second or third attempt'],

  '{
    "tracks": ["SDE (New Grad / L3)"],
    "sections": [
      {"name": "Coding Problems", "type": "coding", "time_min": 90, "questions": 3},
      {"name": "CS Fundamentals MCQs", "type": "mcq", "time_min": 0, "questions": 18}
    ],
    "behaviors": ["No strict CGPA cutoff — 6.0+ minimum, though most selected candidates are 7.5-8.5", "Medium-to-hard difficulty coding problems", "Focus on correctness and clean code, not just passing test cases"],
    "total_time": 90,
    "total_questions": 21
  }'::jsonb,

  '[
    {"name": "Online Assessment", "step": 1, "duration": "90 min", "description": "2-3 medium-to-hard coding problems plus 15-20 CS fundamentals MCQs. No official published question bank — problems draw from a large rotating pool."},
    {"name": "Technical Interview Round 1", "step": 2, "duration": "45 min", "description": "Live coding on Google Meet — LeetCode medium-to-hard difficulty. Evaluated on correctness, code quality, and how clearly you narrate your approach."},
    {"name": "Technical Interview Round 2", "step": 3, "duration": "45 min", "description": "Second live coding round, often paired with a lightweight system design discussion for L3 candidates — rate limiters, URL shorteners, or feed ranking at a conceptual level."},
    {"name": "Googleyness and Leadership Round", "step": 4, "duration": "30-45 min", "description": "Behavioral round assessing ambiguity tolerance, collaboration style, and genuine intellectual curiosity — Google''s specific culture-fit framing."},
    {"name": "Hiring Committee Review", "step": 5, "duration": "Days to weeks", "description": "A dedicated hiring committee — not just your interviewers — reviews all feedback together before a final decision. This is Google''s distinctive step: no single interviewer''s opinion alone determines the outcome."}
  ]'::jsonb,

  2,
  true
);
