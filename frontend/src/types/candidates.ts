export interface CandidateListItem {
  application_id: string;
  candidate_name: string | null;
  candidate_email: string;
  overall_score: number | null;
  rubric_scores: Record<string, number> | null;
  cheat_risk: string | null;
  status: string;
  completed_at: string | null;
  attempt_number: number;
}

export interface JobApplicationOut {
  id: string;
  job_id: number;
  candidate_email: string;
  candidate_name: string | null;
  attempt_number: number;
  status: string;
  invite_token: string;
  invited_at: string;
  started_at: string | null;
  completed_at: string | null;
  overall_score: number | null;
  rubric_scores: Record<string, number> | null;
  cheat_score: number | null;
  cheat_risk: string | null;
  ai_recommendation: string | null;
}

export interface InterviewAnswer {
  id: number;
  interview_question_id: number;
  upload_id: number | null;
  code_answer: string | null;
  transcript: string | null;
  ai_feedback: any;
  ai_score: number | null;
  manual_score: number | null;
  cheat_flags: string[] | null;
  cheat_score: number | null;
  cheat_risk: string;
  test_results: any;
}

export interface CheatSignal {
  id: number;
  interview_answer_id: number;
  signal_type: string;
  signal_category: string;
  weight: string;
  details: any;
  fired_at: string;
}

export interface CandidateDetail extends JobApplicationOut {
  answers: InterviewAnswer[];
  cheat_signals: CheatSignal[];
}
