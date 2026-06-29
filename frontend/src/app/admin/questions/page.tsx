"use client";
import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";

const API = (process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:8000").replace(/\/$/, "");

const DIFF_STYLES: Record<string, string> = {
  easy: "bg-emerald-100 text-emerald-700",
  medium: "bg-amber-100 text-amber-700",
  hard: "bg-rose-100 text-rose-700",
};

export default function AdminQuestionsPage() {
  const { authHeader } = useAuth();
  const [data, setData] = useState<any>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [difficulty, setDifficulty] = useState("");
  const [isActive, setIsActive] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<any>(null);
  const [editForm, setEditForm] = useState<any>({});
  const [saving, setSaving] = useState(false);

  const fetchQuestions = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({
      page: String(page), per_page: "30",
      ...(search && { search }),
      ...(category && { category }),
      ...(difficulty && { difficulty }),
      ...(isActive !== "" && { is_active: isActive }),
    });
    const res = await fetch(`${API}/api/admin/questions?${params}`, { headers: authHeader() });
    setData(await res.json());
    setLoading(false);
  }, [page, search, category, difficulty, isActive]);

  useEffect(() => { fetchQuestions(); }, [fetchQuestions]);

  const openEdit = (q: any) => {
    setEditing(q);
    setEditForm({ question_text: q.question_text, difficulty: q.difficulty, topic: q.topic || "", is_active: q.is_active });
  };

  const saveEdit = async () => {
    if (!editing) return;
    setSaving(true);
    await fetch(`${API}/api/admin/questions/${editing.id}`, {
      method: "PATCH",
      headers: { ...authHeader(), "Content-Type": "application/json" },
      body: JSON.stringify(editForm),
    });
    setSaving(false);
    setEditing(null);
    fetchQuestions();
  };

  return (
    <div className="space-y-5">
      <div>
        <p className="text-[11px] font-black uppercase tracking-widest text-[#9CA3AF] mb-1">Admin</p>
        <h1 className="text-[28px] font-black text-[#111]" style={{ letterSpacing: "-0.5px" }}>Question Bank</h1>
        <p className="text-[13px] text-[#6B7280]">{data?.total || 0} questions</p>
      </div>

      {/* Category breakdown */}
      {data?.category_breakdown && (
        <div className="flex gap-3 flex-wrap">
          {data.category_breakdown.map((c: any) => (
            <div key={c.type} className="rounded-xl border border-[#E5E7EB] bg-white px-4 py-2.5">
              <span className="text-[13px] font-black text-[#111]">{c.active}</span>
              <span className="text-[13px] text-[#9CA3AF]">/{c.count}</span>
              <span className="text-[11px] text-[#9CA3AF] ml-2">{c.type || "unknown"}</span>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
          placeholder="Search question text..."
          className="rounded-xl border border-[#E5E7EB] bg-white px-3 py-2 text-[13px] outline-none focus:border-[#111] transition flex-1 min-w-[200px]" />
        <select value={difficulty} onChange={e => { setDifficulty(e.target.value); setPage(1); }}
          className="rounded-xl border border-[#E5E7EB] bg-white px-3 py-2 text-[13px] outline-none focus:border-[#111] transition">
          <option value="">All difficulties</option>
          <option value="easy">Easy</option>
          <option value="medium">Medium</option>
          <option value="hard">Hard</option>
        </select>
        <select value={isActive} onChange={e => { setIsActive(e.target.value); setPage(1); }}
          className="rounded-xl border border-[#E5E7EB] bg-white px-3 py-2 text-[13px] outline-none focus:border-[#111] transition">
          <option value="">All</option>
          <option value="true">Active only</option>
          <option value="false">Inactive only</option>
        </select>
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-[#E5E7EB] bg-white overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[#F3F4F6]">
              {["Question", "Type", "Topic", "Diff", "Served", "Avg Score", "Status", ""].map(h => (
                <th key={h} className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-[#9CA3AF]">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? [...Array(10)].map((_, i) => (
              <tr key={i} className="border-b border-[#F9FAFB]">
                {[...Array(8)].map((_, j) => <td key={j} className="px-4 py-3"><div className="h-4 rounded bg-[#F3F4F6] animate-pulse" /></td>)}
              </tr>
            )) : (data?.questions || []).map((q: any) => (
              <tr key={q.id} className="border-b border-[#F9FAFB] hover:bg-[#F9FAFB] transition">
                <td className="px-4 py-3 max-w-[260px]">
                  <p className="text-[12px] text-[#374151] line-clamp-2">{q.question_text}</p>
                </td>
                <td className="px-4 py-3 text-[11px] text-[#9CA3AF]">{q.type || "—"}</td>
                <td className="px-4 py-3 text-[11px] text-[#9CA3AF]">{q.topic || "—"}</td>
                <td className="px-4 py-3">
                  {q.difficulty && (
                    <span className={`rounded-full px-2 py-0.5 text-[9px] font-black uppercase ${DIFF_STYLES[q.difficulty] || ""}`}>
                      {q.difficulty}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-[12px] font-black text-[#111]">{q.times_served}</td>
                <td className="px-4 py-3 text-[12px] font-black text-[#111]">{q.avg_score || "—"}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-0.5 text-[9px] font-black uppercase ${q.is_active ? "bg-emerald-100 text-emerald-700" : "bg-[#F3F4F6] text-[#9CA3AF]"}`}>
                    {q.is_active ? "active" : "off"}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <button onClick={() => openEdit(q)}
                    className="text-[11px] text-[#9CA3AF] hover:text-[#111] transition font-bold">
                    Edit
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {(data?.pages || 1) > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-[#F3F4F6]">
            <p className="text-[12px] text-[#9CA3AF]">Page {page} of {data?.pages} · {data?.total} questions</p>
            <div className="flex gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="rounded-lg border border-[#E5E7EB] px-3 py-1 text-[12px] disabled:opacity-40 hover:bg-[#F9FAFB] transition">← Prev</button>
              <button onClick={() => setPage(p => Math.min(data?.pages, p + 1))} disabled={page === data?.pages}
                className="rounded-lg border border-[#E5E7EB] px-3 py-1 text-[12px] disabled:opacity-40 hover:bg-[#F9FAFB] transition">Next →</button>
            </div>
          </div>
        )}
      </div>

      {/* Edit modal */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="w-full max-w-lg rounded-2xl bg-white border border-[#E5E7EB] shadow-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <p className="text-[15px] font-black text-[#111]">Edit Question #{editing.id}</p>
              <button onClick={() => setEditing(null)} className="text-[#9CA3AF] hover:text-[#111] text-[18px]">✕</button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-[#9CA3AF] block mb-1">Question Text</label>
                <textarea value={editForm.question_text || ""} rows={4}
                  onChange={e => setEditForm({ ...editForm, question_text: e.target.value })}
                  className="w-full rounded-xl border border-[#E5E7EB] p-3 text-[13px] outline-none focus:border-[#111] transition resize-none" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-[#9CA3AF] block mb-1">Difficulty</label>
                  <select value={editForm.difficulty || ""} onChange={e => setEditForm({ ...editForm, difficulty: e.target.value })}
                    className="w-full rounded-xl border border-[#E5E7EB] px-3 py-2 text-[13px] outline-none focus:border-[#111] transition">
                    <option value="">—</option>
                    <option value="easy">Easy</option>
                    <option value="medium">Medium</option>
                    <option value="hard">Hard</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-[#9CA3AF] block mb-1">Topic</label>
                  <input value={editForm.topic || ""} onChange={e => setEditForm({ ...editForm, topic: e.target.value })}
                    className="w-full rounded-xl border border-[#E5E7EB] px-3 py-2 text-[13px] outline-none focus:border-[#111] transition" />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="is_active" checked={editForm.is_active ?? true}
                  onChange={e => setEditForm({ ...editForm, is_active: e.target.checked })}
                  className="rounded" />
                <label htmlFor="is_active" className="text-[13px] text-[#374151]">Active (shown in interviews)</label>
              </div>
              <div className="flex gap-2 pt-2">
                <button onClick={saveEdit} disabled={saving}
                  className="flex-1 rounded-xl bg-[#111] text-white py-2.5 text-[13px] font-black hover:bg-[#333] transition disabled:opacity-50">
                  {saving ? "Saving..." : "Save Changes"}
                </button>
                <button onClick={() => setEditing(null)}
                  className="rounded-xl border border-[#E5E7EB] px-4 py-2.5 text-[13px] font-medium hover:bg-[#F9FAFB] transition">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}