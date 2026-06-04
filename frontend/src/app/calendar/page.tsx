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

type Company = { key: string; name: string; type: string };

type DayEntry = {
  day: number;
  date: string;
  title: string;
  topic: string;
  task: string;
  session_type: string;
  is_interview_day: boolean;
};

type PrepPlan = {
  summary: string;
  coach_note: string;
  daily_plan: DayEntry[];
  key_topics: string[];
  company_tips: string[];
};

type CalendarData = {
  exists: boolean;
  company?: string;
  role_target?: string;
  interview_date?: string;
  days_remaining?: number;
  plan?: PrepPlan;
  today_task?: DayEntry | null;
  is_past?: boolean;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const ROLES = [
  "Backend Engineer", "Frontend Engineer", "Full Stack Engineer",
  "AI Engineer", "Data Engineer", "System Design",
];

const TOPIC_META: Record<string, { label: string; bg: string; color: string; icon: string }> = {
  dsa:             { label: "DSA",           bg: "#ede9fe", color: "#5b21b6", icon: "💻" },
  "system-design": { label: "System Design", bg: "#fef3c7", color: "#92400e", icon: "🏗️" },
  behavioral:      { label: "Behavioural",   bg: "#d1fae5", color: "#065f46", icon: "🎭" },
  networking:      { label: "Networking",    bg: "#dbeafe", color: "#1e40af", icon: "🌐" },
  general:         { label: "General",       bg: "#f3f4f6", color: "#374151", icon: "📝" },
};

const SESSION_TYPE_ICON: Record<string, string> = {
  mock: "🎯", practice: "📚", review: "🔍",
};

const COMPANIES_STATIC = [
  { key: "tcs",       name: "TCS",          type: "service"  },
  { key: "infosys",   name: "Infosys",      type: "service"  },
  { key: "wipro",     name: "Wipro",        type: "service"  },
  { key: "cognizant", name: "Cognizant",    type: "service"  },
  { key: "amazon",    name: "Amazon",       type: "product"  },
  { key: "microsoft", name: "Microsoft",    type: "product"  },
  { key: "flipkart",  name: "Flipkart",     type: "product"  },
  { key: "google",    name: "Google",       type: "faang"    },
  { key: "razorpay",  name: "Razorpay",     type: "startup"  },
  { key: "swiggy",    name: "Swiggy",       type: "startup"  },
  { key: "startup",   name: "Startup",      type: "startup"  },
  { key: "general",   name: "General prep", type: "general"  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function daysUntil(dateStr: string) {
  return Math.max(0, Math.ceil(
    (new Date(dateStr + "T00:00:00").getTime() - new Date().setHours(0, 0, 0, 0)) / 86400000
  ));
}

function urgencyColor(days: number) {
  if (days <= 1)  return "#EF4444";
  if (days <= 3)  return "#F59E0B";
  if (days <= 7)  return "#10B981";
  return "#111";
}

// ─── Right panel preview ──────────────────────────────────────────────────────

function PreviewPanel({
  company, role, date,
}: { company: string; role: string; date: string }) {
  const days = date ? daysUntil(date) : null;
  const companyInfo = COMPANIES_STATIC.find(c => c.key === company);

  // Fake plan preview based on days
  const previewDays = days !== null ? Math.min(days, 5) : 5;
  const fakePlan = [
    { icon: "💻", label: "DSA Fundamentals",    type: "Practice" },
    { icon: "🎭", label: "Behavioural round",   type: "Practice" },
    { icon: "🏗️", label: "System Design basics", type: "Practice" },
    { icon: "🎯", label: "Full mock session",    type: "Mock" },
    { icon: "🔍", label: "Weak spot review",     type: "Review" },
  ].slice(0, previewDays);

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-8 pt-10 pb-6 border-b border-[#F3F4F6]">
        <p className="text-[10px] font-black uppercase tracking-widest text-[#9CA3AF] mb-3">
          Your prep plan preview
        </p>

        {!company && !date ? (
          <div className="text-center py-8">
            <div className="text-[48px] mb-3">📅</div>
            <p className="text-[15px] font-bold text-[#111] mb-1">Fill in the form</p>
            <p className="text-[13px] text-[#9CA3AF]">Your personalised plan will appear here as you select options.</p>
          </div>
        ) : (
          <>
            {/* Countdown display */}
            {days !== null && (
              <div className="flex items-center gap-4 mb-4">
                <div className="flex flex-col items-center justify-center h-16 w-16 rounded-2xl bg-[#111] text-white flex-shrink-0">
                  <p className="text-[24px] font-black leading-none">{days}</p>
                  <p className="text-[9px] text-[#9CA3AF] uppercase tracking-wide">days</p>
                </div>
                <div>
                  <p className="text-[16px] font-black text-[#111] leading-tight">
                    {companyInfo?.name || company}
                    {role && <span className="text-[#9CA3AF] font-medium"> · {role.split(" ")[0]}</span>}
                  </p>
                  <p className="text-[12px] mt-1" style={{ color: urgencyColor(days) }}>
                    {days === 0 ? "Interview today!" :
                     days === 1 ? "Interview tomorrow — focus on weak spots" :
                     days <= 3  ? "Tight timeline — prioritise DSA + behavioral" :
                     days <= 7  ? "One week — good coverage possible" :
                                  "Solid timeline — full prep arc possible"}
                  </p>
                </div>
              </div>
            )}

            {/* Plan preview */}
            {fakePlan.length > 0 && (
              <div className="space-y-2">
                {fakePlan.map((item, i) => (
                  <div key={i} className={`flex items-center gap-3 rounded-xl p-3 ${
                    i === 0 ? "bg-yellow-50 border border-yellow-200" : "bg-[#F9FAFB] border border-[#F3F4F6]"
                  }`}>
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-white border border-[#E5E7EB] text-[14px] flex-shrink-0">
                      {item.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-bold text-[#111]">Day {i + 1} — {item.label}</p>
                    </div>
                    <span className={`text-[10px] font-black rounded-full px-2 py-0.5 ${
                      item.type === "Mock" ? "bg-[#111] text-white" : "bg-[#F3F4F6] text-[#9CA3AF]"
                    }`}>
                      {item.type}
                    </span>
                  </div>
                ))}
                {days !== null && days > 5 && (
                  <p className="text-center text-[11px] text-[#9CA3AF] pt-1">
                    + {days - 4} more days generated by AI
                  </p>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* What you get */}
      <div className="px-8 py-6 flex-1">
        <p className="text-[10px] font-black uppercase tracking-widest text-[#9CA3AF] mb-4">What you get</p>
        <div className="space-y-3">
          {[
            { icon: "🗓️", title: "Day-by-day schedule", sub: "Exactly what to do each day, no guessing" },
            { icon: "🎯", title: "Company-specific prep", sub: "Questions and tips tailored to your company" },
            { icon: "⚡", title: "Today's task", sub: "One focused task every morning on your dashboard" },
            { icon: "📊", title: "Countdown tracker", sub: "Urgency increases as the date approaches" },
          ].map(({ icon, title, sub }) => (
            <div key={title} className="flex items-start gap-3">
              <span className="text-[18px] mt-0.5">{icon}</span>
              <div>
                <p className="text-[13px] font-bold text-[#111]">{title}</p>
                <p className="text-[11px] text-[#9CA3AF] mt-0.5">{sub}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Plan view (after generation) ────────────────────────────────────────────

function PlanView({ data, onReset }: { data: CalendarData; onReset: () => void }) {
  const days = data.days_remaining ?? 0;
  const plan = data.plan;
  const today = new Date().toISOString().split("T")[0];

  if (!plan) return null;

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="w-full">

      {/* Top bar */}
      <div className="bg-white border-b border-[#F0F0EE]">
        <div className="mx-auto max-w-[1100px] px-6 py-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              {/* Countdown box */}
              <div className="flex flex-col items-center justify-center h-16 w-16 rounded-2xl flex-shrink-0"
                style={{ background: urgencyColor(days) }}>
                <p className="text-[24px] font-black text-white leading-none">{days}</p>
                <p className="text-[9px] text-white/70 uppercase tracking-wide">{days === 1 ? "day" : "days"}</p>
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="flex items-center gap-1.5 rounded-full bg-[#111] px-3 py-1 text-[10px] font-black text-white">
                    <span className="h-1.5 w-1.5 rounded-full bg-yellow-400 animate-pulse" />
                    INTERVIEW CALENDAR
                  </span>
                </div>
                <p className="text-[20px] font-black text-[#111] leading-tight" style={{ letterSpacing: "-0.5px" }}>
                  {data.company} · {data.role_target}
                </p>
                <p className="text-[12px] text-[#9CA3AF]">
                  {data.interview_date && new Date(data.interview_date + "T00:00:00").toLocaleDateString("en-IN", {
                    weekday: "long", day: "numeric", month: "long", year: "numeric"
                  })}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Link href="/mock">
                <button className="rounded-xl bg-[#111] px-5 py-2.5 text-[13px] font-black text-white hover:bg-[#333] transition">
                  Start session →
                </button>
              </Link>
              <button onClick={onReset}
                className="rounded-xl border border-[#E5E7EB] px-4 py-2.5 text-[13px] font-medium text-[#6B7280] hover:text-[#111] hover:border-[#111] transition">
                Change
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-[1100px] px-6 py-8">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">

          {/* Left: day plan */}
          <div>
            {/* Coach note */}
            {plan.coach_note && (
              <div className="mb-5 flex items-start gap-3 rounded-2xl bg-yellow-50 border border-yellow-200 px-5 py-4">
                <span className="text-[20px] mt-0.5">💡</span>
                <p className="text-[14px] text-[#92400E] leading-relaxed font-medium">{plan.coach_note}</p>
              </div>
            )}

            <p className="text-[11px] font-black uppercase tracking-widest text-[#9CA3AF] mb-4">
              Day-by-day plan · {plan.daily_plan.length} days
            </p>

            <div className="space-y-2">
              {plan.daily_plan.map((entry, i) => {
                const isToday = entry.date === today;
                const isPast = entry.date < today && !entry.is_interview_day;
                const meta = TOPIC_META[entry.topic] || TOPIC_META.general;

                return (
                  <motion.div key={i}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.03 }}
                    className={`rounded-2xl border transition-all ${
                      entry.is_interview_day ? "border-[#111] bg-[#111]" :
                      isToday ? "border-yellow-400 bg-yellow-50 shadow-sm" :
                      isPast  ? "border-[#F3F4F6] bg-[#FAFAF8] opacity-50" :
                      "border-[#E5E7EB] bg-white hover:border-[#D1D5DB]"
                    }`}
                  >
                    <div className="flex items-center gap-4 p-4">
                      {/* Day number */}
                      <div className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl text-[12px] font-black ${
                        entry.is_interview_day ? "bg-yellow-400 text-[#111]" :
                        isToday  ? "bg-[#111] text-white" :
                        isPast   ? "bg-[#E5E7EB] text-[#9CA3AF]" :
                        "bg-[#F3F4F6] text-[#374151]"
                      }`}>
                        {isPast ? "✓" : entry.is_interview_day ? "🎯" : entry.day}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-0.5">
                          <p className={`text-[14px] font-black ${entry.is_interview_day ? "text-white" : "text-[#111]"}`}>
                            {entry.title}
                          </p>
                          {isToday && (
                            <span className="rounded-full bg-yellow-400 px-2 py-0.5 text-[9px] font-black text-[#111]">
                              TODAY
                            </span>
                          )}
                          {!entry.is_interview_day && (
                            <span className="rounded-full px-2 py-0.5 text-[10px] font-black"
                              style={{ background: meta.bg, color: meta.color }}>
                              {meta.icon} {meta.label}
                            </span>
                          )}
                        </div>
                        <p className={`text-[12px] leading-snug ${entry.is_interview_day ? "text-[#9CA3AF]" : "text-[#6B7280]"}`}>
                          {entry.task}
                        </p>
                      </div>

                      {/* Right: date + session type */}
                      <div className="text-right flex-shrink-0">
                        <p className={`text-[11px] font-medium ${entry.is_interview_day ? "text-[#555]" : "text-[#9CA3AF]"}`}>
                          {new Date(entry.date + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                        </p>
                        {!entry.is_interview_day && (
                          <p className="text-[10px] text-[#D1D5DB] mt-0.5">
                            {SESSION_TYPE_ICON[entry.session_type]} {entry.session_type}
                          </p>
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>

          {/* Right: sidebar */}
          <div className="space-y-4">

            {/* Today's task */}
            {data.today_task && !data.today_task.is_interview_day ? (
              <div className="rounded-2xl bg-[#111] p-5">
                <p className="text-[10px] font-black uppercase tracking-widest text-[#555] mb-3">Do this today</p>
                <div className="flex items-start gap-3 mb-4">
                  <span className="text-[22px]">{TOPIC_META[data.today_task.topic]?.icon || "📝"}</span>
                  <div>
                    <p className="text-[14px] font-black text-white">{data.today_task.title}</p>
                    <p className="text-[12px] text-[#666] mt-1 leading-snug">{data.today_task.task}</p>
                  </div>
                </div>
                <Link href={`/mock?prefill_role=${encodeURIComponent(data.role_target || "")}&prefill_difficulty=intermediate`}>
                  <button className="w-full rounded-xl bg-yellow-400 py-2.5 text-[13px] font-black text-[#111] hover:bg-yellow-300 transition">
                    Start session →
                  </button>
                </Link>
              </div>
            ) : data.today_task?.is_interview_day ? (
              <div className="rounded-2xl bg-[#111] p-5 text-center">
                <p className="text-[32px] mb-2">🎯</p>
                <p className="text-[16px] font-black text-white mb-1">Today&apos;s the day!</p>
                <p className="text-[12px] text-[#666]">You prepared well. Trust your practice and stay calm.</p>
              </div>
            ) : null}

            {/* Key topics */}
            {plan.key_topics?.length > 0 && (
              <div className="rounded-2xl border border-[#E5E7EB] bg-white p-5">
                <p className="text-[11px] font-black uppercase tracking-widest text-[#9CA3AF] mb-3">Focus areas</p>
                <div className="flex flex-wrap gap-2">
                  {plan.key_topics.map(t => {
                    const meta = TOPIC_META[t] || TOPIC_META.general;
                    return (
                      <span key={t} className="inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-[12px] font-bold"
                        style={{ background: meta.bg, color: meta.color }}>
                        {meta.icon} {meta.label}
                      </span>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Company tips */}
            {plan.company_tips?.length > 0 && (
              <div className="rounded-2xl border border-[#E5E7EB] bg-white p-5">
                <p className="text-[11px] font-black uppercase tracking-widest text-[#9CA3AF] mb-3">
                  {data.company} tips
                </p>
                <div className="space-y-2.5">
                  {plan.company_tips.map((tip, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <span className="mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full bg-yellow-400 text-[8px] font-black text-[#111]">✓</span>
                      <p className="text-[12px] text-[#374151] leading-snug">{tip}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Summary */}
            <div className="rounded-2xl bg-[#F9FAFB] border border-[#F3F4F6] p-5">
              <p className="text-[12px] text-[#6B7280] leading-relaxed">{plan.summary}</p>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function CalendarPage() {
  const { user, authHeader } = useAuth();

  const [companies]   = useState<Company[]>(COMPANIES_STATIC);
  const [data, setData]         = useState<CalendarData | null>(null);
  const [loading, setLoading]   = useState(true);
  const [showSetup, setShowSetup] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]       = useState<string | null>(null);

  // Form state
  const [company,  setCompany]  = useState("");
  const [role,     setRole]     = useState("");
  const [dateVal,  setDateVal]  = useState("");

  const today   = new Date().toISOString().split("T")[0];
  const maxDate = new Date(); maxDate.setMonth(maxDate.getMonth() + 6);
  const max     = maxDate.toISOString().split("T")[0];

  const previewDays = dateVal ? daysUntil(dateVal) : null;

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        if (user) {
          const res = await fetch(`${API_BASE}/api/calendar/my`, { headers: authHeader() });
          if (res.ok) {
            const d = await res.json();
            setData(d);
            if (!d.exists) setShowSetup(true);
          } else {
            setShowSetup(true);
          }
        } else {
          setShowSetup(true);
        }
      } catch { setShowSetup(true); }
      finally { setLoading(false); }
    }
    load();
  }, [user, authHeader]);

  async function submit() {
    if (!company || !role || !dateVal || !user) return;
    setSubmitting(true); setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/calendar/set`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader() },
        body: JSON.stringify({ company, role_target: role, interview_date: dateVal }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d?.detail || "Failed");
      setData({ exists: true, ...d, plan: d.plan });
      setShowSetup(false);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleReset() {
    await fetch(`${API_BASE}/api/calendar/my`, { method: "DELETE", headers: authHeader() });
    setData(null); setShowSetup(true);
    setCompany(""); setRole(""); setDateVal("");
  }

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAFAF8] pt-24 flex items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-4 h-6 w-6 animate-spin rounded-full border-2 border-gray-200 border-t-[#111]" />
          <p className="text-[13px] text-[#9CA3AF]">Loading your calendar…</p>
        </div>
      </div>
    );
  }

  // ── Plan view ────────────────────────────────────────────────────────────────
  if (!showSetup && data?.exists) {
    return (
      <div className="min-h-screen bg-[#FAFAF8]">
        <main className="pt-20">
          <PlanView data={data} onReset={handleReset} />
        </main>
        <FooterHero />
      </div>
    );
  }

  // ── Not logged in ────────────────────────────────────────────────────────────
  if (!user) {
    return (
      <div className="min-h-screen bg-[#FFFDF0] flex items-center justify-center px-6">
        <div className="text-center max-w-[400px]">
          <div className="text-[52px] mb-5">📅</div>
          <h1 className="text-[28px] font-black text-[#111] mb-2" style={{ letterSpacing: "-1px" }}>
            Interview Calendar
          </h1>
          <p className="text-[14px] text-[#6B7280] mb-6 leading-relaxed">
            Set your interview date and get a personalised day-by-day prep plan. AI-generated, company-specific.
          </p>
          <div className="flex gap-3 justify-center">
            <Link href="/login" className="rounded-xl bg-[#111] px-6 py-3 text-[13px] font-black text-white hover:bg-[#333] transition">
              Sign in
            </Link>
            <Link href="/signup" className="rounded-xl border border-[#E5E7EB] bg-white px-6 py-3 text-[13px] font-medium text-[#374151] hover:bg-[#F9FAFB] transition">
              Create account
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ── Setup: split layout ──────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#FAFAF8]">
      <main className="pt-20">
        <div className="grid min-h-[calc(100vh-80px)] grid-cols-1 lg:grid-cols-2">

          {/* ── LEFT: Form ── */}
          <div className="flex flex-col justify-center px-8 py-12 bg-[#FFFDF0] border-r border-[#F0F0EE] lg:px-14">
            <div className="max-w-[480px] mx-auto w-full">

              {/* Label */}
              <div className="inline-flex items-center gap-2 rounded-full border border-[#E5E7EB] bg-white px-3 py-1.5 mb-6">
                <span className="h-1.5 w-1.5 rounded-full bg-yellow-400" />
                <span className="text-[11px] font-black uppercase tracking-widest text-[#374151]">Interview Calendar</span>
              </div>

              <h1 style={{ fontSize: "clamp(28px, 4vw, 42px)", fontWeight: 900, letterSpacing: "-1.5px", color: "#111", lineHeight: 1.1 }}
                className="mb-2">
                When is your<br />
                <span style={{ background: "#FFD600", padding: "2px 10px", borderRadius: "6px", fontStyle: "italic" }}>
                  interview?
                </span>
              </h1>
              <p className="text-[14px] text-[#6B7280] mb-8 leading-relaxed">
                Set your date and we&apos;ll build a day-by-day prep plan — company-specific, difficulty-aware, AI-generated.
              </p>

              {/* ── Company ── */}
              <div className="mb-6">
                <p className="text-[11px] font-black uppercase tracking-widest text-[#9CA3AF] mb-3">Company</p>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {companies.map((c) => {
                    const initials = c.name.slice(0, 2).toUpperCase();
                    const colors: Record<string, string> = {
                      service: "#3B82F6",
                      product: "#8B5CF6",
                      faang: "#10B981",
                      startup: "#F59E0B",
                      general: "#6B7280",
                    };
                    const bg = colors[c.type] || "#6B7280";
                    const isSelected = company === c.key;

                    return (
                      <button
                        key={c.key}
                        type="button"
                        onClick={() => setCompany(c.key)}
                        className={`flex flex-col items-center gap-2 rounded-2xl border p-3 transition-all duration-150 ${
                          isSelected
                            ? "border-[#111] bg-[#111] text-white"
                            : "border-[#E5E7EB] bg-white hover:border-[#111] hover:bg-[#F9FAFB]"
                        }`}
                      >
                        <span
                          className="flex h-10 w-10 items-center justify-center rounded-full text-[12px] font-black text-white"
                          style={{ background: bg }}
                        >
                          {initials}
                        </span>
                        <span className={`text-[12px] font-bold leading-tight text-center ${isSelected ? "text-white" : "text-[#111]"}`}>
                          {c.name}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* ── Role ── */}
              <div className="mb-6">
                <p className="text-[11px] font-black uppercase tracking-widest text-[#9CA3AF] mb-3">Role</p>
                <div className="flex flex-wrap gap-1.5">
                  {ROLES.map(r => (
                    <button key={r} onClick={() => setRole(r)}
                      className={`rounded-xl px-3 py-1.5 text-[12px] font-bold border transition-all duration-150 ${
                        role === r
                          ? "border-[#111] bg-[#111] text-white"
                          : "border-[#E5E7EB] bg-white text-[#374151] hover:border-[#111]"
                      }`}>
                      {r}
                    </button>
                  ))}
                </div>
              </div>

              {/* ── Date ── */}
              <div className="mb-6">
                <p className="text-[11px] font-black uppercase tracking-widest text-[#9CA3AF] mb-3">Interview date</p>
                <input type="date" min={today} max={max} value={dateVal}
                  onChange={e => setDateVal(e.target.value)}
                  className="h-12 w-full rounded-xl border border-[#E5E7EB] bg-white px-4 text-[14px] font-bold text-[#111] focus:border-[#111] focus:outline-none focus:ring-2 focus:ring-[#111]/10 transition" />
                {previewDays !== null && (
                  <p className="mt-2 text-[12px]" style={{ color: urgencyColor(previewDays) }}>
                    {previewDays === 0 ? "That's today!" :
                     previewDays === 1 ? "That's tomorrow." :
                     `${previewDays} days from today.`}
                  </p>
                )}
              </div>

              {/* Error */}
              {error && (
                <div className="mb-4 rounded-xl border border-rose-100 bg-rose-50 px-4 py-3">
                  <p className="text-[13px] text-rose-700">{error}</p>
                </div>
              )}

              {/* Submit */}
              <button onClick={submit}
                disabled={!company || !role || !dateVal || submitting}
                className="w-full h-13 rounded-xl bg-[#111] py-3.5 text-[14px] font-black text-white hover:bg-[#333] transition disabled:bg-[#F3F4F6] disabled:text-[#9CA3AF] disabled:cursor-not-allowed">
                {submitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    Generating plan…
                  </span>
                ) : "Generate my prep plan →"}
              </button>

              <p className="mt-3 text-center text-[11px] text-[#9CA3AF]">
                AI-generated · Company-specific · Free for all plans
              </p>
            </div>
          </div>

          {/* ── RIGHT: Live preview ── */}
          <div className="hidden lg:flex flex-col bg-white overflow-y-auto">
            <AnimatePresence mode="wait">
              <motion.div key={`${company}-${dateVal}`}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="h-full">
                <PreviewPanel company={company} role={role} date={dateVal} />
              </motion.div>
            </AnimatePresence>
          </div>

        </div>
      </main>
    </div>
  );
}