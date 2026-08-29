INSERT INTO company_profiles (
  company, slug, logo_emoji, description,
  hires_annually, salary_range, difficulty_range, interview_style,
  most_asked_topics, what_they_value, common_questions, tips,
  oa_pattern, hiring_process, tier, is_published
)
VALUES (
  'Flipkart',
  'flipkart',
  '🛒',
  'Flipkart — India''s largest e-commerce company, hiring SDE-1 freshers through campus, off-campus, GRiD (India''s largest engineering tech competition), Runway (for non-traditional backgrounds), and GiRL (women-focused hiring). Known for its distinctive Machine Coding round.',
  '~350-400 campus SDE hires',
  'Rs.18-25 LPA',
  'Hard',
  'DSA-focused with a genuinely distinctive Machine Coding round — you build a working, extensible, object-oriented program from a real-world problem statement, not just solve an algorithm puzzle. Candidates who only prepare DSA often struggle here because it tests software design, not algorithmic thinking.',

  '["arrays, trees, graphs, linked lists, dynamic programming", "machine coding - clean OOP design under time pressure", "low-level design fundamentals", "database and OOP concepts", "project discussion"]'::jsonb,

  ARRAY['Clean, extensible object-oriented code over a quick brute-force solution', 'Edge case handling and code that actually runs, not just pseudocode', 'Software design thinking, not just algorithmic problem-solving', 'Cultural fit and motivation alongside technical skill'],

  ARRAY['Design a Splitwise-style expense splitter with clean OOP', 'Design a simplified ride-matching or food delivery order-tracking system', 'Implement an LRU cache with custom eviction rules', 'Standard DSA — arrays, trees, graphs, dynamic programming problems', 'Walk me through a project you are proud of and the trade-offs you made'],

  ARRAY['The Machine Coding round is Flipkart''s real differentiator — practice building small, complete, runnable systems (parking lot, expense splitter, booking system) in 90-120 minutes, not just solving algorithm problems', 'Evaluation for machine coding is working code + clean OOP + extensibility + edge cases — a correct-but-messy solution scores lower than a slightly simpler but well-structured one', 'For SDE-1/fresher roles, expect DSA plus a lighter low-level design discussion — full high-level system design is typically reserved for SDE-2 and above', 'GRiD is open to Tier-2 and Tier-3 college students and uses real-world problem-solving as the filter, not institutional prestige', 'The full loop typically takes 21-30 days from first assessment to offer'],

  '{
    "tracks": ["SDE-1 (Fresher)"],
    "sections": [
      {"name": "Coding Problems", "type": "coding", "time_min": 90, "questions": 3}
    ],
    "behaviors": ["HackerRank platform", "Medium-to-hard difficulty", "Eligibility: 60-65% or 6.5+ CGPA, CSE/IT/ECE, no active backlogs"],
    "total_time": 90,
    "total_questions": 3
  }'::jsonb,

  '[
    {"name": "Online Assessment", "step": 1, "duration": "90 min", "description": "3 medium-to-hard DSA problems on HackerRank."},
    {"name": "Machine Coding Round", "step": 2, "duration": "90-120 min", "description": "Flipkart''s defining round — build a small, working, extensible program from a real-world problem statement (expense splitter, parking lot, ride-matching system). Evaluated on clean OOP design and edge-case handling, not raw algorithm speed."},
    {"name": "Technical Interview(s)", "step": 3, "duration": "45-60 min each", "description": "1-2 rounds covering DSA (arrays/trees/graphs/DP), a lighter low-level design discussion for fresher roles, and project deep-dive."},
    {"name": "HR / Cultural Fit Interview", "step": 4, "duration": "20-30 min", "description": "Focuses on cultural fit, motivation, and alignment with Flipkart''s values — consumer obsession, data-based decision-making, ownership."}
  ]'::jsonb,

  2,
  true
);
