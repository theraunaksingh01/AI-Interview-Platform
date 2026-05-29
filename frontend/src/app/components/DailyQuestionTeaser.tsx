"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { useAuth } from "@/context/AuthContext";

const API_BASE = (
  process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:8000"
).replace(/\/$/, "");

const TOPIC_META: Record<string, { label: string; bg: string; color: string; dot: string }> = {
  behavioral:      { label: "Behavioural",   bg: "#d1fae5", color: "#065f46", dot: "#10B981" },
  dsa:             { label: "DSA",           bg: "#ede9fe", color: "#5b21b6", dot: "#8B5CF6" },
  "system-design": { label: "System Design", bg: "#fef3c7", color: "#92400e", dot: "#F59E0B" },
  networking:      { label: "Networking",    bg: "#dbeafe", color: "#1e40af", dot: "#3B82F6" },
  general:         { label: "General",       bg: "#f3f4f6", color: "#374151", dot: "#6B7280" },
};

type TodayQuestion = {
  question: { question_text: string; topic: string; difficulty: number; company_tag: string | null };
  answered: { score: number } | null;
};

const STATS = [
  { value: "247", label: "answered today" },
  { value: "12", label: "day top streak" },
  { value: "Free", label: "forever" },
];

export function DailyQuestionTeaser() {
  const { authHeader } = useAuth();
  const [data, setData] = useState<TodayQuestion | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`${API_BASE}/api/daily/today`, { headers: authHeader(), cache: "no-store" });
        if (res.ok) setData(await res.json());
      } catch { /* silent */ }
      finally { setLoading(false); }
    }
    load();
  }, [authHeader]);

  const meta = data ? (TOPIC_META[data.question.topic] || TOPIC_META.general) : null;
  const today = new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short" });

  return (
    <section className="px-6 py-20" style={{ background: "#FFFDF0" }}>
      <div className="mx-auto max-w-5xl">

        {/* Section label */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="flex items-center gap-3 mb-8"
        >
          <span className="flex items-center gap-1.5 rounded-full bg-[#111] px-3 py-1 text-[11px] font-black text-white">
            <span className="h-1.5 w-1.5 rounded-full bg-yellow-400 animate-pulse" />
            DAILY CHALLENGE · {today.toUpperCase()}
          </span>
        </motion.div>

        {/* Main split card */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="rounded-3xl border border-[#E5E7EB] bg-white overflow-hidden shadow-sm"
          style={{ boxShadow: "0 4px 40px rgba(0,0,0,0.06)" }}
        >
          <div className="grid grid-cols-1 lg:grid-cols-2">

            {/* Left — value prop */}
            <div className="px-8 py-10 border-b border-[#F3F4F6] lg:border-b-0 lg:border-r lg:border-[#F3F4F6]">
              <h2 style={{ fontSize: "clamp(26px, 4vw, 40px)", fontWeight: 900, letterSpacing: "-1.5px", color: "#111", lineHeight: 1.15 }}>
                One question.<br />
                <span style={{ background: "#FFD600", padding: "2px 10px", borderRadius: "6px", fontStyle: "italic" }}>
                  Every day.
                </span>
              </h2>

              <p className="mt-4 text-[14px] leading-relaxed" style={{ color: "#6B7280", maxWidth: "340px" }}>
                Build the habit that separates prepared candidates from everyone else. Answer one interview question daily, get AI scored, track your streak.
              </p>

              {/* Mini stats */}
              <div className="mt-8 grid grid-cols-3 gap-4">
                {STATS.map(({ value, label }) => (
                  <div key={label}>
                    <p className="text-[24px] font-black text-[#111] leading-none">{value}</p>
                    <p className="text-[11px] text-[#9CA3AF] mt-0.5">{label}</p>
                  </div>
                ))}
              </div>

              {/* Week dots */}
              <div className="mt-8">
                <p className="text-[10px] font-black uppercase tracking-widest text-[#9CA3AF] mb-3">This week</p>
                <div className="flex gap-2">
                  {["M","T","W","T","F","S","S"].map((d, i) => {
                    const today = new Date().getDay();
                    // Mon=1..Sun=0, remap so Mon=0
                    const todayIdx = today === 0 ? 6 : today - 1;
                    const isPast = i < todayIdx;
                    const isToday = i === todayIdx;
                    const isFuture = i > todayIdx;
                    return (
                      <div key={i} className="flex flex-col items-center gap-1">
                        <div className={`h-8 w-8 rounded-lg flex items-center justify-center text-[11px] font-bold transition-all ${
                          isToday ? "bg-[#111] text-white" :
                          isPast ? "bg-[#F3F4F6] text-[#9CA3AF]" :
                          "bg-[#F9FAFB] text-[#E5E7EB]"
                        }`}>
                          {isPast ? "✓" : isToday ? "→" : ""}
                        </div>
                        <span className="text-[9px] font-bold text-[#9CA3AF]">{d}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Right — today's question */}
            <div className="px-8 py-10 flex flex-col">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-2">
                  {meta && !loading && (
                    <span className="flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-widest"
                      style={{ background: meta.bg, color: meta.color }}>
                      <span className="h-1.5 w-1.5 rounded-full" style={{ background: meta.dot }} />
                      {meta.label}
                    </span>
                  )}
                </div>
                {data?.answered && (
                  <span className="flex items-center gap-1 text-[12px] font-bold text-emerald-600">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                    Answered
                  </span>
                )}
              </div>

              {/* Question text */}
              <div className="flex-1">
                {loading ? (
                  <div className="space-y-3">
                    <div className="h-5 bg-[#F3F4F6] rounded-lg w-full animate-pulse" />
                    <div className="h-5 bg-[#F3F4F6] rounded-lg w-4/5 animate-pulse" />
                    <div className="h-5 bg-[#F3F4F6] rounded-lg w-3/5 animate-pulse" />
                  </div>
                ) : data ? (
                  <p style={{ fontSize: "clamp(16px, 2.5vw, 20px)", fontWeight: 700, color: "#111", lineHeight: 1.4 }}>
                    {data.question.question_text}
                  </p>
                ) : (
                  <p className="text-[16px] font-bold text-[#9CA3AF]">Daily question loading…</p>
                )}
              </div>

              {/* Separator */}
              <div className="my-6 h-px bg-[#F3F4F6]" />

              {/* Confidence row */}
              <div className="flex items-center gap-3 mb-5">
                {/* Fake avatar stack */}
                <div className="flex -space-x-2">
                  {["#6366F1","#10B981","#F59E0B","#EF4444"].map((c, i) => (
                    <div key={i} className="h-7 w-7 rounded-full border-2 border-white flex items-center justify-center text-[10px] font-bold text-white"
                      style={{ background: c }}>
                      {["P","R","A","S"][i]}
                    </div>
                  ))}
                </div>
                <p className="text-[12px] text-[#6B7280]">
                  <span className="font-bold text-[#111]">247 students</span> answered today
                </p>
              </div>

              {/* CTA */}
              {data?.answered ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between rounded-xl bg-emerald-50 border border-emerald-100 px-4 py-3">
                    <span className="text-[13px] font-bold text-emerald-700">✓ You scored {Math.round(data.answered.score)}/100 today</span>
                    <Link href="/daily" className="text-[12px] font-bold text-emerald-600 hover:text-emerald-700">View →</Link>
                  </div>
                  <Link href="/mock" className="block w-full rounded-xl border border-[#E5E7EB] bg-white py-2.5 text-center text-[13px] font-bold text-[#374151] hover:bg-[#F9FAFB] transition">
                    Do a full mock session →
                  </Link>
                </div>
              ) : (
                <Link href="/daily">
                  <button className="w-full rounded-xl bg-[#111] py-3.5 text-[14px] font-black text-white hover:bg-[#333] transition active:scale-[0.99]"
                    style={{ letterSpacing: "-0.3px" }}>
                    Answer today&apos;s question →
                  </button>
                </Link>
              )}

              <p className="mt-3 text-center text-[11px] text-[#9CA3AF]">
                Free forever · No login required to view
              </p>
            </div>
          </div>
        </motion.div>

        {/* Bottom pill features */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.2 }}
          className="mt-5 flex flex-wrap gap-2 justify-center"
        >
          {[
            { icon: "🔥", text: "Streak tracking" },
            { icon: "🤖", text: "AI scoring on every answer" },
            { icon: "💡", text: "Model answers revealed after" },
            { icon: "🏆", text: "Weekly leaderboard" },
          ].map(({ icon, text }) => (
            <span key={text} className="flex items-center gap-1.5 rounded-full border border-[#E5E7EB] bg-white px-3 py-1.5 text-[12px] font-medium text-[#6B7280]">
              <span>{icon}</span> {text}
            </span>
          ))}
        </motion.div>

      </div>
    </section>
  );
}