"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";

const API_BASE = (
  process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:8000"
).replace(/\/$/, "");

type Submission = {
  id: number;
  user_id: number;
  user_email: string;
  company: string;
  role: string;
  round_type: string;
  interview_month: number;
  interview_year: number;
  question_text: string;
  answer_hint: string | null;
  topic: string | null;
  status: string;
  claude_verdict: string | null;
  claude_reason: string | null;
  credits_awarded: boolean;
  created_at: string;
  user_approved_count: number;
  user_total_count: number;
};

const STATUS_STYLES: Record<string, { label: string; color: string; bg: string }> = {
  pending:   { label: "Pending",   color: "#92400E", bg: "#FEF3C7" },
  approved:  { label: "Approved",  color: "#065F46", bg: "#D1FAE5" },
  rejected:  { label: "Rejected",  color: "#991B1B", bg: "#FEE2E2" },
  duplicate: { label: "Duplicate", color: "#374151", bg: "#F3F4F6" },
};

const VERDICT_STYLES: Record<string, { color: string }> = {
  APPROVE: { color: "#10B981" },
  REJECT:  { color: "#EF4444" },
  MANUAL:  { color: "#F59E0B" },
};

const MONTHS = ["","Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

export default function AdminQuestionSubmissionsPage() {
  const { authHeader } = useAuth();
  const [items, setItems] = useState<Submission[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [expanded, setExpanded] = useState<number | null>(null);
  const [acting, setActing] = useState<number | null>(null);

  async function load(status?: string) {
    setLoading(true);
    setSelected(new Set());
    try {
      const params = new URLSearchParams({ limit: "50", offset: "0" });
      if (status) params.set("status", status);
      const res = await fetch(`${API_BASE}/api/questions/admin/submissions?${params}`, {
        headers: authHeader(),
      });
      const data = await res.json();
      setItems(data.items || []);
      setTotal(data.total || 0);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  const handleFilter = (f: string) => {
    setFilter(f);
    load(f || undefined);
  };

  const doAction = async (id: number, action: string) => {
    setActing(id);
    try {
      await fetch(`${API_BASE}/api/questions/admin/submissions/${id}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader() },
        body: JSON.stringify({ action }),
      });
      load(filter || undefined);
    } catch { /* ignore */ }
    finally { setActing(null); }
  };

  const doBulkApprove = async () => {
    if (selected.size === 0) return;
    try {
      await fetch(`${API_BASE}/api/questions/admin/submissions/bulk-approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader() },
        body: JSON.stringify({ submission_ids: Array.from(selected) }),
      });
      load(filter || undefined);
    } catch { /* ignore */ }
  };

  const toggleSelect = (id: number) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const pendingItems = items.filter(i => i.status === "pending");

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-[24px] font-black text-[#111] tracking-tight">Question Submissions</h1>
          <p className="text-[13px] text-[#9CA3AF] mt-1">
            Student-submitted real interview questions — review, approve, and promote to the question bank
          </p>
        </div>
        {selected.size > 0 && (
          <button
            onClick={doBulkApprove}
            className="rounded-xl bg-[#111] px-5 py-2.5 text-[13px] font-black text-white hover:bg-[#333] transition"
          >
            Bulk approve {selected.size} selected →
          </button>
        )}
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total submitted", value: total },
          { label: "Pending review",  value: items.filter(i => i.status === "pending").length },
          { label: "Approved",        value: items.filter(i => i.status === "approved").length },
          { label: "Rejected",        value: items.filter(i => i.status === "rejected").length },
        ].map(({ label, value }) => (
          <div key={label} className="rounded-2xl border border-[#E5E7EB] bg-white p-5">
            <p className="text-[11px] font-black uppercase tracking-widest text-[#9CA3AF] mb-1">{label}</p>
            <p className="text-[28px] font-black text-[#111] leading-none">{value}</p>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-1 rounded-xl border border-[#E5E7EB] bg-white p-1 w-fit">
        {[
          { val: "",          label: "All" },
          { val: "pending",   label: "Pending" },
          { val: "approved",  label: "Approved" },
          { val: "rejected",  label: "Rejected" },
          { val: "duplicate", label: "Duplicate" },
        ].map(({ val, label }) => (
          <button key={val} onClick={() => handleFilter(val)}
            className={`rounded-lg px-3 py-1.5 text-[12px] font-black transition ${
              filter === val ? "bg-[#111] text-white" : "text-[#9CA3AF] hover:text-[#111]"
            }`}>
            {label}
          </button>
        ))}
      </div>

      {/* Bulk select note */}
      {pendingItems.length > 0 && filter === "pending" && (
        <p className="text-[12px] text-[#9CA3AF]">
          Check the boxes next to Claude-recommended APPROVE submissions to bulk approve.
        </p>
      )}

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#E5E7EB] border-t-[#111]" />
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-[#E5E7EB] bg-white p-10 text-center">
          <p className="text-[28px] mb-3">📭</p>
          <p className="text-[14px] font-bold text-[#111]">No submissions yet</p>
          <p className="text-[13px] text-[#9CA3AF] mt-1">Students submit questions from /submit-question</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-[#E5E7EB] bg-white overflow-hidden">
          {items.map((item) => {
            const statusStyle = STATUS_STYLES[item.status] || STATUS_STYLES.pending;
            const verdictStyle = item.claude_verdict ? VERDICT_STYLES[item.claude_verdict] : null;
            const isTrusted = item.user_approved_count >= 5 &&
              item.user_total_count > 0 &&
              item.user_approved_count / item.user_total_count >= 0.5;
            const isExpanded = expanded === item.id;
            const isSelected = selected.has(item.id);

            return (
              <div key={item.id}
                className="border-b border-[#F3F4F6] last:border-0 hover:bg-[#FAFAF8] transition">

                {/* Main row */}
                <div className="px-5 py-4 flex items-start gap-3">

                  {/* Checkbox — only for pending */}
                  {item.status === "pending" && (
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelect(item.id)}
                      className="mt-1 flex-shrink-0 h-4 w-4 rounded border-[#D1D5DB] accent-[#111] cursor-pointer"
                    />
                  )}

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[13px] font-black text-[#111]">{item.company}</span>
                        <span className="text-[11px] text-[#9CA3AF]">·</span>
                        <span className="text-[12px] text-[#374151]">{item.role}</span>
                        <span className="rounded-full bg-[#F3F4F6] px-2 py-0.5 text-[10px] font-bold text-[#374151] capitalize">
                          {item.round_type}
                        </span>
                        <span className="text-[11px] text-[#9CA3AF]">
                          {MONTHS[item.interview_month]} {item.interview_year}
                        </span>
                        {item.topic && (
                          <span className="rounded-full bg-[#EDE9FE] px-2 py-0.5 text-[10px] font-bold text-[#5B21B6] capitalize">
                            {item.topic.replace("_", " ")}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="rounded-full px-2.5 py-1 text-[11px] font-bold"
                          style={{ background: statusStyle.bg, color: statusStyle.color }}>
                          {statusStyle.label}
                        </span>
                        {item.credits_awarded && (
                          <span className="text-[11px] text-[#10B981] font-bold">⚡ credited</span>
                        )}
                      </div>
                    </div>

                    {/* Question preview */}
                    <p className="text-[13px] text-[#374151] mt-2 leading-relaxed line-clamp-2">
                      {item.question_text}
                    </p>

                    {/* Meta row */}
                    <div className="flex items-center gap-4 mt-2 flex-wrap">
                      <p className="text-[11px] text-[#9CA3AF]">
                        By <span className="font-medium text-[#374151]">{item.user_email}</span>
                        {" · "}
                        <span className={isTrusted ? "text-[#10B981] font-bold" : ""}>
                          {item.user_approved_count}/{item.user_total_count} approved
                          {isTrusted && " ✓ trusted"}
                        </span>
                      </p>

                      {verdictStyle && item.claude_verdict && (
                        <p className="text-[11px] font-bold" style={{ color: verdictStyle.color }}>
                          Claude: {item.claude_verdict}
                          {item.claude_reason && (
                            <span className="font-normal text-[#9CA3AF] ml-1">
                              — {item.claude_reason}
                            </span>
                          )}
                        </p>
                      )}

                      <button
                        onClick={() => setExpanded(isExpanded ? null : item.id)}
                        className="text-[11px] font-bold text-[#9CA3AF] hover:text-[#111] transition ml-auto"
                      >
                        {isExpanded ? "Collapse ▲" : "Expand ▼"}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Expanded detail */}
                {isExpanded && (
                  <div className="px-5 pb-5 border-t border-[#F9FAFB] pt-4 space-y-4 bg-[#FAFAF8]">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-[#9CA3AF] mb-1">Full question</p>
                      <p className="text-[13px] text-[#374151] leading-relaxed bg-white rounded-xl border border-[#E5E7EB] px-4 py-3">
                        {item.question_text}
                      </p>
                    </div>

                    {item.answer_hint && (
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-[#9CA3AF] mb-1">Answer hint</p>
                        <p className="text-[13px] text-[#374151] bg-white rounded-xl border border-[#E5E7EB] px-4 py-3">
                          {item.answer_hint}
                        </p>
                      </div>
                    )}

                    {/* Action buttons */}
                    {item.status === "pending" && (
                      <div className="flex flex-wrap gap-2">
                        <button onClick={() => doAction(item.id, "approve")}
                          disabled={acting === item.id}
                          className="rounded-xl bg-[#10B981] px-4 py-2 text-[12px] font-black text-white hover:bg-[#059669] transition disabled:opacity-50">
                          ✓ Approve + credit
                        </button>
                        <button onClick={() => doAction(item.id, "promote")}
                          disabled={acting === item.id}
                          className="rounded-xl bg-[#6366F1] px-4 py-2 text-[12px] font-black text-white hover:bg-[#4F46E5] transition disabled:opacity-50">
                          ↑ Approve + promote to bank
                        </button>
                        <button onClick={() => doAction(item.id, "duplicate")}
                          disabled={acting === item.id}
                          className="rounded-xl bg-[#F3F4F6] px-4 py-2 text-[12px] font-black text-[#374151] hover:bg-[#E5E7EB] transition disabled:opacity-50">
                          Duplicate
                        </button>
                        <button onClick={() => doAction(item.id, "reject")}
                          disabled={acting === item.id}
                          className="rounded-xl bg-[#FEE2E2] px-4 py-2 text-[12px] font-black text-[#991B1B] hover:bg-[#FECACA] transition disabled:opacity-50">
                          ✕ Reject
                        </button>
                      </div>
                    )}

                    {item.status === "approved" && !item.credits_awarded && (
                      <p className="text-[12px] text-amber-600">⚠ Approved but credit not yet awarded</p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}