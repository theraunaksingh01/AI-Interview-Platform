"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Trophy } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useAuth } from "@/context/AuthContext";
import { CalendarWidget } from "@/app/components/CalendarWidget";

const API_BASE = (
  process.env.NEXT_PUBLIC_API_BASE ||
  process.env.NEXT_PUBLIC_API_URL ||
  "http://127.0.0.1:8000"
).replace(/\/$/, "");

// ─── Types ────────────────────────────────────────────────────────────────────

type SessionItem = {
  id: string;
  role_target: string;
  seniority: string;
  company_type: string | null;
  focus_area: string | null;
  overall_score: number | null;
  dsa_score: number | null;
  system_design_score: number | null;
  behavioral_score: number | null;
  communication_score: number | null;
  completed_at: string | null;
  report_available: boolean;
  question_count: number;
  total_retries: number;
};

type DashboardData = {
  sessions: SessionItem[];
  latest_scores: {
    dsa?: number | null;
    system_design?: number | null;
    behavioral?: number | null;
    communication?: number | null;
    overall?: number | null;
  };
  deltas: {
    dsa?: number | null;
    system_design?: number | null;
    behavioral?: number | null;
    communication?: number | null;
  };
  streak: number;
  total_sessions: number;
  best_score: number | null;
  avg_score: number | null;
  improvement: number | null;
  weak_spots: string[] | null;
  milestones: Array<{
    type: string;
    message: string;
    session_id: string;
    achieved_at: string;
  }>;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

const COLORS = {
  dsa: "#6366F1",
  system_design: "#0EA5E9",
  behavioral: "#22C55E",
  communication: "#F59E0B",
  overall: "#111111",
};

function deltaBadge(value: number | null | undefined) {
  if (value == null)
    return (
      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
        —
      </span>
    );
  if (value > 0)
    return (
      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
        ↑ +{value.toFixed(1)}
      </span>
    );
  if (value < 0)
    return (
      <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-medium text-rose-700">
        ↓ {value.toFixed(1)}
      </span>
    );
  return (
    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
      —
    </span>
  );
}

function progressWidth(score: number | null | undefined, max = 10) {
  if (score == null) return "0%";
  const pct = Math.max(0, Math.min(100, (score / max) * 100));
  return `${pct}%`;
}

function scoreBadge(score: number | null | undefined) {
  if (score == null) return "bg-gray-100 text-gray-400";
  if (score >= 70) return "bg-emerald-50 text-emerald-700";
  if (score >= 40) return "bg-amber-50 text-amber-700";
  return "bg-rose-50 text-rose-700";
}

function focusPillClass(focus: string | null | undefined) {
  const val = (focus || "").toLowerCase();
  if (val.includes("dsa")) return "bg-indigo-50 text-indigo-700";
  if (val.includes("system")) return "bg-sky-50 text-sky-700";
  if (val.includes("behavior")) return "bg-emerald-50 text-emerald-700";
  if (val.includes("mixed")) return "bg-amber-50 text-amber-700";
  return "bg-gray-100 text-gray-600";
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatShortDate(value: string | null | undefined) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
  highlight,
}: {
  label: string;
  value: string;
  sub?: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border p-5 ${
        highlight
          ? "border-[#111] bg-[#111] text-white"
          : "border-[#E5E7EB] bg-white"
      }`}
    >
      <div className="text-[11px] font-semibold uppercase tracking-wide mb-1 text-[#9CA3AF]">
        {label}
      </div>
      <div
        className={`text-[28px] font-bold ${
          highlight ? "text-white" : "text-[#111]"
        }`}
      >
        {value}
      </div>
      {sub && (
        <div className="mt-0.5 text-[12px] text-[#9CA3AF]">{sub}</div>
      )}
    </div>
  );
}

function ScoreCard({
  label,
  score,
  delta,
  color,
}: {
  label: string;
  score: number | null;
  delta: number | null;
  color: string;
}) {
  return (
    <div className="rounded-xl border border-[#E5E7EB] bg-white p-5">
      <div className="mb-3 flex items-center justify-between">
        <div className="text-[13px] text-[#6B7280]">{label}</div>
        {deltaBadge(delta)}
      </div>
      <div
        className={`text-[32px] font-bold ${
          score == null ? "text-[#9CA3AF]" : "text-[#111]"
        }`}
      >
        {score == null ? "—" : score.toFixed(1)}
      </div>
      <div className="mt-3 h-1.5 w-full rounded-full bg-[#E5E7EB]">
        <div
          className="h-1.5 rounded-full transition-all"
          style={{
            width: progressWidth(score, 10),
            backgroundColor: color,
          }}
        />
      </div>
    </div>
  );
}

function DSAPracticeWidget() {
  const { authHeader } = useAuth();
  const [stats, setStats] = useState<{
    solved: number;
    easy_solved: number;
    medium_solved: number;
    hard_solved: number;
    total_submissions: number;
  } | null>(null);

  useEffect(() => {
    const token =
      typeof window !== "undefined"
        ? localStorage.getItem("access_token") || localStorage.getItem("API_TOKEN")
        : null;
    fetch("/api/dsa/stats", {
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    })
      .then((r) => r.json())
      .then((d) => setStats(d))
      .catch(() => {});
  }, []);

  const total = 185;

  if (!stats || stats.total_submissions === 0) return null;

  return (
    <div className="rounded-2xl border border-[#E5E7EB] bg-white p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-[16px]">💻</span>
          <p className="text-[14px] font-black text-[#111]">DSA Practice</p>
        </div>
        <Link
          href="/dsa"
          className="text-[12px] font-bold text-[#9CA3AF] hover:text-[#111] transition"
        >
          Continue →
        </Link>
      </div>
      <div className="flex items-center gap-4 mb-4">
        <div className="text-center">
          <p className="text-[26px] font-black text-[#111]">{stats.solved}</p>
          <p className="text-[10px] text-[#9CA3AF] uppercase tracking-wide">Solved</p>
        </div>
        <div className="flex-1">
          <div className="h-2 w-full rounded-full bg-[#F3F4F6] overflow-hidden mb-1.5">
            <div
              className="h-full rounded-full bg-[#111] transition-all duration-700"
              style={{ width: `${Math.round((stats.solved / total) * 100)}%` }}
            />
          </div>
          <p className="text-[11px] text-[#9CA3AF]">
            {Math.round((stats.solved / total) * 100)}% of {total} problems
          </p>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: "Easy",   value: stats.easy_solved,   color: "#15803D", bg: "#F0FDF4" },
          { label: "Medium", value: stats.medium_solved, color: "#B45309", bg: "#FFFBEB" },
          { label: "Hard",   value: stats.hard_solved,   color: "#B91C1C", bg: "#FEF2F2" },
        ].map((d) => (
          <div
            key={d.label}
            className="rounded-xl py-2.5 text-center"
            style={{ background: d.bg }}
          >
            <p className="text-[15px] font-black" style={{ color: d.color }}>
              {d.value}
            </p>
            <p className="text-[10px] font-bold" style={{ color: d.color + "99" }}>
              {d.label}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function MockDashboardPage() {
  const { user, loading: authLoading, authHeader } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ── CHANGE 1: credits state ──────────────────────────────────────────────
  const [credits, setCredits] = useState<number>(0);

  useEffect(() => {
    async function loadDashboard() {
      if (authLoading) return;
      if (!user?.id) {
        setLoading(false);
        return;
      }
      try {
        setError(null);
        setLoading(true);
        const res = await fetch(`${API_BASE}/api/mock/dashboard/${user.id}`, {
          headers: authHeader(),
          cache: "no-store",
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body?.detail || "Failed to load dashboard");
        }
        const json = (await res.json()) as DashboardData;
        setData(json);

        // ── CHANGE 2: fetch credit balance ─────────────────────────────────
        let fetchedCredits = 0;
        try {
          const creditRes = await fetch(`${API_BASE}/api/questions/credits`, {
            headers: authHeader(),
          });
          if (creditRes.ok) {
            const creditData = await creditRes.json();
            fetchedCredits = creditData.credits ?? 0;
          }
        } catch { /* ignore */ }
        setCredits(fetchedCredits);

      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Network error");
      } finally {
        setLoading(false);
      }
    }
    loadDashboard();
  }, [authLoading, user?.id, authHeader]);

  const trendData = useMemo(() => {
    const sessions = data?.sessions || [];
    return [...sessions]
      .sort((a, b) =>
        (a.completed_at ?? "").localeCompare(b.completed_at ?? "")
      )
      .map((s) => ({
        date: formatShortDate(s.completed_at),
        overall: s.overall_score != null ? Math.round(s.overall_score) : null,
        dsa: s.dsa_score,
        system_design: s.system_design_score,
        behavioral: s.behavioral_score,
        communication: s.communication_score,
      }));
  }, [data?.sessions]);

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <main className="min-h-screen bg-[#F9FAFB] px-8 py-12">
        <div className="mx-auto max-w-[1100px]">
          <div className="mb-6 h-8 w-60 animate-pulse rounded bg-gray-200" />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="h-36 animate-pulse rounded-xl border border-[#E5E7EB] bg-white"
              />
            ))}
          </div>
        </div>
      </main>
    );
  }

  // ── Error ─────────────────────────────────────────────────────────────────
  if (error) {
    return (
      <main className="min-h-screen bg-[#F9FAFB] px-8 py-12">
        <div className="mx-auto max-w-[1100px] rounded-xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-700">
          {error}
        </div>
      </main>
    );
  }

  const sessions = data?.sessions || [];
  const hasSessions = sessions.length > 0;
  const recentSessions = [...sessions].reverse().slice(0, 20);

  // ── No sessions — Guided Onboarding ─────────────────────────────────────
  if (!hasSessions) {
    const firstName = user?.full_name ? user.full_name.split(" ")[0] : null;

    const WEEK_PLAN = [
      {
        day: "Day 1",
        icon: "🎙️",
        title: "Take your first mock interview",
        sub: "See where you actually stand. 5 questions, 15 minutes, honest score.",
        cta: "Start mock interview →",
        href: "/mock",
        highlight: true,
      },
      {
        day: "Day 2",
        icon: "📅",
        title: "Answer the daily challenge",
        sub: "One question a day. 2 minutes. Builds your streak and your confidence.",
        cta: "Today's question →",
        href: "/daily",
        highlight: false,
      },
      {
        day: "Day 3",
        icon: "💻",
        title: "Try DSA practice",
        sub: "185 problems across Easy, Medium, Hard. Python, Java, C++ supported.",
        cta: "Open DSA practice →",
        href: "/dsa",
        highlight: false,
      },
      {
        day: "Day 4",
        icon: "🔁",
        title: "Do a second mock session",
        sub: "Read your Day 1 report first. Focus on the one specific fix it gives you.",
        cta: "Start another session →",
        href: "/mock",
        highlight: false,
      },
    ];

    return (
      <main className="min-h-screen bg-[#FAFAF8] px-4 pb-16 pt-28 sm:px-8">
        <div className="mx-auto max-w-[1100px]">

          {/* Header */}
          <div className="mb-8">
            <p className="text-[11px] font-black uppercase tracking-widest text-[#9CA3AF] mb-2">
              Progress Dashboard
            </p>
            <h1
              style={{
                fontSize: "clamp(24px, 4vw, 34px)",
                fontWeight: 900,
                letterSpacing: "-1px",
                color: "#111",
              }}
            >
              {firstName ? `Welcome, ${firstName} 👋` : "Welcome to Qued 👋"}
            </h1>
            <p className="mt-1 text-[14px] text-[#6B7280]">
              Here&apos;s your first week. Follow this and you&apos;ll know exactly where you stand by Day 4.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_320px]">
            <div className="space-y-4">

              {/* Week plan card */}
              <div
                className="rounded-3xl border border-[#E5E7EB] bg-white overflow-hidden"
                style={{ boxShadow: "0 4px 40px rgba(0,0,0,0.06)" }}
              >
                {/* Card header */}
                <div
                  className="px-7 py-6 border-b border-[#F3F4F6]"
                  style={{ background: "linear-gradient(135deg, #FFFDF0 0%, #FFF9D6 100%)" }}
                >
                  <div className="flex items-center gap-2 mb-3">
                    <span className="h-1.5 w-1.5 rounded-full bg-yellow-400 animate-pulse" />
                    <span className="text-[11px] font-black uppercase tracking-widest text-[#374151]">
                      Your first week
                    </span>
                  </div>
                  <h2
                    style={{
                      fontSize: "clamp(20px, 3vw, 26px)",
                      fontWeight: 900,
                      letterSpacing: "-0.5px",
                      color: "#111",
                      lineHeight: 1.2,
                    }}
                  >
                    Four days to go from{" "}
                    <span
                      style={{
                        background: "#FFD600",
                        padding: "1px 8px",
                        borderRadius: "5px",
                        fontStyle: "italic",
                      }}
                    >
                      zero to ready.
                    </span>
                  </h2>
                  <p className="mt-2 text-[13px] text-[#6B7280] max-w-md">
                    Don&apos;t guess where to start. Follow this plan. Each step builds on the previous one.
                  </p>
                </div>

                {/* Day steps */}
                <div className="divide-y divide-[#F9FAFB]">
                  {WEEK_PLAN.map((item, i) => (
                    <div
                      key={item.day}
                      className={`flex items-start gap-4 px-7 py-5 transition ${
                        item.highlight ? "bg-[#FAFAF5]" : "hover:bg-[#FAFAF8]"
                      }`}
                    >
                      {/* Step number + icon */}
                      <div className="flex flex-col items-center gap-1 flex-shrink-0">
                        <div
                          className="flex h-10 w-10 items-center justify-center rounded-xl text-[18px]"
                          style={{
                            background: item.highlight ? "#111" : "#F3F4F6",
                          }}
                        >
                          {item.highlight ? (
                            <span className="text-[18px]">{item.icon}</span>
                          ) : (
                            <span className="text-[18px]">{item.icon}</span>
                          )}
                        </div>
                        {i < WEEK_PLAN.length - 1 && (
                          <div className="w-px h-6 bg-[#E5E7EB]" />
                        )}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0 pt-1">
                        <div className="flex items-start justify-between gap-3 flex-wrap">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-0.5">
                              <span
                                className="text-[10px] font-black uppercase tracking-widest"
                                style={{ color: item.highlight ? "#111" : "#9CA3AF" }}
                              >
                                {item.day}
                              </span>
                              {item.highlight && (
                                <span className="rounded-full bg-yellow-400 px-2 py-0.5 text-[9px] font-black text-[#111]">
                                  START HERE
                                </span>
                              )}
                            </div>
                            <p className="text-[14px] font-black text-[#111] leading-snug">
                              {item.title}
                            </p>
                            <p className="text-[12px] text-[#9CA3AF] mt-0.5 leading-relaxed">
                              {item.sub}
                            </p>
                          </div>
                          <Link href={item.href} className="flex-shrink-0">
                            <button
                              className="rounded-xl px-4 py-2 text-[12px] font-black transition whitespace-nowrap"
                              style={{
                                background: item.highlight ? "#111" : "white",
                                color: item.highlight ? "white" : "#374151",
                                border: item.highlight ? "none" : "1.5px solid #E5E7EB",
                              }}
                            >
                              {item.cta}
                            </button>
                          </Link>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* What unlocks after first session */}
              <div className="rounded-2xl border border-[#E5E7EB] bg-white p-6">
                <p className="text-[11px] font-black uppercase tracking-widest text-[#9CA3AF] mb-4">
                  After your first session you&apos;ll unlock
                </p>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { icon: "📈", label: "Score trend chart",      sub: "Watch improvement over time" },
                    { icon: "🎯", label: "Per-question breakdown",  sub: "What you said vs what to say" },
                    { icon: "💡", label: "Model answers",           sub: "The ideal response to each question" },
                    { icon: "🤖", label: "Personal coach note",     sub: "AI identifies your recurring patterns" },
                  ].map(({ icon, label, sub }) => (
                    <div
                      key={label}
                      className="flex items-start gap-3 rounded-xl bg-[#F9FAFB] border border-[#F3F4F6] p-3"
                    >
                      <span className="text-[20px] mt-0.5">{icon}</span>
                      <div>
                        <p className="text-[12px] font-bold text-[#111]">{label}</p>
                        <p className="text-[11px] text-[#9CA3AF] mt-0.5">{sub}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <CalendarWidget />

              <div className="rounded-2xl bg-[#111] p-5">
                <p className="text-[14px] font-black text-white mb-1">
                  While you&apos;re here
                </p>
                <p className="text-[12px] mb-4" style={{ color: "#555" }}>
                  Answer today&apos;s daily question — it takes 2 minutes and builds
                  your streak.
                </p>
                <Link
                  href="/daily"
                  className="block w-full rounded-xl bg-yellow-400 py-2.5 text-center text-[13px] font-black text-[#111] hover:bg-yellow-300 transition"
                >
                  Today&apos;s question →
                </Link>
                <Link
                  href="/submit-question"
                  className="block w-full rounded-xl border border-[#333] py-2.5 text-center text-[13px] font-black text-[#555] hover:text-white hover:border-white transition mt-2"
                >
                  ⚡ Contribute a question → earn credits
                </Link>
              </div>

              <div className="rounded-2xl border border-[#E5E7EB] bg-white p-5">
                <p className="text-[11px] font-black uppercase tracking-widest text-[#9CA3AF] mb-4">
                  Your stats
                </p>
                <div className="space-y-3">
                  {[
                    { label: "Sessions completed", value: "0",      note: "Do your first session" },
                    { label: "Best score",          value: "—",      note: "Unlocks after session 1" },
                    { label: "Current streak",      value: "0 days", note: "Answer daily questions" },
                  ].map(({ label, value, note }) => (
                    <div key={label} className="flex items-center justify-between">
                      <div>
                        <p className="text-[13px] text-[#374151]">{label}</p>
                        <p className="text-[10px] text-[#D1D5DB]">{note}</p>
                      </div>
                      <p className="text-[14px] font-black text-[#D1D5DB]">{value}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    );
  }

  const improvement = data?.improvement ?? null;

  return (
    <main className="min-h-screen bg-[#F9FAFB] px-4 pb-16 pt-28 sm:px-8">
      <div className="mx-auto max-w-[1100px] space-y-8">

        {/* ── Header ── */}
        <div className="space-y-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-[28px] font-bold text-[#111]">
                Progress Dashboard
              </h1>
              <p className="mt-1 text-sm text-[#6B7280]">
                Track your improvement over time
              </p>
            </div>

            {/* ── CHANGE 3: streak + credit badges ── */}
            <div className="flex items-center gap-3 flex-wrap">
              <div className="rounded-full border border-[#FED7AA] bg-[#FFF7ED] px-4 py-1.5 text-sm font-medium text-[#92400E]">
                🔥 {data?.streak || 0} day streak
              </div>
              {credits > 0 && (
                <div className="rounded-full border border-yellow-300 bg-yellow-50 px-4 py-1.5 text-sm font-medium text-[#92400E]">
                  ⚡ {credits} bonus session{credits !== 1 ? "s" : ""} available
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Top stats bar ── */}
        <CalendarWidget />

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard
            label="Total Sessions"
            value={String(data?.total_sessions ?? 0)}
            sub="completed interviews"
          />
          <StatCard
            label="Best Score"
            value={
              data?.best_score != null
                ? `${Math.round(data.best_score)}/100`
                : "—"
            }
            sub="all time"
            highlight={data?.best_score != null && data.best_score >= 70}
          />
          <StatCard
            label="Avg Score"
            value={
              data?.avg_score != null
                ? `${Math.round(data.avg_score)}/100`
                : "—"
            }
            sub="across all sessions"
          />
          <StatCard
            label="Improvement"
            value={
              improvement != null
                ? `${improvement >= 0 ? "+" : ""}${Math.round(improvement)}`
                : "—"
            }
            sub={
              improvement != null
                ? "since first session"
                : "need 2+ sessions"
            }
          />
        </div>

        {/* ── Dimension score cards ── */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <ScoreCard label="DSA"          score={data?.latest_scores?.dsa ?? null}          delta={data?.deltas?.dsa ?? null}          color={COLORS.dsa} />
          <ScoreCard label="System Design" score={data?.latest_scores?.system_design ?? null} delta={data?.deltas?.system_design ?? null} color={COLORS.system_design} />
          <ScoreCard label="Behavioral"   score={data?.latest_scores?.behavioral ?? null}   delta={data?.deltas?.behavioral ?? null}   color={COLORS.behavioral} />
          <ScoreCard label="Communication" score={data?.latest_scores?.communication ?? null} delta={data?.deltas?.communication ?? null} color={COLORS.communication} />
        </div>

        {/* ── DSA Practice widget ── */}
        <DSAPracticeWidget />

        {/* ── Score trend chart ── */}
        <div className="rounded-2xl border border-[#E5E7EB] bg-white p-6">
          <h2 className="mb-1 text-[15px] font-bold text-[#111]">Score Trend</h2>
          <p className="mb-4 text-[12px] text-[#9CA3AF]">
            Overall score per session over time
          </p>
          {trendData.length < 2 ? (
            <div className="rounded-xl bg-[#F9FAFB] p-8 text-center text-sm text-[#6B7280]">
              Complete more sessions to see your trend
            </div>
          ) : (
            <div className="h-[260px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={trendData}
                  margin={{ top: 4, right: 8, left: -16, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                  <XAxis
                    dataKey="date"
                    tick={{ fill: "#9CA3AF", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    domain={[0, 100]}
                    tick={{ fill: "#9CA3AF", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: "10px",
                      border: "1px solid #E5E7EB",
                      fontSize: 12,
                    }}
                    formatter={(value: number | undefined) =>
                      value != null ? [`${value}/100`, "Overall"] : ["—", "Overall"]
                    }
                  />
                  <Line
                    type="monotone"
                    dataKey="overall"
                    stroke={COLORS.overall}
                    strokeWidth={2.5}
                    dot={{ r: 3, fill: "#111" }}
                    activeDot={{ r: 5 }}
                    connectNulls
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* ── Weak spots ── */}
        {data?.weak_spots && data.weak_spots.length > 0 && (
          <div className="rounded-2xl border border-amber-100 bg-[#FFFBEB] p-5">
            <h2 className="mb-3 text-[13px] font-bold uppercase tracking-wide text-amber-700">
              Weak Spots to Focus On
            </h2>
            <div className="flex flex-wrap gap-2">
              {data.weak_spots.map((w) => (
                <span
                  key={w}
                  className="rounded-full bg-amber-100 px-3 py-1 text-[13px] text-amber-800"
                >
                  {w}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* ── Milestones ── */}
        {Boolean(data?.milestones?.length) && (
          <div>
            <h2 className="mb-3 flex items-center gap-2 text-[15px] font-bold text-[#111]">
              <Trophy className="h-4 w-4 text-amber-500" /> Achievements
            </h2>
            <div className="flex gap-3 overflow-x-auto pb-1">
              {data?.milestones.map((m, idx) => (
                <div
                  key={`${m.session_id}-${idx}`}
                  className="min-w-[200px] rounded-2xl border border-[#E5E7EB] bg-white px-4 py-3"
                >
                  <div className="text-sm font-medium text-[#111]">⭐ {m.message}</div>
                  <div className="mt-1 text-xs text-[#9CA3AF]">
                    {formatDate(m.achieved_at)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Session history table ── */}
        <div className="overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white">
          <div className="border-b border-[#E5E7EB] px-5 py-4 flex items-center justify-between">
            <h2 className="text-[15px] font-bold text-[#111]">Session History</h2>
            <span className="text-[12px] text-[#9CA3AF]">{data?.total_sessions} total</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-[#F3F4F6] text-[11px] uppercase tracking-wide text-[#9CA3AF]">
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium">Role</th>
                  <th className="px-4 py-3 font-medium">Level</th>
                  <th className="px-4 py-3 font-medium">Focus</th>
                  <th className="px-4 py-3 font-medium">Questions</th>
                  <th className="px-4 py-3 font-medium">Retries</th>
                  <th className="px-4 py-3 font-medium">Score</th>
                  <th className="px-4 py-3 font-medium">Report</th>
                </tr>
              </thead>
              <tbody>
                {recentSessions.map((s) => (
                  <tr
                    key={s.id}
                    className="border-b border-[#F9FAFB] hover:bg-[#FAFAFA] transition"
                  >
                    <td className="px-4 py-3 text-[#6B7280] text-[13px]">
                      {formatDate(s.completed_at)}
                    </td>
                    <td className="px-4 py-3 text-[13px] font-medium text-[#111]">
                      {s.role_target}
                      {s.company_type && (
                        <span className="ml-1.5 text-[11px] text-[#9CA3AF]">
                          · {s.company_type}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-[11px] capitalize text-gray-700">
                        {s.seniority}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[11px] capitalize ${focusPillClass(s.focus_area)}`}
                      >
                        {s.focus_area || "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[13px] text-[#6B7280]">
                      {s.question_count || "—"}
                    </td>
                    <td className="px-4 py-3 text-[13px] text-[#6B7280]">
                      {s.total_retries > 0 ? (
                        <span className="text-indigo-600 font-medium">
                          {s.total_retries}
                        </span>
                      ) : (
                        "0"
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-lg px-2.5 py-1 text-[12px] font-bold ${scoreBadge(s.overall_score)}`}
                      >
                        {s.overall_score != null
                          ? `${Math.round(s.overall_score)}/100`
                          : "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {s.report_available ? (
                        <Link
                          href={`/mock/report/${s.id}`}
                          className="text-[13px] font-medium text-[#111] underline underline-offset-2 hover:text-indigo-600"
                        >
                          View →
                        </Link>
                      ) : (
                        <span className="text-[12px] text-[#9CA3AF]">Pending</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── CHANGE 4b: CTA with Contribute link ── */}
        <div className="rounded-2xl border border-[#E5E7EB] bg-white px-5 py-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="text-[17px] font-semibold text-[#111]">
                Ready for your next session?
              </div>
              <div className="mt-1 text-sm text-[#6B7280]">Keep the streak going</div>
            </div>
            <div className="flex gap-3 flex-wrap">
              <Link
                href="/submit-question"
                className="rounded-xl border border-[#E5E7EB] bg-white px-5 py-2.5 text-sm font-semibold text-[#374151] hover:bg-[#F9FAFB] transition"
              >
                ⚡ Contribute a question
              </Link>
              <Link
                href="/mock"
                className="rounded-xl bg-[#111] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#333] transition"
              >
                Start Mock Interview →
              </Link>
            </div>
          </div>
        </div>

      </div>
    </main>
  );
}