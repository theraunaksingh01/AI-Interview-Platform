"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

// ─── Types ───────────────────────────────────────────────────────────────────

type QuestionData = {
  question_id: number;
  question_text: string;
  score: number;
  transcript: string;
  weaknesses: string[];
  better_answer: string | null;
  wpm: number | null;
  filler_count: number | null;
  topic: string | null;
  position: number | null;
  is_followup?: boolean;
};

type ReportResponse = {
  plan?: "free" | "pro" | "max";
  session: {
    id: string;
    role_target: string;
    seniority: string;
    status: string;
    completed_at: string | null;
    overall_score: number | null;
    communication_score?: number | null;
    specific_fix?: string | null;
    coach_note?: string | null;
    coaching_pattern?: string | null;
    delivery_note?: string | null;
  };
  report: {
    avg_wpm: number | null;
    total_filler_words: number | null;
    filler_breakdown: Record<string, number>;
    total_silence_gaps?: number | null;
    star_avg_score: number | null;
    top_issues: string[];
    top_strengths: string[];
    heatmap_data: Array<{ minute: number; intensity: number }>;
  } | null;
  questions: QuestionData[];
  coaching_pending: boolean;
  report_pending: boolean;
  locked?: boolean;
  lock_reason?: string;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function scoreRingColor(score: number | null | undefined): string {
  if (score == null) return "#E5E7EB";
  if (score >= 75) return "#10B981";
  if (score >= 50) return "#F59E0B";
  return "#EF4444";
}

function scoreBadgeStyle(score: number | null | undefined): string {
  if (score == null) return "bg-gray-100 text-gray-400 border-gray-200";
  if (score >= 75) return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (score >= 50) return "bg-amber-50 text-amber-700 border-amber-200";
  return "bg-rose-50 text-rose-700 border-rose-200";
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "Date unavailable";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "Date unavailable";
  return d.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
}

function wpmLabel(wpm: number | null | undefined): string {
  if (!wpm) return "";
  if (wpm < 80) return "too slow";
  if (wpm <= 180) return "good pace";
  if (wpm <= 220) return "a bit fast";
  return "too fast";
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ScoreRing({ score }: { score: number | null }) {
  const r = 42;
  const circumference = 2 * Math.PI * r;
  const pct = score != null ? Math.min(100, Math.max(0, score)) / 100 : 0;
  const color = scoreRingColor(score);
  return (
    <svg width="110" height="110" viewBox="0 0 110 110">
      <circle cx="55" cy="55" r={r} fill="none" stroke="#F3F4F6" strokeWidth="8" />
      <circle
        cx="55" cy="55" r={r} fill="none"
        stroke={color} strokeWidth="8"
        strokeDasharray={circumference}
        strokeDashoffset={circumference * (1 - pct)}
        strokeLinecap="round"
        transform="rotate(-90 55 55)"
        style={{ transition: "stroke-dashoffset 0.6s ease" }}
      />
      <text x="55" y="52" textAnchor="middle" fontSize="20" fontWeight="700" fill="#111111">
        {score != null ? Math.round(score) : "--"}
      </text>
      <text x="55" y="68" textAnchor="middle" fontSize="10" fill="#9CA3AF">/ 100</text>
    </svg>
  );
}

function QuestionCard({ q, index, userPlan }: { q: QuestionData; index: number; userPlan: string }) {
  const [expanded, setExpanded] = useState(false);
  const hasTranscript = q.transcript && q.transcript.trim().length > 0;

  return (
    <div className={`rounded-2xl border bg-white overflow-hidden transition-shadow hover:shadow-md ${
      q.score < 50 ? "border-rose-200" : q.score >= 75 ? "border-emerald-200" : "border-amber-200"
    }`}>
      {/* Header row — always clickable */}
      <div
        className="flex items-start justify-between gap-4 p-5 cursor-pointer select-none"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="flex items-start gap-3 min-w-0">
          <span className="mt-0.5 shrink-0 w-7 h-7 rounded-full bg-[#F3F4F6] flex items-center justify-center text-xs font-bold text-[#6B7280]">
            {index + 1}
          </span>
          <div className="min-w-0">
            <p className="text-[15px] font-semibold text-[#111] leading-snug line-clamp-2">
              {q.question_text}
            </p>
            <div className="mt-1.5 flex flex-wrap gap-2 text-[12px] text-[#9CA3AF]">
              {q.topic && (
                <span className="px-2 py-0.5 bg-[#F9FAFB] rounded-full border border-[#E5E7EB]">
                  {q.topic}
                </span>
              )}
              {!hasTranscript && (
                <span className="px-2 py-0.5 bg-rose-50 text-rose-400 rounded-full border border-rose-100">
                  no answer recorded
                </span>
              )}
              {hasTranscript && q.wpm != null && (
                <span>{Math.round(q.wpm)} WPM · {wpmLabel(q.wpm)}</span>
              )}
              {hasTranscript && q.filler_count != null && q.filler_count > 0 && (
                <span>{q.filler_count} filler word{q.filler_count !== 1 ? "s" : ""}</span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <div className={`px-3 py-1.5 rounded-lg border text-sm font-bold ${scoreBadgeStyle(q.score)}`}>
            {Math.round(q.score)}/100
          </div>
          <span className="text-[#9CA3AF] text-sm">{expanded ? "▲" : "▼"}</span>
        </div>
      </div>

      {userPlan === "free" && !q.is_followup && (
        <div className="mx-5 mb-3 rounded-xl border border-dashed border-[#E5E7EB] bg-[#F9FAFB] px-4 py-3 flex items-start gap-2">
          <span className="text-[14px] mt-0.5">💡</span>
          <div>
            <p className="text-[12px] font-bold text-[#374151]">
              A real interviewer would have probed deeper here.
            </p>
            <p className="text-[11px] text-[#9CA3AF] mt-0.5">
              Unlock follow-up questions with Pro — they reveal whether you truly understand or just memorised.{" "}
              <a href="/pricing" className="font-bold text-[#111] underline">Upgrade →</a>
            </p>
          </div>
        </div>
      )}

      {/* Expanded content */}
      {expanded && (
        <div className="border-t border-[#F3F4F6] px-5 pb-5 space-y-4">

          {hasTranscript ? (
            <>
              {/* Transcript */}
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-[#9CA3AF] mb-1.5 mt-4">
                  Your answer
                </p>
                <p className="text-[14px] text-[#374151] bg-[#F9FAFB] rounded-xl px-4 py-3 leading-relaxed italic border border-[#F3F4F6]">
                  &quot;{q.transcript}&quot;
                </p>
              </div>

              {/* What was missing */}
              {q.weaknesses?.length > 0 && (
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-[#9CA3AF] mb-1.5">
                    What was missing
                  </p>
                  <div className="space-y-1.5">
                    {q.weaknesses.map((w, i) => (
                      <div key={i} className="flex items-start gap-2 text-[14px] text-[#374151]">
                        <span className="text-rose-400 mt-0.5 shrink-0">→</span>
                        <span>{w}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Better answer */}
              {q.better_answer ? (
                <div className="rounded-xl bg-[#F0FDF4] border border-emerald-100 px-4 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-600 mb-1.5">
                    What you could have said
                  </p>
                  <p className="text-[14px] text-emerald-900 leading-relaxed">
                    {q.better_answer}
                  </p>
                </div>
              ) : userPlan === "free" ? (
                <div className="mt-4 p-4 bg-gray-50 border border-dashed border-gray-300 rounded-xl">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">
                    What you could have said
                  </p>
                  <div className="text-sm text-gray-300 leading-relaxed blur-sm select-none">
                    A strong answer would define the concept clearly, provide a real example from a project, and mention one trade-off or limitation.
                  </div>
                  <p className="mt-3 text-xs font-semibold text-indigo-600 cursor-pointer hover:underline">
                    Upgrade to Pro to unlock model answers →
                  </p>
                </div>
              ) : null}

              {userPlan === "max" && q.better_answer && (
                <a
                  href={`/mock?retry_question=${q.question_id}`}
                  className="mt-3 inline-flex items-center gap-2 text-xs font-bold text-indigo-600 hover:text-indigo-700"
                >
                  🎙 Practice this answer again
                </a>
              )}
            </>
          ) : (
            <>
              {/* No transcript — show skipped notice + model answer */}
              <div className="mt-4 rounded-xl bg-[#FFF7ED] border border-amber-100 px-4 py-3">
                <p className="text-[13px] text-amber-700 font-medium mb-1">
                  You skipped this question — no answer was recorded.
                </p>
                <p className="text-[12px] text-amber-600">
                  Skipped questions are scored 0 and pulled down your overall score.
                </p>
              </div>

              {/* Still show a model answer so they learn */}
              {q.better_answer ? (
                <div className="rounded-xl bg-[#F0FDF4] border border-emerald-100 px-4 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-600 mb-1.5">
                    What you could have said
                  </p>
                  <p className="text-[14px] text-emerald-900 leading-relaxed">
                    {q.better_answer}
                  </p>
                </div>
              ) : userPlan === "free" ? (
                <div className="mt-4 p-4 bg-gray-50 border border-dashed border-gray-300 rounded-xl">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">
                    What you could have said
                  </p>
                  <div className="text-sm text-gray-300 leading-relaxed blur-sm select-none">
                    A strong answer would define the concept clearly, provide a real example from a project, and mention one trade-off or limitation.
                  </div>
                  <p className="mt-3 text-xs font-semibold text-indigo-600 cursor-pointer hover:underline">
                    Upgrade to Pro to unlock model answers →
                  </p>
                </div>
              ) : null}

              {userPlan === "max" && q.better_answer && (
                <a
                  href={`/mock?retry_question=${q.question_id}`}
                  className="mt-3 inline-flex items-center gap-2 text-xs font-bold text-indigo-600 hover:text-indigo-700"
                >
                  🎙 Practice this answer again
                </a>
              )}

              {/* If better_answer also missing (task not re-run yet) */}
              {!q.better_answer && (
                <p className="text-[13px] text-[#9CA3AF] mt-2 italic">
                  Model answer not yet generated for this question.
                </p>
              )}
            </>
          )}
        </div>
      )}

      {/* Collapsed preview */}
      {!expanded && (
        <div className="border-t border-[#F3F4F6] px-5 py-2.5">
          {hasTranscript && q.weaknesses?.length > 0 ? (
            <p className="text-[12px] text-[#9CA3AF]">
              {q.weaknesses[0]}
              {q.weaknesses.length > 1 && ` +${q.weaknesses.length - 1} more`}
            </p>
          ) : !hasTranscript ? (
            <p className="text-[12px] text-amber-500">Question was skipped — tap to see model answer</p>
          ) : (
            <p className="text-[12px] text-[#9CA3AF]">Tap to expand</p>
          )}
        </div>
      )}
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="rounded-2xl border border-[#F3F4F6] bg-white p-5 animate-pulse">
      <div className="flex items-start gap-3">
        <div className="w-7 h-7 rounded-full bg-[#F3F4F6]" />
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-[#F3F4F6] rounded w-3/4" />
          <div className="h-3 bg-[#F3F4F6] rounded w-1/3" />
        </div>
        <div className="w-16 h-8 bg-[#F3F4F6] rounded-lg" />
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function MockReportPage() {
  const { id } = useParams() as { id: string };
  const sessionId = id;
  const router = useRouter();

  const [data, setData] = useState<ReportResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchReport = useCallback(async () => {
    const token =
      typeof window !== "undefined"
        ? localStorage.getItem("access_token") || localStorage.getItem("API_TOKEN")
        : null;
    const res = await fetch(`/api/mock/report/${sessionId}`, {
      cache: "no-store",
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body?.detail || "Unable to load report");
    }
    const json = (await res.json()) as ReportResponse;
    setData(json);
    return json;
  }, [sessionId]);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const run = async () => {
      try {
        setError(null);
        const json = await fetchReport();
        if (cancelled) return;
        setLoading(false);
        if (json.report_pending || json.coaching_pending) {
          timer = setTimeout(run, 4000);
        }
      } catch (e: unknown) {
        if (!cancelled) {
          setLoading(false);
          setError(e instanceof Error ? e.message : "Network error");
        }
      }
    };

    run();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [fetchReport]);

  const sortedFillers = useMemo(() => {
    const breakdown = data?.report?.filler_breakdown || {};
    return Object.entries(breakdown)
      .sort((a, b) => b[1] - a[1])
      .filter(([, count]) => Number(count) > 0);
  }, [data]);

  const maxFillerCount = useMemo(
    () => sortedFillers.reduce((acc, [, c]) => Math.max(acc, c), 0),
    [sortedFillers]
  );

  // ── Locked ────────────────────────────────────────────────────────────────
  if (data?.locked) {
    return (
      <main className="min-h-screen bg-[#FAFAFA] px-6 py-16">
        <div className="mx-auto max-w-140 text-center">
          <div className="mb-4 text-5xl">📊</div>
          <h1 className="mb-3 text-[26px] font-bold text-[#111]">Your report is ready</h1>
          <p className="mb-8 text-[15px] text-[#6B7280]">
            Upgrade to Pro to unlock your full report — per-question breakdown, &quot;what you could have said&quot;, WPM analysis, and your one specific fix.
          </p>
          <button
            onClick={() => router.push("/pricing")}
            className="mb-3 w-full rounded-xl bg-[#111] px-8 py-3.5 text-base font-semibold text-white hover:bg-[#222] transition"
          >
            Upgrade to Pro →
          </button>
          <button
            onClick={() => router.push("/mock")}
            className="w-full rounded-xl border border-[#E5E7EB] bg-white px-8 py-3.5 text-[15px] text-[#6B7280] hover:bg-[#F9FAFB] transition"
          >
            Start another interview
          </button>
        </div>
      </main>
    );
  }

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <main className="min-h-screen bg-[#FAFAFA] px-6 py-12">
        <div className="mx-auto max-w-215">
          <div className="mb-8 flex items-center gap-3">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-300 border-t-[#111]" />
            <span className="text-sm text-[#9CA3AF]">Generating your report…</span>
          </div>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => <SkeletonCard key={i} />)}
          </div>
        </div>
      </main>
    );
  }

  // ── Error ─────────────────────────────────────────────────────────────────
  if (error || !data || !data.session) {
    return (
      <main className="min-h-screen bg-[#FAFAFA] px-6 py-12">
        <div className="mx-auto max-w-215 rounded-2xl border border-rose-200 bg-rose-50 p-8">
          <h1 className="text-xl font-bold text-rose-700">Report unavailable</h1>
          <p className="mt-2 text-sm text-rose-600">{error || "Could not load report."}</p>
          <Link href="/mock" className="mt-6 inline-block text-sm font-medium text-[#111] underline">
            Go back to Mock Interview
          </Link>
        </div>
      </main>
    );
  }

  const { session, report, questions } = data;
  const coachNote = data?.session?.coach_note;
  const userPlan = data.plan ?? "free";
  const displayScore = session.overall_score ?? session.communication_score ?? report?.star_avg_score ?? null;
  const sortedQuestions = [...(questions || [])].sort(
    (a, b) => (a.position ?? 99) - (b.position ?? 99)
  );

  return (
    <main className="min-h-screen bg-[#FAFAFA] px-4 pb-16 pt-28 sm:px-8">
      <div className="mx-auto max-w-215 space-y-6">

        {/* ── Header ── */}
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div>
            <Link href="/mock/dashboard" className="text-sm text-[#6B7280] hover:text-[#111] transition">
              ← Back to dashboard
            </Link>
            <h1 className="mt-2 text-[28px] font-bold tracking-tight text-[#111]">
              Interview Report
            </h1>
            <p className="mt-1 text-sm text-[#9CA3AF]">
              {session.role_target}
              {session.seniority ? ` · ${session.seniority}` : ""}
              {" · "}
              {formatDate(session.completed_at)}
            </p>
          </div>
          <div className="flex flex-col items-center">
            <ScoreRing score={displayScore != null ? Number(displayScore) : null} />
            <p className="mt-1 text-[11px] text-[#9CA3AF]">Overall Score</p>
          </div>
        </div>

        {coachNote && (
          <div className="mb-5 rounded-2xl border border-[#E5E7EB] bg-white overflow-hidden">
            <div
              className="flex items-center gap-3 px-5 py-4 border-b border-[#F3F4F6]"
              style={{ background: "linear-gradient(135deg, #FFFDF0 0%, #FFF9D6 100%)" }}
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-yellow-400 text-[15px] font-black text-[#111]">
                AI
              </div>
              <div>
                <p className="text-[13px] font-black text-[#111]">Your Coach</p>
                <p className="text-[11px] text-[#9CA3AF]">
                  Personalized note based on your last sessions
                </p>
              </div>
            </div>
            <div className="px-5 py-4">
              <p className="text-[14px] text-[#374151] leading-relaxed">{coachNote}</p>
            </div>
            <div className="border-t border-[#F9FAFB] px-5 py-3 flex items-center justify-between">
              <p className="text-[11px] text-[#9CA3AF]">Updates after every session</p>
              <Link href="/mock" className="text-[12px] font-bold text-[#111] hover:underline">
                Start next session →
              </Link>
            </div>
          </div>
        )}

        {/* ── One Specific Fix ── */}
        {session.specific_fix && (
          <div className="rounded-2xl bg-[#111] px-6 py-5 text-white">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-[#9CA3AF] mb-2">
              Your one fix
            </p>
            <p className="text-[17px] font-semibold leading-snug">
              {session.specific_fix}
            </p>
            {session.delivery_note && (
              <p className="mt-2 text-[13px] text-[#9CA3AF]">{session.delivery_note}</p>
            )}
          </div>
        )}

        {/* ── Delivery stats ── */}
        {report && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              {
                value: report.avg_wpm != null ? Math.round(report.avg_wpm) : "--",
                label: "Avg WPM",
                note: "Ideal: 120–180",
                color: (report.avg_wpm ?? 0) >= 80 && (report.avg_wpm ?? 0) <= 180
                  ? "text-emerald-600" : "text-amber-600",
              },
              {
                value: report.total_filler_words ?? 0,
                label: "Filler Words",
                note: "Lower is better",
                color: (report.total_filler_words ?? 0) === 0 ? "text-emerald-600" : "text-amber-600",
              },
              {
                value: report.total_silence_gaps ?? 0,
                label: "Silence Gaps",
                note: "Long pauses",
                color: "text-[#111]",
              },
              {
                value: report.star_avg_score != null ? Number(report.star_avg_score).toFixed(1) : "--",
                label: "STAR Score",
                note: "Out of 10",
                color: "text-[#111]",
              },
            ].map(({ value, label, note, color }) => (
              <div key={label} className="rounded-2xl border border-[#E5E7EB] bg-white px-4 py-4">
                <div className={`text-2xl font-bold ${color}`}>{value}</div>
                <div className="mt-0.5 text-xs font-medium text-[#374151]">{label}</div>
                <div className="mt-0.5 text-[11px] text-[#9CA3AF]">{note}</div>
              </div>
            ))}
          </div>
        )}

        {/* ── Per-question breakdown ── */}
        <div>
          <h2 className="mb-3 text-[17px] font-bold text-[#111]">
            Question Breakdown
            <span className="ml-2 text-[13px] font-normal text-[#9CA3AF]">
              tap any question to expand
            </span>
          </h2>

          {data.coaching_pending && sortedQuestions.length === 0 ? (
            <div className="space-y-3">
              <div className="rounded-2xl border border-[#F3F4F6] bg-white px-5 py-4 flex items-center gap-3">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-200 border-t-[#111]" />
                <span className="text-sm text-[#9CA3AF]">
                  Generating per-question analysis… this takes ~30 seconds
                </span>
              </div>
              {[1, 2, 3].map((i) => <SkeletonCard key={i} />)}
            </div>
          ) : sortedQuestions.length > 0 ? (
            <div className="space-y-3">
              {sortedQuestions.map((q, i) => (
                <QuestionCard key={q.question_id} q={q} index={i} userPlan={userPlan} />
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-[#F3F4F6] bg-white px-5 py-8 text-center text-sm text-[#9CA3AF]">
              Question-level analysis not available for this session.
            </div>
          )}
        </div>

        {/* ── Strengths / Issues ── */}
        {report && (report.top_strengths?.length > 0 || report.top_issues?.length > 0) && (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {report.top_strengths?.length > 0 && (
              <div className="rounded-2xl bg-[#F0FDF4] p-5">
                <h3 className="mb-3 text-[13px] font-bold uppercase tracking-wide text-emerald-700">
                  Strengths
                </h3>
                <div className="space-y-2">
                  {report.top_strengths.map((item) => (
                    <div key={item} className="flex items-start gap-2 text-sm text-emerald-900">
                      <span className="shrink-0">✓</span>
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {report.top_issues?.length > 0 && (
              <div className="rounded-2xl bg-[#FFFBEB] p-5">
                <h3 className="mb-3 text-[13px] font-bold uppercase tracking-wide text-amber-700">
                  Areas to Improve
                </h3>
                <div className="space-y-2">
                  {report.top_issues.map((item) => (
                    <div key={item} className="flex items-start gap-2 text-sm text-amber-900">
                      <span className="shrink-0">⚠</span>
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Filler words ── */}
        {sortedFillers.length > 0 && (
          <div className="rounded-2xl border border-[#E5E7EB] bg-white p-5">
            <h2 className="mb-4 text-[15px] font-bold text-[#111]">Filler Words Used</h2>
            <div className="space-y-3">
              {sortedFillers.map(([word, count], idx) => {
                const pct = maxFillerCount > 0 ? Math.max(8, Math.round((count / maxFillerCount) * 100)) : 0;
                return (
                  <div key={word} className="grid grid-cols-[64px_1fr_36px] items-center gap-3">
                    <span className="text-sm text-[#374151] font-medium">{word}</span>
                    <div className="h-2.5 rounded-full bg-[#F3F4F6]">
                      <div
                        className={`h-2.5 rounded-full ${idx === 0 ? "bg-rose-400" : "bg-amber-400"}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-right text-sm font-semibold text-[#374151]">{count}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Actions ── */}
        <div className="flex flex-wrap gap-3 pt-2">
          <Link
            href="/mock"
            className="rounded-xl bg-[#111] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#222] transition"
          >
            Practice Again
          </Link>
          <Link
            href="/mock/dashboard"
            className="rounded-xl border border-[#E5E7EB] bg-white px-5 py-2.5 text-sm font-medium text-[#374151] hover:bg-[#F9FAFB] transition"
          >
            View Progress
          </Link>
          <button
            type="button"
            onClick={async () => {
              const url = `${window.location.origin}/mock/report/${sessionId}`;
              await navigator.clipboard.writeText(url);
            }}
            className="rounded-xl border border-[#E5E7EB] bg-white px-5 py-2.5 text-sm font-medium text-[#374151] hover:bg-[#F9FAFB] transition"
          >
            Copy Report Link
          </button>
        </div>

      </div>
    </main>
  );
}