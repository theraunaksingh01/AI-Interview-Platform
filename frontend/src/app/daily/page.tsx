"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/context/AuthContext";
import { FooterHero } from "@/app/components/Footer";

const API_BASE = (
  process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:8000"
).replace(/\/$/, "");

// ─── Types ────────────────────────────────────────────────────────────────────

type Question = {
  id: number;
  scheduled_date: string;
  question_text: string;
  topic: string;
  difficulty: number;
  company_tag: string | null;
  answer_framework: string;
  model_answer?: string;
};

type TodayData = {
  question: Question;
  answered: { score: number; better_answer: string } | null;
  date: string;
};

type WeekDay = {
  date: string;
  day: string;
  answered: boolean;
  is_today: boolean;
  is_future: boolean;
};

type StreakData = {
  streak: number;
  longest_streak: number;
  total_answered: number;
  week: WeekDay[];
  answered_today: boolean;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const TOPIC_META: Record<string, { label: string; color: string; bg: string; dot: string; mockRole: string }> = {
  behavioral:      { label: "Behavioural",   color: "#065f46", bg: "#d1fae5", dot: "#10B981", mockRole: "Backend Engineer" },
  dsa:             { label: "DSA",           color: "#5b21b6", bg: "#ede9fe", dot: "#8B5CF6", mockRole: "Backend Engineer" },
  "system-design": { label: "System Design", color: "#92400e", bg: "#fef3c7", dot: "#F59E0B", mockRole: "System Design" },
  networking:      { label: "Networking",    color: "#1e40af", bg: "#dbeafe", dot: "#3B82F6", mockRole: "Backend Engineer" },
  general:         { label: "General",       color: "#374151", bg: "#f3f4f6", dot: "#6B7280", mockRole: "Backend Engineer" },
};

const DIFF: Record<number, { label: string; color: string; bg: string }> = {
  1: { label: "Easy",   color: "#10B981", bg: "#F0FDF4" },
  2: { label: "Medium", color: "#F59E0B", bg: "#FFFBEB" },
  3: { label: "Hard",   color: "#EF4444", bg: "#FFF1F2" },
};

const PAST = [
  { date: "Yesterday",  topic: "dsa",          label: "What is the difference between a stack and a queue?", attempts: 143 },
  { date: "2 days ago", topic: "behavioral",    label: "Tell me about yourself and why you chose CS.",         attempts: 201 },
  { date: "3 days ago", topic: "system-design", label: "Design a URL shortener like bit.ly.",                 attempts: 98  },
];

const LEADERBOARD = [
  { rank: 1, name: "Priya S.",  college: "IIT Bombay",  score: 94, streak: 12 },
  { rank: 2, name: "Rohan M.",  college: "NIT Trichy",  score: 91, streak: 9  },
  { rank: 3, name: "Aditya K.", college: "BITS Pilani", score: 88, streak: 7  },
  { rank: 4, name: "Sneha R.",  college: "VIT Vellore", score: 85, streak: 5  },
  { rank: 5, name: "Arjun P.",  college: "DTU Delhi",   score: 82, streak: 4  },
];

const RANK_ICONS: Record<number, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };

function scoreColor(s: number) {
  if (s >= 75) return "#10B981";
  if (s >= 50) return "#F59E0B";
  return "#EF4444";
}

// ─── Right panel — Practice CTA ───────────────────────────────────────────────

function PracticePanel({ question, user }: { question: Question; user: unknown }) {
  const meta = TOPIC_META[question.topic] || TOPIC_META.general;
  const diff = DIFF[question.difficulty] || DIFF[2];
  const [showAnswer, setShowAnswer] = useState(false);

  // Build mock URL pre-configured for this topic
  const mockUrl = `/mock?prefill_role=${encodeURIComponent(meta.mockRole)}&prefill_difficulty=intermediate`;

  return (
    <div className="flex flex-col gap-4">

      {/* Framework card */}
      <div className="rounded-2xl border border-[#E5E7EB] bg-white overflow-hidden">
        <div className="px-5 pt-5 pb-4">
          <div className="flex items-center gap-2 mb-4">
            <span className="flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-widest"
              style={{ background: meta.bg, color: meta.color }}>
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: meta.dot }} />
              {meta.label}
            </span>
            <span className="rounded-full px-2.5 py-1 text-[11px] font-bold"
              style={{ background: diff.bg, color: diff.color }}>
              {diff.label}
            </span>
          </div>

          {/* How to approach */}
          <p className="text-[11px] font-black uppercase tracking-widest text-[#9CA3AF] mb-2">
            How to approach this
          </p>
          <p className="text-[14px] text-[#374151] leading-relaxed">
            {question.answer_framework}
          </p>
        </div>

        {/* Divider */}
        <div className="h-px bg-[#F3F4F6]" />

        {/* Key signals */}
        <div className="px-5 py-4">
          <p className="text-[11px] font-black uppercase tracking-widest text-[#9CA3AF] mb-3">
            What interviewers look for
          </p>
          <div className="space-y-2">
            {question.topic === "dsa" && [
              "Clear explanation before jumping to code",
              "Time and space complexity analysis",
              "Edge case handling",
            ].map((s, i) => (
              <div key={i} className="flex items-start gap-2">
                <span className="mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full bg-yellow-400 text-[8px] font-black text-[#111]">✓</span>
                <p className="text-[12px] text-[#374151]">{s}</p>
              </div>
            ))}
            {question.topic === "behavioral" && [
              "Specific example, not a generic story",
              "Your personal contribution, not 'we'",
              "What you learned from the experience",
            ].map((s, i) => (
              <div key={i} className="flex items-start gap-2">
                <span className="mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full bg-yellow-400 text-[8px] font-black text-[#111]">✓</span>
                <p className="text-[12px] text-[#374151]">{s}</p>
              </div>
            ))}
            {(question.topic === "system-design" || question.topic === "networking") && [
              "Clarify requirements before designing",
              "Estimate scale before architecture",
              "State trade-offs explicitly",
            ].map((s, i) => (
              <div key={i} className="flex items-start gap-2">
                <span className="mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full bg-yellow-400 text-[8px] font-black text-[#111]">✓</span>
                <p className="text-[12px] text-[#374151]">{s}</p>
              </div>
            ))}
            {question.topic === "general" && [
              "Structured, clear explanation",
              "Real-world example from your experience",
              "Awareness of limitations or trade-offs",
            ].map((s, i) => (
              <div key={i} className="flex items-start gap-2">
                <span className="mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full bg-yellow-400 text-[8px] font-black text-[#111]">✓</span>
                <p className="text-[12px] text-[#374151]">{s}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Practice CTA — the main action */}
      <div className="rounded-2xl bg-[#111] p-5">
        <div className="flex items-start gap-3 mb-4">
          <span className="text-[28px]">🎙️</span>
          <div>
            <p className="text-[15px] font-black text-white leading-tight">
              Practice answering out loud
            </p>
            <p className="text-[12px] mt-1" style={{ color: "#666" }}>
              Start a focused mock session on {meta.label} questions. Live coaching, AI scoring, model answers.
            </p>
          </div>
        </div>
        <Link href={mockUrl}>
          <button className="w-full rounded-xl bg-yellow-400 py-3 text-[13px] font-black text-[#111] hover:bg-yellow-300 transition active:scale-[0.99]">
            Start {meta.label} session →
          </button>
        </Link>
        <p className="mt-2.5 text-center text-[11px]" style={{ color: "#444" }}>
          {user ? "Sessions count toward your progress" : "Free · No card required"}
        </p>
      </div>

      {/* Model answer — collapsed by default */}
      <div className="rounded-2xl border border-[#E5E7EB] bg-white overflow-hidden">
        <button
          onClick={() => setShowAnswer(v => !v)}
          className="flex w-full items-center justify-between px-5 py-4 hover:bg-[#FAFAF8] transition"
        >
          <div className="flex items-center gap-2.5">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#F3F4F6] text-[14px]">💡</span>
            <div className="text-left">
              <p className="text-[13px] font-bold text-[#111]">See a strong answer</p>
              <p className="text-[11px] text-[#9CA3AF]">Try answering first for best results</p>
            </div>
          </div>
          <span className="text-[12px] font-bold text-[#9CA3AF]">{showAnswer ? "Hide ▲" : "Reveal ▼"}</span>
        </button>

        <AnimatePresence>
          {showAnswer && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="overflow-hidden"
            >
              <div className="border-t border-[#F3F4F6] px-5 py-4">
                <p className="text-[13px] text-[#374151] leading-relaxed">
                  {/* Use model_answer if available, else use a note */}
                  {question.model_answer ||
                    "Model answer will appear here. The full answer is available after you complete a mock session with this topic."}
                </p>
                <div className="mt-3 rounded-xl bg-[#F9FAFB] border border-[#F3F4F6] px-3 py-2">
                  <p className="text-[11px] text-[#9CA3AF]">
                    💡 Pro tip — read this after attempting the question yourself. The gap between your answer and this one shows exactly what to work on.
                  </p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function DailyPage() {
  const { user, authHeader } = useAuth();
  const [todayData, setTodayData] = useState<TodayData | null>(null);
  const [streakData, setStreakData] = useState<StreakData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"challenges" | "leaderboard">("challenges");

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const res = await fetch(`${API_BASE}/api/daily/today`, { headers: authHeader(), cache: "no-store" });
        if (!res.ok) throw new Error("Failed to load");
        const data = await res.json() as TodayData;
        setTodayData(data);
        if (user) {
          const sr = await fetch(`${API_BASE}/api/daily/streak`, { headers: authHeader() });
          if (sr.ok) setStreakData(await sr.json());
        }
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [user, authHeader]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAFAF8] pt-24 flex items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-4 h-6 w-6 animate-spin rounded-full border-2 border-gray-200 border-t-[#111]" />
          <p className="text-[13px] text-[#9CA3AF]">Loading today&apos;s challenge…</p>
        </div>
      </div>
    );
  }

  if (error || !todayData) {
    return (
      <div className="min-h-screen bg-[#FAFAF8] pt-24 px-6">
        <div className="mx-auto max-w-lg rounded-2xl bg-rose-50 border border-rose-100 p-8 text-center">
          <p className="text-rose-700">{error || "No question today."}</p>
          <Link href="/" className="mt-4 inline-block text-[13px] font-bold text-[#111] underline">Go home</Link>
        </div>
      </div>
    );
  }

  const { question } = todayData;
  const meta = TOPIC_META[question.topic] || TOPIC_META.general;
  const diff = DIFF[question.difficulty] || DIFF[2];

  return (
    <div className="min-h-screen bg-[#FAFAF8]">
      <main className="pt-20">

        {/* ── HERO BAND ── */}
        <div className="bg-white border-b border-[#F0F0EE]">
          <div className="mx-auto max-w-[1200px] px-6 py-10">

            {/* Status bar */}
            <div className="flex flex-wrap items-center gap-3 mb-6">
              <span className="flex items-center gap-1.5 rounded-full bg-[#111] px-3 py-1 text-[11px] font-black text-white">
                <span className="h-1.5 w-1.5 rounded-full bg-yellow-400 animate-pulse" />
                TODAY&apos;S CHALLENGE IS LIVE
              </span>
              <span className="text-[12px] text-[#9CA3AF] font-medium">
                {new Date(todayData.date + "T00:00:00").toLocaleDateString("en-IN", {
                  weekday: "long", day: "numeric", month: "long", year: "numeric"
                })}
              </span>
              {streakData && streakData.streak > 0 && (
                <span className="ml-auto flex items-center gap-1.5 rounded-full border border-orange-200 bg-orange-50 px-3 py-1 text-[12px] font-black text-orange-700">
                  🔥 {streakData.streak} day streak
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_400px]">

              {/* Left: question */}
              <div>
                {/* Tags */}
                <div className="flex flex-wrap gap-2 mb-5">
                  <span className="flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-wider"
                    style={{ background: meta.bg, color: meta.color }}>
                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: meta.dot }} />
                    {meta.label}
                  </span>
                  <span className="rounded-full px-2.5 py-1 text-[11px] font-bold"
                    style={{ background: diff.bg, color: diff.color }}>
                    {diff.label}
                  </span>
                  {question.company_tag && (
                    <span className="rounded-full bg-[#F3F4F6] border border-[#E5E7EB] px-2.5 py-1 text-[11px] font-bold text-[#374151] capitalize">
                      {question.company_tag}
                    </span>
                  )}
                </div>

                {/* Question */}
                <h1 style={{
                  fontSize: "clamp(22px, 3.5vw, 32px)",
                  fontWeight: 900, color: "#111",
                  lineHeight: 1.25, letterSpacing: "-0.5px",
                  maxWidth: "600px"
                }}>
                  {question.question_text}
                </h1>

                {/* Attempt count + avatars */}
                <div className="mt-6 flex items-center gap-3">
                  <div className="flex -space-x-2">
                    {["#6366F1","#10B981","#F59E0B","#EF4444","#3B82F6"].map((c, i) => (
                      <div key={i} className="h-8 w-8 rounded-full border-2 border-white flex items-center justify-center text-[10px] font-bold text-white"
                        style={{ background: c }}>
                        {["P","R","A","S","M"][i]}
                      </div>
                    ))}
                  </div>
                  <p className="text-[13px] text-[#6B7280]">
                    <span className="font-bold text-[#111]">247 students</span> already attempted today
                  </p>
                </div>

                {/* Week strip */}
                <div className="mt-8">
                  <p className="text-[10px] font-black uppercase tracking-widest text-[#9CA3AF] mb-3">Your week</p>
                  <div className="flex gap-2">
                    {(streakData?.week || Array.from({ length: 7 }, (_, i) => {
                      const todayIdx = new Date().getDay() === 0 ? 6 : new Date().getDay() - 1;
                      return {
                        day: ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"][i],
                        answered: false,
                        is_today: i === todayIdx,
                        is_future: i > todayIdx,
                        date: "",
                      };
                    })).map((day, i) => (
                      <div key={i} className="flex flex-col items-center gap-1.5">
                        <div className={`h-9 w-9 rounded-xl flex items-center justify-center text-[12px] font-bold transition-all ${
                          day.is_today && !day.answered
                            ? "border-2 border-[#111] bg-white shadow-sm"
                            : day.answered
                            ? "bg-[#111] text-white"
                            : day.is_future
                            ? "bg-[#F9FAFB]"
                            : "bg-[#F3F4F6] text-[#D1D5DB]"
                        }`}>
                          {day.answered ? "✓" : day.is_today
                            ? <span className="h-1.5 w-1.5 rounded-full bg-[#111]" />
                            : ""}
                        </div>
                        <span className="text-[9px] font-bold text-[#9CA3AF]">{day.day}</span>
                      </div>
                    ))}
                  </div>
                  {!user && (
                    <p className="mt-3 text-[12px] text-[#9CA3AF]">
                      <Link href="/login" className="font-bold text-[#111] underline">Sign in</Link> to track your streak
                    </p>
                  )}
                </div>
              </div>

              {/* Right: practice panel */}
              <PracticePanel question={question} user={user} />
            </div>
          </div>
        </div>

        {/* ── BOTTOM: Past Challenges + Leaderboard ── */}
        <div className="mx-auto max-w-[1200px] px-6 py-10">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_340px]">

            {/* Left: tabs */}
            <div>
              <div className="flex items-center gap-1 mb-5 rounded-xl border border-[#E5E7EB] bg-white p-1 w-fit">
                {(["challenges", "leaderboard"] as const).map((t) => (
                  <button key={t} onClick={() => setTab(t)}
                    className={`rounded-lg px-4 py-1.5 text-[12px] font-black uppercase tracking-wider transition ${
                      tab === t ? "bg-[#111] text-white" : "text-[#9CA3AF] hover:text-[#111]"
                    }`}>
                    {t === "challenges" ? "Past Challenges" : "Leaderboard"}
                  </button>
                ))}
              </div>

              <AnimatePresence mode="wait">
                {tab === "challenges" && (
                  <motion.div key="ch" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                    className="space-y-3">
                    {PAST.map((p, i) => {
                      const m = TOPIC_META[p.topic] || TOPIC_META.general;
                      return (
                        <div key={i} className="rounded-2xl border border-[#E5E7EB] bg-white p-5 hover:border-[#D1D5DB] transition group cursor-pointer">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <span className="flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-widest"
                                  style={{ background: m.bg, color: m.color }}>
                                  <span className="h-1 w-1 rounded-full" style={{ background: m.dot }} />
                                  {m.label}
                                </span>
                                <span className="text-[11px] text-[#9CA3AF]">{p.date}</span>
                              </div>
                              <p className="text-[14px] font-bold text-[#111] leading-snug">{p.label}</p>
                            </div>
                            <div className="text-right flex-shrink-0">
                              <p className="text-[22px] font-black text-[#111] leading-none">{p.attempts}</p>
                              <p className="text-[10px] text-[#9CA3AF] mt-0.5">attempted</p>
                            </div>
                          </div>
                          <div className="mt-3 pt-3 border-t border-[#F9FAFB] flex items-center justify-between">
                            <span className="text-[11px] text-[#9CA3AF]">Challenge closed</span>
                            <span className="text-[11px] font-bold text-[#9CA3AF] group-hover:text-[#111] transition">View →</span>
                          </div>
                        </div>
                      );
                    })}
                    <p className="text-center text-[12px] text-[#9CA3AF] pt-1">
                      More challenges added daily as the question bank grows
                    </p>
                  </motion.div>
                )}

                {tab === "leaderboard" && (
                  <motion.div key="lb" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                    <div className="rounded-2xl border border-[#E5E7EB] bg-white overflow-hidden">
                      <div className="border-b border-[#F3F4F6] px-5 py-4 flex items-center justify-between">
                        <div>
                          <p className="text-[13px] font-black text-[#111]">This week&apos;s top performers</p>
                          <p className="text-[11px] text-[#9CA3AF] mt-0.5">Ranked by average daily score · resets Sunday</p>
                        </div>
                        <span className="rounded-full bg-yellow-400 px-2.5 py-1 text-[10px] font-black text-[#111]">LIVE</span>
                      </div>

                      <div className="grid grid-cols-[44px_1fr_72px_56px] gap-3 px-5 py-2 bg-[#FAFAF8] border-b border-[#F3F4F6]">
                        {["Rank","Student","Score","Streak"].map(h => (
                          <p key={h} className="text-[10px] font-black uppercase tracking-widest text-[#9CA3AF]">{h}</p>
                        ))}
                      </div>

                      {LEADERBOARD.map((entry, i) => (
                        <div key={i} className={`grid grid-cols-[44px_1fr_72px_56px] gap-3 items-center px-5 py-4 border-b border-[#F9FAFB] last:border-0 ${
                          i === 0 ? "bg-yellow-50" : ""
                        }`}>
                          <div className="text-[18px]">
                            {RANK_ICONS[entry.rank] ?? <span className="text-[13px] font-black text-[#9CA3AF]">{entry.rank}</span>}
                          </div>
                          <div>
                            <p className="text-[13px] font-bold text-[#111]">{entry.name}</p>
                            <p className="text-[11px] text-[#9CA3AF]">{entry.college}</p>
                          </div>
                          <div>
                            <span className="text-[15px] font-black" style={{ color: scoreColor(entry.score) }}>{entry.score}</span>
                          </div>
                          <div>
                            <span className="text-[12px] font-bold text-[#374151]">🔥{entry.streak}</span>
                          </div>
                        </div>
                      ))}

                      <div className="px-5 py-4 bg-[#FAFAF8] border-t border-[#F3F4F6] text-center">
                        <p className="text-[12px] text-[#9CA3AF]">
                          Complete a mock session to appear on the leaderboard
                        </p>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Right: streak stats */}
            <div className="space-y-4">
              {streakData ? (
                <div className="rounded-2xl border border-[#E5E7EB] bg-white p-5">
                  <p className="text-[11px] font-black uppercase tracking-widest text-[#9CA3AF] mb-4">Your stats</p>
                  <div className="grid grid-cols-3 gap-3 text-center">
                    {[
                      { val: streakData.streak,          label: "Streak",    icon: "🔥" },
                      { val: streakData.longest_streak,  label: "Best",      icon: "🏆" },
                      { val: streakData.total_answered,  label: "Answered",  icon: "✅" },
                    ].map(({ val, label, icon }) => (
                      <div key={label} className="rounded-xl bg-[#F9FAFB] border border-[#F3F4F6] p-3">
                        <p className="text-[18px] mb-1">{icon}</p>
                        <p className="text-[22px] font-black text-[#111] leading-none">{val}</p>
                        <p className="text-[10px] text-[#9CA3AF] mt-1">{label}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border border-[#E5E7EB] bg-white p-5">
                  <p className="text-[11px] font-black uppercase tracking-widest text-[#9CA3AF] mb-3">How it works</p>
                  <div className="space-y-3">
                    {[
                      { icon: "📖", text: "Read today's question" },
                      { icon: "🎙️", text: "Practice in a mock session" },
                      { icon: "📊", text: "Get scored and coached" },
                      { icon: "🔥", text: "Build your streak" },
                    ].map(({ icon, text }, i) => (
                      <div key={i} className="flex items-center gap-3">
                        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-[#F9FAFB] border border-[#F3F4F6] text-[16px]">
                          {icon}
                        </div>
                        <p className="text-[13px] text-[#374151]">{text}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="rounded-2xl bg-[#111] p-5">
                <p className="text-[14px] font-black text-white mb-1">Want a full session?</p>
                <p className="text-[12px] mb-4" style={{ color: "#555" }}>
                  8 questions, live coaching, model answers after each one.
                </p>
                <Link href="/mock" className="block w-full rounded-xl bg-yellow-400 py-2.5 text-center text-[13px] font-black text-[#111] hover:bg-yellow-300 transition">
                  Start mock interview →
                </Link>
              </div>
            </div>
          </div>
        </div>

      </main>
      <FooterHero />
    </div>
  );
}