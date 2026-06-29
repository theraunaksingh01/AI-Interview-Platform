// ═══════════════════════════════════════════════════
// frontend/src/app/admin/sessions/page.tsx
// ═══════════════════════════════════════════════════
"use client";
import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";

const API = (process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:8000").replace(/\/$/, "");

const SCORE_COLOR = (s: number | null) => {
  if (s == null) return "text-[#9CA3AF]";
  if (s >= 80) return "text-emerald-600";
  if (s >= 60) return "text-blue-600";
  if (s >= 40) return "text-amber-600";
  return "text-rose-600";
};

export default function AdminSessionsPage() {
  const { authHeader, user, loading: authLoading } = useAuth();
  const [data, setData] = useState<any>(null);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [company, setCompany] = useState("");
  const [selected, setSelected] = useState<any>(null);
  const [detail, setDetail] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchSessions = useCallback(async () => {
    if (authLoading || !user) return;
    setLoading(true);
    const params = new URLSearchParams({
      page: String(page), per_page: "20",
      ...(status && { status }),
      ...(company && { company }),
    });
    const res = await fetch(`${API}/api/admin/sessions?${params}`, { headers: authHeader() });
    setData(await res.json());
    setLoading(false);
  }, [page, status, company, user, authLoading]);

  useEffect(() => { fetchSessions(); }, [fetchSessions]);

  const openSession = async (s: any) => {
    setSelected(s);
    setDetail(null);
    const res = await fetch(`${API}/api/admin/sessions/${s.id}`, { headers: authHeader() });
    setDetail(await res.json());
  };

  return (
    <div className="space-y-5">
      <div>
        <p className="text-[11px] font-black uppercase tracking-widest text-[#9CA3AF] mb-1">Admin</p>
        <h1 className="text-[28px] font-black text-[#111]" style={{ letterSpacing: "-0.5px" }}>Mock Sessions</h1>
        <p className="text-[13px] text-[#6B7280]">{data?.total || 0} sessions · avg score {data?.avg_score || "—"}/100</p>
      </div>

      {/* Score distribution */}
      {data?.score_distribution && (
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: "Excellent (80+)", value: data.score_distribution.excellent, color: "text-emerald-600" },
            { label: "Good (60-79)", value: data.score_distribution.good, color: "text-blue-600" },
            { label: "Developing (40-59)", value: data.score_distribution.developing, color: "text-amber-600" },
            { label: "Poor (<40)", value: data.score_distribution.poor, color: "text-rose-600" },
          ].map(s => (
            <div key={s.label} className="rounded-xl border border-[#E5E7EB] bg-white p-4">
              <p className={`text-[22px] font-black ${s.color}`}>{s.value}</p>
              <p className="text-[10px] text-[#9CA3AF] mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-2">
        <input value={company} onChange={e => setCompany(e.target.value)} placeholder="Filter by company..."
          className="rounded-xl border border-[#E5E7EB] bg-white px-3 py-2 text-[13px] outline-none focus:border-[#111] transition w-48" />
        <select value={status} onChange={e => setStatus(e.target.value)}
          className="rounded-xl border border-[#E5E7EB] bg-white px-3 py-2 text-[13px] outline-none focus:border-[#111] transition">
          <option value="">All statuses</option>
          <option value="completed">Completed</option>
          <option value="in_progress">In progress</option>
          <option value="abandoned">Abandoned</option>
        </select>
      </div>

      <div className="flex gap-6">
        {/* Table */}
        <div className="flex-1 min-w-0">
          <div className="rounded-2xl border border-[#E5E7EB] bg-white overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#F3F4F6]">
                  {["User", "Company", "Type", "Score", "Duration", "Date", ""].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-[#9CA3AF]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? [...Array(8)].map((_, i) => (
                  <tr key={i} className="border-b border-[#F9FAFB]">
                    {[...Array(7)].map((_, j) => (
                      <td key={j} className="px-4 py-3"><div className="h-4 rounded bg-[#F3F4F6] animate-pulse" /></td>
                    ))}
                  </tr>
                )) : (data?.sessions || []).map((s: any) => (
                  <tr key={s.id} onClick={() => openSession(s)}
                    className={`border-b border-[#F9FAFB] cursor-pointer transition-colors ${selected?.id === s.id ? "bg-[#FFFDF0]" : "hover:bg-[#F9FAFB]"}`}>
                    <td className="px-4 py-3">
                      <p className="text-[12px] font-bold text-[#111] truncate max-w-[120px]">{s.full_name || "—"}</p>
                      <p className="text-[10px] text-[#9CA3AF] truncate max-w-[120px]">{s.email}</p>
                    </td>
                    <td className="px-4 py-3 text-[12px] text-[#374151]">{s.target_company || "—"}</td>
                    <td className="px-4 py-3 text-[11px] text-[#9CA3AF]">{s.session_type || "mock"}</td>
                    <td className="px-4 py-3">
                      <span className={`text-[14px] font-black ${SCORE_COLOR(s.overall_score)}`}>
                        {s.overall_score != null ? Math.round(s.overall_score) : "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[12px] text-[#374151]">{s.duration_mins ? `${s.duration_mins}m` : "—"}</td>
                    <td className="px-4 py-3 text-[11px] text-[#9CA3AF]">
                      {s.created_at ? new Date(s.created_at).toLocaleDateString("en-IN") : "—"}
                    </td>
                    <td className="px-4 py-3 text-[11px] text-[#9CA3AF]">→</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {(data?.pages || 1) > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-[#F3F4F6]">
                <p className="text-[12px] text-[#9CA3AF]">Page {page} of {data?.pages}</p>
                <div className="flex gap-2">
                  <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                    className="rounded-lg border border-[#E5E7EB] px-3 py-1 text-[12px] disabled:opacity-40 hover:bg-[#F9FAFB] transition">← Prev</button>
                  <button onClick={() => setPage(p => Math.min(data?.pages, p + 1))} disabled={page === data?.pages}
                    className="rounded-lg border border-[#E5E7EB] px-3 py-1 text-[12px] disabled:opacity-40 hover:bg-[#F9FAFB] transition">Next →</button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Session detail */}
        {selected && (
          <div className="w-[300px] flex-shrink-0">
            <div className="rounded-2xl border border-[#E5E7EB] bg-white p-5 sticky top-6">
              <div className="flex justify-between mb-4">
                <div>
                  <p className="text-[13px] font-black text-[#111]">{selected.target_company || "Mock"}</p>
                  <p className="text-[11px] text-[#9CA3AF]">{selected.full_name} · {selected.email}</p>
                </div>
                <button onClick={() => { setSelected(null); setDetail(null); }} className="text-[#9CA3AF] hover:text-[#111]">✕</button>
              </div>
              {detail ? (
                <div className="space-y-3">
                  {/* Scores */}
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      ["Overall", detail.session?.overall_score],
                      ["DSA", detail.session?.dsa_score],
                      ["Behavioral", detail.session?.behavioral_score],
                      ["Communication", detail.session?.communication_score],
                    ].map(([label, val]) => (
                      <div key={label as string} className="rounded-xl bg-[#F9FAFB] p-2.5">
                        <p className={`text-[16px] font-black ${SCORE_COLOR(val as number | null)}`}>
                          {val != null ? Math.round(val as number) : "—"}
                        </p>
                        <p className="text-[10px] text-[#9CA3AF]">{label}</p>
                      </div>
                    ))}
                  </div>
                  {/* Coaching report */}
                  {detail.session?.specific_fix && (
                    <div className="rounded-xl bg-[#FFFDF0] border border-yellow-200 p-3">
                      <p className="text-[10px] font-black text-yellow-700 uppercase mb-1">One Fix</p>
                      <p className="text-[12px] text-[#374151]">{detail.session.specific_fix}</p>
                    </div>
                  )}
                  {/* Questions */}
                  {detail.questions?.length > 0 && (
                    <div className="border-t border-[#F3F4F6] pt-3">
                      <p className="text-[10px] font-black uppercase tracking-widest text-[#9CA3AF] mb-2">Questions</p>
                      <div className="space-y-2">
                        {detail.questions.slice(0, 4).map((q: any) => (
                          <div key={q.id} className="flex justify-between gap-2">
                            <p className="text-[11px] text-[#374151] truncate">{q.question_text}</p>
                            <span className={`text-[11px] font-black flex-shrink-0 ${SCORE_COLOR(q.overall_score)}`}>
                              {q.overall_score != null ? Math.round(q.overall_score) : "—"}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {/* Interruptions */}
                  {detail.interruptions?.length > 0 && (
                    <div className="border-t border-[#F3F4F6] pt-3">
                      <p className="text-[10px] font-black uppercase tracking-widest text-[#9CA3AF] mb-1">
                        {detail.interruptions.length} interruption{detail.interruptions.length !== 1 ? "s" : ""}
                      </p>
                      {detail.interruptions.slice(0, 2).map((int: any, i: number) => (
                        <p key={i} className="text-[11px] text-[#9CA3AF]">· {int.type}: {int.directive?.slice(0, 60)}...</p>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  {[...Array(4)].map((_, i) => <div key={i} className="h-10 rounded-xl bg-[#F3F4F6] animate-pulse" />)}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}