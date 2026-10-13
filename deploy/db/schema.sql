--
-- PostgreSQL database dump
--

\restrict mg3J1WP2bfoOaZwdcE8b4JiL359ysSYR4TSiDKmeveETwca8GYNVY0778KFKbm0

-- Dumped from database version 18.0
-- Dumped by pg_dump version 18.0

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

-- *not* creating schema, since initdb creates it


--
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;


--
-- Name: EXTENSION pgcrypto; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION pgcrypto IS 'cryptographic functions';


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: alembic_version; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.alembic_version (
    version_num character varying(32) NOT NULL
);


--
-- Name: assessment_attempts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.assessment_attempts (
    id integer NOT NULL,
    user_id integer,
    guest_token character varying(64),
    total_score double precision,
    section_scores jsonb,
    answers jsonb,
    voice_transcript text,
    voice_evaluation jsonb,
    self_assessment jsonb,
    target_companies text[],
    placement_months_away integer,
    biggest_gap character varying(50),
    status character varying(20) DEFAULT 'in_progress'::character varying NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: assessment_attempts_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.assessment_attempts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: assessment_attempts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.assessment_attempts_id_seq OWNED BY public.assessment_attempts.id;


--
-- Name: assessment_questions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.assessment_questions (
    id integer NOT NULL,
    question_text text NOT NULL,
    question_type character varying(20) DEFAULT 'mcq'::character varying NOT NULL,
    section character varying(30) NOT NULL,
    topic character varying(50),
    options jsonb,
    correct_option integer,
    difficulty character varying(10),
    explanation text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: assessment_questions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.assessment_questions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: assessment_questions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.assessment_questions_id_seq OWNED BY public.assessment_questions.id;


--
-- Name: candidate_question_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.candidate_question_history (
    candidate_email text NOT NULL,
    question_id integer NOT NULL,
    interview_id uuid,
    seen_at timestamp with time zone DEFAULT now(),
    mock_session_id uuid,
    times_retried integer DEFAULT 0,
    best_score numeric
);


--
-- Name: candidate_resumes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.candidate_resumes (
    id integer NOT NULL,
    user_id integer NOT NULL,
    role_id integer,
    upload_id integer,
    plain_text text,
    skills jsonb DEFAULT '[]'::jsonb,
    parsed jsonb,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: candidate_resumes_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.candidate_resumes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: candidate_resumes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.candidate_resumes_id_seq OWNED BY public.candidate_resumes.id;


--
-- Name: cheat_sheet_cache; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cheat_sheet_cache (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id integer NOT NULL,
    company character varying(100) NOT NULL,
    content jsonb NOT NULL,
    generated_at timestamp with time zone NOT NULL,
    expires_at timestamp with time zone NOT NULL
);


--
-- Name: cheat_signals; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cheat_signals (
    id integer NOT NULL,
    interview_answer_id integer NOT NULL,
    signal_type character varying(50) NOT NULL,
    signal_category character varying(1) NOT NULL,
    weight character varying(10) NOT NULL,
    details jsonb,
    fired_at timestamp without time zone DEFAULT now() NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    payload jsonb
);


--
-- Name: cheat_signals_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.cheat_signals_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: cheat_signals_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.cheat_signals_id_seq OWNED BY public.cheat_signals.id;


--
-- Name: coaching_feedback_flags; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.coaching_feedback_flags (
    id integer NOT NULL,
    answer_id integer NOT NULL,
    user_id integer,
    flag_reason text,
    flagged_text text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: coaching_feedback_flags_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.coaching_feedback_flags_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: coaching_feedback_flags_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.coaching_feedback_flags_id_seq OWNED BY public.coaching_feedback_flags.id;


--
-- Name: communication_reports; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.communication_reports (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    session_id uuid NOT NULL,
    avg_wpm numeric(6,2),
    total_filler_words integer,
    filler_breakdown jsonb,
    total_silence_gaps integer,
    longest_silence_sec numeric(6,2),
    star_avg_score numeric(4,2),
    heatmap_data jsonb,
    top_issues text[],
    top_strengths text[],
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: company_profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.company_profiles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company character varying(100) NOT NULL,
    interview_pattern jsonb,
    most_asked_topics jsonb,
    interview_style text,
    difficulty_range character varying(50),
    typical_duration character varying(100),
    what_they_value text[],
    common_questions text[],
    tips text[],
    last_updated timestamp with time zone DEFAULT now(),
    slug character varying(50),
    logo_emoji character varying(10),
    description text,
    hires_annually character varying(50),
    salary_range character varying(50),
    hiring_process jsonb,
    oa_pattern jsonb,
    eligibility jsonb,
    salary jsonb,
    interview_experience_urls text[],
    is_published boolean DEFAULT false,
    tier integer DEFAULT 1
);


--
-- Name: daily_answers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.daily_answers (
    id integer NOT NULL,
    user_id integer,
    scheduled_date date NOT NULL,
    score numeric(5,2),
    transcript text,
    ai_feedback jsonb,
    better_answer text,
    answered_at timestamp with time zone DEFAULT now()
);


--
-- Name: daily_answers_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.daily_answers_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: daily_answers_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.daily_answers_id_seq OWNED BY public.daily_answers.id;


--
-- Name: daily_questions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.daily_questions (
    id integer NOT NULL,
    scheduled_date date NOT NULL,
    question_text text NOT NULL,
    topic character varying(50) NOT NULL,
    difficulty smallint NOT NULL,
    company_tag character varying(50),
    answer_framework text,
    model_answer text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: daily_questions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.daily_questions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: daily_questions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.daily_questions_id_seq OWNED BY public.daily_questions.id;


--
-- Name: dsa_attempts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.dsa_attempts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id integer NOT NULL,
    question_id integer NOT NULL,
    language character varying(10) DEFAULT 'python'::character varying NOT NULL,
    code text NOT NULL,
    status character varying(20) NOT NULL,
    test_cases_passed integer DEFAULT 0,
    test_cases_total integer DEFAULT 0,
    hints_revealed integer DEFAULT 0,
    execution_time_ms integer,
    is_first_solve boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: dsa_company_tags; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.dsa_company_tags (
    id integer NOT NULL,
    question_id integer NOT NULL,
    company character varying(100) NOT NULL,
    role character varying(100) DEFAULT 'SDE'::character varying,
    role_level character varying(50) DEFAULT 'fresher'::character varying,
    confidence character varying(20) DEFAULT 'likely'::character varying,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: dsa_company_tags_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.dsa_company_tags_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: dsa_company_tags_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.dsa_company_tags_id_seq OWNED BY public.dsa_company_tags.id;


--
-- Name: dsa_question_details; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.dsa_question_details (
    id integer NOT NULL,
    question_id integer NOT NULL,
    problem_statement text NOT NULL,
    input_format text,
    output_format text,
    function_signature text,
    constraints jsonb,
    sample_cases jsonb,
    hidden_test_cases jsonb,
    solution_code jsonb,
    solution_explanation text,
    time_complexity text,
    space_complexity text,
    brute_force_complexity jsonb,
    approach_tags text[],
    edge_cases text[],
    hints_progressive text[],
    common_mistakes text[],
    interview_followups jsonb
);


--
-- Name: dsa_question_details_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.dsa_question_details_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: dsa_question_details_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.dsa_question_details_id_seq OWNED BY public.dsa_question_details.id;


--
-- Name: dsa_questions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.dsa_questions (
    id integer NOT NULL,
    question_text text NOT NULL,
    problem_name character varying(200),
    difficulty character varying(10) NOT NULL,
    topic character varying(100) NOT NULL,
    subtopic character varying(100),
    tags text[],
    time_limit_minutes integer DEFAULT 15,
    quality_score double precision DEFAULT 0.5,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: dsa_questions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.dsa_questions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: dsa_questions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.dsa_questions_id_seq OWNED BY public.dsa_questions.id;


--
-- Name: flagged_questions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.flagged_questions (
    id integer NOT NULL,
    question_id integer NOT NULL,
    session_id uuid NOT NULL,
    user_id integer,
    reason character varying(32) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT flagged_questions_reason_check CHECK (((reason)::text = ANY ((ARRAY['wrong_topic'::character varying, 'wrong_language'::character varying, 'unclear_question'::character varying, 'other'::character varying])::text[])))
);


--
-- Name: flagged_questions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.flagged_questions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: flagged_questions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.flagged_questions_id_seq OWNED BY public.flagged_questions.id;


--
-- Name: follow_up_scores; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.follow_up_scores (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    interview_id uuid NOT NULL,
    question_id integer NOT NULL,
    followup_question_id integer,
    original_score numeric(5,2),
    followup_score numeric(5,2),
    depth_revealed character varying(10),
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: founding_applications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.founding_applications (
    id integer NOT NULL,
    name character varying(200) NOT NULL,
    email character varying(254) NOT NULL,
    college character varying(200) NOT NULL,
    city character varying(200) NOT NULL,
    branch character varying(200) NOT NULL,
    year character varying(200) NOT NULL,
    next_test character varying(200) NOT NULL,
    current_prep character varying(500) DEFAULT ''::character varying,
    whatsapp character varying(20) NOT NULL,
    agreed_feedback boolean DEFAULT false NOT NULL,
    agreed_contact boolean DEFAULT false NOT NULL,
    status character varying(12) DEFAULT 'applied'::character varying NOT NULL,
    notes text DEFAULT ''::text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT founding_applications_status_check CHECK (((status)::text = ANY ((ARRAY['applied'::character varying, 'accepted'::character varying, 'waitlist'::character varying, 'rejected'::character varying, 'joined'::character varying])::text[])))
);


--
-- Name: founding_applications_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.founding_applications_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: founding_applications_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.founding_applications_id_seq OWNED BY public.founding_applications.id;


--
-- Name: interruptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.interruptions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    interview_id uuid NOT NULL,
    question_id integer,
    trigger_type character varying(20) NOT NULL,
    transcript_at_trigger text,
    interruption_text text NOT NULL,
    was_fallback boolean DEFAULT false,
    interrupt_type character varying(20) DEFAULT 'content'::character varying,
    timestamp_seconds double precision,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: interview_answers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.interview_answers (
    id integer NOT NULL,
    interview_question_id integer,
    upload_id integer,
    code_answer text,
    transcript text,
    ai_feedback jsonb,
    red_flags jsonb,
    created_at timestamp without time zone DEFAULT now(),
    code_output text,
    test_results jsonb,
    cheat_flags jsonb DEFAULT '[]'::jsonb,
    llm_raw text,
    rubric_scores jsonb,
    overall_score double precision,
    strengths jsonb,
    weaknesses jsonb,
    is_followup boolean DEFAULT false NOT NULL,
    time_to_first_word double precision,
    silence_gaps jsonb,
    answer_word_count integer,
    attempt_number integer DEFAULT 1,
    parent_answer_id integer,
    retry_feedback text,
    improvement_from_previous numeric,
    star_compliance numeric,
    unique_word_ratio numeric,
    specific_fix text,
    wpm numeric,
    filler_count integer DEFAULT 0,
    agent_type text DEFAULT 'single'::text,
    feedback_confidence text DEFAULT 'high'::text,
    feedback_flagged boolean DEFAULT false,
    feedback_flag_count integer DEFAULT 0,
    CONSTRAINT interview_answers_agent_type_check CHECK ((agent_type = ANY (ARRAY['single'::text, 'technical'::text, 'behavioral'::text, 'hr'::text, 'observer'::text]))),
    CONSTRAINT interview_answers_feedback_confidence_check CHECK ((feedback_confidence = ANY (ARRAY['high'::text, 'medium'::text, 'low'::text])))
);


--
-- Name: interview_answers_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.interview_answers_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: interview_answers_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.interview_answers_id_seq OWNED BY public.interview_answers.id;


--
-- Name: interview_calendar; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.interview_calendar (
    id integer NOT NULL,
    user_id integer,
    company character varying(100) NOT NULL,
    role_target character varying(100) NOT NULL,
    interview_date date NOT NULL,
    days_remaining integer,
    prep_plan jsonb,
    coach_note text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: interview_calendar_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.interview_calendar_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: interview_calendar_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.interview_calendar_id_seq OWNED BY public.interview_calendar.id;


--
-- Name: interview_question_bank; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.interview_question_bank (
    id integer NOT NULL,
    question_text text NOT NULL,
    category character varying(30) NOT NULL,
    topic character varying(100),
    subtopic character varying(100),
    difficulty character varying(10) DEFAULT 'medium'::character varying,
    type character varying(10) DEFAULT 'voice'::character varying,
    role character varying(50) DEFAULT 'SDE'::character varying,
    is_language_specific boolean DEFAULT false,
    language_tag character varying(20),
    times_reported integer DEFAULT 1,
    expected_key_points text[],
    common_mistakes text[],
    follow_up_questions text[],
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: interview_question_bank_company_tags; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.interview_question_bank_company_tags (
    id integer NOT NULL,
    question_id integer NOT NULL,
    company character varying(100) NOT NULL,
    role character varying(100) DEFAULT 'SDE'::character varying,
    round character varying(50),
    source_url text,
    confidence character varying(20) DEFAULT 'likely'::character varying,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: interview_question_bank_company_tags_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.interview_question_bank_company_tags_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: interview_question_bank_company_tags_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.interview_question_bank_company_tags_id_seq OWNED BY public.interview_question_bank_company_tags.id;


--
-- Name: interview_question_bank_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.interview_question_bank_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: interview_question_bank_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.interview_question_bank_id_seq OWNED BY public.interview_question_bank.id;


--
-- Name: interview_questions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.interview_questions (
    id integer NOT NULL,
    interview_id uuid,
    question_text text NOT NULL,
    type character varying(20) NOT NULL,
    time_limit_seconds integer DEFAULT 120,
    description text,
    sample_cases jsonb,
    source text,
    blueprint jsonb,
    parent_question_id integer,
    topic character varying(100),
    difficulty smallint,
    question_bank_id integer,
    session_type text DEFAULT 'single'::text,
    "position" integer DEFAULT 0,
    CONSTRAINT interview_questions_session_type_check CHECK ((session_type = ANY (ARRAY['single'::text, 'behavioral'::text, 'dsa'::text, 'system_design'::text, 'communication'::text, 'multi_agent'::text])))
);


--
-- Name: interview_questions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.interview_questions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: interview_questions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.interview_questions_id_seq OWNED BY public.interview_questions.id;


--
-- Name: interview_score_audit; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.interview_score_audit (
    id bigint NOT NULL,
    interview_id uuid NOT NULL,
    scored_at timestamp with time zone DEFAULT now() NOT NULL,
    overall_score numeric(6,2),
    section_scores jsonb,
    per_question jsonb,
    model_meta jsonb,
    prompt_hash text,
    prompt_text text,
    weights jsonb,
    triggered_by text,
    task_id text,
    llm_raw_s3_key text,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: interview_score_audit_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.interview_score_audit_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: interview_score_audit_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.interview_score_audit_id_seq OWNED BY public.interview_score_audit.id;


--
-- Name: interview_scores; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.interview_scores (
    id integer NOT NULL,
    interview_id uuid NOT NULL,
    question_id integer NOT NULL,
    technical_score integer,
    communication_score integer,
    completeness_score integer,
    overall_score numeric,
    ai_feedback jsonb,
    created_at timestamp with time zone DEFAULT now(),
    llm_raw text,
    better_answer_example text
);


--
-- Name: interview_scores_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.interview_scores_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: interview_scores_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.interview_scores_id_seq OWNED BY public.interview_scores.id;


--
-- Name: interview_timeline; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.interview_timeline (
    id integer NOT NULL,
    interview_id uuid NOT NULL,
    question_id integer,
    event_type text NOT NULL,
    payload jsonb,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: interview_timeline_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.interview_timeline_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: interview_timeline_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.interview_timeline_id_seq OWNED BY public.interview_timeline.id;


--
-- Name: interview_turns; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.interview_turns (
    id bigint NOT NULL,
    interview_id uuid NOT NULL,
    question_id integer,
    speaker character varying(16) NOT NULL,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    ended_at timestamp with time zone,
    transcript text,
    asr_latency_ms integer,
    audio_s3_key text,
    meta jsonb DEFAULT '{}'::jsonb,
    CONSTRAINT interview_turns_speaker_check CHECK (((speaker)::text = ANY ((ARRAY['candidate'::character varying, 'agent'::character varying])::text[])))
);


--
-- Name: interview_turns_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.interview_turns_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: interview_turns_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.interview_turns_id_seq OWNED BY public.interview_turns.id;


--
-- Name: interviews; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.interviews (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    status text DEFAULT 'recording'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    user_id integer,
    overall_score integer,
    report jsonb,
    pdf_key text,
    role_id integer,
    resume_id integer,
    score_details jsonb,
    candidate_name text,
    candidate_email text,
    live_state jsonb DEFAULT '{}'::jsonb,
    application_id uuid,
    mock_session_id uuid
);


--
-- Name: job_applications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.job_applications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    job_id integer NOT NULL,
    candidate_email character varying(255) NOT NULL,
    candidate_name character varying(255),
    attempt_number integer DEFAULT 1 NOT NULL,
    status character varying(50) DEFAULT 'invited'::character varying NOT NULL,
    invite_token character varying(255) NOT NULL,
    invited_at timestamp with time zone DEFAULT now() NOT NULL,
    started_at timestamp with time zone,
    completed_at timestamp with time zone
);


--
-- Name: job_roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.job_roles (
    id integer NOT NULL,
    title text NOT NULL,
    jd_text text NOT NULL,
    skills jsonb DEFAULT '[]'::jsonb,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: job_roles_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.job_roles_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: job_roles_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.job_roles_id_seq OWNED BY public.job_roles.id;


--
-- Name: mock_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.mock_sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id integer,
    guest_token text,
    role_target text NOT NULL,
    seniority text NOT NULL,
    company_type text,
    focus_area text,
    resume_uploaded boolean DEFAULT false NOT NULL,
    duration_mins integer,
    status text DEFAULT 'in_progress'::text NOT NULL,
    overall_score numeric(4,2),
    dsa_score numeric(4,2),
    system_design_score numeric(4,2),
    behavioral_score numeric(4,2),
    communication_score numeric(4,2),
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    completed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    target_company text,
    session_type text DEFAULT 'single'::text,
    coach_agent text DEFAULT 'general'::text,
    total_retries integer DEFAULT 0,
    questions_retried integer DEFAULT 0,
    question_count integer DEFAULT 8,
    technical_score numeric,
    structure_score numeric,
    star_avg_score numeric,
    avg_wpm numeric,
    total_filler_words integer DEFAULT 0,
    specific_fix text,
    coaching_report jsonb,
    coach_note text,
    CONSTRAINT mock_sessions_coach_agent_check CHECK ((coach_agent = ANY (ARRAY['general'::text, 'behavioral'::text, 'dsa'::text, 'system_design'::text, 'communication'::text]))),
    CONSTRAINT mock_sessions_session_type_check CHECK ((session_type = ANY (ARRAY['single'::text, 'behavioral'::text, 'dsa'::text, 'system_design'::text, 'communication'::text, 'multi_agent'::text, 'resume_prep'::text])))
);


--
-- Name: multi_agent_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.multi_agent_sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    mock_session_id uuid,
    user_id integer,
    technical_agent_score numeric,
    hr_agent_score numeric,
    observer_score numeric,
    technical_feedback jsonb DEFAULT '{}'::jsonb,
    hr_feedback jsonb DEFAULT '{}'::jsonb,
    observer_feedback jsonb DEFAULT '{}'::jsonb,
    panel_report jsonb DEFAULT '{}'::jsonb,
    overall_panel_score numeric,
    interruption_count integer DEFAULT 0,
    interruption_log jsonb DEFAULT '[]'::jsonb,
    started_at timestamp with time zone DEFAULT now(),
    completed_at timestamp with time zone
);


--
-- Name: oa_attempts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.oa_attempts (
    id integer NOT NULL,
    user_id integer,
    company character varying(30) NOT NULL,
    track character varying(20) DEFAULT 'foundation'::character varying,
    answers jsonb,
    section_scores jsonb,
    total_score double precision,
    band_prediction character varying(20),
    time_taken_sec integer,
    status character varying(20) DEFAULT 'in_progress'::character varying NOT NULL,
    started_at timestamp without time zone DEFAULT now() NOT NULL,
    completed_at timestamp without time zone,
    ended_early_reason character varying(50)
);


--
-- Name: oa_attempts_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.oa_attempts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: oa_attempts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.oa_attempts_id_seq OWNED BY public.oa_attempts.id;


--
-- Name: oa_questions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.oa_questions (
    id integer NOT NULL,
    question_text text NOT NULL,
    question_type character varying(20) DEFAULT 'mcq'::character varying NOT NULL,
    company character varying(30) NOT NULL,
    section character varying(30) NOT NULL,
    topic character varying(50),
    options jsonb,
    correct_option integer,
    difficulty character varying(10),
    explanation text,
    time_limit_sec integer DEFAULT 90,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: oa_questions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.oa_questions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: oa_questions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.oa_questions_id_seq OWNED BY public.oa_questions.id;


--
-- Name: peer_attempts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.peer_attempts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    room_id uuid NOT NULL,
    user_id integer NOT NULL,
    question_index integer NOT NULL,
    question_text text NOT NULL,
    transcript text,
    score_technical numeric(4,1),
    score_communication numeric(4,1),
    score_completeness numeric(4,1),
    overall_score numeric(5,2),
    completed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: peer_comparisons; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.peer_comparisons (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    room_id uuid NOT NULL,
    user_a_id integer NOT NULL,
    user_b_id integer NOT NULL,
    user_a_total_score numeric(5,2),
    user_b_total_score numeric(5,2),
    winner_id integer,
    per_question_comparison jsonb,
    overall_summary jsonb,
    generated_at timestamp with time zone DEFAULT now()
);


--
-- Name: peer_rooms; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.peer_rooms (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    room_code character varying(6) NOT NULL,
    created_by integer NOT NULL,
    company character varying(100),
    topic character varying(100),
    question_ids text[] NOT NULL,
    question_data jsonb NOT NULL,
    status character varying(20) DEFAULT 'waiting'::character varying,
    expires_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: peer_stats; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.peer_stats (
    user_id integer NOT NULL,
    total_rooms integer DEFAULT 0,
    wins integer DEFAULT 0,
    losses integer DEFAULT 0,
    draws integer DEFAULT 0,
    avg_score numeric(5,2),
    win_streak integer DEFAULT 0,
    best_win_streak integer DEFAULT 0,
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: promo_codes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.promo_codes (
    id integer NOT NULL,
    code character varying(32) NOT NULL,
    label character varying(80) NOT NULL,
    grant_plan character varying(10) NOT NULL,
    grant_days integer NOT NULL,
    max_uses integer NOT NULL,
    uses integer DEFAULT 0 NOT NULL,
    active boolean DEFAULT true NOT NULL,
    expires_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    require_accepted boolean DEFAULT false NOT NULL,
    CONSTRAINT promo_codes_check CHECK ((uses <= max_uses)),
    CONSTRAINT promo_codes_grant_days_check CHECK ((grant_days > 0)),
    CONSTRAINT promo_codes_grant_plan_check CHECK (((grant_plan)::text = ANY ((ARRAY['pro'::character varying, 'max'::character varying])::text[]))),
    CONSTRAINT promo_codes_max_uses_check CHECK ((max_uses > 0))
);


--
-- Name: promo_codes_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.promo_codes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: promo_codes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.promo_codes_id_seq OWNED BY public.promo_codes.id;


--
-- Name: promo_redemptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.promo_redemptions (
    id integer NOT NULL,
    user_id integer NOT NULL,
    code_id integer NOT NULL,
    redeemed_at timestamp with time zone DEFAULT now() NOT NULL,
    plan_granted character varying(10) NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    feedback_done boolean DEFAULT false NOT NULL
);


--
-- Name: promo_redemptions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.promo_redemptions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: promo_redemptions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.promo_redemptions_id_seq OWNED BY public.promo_redemptions.id;


--
-- Name: questions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.questions (
    id integer NOT NULL,
    question_text text NOT NULL,
    type character varying(10) DEFAULT 'voice'::character varying NOT NULL,
    topic character varying(100),
    difficulty smallint DEFAULT 3,
    role_tags text[],
    is_fundamental boolean DEFAULT false,
    source character varying(50) DEFAULT 'seeded'::character varying,
    expected_answer_framework text,
    follow_up_questions jsonb DEFAULT '[]'::jsonb,
    red_flag_answers text,
    times_used integer DEFAULT 0,
    avg_score double precision,
    quality_score double precision DEFAULT 0.5,
    assessment_type character varying(20) DEFAULT 'voice'::character varying,
    created_at timestamp with time zone DEFAULT now(),
    company_tags text[] DEFAULT '{}'::text[],
    coaching_tips text,
    common_mistakes text,
    ideal_answer_example text,
    star_required boolean DEFAULT false,
    needs_review boolean DEFAULT false NOT NULL,
    flag_count integer DEFAULT 0 NOT NULL,
    language_tag character varying(16)
);


--
-- Name: questions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.questions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: questions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.questions_id_seq OWNED BY public.questions.id;


--
-- Name: quick_prep_concept_results; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.quick_prep_concept_results (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    session_id uuid NOT NULL,
    concept_id uuid NOT NULL,
    result character varying(10) NOT NULL,
    student_transcript text,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: quick_prep_concepts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.quick_prep_concepts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    concept_name character varying(100) NOT NULL,
    topic character varying(100) NOT NULL,
    subtopic character varying(100),
    ask_prompt text NOT NULL,
    good_answer_summary text NOT NULL,
    refresher_short text NOT NULL,
    refresher_full text NOT NULL,
    interview_edge_tip text,
    rapid_fire_prompt text,
    rapid_fire_answer text,
    key_terms text[],
    difficulty character varying(10),
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: quick_prep_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.quick_prep_sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id integer NOT NULL,
    company character varying(100),
    duration_minutes integer NOT NULL,
    focus_area character varying(20),
    concepts_covered integer DEFAULT 0,
    concepts_solid integer DEFAULT 0,
    concepts_revised integer DEFAULT 0,
    concepts_new integer DEFAULT 0,
    concepts_skipped integer DEFAULT 0,
    was_audio_only boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: referral_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.referral_events (
    id integer NOT NULL,
    referrer_id integer NOT NULL,
    referred_id integer NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    reward_given boolean DEFAULT false NOT NULL,
    reward_type character varying(50),
    reward_value integer
);


--
-- Name: referral_events_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.referral_events_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: referral_events_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.referral_events_id_seq OWNED BY public.referral_events.id;


--
-- Name: responses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.responses (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    interview_id uuid NOT NULL,
    video_file_path text,
    transcript text,
    ai_feedback jsonb,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: resume_prep_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.resume_prep_sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    mock_session_id uuid NOT NULL,
    user_id integer NOT NULL,
    resume_data jsonb NOT NULL,
    role_target character varying(100),
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: role_difficulty_calibration; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.role_difficulty_calibration (
    id integer NOT NULL,
    role_id integer NOT NULL,
    avg_score double precision,
    total_interviews integer DEFAULT 0 NOT NULL,
    difficulty_profile jsonb DEFAULT '{}'::jsonb NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: role_difficulty_calibration_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.role_difficulty_calibration_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: role_difficulty_calibration_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.role_difficulty_calibration_id_seq OWNED BY public.role_difficulty_calibration.id;


--
-- Name: roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.roles (
    id integer NOT NULL,
    title character varying(200) NOT NULL,
    level character varying(50),
    jd_text text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    rubric_weights jsonb
);


--
-- Name: roles_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.roles_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: roles_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.roles_id_seq OWNED BY public.roles.id;


--
-- Name: session_attempts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.session_attempts (
    id integer NOT NULL,
    interview_question_id integer NOT NULL,
    interview_answer_id integer,
    attempt_number integer DEFAULT 1 NOT NULL,
    transcript text,
    score numeric,
    specific_feedback text,
    improvement_delta numeric,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: session_attempts_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.session_attempts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: session_attempts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.session_attempts_id_seq OWNED BY public.session_attempts.id;


--
-- Name: session_feedback; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.session_feedback (
    id integer NOT NULL,
    session_id uuid NOT NULL,
    user_id integer,
    score_fairness character varying(16),
    question_relevance character varying(16),
    wanted_topic character varying(32),
    would_recommend character varying(8),
    free_text text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT session_feedback_question_relevance_check CHECK (((question_relevance)::text = ANY ((ARRAY['yes'::character varying, 'somewhat'::character varying, 'no'::character varying])::text[]))),
    CONSTRAINT session_feedback_score_fairness_check CHECK (((score_fairness)::text = ANY ((ARRAY['too_harsh'::character varying, 'about_right'::character varying, 'too_easy'::character varying])::text[]))),
    CONSTRAINT session_feedback_wanted_topic_check CHECK (((wanted_topic)::text = ANY ((ARRAY['behavioural'::character varying, 'dsa'::character varying, 'system_design'::character varying, 'networking'::character varying])::text[]))),
    CONSTRAINT session_feedback_would_recommend_check CHECK (((would_recommend)::text = ANY ((ARRAY['yes'::character varying, 'maybe'::character varying, 'no'::character varying])::text[])))
);


--
-- Name: session_feedback_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.session_feedback_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: session_feedback_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.session_feedback_id_seq OWNED BY public.session_feedback.id;


--
-- Name: submitted_questions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.submitted_questions (
    id integer NOT NULL,
    user_id integer NOT NULL,
    company character varying(255) NOT NULL,
    role character varying(255) NOT NULL,
    round_type character varying(32) NOT NULL,
    interview_month integer NOT NULL,
    interview_year integer NOT NULL,
    question_text text NOT NULL,
    answer_hint text,
    topic character varying(32),
    status character varying(16) DEFAULT 'pending'::character varying NOT NULL,
    claude_verdict character varying(16),
    claude_reason text,
    reviewed_by integer,
    reviewed_at timestamp with time zone,
    credits_awarded boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT submitted_questions_claude_verdict_check CHECK (((claude_verdict)::text = ANY ((ARRAY['APPROVE'::character varying, 'REJECT'::character varying, 'MANUAL'::character varying])::text[]))),
    CONSTRAINT submitted_questions_interview_month_check CHECK (((interview_month >= 1) AND (interview_month <= 12))),
    CONSTRAINT submitted_questions_interview_year_check CHECK (((interview_year >= 2020) AND (interview_year <= 2030))),
    CONSTRAINT submitted_questions_question_text_check CHECK ((char_length(question_text) >= 20)),
    CONSTRAINT submitted_questions_round_type_check CHECK (((round_type)::text = ANY ((ARRAY['hr'::character varying, 'technical'::character varying, 'managerial'::character varying, 'aptitude'::character varying])::text[]))),
    CONSTRAINT submitted_questions_status_check CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'approved'::character varying, 'rejected'::character varying, 'duplicate'::character varying])::text[]))),
    CONSTRAINT submitted_questions_topic_check CHECK (((topic)::text = ANY ((ARRAY['behavioural'::character varying, 'dsa'::character varying, 'system_design'::character varying, 'networking'::character varying, 'dbms'::character varying, 'os'::character varying, 'oops'::character varying, 'general'::character varying])::text[])))
);


--
-- Name: submitted_questions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.submitted_questions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: submitted_questions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.submitted_questions_id_seq OWNED BY public.submitted_questions.id;


--
-- Name: topic_practice_results; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.topic_practice_results (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    session_id uuid NOT NULL,
    concept_id uuid,
    question_text text NOT NULL,
    student_transcript text,
    ai_feedback text,
    result character varying(20) NOT NULL,
    score numeric(4,1),
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: topic_practice_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.topic_practice_sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id integer NOT NULL,
    topic character varying(50) NOT NULL,
    subtopic character varying(100),
    questions_asked integer DEFAULT 0,
    questions_solid integer DEFAULT 0,
    questions_needs_work integer DEFAULT 0,
    questions_skipped integer DEFAULT 0,
    depth_reached character varying(20) DEFAULT 'basic'::character varying,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: uploads; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.uploads (
    id integer NOT NULL,
    user_id integer NOT NULL,
    key character varying(1024) NOT NULL,
    filename character varying(512) NOT NULL,
    content_type character varying(255),
    size integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    status character varying DEFAULT 'pending'::character varying NOT NULL,
    processor_job_id character varying(255),
    transcript text,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    ai_feedback jsonb
);


--
-- Name: uploads_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.uploads_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: uploads_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.uploads_id_seq OWNED BY public.uploads.id;


--
-- Name: user_notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_notifications (
    id integer NOT NULL,
    user_id integer NOT NULL,
    type character varying(32) NOT NULL,
    title text NOT NULL,
    body text,
    read boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: user_notifications_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.user_notifications_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: user_notifications_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.user_notifications_id_seq OWNED BY public.user_notifications.id;


--
-- Name: user_progress; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_progress (
    id integer NOT NULL,
    user_id integer NOT NULL,
    date date DEFAULT CURRENT_DATE NOT NULL,
    sessions_today integer DEFAULT 0,
    streak_days integer DEFAULT 0,
    longest_streak integer DEFAULT 0,
    total_sessions integer DEFAULT 0,
    avg_technical_7d numeric,
    avg_communication_7d numeric,
    avg_structure_7d numeric,
    avg_overall_7d numeric,
    best_overall_score numeric,
    best_technical numeric,
    best_communication numeric,
    best_structure numeric,
    weak_spots text[] DEFAULT '{}'::text[],
    companies_practiced text[] DEFAULT '{}'::text[],
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: user_progress_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.user_progress_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: user_progress_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.user_progress_id_seq OWNED BY public.user_progress.id;


--
-- Name: user_roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_roles (
    user_id integer NOT NULL,
    role_id integer NOT NULL
);


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id integer NOT NULL,
    email character varying(255) NOT NULL,
    full_name character varying(255),
    hashed_password character varying NOT NULL,
    is_active boolean NOT NULL,
    is_superuser boolean NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    plan text DEFAULT 'free'::text,
    plan_expires timestamp with time zone,
    college character varying(200),
    year_of_study character varying(20),
    branch character varying(50),
    placement_goal character varying(50),
    target_roles jsonb DEFAULT '[]'::jsonb,
    self_level character varying(20),
    onboarding_done boolean DEFAULT false,
    target_companies text[],
    linkedin_url text,
    github_url text,
    session_credits integer DEFAULT 0 NOT NULL,
    reset_token character varying(64),
    reset_token_expires timestamp with time zone,
    referral_code character varying(12) NOT NULL,
    referred_by integer,
    referral_count integer DEFAULT 0 NOT NULL,
    credits integer DEFAULT 0 NOT NULL,
    consent_audio_processing boolean DEFAULT false NOT NULL,
    consent_date timestamp with time zone,
    plan_expires_at timestamp with time zone,
    plan_source character varying(20)
);


--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- Name: assessment_attempts id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assessment_attempts ALTER COLUMN id SET DEFAULT nextval('public.assessment_attempts_id_seq'::regclass);


--
-- Name: assessment_questions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assessment_questions ALTER COLUMN id SET DEFAULT nextval('public.assessment_questions_id_seq'::regclass);


--
-- Name: candidate_resumes id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.candidate_resumes ALTER COLUMN id SET DEFAULT nextval('public.candidate_resumes_id_seq'::regclass);


--
-- Name: cheat_signals id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cheat_signals ALTER COLUMN id SET DEFAULT nextval('public.cheat_signals_id_seq'::regclass);


--
-- Name: coaching_feedback_flags id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coaching_feedback_flags ALTER COLUMN id SET DEFAULT nextval('public.coaching_feedback_flags_id_seq'::regclass);


--
-- Name: daily_answers id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.daily_answers ALTER COLUMN id SET DEFAULT nextval('public.daily_answers_id_seq'::regclass);


--
-- Name: daily_questions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.daily_questions ALTER COLUMN id SET DEFAULT nextval('public.daily_questions_id_seq'::regclass);


--
-- Name: dsa_company_tags id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dsa_company_tags ALTER COLUMN id SET DEFAULT nextval('public.dsa_company_tags_id_seq'::regclass);


--
-- Name: dsa_question_details id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dsa_question_details ALTER COLUMN id SET DEFAULT nextval('public.dsa_question_details_id_seq'::regclass);


--
-- Name: dsa_questions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dsa_questions ALTER COLUMN id SET DEFAULT nextval('public.dsa_questions_id_seq'::regclass);


--
-- Name: flagged_questions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.flagged_questions ALTER COLUMN id SET DEFAULT nextval('public.flagged_questions_id_seq'::regclass);


--
-- Name: founding_applications id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.founding_applications ALTER COLUMN id SET DEFAULT nextval('public.founding_applications_id_seq'::regclass);


--
-- Name: interview_answers id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.interview_answers ALTER COLUMN id SET DEFAULT nextval('public.interview_answers_id_seq'::regclass);


--
-- Name: interview_calendar id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.interview_calendar ALTER COLUMN id SET DEFAULT nextval('public.interview_calendar_id_seq'::regclass);


--
-- Name: interview_question_bank id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.interview_question_bank ALTER COLUMN id SET DEFAULT nextval('public.interview_question_bank_id_seq'::regclass);


--
-- Name: interview_question_bank_company_tags id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.interview_question_bank_company_tags ALTER COLUMN id SET DEFAULT nextval('public.interview_question_bank_company_tags_id_seq'::regclass);


--
-- Name: interview_questions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.interview_questions ALTER COLUMN id SET DEFAULT nextval('public.interview_questions_id_seq'::regclass);


--
-- Name: interview_score_audit id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.interview_score_audit ALTER COLUMN id SET DEFAULT nextval('public.interview_score_audit_id_seq'::regclass);


--
-- Name: interview_scores id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.interview_scores ALTER COLUMN id SET DEFAULT nextval('public.interview_scores_id_seq'::regclass);


--
-- Name: interview_timeline id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.interview_timeline ALTER COLUMN id SET DEFAULT nextval('public.interview_timeline_id_seq'::regclass);


--
-- Name: interview_turns id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.interview_turns ALTER COLUMN id SET DEFAULT nextval('public.interview_turns_id_seq'::regclass);


--
-- Name: job_roles id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_roles ALTER COLUMN id SET DEFAULT nextval('public.job_roles_id_seq'::regclass);


--
-- Name: oa_attempts id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.oa_attempts ALTER COLUMN id SET DEFAULT nextval('public.oa_attempts_id_seq'::regclass);


--
-- Name: oa_questions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.oa_questions ALTER COLUMN id SET DEFAULT nextval('public.oa_questions_id_seq'::regclass);


--
-- Name: promo_codes id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.promo_codes ALTER COLUMN id SET DEFAULT nextval('public.promo_codes_id_seq'::regclass);


--
-- Name: promo_redemptions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.promo_redemptions ALTER COLUMN id SET DEFAULT nextval('public.promo_redemptions_id_seq'::regclass);


--
-- Name: questions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.questions ALTER COLUMN id SET DEFAULT nextval('public.questions_id_seq'::regclass);


--
-- Name: referral_events id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.referral_events ALTER COLUMN id SET DEFAULT nextval('public.referral_events_id_seq'::regclass);


--
-- Name: role_difficulty_calibration id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_difficulty_calibration ALTER COLUMN id SET DEFAULT nextval('public.role_difficulty_calibration_id_seq'::regclass);


--
-- Name: roles id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roles ALTER COLUMN id SET DEFAULT nextval('public.roles_id_seq'::regclass);


--
-- Name: session_attempts id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.session_attempts ALTER COLUMN id SET DEFAULT nextval('public.session_attempts_id_seq'::regclass);


--
-- Name: session_feedback id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.session_feedback ALTER COLUMN id SET DEFAULT nextval('public.session_feedback_id_seq'::regclass);


--
-- Name: submitted_questions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.submitted_questions ALTER COLUMN id SET DEFAULT nextval('public.submitted_questions_id_seq'::regclass);


--
-- Name: uploads id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.uploads ALTER COLUMN id SET DEFAULT nextval('public.uploads_id_seq'::regclass);


--
-- Name: user_notifications id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_notifications ALTER COLUMN id SET DEFAULT nextval('public.user_notifications_id_seq'::regclass);


--
-- Name: user_progress id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_progress ALTER COLUMN id SET DEFAULT nextval('public.user_progress_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- Name: alembic_version alembic_version_pkc; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alembic_version
    ADD CONSTRAINT alembic_version_pkc PRIMARY KEY (version_num);


--
-- Name: assessment_attempts assessment_attempts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assessment_attempts
    ADD CONSTRAINT assessment_attempts_pkey PRIMARY KEY (id);


--
-- Name: assessment_questions assessment_questions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assessment_questions
    ADD CONSTRAINT assessment_questions_pkey PRIMARY KEY (id);


--
-- Name: candidate_question_history candidate_question_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.candidate_question_history
    ADD CONSTRAINT candidate_question_history_pkey PRIMARY KEY (candidate_email, question_id);


--
-- Name: candidate_resumes candidate_resumes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.candidate_resumes
    ADD CONSTRAINT candidate_resumes_pkey PRIMARY KEY (id);


--
-- Name: cheat_sheet_cache cheat_sheet_cache_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cheat_sheet_cache
    ADD CONSTRAINT cheat_sheet_cache_pkey PRIMARY KEY (id);


--
-- Name: cheat_sheet_cache cheat_sheet_cache_user_id_company_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cheat_sheet_cache
    ADD CONSTRAINT cheat_sheet_cache_user_id_company_key UNIQUE (user_id, company);


--
-- Name: cheat_signals cheat_signals_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cheat_signals
    ADD CONSTRAINT cheat_signals_pkey PRIMARY KEY (id);


--
-- Name: coaching_feedback_flags coaching_feedback_flags_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coaching_feedback_flags
    ADD CONSTRAINT coaching_feedback_flags_pkey PRIMARY KEY (id);


--
-- Name: communication_reports communication_reports_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.communication_reports
    ADD CONSTRAINT communication_reports_pkey PRIMARY KEY (id);


--
-- Name: company_profiles company_profiles_company_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.company_profiles
    ADD CONSTRAINT company_profiles_company_key UNIQUE (company);


--
-- Name: company_profiles company_profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.company_profiles
    ADD CONSTRAINT company_profiles_pkey PRIMARY KEY (id);


--
-- Name: company_profiles company_profiles_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.company_profiles
    ADD CONSTRAINT company_profiles_slug_key UNIQUE (slug);


--
-- Name: daily_answers daily_answers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.daily_answers
    ADD CONSTRAINT daily_answers_pkey PRIMARY KEY (id);


--
-- Name: daily_answers daily_answers_user_id_scheduled_date_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.daily_answers
    ADD CONSTRAINT daily_answers_user_id_scheduled_date_key UNIQUE (user_id, scheduled_date);


--
-- Name: daily_questions daily_questions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.daily_questions
    ADD CONSTRAINT daily_questions_pkey PRIMARY KEY (id);


--
-- Name: daily_questions daily_questions_scheduled_date_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.daily_questions
    ADD CONSTRAINT daily_questions_scheduled_date_key UNIQUE (scheduled_date);


--
-- Name: dsa_attempts dsa_attempts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dsa_attempts
    ADD CONSTRAINT dsa_attempts_pkey PRIMARY KEY (id);


--
-- Name: dsa_company_tags dsa_company_tags_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dsa_company_tags
    ADD CONSTRAINT dsa_company_tags_pkey PRIMARY KEY (id);


--
-- Name: dsa_question_details dsa_question_details_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dsa_question_details
    ADD CONSTRAINT dsa_question_details_pkey PRIMARY KEY (id);


--
-- Name: dsa_question_details dsa_question_details_question_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dsa_question_details
    ADD CONSTRAINT dsa_question_details_question_id_key UNIQUE (question_id);


--
-- Name: dsa_questions dsa_questions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dsa_questions
    ADD CONSTRAINT dsa_questions_pkey PRIMARY KEY (id);


--
-- Name: flagged_questions flagged_questions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.flagged_questions
    ADD CONSTRAINT flagged_questions_pkey PRIMARY KEY (id);


--
-- Name: follow_up_scores follow_up_scores_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.follow_up_scores
    ADD CONSTRAINT follow_up_scores_pkey PRIMARY KEY (id);


--
-- Name: founding_applications founding_applications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.founding_applications
    ADD CONSTRAINT founding_applications_pkey PRIMARY KEY (id);


--
-- Name: interruptions interruptions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.interruptions
    ADD CONSTRAINT interruptions_pkey PRIMARY KEY (id);


--
-- Name: interview_answers interview_answers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.interview_answers
    ADD CONSTRAINT interview_answers_pkey PRIMARY KEY (id);


--
-- Name: interview_calendar interview_calendar_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.interview_calendar
    ADD CONSTRAINT interview_calendar_pkey PRIMARY KEY (id);


--
-- Name: interview_calendar interview_calendar_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.interview_calendar
    ADD CONSTRAINT interview_calendar_user_id_key UNIQUE (user_id);


--
-- Name: interview_question_bank_company_tags interview_question_bank_company_tags_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.interview_question_bank_company_tags
    ADD CONSTRAINT interview_question_bank_company_tags_pkey PRIMARY KEY (id);


--
-- Name: interview_question_bank interview_question_bank_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.interview_question_bank
    ADD CONSTRAINT interview_question_bank_pkey PRIMARY KEY (id);


--
-- Name: interview_questions interview_questions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.interview_questions
    ADD CONSTRAINT interview_questions_pkey PRIMARY KEY (id);


--
-- Name: interview_score_audit interview_score_audit_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.interview_score_audit
    ADD CONSTRAINT interview_score_audit_pkey PRIMARY KEY (id);


--
-- Name: interview_scores interview_scores_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.interview_scores
    ADD CONSTRAINT interview_scores_pkey PRIMARY KEY (id);


--
-- Name: interview_timeline interview_timeline_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.interview_timeline
    ADD CONSTRAINT interview_timeline_pkey PRIMARY KEY (id);


--
-- Name: interview_turns interview_turns_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.interview_turns
    ADD CONSTRAINT interview_turns_pkey PRIMARY KEY (id);


--
-- Name: interviews interviews_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.interviews
    ADD CONSTRAINT interviews_pkey PRIMARY KEY (id);


--
-- Name: job_applications job_applications_invite_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_applications
    ADD CONSTRAINT job_applications_invite_token_key UNIQUE (invite_token);


--
-- Name: job_applications job_applications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_applications
    ADD CONSTRAINT job_applications_pkey PRIMARY KEY (id);


--
-- Name: job_roles job_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_roles
    ADD CONSTRAINT job_roles_pkey PRIMARY KEY (id);


--
-- Name: mock_sessions mock_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mock_sessions
    ADD CONSTRAINT mock_sessions_pkey PRIMARY KEY (id);


--
-- Name: multi_agent_sessions multi_agent_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.multi_agent_sessions
    ADD CONSTRAINT multi_agent_sessions_pkey PRIMARY KEY (id);


--
-- Name: oa_attempts oa_attempts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.oa_attempts
    ADD CONSTRAINT oa_attempts_pkey PRIMARY KEY (id);


--
-- Name: oa_questions oa_questions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.oa_questions
    ADD CONSTRAINT oa_questions_pkey PRIMARY KEY (id);


--
-- Name: peer_attempts peer_attempts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.peer_attempts
    ADD CONSTRAINT peer_attempts_pkey PRIMARY KEY (id);


--
-- Name: peer_attempts peer_attempts_room_id_user_id_question_index_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.peer_attempts
    ADD CONSTRAINT peer_attempts_room_id_user_id_question_index_key UNIQUE (room_id, user_id, question_index);


--
-- Name: peer_comparisons peer_comparisons_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.peer_comparisons
    ADD CONSTRAINT peer_comparisons_pkey PRIMARY KEY (id);


--
-- Name: peer_comparisons peer_comparisons_room_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.peer_comparisons
    ADD CONSTRAINT peer_comparisons_room_id_key UNIQUE (room_id);


--
-- Name: peer_rooms peer_rooms_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.peer_rooms
    ADD CONSTRAINT peer_rooms_pkey PRIMARY KEY (id);


--
-- Name: peer_rooms peer_rooms_room_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.peer_rooms
    ADD CONSTRAINT peer_rooms_room_code_key UNIQUE (room_code);


--
-- Name: peer_stats peer_stats_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.peer_stats
    ADD CONSTRAINT peer_stats_pkey PRIMARY KEY (user_id);


--
-- Name: promo_codes promo_codes_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.promo_codes
    ADD CONSTRAINT promo_codes_code_key UNIQUE (code);


--
-- Name: promo_codes promo_codes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.promo_codes
    ADD CONSTRAINT promo_codes_pkey PRIMARY KEY (id);


--
-- Name: promo_redemptions promo_redemptions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.promo_redemptions
    ADD CONSTRAINT promo_redemptions_pkey PRIMARY KEY (id);


--
-- Name: promo_redemptions promo_redemptions_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.promo_redemptions
    ADD CONSTRAINT promo_redemptions_user_id_key UNIQUE (user_id);


--
-- Name: questions questions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.questions
    ADD CONSTRAINT questions_pkey PRIMARY KEY (id);


--
-- Name: quick_prep_concept_results quick_prep_concept_results_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quick_prep_concept_results
    ADD CONSTRAINT quick_prep_concept_results_pkey PRIMARY KEY (id);


--
-- Name: quick_prep_concepts quick_prep_concepts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quick_prep_concepts
    ADD CONSTRAINT quick_prep_concepts_pkey PRIMARY KEY (id);


--
-- Name: quick_prep_sessions quick_prep_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quick_prep_sessions
    ADD CONSTRAINT quick_prep_sessions_pkey PRIMARY KEY (id);


--
-- Name: referral_events referral_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.referral_events
    ADD CONSTRAINT referral_events_pkey PRIMARY KEY (id);


--
-- Name: referral_events referral_events_referred_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.referral_events
    ADD CONSTRAINT referral_events_referred_id_key UNIQUE (referred_id);


--
-- Name: responses responses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.responses
    ADD CONSTRAINT responses_pkey PRIMARY KEY (id);


--
-- Name: resume_prep_sessions resume_prep_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.resume_prep_sessions
    ADD CONSTRAINT resume_prep_sessions_pkey PRIMARY KEY (id);


--
-- Name: role_difficulty_calibration role_difficulty_calibration_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_difficulty_calibration
    ADD CONSTRAINT role_difficulty_calibration_pkey PRIMARY KEY (id);


--
-- Name: roles roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_pkey PRIMARY KEY (id);


--
-- Name: session_attempts session_attempts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.session_attempts
    ADD CONSTRAINT session_attempts_pkey PRIMARY KEY (id);


--
-- Name: session_feedback session_feedback_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.session_feedback
    ADD CONSTRAINT session_feedback_pkey PRIMARY KEY (id);


--
-- Name: submitted_questions submitted_questions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.submitted_questions
    ADD CONSTRAINT submitted_questions_pkey PRIMARY KEY (id);


--
-- Name: topic_practice_results topic_practice_results_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.topic_practice_results
    ADD CONSTRAINT topic_practice_results_pkey PRIMARY KEY (id);


--
-- Name: topic_practice_sessions topic_practice_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.topic_practice_sessions
    ADD CONSTRAINT topic_practice_sessions_pkey PRIMARY KEY (id);


--
-- Name: uploads uploads_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.uploads
    ADD CONSTRAINT uploads_pkey PRIMARY KEY (id);


--
-- Name: user_notifications user_notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_notifications
    ADD CONSTRAINT user_notifications_pkey PRIMARY KEY (id);


--
-- Name: user_progress user_progress_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_progress
    ADD CONSTRAINT user_progress_pkey PRIMARY KEY (id);


--
-- Name: user_progress user_progress_user_id_date_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_progress
    ADD CONSTRAINT user_progress_user_id_date_key UNIQUE (user_id, date);


--
-- Name: user_roles user_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_pkey PRIMARY KEY (user_id, role_id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: users users_referral_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_referral_code_key UNIQUE (referral_code);


--
-- Name: interview_scores ux_interview_question_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.interview_scores
    ADD CONSTRAINT ux_interview_question_unique UNIQUE (interview_id, question_id);


--
-- Name: idx_aa_guest_token; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_aa_guest_token ON public.assessment_attempts USING btree (guest_token);


--
-- Name: idx_aa_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_aa_status ON public.assessment_attempts USING btree (status);


--
-- Name: idx_aa_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_aa_user_id ON public.assessment_attempts USING btree (user_id);


--
-- Name: idx_aq_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_aq_active ON public.assessment_questions USING btree (is_active);


--
-- Name: idx_aq_section; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_aq_section ON public.assessment_questions USING btree (section);


--
-- Name: idx_attempts_question; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_attempts_question ON public.session_attempts USING btree (interview_question_id);


--
-- Name: idx_cheat_sheet_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cheat_sheet_user ON public.cheat_sheet_cache USING btree (user_id);


--
-- Name: idx_company_profiles_published; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_company_profiles_published ON public.company_profiles USING btree (is_published);


--
-- Name: idx_company_profiles_slug; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_company_profiles_slug ON public.company_profiles USING btree (slug);


--
-- Name: idx_daily_answers_user_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_daily_answers_user_date ON public.daily_answers USING btree (user_id, scheduled_date);


--
-- Name: idx_dsa_attempts_question; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_dsa_attempts_question ON public.dsa_attempts USING btree (question_id);


--
-- Name: idx_dsa_attempts_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_dsa_attempts_user ON public.dsa_attempts USING btree (user_id);


--
-- Name: idx_dsa_attempts_user_question; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_dsa_attempts_user_question ON public.dsa_attempts USING btree (user_id, question_id);


--
-- Name: idx_dsa_company_tags_company; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_dsa_company_tags_company ON public.dsa_company_tags USING btree (company);


--
-- Name: idx_dsa_company_tags_question; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_dsa_company_tags_question ON public.dsa_company_tags USING btree (question_id);


--
-- Name: idx_dsa_questions_difficulty; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_dsa_questions_difficulty ON public.dsa_questions USING btree (difficulty);


--
-- Name: idx_dsa_questions_topic; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_dsa_questions_topic ON public.dsa_questions USING btree (topic);


--
-- Name: idx_flagged_questions_question_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_flagged_questions_question_id ON public.flagged_questions USING btree (question_id);


--
-- Name: idx_followup_scores_interview; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_followup_scores_interview ON public.follow_up_scores USING btree (interview_id);


--
-- Name: idx_founding_applications_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_founding_applications_status ON public.founding_applications USING btree (status);


--
-- Name: idx_interruptions_interview; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_interruptions_interview ON public.interruptions USING btree (interview_id);


--
-- Name: idx_interview_turns_interview_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_interview_turns_interview_id ON public.interview_turns USING btree (interview_id);


--
-- Name: idx_interview_turns_question_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_interview_turns_question_id ON public.interview_turns USING btree (question_id);


--
-- Name: idx_iqb_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_iqb_category ON public.interview_question_bank USING btree (category);


--
-- Name: idx_iqb_difficulty; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_iqb_difficulty ON public.interview_question_bank USING btree (difficulty);


--
-- Name: idx_iqb_role; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_iqb_role ON public.interview_question_bank USING btree (role);


--
-- Name: idx_iqb_topic; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_iqb_topic ON public.interview_question_bank USING btree (topic);


--
-- Name: idx_iqbct_company; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_iqbct_company ON public.interview_question_bank_company_tags USING btree (company);


--
-- Name: idx_iqbct_question; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_iqbct_question ON public.interview_question_bank_company_tags USING btree (question_id);


--
-- Name: idx_oa_attempts_company; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_oa_attempts_company ON public.oa_attempts USING btree (company);


--
-- Name: idx_oa_attempts_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_oa_attempts_status ON public.oa_attempts USING btree (status);


--
-- Name: idx_oa_attempts_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_oa_attempts_user ON public.oa_attempts USING btree (user_id);


--
-- Name: idx_oaq_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_oaq_active ON public.oa_questions USING btree (is_active);


--
-- Name: idx_oaq_company; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_oaq_company ON public.oa_questions USING btree (company);


--
-- Name: idx_oaq_section; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_oaq_section ON public.oa_questions USING btree (section);


--
-- Name: idx_peer_attempts_room; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_peer_attempts_room ON public.peer_attempts USING btree (room_id);


--
-- Name: idx_peer_attempts_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_peer_attempts_user ON public.peer_attempts USING btree (user_id);


--
-- Name: idx_peer_rooms_code; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_peer_rooms_code ON public.peer_rooms USING btree (room_code);


--
-- Name: idx_peer_rooms_created_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_peer_rooms_created_by ON public.peer_rooms USING btree (created_by);


--
-- Name: idx_promo_redemptions_code; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_promo_redemptions_code ON public.promo_redemptions USING btree (code_id);


--
-- Name: idx_questions_company; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_questions_company ON public.questions USING gin (company_tags);


--
-- Name: idx_questions_difficulty; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_questions_difficulty ON public.questions USING btree (difficulty);


--
-- Name: idx_questions_quality; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_questions_quality ON public.questions USING btree (quality_score DESC);


--
-- Name: idx_questions_role; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_questions_role ON public.questions USING gin (role_tags);


--
-- Name: idx_questions_role_company; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_questions_role_company ON public.questions USING gin (role_tags, company_tags);


--
-- Name: idx_questions_topic; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_questions_topic ON public.questions USING btree (topic);


--
-- Name: idx_questions_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_questions_type ON public.questions USING btree (type);


--
-- Name: idx_referral_events_referrer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_referral_events_referrer ON public.referral_events USING btree (referrer_id);


--
-- Name: idx_resume_prep_mock_session; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_resume_prep_mock_session ON public.resume_prep_sessions USING btree (mock_session_id);


--
-- Name: idx_session_feedback_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_session_feedback_created_at ON public.session_feedback USING btree (created_at DESC);


--
-- Name: idx_session_feedback_session_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_session_feedback_session_id ON public.session_feedback USING btree (session_id);


--
-- Name: idx_session_feedback_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_session_feedback_user_id ON public.session_feedback USING btree (user_id);


--
-- Name: idx_submitted_questions_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_submitted_questions_created_at ON public.submitted_questions USING btree (created_at DESC);


--
-- Name: idx_submitted_questions_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_submitted_questions_status ON public.submitted_questions USING btree (status);


--
-- Name: idx_submitted_questions_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_submitted_questions_user_id ON public.submitted_questions USING btree (user_id);


--
-- Name: idx_tp_results_session; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tp_results_session ON public.topic_practice_results USING btree (session_id);


--
-- Name: idx_tp_sessions_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tp_sessions_user ON public.topic_practice_sessions USING btree (user_id);


--
-- Name: idx_user_notifications_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_notifications_created_at ON public.user_notifications USING btree (created_at DESC);


--
-- Name: idx_user_notifications_read; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_notifications_read ON public.user_notifications USING btree (read);


--
-- Name: idx_user_notifications_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_notifications_user_id ON public.user_notifications USING btree (user_id);


--
-- Name: idx_user_progress_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_progress_date ON public.user_progress USING btree (user_id, date DESC);


--
-- Name: idx_user_progress_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_progress_user ON public.user_progress USING btree (user_id);


--
-- Name: idx_users_referral_code; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_referral_code ON public.users USING btree (referral_code);


--
-- Name: idx_users_referred_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_referred_by ON public.users USING btree (referred_by);


--
-- Name: ix_cheat_signals_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_cheat_signals_id ON public.cheat_signals USING btree (id);


--
-- Name: ix_cheat_signals_interview_answer_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_cheat_signals_interview_answer_id ON public.cheat_signals USING btree (interview_answer_id);


--
-- Name: ix_cheat_signals_signal_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_cheat_signals_signal_category ON public.cheat_signals USING btree (signal_category);


--
-- Name: ix_cheat_signals_signal_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_cheat_signals_signal_type ON public.cheat_signals USING btree (signal_type);


--
-- Name: ix_comm_reports_session_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_comm_reports_session_id ON public.communication_reports USING btree (session_id);


--
-- Name: ix_i_application_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_i_application_id ON public.interviews USING btree (application_id);


--
-- Name: ix_i_mock_session_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_i_mock_session_id ON public.interviews USING btree (mock_session_id);


--
-- Name: ix_interview_score_audit_interview_id_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_interview_score_audit_interview_id_created_at ON public.interview_score_audit USING btree (interview_id, created_at DESC);


--
-- Name: ix_interview_score_audit_prompt_hash; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_interview_score_audit_prompt_hash ON public.interview_score_audit USING btree (prompt_hash);


--
-- Name: ix_interview_score_audit_task_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_interview_score_audit_task_id ON public.interview_score_audit USING btree (task_id);


--
-- Name: ix_iq_parent_question_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_iq_parent_question_id ON public.interview_questions USING btree (parent_question_id);


--
-- Name: ix_ja_candidate_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_ja_candidate_email ON public.job_applications USING btree (candidate_email);


--
-- Name: ix_ja_invite_token; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_ja_invite_token ON public.job_applications USING btree (invite_token);


--
-- Name: ix_ja_job_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_ja_job_id ON public.job_applications USING btree (job_id);


--
-- Name: ix_ja_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_ja_status ON public.job_applications USING btree (status);


--
-- Name: ix_mock_sessions_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_mock_sessions_created_at ON public.mock_sessions USING btree (created_at);


--
-- Name: ix_mock_sessions_guest_token; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_mock_sessions_guest_token ON public.mock_sessions USING btree (guest_token);


--
-- Name: ix_mock_sessions_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_mock_sessions_status ON public.mock_sessions USING btree (status);


--
-- Name: ix_mock_sessions_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_mock_sessions_user_id ON public.mock_sessions USING btree (user_id);


--
-- Name: ix_rdc_role_id; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ix_rdc_role_id ON public.role_difficulty_calibration USING btree (role_id);


--
-- Name: ix_uploads_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_uploads_id ON public.uploads USING btree (id);


--
-- Name: ix_uploads_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ix_uploads_key ON public.uploads USING btree (key);


--
-- Name: ix_uploads_processor_job_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_uploads_processor_job_id ON public.uploads USING btree (processor_job_id);


--
-- Name: ix_uploads_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_uploads_user_id ON public.uploads USING btree (user_id);


--
-- Name: ix_users_email; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ix_users_email ON public.users USING btree (email);


--
-- Name: ix_users_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_users_id ON public.users USING btree (id);


--
-- Name: uq_founding_applications_email; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_founding_applications_email ON public.founding_applications USING btree (lower((email)::text));


--
-- Name: assessment_attempts assessment_attempts_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assessment_attempts
    ADD CONSTRAINT assessment_attempts_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: candidate_question_history candidate_question_history_mock_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.candidate_question_history
    ADD CONSTRAINT candidate_question_history_mock_session_id_fkey FOREIGN KEY (mock_session_id) REFERENCES public.mock_sessions(id) ON DELETE SET NULL;


--
-- Name: candidate_question_history candidate_question_history_question_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.candidate_question_history
    ADD CONSTRAINT candidate_question_history_question_id_fkey FOREIGN KEY (question_id) REFERENCES public.questions(id) ON DELETE CASCADE;


--
-- Name: candidate_resumes candidate_resumes_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.candidate_resumes
    ADD CONSTRAINT candidate_resumes_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.roles(id) ON DELETE CASCADE;


--
-- Name: candidate_resumes candidate_resumes_upload_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.candidate_resumes
    ADD CONSTRAINT candidate_resumes_upload_id_fkey FOREIGN KEY (upload_id) REFERENCES public.uploads(id) ON DELETE SET NULL;


--
-- Name: cheat_signals cheat_signals_interview_answer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cheat_signals
    ADD CONSTRAINT cheat_signals_interview_answer_id_fkey FOREIGN KEY (interview_answer_id) REFERENCES public.interview_answers(id) ON DELETE CASCADE;


--
-- Name: coaching_feedback_flags coaching_feedback_flags_answer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coaching_feedback_flags
    ADD CONSTRAINT coaching_feedback_flags_answer_id_fkey FOREIGN KEY (answer_id) REFERENCES public.interview_answers(id) ON DELETE CASCADE;


--
-- Name: communication_reports communication_reports_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.communication_reports
    ADD CONSTRAINT communication_reports_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.mock_sessions(id) ON DELETE CASCADE;


--
-- Name: daily_answers daily_answers_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.daily_answers
    ADD CONSTRAINT daily_answers_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: dsa_attempts dsa_attempts_question_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dsa_attempts
    ADD CONSTRAINT dsa_attempts_question_id_fkey FOREIGN KEY (question_id) REFERENCES public.dsa_questions(id);


--
-- Name: dsa_company_tags dsa_company_tags_question_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dsa_company_tags
    ADD CONSTRAINT dsa_company_tags_question_id_fkey FOREIGN KEY (question_id) REFERENCES public.dsa_questions(id) ON DELETE CASCADE;


--
-- Name: dsa_question_details dsa_question_details_question_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dsa_question_details
    ADD CONSTRAINT dsa_question_details_question_id_fkey FOREIGN KEY (question_id) REFERENCES public.dsa_questions(id) ON DELETE CASCADE;


--
-- Name: interviews fk_interviews_mock_session_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.interviews
    ADD CONSTRAINT fk_interviews_mock_session_id FOREIGN KEY (mock_session_id) REFERENCES public.mock_sessions(id) ON DELETE SET NULL;


--
-- Name: interview_questions fk_iq_parent_question; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.interview_questions
    ADD CONSTRAINT fk_iq_parent_question FOREIGN KEY (parent_question_id) REFERENCES public.interview_questions(id) ON DELETE SET NULL;


--
-- Name: flagged_questions flagged_questions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.flagged_questions
    ADD CONSTRAINT flagged_questions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: interview_answers interview_answers_interview_question_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.interview_answers
    ADD CONSTRAINT interview_answers_interview_question_id_fkey FOREIGN KEY (interview_question_id) REFERENCES public.interview_questions(id) ON DELETE CASCADE;


--
-- Name: interview_answers interview_answers_parent_answer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.interview_answers
    ADD CONSTRAINT interview_answers_parent_answer_id_fkey FOREIGN KEY (parent_answer_id) REFERENCES public.interview_answers(id) ON DELETE SET NULL;


--
-- Name: interview_answers interview_answers_upload_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.interview_answers
    ADD CONSTRAINT interview_answers_upload_id_fkey FOREIGN KEY (upload_id) REFERENCES public.uploads(id);


--
-- Name: interview_calendar interview_calendar_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.interview_calendar
    ADD CONSTRAINT interview_calendar_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: interview_question_bank_company_tags interview_question_bank_company_tags_question_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.interview_question_bank_company_tags
    ADD CONSTRAINT interview_question_bank_company_tags_question_id_fkey FOREIGN KEY (question_id) REFERENCES public.interview_question_bank(id) ON DELETE CASCADE;


--
-- Name: interview_questions interview_questions_interview_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.interview_questions
    ADD CONSTRAINT interview_questions_interview_id_fkey FOREIGN KEY (interview_id) REFERENCES public.interviews(id) ON DELETE CASCADE;


--
-- Name: interview_questions interview_questions_question_bank_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.interview_questions
    ADD CONSTRAINT interview_questions_question_bank_id_fkey FOREIGN KEY (question_bank_id) REFERENCES public.questions(id) ON DELETE SET NULL;


--
-- Name: interview_scores interview_scores_interview_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.interview_scores
    ADD CONSTRAINT interview_scores_interview_id_fkey FOREIGN KEY (interview_id) REFERENCES public.interviews(id) ON DELETE CASCADE;


--
-- Name: interview_turns interview_turns_interview_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.interview_turns
    ADD CONSTRAINT interview_turns_interview_id_fkey FOREIGN KEY (interview_id) REFERENCES public.interviews(id) ON DELETE CASCADE;


--
-- Name: interview_turns interview_turns_question_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.interview_turns
    ADD CONSTRAINT interview_turns_question_id_fkey FOREIGN KEY (question_id) REFERENCES public.interview_questions(id) ON DELETE SET NULL;


--
-- Name: interviews interviews_application_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.interviews
    ADD CONSTRAINT interviews_application_id_fkey FOREIGN KEY (application_id) REFERENCES public.job_applications(id) ON DELETE CASCADE;


--
-- Name: interviews interviews_resume_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.interviews
    ADD CONSTRAINT interviews_resume_id_fkey FOREIGN KEY (resume_id) REFERENCES public.candidate_resumes(id) ON DELETE SET NULL;


--
-- Name: interviews interviews_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.interviews
    ADD CONSTRAINT interviews_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.roles(id) ON DELETE SET NULL;


--
-- Name: interviews interviews_user_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.interviews
    ADD CONSTRAINT interviews_user_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: job_applications job_applications_job_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_applications
    ADD CONSTRAINT job_applications_job_id_fkey FOREIGN KEY (job_id) REFERENCES public.roles(id) ON DELETE CASCADE;


--
-- Name: mock_sessions mock_sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mock_sessions
    ADD CONSTRAINT mock_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: multi_agent_sessions multi_agent_sessions_mock_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.multi_agent_sessions
    ADD CONSTRAINT multi_agent_sessions_mock_session_id_fkey FOREIGN KEY (mock_session_id) REFERENCES public.mock_sessions(id) ON DELETE CASCADE;


--
-- Name: oa_attempts oa_attempts_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.oa_attempts
    ADD CONSTRAINT oa_attempts_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: peer_attempts peer_attempts_room_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.peer_attempts
    ADD CONSTRAINT peer_attempts_room_id_fkey FOREIGN KEY (room_id) REFERENCES public.peer_rooms(id) ON DELETE CASCADE;


--
-- Name: peer_comparisons peer_comparisons_room_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.peer_comparisons
    ADD CONSTRAINT peer_comparisons_room_id_fkey FOREIGN KEY (room_id) REFERENCES public.peer_rooms(id) ON DELETE CASCADE;


--
-- Name: promo_redemptions promo_redemptions_code_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.promo_redemptions
    ADD CONSTRAINT promo_redemptions_code_id_fkey FOREIGN KEY (code_id) REFERENCES public.promo_codes(id);


--
-- Name: promo_redemptions promo_redemptions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.promo_redemptions
    ADD CONSTRAINT promo_redemptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: quick_prep_concept_results quick_prep_concept_results_concept_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quick_prep_concept_results
    ADD CONSTRAINT quick_prep_concept_results_concept_id_fkey FOREIGN KEY (concept_id) REFERENCES public.quick_prep_concepts(id);


--
-- Name: quick_prep_concept_results quick_prep_concept_results_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quick_prep_concept_results
    ADD CONSTRAINT quick_prep_concept_results_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.quick_prep_sessions(id) ON DELETE CASCADE;


--
-- Name: referral_events referral_events_referred_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.referral_events
    ADD CONSTRAINT referral_events_referred_id_fkey FOREIGN KEY (referred_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: referral_events referral_events_referrer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.referral_events
    ADD CONSTRAINT referral_events_referrer_id_fkey FOREIGN KEY (referrer_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: responses responses_interview_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.responses
    ADD CONSTRAINT responses_interview_id_fkey FOREIGN KEY (interview_id) REFERENCES public.interviews(id) ON DELETE CASCADE;


--
-- Name: role_difficulty_calibration role_difficulty_calibration_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_difficulty_calibration
    ADD CONSTRAINT role_difficulty_calibration_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.roles(id) ON DELETE CASCADE;


--
-- Name: session_attempts session_attempts_interview_answer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.session_attempts
    ADD CONSTRAINT session_attempts_interview_answer_id_fkey FOREIGN KEY (interview_answer_id) REFERENCES public.interview_answers(id) ON DELETE SET NULL;


--
-- Name: session_attempts session_attempts_interview_question_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.session_attempts
    ADD CONSTRAINT session_attempts_interview_question_id_fkey FOREIGN KEY (interview_question_id) REFERENCES public.interview_questions(id) ON DELETE CASCADE;


--
-- Name: session_feedback session_feedback_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.session_feedback
    ADD CONSTRAINT session_feedback_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.mock_sessions(id) ON DELETE CASCADE;


--
-- Name: session_feedback session_feedback_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.session_feedback
    ADD CONSTRAINT session_feedback_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: submitted_questions submitted_questions_reviewed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.submitted_questions
    ADD CONSTRAINT submitted_questions_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: submitted_questions submitted_questions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.submitted_questions
    ADD CONSTRAINT submitted_questions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: topic_practice_results topic_practice_results_concept_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.topic_practice_results
    ADD CONSTRAINT topic_practice_results_concept_id_fkey FOREIGN KEY (concept_id) REFERENCES public.quick_prep_concepts(id);


--
-- Name: topic_practice_results topic_practice_results_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.topic_practice_results
    ADD CONSTRAINT topic_practice_results_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.topic_practice_sessions(id) ON DELETE CASCADE;


--
-- Name: uploads uploads_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.uploads
    ADD CONSTRAINT uploads_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: user_notifications user_notifications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_notifications
    ADD CONSTRAINT user_notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: user_roles user_roles_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.roles(id) ON DELETE CASCADE;


--
-- Name: user_roles user_roles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: users users_referred_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_referred_by_fkey FOREIGN KEY (referred_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- PostgreSQL database dump complete
--

\unrestrict mg3J1WP2bfoOaZwdcE8b4JiL359ysSYR4TSiDKmeveETwca8GYNVY0778KFKbm0

