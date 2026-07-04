"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";

const API_BASE = (
  process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:8000"
).replace(/\/$/, "");

const ROUND_TYPES = [
  { value: "technical",  label: "Technical" },
  { value: "hr",         label: "HR" },
  { value: "managerial", label: "Managerial" },
  { value: "aptitude",   label: "Aptitude" },
];

const TOPICS = [
  { value: "behavioural",   label: "Behavioural" },
  { value: "dsa",           label: "DSA" },
  { value: "system_design", label: "System Design" },
  { value: "networking",    label: "Networking" },
  { value: "dbms",          label: "DBMS" },
  { value: "os",            label: "OS" },
  { value: "oops",          label: "OOP" },
  { value: "general",       label: "General" },
];

const MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

const YEARS = [2026, 2025, 2024, 2023, 2022, 2021, 2020];

type SubmitState =
  | { type: "idle" }
  | { type: "duplicate_warning"; preview: string }
  | { type: "submitting" }
  | { type: "success"; submissionId: number }
  | { type: "error"; message: string };

export default function SubmitQuestionPage() {
  const { authHeader, user } = useAuth();
  const router = useRouter();

  const [company,    setCompany]    = useState("");
  const [role,       setRole]       = useState("");
  const [roundType,  setRoundType]  = useState("");
  const [month,      setMonth]      = useState("");
  const [year,       setYear]       = useState("");
  const [question,   setQuestion]   = useState("");
  const [hint,       setHint]       = useState("");
  const [topic,      setTopic]      = useState("");

  const [state, setState] = useState<SubmitState>({ type: "idle" });

  const canSubmit =
    company.trim().length >= 2 &&
    role.trim().length >= 2 &&
    roundType &&
    month &&
    year &&
    question.trim().length >= 20;

  const doSubmit = async (forceSubmit = false) => {
    setState({ type: "submitting" });
    try {
      const res = await fetch(`${API_BASE}/api/questions/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader() },
        body: JSON.stringify({
          company:          company.trim(),
          role:             role.trim(),
          round_type:       roundType,
          interview_month:  parseInt(month),
          interview_year:   parseInt(year),
          question_text:    question.trim(),
          answer_hint:      hint.trim() || null,
          topic:            topic || null,
          force_submit:     forceSubmit,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setState({ type: "error", message: data.detail || "Submission failed" });
        return;
      }

      if (data.status === "duplicate_warning") {
        setState({ type: "duplicate_warning", preview: data.existing_preview || "" });
        return;
      }

      setState({ type: "success", submissionId: data.submission_id });
    } catch {
      setState({ type: "error", message: "Network error — please try again" });
    }
  };

  // ── Success ──────────────────────────────────────────────────────────────
  if (state.type === "success") {
    return (
      <main className="min-h-screen bg-[#FAFAF8] px-4 pt-28 pb-16">
        <div className="mx-auto max-w-[560px] text-center">
          <div className="rounded-3xl border border-[#E5E7EB] bg-white p-10">
            <p className="text-[48px] mb-4">🎉</p>
            <h1 className="text-[24px] font-black text-[#111] mb-2">
              Question submitted!
            </h1>
            <p className="text-[14px] text-[#6B7280] leading-relaxed mb-2">
              We'll review it within 48 hours. You'll get a notification and{" "}
              <strong>+1 session credit</strong> when it's approved.
            </p>
            <p className="text-[12px] text-[#9CA3AF] mb-8">
              Submission #{state.submissionId}
            </p>
            <div className="flex flex-col gap-3">
              <button
                onClick={() => {
                  setState({ type: "idle" });
                  setCompany(""); setRole(""); setRoundType(""); setMonth("");
                  setYear(""); setQuestion(""); setHint(""); setTopic("");
                }}
                className="w-full rounded-xl bg-[#111] py-3 text-[13px] font-black text-white hover:bg-[#333] transition"
              >
                Submit another question →
              </button>
              <Link
                href="/mock/dashboard"
                className="w-full rounded-xl border border-[#E5E7EB] py-3 text-[13px] font-bold text-[#374151] hover:bg-[#F9FAFB] transition text-center"
              >
                Back to dashboard
              </Link>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#FAFAF8] px-4 pt-28 pb-16">
      <div className="mx-auto max-w-[640px]">

        {/* Header */}
        <div className="mb-8">
          <Link
            href="/mock/dashboard"
            className="text-[12px] font-medium text-[#9CA3AF] hover:text-[#111] transition uppercase tracking-wide"
          >
            ← Dashboard
          </Link>
          <h1
            style={{
              fontSize: "clamp(26px, 5vw, 38px)",
              fontWeight: 900,
              letterSpacing: "-1px",
              color: "#111",
              marginTop: 12,
              lineHeight: 1.1,
            }}
          >
            Share a real interview question
          </h1>
          <p className="text-[14px] text-[#6B7280] mt-2 leading-relaxed">
            Had a placement interview recently? Share the questions they asked.
            Every approved question earns you{" "}
            <span className="font-bold text-[#111]">+1 session credit</span>{" "}
            (max 5 credits).
          </p>
        </div>

        {/* Credit info strip */}
        <div className="mb-6 rounded-2xl border border-yellow-200 bg-yellow-50 px-5 py-4 flex items-start gap-3">
          <span className="text-[20px] mt-0.5">⚡</span>
          <div>
            <p className="text-[13px] font-bold text-[#92400E]">1 approved question = 1 bonus mock session</p>
            <p className="text-[12px] text-[#92400E] mt-0.5">
              Credits are added after admin review — usually within 48 hours. Cap: 5 credits per user.
            </p>
          </div>
        </div>

        {/* Duplicate warning */}
        {state.type === "duplicate_warning" && (
          <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4">
            <p className="text-[13px] font-bold text-amber-800 mb-1">
              ⚠ A similar question already exists in our bank
            </p>
            <p className="text-[12px] text-amber-700 mb-1 italic">
              "{state.preview}..."
            </p>
            <p className="text-[12px] text-amber-700 mb-3">
              If this is from a different company or a different year, it's still valuable. Submit anyway?
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => doSubmit(true)}
                className="rounded-xl bg-amber-600 px-4 py-2 text-[12px] font-black text-white hover:bg-amber-700 transition"
              >
                Yes, submit anyway
              </button>
              <button
                onClick={() => setState({ type: "idle" })}
                className="rounded-xl border border-amber-300 px-4 py-2 text-[12px] font-bold text-amber-700 hover:bg-amber-100 transition"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Error */}
        {state.type === "error" && (
          <div className="mb-6 rounded-2xl border border-rose-200 bg-rose-50 px-5 py-3">
            <p className="text-[13px] text-rose-700">{state.message}</p>
          </div>
        )}

        {/* Form */}
        <div className="rounded-2xl border border-[#E5E7EB] bg-white p-6 space-y-5">

          {/* Company + Role */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-black uppercase tracking-widest text-[#9CA3AF] mb-2">
                Company *
              </label>
              <input
                type="text"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder="TCS, Infosys, Amazon…"
                className="w-full rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] px-4 py-2.5 text-[13px] text-[#111] placeholder-[#9CA3AF] focus:outline-none focus:border-[#111] transition"
              />
            </div>
            <div>
              <label className="block text-[11px] font-black uppercase tracking-widest text-[#9CA3AF] mb-2">
                Role offered *
              </label>
              <input
                type="text"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                placeholder="Software Engineer, Analyst…"
                className="w-full rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] px-4 py-2.5 text-[13px] text-[#111] placeholder-[#9CA3AF] focus:outline-none focus:border-[#111] transition"
              />
            </div>
          </div>

          {/* Round type */}
          <div>
            <label className="block text-[11px] font-black uppercase tracking-widest text-[#9CA3AF] mb-2">
              Round type *
            </label>
            <div className="flex flex-wrap gap-2">
              {ROUND_TYPES.map((r) => (
                <button
                  key={r.value}
                  onClick={() => setRoundType(r.value)}
                  className="rounded-full px-3 py-1.5 text-[12px] font-bold border transition-all"
                  style={{
                    background:  roundType === r.value ? "#111" : "white",
                    color:       roundType === r.value ? "white" : "#374151",
                    borderColor: roundType === r.value ? "#111" : "#E5E7EB",
                  }}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          {/* Month + Year */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-black uppercase tracking-widest text-[#9CA3AF] mb-2">
                Month of interview *
              </label>
              <select
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                className="w-full rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] px-4 py-2.5 text-[13px] text-[#111] focus:outline-none focus:border-[#111] transition appearance-none cursor-pointer"
              >
                <option value="">Select month…</option>
                {MONTHS.map((m, i) => (
                  <option key={m} value={String(i + 1)}>{m}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-black uppercase tracking-widest text-[#9CA3AF] mb-2">
                Year *
              </label>
              <select
                value={year}
                onChange={(e) => setYear(e.target.value)}
                className="w-full rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] px-4 py-2.5 text-[13px] text-[#111] focus:outline-none focus:border-[#111] transition appearance-none cursor-pointer"
              >
                <option value="">Select year…</option>
                {YEARS.map((y) => (
                  <option key={y} value={String(y)}>{y}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Topic */}
          <div>
            <label className="block text-[11px] font-black uppercase tracking-widest text-[#9CA3AF] mb-2">
              Topic <span className="normal-case font-normal">(optional)</span>
            </label>
            <select
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              className="w-full rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] px-4 py-2.5 text-[13px] text-[#111] focus:outline-none focus:border-[#111] transition appearance-none cursor-pointer"
            >
              <option value="">Select topic…</option>
              {TOPICS.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>

          {/* Question text */}
          <div>
            <label className="block text-[11px] font-black uppercase tracking-widest text-[#9CA3AF] mb-2">
              The exact question as asked *
            </label>
            <textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Write the question exactly as the interviewer asked it…"
              rows={4}
              maxLength={2000}
              className="w-full rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] px-4 py-3 text-[13px] text-[#111] placeholder-[#9CA3AF] resize-none focus:outline-none focus:border-[#111] transition"
            />
            <div className="flex items-center justify-between mt-1">
              <p className="text-[11px] text-[#9CA3AF]">Minimum 20 characters</p>
              <p className="text-[11px] text-[#9CA3AF]">{question.length}/2000</p>
            </div>
          </div>

          {/* Answer hint */}
          <div>
            <label className="block text-[11px] font-black uppercase tracking-widest text-[#9CA3AF] mb-2">
              What they were looking for{" "}
              <span className="normal-case font-normal">(optional — helps us verify quality)</span>
            </label>
            <textarea
              value={hint}
              onChange={(e) => setHint(e.target.value)}
              placeholder="They wanted to see STAR format, they asked for time complexity, they wanted to know about normalisation…"
              rows={2}
              maxLength={1000}
              className="w-full rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] px-4 py-3 text-[13px] text-[#111] placeholder-[#9CA3AF] resize-none focus:outline-none focus:border-[#111] transition"
            />
          </div>

          {/* Submit */}
          <button
            onClick={() => doSubmit(false)}
            disabled={!canSubmit || state.type === "submitting"}
            className="w-full rounded-xl bg-[#111] py-3.5 text-[14px] font-black text-white hover:bg-[#333] transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {state.type === "submitting" ? "Submitting…" : "Submit question →"}
          </button>

          <p className="text-center text-[11px] text-[#9CA3AF]">
            Reviewed within 48 hours · +1 credit on approval · max 5 credits per user
          </p>
        </div>

      </div>
    </main>
  );
}