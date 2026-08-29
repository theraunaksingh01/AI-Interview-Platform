INSERT INTO company_profiles (
  company, slug, logo_emoji, description,
  hires_annually, salary_range, difficulty_range, interview_style,
  most_asked_topics, what_they_value, common_questions, tips,
  oa_pattern, hiring_process, tier, is_published
)
VALUES (
  'Meta',
  'meta',
  '📘',
  'Meta (formerly Facebook) India — Software Engineer, University Grad roles. For new-grad and junior-level candidates, the interview loop is coding-and-behavioral heavy — system design is typically not a standalone round at this level.',
  '~150-300 (highly selective)',
  'Rs.28-40 LPA',
  'Hard',
  'LeetCode-style coding rounds with a structured, scorecard-based behavioral round — not a free-flowing chat, even though it can feel conversational. Meta is currently piloting an AI-enabled coding round where you may optionally use AI tools during one interview — you are evaluated on your judgment and verification, not on whether you use the tool.',

  '["arrays and hashmaps", "graph traversal (BFS/DFS)", "dynamic programming", "behavioral - conflict resolution, ambiguity, driving results", "code correctness and complexity analysis", "debugging and code review (in the new AI-enabled round)"]'::jsonb,

  ARRAY['Structured problem-solving with clear communication', 'Verifying and testing your own code, not just producing a working answer', 'Handling follow-up questions and edge cases gracefully', 'For the AI-enabled round: critical thinking and informed decision-making when reviewing AI-suggested code, not blind acceptance', 'Resolving conflict, embracing ambiguity, communicating effectively (explicit behavioral scorecard criteria)'],

  ARRAY['Given a 2D binary matrix, find a path from top-left to bottom-right avoiding blocked cells (graph/BFS-DFS pattern)', 'Kth largest element in an array — optimize from brute force to a heap-based solution', 'Describe your most challenging project and what made it difficult', 'Tell me about a time you received difficult feedback and how you responded', 'Describe a disagreement with a teammate and how it was resolved'],

  ARRAY['Meta treats finding and fixing your own bugs as a positive signal — do not panic if you catch an error, calmly correct it', 'Always state time and space complexity without being prompted', 'For the behavioral round, prepare specific stories mapped to Meta''s actual scorecard categories: conflict resolution, growing continuously, embracing ambiguity, driving results, communicating effectively', 'If you land in the AI-enabled coding round, using the AI tool is optional — you are evaluated on your judgment reviewing its output, not how often you rely on it', 'System design is typically not a separate round for new-grad/junior roles — expect it as a light discussion within a coding round instead, if at all'],

  '{
    "tracks": ["Software Engineer, University Grad"],
    "sections": [
      {"name": "Recruiter Screen", "type": "call", "time_min": 25, "questions": 0},
      {"name": "Technical Phone Screen", "type": "coding", "time_min": 45, "questions": 2}
    ],
    "behaviors": ["CoderPad shared editor used for coding rounds", "Code is not executed live in some rounds — minor syntax errors are forgiven", "One coding round may be the new AI-enabled format with optional AI tool access"],
    "total_time": 45,
    "total_questions": 2
  }'::jsonb,

  '[
    {"name": "Recruiter Screen", "step": 1, "duration": "20-30 min", "description": "Short call confirming your background and which focus area you will interview for."},
    {"name": "Technical Phone Screen", "step": 2, "duration": "45 min", "description": "Live coding on CoderPad — typically two medium-difficulty problems, arrays/hashmaps/graphs are common. Evaluated on problem solving, coding, verification, and communication."},
    {"name": "Onsite — Coding Round(s)", "step": 3, "duration": "45-60 min each", "description": "1-2 further coding rounds, LeetCode medium-to-hard. One round may be the AI-enabled format — a single multi-stage problem with optional AI assistance in CoderPad, testing your judgment reviewing AI-suggested code."},
    {"name": "Behavioral Interview", "step": 4, "duration": "45 min", "description": "Structured, scorecard-based evaluation — conflict resolution, growing continuously, embracing ambiguity, driving results, communicating effectively. Not a casual chat despite the conversational feel."},
    {"name": "Team Matching", "step": 5, "duration": "Days to weeks", "description": "Strong candidates who clear the full loop go through team matching before receiving a final offer."}
  ]'::jsonb,

  2,
  true
);
