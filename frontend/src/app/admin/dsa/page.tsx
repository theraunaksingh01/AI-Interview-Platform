// ═══════════════════════════════════════════════════
// frontend/src/app/admin/dsa/page.tsx
// ═══════════════════════════════════════════════════
"use client";
import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";

const API = (process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:8000").replace(/\/$/, "");

const DIFF_STYLES: Record<string, string> = {
  easy: "bg-emerald-100 text-emerald-700",
  medium: "bg-amber-100 text-amber-700",
  hard: "bg-rose-100 text-rose-700",
};

export function AdminDSAPage() {
  const { authHeader } = useAuth();
  const [data, setData] = useState<any>(null);
  const [page, setPage] = useState(1);
  const [topic, setTopic] = useState("");
  const [difficulty, setDifficulty] = useState("");
  const [sortDir, setSortDir] = useState("asc");
  const [loading, setLoading] = useState(true);

  const fetchProblems = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({
      page: String(page), per_page: "30", sort_by: "solve_rate", sort_dir: sortDir,
      ...(topic && { topic }),
      ...(difficulty && { difficulty }),
    });
    const res = await fetch(`${API}/api/admin/dsa/problems?${params}`, { headers: authHeader() });
    setData(await res.json());
    setLoading(false);
  }, [page, topic, difficulty, sortDir]);

  useEffect(() => { fetchProblems(); }, [fetchProblems]);

  const topics = Array.from(new Set((data?.topic_stats || []).map((t: any) => t.topic)));
  const langDist = data?.language_distribution || [];
  const totalLang = langDist.reduce((a: number, l: any) => a + l.count, 0);

  return (
    <div className="space-y-5">
      <div>
        <p className="text-[11px] font-black uppercase tracking-widest text-[#9CA3AF] mb-1">Admin</p>
        <h1 className="text-[28px] font-black text-[#111]" style={{ letterSpacing: "-0.5px" }}>DSA Practice</h1>
        <p className="text-[13px] text-[#6B7280]">{data?.total || 0} problems</p>
      </div>

      {/* Language distribution */}
      {langDist.length > 0 && (
        <div className="flex gap-3">
          {langDist.map((l: any) => (
            <div key={l.language} className="rounded-xl border border-[#E5E7EB] bg-white px-4 py-2.5">
              <span className="text-[18px] font-black text-[#111]">{l.count}</span>
              <span className="text-[11px] text-[#9CA3AF] ml-2">{l.language} · {Math.round(l.count / totalLang * 100)}%</span>
            </div>
          ))}
        </div>
      )}

      {/* Topic breakdown */}
      {(data?.topic_stats || []).length > 0 && (
        <div className="rounded-2xl border border-[#E5E7EB] bg-white p-5">
          <p className="text-[11px] font-black uppercase tracking-widest text-[#9CA3AF] mb-4">Topic Breakdown</p>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
            {data.topic_stats.map((t: any) => (
              <div key={t.topic} className="flex items-center justify-between">
                <span className="text-[12px] text-[#374151]">{t.topic}</span>
                <span className="text-[12px] font-black text-[#111]">{t.attempts || 0} attempts</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        <select value={topic} onChange={e => { setTopic(e.target.value); setPage(1); }}
          className="rounded-xl border border-[#E5E7EB] bg-white px-3 py-2 text-[13px] outline-none focus:border-[#111] transition">
          <option value="">All topics</option>
          {(topics as string[]).map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <select value={difficulty} onChange={e => { setDifficulty(e.target.value); setPage(1); }}
          className="rounded-xl border border-[#E5E7EB] bg-white px-3 py-2 text-[13px] outline-none focus:border-[#111] transition">
          <option value="">All difficulties</option>
          <option value="easy">Easy</option>
          <option value="medium">Medium</option>
          <option value="hard">Hard</option>
        </select>
        <button onClick={() => setSortDir(d => d === "asc" ? "desc" : "asc")}
          className="rounded-xl border border-[#E5E7EB] bg-white px-3 py-2 text-[12px] font-bold hover:bg-[#F9FAFB] transition">
          Solve rate {sortDir === "asc" ? "↑ lowest first" : "↓ highest first"}
        </button>
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-[#E5E7EB] bg-white overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[#F3F4F6]">
              {["Problem", "Topic", "Diff", "Attempts", "Unique Users", "Solve Rate", ""].map(h => (
                <th key={h} className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-[#9CA3AF]">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? [...Array(10)].map((_, i) => (
              <tr key={i} className="border-b border-[#F9FAFB]">
                {[...Array(7)].map((_, j) => <td key={j} className="px-4 py-3"><div className="h-4 rounded bg-[#F3F4F6] animate-pulse" /></td>)}
              </tr>
            )) : (data?.problems || []).map((p: any) => (
              <tr key={p.id} className="border-b border-[#F9FAFB] hover:bg-[#F9FAFB] transition">
                <td className="px-4 py-3 max-w-[200px]">
                  <p className="text-[13px] font-bold text-[#111] truncate">{p.problem_name}</p>
                </td>
                <td className="px-4 py-3 text-[11px] text-[#9CA3AF]">{p.topic}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-0.5 text-[9px] font-black uppercase ${DIFF_STYLES[p.difficulty] || ""}`}>
                    {p.difficulty}
                  </span>
                </td>
                <td className="px-4 py-3 text-[12px] font-black text-[#111]">{p.total_attempts}</td>
                <td className="px-4 py-3 text-[12px] font-black text-[#111]">{p.unique_users}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="w-16 h-1.5 rounded-full bg-[#F3F4F6] overflow-hidden">
                      <div className="h-full rounded-full bg-[#111]" style={{ width: `${p.solve_rate}%` }} />
                    </div>
                    <span className="text-[12px] font-black text-[#111]">{p.solve_rate}%</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-[11px] text-[#9CA3AF]">
                  {p.total_attempts === 0 ? (
                    <span className="text-amber-500 font-bold text-[10px]">No attempts</span>
                  ) : p.solve_rate < 20 ? (
                    <span className="text-rose-500 font-bold text-[10px]">Hard problem</span>
                  ) : p.solve_rate > 80 ? (
                    <span className="text-emerald-500 font-bold text-[10px]">Easy</span>
                  ) : null}
                </td>
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
  );
}

export default AdminDSAPage;