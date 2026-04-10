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

const API_BASE = (process.env.NEXT_PUBLIC_API_BASE || process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000").replace(/\/$/, "");

type SessionItem = {
  id: string;
  role_target: string;
  seniority: string;
  focus_area: string | null;
  overall_score: number | null;
  dsa_score: number | null;
  system_design_score: number | null;
  behavioral_score: number | null;
  communication_score: number | null;
  completed_at: string | null;
  report_available: boolean;
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
  milestones: Array<{ type: string; message: string; session_id: string; achieved_at: string }>;
};

const COLORS = {
  dsa: "#6366F1",
  system_design: "#0EA5E9",
  behavioral: "#22C55E",
  communication: "#F59E0B",
};

function deltaBadge(value: number | null | undefined) {
  if (value == null) return <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">—</span>;
  if (value > 0) return <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">↑ +{value.toFixed(1)}</span>;
  if (value < 0) return <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-medium text-rose-700">↓ {value.toFixed(1)}</span>;
  return <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">—</span>;
}

function progressWidth(score: number | null | undefined) {
  if (score == null) return "0%";
  const pct = Math.max(0, Math.min(100, (score / 10) * 100));
  return `${pct}%`;
}

function overallScoreClass(score: number | null | undefined) {
  if (score == null) return "text-gray-400";
  if (score >= 7) return "text-emerald-600";
  if (score >= 4) return "text-amber-600";
  return "text-rose-600";
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
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export default function MockDashboardPage() {
  const { user, loading: authLoading, authHeader } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
      } catch (e: any) {
        setError(e?.message || "Network error");
      } finally {
        setLoading(false);
      }
    }

    loadDashboard();
  }, [authLoading, user?.id, authHeader]);

  const trendData = useMemo(() => {
    const sessions = data?.sessions || [];
    return sessions.map((s) => ({
      date: s.completed_at ? new Date(s.completed_at).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "—",
      dsa: s.dsa_score,
      system_design: s.system_design_score,
      behavioral: s.behavioral_score,
      communication: s.communication_score,
    }));
  }, [data?.sessions]);

  if (loading) {
    return (
      <main className="min-h-screen bg-[#F9FAFB] px-8 py-12">
        <div className="mx-auto max-w-[1100px]">
          <div className="mb-6 h-8 w-60 animate-pulse rounded bg-gray-200" />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-36 animate-pulse rounded-xl border border-[#E5E7EB] bg-white" />
            ))}
          </div>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen bg-[#F9FAFB] px-8 py-12">
        <div className="mx-auto max-w-[1100px] rounded-xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-700">{error}</div>
      </main>
    );
  }

  const sessions = data?.sessions || [];
  const hasSessions = sessions.length > 0;

  if (!hasSessions) {
    return (
      <main className="min-h-screen bg-[#F9FAFB] px-8 py-12">
        <div className="mx-auto max-w-[1100px]">
          <div className="mb-8 flex items-start justify-between gap-4">
            <div>
              <h1 className="text-[28px] font-bold text-[#111]">Progress Dashboard</h1>
              <p className="mt-1 text-sm text-[#6B7280]">Track your improvement over time</p>
            </div>
            <div className="rounded-full border border-[#FED7AA] bg-[#FFF7ED] px-4 py-1.5 text-sm font-medium text-[#92400E]">🔥 {data?.streak || 0} day streak</div>
          </div>

          <div className="rounded-xl border border-[#E5E7EB] bg-white p-10 text-center">
            <div className="text-xl font-semibold text-[#111]">No sessions yet</div>
            <p className="mt-2 text-sm text-[#6B7280]">Start your first mock interview to track progress</p>
            <Link href="/mock" className="mt-5 inline-flex rounded-lg bg-[#6366F1] px-4 py-2 text-sm font-medium text-white hover:bg-[#5558e7]">
              Start Mock Interview
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#F9FAFB] px-8 py-12">
      <div className="mx-auto max-w-[1100px]">
        <section className="mb-8 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-[28px] font-bold text-[#111]">Progress Dashboard</h1>
            <p className="mt-1 text-sm text-[#6B7280]">Track your improvement over time</p>
          </div>
          <div className="rounded-full border border-[#FED7AA] bg-[#FFF7ED] px-4 py-1.5 text-sm font-medium text-[#92400E]">🔥 {data?.streak || 0} day streak</div>
        </section>

        <section className="mb-8 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <ScoreCard label="DSA" score={data?.latest_scores?.dsa ?? null} delta={data?.deltas?.dsa ?? null} color={COLORS.dsa} />
          <ScoreCard label="System Design" score={data?.latest_scores?.system_design ?? null} delta={data?.deltas?.system_design ?? null} color={COLORS.system_design} />
          <ScoreCard label="Behavioral" score={data?.latest_scores?.behavioral ?? null} delta={data?.deltas?.behavioral ?? null} color={COLORS.behavioral} />
          <ScoreCard label="Communication" score={data?.latest_scores?.communication ?? null} delta={data?.deltas?.communication ?? null} color={COLORS.communication} />
        </section>

        <section className="mb-8 rounded-xl border border-[#E5E7EB] bg-white p-6">
          <h2 className="mb-4 text-base font-semibold text-[#111]">Score Trends</h2>
          {trendData.length < 2 ? (
            <div className="rounded-lg bg-gray-50 p-8 text-center text-sm text-[#6B7280]">Complete more sessions to see trends</div>
          ) : (
            <div className="h-[280px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis dataKey="date" tick={{ fill: "#6B7280", fontSize: 12 }} />
                  <YAxis domain={[0, 10]} tick={{ fill: "#6B7280", fontSize: 12 }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="dsa" stroke={COLORS.dsa} strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="system_design" stroke={COLORS.system_design} strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="behavioral" stroke={COLORS.behavioral} strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="communication" stroke={COLORS.communication} strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>

        {Boolean(data?.milestones?.length) && (
          <section className="mb-8">
            <h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-[#111]"><Trophy className="h-4 w-4 text-amber-500" /> Achievements</h2>
            <div className="flex gap-3 overflow-x-auto pb-1">
              {data?.milestones.map((m, idx) => (
                <div key={`${m.session_id}-${idx}`} className="min-w-[200px] rounded-[10px] border border-[#E5E7EB] bg-white px-4 py-3">
                  <div className="text-sm font-medium text-[#111]">⭐ {m.message}</div>
                  <div className="mt-1 text-xs text-[#6B7280]">{formatDate(m.achieved_at)}</div>
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="mb-8 overflow-hidden rounded-xl border border-[#E5E7EB] bg-white">
          <div className="border-b border-[#E5E7EB] px-5 py-4">
            <h2 className="text-base font-semibold text-[#111]">Session History</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-[#EEF0F3] text-xs uppercase tracking-wide text-[#9CA3AF]">
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium">Role</th>
                  <th className="px-4 py-3 font-medium">Level</th>
                  <th className="px-4 py-3 font-medium">Focus</th>
                  <th className="px-4 py-3 font-medium">Score</th>
                  <th className="px-4 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((s) => (
                  <tr key={s.id} className="border-b border-[#F3F4F6]">
                    <td className="px-4 py-3 text-[#4B5563]">{formatDate(s.completed_at)}</td>
                    <td className="px-4 py-3 text-[#111]">{s.role_target}</td>
                    <td className="px-4 py-3"><span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs capitalize text-gray-700">{s.seniority}</span></td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2.5 py-0.5 text-xs capitalize ${focusPillClass(s.focus_area)}`}>{s.focus_area || "—"}</span>
                    </td>
                    <td className={`px-4 py-3 font-semibold ${overallScoreClass(s.overall_score)}`}>
                      {s.overall_score != null ? s.overall_score.toFixed(1) : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`/mock/report/${s.id}`} className="text-indigo-600 hover:text-indigo-500">View Report</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-xl border border-[#E5E7EB] bg-white px-5 py-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="text-[18px] font-semibold text-[#111]">Ready for your next session?</div>
              <div className="mt-1 text-sm text-[#6B7280]">Keep the streak going</div>
            </div>
            <Link href="/mock" className="rounded-lg bg-[#6366F1] px-4 py-2 text-sm font-medium text-white hover:bg-[#5558e7]">Start Mock Interview →</Link>
          </div>
        </section>
      </div>
    </main>
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
      <div className={`text-[32px] font-bold ${score == null ? "text-[#9CA3AF]" : "text-[#111]"}`}>
        {score == null ? "—" : score.toFixed(1)}
      </div>
      <div className="mt-3 h-1.5 w-full rounded-full bg-[#E5E7EB]">
        <div className="h-1.5 rounded-full" style={{ width: progressWidth(score), backgroundColor: color }} />
      </div>
    </div>
  );
}
