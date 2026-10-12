"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import {
  BarChart3,
  Users,
  Clock,
  CheckCircle2,
  ArrowRight,
  FileText,
} from "lucide-react";

const API_BASE = (
  process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000"
).replace(/\/$/, "");

type Stats = {
  total_interviews: number;
  scored: number;
  avg_score: number | null;
  in_progress: number;
};

type Interview = {
  id: string;
  status: string;
  candidate_name: string | null;
  candidate_email: string | null;
  overall_score: number | null;
  role_title: string | null;
  role_level: string | null;
  created_at: string | null;
};

export default function DashboardPage() {
  const { user, authHeader } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const headers = authHeader();
        const [statsRes, listRes] = await Promise.all([
          fetch(`${API_BASE}/interview/stats`, { headers }),
          fetch(`${API_BASE}/interview/list?limit=10`, { headers }),
        ]);

        if (!statsRes.ok || !listRes.ok) {
          throw new Error("Failed to load dashboard data");
        }

        const statsData = await statsRes.json();
        const listData = await listRes.json();

        setStats(statsData);
        setInterviews(listData.items);
        setTotal(listData.total);
      } catch (e: any) {
        setError(e?.message || "Something went wrong");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [authHeader]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">
          Welcome{user?.full_name ? `, ${user.full_name}` : ""}
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Here&apos;s an overview of your interview activity.
        </p>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={<Users className="h-5 w-5 text-indigo-600" />}
          label="Total Interviews"
          value={stats?.total_interviews ?? 0}
        />
        <StatCard
          icon={<CheckCircle2 className="h-5 w-5 text-emerald-600" />}
          label="Scored"
          value={stats?.scored ?? 0}
        />
        <StatCard
          icon={<BarChart3 className="h-5 w-5 text-amber-600" />}
          label="Avg Score"
          value={stats?.avg_score != null ? `${stats.avg_score}%` : "—"}
        />
        <StatCard
          icon={<Clock className="h-5 w-5 text-blue-600" />}
          label="In Progress"
          value={stats?.in_progress ?? 0}
        />
      </div>

      {/* Recent interviews table */}
      <div className="rounded-xl border border-slate-200 bg-white">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h2 className="text-lg font-semibold text-slate-800">
            Recent Interviews
          </h2>
          <span className="text-sm text-slate-500">{total} total</span>
        </div>

        {interviews.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <FileText className="mx-auto h-10 w-10 text-slate-300" />
            <p className="mt-3 text-sm text-slate-500">
              No interviews yet. Share the candidate submission link to get started.
            </p>
            <Link
              href="/candidate/submit"
              className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-indigo-600 hover:text-indigo-700"
            >
              View Candidate Form <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-xs uppercase tracking-wider text-slate-400">
                  <th className="px-5 py-3 font-medium">Candidate</th>
                  <th className="px-5 py-3 font-medium">Role</th>
                  <th className="px-5 py-3 font-medium">Score</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium">Date</th>
                  <th className="px-5 py-3 font-medium" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {interviews.map((iv) => (
                  <tr key={iv.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-3">
                      <div className="font-medium text-slate-800">
                        {iv.candidate_name || "Unknown"}
                      </div>
                      {iv.candidate_email && (
                        <div className="text-xs text-slate-400">
                          {iv.candidate_email}
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-3 text-slate-600">
                      {iv.role_title || "—"}
                      {iv.role_level && (
                        <span className="ml-1 text-xs text-slate-400">
                          ({iv.role_level})
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      {iv.overall_score != null ? (
                        <span
                          className={
                            iv.overall_score >= 70
                              ? "font-semibold text-emerald-600"
                              : iv.overall_score >= 45
                                ? "font-semibold text-amber-600"
                                : "font-semibold text-red-500"
                          }
                        >
                          {iv.overall_score}%
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <StatusBadge status={iv.status} />
                    </td>
                    <td className="px-5 py-3 text-slate-500">
                      {iv.created_at
                        ? new Date(iv.created_at).toLocaleDateString()
                        : "—"}
                    </td>
                    <td className="px-5 py-3">
                      <InterviewAction id={iv.id} status={iv.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
}) {
  return (
    <div className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-50">
        {icon}
      </div>
      <div>
        <p className="text-sm text-slate-500">{label}</p>
        <p className="text-xl font-bold text-slate-800">{value}</p>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; text: string; label: string }> = {
    created: { bg: "bg-slate-50", text: "text-slate-600", label: "Preparing" },
    recording: { bg: "bg-blue-50", text: "text-blue-700", label: "In Progress" },
    completed: { bg: "bg-emerald-50", text: "text-emerald-700", label: "Completed" },
    scored: { bg: "bg-purple-50", text: "text-purple-700", label: "Scored" },
    failed: { bg: "bg-red-50", text: "text-red-700", label: "Failed" },
  };

  const s = map[status] || {
    bg: "bg-slate-50",
    text: "text-slate-600",
    label: status,
  };

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${s.bg} ${s.text}`}
    >
      {s.label}
    </span>
  );
}

function InterviewAction({ id, status }: { id: string; status: string }) {
  const actionMap: Record<string, { label: string; href: string }> = {
    created: { label: "Resume", href: `/interview/${id}/prepare` },
    recording: { label: "Continue", href: `/interview/${id}/live` },
    completed: { label: "Scoring...", href: `/interview/${id}/evaluation` },
    scored: { label: "View Report", href: `/interview/${id}/evaluation` },
    failed: { label: "View", href: `/interview/${id}/evaluation` },
  };

  const action = actionMap[status] || { label: "View", href: `/interview/${id}/evaluation` };

  return (
    <Link
      href={action.href}
      className="inline-flex items-center gap-1 text-sm font-medium text-indigo-600 hover:text-indigo-700"
    >
      {action.label} <ArrowRight className="h-3.5 w-3.5" />
    </Link>
  );
}
