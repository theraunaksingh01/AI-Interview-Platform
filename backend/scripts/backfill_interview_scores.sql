-- One-time backfill: populate interviews.overall_score, interviews.score_details,
-- interviews.report, and interviews.status from interview_answers.
--
-- Run manually (DO NOT auto-run from app code):
-- psql "$DATABASE_URL" -f backend/scripts/backfill_interview_scores.sql

WITH latest_answers AS (
    SELECT
        iq.interview_id,
        iq.id AS question_id,
        iq.question_text,
        ia.overall_score,
        ia.rubric_scores,
        ia.strengths,
        ia.weaknesses,
        ROW_NUMBER() OVER (
            PARTITION BY iq.id
            ORDER BY ia.created_at DESC NULLS LAST, ia.id DESC
        ) AS rn
    FROM interview_questions iq
    LEFT JOIN interview_answers ia
        ON ia.interview_question_id = iq.id
),
q AS (
    SELECT
        interview_id,
        question_id,
        question_text,
        overall_score,
        COALESCE(rubric_scores, '{}'::jsonb) AS rubric_scores,
        COALESCE(strengths, '[]'::jsonb) AS strengths,
        COALESCE(weaknesses, '[]'::jsonb) AS weaknesses
    FROM latest_answers
    WHERE rn = 1
),
agg AS (
    SELECT
        interview_id,
        ROUND(COALESCE(AVG(overall_score), 0))::int AS overall_score,
        ROUND(COALESCE(AVG(COALESCE((rubric_scores->>'technical')::numeric, (rubric_scores->>'technical_accuracy')::numeric)), 0))::int AS technical,
        ROUND(COALESCE(AVG(COALESCE((rubric_scores->>'communication')::numeric, (rubric_scores->>'communication_clarity')::numeric, (rubric_scores->>'clarity')::numeric)), 0))::int AS communication,
        ROUND(COALESCE(AVG(COALESCE((rubric_scores->>'completeness')::numeric, (rubric_scores->>'relevance')::numeric, (rubric_scores->>'concept_understanding')::numeric)), 0))::int AS completeness,
        jsonb_agg(
            jsonb_build_object(
                'question_id', question_id,
                'question_text', question_text,
                'score', overall_score,
                'rubric', rubric_scores
            )
            ORDER BY question_id
        ) AS per_question
    FROM q
    GROUP BY interview_id
),
strengths_agg AS (
    SELECT interview_id, jsonb_agg(DISTINCT s.value) AS strengths
    FROM q
    CROSS JOIN LATERAL jsonb_array_elements_text(q.strengths) AS s(value)
    GROUP BY interview_id
),
weaknesses_agg AS (
    SELECT interview_id, jsonb_agg(DISTINCT w.value) AS weaknesses
    FROM q
    CROSS JOIN LATERAL jsonb_array_elements_text(q.weaknesses) AS w(value)
    GROUP BY interview_id
)
UPDATE interviews i
SET
    overall_score = a.overall_score,
    score_details = jsonb_build_object(
        'technical', a.technical,
        'communication', a.communication,
        'completeness', a.completeness,
        'per_question', COALESCE(a.per_question, '[]'::jsonb)
    ),
    report = jsonb_build_object(
        'summary', 'Interview completed',
        'strengths', COALESCE(sa.strengths, '[]'::jsonb),
        'weaknesses', COALESCE(wa.weaknesses, '[]'::jsonb),
        'overall_score', a.overall_score
    ),
    status = 'completed'
FROM agg a
LEFT JOIN strengths_agg sa ON sa.interview_id = a.interview_id
LEFT JOIN weaknesses_agg wa ON wa.interview_id = a.interview_id
WHERE i.id = a.interview_id
  AND (
      i.overall_score IS NULL
      OR i.score_details IS NULL
      OR i.report IS NULL
      OR i.status IS DISTINCT FROM 'completed'
  );
