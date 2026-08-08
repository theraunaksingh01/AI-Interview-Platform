// frontend/src/app/components/CalendarWidget.tsx
// Replace existing CalendarWidget.tsx
// Changes: post-interview state, "How did it go?" feedback, prepare for next

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { useAuth } from "@/context/AuthContext";

const API_BASE = (
  process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:8000"
).replace(/\/$/, "");

type TodayTask = {
  day: number;
  date: string;
  title: string;
  topic: string;
  task: string;
  session_type: string;
  is_interview_day: boolean;
};

type CalendarData = {
  exists: boolean;
  company?: string;
  role_target?: string;
  interview_date?: string;
  days_remaining?: number;
  today_task?: TodayTask | null;
  is_past?: boolean;
  is_today?: boolean;
};

const TOPIC_ICONS: Record<string, string> = {
  dsa: "💻", "system-design": "🏗️", behavioral: "🎭",
  networking: "🌐", dbms: "🗄️", os: "⚙️", general: "📝",
};

const URGENCY = (days: number) => {
  if (days === 0) return { text: "Interview today!", color: "#EF4444", bg: "#FFF1F2", border: "#FEE2E2" };
  if (days === 1) return { text: "Tomorrow", color: "#F59E0B", bg: "#FFFBEB", border: "#FDE68A" };
  if (days <= 3) return { text: `${days} days left`, color: "#F59E0B", bg: "#FFFBEB", border: "#FDE68A" };
  if (days <= 7) return { text: `${days} days left`, color: "#6366F1", bg: "#EEF2FF", border: "#C7D2FE" };
  return { text: `${days} days left`, color: "#10B981", bg: "#F0FDF4", border: "#BBF7D0" };
};

type FeedbackChoice = "got_offer" | "rejected" | "waiting" | "rescheduled";

const FEEDBACK_OPTIONS: { key: FeedbackChoice; label: string; icon: string; color: string; bg: string }[] = [
  { key: "got_offer", label: "Got the offer! 🎉", icon: "🎉", color: "#065F46", bg: "#D1FAE5" },
  { key: "waiting", label: "Waiting for result", icon: "⏳", color: "#92400E", bg: "#FEF3C7" },
  { key: "rejected", label: "Didn't get through", icon: "💪", color: "#991B1B", bg: "#FEE2E2" },
  { key: "rescheduled", label: "Rescheduled", icon: "📅", color: "#1D4ED8", bg: "#DBEAFE" },
];

export function CalendarWidget() {
  const { authHeader } = useAuth();
  const [data, setData] = useState<CalendarData | null>(null);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<FeedbackChoice | null>(null);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/calendar/my`, {
          headers: authHeader(),
        });
        if (res.ok) setData(await res.json());
      } catch { }
      setLoading(false);
    })();
  }, []);

  if (loading) {
    return (
      <div className="rounded-2xl border border-[#F3F4F6] bg-[#FAFAF8] px-5 py-4 animate-pulse">
        <div className="h-3 w-24 bg-[#E5E7EB] rounded mb-3" />
        <div className="h-4 w-32 bg-[#E5E7EB] rounded" />
      </div>
    );
  }

  if (!data?.exists) {
    return (
      <Link href="/calendar">
        <div className="rounded-2xl border-2 border-dashed border-[#E5E7EB] bg-white p-5 mb-8 hover:border-[#111] hover:bg-[#FAFAF8] transition cursor-pointer">
          <div className="flex items-center gap-3 mb-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#F3F4F6] text-[20px]">
              📅
            </div>
            <div>
              <p className="text-[13px] font-black text-[#111]">Add interview date</p>
              <p className="text-[11px] text-[#9CA3AF]">Get a day-by-day prep plan</p>
            </div>
          </div>
          <div className="space-y-1.5 mb-4">
            {["Day-by-day prep plan", "Topic focus per day", "Countdown to interview"].map(item => (
              <div key={item} className="flex items-center gap-2 text-[11px] text-[#6B7280]">
                <span className="text-emerald-500">✓</span> {item}
              </div>
            ))}
          </div>
          <div className="w-full rounded-xl bg-[#111] py-2.5 text-center text-[12px] font-black text-white">
            Set interview date →
          </div>
        </div>
      </Link>
    );
  }

  const days = data.days_remaining ?? 0;
  const isPast = data.is_past || (days === 0 && !data.is_today);
  const isToday = data.is_today || (days === 0 && !isPast);

  // ── POST-INTERVIEW STATE ──────────────────────────────────────────────────
  if (isPast) {
    if (submitted) {
      const choice = FEEDBACK_OPTIONS.find(f => f.key === feedback);
      return (
        <motion.div
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border overflow-hidden"
          style={{ borderColor: "#BBF7D0", background: "#F0FDF4" }}
        >
          <div className="px-5 py-4">
            <p className="text-[11px] font-black uppercase tracking-widest text-[#065F46] mb-3">
              Recent interview
            </p>
            <p className="text-[15px] font-black text-[#111] mb-0.5">{data.company}</p>
            <p className="text-[12px] text-[#6B7280] mb-3">{data.role_target}</p>

            {choice && (
              <div
                className="rounded-xl px-3 py-2 mb-3 text-[12px] font-bold"
                style={{ background: choice.bg, color: choice.color }}
              >
                {choice.icon} {choice.label}
              </div>
            )}

            {feedback === "got_offer" && (
              <p className="text-[12px] text-[#065F46] mb-3 leading-relaxed">
                Congratulations! 🎊 Share your result with your friends.
              </p>
            )}
            {feedback === "rejected" && (
              <p className="text-[12px] text-[#374151] mb-3 leading-relaxed">
                Keep going — one more session today helps reset.
              </p>
            )}
            {feedback === "waiting" && (
              <p className="text-[12px] text-[#374151] mb-3 leading-relaxed">
                Good luck! Keep preparing while you wait.
              </p>
            )}

            <div className="flex gap-2">
              <Link href="/calendar" className="flex-1">
                <button
                  className="w-full rounded-xl py-2 text-[11px] font-black text-white transition"
                  style={{ background: "#111" }}
                >
                  Set next interview →
                </button>
              </Link>
              <Link href="/mock" className="flex-1">
                <button
                  className="w-full rounded-xl border border-[#E5E7EB] bg-white py-2 text-[11px] font-bold text-[#374151] hover:border-[#111] transition"
                >
                  Practice more
                </button>
              </Link>
            </div>
          </div>
        </motion.div>
      );
    }

    // Ask how it went
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border overflow-hidden"
        style={{ borderColor: "#E5E7EB", background: "white" }}
      >
        <div className="px-5 pt-4 pb-3 border-b border-[#F3F4F6]">
          <p className="text-[11px] font-black uppercase tracking-widest text-[#9CA3AF] mb-1">
            Recent interview
          </p>
          <p className="text-[15px] font-black text-[#111]">{data.company}</p>
          <p className="text-[12px] text-[#6B7280]">{data.role_target}</p>
        </div>
        <div className="px-5 py-4">
          <p className="text-[13px] font-black text-[#111] mb-3">How did it go?</p>
          <div className="grid grid-cols-2 gap-2">
            {FEEDBACK_OPTIONS.map(opt => (
              <button
                key={opt.key}
                onClick={() => { setFeedback(opt.key); setSubmitted(true); }}
                className="rounded-xl px-3 py-2.5 text-[11px] font-bold text-left transition hover:opacity-80"
                style={{ background: opt.bg, color: opt.color }}
              >
                {opt.icon} {opt.label}
              </button>
            ))}
          </div>
          <Link href="/calendar" className="block mt-3 text-center text-[11px] text-[#9CA3AF] hover:text-[#111] transition">
            Set next interview date →
          </Link>
        </div>
      </motion.div>
    );
  }

  // ── INTERVIEW TODAY ───────────────────────────────────────────────────────
  if (isToday) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border overflow-hidden"
        style={{ borderColor: "#FEE2E2", background: "#FFF1F2" }}
      >
        <div className="px-5 pt-4 pb-3 flex items-center justify-between border-b border-[#FEE2E2]">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
            <p className="text-[11px] font-black uppercase tracking-widest text-red-500">
              Interview today!
            </p>
          </div>
          <Link href="/calendar" className="text-[11px] font-bold text-[#9CA3AF] hover:text-[#111] transition">
            View plan →
          </Link>
        </div>
        <div className="px-5 py-4">
          <p className="text-[15px] font-black text-[#111] mb-0.5">{data.company}</p>
          <p className="text-[12px] text-[#6B7280] mb-4">{data.role_target}</p>
          <div className="flex gap-2">
            <Link href="/quick-prep" className="flex-1">
              <button
                className="w-full rounded-xl py-2.5 text-[12px] font-black text-white transition hover:opacity-90"
                style={{ background: "#EF4444" }}
              >
                ☕ Quick warm-up
              </button>
            </Link>
            <Link href="/cheat-sheet" className="flex-1">
              <button
                className="w-full rounded-xl border border-[#FEE2E2] bg-white py-2.5 text-[12px] font-bold text-[#374151] hover:border-red-300 transition"
              >
                ⚡ Cheat sheet
              </button>
            </Link>
          </div>
        </div>
      </motion.div>
    );
  }

  // ── UPCOMING INTERVIEW ────────────────────────────────────────────────────
  const cfg = URGENCY(days);
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border overflow-hidden"
      style={{ borderColor: cfg.border, background: cfg.bg }}
    >
      {/* Header */}
      <div className="px-5 pt-4 pb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full animate-pulse" style={{ background: cfg.color }} />
          <p className="text-[11px] font-black uppercase tracking-widest" style={{ color: cfg.color }}>
            {cfg.text}
          </p>
        </div>
        <Link href="/calendar" className="text-[11px] font-bold text-[#9CA3AF] hover:text-[#111] transition">
          View plan →
        </Link>
      </div>

      {/* Company + role */}
      <div className="px-5 pb-4 border-b" style={{ borderColor: cfg.border }}>
        <p className="text-[16px] font-black text-[#111] leading-tight">{data.company}</p>
        <p className="text-[12px] text-[#6B7280] mt-0.5">
          {data.role_target} ·{" "}
          {data.interview_date && new Date(data.interview_date + "T00:00:00").toLocaleDateString("en-IN", {
            day: "numeric", month: "short", year: "numeric",
          })}
        </p>
      </div>

      {/* Today's task */}
      {data.today_task && !data.today_task.is_interview_day ? (
        <div className="px-5 py-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-[#9CA3AF] mb-2">
            Today&apos;s task
          </p>
          <div className="flex items-start gap-2 mb-3">
            <span className="text-[18px]">{TOPIC_ICONS[data.today_task.topic] || "📝"}</span>
            <div>
              <p className="text-[13px] font-bold text-[#111]">{data.today_task.title}</p>
              <p className="text-[11px] text-[#6B7280] mt-0.5 leading-snug">{data.today_task.task}</p>
            </div>
          </div>
          <Link href="/mock">
            <button
              className="w-full rounded-xl py-2.5 text-[12px] font-black text-white transition hover:opacity-90"
              style={{ background: "#111" }}
            >
              Start today&apos;s session →
            </button>
          </Link>
        </div>
      ) : (
        <div className="px-5 py-4">
          <Link href="/mock">
            <button
              className="w-full rounded-xl py-2.5 text-[12px] font-black text-white transition hover:opacity-90"
              style={{ background: "#111" }}
            >
              Practice for {data.company} →
            </button>
          </Link>
        </div>
      )}
    </motion.div>
  );
}