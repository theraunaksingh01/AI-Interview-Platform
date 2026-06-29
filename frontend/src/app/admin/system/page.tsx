"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";

const API = (process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:8000").replace(/\/$/, "");

function useAdminFetch(path: string) {
  const { authHeader, user, loading: authLoading } = useAuth();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading || !user) return;
    fetch(`${API}${path}`, { headers: authHeader() })
      .then(r => {
        if (!r.ok) throw new Error(`${r.status}`);
        return r.json();
      })
      .then(setData)
      .catch(err => console.error("Admin fetch error:", path, err))
      .finally(() => setLoading(false));
  }, [path, user, authLoading]);

  return { data, loading };
}

export default function AdminSystemPage() {
  const { data, loading } = useAdminFetch("/api/admin/system");

  return (
    <div className="space-y-5">
      <div>
        <p className="text-[11px] font-black uppercase tracking-widest text-[#9CA3AF] mb-1">Admin</p>
        <h1 className="text-[28px] font-black text-[#111]" style={{ letterSpacing: "-0.5px" }}>System</h1>
      </div>

      {/* DSA Execution Stats */}
      <div className="rounded-2xl border border-[#E5E7EB] bg-white p-5">
        <p className="text-[11px] font-black uppercase tracking-widest text-[#9CA3AF] mb-4">Code Execution Stats</p>
        {(data?.dsa_execution_stats || []).length > 0 ? (
          <div className="space-y-3">
            {data.dsa_execution_stats.map((l: any) => {
              const total = l.total || 1;
              return (
                <div key={l.language}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[13px] font-bold text-[#111] capitalize">{l.language}</span>
                    <span className="text-[12px] text-[#9CA3AF]">{l.total} submissions</span>
                  </div>
                  <div className="flex h-2 rounded-full overflow-hidden gap-px">
                    {[
                      { key: "passed", color: "#15803D", v: l.passed },
                      { key: "wrong_answer", color: "#B45309", v: l.wrong_answer },
                      { key: "runtime_error", color: "#B91C1C", v: l.runtime_error },
                      { key: "tle", color: "#7C3AED", v: l.tle },
                      { key: "compilation_error", color: "#6B7280", v: l.compilation_error },
                    ].filter(s => s.v > 0).map(s => (
                      <div key={s.key} style={{ width: `${(s.v / total) * 100}%`, background: s.color }}
                        title={`${s.key}: ${s.v}`} />
                    ))}
                  </div>
                  <div className="flex gap-4 mt-1.5">
                    {[
                      { label: "Passed", value: l.passed, color: "text-emerald-600" },
                      { label: "Wrong", value: l.wrong_answer, color: "text-amber-600" },
                      { label: "Error", value: l.runtime_error, color: "text-rose-600" },
                      { label: "TLE", value: l.tle, color: "text-purple-600" },
                    ].map(s => (
                      <div key={s.label}>
                        <span className={`text-[11px] font-black ${s.color}`}>{s.value}</span>
                        <span className="text-[10px] text-[#9CA3AF] ml-1">{s.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        ) : <p className="text-[13px] text-[#9CA3AF]">No code submissions yet</p>}
      </div>

      {/* Table sizes */}
      <div className="rounded-2xl border border-[#E5E7EB] bg-white overflow-hidden">
        <div className="px-5 py-4 border-b border-[#F3F4F6]">
          <p className="text-[11px] font-black uppercase tracking-widest text-[#9CA3AF]">Database Tables</p>
        </div>
        <table className="w-full">
          <thead>
            <tr className="border-b border-[#F3F4F6]">
              {["Table", "Rows", "Size"].map(h => (
                <th key={h} className="px-5 py-3 text-left text-[10px] font-black uppercase tracking-widest text-[#9CA3AF]">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? [...Array(8)].map((_, i) => (
              <tr key={i} className="border-b border-[#F9FAFB]">
                {[...Array(3)].map((_, j) => <td key={j} className="px-5 py-3"><div className="h-4 rounded bg-[#F3F4F6] animate-pulse" /></td>)}
              </tr>
            )) : (data?.table_sizes || []).map((t: any) => (
              <tr key={t.table_name} className="border-b border-[#F9FAFB] hover:bg-[#F9FAFB] transition">
                <td className="px-5 py-2.5 text-[13px] font-mono text-[#374151]">{t.table_name}</td>
                <td className="px-5 py-2.5 text-[13px] font-black text-[#111]">{Number(t.row_count).toLocaleString()}</td>
                <td className="px-5 py-2.5 text-[12px] text-[#9CA3AF]">{t.size}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}