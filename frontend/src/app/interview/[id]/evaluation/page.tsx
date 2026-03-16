"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import ScoreGauge from "@/app/components/ui/ScoreGauge";
import RubricBars from "@/app/components/ui/RubricBars";
import RadarChartComponent from "@/app/components/ui/RadarChartComponent";
import PerQuestionBar from "@/app/components/ui/PerQuestionBar";
import HiringBadge from "@/app/components/ui/HiringBadge";

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000").replace(/\/$/, "");

type EvalData = {
  interview_id: string;
  candidate_name: string | null;
  candidate_email: string | null;
  role_title: string | null;
  role_level: string | null;
  overall_score: number | null;
  rubric_scores: Record<string, number>;
  hiring_recommendation: string;
  strengths: string[];
  weaknesses: string[];
  per_question: Array<{
    question_id: number;
    question_text: string;
    type: string;
    technical_score: number;
    communication_score: number;
    completeness_score: number;
    overall_score: number;
    ai_feedback: Record<string, any> | null;
  }>;
  scored: boolean;
  report: Record<string, any>;
};

const RUBRIC_LABELS: Record<string, string> = {
  technical_accuracy: "Technical Accuracy",
  problem_solving: "Problem Solving",
  communication_clarity: "Communication Clarity",
  depth_of_knowledge: "Depth of Knowledge",
  relevance: "Relevance",
  code_quality: "Code Quality",
  completeness: "Completeness",
};

function getToken(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem("access_token") || localStorage.getItem("token") || "";
}

export default function EvaluationPage() {
  const { id } = useParams() as { id: string };
  const [data, setData] = useState<EvalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);

  const fetchEvaluation = useCallback(async () => {
    try {
      const headers: Record<string, string> = { Accept: "application/json" };
      const token = getToken();
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch(`${API_BASE}/interview/evaluation/${id}`, { headers });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: EvalData = await res.json();
      setData(json);
      setError(null);
      return json.scored;
    } catch (e: any) {
      setError(e?.message || "Failed to load evaluation");
      return true; // stop polling on error
    } finally {
      setLoading(false);
    }
  }, [id]);

  // Initial fetch + poll if scoring not done
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;

    fetchEvaluation().then((scored) => {
      if (!scored) {
        timer = setInterval(async () => {
          const done = await fetchEvaluation();
          if (done && timer) {
            clearInterval(timer);
            timer = null;
          }
        }, 4000);
      }
    });

    return () => {
      if (timer) clearInterval(timer);
    };
  }, [fetchEvaluation]);

  async function downloadPdf() {
    setPdfLoading(true);
    try {
      const headers: Record<string, string> = { Accept: "application/pdf" };
      const token = getToken();
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const res = await fetch(`${API_BASE}/interview/report/${id}/pdf/download`, { headers });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || `HTTP ${res.status}`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `evaluation-${id}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      setError(`PDF download failed: ${e?.message || e}`);
    } finally {
      setPdfLoading(false);
    }
  }

  // Build rubric bars data
  const rubricBars = data?.rubric_scores
    ? Object.entries(data.rubric_scores)
        .filter(([, v]) => typeof v === "number" && v > 0)
        .map(([k, v]) => ({ name: RUBRIC_LABELS[k] || k, value: v }))
    : [];

  // Build radar data
  const radarData = rubricBars.map((r) => ({ subject: r.name, value: r.value }));

  // Per-question bar chart
  const perQBar = (data?.per_question || []).map((q) => ({
    name: `Q${q.question_id}`,
    technical: q.overall_score || 0,
  }));

  const overall = data?.overall_score ?? 0;

  return (
    <div className="max-w-6xl mx-auto p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">Candidate Evaluation</h1>
          {data?.candidate_name && (
            <p className="text-lg text-gray-700 mt-1">{data.candidate_name}</p>
          )}
          {data?.role_title && (
            <p className="text-sm text-gray-500">
              {data.role_title}
              {data.role_level ? ` (${data.role_level})` : ""}
            </p>
          )}
        </div>
        <div className="flex items-center gap-4">
          {data?.hiring_recommendation && data.scored && (
            <HiringBadge recommendation={data.hiring_recommendation} />
          )}
          <a
            href={`/interview/${id}/review`}
            className="px-3 py-1 text-sm border rounded hover:bg-gray-50"
          >
            Detailed Review
          </a>
          <button
            onClick={downloadPdf}
            disabled={pdfLoading || !data?.scored}
            className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {pdfLoading ? "Generating..." : "Export PDF"}
          </button>
        </div>
      </div>

      {loading && (
        <div className="text-center py-12 text-gray-500">Loading evaluation...</div>
      )}

      {error && (
        <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      {!loading && data && !data.scored && (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-indigo-500 border-t-transparent mb-4" />
          <p className="text-gray-600">Scoring your answers with AI...</p>
          <p className="text-sm text-gray-400 mt-1">This may take a moment</p>
        </div>
      )}

      {!loading && data && data.scored && (
        <>
          {/* Score Overview */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
            {/* Gauge */}
            <div className="border rounded-xl p-6 flex flex-col items-center justify-center">
              <div className="text-xs text-gray-500 mb-2 font-medium">Overall Score</div>
              <ScoreGauge value={overall} />
            </div>

            {/* Rubric Bars */}
            <div className="border rounded-xl p-6">
              <div className="text-xs text-gray-500 mb-3 font-medium">Rubric Breakdown</div>
              <RubricBars rubrics={rubricBars} />
            </div>

            {/* Radar Chart */}
            <div className="border rounded-xl p-6">
              <div className="text-xs text-gray-500 mb-3 font-medium">Skill Radar</div>
              <RadarChartComponent data={radarData} />
            </div>
          </div>

          {/* Strengths & Weaknesses */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            {Array.isArray(data.strengths) && data.strengths.length > 0 && (
              <div className="bg-green-50 border border-green-200 rounded-xl p-5">
                <h3 className="font-semibold text-green-800 mb-3">Strengths</h3>
                <ul className="space-y-1.5">
                  {data.strengths.map((s, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-green-900">
                      <span className="mt-0.5 text-green-600">+</span>
                      <span>{typeof s === "string" ? s : JSON.stringify(s)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {Array.isArray(data.weaknesses) && data.weaknesses.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-5">
                <h3 className="font-semibold text-amber-800 mb-3">Areas for Improvement</h3>
                <ul className="space-y-1.5">
                  {data.weaknesses.map((w, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-amber-900">
                      <span className="mt-0.5 text-amber-600">-</span>
                      <span>{typeof w === "string" ? w : JSON.stringify(w)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Per-Question Bar Chart */}
          {perQBar.length > 0 && (
            <div className="border rounded-xl p-6 mb-8">
              <h3 className="text-sm font-medium mb-3">Per-Question Scores</h3>
              <PerQuestionBar items={perQBar} />
            </div>
          )}

          {/* Per-Question Detail Cards */}
          <h2 className="text-xl font-semibold mb-4">Question-by-Question Feedback</h2>
          <div className="space-y-4">
            {data.per_question.map((q) => {
              const fb = q.ai_feedback || {};
              const qRubric = Object.entries(fb)
                .filter(
                  ([k, v]) =>
                    typeof v === "number" &&
                    (RUBRIC_LABELS[k] !== undefined)
                )
                .map(([k, v]) => ({
                  name: RUBRIC_LABELS[k] || k,
                  value: v as number,
                }));

              return (
                <div key={q.question_id} className="border rounded-xl p-5 bg-white">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold">Q{q.question_id}</span>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 border">
                          {q.type}
                        </span>
                        {fb.hiring_signal && (
                          <HiringBadge recommendation={fb.hiring_signal} />
                        )}
                      </div>
                      <p className="text-sm text-gray-700">{q.question_text}</p>
                    </div>
                    <div className="text-right ml-4">
                      <div className="text-2xl font-bold">{q.overall_score}</div>
                      <div className="text-xs text-gray-500">score</div>
                    </div>
                  </div>

                  {/* Rubric mini bars */}
                  {qRubric.length > 0 && (
                    <div className="mt-4">
                      <RubricBars rubrics={qRubric} />
                    </div>
                  )}

                  {/* AI Summary */}
                  {fb.summary && (
                    <div className="mt-4 text-sm bg-gray-50 rounded-lg p-3">
                      <div className="text-xs text-gray-500 mb-1 font-medium">AI Assessment</div>
                      <p className="text-gray-800">
                        {typeof fb.summary === "string"
                          ? fb.summary
                          : JSON.stringify(fb.summary, null, 2)}
                      </p>
                    </div>
                  )}

                  {/* Per-question strengths/weaknesses */}
                  <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                    {(Array.isArray(fb.strengths) && fb.strengths.length > 0) && (
                      <div className="text-sm">
                        <div className="text-xs text-green-700 font-medium mb-1">Strengths</div>
                        <ul className="space-y-0.5">
                          {fb.strengths.map((s: string, i: number) => (
                            <li key={i} className="text-green-800 text-xs">+ {typeof s === "string" ? s : JSON.stringify(s)}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {(Array.isArray(fb.weaknesses) && fb.weaknesses.length > 0) && (
                      <div className="text-sm">
                        <div className="text-xs text-amber-700 font-medium mb-1">Weaknesses</div>
                        <ul className="space-y-0.5">
                          {fb.weaknesses.map((w: string, i: number) => (
                            <li key={i} className="text-amber-800 text-xs">- {typeof w === "string" ? w : JSON.stringify(w)}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Footer actions */}
          <div className="mt-8 flex gap-3">
            <a
              href={`/interview/${id}/review`}
              className="px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 text-sm font-medium"
            >
              View Full Review
            </a>
            <a
              href={`/interview/${id}/report`}
              className="px-4 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 text-sm"
            >
              Basic Report
            </a>
            <a
              href={`/interview/${id}`}
              className="px-4 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 text-sm"
            >
              Back to Questions
            </a>
          </div>
        </>
      )}
    </div>
  );
}
