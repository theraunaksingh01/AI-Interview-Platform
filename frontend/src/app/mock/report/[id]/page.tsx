"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

type ReportResponse = {
  session: {
    id: string;
    role_target: string;
    seniority: string;
    status: string;
    completed_at: string | null;
    overall_score: number | null;
    communication_score?: number | null;
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
  report_pending: boolean;
};

const API_BASE = (process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:8000").replace(/\/$/, "");

function scoreColor(score: number | null | undefined): string {
  if (score == null) return "bg-gray-200 text-gray-700";
  if (score >= 7.5) return "bg-emerald-500 text-white";
  if (score >= 5) return "bg-amber-500 text-white";
  return "bg-rose-500 text-white";
}

function wpmColor(wpm: number | null | undefined): string {
  if (wpm == null || wpm === 0) return "text-gray-500";
  if (wpm < 80) return "text-amber-600";
  if (wpm <= 180) return "text-emerald-600";
  if (wpm <= 220) return "text-amber-600";
  return "text-rose-600";
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "Date unavailable";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "Date unavailable";
  return d.toLocaleString();
}

export default function MockReportPage() {
  const { id } = useParams() as { id: string };
  const sessionId = id;

  const [data, setData] = useState<ReportResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchReport = useCallback(async () => {
    const res = await fetch(`${API_BASE}/api/mock/report/${sessionId}`, { cache: "no-store" });
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

        if (json.report_pending) {
          timer = setTimeout(run, 3000);
        }
      } catch (e: any) {
        if (!cancelled) {
          setLoading(false);
          setError(e?.message || "Network error");
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

  const maxFillerCount = useMemo(() => {
    return sortedFillers.reduce((acc, [, count]) => Math.max(acc, count), 0);
  }, [sortedFillers]);

  const session = data?.session;
  const report = data?.report;

  if (loading || data?.report_pending) {
    return (
      <main className="min-h-screen bg-white px-8 py-12">
        <div className="mx-auto max-w-[900px] rounded-2xl border border-gray-200 bg-white p-12 text-center shadow-sm">
          <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-2 border-gray-300 border-t-indigo-600" />
          <h1 className="text-2xl font-bold text-[#111]">Analyzing your interview...</h1>
          <p className="mt-2 text-sm text-[#6B7280]">This takes about 30 seconds.</p>
        </div>
      </main>
    );
  }

  if (error || !data || !session) {
    return (
      <main className="min-h-screen bg-white px-8 py-12">
        <div className="mx-auto max-w-[900px] rounded-2xl border border-rose-200 bg-rose-50 p-8">
          <h1 className="text-2xl font-bold text-rose-700">Report unavailable</h1>
          <p className="mt-2 text-sm text-rose-700">{error || "Could not load report."}</p>
          <Link href="/mock" className="mt-6 inline-block text-sm font-medium text-indigo-600 hover:text-indigo-500">
            Go back to Mock Interview
          </Link>
        </div>
      </main>
    );
  }

  const displayScore =
    session.overall_score ??
    session.communication_score ??
    report?.star_avg_score ??
    null;
  const starScore = report?.star_avg_score ?? null;

  return (
    <main className="min-h-screen bg-white px-8 py-12">
      <div className="mx-auto max-w-[900px]">
        <header className="mb-8 flex flex-wrap items-start justify-between gap-5">
          <div>
            <Link href="/mock/dashboard" className="text-sm text-indigo-600 hover:text-indigo-500">
              ← Back to dashboard
            </Link>
            <h1 className="mt-2 text-[28px] font-bold text-[#111]">Interview Report</h1>
            <p className="mt-1 text-sm text-[#6B7280]">
              {session.role_target} ({session.seniority}) • {formatDate(session.completed_at)}
            </p>
          </div>
          <div className="text-center">
            <div className={`flex h-28 w-28 items-center justify-center rounded-full text-3xl font-bold ${scoreColor(displayScore)}`}>
              {displayScore != null ? Number(displayScore).toFixed(1) : "--"}
            </div>
            <div className="mt-1 text-[11px] text-[#9CA3AF]">Interview Score</div>
          </div>
        </header>

        <section className="mb-8 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-[#E5E7EB] bg-white p-5">
            <div className={`text-2xl font-bold ${wpmColor(report?.avg_wpm)}`}>
              {report?.avg_wpm != null ? Math.round(report.avg_wpm) : "--"}
            </div>
            <div className="mt-1 text-xs text-[#9CA3AF]">Avg WPM</div>
            <div className="mt-1 text-[11px] text-[#9CA3AF]">Good pace: 120-180 WPM</div>
          </div>
          <div className="rounded-xl border border-[#E5E7EB] bg-white p-5">
            <div className="text-2xl font-bold text-[#111]">{report?.total_filler_words ?? 0}</div>
            <div className="mt-1 text-xs text-[#9CA3AF]">Filler Words</div>
          </div>
          <div className="rounded-xl border border-[#E5E7EB] bg-white p-5">
            <div className="text-2xl font-bold text-[#111]">{report?.total_silence_gaps ?? 0}</div>
            <div className="mt-1 text-xs text-[#9CA3AF]">Silence Gaps</div>
          </div>
          <div className="rounded-xl border border-[#E5E7EB] bg-white p-5">
            <div className="text-2xl font-bold text-[#111]">
              {report?.star_avg_score != null ? Number(report.star_avg_score).toFixed(1) : "--"}
            </div>
            <div className="mt-1 text-xs text-[#9CA3AF]">STAR Score</div>
          </div>
        </section>

        <section className="mb-8 rounded-xl border border-[#E5E7EB] bg-white p-6">
          <h2 className="text-lg font-semibold text-[#111]">Filler Words Used</h2>
          {sortedFillers.length === 0 ? (
            <p className="mt-3 text-sm font-medium text-emerald-600">No filler words detected — excellent!</p>
          ) : (
            <div className="mt-4 space-y-3">
              {sortedFillers.map(([word, count], idx) => {
                const pct = maxFillerCount > 0 ? Math.max(8, Math.round((count / maxFillerCount) * 100)) : 0;
                const isTop = idx === 0;
                return (
                  <div key={word} className="grid grid-cols-[60px_1fr_40px] items-center gap-3">
                    <span className="text-sm text-[#374151]">{word}</span>
                    <div className="h-3 rounded-full bg-gray-100">
                      <div
                        className={`h-3 rounded-full ${isTop ? "bg-rose-400" : "bg-amber-400"}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-right text-sm font-medium text-[#374151]">{count}</span>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="rounded-xl bg-[#F0FDF4] p-5">
            <h3 className="mb-3 text-base font-semibold text-emerald-800">Strengths</h3>
            <div className="space-y-2">
              {(report?.top_strengths?.length ? report.top_strengths : ["Stayed engaged throughout the interview."]).map((item) => (
                <div key={item} className="flex items-start gap-2 text-sm text-emerald-900">
                  <span>✓</span>
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-xl bg-[#FFFBEB] p-5">
            <h3 className="mb-3 text-base font-semibold text-amber-800">Areas to Improve</h3>
            <div className="space-y-2">
              {(report?.top_issues?.length ? report.top_issues : ["Add more concrete examples in answers."]).map((item) => (
                <div key={item} className="flex items-start gap-2 text-sm text-amber-900">
                  <span>⚠</span>
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {starScore != null ? (
          <section className="mb-8 rounded-xl border border-[#E5E7EB] bg-white p-6">
            <h2 className="text-lg font-semibold text-[#111]">STAR Method Score</h2>
            <div className="mb-2 text-[13px] text-[#6B7280]">Behavioral communication score (STAR method)</div>
            <div className="mt-4 h-4 rounded-full bg-gray-100">
              <div
                className={`h-4 rounded-full ${scoreColor(starScore).split(" ")[0]}`}
                style={{ width: `${Math.max(0, Math.min(100, (starScore / 10) * 100))}%` }}
              />
            </div>
            <p className="mt-3 text-sm text-[#6B7280]">
              STAR = Situation, Task, Action, Result. This score reflects how clearly your behavioral answers followed that structure.
            </p>
            {starScore === 6.0 && (
              <div className="mt-2 text-xs italic text-[#9CA3AF]">
                Score based on general assessment. Complete a full interview with voice answers for detailed analysis.
              </div>
            )}
          </section>
        ) : null}

        <section className="mb-3 flex flex-wrap gap-3">
          <Link href="/mock" className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500">
            Practice Again
          </Link>
          <Link href="/mock/dashboard" className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
            View Progress
          </Link>
          <button
            type="button"
            onClick={async () => {
              const reportUrl = `${window.location.origin}/mock/report/${sessionId}`;
              await navigator.clipboard.writeText(reportUrl);
            }}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Share Report
          </button>
        </section>
      </div>
    </main>
  );
}
