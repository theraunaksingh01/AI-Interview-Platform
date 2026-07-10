"use client";

import { useState } from "react";

const API_BASE = (
  process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:8000"
).replace(/\/$/, "");

const FLAG_REASONS = [
  { value: "wrong_topic",      label: "Wrong topic for my role" },
  { value: "wrong_language",   label: "Language I don't use"    },
  { value: "unclear_question", label: "Question was unclear"    },
  { value: "other",            label: "Other"                   },
];

interface FlagQuestionButtonProps {
  questionId: number;
  sessionId:  string;
  authHeader: () => Record<string, string>;
}

export default function FlagQuestionButton({
  questionId,
  sessionId,
  authHeader,
}: FlagQuestionButtonProps) {
  const [open,        setOpen]        = useState(false);
  const [reason,      setReason]      = useState("");
  const [submitting,  setSubmitting]  = useState(false);
  const [done,        setDone]        = useState(false);

  const submit = async () => {
    if (!reason || submitting) return;
    setSubmitting(true);
    try {
      await fetch(`${API_BASE}/api/questions/flag`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader() },
        body: JSON.stringify({
          question_id: questionId,
          session_id:  sessionId,
          reason,
        }),
      });
    } catch {
      // Silent fail — never block the student
    } finally {
      setSubmitting(false);
      setOpen(false);
      setDone(true);
    }
  };

  // Done state — small green confirmation inline
  if (done) {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600">
        <span className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-100 text-[9px]">
          ✓
        </span>
        Noted — won&apos;t affect your score
      </span>
    );
  }

  return (
    <div className="relative inline-block">
      {/* Flag trigger */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1 text-[11px] font-medium transition"
        style={{ color: open ? "#EF4444" : "#D1D5DB" }}
        title="Report this question"
        aria-label="Report question"
      >
        <svg
          width="13" height="13" viewBox="0 0 16 16"
          fill="currentColor" xmlns="http://www.w3.org/2000/svg"
        >
          <path d="M3 1.5A.5.5 0 0 1 3.5 1h9a.5.5 0 0 1 .354.854L9.207 5.5l3.647 3.646A.5.5 0 0 1 12.5 10h-9a.5.5 0 0 1-.5-.5v-8z" />
          <rect x="2.5" y="1" width="1" height="14" rx="0.5" />
        </svg>
        Report
      </button>

      {/* Inline dropdown */}
      {open && (
        <div
          className="absolute left-0 top-6 z-20 w-52 rounded-xl border border-[#E5E7EB] bg-white overflow-hidden"
          style={{ boxShadow: "0 4px 20px rgba(0,0,0,0.10)" }}
        >
          <div className="px-3 pt-3 pb-2">
            <p className="text-[10px] font-black uppercase tracking-widest text-[#9CA3AF] mb-2">
              What&apos;s wrong?
            </p>
            <div className="space-y-1">
              {FLAG_REASONS.map((r) => (
                <button
                  key={r.value}
                  onClick={() => setReason(r.value)}
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[12px] transition hover:bg-[#F9FAFB]"
                  style={{
                    color:      reason === r.value ? "#111"        : "#374151",
                    fontWeight: reason === r.value ? 700           : 400,
                    background: reason === r.value ? "#F3F4F6"     : "transparent",
                  }}
                >
                  <span
                    className="flex h-3.5 w-3.5 flex-shrink-0 items-center justify-center rounded-full border text-[8px]"
                    style={{
                      borderColor: reason === r.value ? "#111"        : "#D1D5DB",
                      background:  reason === r.value ? "#111"        : "transparent",
                      color:       reason === r.value ? "white"       : "transparent",
                    }}
                  >
                    ✓
                  </span>
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          <div className="border-t border-[#F3F4F6] px-3 py-2 flex items-center justify-between gap-2">
            <button
              onClick={() => { setOpen(false); setReason(""); }}
              className="text-[11px] text-[#9CA3AF] hover:text-[#6B7280] transition"
            >
              Cancel
            </button>
            <button
              onClick={submit}
              disabled={!reason || submitting}
              className="rounded-lg px-3 py-1.5 text-[11px] font-black transition disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ background: "#111", color: "white" }}
            >
              {submitting ? "Sending..." : "Submit report"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}