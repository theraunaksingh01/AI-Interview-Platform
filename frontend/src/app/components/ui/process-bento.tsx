"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

const cards = [
  // ── Row 1: 7 + 5 ─────────────────────────────────────────────────────────
  {
    id: 1,
    span: "md:col-span-7",
    height: "h-[280px]",
    bg: "#FFF9E6",
    border: "#FFD600",
    tag: "QUESTION BANK",
    tagBg: "#FFD600",
    tagColor: "#7A6000",
    title: "Company-specific prep",
    desc: "Questions from TCS NQT pattern, Amazon Leadership Principles, Microsoft problem-solving rounds — not generic lists.",
    visual: (
      <div className="flex flex-wrap gap-2 mt-4">
        {[
          { name: "TCS", bg: "#DBEAFE", color: "#1D4ED8" },
          { name: "Amazon", bg: "#FEF3C7", color: "#92400E" },
          { name: "Microsoft", bg: "#CFFAFE", color: "#0E7490" },
          { name: "Infosys", bg: "#D1FAE5", color: "#065F46" },
          { name: "Wipro", bg: "#EDE9FE", color: "#5B21B6" },
          { name: "Startup", bg: "#FCE7F3", color: "#9D174D" },
        ].map((c) => (
          <span
            key={c.name}
            style={{ background: c.bg, color: c.color }}
            className="text-xs font-bold px-3 py-1.5 rounded-full"
          >
            {c.name}
          </span>
        ))}
      </div>
    ),
  },
  {
    id: 2,
    span: "md:col-span-5",
    height: "h-[280px]",
    bg: "#F0FDF4",
    border: "#86EFAC",
    tag: "LIVE",
    tagBg: "#DCFCE7",
    tagColor: "#166534",
    title: "Real-time coaching",
    desc: "WPM, filler words, and silence gaps tracked live while you speak — not after.",
    visual: (
      <div
        className="mt-4 rounded-xl p-3 flex justify-between items-center"
        style={{ background: "white", border: "1px solid #E8E8E0" }}
      >
        {[
          { val: "127", label: "WPM", color: "#10B981" },
          { val: "2", label: "Fillers", color: "#F59E0B" },
          { val: "✓", label: "Pace", color: "#6366F1" },
        ].map((s) => (
          <div key={s.label} className="text-center">
            <div className="text-xl font-black" style={{ color: s.color }}>{s.val}</div>
            <div className="text-xs text-gray-400 mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>
    ),
  },

  // ── Row 2: 3 + 6 + 3 ─────────────────────────────────────────────────────
  {
    id: 3,
    span: "md:col-span-3",
    height: "h-[300px]",
    bg: "#FFF1F2",
    border: "#FECDD3",
    tag: "FEEDBACK",
    tagBg: "#FFE4E6",
    tagColor: "#9F1239",
    title: "One specific fix",
    desc: "Not a score — one actionable thing to improve before your actual interview.",
    visual: (
      <div
        className="mt-4 rounded-xl p-3"
        style={{ background: "#FFFBEB", border: "1px solid #FDE68A" }}
      >
        <div className="text-xs font-black mb-1" style={{ color: "#92400E" }}>⚡ FIX THIS FIRST</div>
        <div className="text-xs leading-relaxed" style={{ color: "#78350F" }}>
          "Add one specific project example to Q3."
        </div>
      </div>
    ),
  },
  {
    id: 4,
    span: "md:col-span-6",
    height: "h-[300px]",
    bg: "#0F0F17",
    border: "#2A2A3A",
    tag: "CODE",
    tagBg: "#1F1F2E",
    tagColor: "#A5B4FC",
    title: "DSA Practice IDE",
    desc: "185 problems in Python, Java, C++. Real test cases — see the optimal approach and why it works.",
    dark: true,
    visual: (
      <div
        className="mt-4 rounded-xl p-3 font-mono"
        style={{ background: "#1A1A26", border: "1px solid #2A2A3A", fontSize: "11px", lineHeight: 1.85 }}
      >
        <div style={{ color: "#6B7280" }}>
          <span style={{ color: "#C084FC" }}>def</span>{" "}
          <span style={{ color: "#60A5FA" }}>max_profit</span>
          <span style={{ color: "#E5E7EB" }}>(prices):</span>
        </div>
        <div style={{ paddingLeft: "14px", color: "#E5E7EB" }}>min_price = prices[0]</div>
        <div className="flex items-center gap-2 mt-2">
          <span className="rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ background: "#065F46", color: "#6EE7B7" }}>
            ✓ 12/12 passed
          </span>
          <span className="text-[10px]" style={{ color: "#6B7280" }}>O(n) time</span>
        </div>
      </div>
    ),
  },
  {
    id: 5,
    span: "md:col-span-3",
    height: "h-[300px]",
    bg: "#F5F3FF",
    border: "#DDD6FE",
    tag: "RESUME",
    tagBg: "#EDE9FE",
    tagColor: "#5B21B6",
    title: "Project discussion prep",
    desc: "AI reads your resume and asks about YOUR projects — not generic questions.",
    visual: (
      <div
        className="mt-4 rounded-xl p-3"
        style={{ background: "white", border: "1px solid #E8E8E0" }}
      >
        <div className="text-[11px] font-bold mb-1" style={{ color: "#5B21B6" }}>"Why MongoDB over SQL?"</div>
        <div className="text-[10px] leading-relaxed" style={{ color: "#888" }}>Based on your project: ExpenseTracker</div>
      </div>
    ),
  },

  // ── Row 3: Assessment 5 + OA 7 ───────────────────────────────────────────
  {
    id: 7,
    span: "md:col-span-5",
    height: "h-[320px]",
    bg: "#111111",
    border: "#222222",
    tag: "FREE",
    tagBg: "#FFD600",
    tagColor: "#7A6000",
    title: "Placement Readiness Assessment",
    desc: "30-minute diagnostic across aptitude, CS, DSA and communication. One honest score.",
    dark: true,
    visual: (
      <div className="mt-auto pt-4">
        {/* Score + bars side by side */}
        <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
          {/* Big score */}
          <div style={{
            background: "#1A1A1A", border: "1px solid #2A2A2A",
            borderRadius: 12, padding: "12px 16px", textAlign: "center", flexShrink: 0,
          }}>
            <div style={{ fontSize: 36, fontWeight: 900, color: "white", lineHeight: 1, letterSpacing: "-2px" }}>64</div>
            <div style={{ fontSize: 10, color: "#555", marginTop: 2 }}>/100</div>
            <div style={{
              marginTop: 6, background: "#FFD600", color: "#111",
              borderRadius: 4, padding: "2px 8px", fontSize: 9, fontWeight: 800,
            }}>
              Good Progress
            </div>
          </div>
          {/* Mini bars */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 7, paddingTop: 2 }}>
            {[
              { label: "Aptitude", score: 72, color: "#6366F1" },
              { label: "CS Fundamentals", score: 85, color: "#10B981" },
              { label: "DSA", score: 41, color: "#F59E0B" },
              { label: "Communication", score: 58, color: "#EC4899" },
            ].map(s => (
              <div key={s.label}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                  <span style={{ fontSize: 10, color: "#555" }}>{s.label}</span>
                  <span style={{ fontSize: 10, fontWeight: 800, color: s.color }}>{s.score}%</span>
                </div>
                <div style={{ height: 4, background: "#222", borderRadius: 99, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${s.score}%`, background: s.color, borderRadius: 99 }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    ),
  },
  {
    id: 8,
    span: "md:col-span-7",
    height: "h-[320px]",
    bg: "#F7F6F3",
    border: "#E0DDD5",
    tag: "PRO & MAX",
    tagBg: "#EDE9FE",
    tagColor: "#5B21B6",
    title: "OA Practice Tests",
    desc: "TCS NQT, Infosys SE, Wipro NLTH, Cognizant GenC — locked timers, band prediction after every attempt.",
    dark: false,
    visual: (
      <div className="mt-auto pt-3">
        {/* Mock exam window */}
        <div style={{
          background: "white", border: "1px solid #E5E7EB",
          borderRadius: 12, overflow: "hidden",
        }}>
          {/* Top bar */}
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "8px 12px", background: "#FAFAF8", borderBottom: "1px solid #F0EDE6",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 14 }}>🔷</span>
              <span style={{ fontSize: 12, fontWeight: 800, color: "#111" }}>TCS NQT Foundation</span>
              <span style={{
                fontSize: 9, fontWeight: 800,
                background: "#FEE2E2", color: "#DC2626",
                borderRadius: 4, padding: "1px 5px",
              }}>● LIVE</span>
            </div>
            <span style={{
              fontFamily: "monospace", fontSize: 14, fontWeight: 900,
              background: "#F3F4F6", color: "#111",
              padding: "2px 8px", borderRadius: 6,
            }}>09:42</span>
          </div>
          {/* Section tabs */}
          <div style={{ display: "flex", gap: 4, padding: "8px 12px", borderBottom: "1px solid #F0EDE6" }}>
            {["Numerical", "Verbal 🔒", "Reasoning 🔒"].map((s, i) => (
              <span key={s} style={{
                background: i === 0 ? "#111" : "#F3F4F6",
                color: i === 0 ? "white" : "#9CA3AF",
                borderRadius: 6, padding: "4px 10px",
                fontSize: 10, fontWeight: 700,
              }}>{s}</span>
            ))}
          </div>
          {/* Mini question */}
          <div style={{ padding: "10px 12px" }}>
            <div style={{ fontSize: 10, color: "#9CA3AF", marginBottom: 6 }}>Q7 of 10 · Numerical</div>
            <div style={{ fontSize: 11, color: "#374151", lineHeight: 1.5, marginBottom: 8 }}>
              A train travels 360 km in 4 hours. What is the ratio of train to car speed if car takes 6 hours?
            </div>
            {/* Band strip */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 10, color: "#9CA3AF" }}>Band prediction</span>
              <div style={{ display: "flex", gap: 4 }}>
                {[
                  { label: "Ninja", active: false },
                  { label: "Digital", active: true },
                  { label: "Prime", active: false },
                ].map(b => (
                  <span key={b.label} style={{
                    fontSize: 10, fontWeight: 800,
                    padding: "2px 8px", borderRadius: 99,
                    background: b.active ? "#EEF2FF" : "transparent",
                    color: b.active ? "#6366F1" : "#D1D5DB",
                    border: b.active ? "1px solid #C7D2FE" : "1px solid transparent",
                  }}>{b.label}</span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    ),
  },

  // ── Row 5: Quick Prep + Peer Practice + Topic Practice ──────────────────
  {
    id: 9,
    span: "md:col-span-4",
    height: "h-[280px]",
    bg: "#FFFBEB",
    border: "#FDE68A",
    tag: "2 MIN",
    tagBg: "#FEF3C7",
    tagColor: "#92400E",
    title: "Quick Prep",
    desc: "3 rapid questions before your interview. Voice or text. No setup needed.",
    visual: (
      <div className="mt-auto pt-4 space-y-2">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "white", border: "1px solid #FDE68A", borderRadius: 10, padding: "8px 12px" }}>
          <span style={{ fontSize: 12, color: "#374151", fontWeight: 600 }}>☕ Starting in</span>
          <span style={{ fontFamily: "monospace", fontSize: 18, fontWeight: 900, color: "#F59E0B" }}>0:47</span>
        </div>
        {["What is polymorphism?", "Explain REST vs GraphQL", "Time complexity of quicksort?"].map((q, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", background: i === 0 ? "#FEF3C7" : "white", border: "1px solid #F3F4F6", borderRadius: 8 }}>
            <span style={{ width: 18, height: 18, background: i === 0 ? "#F59E0B" : "#F3F4F6", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 800, color: i === 0 ? "white" : "#9CA3AF", flexShrink: 0 }}>{i + 1}</span>
            <span style={{ fontSize: 11, color: i === 0 ? "#92400E" : "#9CA3AF", fontWeight: i === 0 ? 600 : 400 }}>{q}</span>
          </div>
        ))}
      </div>
    ),
  },
  {
    id: 10,
    span: "md:col-span-4",
    height: "h-[280px]",
    bg: "#0F172A",
    border: "#1E293B",
    tag: "LIVE",
    tagBg: "#EF4444",
    tagColor: "white",
    title: "Peer Practice",
    desc: "Challenge a friend. Same question, same time. Compare your answers side by side.",
    dark: true,
    visual: (
      <div className="mt-auto pt-4">
        <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
          {[
            { name: "You", score: 84, color: "#6366F1", bar: "84%" },
            { name: "Aryan", score: 71, color: "#F59E0B", bar: "71%" },
          ].map(p => (
            <div key={p.name} style={{ flex: 1, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: "10px 12px" }}>
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", marginBottom: 4 }}>{p.name}</div>
              <div style={{ fontSize: 22, fontWeight: 900, color: p.color, lineHeight: 1 }}>{p.score}</div>
              <div style={{ marginTop: 6, height: 3, background: "rgba(255,255,255,0.08)", borderRadius: 99 }}>
                <div style={{ height: "100%", width: p.bar, background: p.color, borderRadius: 99 }} />
              </div>
            </div>
          ))}
        </div>
        <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 8, padding: "6px 10px", fontSize: 11, color: "rgba(255,255,255,0.3)" }}>
          ⚔️ Round 2 of 3 · Q: "Explain deadlock conditions"
        </div>
      </div>
    ),
  },
  {
    id: 11,
    span: "md:col-span-4",
    height: "h-[280px]",
    bg: "#F0F9FF",
    border: "#BAE6FD",
    tag: "DEEP DIVE",
    tagBg: "#E0F2FE",
    tagColor: "#0369A1",
    title: "Topic Practice",
    desc: "Pick one subject and drill it until you own it. DBMS, OS, OOP, Networks, DSA.",
    visual: (
      <div className="mt-auto pt-4 space-y-2">
        {[
          { topic: "DBMS", done: 8, total: 12, color: "#6366F1", pct: "67%" },
          { topic: "Operating Systems", done: 4, total: 10, color: "#10B981", pct: "40%" },
          { topic: "OOP Concepts", done: 10, total: 10, color: "#F59E0B", pct: "100%" },
        ].map(t => (
          <div key={t.topic} style={{ background: "white", border: "1px solid #E0F2FE", borderRadius: 9, padding: "8px 11px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: "#0C4A6E" }}>{t.topic}</span>
              <span style={{ fontSize: 10, fontWeight: 800, color: t.color }}>{t.done}/{t.total}</span>
            </div>
            <div style={{ height: 4, background: "#E0F2FE", borderRadius: 99, overflow: "hidden" }}>
              <div style={{ height: "100%", width: t.pct, background: t.color, borderRadius: 99 }} />
            </div>
          </div>
        ))}
      </div>
    ),
  },

  // ── Row 6: Company Guides + Cheat Sheet ──────────────────────────────────
  {
    id: 12,
    span: "md:col-span-6",
    height: "h-[260px]",
    bg: "#F8FAFF",
    border: "#DBEAFE",
    tag: "COMPANY GUIDES",
    tagBg: "#DBEAFE",
    tagColor: "#1D4ED8",
    title: "Know before you walk in",
    desc: "Round-by-round breakdowns, most-asked questions, interview patterns for TCS, Amazon, Microsoft and 7 more.",
    visual: (
      <div className="mt-auto pt-3">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
          {[
            { name: "TCS", rounds: "3 rounds", tag: "NQT → TR → HR", color: "#DBEAFE", text: "#1D4ED8" },
            { name: "Amazon", rounds: "5 rounds", tag: "OA → 4 interviews", color: "#FEF3C7", text: "#92400E" },
            { name: "Microsoft", rounds: "4 rounds", tag: "Coding → Design", color: "#CFFAFE", text: "#0E7490" },
            { name: "Infosys", rounds: "3 rounds", tag: "InfyTQ → TR → HR", color: "#D1FAE5", text: "#065F46" },
          ].map(c => (
            <div key={c.name} style={{ background: "white", border: "1px solid #E5E7EB", borderRadius: 9, padding: "8px 10px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 3 }}>
                <span style={{ fontSize: 12, fontWeight: 800, color: "#111" }}>{c.name}</span>
                <span style={{ background: c.color, color: c.text, fontSize: 9, fontWeight: 800, padding: "1px 6px", borderRadius: 99 }}>{c.rounds}</span>
              </div>
              <span style={{ fontSize: 10, color: "#9CA3AF" }}>{c.tag}</span>
            </div>
          ))}
        </div>
      </div>
    ),
  },
  {
    id: 13,
    span: "md:col-span-6",
    height: "h-[260px]",
    bg: "#FAFAF8",
    border: "#E8E5DC",
    tag: "CHEAT SHEET",
    tagBg: "#F3F4F6",
    tagColor: "#374151",
    title: "Everything you need to remember",
    desc: "Distilled CS fundamentals — DBMS, OS, networks, OOP — structured for last-minute review before your interview.",
    visual: (
      <div className="mt-auto pt-3">
        <div style={{ background: "white", border: "1px solid #E8E5DC", borderRadius: 10, padding: "10px 14px", fontFamily: "monospace" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#EF4444", display: "inline-block" }} />
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#F59E0B", display: "inline-block" }} />
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#10B981", display: "inline-block" }} />
            <span style={{ fontSize: 10, color: "#9CA3AF", marginLeft: 4 }}>ACID Properties</span>
          </div>
          {[
            { key: "Atomicity", val: "All or nothing" },
            { key: "Consistency", val: "Valid state → valid state" },
            { key: "Isolation", val: "Transactions don't interfere" },
            { key: "Durability", val: "Committed = permanent" },
          ].map(({ key, val }) => (
            <div key={key} style={{ display: "flex", gap: 8, fontSize: 10, lineHeight: 1.8 }}>
              <span style={{ color: "#6366F1", fontWeight: 700, width: 90, flexShrink: 0 }}>{key}</span>
              <span style={{ color: "#555" }}>{val}</span>
            </div>
          ))}
        </div>
      </div>
    ),
  },

  // ── Row 7: Calendar (medium) + interview tip (small) ─────────────────────
  // ── Row 6: Calendar + Daily Challenge ───────────────────────────────────
  {
    id: 14,
    span: "md:col-span-7",
    height: "h-[260px]",
    bg: "#F0FDF4",
    border: "#BBF7D0",
    tag: "CALENDAR",
    tagBg: "#DCFCE7",
    tagColor: "#166534",
    title: "Never miss an interview",
    desc: "Add your interview date. Get a personalised day-by-day prep plan built around your timeline.",
    visual: (
      <div className="mt-auto pt-3">
        <div style={{ background: "white", border: "1px solid #BBF7D0", borderRadius: 10, padding: "10px 14px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 800, color: "#111" }}>July 2026</span>
            <span style={{ fontSize: 10, background: "#DCFCE7", color: "#166534", borderRadius: 99, padding: "2px 8px", fontWeight: 700 }}>TCS in 5 days</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 3, marginBottom: 8 }}>
            {["M","T","W","T","F","S","S"].map((d, i) => (
              <div key={i} style={{ fontSize: 9, color: "#9CA3AF", textAlign: "center", fontWeight: 700 }}>{d}</div>
            ))}
            {[...Array(2)].map((_, i) => <div key={"e"+i} />)}
            {[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21].map(d => (
              <div key={d} style={{
                height: 22, display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 10, fontWeight: d === 17 ? 900 : 400,
                background: d === 17 ? "#10B981" : d === 12 ? "#FEF3C7" : "transparent",
                color: d === 17 ? "white" : d === 12 ? "#92400E" : "#374151",
                borderRadius: 5,
              }}>{d}</div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 8, height: 8, background: "#10B981", borderRadius: "50%", display: "inline-block" }} />
              <span style={{ fontSize: 10, color: "#374151" }}>17 Jul — TCS Interview</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 8, height: 8, background: "#F59E0B", borderRadius: "50%", display: "inline-block" }} />
              <span style={{ fontSize: 10, color: "#374151" }}>12 Jul — Prep day 5</span>
            </div>
          </div>
        </div>
      </div>
    ),
  },
  {
    id: 16,
    span: "md:col-span-5",
    height: "h-[260px]",
    bg: "#FFFBEB",
    border: "#FDE68A",
    tag: "DAILY",
    tagBg: "#FEF3C7",
    tagColor: "#92400E",
    title: "Daily Challenge",
    desc: "One question every day. 2 minutes. Build your streak and your confidence consistently.",
    visual: (
      <div className="mt-auto pt-3">
        <div style={{ background: "white", border: "1px solid #FDE68A", borderRadius: 10, padding: "12px 14px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
            <span style={{ fontSize: 11, fontWeight: 800, color: "#111" }}>Today&apos;s question</span>
            <span style={{ fontSize: 10, color: "#9CA3AF" }}>Day 23 🔥</span>
          </div>
          <div style={{ fontSize: 12, color: "#374151", lineHeight: 1.6, marginBottom: 10 }}>
            What is the difference between process and thread in OS?
          </div>
          <div style={{ display: "flex", gap: 4 }}>
            {[...Array(7)].map((_, i) => (
              <div key={i} style={{
                flex: 1, height: 28, borderRadius: 6,
                background: i < 5 ? "#F59E0B" : "#F3F4F6",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 9, fontWeight: 700,
                color: i < 5 ? "white" : "#D1D5DB",
              }}>
                {["M","T","W","T","F","S","S"][i]}
              </div>
            ))}
          </div>
        </div>
      </div>
    ),
  },
];

export function ProcessBento() {
  return (
    <section className="py-20 px-6" style={{ background: "#FFFDF0" }}>
      <div className="max-w-6xl mx-auto">

        {/* Header */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-end mb-12">
          <div>
            <span
              className="text-xs font-bold tracking-widest uppercase mb-3 block"
              style={{ color: "#999" }}
            >
              Everything you need
            </span>
            <h2
              className="font-black leading-tight"
              style={{
                fontSize: "clamp(32px, 4vw, 48px)",
                letterSpacing: "-1.5px",
                color: "#111111",
              }}
            >
              Everything you need.{" "}
              <span style={{
                background: "#FFD600",
                padding: "2px 10px",
                borderRadius: "6px",
                fontStyle: "italic",
              }}>
                All in one place.
              </span>
            </h2>
            <div className="flex gap-8 mt-6">
              {[
                { val: "185", label: "DSA problems" },
                { val: "734", label: "OA questions" },
                { val: "10+", label: "practice modes" },
              ].map(({ val, label }) => (
                <div key={label}>
                  <div className="font-black text-xl" style={{ color: "#111" }}>{val}</div>
                  <div className="text-xs text-gray-400 mt-0.5">{label}</div>
                </div>
              ))}
            </div>
          </div>
          <p
            className="leading-relaxed"
            style={{ fontSize: "16px", color: "#666", lineHeight: 1.7, maxWidth: "420px" }}
          >
            Built specifically for Indian engineering students preparing for campus and off-campus placements.
            Every tool you need — from mock interviews to OA tests to company-specific guides.
          </p>
        </div>

        {/* Bento grid */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
          {cards.map((card, i) => (
            <motion.article
              key={card.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.07 }}
              whileHover={{ y: -3, transition: { duration: 0.18 } }}
              className={cn(
                "relative overflow-hidden rounded-2xl p-6 flex flex-col",
                card.span,
                card.height
              )}
              style={{
                background: card.bg,
                border: `1px solid ${card.border}`,
              }}
            >
              {/* Tag */}
              <span
                className="inline-block text-[10px] font-black tracking-widest rounded-full px-2.5 py-1 w-fit mb-3"
                style={{ background: card.tagBg, color: card.tagColor }}
              >
                {card.tag}
              </span>

              {/* Title */}
              <h3
                className="font-black leading-tight"
                style={{
                  fontSize: "18px",
                  letterSpacing: "-0.3px",
                  color: card.dark ? "white" : "#111111",
                }}
              >
                {card.title}
              </h3>

              {/* Desc */}
              <p
                className="mt-2 text-sm leading-relaxed"
                style={{ color: card.dark ? "#888" : "#666", lineHeight: 1.6 }}
              >
                {card.desc}
              </p>

              {/* Visual */}
              {card.visual}
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
}