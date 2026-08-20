"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const API_BASE = (
  process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:8000"
).replace(/\/$/, "");

interface FeedbackWidgetProps {
  sessionId: string;
  sessionCount: number;
  authHeader: () => Record<string, string>;
}

type Step = "idle" | "form" | "submitted" | "dismissed";

const FAIRNESS_OPTIONS = [
  { value: "too_harsh",   label: "Too harsh" },
  { value: "about_right", label: "About right" },
  { value: "too_easy",    label: "Too easy" },
];

const RELEVANCE_OPTIONS = [
  { value: "yes",      label: "Yes" },
  { value: "somewhat", label: "Somewhat" },
  { value: "no",       label: "No" },
];

const TOPIC_OPTIONS = [
  { value: "behavioural",   label: "Behavioural" },
  { value: "dsa",           label: "DSA" },
  { value: "system_design", label: "System Design" },
  { value: "networking",    label: "Networking" },
  { value: "dbms",          label: "DBMS" },
  { value: "os",            label: "OS" },
  { value: "oops",          label: "OOP" },
];

const RECOMMEND_OPTIONS = [
  { value: "yes",   label: "Yes 👍", activeColor: "#10B981", activeBg: "#F0FDF4", activeBorder: "#10B981" },
  { value: "maybe", label: "Maybe",  activeColor: "#6B7280", activeBg: "#F3F4F6", activeBorder: "#9CA3AF" },
  { value: "no",    label: "No 👎",  activeColor: "#EF4444", activeBg: "#FFF1F2", activeBorder: "#EF4444" },
];

// Standard pill group — black when selected
function PillGroup({
  options,
  value,
  onChange,
}: {
  options: { value: string; label: string }[];
  value: string | null;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className="rounded-full px-3 py-1.5 text-[12px] font-bold border transition-all"
          style={{
            background:   value === o.value ? "#111111" : "white",
            color:        value === o.value ? "white"   : "#374151",
            borderColor:  value === o.value ? "#111111" : "#E5E7EB",
          }}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

// Recommend pill group — colour-coded on selection
function RecommendGroup({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {RECOMMEND_OPTIONS.map((o) => {
        const selected = value === o.value;
        return (
          <button
            key={o.value}
            onClick={() => onChange(o.value)}
            className="rounded-full px-3 py-1.5 text-[12px] font-bold border transition-all"
            style={{
              background:  selected ? o.activeBg     : "white",
              color:       selected ? o.activeColor  : "#374151",
              borderColor: selected ? o.activeBorder : "#E5E7EB",
              fontWeight:  selected ? 800            : 700,
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export default function FeedbackWidget({
  sessionId,
  sessionCount,
  authHeader,
}: FeedbackWidgetProps) {
  const [step, setStep] = useState<Step>("idle");
  const [submitting, setSubmitting] = useState(false);

  const [wouldRecommend,    setWouldRecommend]    = useState<string | null>(null);
  const [scoreFairness,     setScoreFairness]     = useState<string | null>(null);
  const [questionRelevance, setQuestionRelevance] = useState<string | null>(null);
  const [wantedTopic,       setWantedTopic]       = useState<string | null>(null);
  const [freeText,          setFreeText]          = useState("");

  // First session — show encouragement, no form
  if (sessionCount <= 1) {
    return (
      <div className="rounded-2xl border border-[#E5E7EB] bg-white p-6 text-center">
        <p className="text-[22px] mb-2">🎉</p>
        <p className="text-[15px] font-black text-[#111]">Great first session!</p>
        <p className="text-[13px] text-[#9CA3AF] mt-1 max-w-xs mx-auto">
          Do a few more sessions and we'll ask for your thoughts. Keep going!
        </p>
      </div>
    );
  }

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      await fetch(`${API_BASE}/api/feedback/session`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader() },
        body: JSON.stringify({
          session_id:         sessionId,
          would_recommend:    wouldRecommend,
          score_fairness:     scoreFairness,
          question_relevance: questionRelevance,
          wanted_topic:       wantedTopic,
          free_text:          freeText.trim() || null,
        }),
      });
    } catch {
      // Silent fail — never break the report page
    } finally {
      setSubmitting(false);
      setStep("submitted");
    }
  };

  const hasAnyAnswer =
    !!wouldRecommend || !!scoreFairness || !!questionRelevance ||
    !!wantedTopic || !!freeText.trim();

  return (
    <div className="rounded-2xl border border-[#E5E7EB] bg-white overflow-hidden">
      {/* Header */}
      <div className="px-6 py-5 flex items-center justify-between border-b border-[#F3F4F6]">
        <div className="flex items-center gap-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#F9FAFB] border border-[#F3F4F6] text-[16px]">
            💬
          </span>
          <div>
            <p className="text-[14px] font-black text-[#111]">Quick feedback</p>
            <p className="text-[11px] text-[#9CA3AF]">Takes 20 seconds · helps us improve</p>
          </div>
        </div>

        {step === "idle" && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setStep("dismissed")}
              className="text-[11px] text-[#9CA3AF] hover:text-[#6B7280] transition"
            >
              Skip
            </button>
            <button
              onClick={() => setStep("form")}
              className="rounded-xl bg-[#111] px-4 py-2 text-[12px] font-black text-white hover:bg-[#333] transition"
            >
              Give feedback →
            </button>
          </div>
        )}
      </div>

      <AnimatePresence mode="wait">

        {/* IDLE */}
        {step === "idle" && (
          <motion.div
            key="idle"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="px-6 py-4"
          >
            <p className="text-[13px] text-[#6B7280]">
              Would you recommend Cractal to a friend? Were the questions relevant? Tell us — it takes 20 seconds and directly improves the platform.
            </p>
          </motion.div>
        )}

        {/* FORM */}
        {step === "form" && (
          <motion.div
            key="form"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="px-6 py-5 space-y-6"
          >
            {/* Q1 — Recommend (moved to top, colour-coded) */}
            <div>
              <p className="text-[12px] font-black uppercase tracking-widest text-[#9CA3AF] mb-3">
                Would you recommend Cractal to a friend preparing for placements?
              </p>
              <RecommendGroup value={wouldRecommend} onChange={setWouldRecommend} />
            </div>

            {/* Q2 — Score fairness */}
            <div>
              <p className="text-[12px] font-black uppercase tracking-widest text-[#9CA3AF] mb-3">
                Was the AI score fair?
              </p>
              <PillGroup
                options={FAIRNESS_OPTIONS}
                value={scoreFairness}
                onChange={setScoreFairness}
              />
            </div>

            {/* Q3 — Question relevance */}
            <div>
              <p className="text-[12px] font-black uppercase tracking-widest text-[#9CA3AF] mb-3">
                Were the questions relevant to your target company?
              </p>
              <PillGroup
                options={RELEVANCE_OPTIONS}
                value={questionRelevance}
                onChange={setQuestionRelevance}
              />
            </div>

            {/* Q4 — Topic (dropdown to avoid horizontal overflow with 7 options) */}
            <div>
              <p className="text-[12px] font-black uppercase tracking-widest text-[#9CA3AF] mb-3">
                Which topic do you want more of?
              </p>
              <select
                value={wantedTopic || ""}
                onChange={(e) => setWantedTopic(e.target.value || null)}
                className="w-full rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] px-4 py-2.5 text-[13px] text-[#111] focus:outline-none focus:border-[#111] transition appearance-none cursor-pointer"
                style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%239CA3AF' d='M6 8L1 3h10z'/%3E%3C/svg%3E")`, backgroundRepeat: "no-repeat", backgroundPosition: "right 14px center" }}
              >
                <option value="">Select a topic…</option>
                {TOPIC_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>

            {/* Q5 — Free text */}
            <div>
              <p className="text-[12px] font-black uppercase tracking-widest text-[#9CA3AF] mb-3">
                Anything missing or broken?{" "}
                <span className="normal-case font-normal">(optional)</span>
              </p>
              <textarea
                value={freeText}
                onChange={(e) => setFreeText(e.target.value)}
                placeholder="Questions too easy, scoring felt off, the mic didn't work..."
                rows={3}
                maxLength={500}
                className="w-full rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] px-4 py-3 text-[13px] text-[#111] placeholder-[#9CA3AF] resize-none focus:outline-none focus:border-[#111] transition"
              />
              {freeText.length > 400 && (
                <p className="text-[11px] text-[#9CA3AF] mt-1 text-right">
                  {500 - freeText.length} characters left
                </p>
              )}
            </div>

            {/* Submit row */}
            <div className="flex items-center justify-between pt-1">
              <button
                onClick={() => setStep("dismissed")}
                className="text-[12px] text-[#9CA3AF] hover:text-[#6B7280] transition"
              >
                Skip
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting || !hasAnyAnswer}
                className="rounded-xl bg-yellow-400 px-6 py-2.5 text-[13px] font-black text-[#111] hover:bg-yellow-300 transition disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {submitting ? "Submitting..." : "Submit feedback →"}
              </button>
            </div>
          </motion.div>
        )}

        {/* SUBMITTED */}
        {step === "submitted" && (
          <motion.div
            key="submitted"
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            className="px-6 py-8 text-center"
          >
            <p className="text-[28px] mb-3">🙏</p>
            <p className="text-[15px] font-black text-[#111] mb-1">Thanks — this helps a lot</p>
            <p className="text-[13px] text-[#9CA3AF] max-w-xs mx-auto">
              Every response directly shapes what we improve next. Your feedback is read, not ignored.
            </p>
          </motion.div>
        )}

        {/* DISMISSED */}
        {step === "dismissed" && (
          <motion.div
            key="dismissed"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="px-6 py-4"
          >
            <p className="text-[13px] text-[#9CA3AF]">
              No worries. You can always give feedback from your next session.
            </p>
          </motion.div>
        )}

      </AnimatePresence>
    </div>
  );
}