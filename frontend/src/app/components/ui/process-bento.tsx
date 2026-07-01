"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

const cards = [
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
            <div
              className="text-xl font-black"
              style={{ color: s.color }}
            >
              {s.val}
            </div>
            <div className="text-xs text-gray-400 mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>
    ),
  },
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
        style={{
          background: "#FFFBEB",
          border: "1px solid #FDE68A",
        }}
      >
        <div
          className="text-xs font-black mb-1"
          style={{ color: "#92400E" }}
        >
          ⚡ FIX THIS FIRST
        </div>
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
        <div style={{ paddingLeft: "14px", color: "#E5E7EB" }}>
          min_price = prices[0]
        </div>
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
        <div className="text-[11px] font-bold mb-1" style={{ color: "#5B21B6" }}>
          "Why MongoDB over SQL?"
        </div>
        <div className="text-[10px] leading-relaxed" style={{ color: "#888" }}>
          Based on your project: ExpenseTracker
        </div>
      </div>
    ),
  },
  {
    id: 6,
    span: "md:col-span-12",
    height: "h-[200px]",
    bg: "#111111",
    border: "#333333",
    tag: "ASR",
    tagBg: "#222222",
    tagColor: "#888888",
    title: "Voice + Text",
    desc: "Answer by voice or type. Whisper ASR transcribes in under 2 seconds.",
    dark: true,
    visual: (
      <div className="flex items-end gap-1 mt-4 h-10">
        {[8, 20, 32, 24, 40, 28, 36, 16, 28, 20, 32, 12, 18, 30, 22, 36, 14, 26, 20, 32, 10, 24, 18, 30].map((h, i) => (
          <div
            key={i}
            style={{
              width: "6px",
              height: `${h}px`,
              background: "#6366F1",
              borderRadius: "3px",
              opacity: 0.6 + (i % 3) * 0.2,
            }}
          />
        ))}
      </div>
    ),
  },
];

export function ProcessBento() {
  return (
    <section
      className="py-20 px-6"
      style={{ background: "#FFFDF0" }}
    >
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
              Everything to crack
              your{" "}
              <span
                style={{
                  background: "#FFD600",
                  padding: "2px 10px",
                  borderRadius: "6px",
                  fontStyle: "italic",
                }}
              >
                interview
              </span>
            </h2>
            <div className="flex gap-8 mt-6">
              <div>
                <div
                  className="font-black text-xl"
                  style={{ color: "#111" }}
                >
                  160+
                </div>
                <div className="text-xs text-gray-400 mt-0.5">
                  curated questions
                </div>
              </div>
              <div>
                <div
                  className="font-black text-xl"
                  style={{ color: "#111" }}
                >
                  185
                </div>
                <div className="text-xs text-gray-400 mt-0.5">
                  DSA problems
                </div>
              </div>
              <div>
                <div
                  className="font-black text-xl"
                  style={{ color: "#111" }}
                >
                  7 companies
                </div>
                <div className="text-xs text-gray-400 mt-0.5">
                  specific prep
                </div>
              </div>
            </div>
          </div>
          <p
            className="leading-relaxed"
            style={{
              fontSize: "16px",
              color: "#666",
              lineHeight: 1.7,
              maxWidth: "420px",
            }}
          >
            Built specifically for Indian engineering students
            preparing for placements. Practice the right way —
            personalised, specific, and actionable.
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
              transition={{ duration: 0.4, delay: i * 0.08 }}
              whileHover={{ y: -4, transition: { duration: 0.2 } }}
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
                style={{
                  background: card.tagBg,
                  color: card.tagColor,
                }}
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
                style={{
                  color: card.dark ? "#888" : "#666",
                  lineHeight: 1.6,
                }}
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