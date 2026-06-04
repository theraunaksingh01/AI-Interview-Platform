"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/context/AuthContext";
import { FooterHero } from "@/app/components/Footer";
import {
  LineChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid,
} from "recharts";

const API_BASE = (
  process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:8000"
).replace(/\/$/, "");

// ─── Types ────────────────────────────────────────────────────────────────────

type TopicScore = { score: number | null; band: string; sessions: number };

type PassportData = {
  has_data: boolean;
  generated_at: string;
  message?: string;
  user: { name: string; email: string; college: string | null; year_of_study: string | null; plan: string };
  readiness_score: number;
  readiness_band: string;
  overall: { avg_score: number | null; best_score: number | null; improvement: number | null; total_sessions: number };
  topic_scores: Record<string, TopicScore>;
  communication: { avg_wpm: number | null; avg_fillers: number | null; wpm_band: string };
  streak: { current: number; longest: number; daily_answered: number };
  history: {
    trend: { session: number; score: number | null; date: string | null }[];
    first_session: string | null;
    latest_session: string | null;
    roles_practiced: string[];
    companies_practiced: string[];
  };
};

// ─── Constants ────────────────────────────────────────────────────────────────

const TOPIC_META: Record<string, { label: string; icon: string; color: string; bg: string }> = {
  dsa:           { label: "DSA",           icon: "💻", color: "#5b21b6", bg: "#ede9fe" },
  system_design: { label: "System Design", icon: "🏗️", color: "#92400e", bg: "#fef3c7" },
  behavioral:    { label: "Behavioural",   icon: "🎭", color: "#065f46", bg: "#d1fae5" },
  communication: { label: "Communication", icon: "🗣️", color: "#1e40af", bg: "#dbeafe" },
  technical:     { label: "Technical",     icon: "⚙️", color: "#374151", bg: "#f3f4f6" },
};

const BAND_COLOR: Record<string, string> = {
  "Expert":       "#10B981",
  "Strong":       "#3B82F6",
  "Developing":   "#F59E0B",
  "Beginner":     "#F97316",
  "Needs work":   "#EF4444",
  "Not assessed": "#D1D5DB",
};

function bandColor(band: string) { return BAND_COLOR[band] || "#D1D5DB"; }

// ─── Share modal ──────────────────────────────────────────────────────────────

function ShareModal({ data, onClose }: { data: PassportData; onClose: () => void }) {
  const [copied, setCopied] = useState(false);

  const shareText = `🎯 My Qued Interview Skill Passport\n\nReadiness Score: ${data.readiness_score}/100 (${data.readiness_band})\nSessions completed: ${data.overall.total_sessions}\nBest score: ${data.overall.best_score ? Math.round(data.overall.best_score) : "—"}/100${data.overall.improvement !== null && data.overall.improvement > 0 ? `\nImprovement: +${data.overall.improvement} points` : ""}\n\nPractice AI mock interviews free at qued.in 🚀`;

  const encodedText = encodeURIComponent(shareText);
  const shareUrl   = encodeURIComponent("https://qued.in/passport");

  const platforms = [
    {
      name: "LinkedIn",
      icon: "in",
      color: "#0A66C2",
      bg: "#EBF5FB",
      url: `https://www.linkedin.com/sharing/share-offsite/?url=${shareUrl}&summary=${encodedText}`,
    },
    {
      name: "WhatsApp",
      icon: "💬",
      color: "#25D366",
      bg: "#E8FDF1",
      url: `https://api.whatsapp.com/send?text=${encodedText}`,
    },
    {
      name: "X (Twitter)",
      icon: "𝕏",
      color: "#000",
      bg: "#F3F4F6",
      url: `https://twitter.com/intent/tweet?text=${encodedText}`,
    },
  ];

  function copyText() {
    navigator.clipboard.writeText(shareText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ background: "rgba(0,0,0,0.5)" }}
      onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.2 }}
        onClick={e => e.stopPropagation()}
        className="w-full max-w-[400px] rounded-3xl bg-white overflow-hidden shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-[#F3F4F6]">
          <div>
            <p className="text-[15px] font-black text-[#111]">Share your Passport</p>
            <p className="text-[12px] text-[#9CA3AF] mt-0.5">Let your network know you&apos;re preparing</p>
          </div>
          <button onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-[#F3F4F6] text-[#374151] hover:bg-[#E5E7EB] transition text-[16px]">
            ×
          </button>
        </div>

        {/* Score preview strip */}
        <div className="px-6 py-4 bg-[#FAFAF8] border-b border-[#F3F4F6]">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl"
              style={{ background: bandColor(data.readiness_band) + "20" }}>
              <p className="text-[20px] font-black" style={{ color: bandColor(data.readiness_band) }}>
                {data.readiness_score}
              </p>
            </div>
            <div>
              <p className="text-[13px] font-black text-[#111]">{data.user.name}</p>
              <p className="text-[11px] text-[#9CA3AF]">
                {data.readiness_band} · {data.overall.total_sessions} sessions · {data.overall.best_score ? Math.round(data.overall.best_score) : "—"}/100 best
              </p>
            </div>
          </div>
        </div>

        {/* Platform buttons */}
        <div className="px-6 py-5 space-y-2.5">
          {platforms.map(p => (
            <a key={p.name} href={p.url} target="_blank" rel="noopener noreferrer">
              <button className="flex w-full items-center gap-4 rounded-2xl border border-[#E5E7EB] p-4 hover:border-[#D1D5DB] hover:shadow-sm transition-all text-left">
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl text-[15px] font-black"
                  style={{ background: p.bg, color: p.color }}>
                  {p.icon}
                </div>
                <div>
                  <p className="text-[13px] font-bold text-[#111]">Share on {p.name}</p>
                  <p className="text-[11px] text-[#9CA3AF]">Opens {p.name} with pre-filled text</p>
                </div>
                <span className="ml-auto text-[#D1D5DB] text-[16px]">→</span>
              </button>
            </a>
          ))}

          {/* Copy text */}
          <button onClick={copyText}
            className="flex w-full items-center gap-4 rounded-2xl border border-[#E5E7EB] p-4 hover:border-[#111] transition-all text-left">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-[#F3F4F6] text-[18px]">
              {copied ? "✓" : "📋"}
            </div>
            <div>
              <p className="text-[13px] font-bold text-[#111]">{copied ? "Copied!" : "Copy text"}</p>
              <p className="text-[11px] text-[#9CA3AF]">Paste anywhere — WhatsApp, email, notes</p>
            </div>
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ─── Passport card ────────────────────────────────────────────────────────────

function PassportCard({ data }: { data: PassportData }) {
  const improvement = data.overall.improvement;

  return (
    <div
      className="relative w-full overflow-hidden rounded-3xl bg-white border border-[#E5E7EB] shadow-sm"
      style={{ padding: "28px" }}
    >
      {/* Subtle yellow accent bar top-left */}
      <div className="absolute left-0 top-0 h-1.5 w-20 rounded-br-full bg-yellow-400" />

      <div className="relative">
        {/* Header row */}
        <div className="relative flex items-start justify-between mb-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[15px] font-black" style={{ color: "#111" }}>
                Qu<span className="bg-yellow-400 text-[#111] px-1 rounded-sm">ed</span>
              </span>
              <span className="rounded-full bg-[#F3F4F6] px-2 py-0.5 text-[8px] font-black text-[#374151] uppercase tracking-widest">
                Skill Passport
              </span>
            </div>
            <p className="text-[22px] font-black leading-tight" style={{ color: "#111" }}>{data.user.name}</p>
            {data.user.college && (
              <p className="text-[11px] mt-0.5" style={{ color: "#9CA3AF" }}>{data.user.college}</p>
            )}
          </div>

          {/* Readiness score */}
          <div className="flex flex-col items-center shrink-0">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl border"
              style={{ borderColor: bandColor(data.readiness_band) + "40", background: bandColor(data.readiness_band) + "20" }}>
              <div className="text-center">
                <p className="text-[24px] font-black leading-none" style={{ color: bandColor(data.readiness_band) }}>
                  {data.readiness_score}
                </p>
                <p className="text-[8px] text-[#9CA3AF]">/100</p>
              </div>
            </div>
            <p className="text-[9px] font-black mt-1.5 rounded-full px-2 py-0.5"
              style={{ background: bandColor(data.readiness_band) + "25", color: bandColor(data.readiness_band) }}>
              {data.readiness_band}
            </p>
          </div>
        </div>

        {/* Topic scores row */}
        <div className="relative grid grid-cols-5 gap-3 mb-6">
          {Object.entries(data.topic_scores).map(([key, val]) => {
            const meta = TOPIC_META[key];
            return (
              <div key={key} className="flex flex-col items-center gap-1.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl text-[14px]"
                  style={{ background: "#F9FAFB", border: "1px solid #F3F4F6" }}>
                  {meta?.icon || "📊"}
                </div>
                <p className="text-[17px] font-black leading-none" style={{ color: "#111" }}>
                  {val.score !== null ? Math.round(val.score) : "—"}
                </p>
                <p className="text-[8px] text-center" style={{ color: "#6B7280" }}>{meta?.label?.split(" ")[0] || key}</p>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="relative flex items-center justify-between border-t pt-4"
          style={{ borderColor: "#F3F4F6" }}>
          <div className="flex gap-5">
            {[
              { val: String(data.overall.total_sessions), label: "Sessions" },
              { val: `🔥${data.streak.current}`, label: "Streak" },
              ...(improvement !== null ? [{ val: `${improvement >= 0 ? "+" : ""}${improvement}`, label: "Improved" }] : []),
            ].map(({ val, label }) => (
              <div key={label}>
                <p className="text-[15px] font-black leading-none"
                  style={label === "Improved" ? { color: (improvement ?? 0) >= 0 ? "#10B981" : "#EF4444" } : {}}>
                  {val}
                </p>
                <p className="text-[8px] uppercase tracking-wide mt-0.5" style={{ color: "#9CA3AF" }}>{label}</p>
              </div>
            ))}
          </div>
          <div className="text-right">
            <p className="text-[8px]" style={{ color: "#111" }}>Verified by Qued AI</p>
            <p className="text-[8px]" style={{ color: "#111" }}>qued.in · {new Date().getFullYear()}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ReadinessArc({ score, band }: { score: number; band: string }) {
  const r = 70, circ = Math.PI * r;
  const pct = Math.min(100, Math.max(0, score)) / 100;
  const color = bandColor(band);
  return (
    <div className="flex flex-col items-center">
      <svg width="180" height="100" viewBox="0 0 180 100">
        <path d="M 20 90 A 70 70 0 0 1 160 90" fill="none" stroke="#F3F4F6" strokeWidth="10" strokeLinecap="round" />
        <path d="M 20 90 A 70 70 0 0 1 160 90" fill="none" stroke={color} strokeWidth="10" strokeLinecap="round"
          strokeDasharray={circ} strokeDashoffset={circ * (1 - pct)}
          style={{ transition: "stroke-dashoffset 1.2s cubic-bezier(0.34,1.56,0.64,1)" }} />
        <text x="90" y="78" textAnchor="middle" fontSize="32" fontWeight="900" fill="#111">{score}</text>
        <text x="90" y="95" textAnchor="middle" fontSize="11" fill="#9CA3AF">/100</text>
      </svg>
      <span className="mt-1 rounded-full px-3 py-1 text-[12px] font-black"
        style={{ background: color + "15", color }}>{band}</span>
    </div>
  );
}

function TopicBar({ topicKey, data }: { topicKey: string; data: TopicScore }) {
  const meta = TOPIC_META[topicKey] || { label: topicKey, icon: "📊", color: "#374151", bg: "#f3f4f6" };
  const score = data.score;
  const pct = score !== null ? Math.min(100, score) : 0;
  const color = bandColor(data.band);
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-[14px]">{meta.icon}</span>
          <span className="text-[13px] font-bold text-[#111]">{meta.label}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[12px] font-black" style={{ color }}>{data.band}</span>
          {score !== null && <span className="text-[13px] font-black text-[#111]">{Math.round(score)}</span>}
        </div>
      </div>
      <div className="h-2 w-full rounded-full bg-[#F3F4F6] overflow-hidden">
        <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }}
          transition={{ duration: 1, delay: 0.2, ease: "easeOut" }}
          className="h-full rounded-full" style={{ background: color }} />
      </div>
      {data.sessions > 0 && (
        <p className="text-[10px] text-[#9CA3AF]">{data.sessions} session{data.sessions !== 1 ? "s" : ""}</p>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function PassportPage() {
  const { user, authHeader } = useAuth();
  const [data, setData] = useState<PassportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showShare, setShowShare] = useState(false);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    async function load() {
      try {
        const res = await fetch(`${API_BASE}/api/passport/my`, { headers: authHeader() });
        if (res.ok) setData(await res.json());
      } catch { /* silent */ }
      finally { setLoading(false); }
    }
    load();
  }, [user, authHeader]);

  if (!user) {
    return (
      <div className="min-h-screen bg-[#FFFDF0] flex items-center justify-center px-6">
        <div className="text-center max-w-[400px]">
          <div className="text-[52px] mb-5">🎖️</div>
          <h1 className="text-[28px] font-black text-[#111] mb-2" style={{ letterSpacing: "-1px" }}>Skill Passport</h1>
          <p className="text-[14px] text-[#6B7280] mb-6 leading-relaxed">
            Your verified interview readiness card. Complete mock sessions to generate yours.
          </p>
          <div className="flex gap-3 justify-center">
            <Link href="/login" className="rounded-xl bg-[#111] px-6 py-3 text-[13px] font-black text-white hover:bg-[#333] transition">Sign in</Link>
            <Link href="/signup" className="rounded-xl border border-[#E5E7EB] bg-white px-6 py-3 text-[13px] font-medium text-[#374151] hover:bg-[#F9FAFB] transition">Create account</Link>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FFFDF0] pt-24 flex items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-4 h-6 w-6 animate-spin rounded-full border-2 border-gray-200 border-t-[#111]" />
          <p className="text-[13px] text-[#9CA3AF]">Generating your passport…</p>
        </div>
      </div>
    );
  }

  if (!data?.has_data) {
    return (
      <div className="min-h-screen bg-[#FFFDF0] pt-24 px-6">
        <div className="mx-auto max-w-[480px] text-center">
          <div className="text-[52px] mb-4">🎖️</div>
          <h1 className="text-[24px] font-black text-[#111] mb-2" style={{ letterSpacing: "-1px" }}>No passport yet</h1>
          <p className="text-[14px] text-[#6B7280] mb-6">
            {data?.message || "Complete at least one mock session to generate your Skill Passport."}
          </p>
          <Link href="/mock">
            <button className="rounded-xl bg-[#111] px-6 py-3 text-[13px] font-black text-white hover:bg-[#333] transition">
              Start a mock session →
            </button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAFAF8]">
      <main className="pt-28 pb-24">
        <div className="mx-auto max-w-[1100px] px-4 sm:px-6">

          {/* Header */}
          <div className="flex flex-wrap items-start justify-between gap-4 mb-8">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="flex items-center gap-1.5 rounded-full bg-[#111] px-3 py-1 text-[11px] font-black text-white">
                  <span className="h-1.5 w-1.5 rounded-full bg-yellow-400" />
                  SKILL PASSPORT
                </span>
              </div>
              <h1 style={{ fontSize: "clamp(24px, 4vw, 36px)", fontWeight: 900, letterSpacing: "-1px", color: "#111" }}>
                {data.user.name}&apos;s Interview Profile
              </h1>
              {data.user.college && <p className="text-[14px] text-[#9CA3AF] mt-1">{data.user.college}</p>}
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowShare(true)}
                className="flex items-center gap-2 rounded-xl bg-[#111] px-4 py-2.5 text-[13px] font-black text-white hover:bg-[#333] transition">
                <span>↗</span> Share passport
              </button>
              <Link href="/mock">
                <button className="rounded-xl border border-[#E5E7EB] bg-white px-4 py-2.5 text-[13px] font-bold text-[#374151] hover:border-[#111] transition">
                  Practice more →
                </button>
              </Link>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_320px]">

            {/* ── Left ── */}
            <div className="space-y-5">

              {/* Passport card — full width */}
              <div>
                <p className="text-[11px] font-black uppercase tracking-widest text-[#9CA3AF] mb-3">Your shareable card</p>
                <PassportCard data={data} />
                <p className="mt-2 text-[11px] text-[#9CA3AF]">Share on LinkedIn, WhatsApp, or X to show your prep progress</p>
              </div>

              {/* Score trend */}
              {data.history.trend.length >= 2 && (
                <div className="rounded-2xl border border-[#E5E7EB] bg-white p-5">
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-[13px] font-black text-[#111]">Score trend</p>
                    {data.overall.improvement !== null && (
                      <span className={`text-[12px] font-black rounded-full px-3 py-1 ${
                        data.overall.improvement >= 0 ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"
                      }`}>
                        {data.overall.improvement >= 0 ? "+" : ""}{data.overall.improvement} from start
                      </span>
                    )}
                  </div>
                  <ResponsiveContainer width="100%" height={160}>
                    <LineChart data={data.history.trend} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                      <XAxis dataKey="session" tick={{ fontSize: 11, fill: "#9CA3AF" }} tickFormatter={v => `S${v}`} />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: "#9CA3AF" }} />
                      <Tooltip
                        contentStyle={{ border: "1px solid #E5E7EB", borderRadius: "12px", fontSize: "12px" }}
                        formatter={(v) => v !== undefined ? [`${Math.round(Number(v))}/100`, "Score"] : ["—", "Score"]}
                        labelFormatter={v => `Session ${v}`}
                      />
                      <Line type="monotone" dataKey="score" stroke="#111" strokeWidth={2.5}
                        dot={{ fill: "#111", r: 3 }} activeDot={{ r: 5 }} />
                    </LineChart>
                  </ResponsiveContainer>
                  <div className="mt-3 flex items-center justify-between text-[11px] text-[#9CA3AF]">
                    <span>First: {data.history.first_session}</span>
                    <span>Latest: {data.history.latest_session}</span>
                  </div>
                </div>
              )}

              {/* Topic breakdown */}
              <div className="rounded-2xl border border-[#E5E7EB] bg-white p-5">
                <p className="text-[13px] font-black text-[#111] mb-5">Topic breakdown</p>
                <div className="space-y-4">
                  {Object.entries(data.topic_scores).map(([key, val]) => (
                    <TopicBar key={key} topicKey={key} data={val} />
                  ))}
                </div>
              </div>
            </div>

            {/* ── Right ── */}
            <div className="space-y-4">

              {/* Readiness */}
              <div className="rounded-2xl border border-[#E5E7EB] bg-white p-6 text-center">
                <p className="text-[11px] font-black uppercase tracking-widest text-[#9CA3AF] mb-4">Interview readiness</p>
                <ReadinessArc score={data.readiness_score} band={data.readiness_band} />
                <p className="mt-4 text-[13px] text-[#6B7280] leading-relaxed">
                  {data.readiness_band === "Expert"     ? "You're ready. Go get that offer." :
                   data.readiness_band === "Strong"     ? "Strong foundation. A few more sessions to sharpen edges." :
                   data.readiness_band === "Developing" ? "Good progress. Keep practising consistently." :
                   data.readiness_band === "Beginner"   ? "Early days. Consistent practice will move this fast." :
                   "Complete more sessions to build your score."}
                </p>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: "Sessions",      value: String(data.overall.total_sessions), icon: "🎯" },
                  { label: "Best score",    value: data.overall.best_score ? `${Math.round(data.overall.best_score)}/100` : "—", icon: "🏆" },
                  { label: "Streak",        value: `${data.streak.current} days`, icon: "🔥" },
                  { label: "Daily answers", value: String(data.streak.daily_answered), icon: "✅" },
                ].map(({ label, value, icon }) => (
                  <div key={label} className="rounded-2xl border border-[#E5E7EB] bg-white p-4 text-center">
                    <p className="text-[18px] mb-1">{icon}</p>
                    <p className="text-[20px] font-black text-[#111] leading-none">{value}</p>
                    <p className="text-[10px] text-[#9CA3AF] mt-1 uppercase tracking-wide">{label}</p>
                  </div>
                ))}
              </div>

              {/* Communication */}
              <div className="rounded-2xl border border-[#E5E7EB] bg-white p-5">
                <p className="text-[11px] font-black uppercase tracking-widest text-[#9CA3AF] mb-4">Communication</p>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-[16px]">💬</span>
                      <p className="text-[13px] text-[#374151]">Avg speaking pace</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[14px] font-black text-[#111]">
                        {data.communication.avg_wpm ? `${Math.round(data.communication.avg_wpm)} WPM` : "—"}
                      </p>
                      <p className="text-[10px]" style={{ color: data.communication.wpm_band === "Ideal" ? "#10B981" : "#F59E0B" }}>
                        {data.communication.wpm_band}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-[16px]">🤐</span>
                      <p className="text-[13px] text-[#374151]">Avg filler words</p>
                    </div>
                    <p className="text-[14px] font-black text-[#111]">
                      {data.communication.avg_fillers !== null ? `${Math.round(data.communication.avg_fillers)} / session` : "—"}
                    </p>
                  </div>
                </div>
              </div>

              {/* Roles */}
              {data.history.roles_practiced.length > 0 && (
                <div className="rounded-2xl border border-[#E5E7EB] bg-white p-5">
                  <p className="text-[11px] font-black uppercase tracking-widest text-[#9CA3AF] mb-3">Roles practiced</p>
                  <div className="flex flex-wrap gap-2">
                    {data.history.roles_practiced.map(r => (
                      <span key={r} className="rounded-xl bg-[#F3F4F6] border border-[#E5E7EB] px-3 py-1.5 text-[12px] font-bold text-[#374151]">{r}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* CTA */}
              <div className="rounded-2xl bg-[#111] p-5">
                <p className="text-[14px] font-black text-white mb-1">Improve your score</p>
                <p className="text-[12px] mb-4" style={{ color: "#555" }}>Every session updates your passport in real time.</p>
                <Link href="/mock" className="block w-full rounded-xl bg-yellow-400 py-2.5 text-center text-[13px] font-black text-[#111] hover:bg-yellow-300 transition">
                  Practice now →
                </Link>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Share modal */}
      <AnimatePresence>
        {showShare && <ShareModal data={data} onClose={() => setShowShare(false)} />}
      </AnimatePresence>

      <FooterHero />
    </div>
  );
}