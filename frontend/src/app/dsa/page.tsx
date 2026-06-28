"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { useAuth } from "@/context/AuthContext";

const API_BASE = (process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:8000").replace(/\/$/, "");

type Topic = {
  topic: string;
  total: number;
  easy_count: number;
  medium_count: number;
  hard_count: number;
  solved: number;
  icon: string;
  color: string;
  bg: string;
};

type Stats = {
  solved: number;
  easy_solved: number;
  medium_solved: number;
  hard_solved: number;
  total_submissions: number;
  accepted_submissions: number;
};

const ACCENT_COLORS: Record<string, string> = {
  "Arrays":                   "#1D4ED8",
  "Strings":                  "#065F46",
  "Linked List":              "#92400E",
  "Binary Trees":             "#166534",
  "BST":                      "#5B21B6",
  "Graph":                    "#9D174D",
  "Dynamic Programming":      "#1E40AF",
  "Stack & Queue":            "#7C2D12",
  "Heaps":                    "#064E3B",
  "Binary Search":            "#4C1D95",
  "Recursion & Backtracking": "#831843",
  "Trie":                     "#1D4ED8",
};

export default function DSATopicsPage() {
  const { user, authHeader } = useAuth();
  const [topics, setTopics] = useState<Topic[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      fetch(`${API_BASE}/api/dsa/topics`, { headers: authHeader() }).then(r => r.json()),
      fetch(`${API_BASE}/api/dsa/stats`, { headers: authHeader() }).then(r => r.json()),
    ]).then(([t, s]) => {
      setTopics(t.topics || []);
      setStats(s);
    }).finally(() => setLoading(false));
  }, [user]);

  const totalProblems = topics.reduce((a, t) => a + t.total, 0);
  const totalSolved = topics.reduce((a, t) => a + t.solved, 0);
  const acceptanceRate = stats && stats.total_submissions > 0
    ? Math.round((stats.accepted_submissions / stats.total_submissions) * 100)
    : 0;

  if (!user) {
    return (
      <div className="min-h-screen bg-[#FAFAF8] flex items-center justify-center px-6">
        <div className="text-center max-w-[400px]">
          <div className="text-[52px] mb-5">💻</div>
          <h1 className="text-[24px] font-black text-[#111] mb-2" style={{ letterSpacing: "-0.5px" }}>DSA Practice</h1>
          <p className="text-[14px] text-[#6B7280] mb-6">Sign in to start solving DSA problems.</p>
          <div className="flex gap-3 justify-center">
            <Link href="/login" className="rounded-xl bg-[#111] px-6 py-3 text-[13px] font-black text-white hover:bg-[#333] transition">Sign in</Link>
            <Link href="/signup" className="rounded-xl border border-[#E5E7EB] bg-white px-6 py-3 text-[13px] font-medium text-[#374151] hover:bg-[#F9FAFB] transition">Create account</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F5F3]">
      <main className="pt-[88px] pb-20 px-4 sm:px-6">
        <div className="mx-auto max-w-[1100px]">

          {/* ── Page header ── */}
          <div className="mb-8">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#E5E7EB] bg-white px-3 py-1.5 mb-4">
              <span className="h-1.5 w-1.5 rounded-full bg-yellow-400 animate-pulse" />
              <span className="text-[11px] font-black uppercase tracking-widest text-[#374151]">DSA Practice</span>
            </div>
            <h1 style={{ fontSize: "clamp(24px, 4vw, 36px)", fontWeight: 900, letterSpacing: "-1px", color: "#111" }}>
              Practice Problems
            </h1>
            <p className="text-[14px] text-[#6B7280] mt-1">
              {totalProblems} problems across {topics.length} topics — curated for campus placements
            </p>
          </div>

          {/* ── Stats strip (like the image's top cards) ── */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
            {[
              { label: "Total Problems", value: totalProblems, sub: "across all topics", color: "#111", bg: "#111", textColor: "white" },
              { label: "Solved", value: totalSolved, sub: `of ${totalProblems} problems`, color: "#065F46", bg: "#D1FAE5", textColor: "#065F46" },
              { label: "Submissions", value: stats?.total_submissions ?? 0, sub: "total attempts", color: "#5B21B6", bg: "#EDE9FE", textColor: "#5B21B6" },
              { label: "Acceptance", value: `${acceptanceRate}%`, sub: "of submissions", color: "#92400E", bg: "#FEF3C7", textColor: "#92400E" },
            ].map((s, i) => (
              <motion.div key={s.label}
                initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                className={`rounded-2xl p-5 ${i === 0 ? "bg-[#111]" : "bg-white border border-[#E5E7EB]"}`}>
                <p className={`text-[28px] font-black ${i === 0 ? "text-white" : ""}`}
                  style={i !== 0 ? { color: s.textColor } : {}}>
                  {s.value}
                </p>
                <p className={`text-[13px] font-bold mt-0.5 ${i === 0 ? "text-white" : "text-[#111]"}`}>{s.label}</p>
                <p className={`text-[11px] mt-0.5 ${i === 0 ? "text-gray-400" : "text-[#9CA3AF]"}`}>{s.sub}</p>
              </motion.div>
            ))}
          </div>

          {/* ── Difficulty breakdown ── */}
          {stats && (
            <div className="rounded-2xl border border-[#E5E7EB] bg-white p-5 mb-8">
              <p className="text-[11px] font-black uppercase tracking-widest text-[#9CA3AF] mb-4">Difficulty Breakdown</p>
              <div className="grid grid-cols-3 gap-4">
                {[
                  { label: "Easy", solved: stats.easy_solved, total: topics.reduce((a, t) => a + t.easy_count, 0), color: "#15803D", bg: "#DCFCE7", track: "#F0FDF4" },
                  { label: "Medium", solved: stats.medium_solved, total: topics.reduce((a, t) => a + t.medium_count, 0), color: "#B45309", bg: "#FEF9C3", track: "#FEFCE8" },
                  { label: "Hard", solved: stats.hard_solved, total: topics.reduce((a, t) => a + t.hard_count, 0), color: "#B91C1C", bg: "#FEE2E2", track: "#FFF5F5" },
                ].map(d => {
                  const pct = d.total > 0 ? Math.round((d.solved / d.total) * 100) : 0;
                  return (
                    <div key={d.label}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[12px] font-bold" style={{ color: d.color }}>{d.label}</span>
                        <span className="text-[12px] font-black text-[#111]">{d.solved}/{d.total}</span>
                      </div>
                      <div className="h-2 rounded-full overflow-hidden" style={{ background: d.track }}>
                        <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }}
                          transition={{ duration: 1, delay: 0.3 }}
                          className="h-full rounded-full" style={{ background: d.color }} />
                      </div>
                      <p className="text-[10px] text-[#9CA3AF] mt-1">{pct}% complete</p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Topic cards — horizontal layout like the image ── */}
          <p className="text-[11px] font-black uppercase tracking-widest text-[#9CA3AF] mb-4">Topics</p>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-20 rounded-2xl bg-white border border-[#E5E7EB] animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="space-y-2.5">
              {topics.map((t, i) => {
                const pct = t.total > 0 ? Math.round((t.solved / t.total) * 100) : 0;
                const accentColor = ACCENT_COLORS[t.topic] || "#374151";
                const isComplete = t.solved === t.total && t.total > 0;

                return (
                  <motion.div
                    key={t.topic}
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.03 }}
                    whileHover={{ x: 3, transition: { duration: 0.15 } }}
                  >
                    <Link href={`/dsa/${encodeURIComponent(t.topic)}`}>
                      <div className="flex items-center gap-5 rounded-2xl border border-[#E5E7EB] bg-white px-5 py-4 cursor-pointer hover:border-[#D1D5DB] hover:shadow-sm transition-all relative overflow-hidden">

                        {/* Left accent bar */}
                        <div className="absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl"
                          style={{ background: accentColor }} />

                        {/* Icon */}
                        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl text-[20px]"
                          style={{ background: t.bg }}>
                          {t.icon}
                        </div>

                        {/* Topic name + badges */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1.5">
                            <h3 className="text-[15px] font-black text-[#111]">{t.topic}</h3>
                            {isComplete && (
                              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[9px] font-black text-emerald-700 uppercase tracking-wide">
                                ✓ Done
                              </span>
                            )}
                          </div>
                          {/* Progress bar */}
                          <div className="h-1.5 w-full max-w-[240px] rounded-full bg-[#F3F4F6] overflow-hidden">
                            <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }}
                              transition={{ duration: 0.8, delay: i * 0.03 + 0.2 }}
                              className="h-full rounded-full" style={{ background: accentColor }} />
                          </div>
                        </div>

                        {/* Difficulty counts */}
                        <div className="hidden sm:flex items-center gap-3 flex-shrink-0">
                          <div className="text-center">
                            <p className="text-[13px] font-black text-emerald-600">{t.easy_count}</p>
                            <p className="text-[9px] text-[#9CA3AF]">Easy</p>
                          </div>
                          <div className="text-center">
                            <p className="text-[13px] font-black text-amber-500">{t.medium_count}</p>
                            <p className="text-[9px] text-[#9CA3AF]">Med</p>
                          </div>
                          <div className="text-center">
                            <p className="text-[13px] font-black text-rose-500">{t.hard_count}</p>
                            <p className="text-[9px] text-[#9CA3AF]">Hard</p>
                          </div>
                        </div>

                        {/* Solved count + chevron */}
                        <div className="flex items-center gap-3 flex-shrink-0">
                          <div className="text-right">
                            <p className="text-[14px] font-black text-[#111]">{t.solved}<span className="text-[#D1D5DB] font-normal">/{t.total}</span></p>
                            <p className="text-[10px] text-[#9CA3AF]">{pct}%</p>
                          </div>
                          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                            <path d="M6 12l4-4-4-4" stroke="#D1D5DB" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        </div>
                      </div>
                    </Link>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}