"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";

const API_BASE = (
  process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:8000"
).replace(/\/$/, "");

type FeedbackItem = {
  id: number;
  session_id: string;
  user_id: number | null;
  user_email: string | null;
  role_target: string | null;
  seniority: string | null;
  score_fairness: string | null;
  question_relevance: string | null;
  wanted_topic: string | null;
  would_recommend: string | null;
  free_text: string | null;
  created_at: string;
};

type RecommendSummary = {
  yes?: number;
  maybe?: number;
  no?: number;
};

const FAIRNESS_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  too_harsh:   { label: "Too harsh",   color: "#EF4444", bg: "#FFF1F2" },
  about_right: { label: "About right", color: "#10B981", bg: "#F0FDF4" },
  too_easy:    { label: "Too easy",    color: "#F59E0B", bg: "#FFFBEB" },
};

const RELEVANCE_LABELS: Record<string, { label: string; color: string }> = {
  yes:      { label: "Yes",      color: "#10B981" },
  somewhat: { label: "Somewhat", color: "#F59E0B" },
  no:       { label: "No",       color: "#EF4444" },
};

const RECOMMEND_LABELS: Record<string, { label: string; color: string }> = {
  yes:   { label: "Yes 👍",  color: "#10B981" },
  maybe: { label: "Maybe",   color: "#F59E0B" },
  no:    { label: "No 👎",   color: "#EF4444" },
};

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-2xl border border-[#E5E7EB] bg-white p-5">
      <p className="text-[11px] font-black uppercase tracking-widest text-[#9CA3AF] mb-1">{label}</p>
      <p className="text-[28px] font-black text-[#111] leading-none">{value}</p>
      {sub && <p className="text-[12px] text-[#9CA3AF] mt-1">{sub}</p>}
    </div>
  );
}

export default function AdminFeedbackPage() {
  const { authHeader } = useAuth();
  const [items, setItems] = useState<FeedbackItem[]>([]);
  const [total, setTotal] = useState(0);
  const [recommend, setRecommend] = useState<RecommendSummary>({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("");

  async function load(fairness?: string) {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "50", offset: "0" });
      if (fairness) params.set("score_fairness", fairness);
      const res = await fetch(`${API_BASE}/api/feedback/admin/list?${params}`, {
        headers: authHeader(),
      });
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      setItems(data.items || []);
      setTotal(data.total || 0);
      setRecommend(data.recommend_summary || {});
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const handleFilter = (f: string) => {
    setFilter(f);
    load(f || undefined);
  };

  // NPS-style score
  const totalRec = (recommend.yes || 0) + (recommend.maybe || 0) + (recommend.no || 0);
  const npsScore = totalRec > 0
    ? Math.round(((recommend.yes || 0) / totalRec) * 100)
    : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-[24px] font-black text-[#111] tracking-tight">Session Feedback</h1>
        <p className="text-[13px] text-[#9CA3AF] mt-1">
          Post-session student feedback — score fairness, question relevance, NPS proxy
        </p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total responses" value={total} />
        <StatCard
          label="Would recommend"
          value={npsScore !== null ? `${npsScore}%` : "—"}
          sub={totalRec > 0 ? `${totalRec} responses` : "No data yet"}
        />
        <StatCard
          label="Score felt harsh"
          value={items.filter(i => i.score_fairness === "too_harsh").length}
          sub="of visible rows"
        />
        <StatCard
          label="Questions irrelevant"
          value={items.filter(i => i.question_relevance === "no").length}
          sub="of visible rows"
        />
      </div>

      {/* Recommend breakdown */}
      {totalRec > 0 && (
        <div className="rounded-2xl border border-[#E5E7EB] bg-white p-5">
          <p className="text-[11px] font-black uppercase tracking-widest text-[#9CA3AF] mb-4">
            Would recommend Cractal?
          </p>
          <div className="flex gap-6">
            {[
              { key: "yes",   label: "Yes 👍",  color: "#10B981" },
              { key: "maybe", label: "Maybe",   color: "#F59E0B" },
              { key: "no",    label: "No 👎",   color: "#EF4444" },
            ].map(({ key, label, color }) => {
              const count = recommend[key as keyof RecommendSummary] || 0;
              const pct = totalRec > 0 ? Math.round((count / totalRec) * 100) : 0;
              return (
                <div key={key} className="flex-1">
                  <div className="flex items-end gap-2 mb-1">
                    <span className="text-[22px] font-black" style={{ color }}>{pct}%</span>
                    <span className="text-[12px] text-[#9CA3AF] mb-0.5">{count} responses</span>
                  </div>
                  <div className="h-2 rounded-full bg-[#F3F4F6] overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${pct}%`, background: color }}
                    />
                  </div>
                  <p className="text-[12px] text-[#374151] mt-1.5 font-medium">{label}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex items-center gap-1 rounded-xl border border-[#E5E7EB] bg-white p-1 w-fit">
        {[
          { val: "",            label: "All" },
          { val: "too_harsh",   label: "Too harsh" },
          { val: "about_right", label: "About right" },
          { val: "too_easy",    label: "Too easy" },
        ].map(({ val, label }) => (
          <button
            key={val}
            onClick={() => handleFilter(val)}
            className={`rounded-lg px-3 py-1.5 text-[12px] font-black transition ${
              filter === val
                ? "bg-[#111] text-white"
                : "text-[#9CA3AF] hover:text-[#111]"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#E5E7EB] border-t-[#111]" />
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-[#E5E7EB] bg-white p-10 text-center">
          <p className="text-[28px] mb-3">💬</p>
          <p className="text-[14px] font-bold text-[#111]">No feedback yet</p>
          <p className="text-[13px] text-[#9CA3AF] mt-1">
            Feedback appears here after students complete their second session.
          </p>
        </div>
      ) : (
        <div className="rounded-2xl border border-[#E5E7EB] bg-white overflow-hidden">
          <div className="grid grid-cols-[1fr_120px_100px_100px_100px_120px] gap-3 px-5 py-3 bg-[#FAFAF8] border-b border-[#F3F4F6]">
            {["Student / Session", "Fairness", "Relevant?", "Want more", "Recommend", "Date"].map((h) => (
              <p key={h} className="text-[10px] font-black uppercase tracking-widest text-[#9CA3AF]">{h}</p>
            ))}
          </div>

          {items.map((item) => {
            const fairness = item.score_fairness ? FAIRNESS_LABELS[item.score_fairness] : null;
            const relevance = item.question_relevance ? RELEVANCE_LABELS[item.question_relevance] : null;
            const rec = item.would_recommend ? RECOMMEND_LABELS[item.would_recommend] : null;

            return (
              <div
                key={item.id}
                className="grid grid-cols-[1fr_120px_100px_100px_100px_120px] gap-3 items-start px-5 py-4 border-b border-[#F9FAFB] last:border-0 hover:bg-[#FAFAF8] transition"
              >
                {/* Student / Session */}
                <div>
                  <p className="text-[13px] font-bold text-[#111] truncate">
                    {item.user_email || "Guest"}
                  </p>
                  <p className="text-[11px] text-[#9CA3AF] truncate">
                    {item.role_target || "—"} · {item.seniority || "—"}
                  </p>
                  {item.free_text && (
                    <p className="text-[11px] text-[#374151] mt-1.5 bg-[#F9FAFB] rounded-lg px-2 py-1.5 leading-relaxed">
                      "{item.free_text}"
                    </p>
                  )}
                </div>

                {/* Fairness */}
                <div>
                  {fairness ? (
                    <span
                      className="rounded-full px-2.5 py-1 text-[11px] font-bold"
                      style={{ background: fairness.bg, color: fairness.color }}
                    >
                      {fairness.label}
                    </span>
                  ) : (
                    <span className="text-[12px] text-[#D1D5DB]">—</span>
                  )}
                </div>

                {/* Relevance */}
                <div>
                  {relevance ? (
                    <span className="text-[12px] font-bold" style={{ color: relevance.color }}>
                      {relevance.label}
                    </span>
                  ) : (
                    <span className="text-[12px] text-[#D1D5DB]">—</span>
                  )}
                </div>

                {/* Wanted topic */}
                <div>
                  {item.wanted_topic ? (
                    <span className="text-[12px] font-medium text-[#374151] capitalize">
                      {item.wanted_topic.replace("_", " ")}
                    </span>
                  ) : (
                    <span className="text-[12px] text-[#D1D5DB]">—</span>
                  )}
                </div>

                {/* Recommend */}
                <div>
                  {rec ? (
                    <span className="text-[12px] font-bold" style={{ color: rec.color }}>
                      {rec.label}
                    </span>
                  ) : (
                    <span className="text-[12px] text-[#D1D5DB]">—</span>
                  )}
                </div>

                {/* Date */}
                <div>
                  <p className="text-[11px] text-[#9CA3AF]">
                    {new Date(item.created_at).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                    })}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}