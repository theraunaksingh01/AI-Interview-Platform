"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { FooterHero } from "@/app/components/Footer";

const PROBLEM_SOLUTION = [
  {
    label: "The problem",
    title: "Most students freeze, not because they don't know the answer.",
    body: "You can solve the DSA problem. You know the concept. But the moment someone asks you to explain it out loud, under pressure, with no second chances — that's a completely different skill. Reading textbooks and solving LeetCode doesn't train you for that moment.",
    color: "#FEE2E2",
    accent: "#991B1B",
  },
  {
    label: "The gap",
    title: "TCS is not Amazon. Generic prep tools don't know the difference.",
    body: "A TCS NQT-style question is nothing like a FAANG system design round. Most mock interview tools are built for US tech companies and treat every interview the same. Indian campus placements have their own patterns, and almost nothing online is built around them.",
    color: "#FEF3C7",
    accent: "#92400E",
  },
  {
    label: "The solution",
    title: "Practice that talks back — specifically, honestly, every time.",
    body: "Qued listens to how you actually answer, scores you honestly, and tells you exactly what to fix — not just that you scored 62. Company-specific question banks, live coaching while you speak, and a model answer for every question so you know what good actually sounds like.",
    color: "#D1FAE5",
    accent: "#065F46",
  },
];

const VALUES = [
  {
    icon: "🎯",
    title: "Honest feedback, always",
    body: "We don't inflate scores to make you feel good. A 42 means you have work to do. We'll show you exactly what and how.",
  },
  {
    icon: "🇮🇳",
    title: "Built for India",
    body: "TCS and Google are different interviews. We know the difference. Our question bank, scoring, and company prep are all India-first.",
  },
  {
    icon: "📈",
    title: "Progress over perfection",
    body: "A student who scores 35 in session one and 68 in session five is doing better than one who scores 70 every time and never improves.",
  },
  {
    icon: "🔓",
    title: "No paywalls on the essentials",
    body: "Score, transcript, what was missing — free forever. We charge for model answers and unlimited sessions, not the core feedback.",
  },
];

export default function AboutPage() {
  return (
    <div className="min-h-screen overflow-x-hidden" style={{ background: "#FFFDF0" }}>
      <main className="pt-24">

        {/* ── 1. Hero ── */}
        <section className="px-6 pb-24 pt-16">
          <div className="mx-auto max-w-5xl">
            <motion.p
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="text-[11px] font-black uppercase tracking-widest text-[#9CA3AF] mb-4"
            >
              About Qued
            </motion.p>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              style={{ fontSize: "clamp(36px, 6vw, 68px)", fontWeight: 900, letterSpacing: "-2.5px", lineHeight: 1.3, color: "#111" }}
            >
              Mock interviews built
              <br />
              for{" "}
              <span style={{ background: "#FFD600", padding: "2px 12px", borderRadius: "6px", fontStyle: "italic" }}>
                Indian placements.
              </span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.25 }}
              className="mt-6 max-w-2xl text-[17px] leading-relaxed"
              style={{ color: "#666" }}
            >
              Most mock interview tools are built for US tech companies. Qued is built specifically for Indian engineering students preparing for campus placements — TCS, Infosys, Amazon, Microsoft, Wipro, and beyond.
            </motion.p>

            {/* Stats strip — real, verifiable claims only */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.4 }}
              className="mt-10 flex flex-wrap gap-8"
            >
              {[
                { value: "3", label: "Free sessions every month" },
                { value: "185", label: "DSA practice problems" },
                { value: "India", label: "First and only focus" },
                { value: "₹299", label: "Pro plan — built for student budgets" },
              ].map(({ value, label }) => (
                <div key={label}>
                  <p className="text-[32px] font-black text-[#111] leading-none">{value}</p>
                  <p className="text-[12px] text-[#9CA3AF] mt-1">{label}</p>
                </div>
              ))}
            </motion.div>
          </div>
        </section>

        {/* ── 2. Problem → Gap → Solution ── */}
        <section className="border-t border-gray-200 bg-white px-6 py-24">
          <div className="mx-auto max-w-5xl">
            <div className="mb-14 text-center">
              <p className="text-[11px] font-black uppercase tracking-widest text-[#9CA3AF] mb-3">Why we built this</p>
              <h2 style={{ fontSize: "clamp(26px, 4vw, 42px)", fontWeight: 900, letterSpacing: "-1.5px", color: "#111" }}>
                The problem,{" "}
                <span style={{ background: "#FFD600", padding: "1px 8px", borderRadius: "5px", fontStyle: "italic" }}>the gap,</span>
                {" "}the fix.
              </h2>
            </div>

            <div className="space-y-5">
              {PROBLEM_SOLUTION.map((p, i) => (
                <motion.div
                  key={p.label}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: i * 0.1 }}
                  className="grid grid-cols-1 sm:grid-cols-[140px_1fr] gap-4 sm:gap-8 rounded-2xl p-6 sm:p-8"
                  style={{ background: p.color }}
                >
                  <div>
                    <span
                      className="inline-block rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-widest"
                      style={{ background: "rgba(255,255,255,0.6)", color: p.accent }}
                    >
                      {p.label}
                    </span>
                  </div>
                  <div>
                    <h3 className="text-[18px] sm:text-[20px] font-black mb-2" style={{ color: "#111" }}>
                      {p.title}
                    </h3>
                    <p className="text-[14px] leading-relaxed" style={{ color: "#374151" }}>
                      {p.body}
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ── 3. Values ── */}
        <section className="px-6 py-24" style={{ background: "#FFFDF0" }}>
          <div className="mx-auto max-w-5xl">
            <div className="mb-12">
              <p className="text-[11px] font-black uppercase tracking-widest text-[#9CA3AF] mb-3">What drives us</p>
              <h2 style={{ fontSize: "clamp(26px, 4vw, 42px)", fontWeight: 900, letterSpacing: "-1.5px", color: "#111" }}>
                Driven by{" "}
                <span style={{ background: "#FFD600", padding: "1px 8px", borderRadius: "5px", fontStyle: "italic" }}>purpose.</span>
              </h2>
            </div>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              {VALUES.map((v, i) => (
                <motion.div
                  key={v.title}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: i * 0.08 }}
                  className="rounded-2xl border border-gray-200 bg-white p-6 hover:shadow-md transition-shadow"
                >
                  <span className="text-[28px] block mb-3">{v.icon}</span>
                  <h3 className="text-[16px] font-black text-[#111] mb-2">{v.title}</h3>
                  <p className="text-[13px] text-[#6B7280] leading-relaxed">{v.body}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ── 4. What's coming ── */}
        <section className="border-t border-gray-200 bg-white px-6 py-24">
          <div className="mx-auto max-w-5xl">
            <div className="mb-12 text-center">
              <p className="text-[11px] font-black uppercase tracking-widest text-[#9CA3AF] mb-3">Where we're headed</p>
              <h2 style={{ fontSize: "clamp(26px, 4vw, 42px)", fontWeight: 900, letterSpacing: "-1.5px", color: "#111" }}>
                Built incrementally,{" "}
                <span style={{ background: "#FFD600", padding: "1px 8px", borderRadius: "5px", fontStyle: "italic" }}>shaped by students.</span>
              </h2>
              <p className="mt-3 text-[15px] text-[#6B7280] max-w-lg mx-auto">
                We ship what students actually ask for, not what looks good on a roadmap slide. Every feature on this platform — DSA practice, company prep, the Skill Passport — exists because students said they needed it.
              </p>
            </div>

            <div className="rounded-2xl border-2 border-dashed border-gray-200 p-8 text-center">
              <span className="text-[32px] mb-3 block">💬</span>
              <h3 className="text-[16px] font-black text-[#111] mb-2">Got a feature request, or found a bug?</h3>
              <p className="text-[13px] text-[#9CA3AF] mb-5 max-w-md mx-auto">
                We're a small team and we read everything. Tell us what's missing or what's broken.
              </p>
              <Link
                href="/contact"
                className="inline-block rounded-xl bg-[#111] px-5 py-2.5 text-[13px] font-bold text-white hover:bg-[#333] transition"
              >
                Reach out →
              </Link>
            </div>
          </div>
        </section>

        {/* ── 5. CTA ── */}
        <section className="px-6 py-24" style={{ background: "#111" }}>
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-[11px] font-black uppercase tracking-widest text-[#555] mb-4">Ready?</p>
            <h2 style={{ fontSize: "clamp(30px, 5vw, 52px)", fontWeight: 900, letterSpacing: "-2px", color: "white", lineHeight: 1.3 }}>
              Start your first{" "}
              <span style={{ background: "#FFD600", color: "#111", padding: "2px 10px", borderRadius: "6px", fontStyle: "italic" }}>
                mock session.
              </span>
            </h2>
            <p className="mt-5 text-[15px]" style={{ color: "#666" }}>
              3 free sessions every month. No credit card. Cancel anytime.
            </p>
            <div className="mt-8 flex items-center justify-center gap-3 flex-wrap">
              <Link href="/signup">
                <button style={{ background: "white", color: "#111", fontWeight: 800, fontSize: "14px", padding: "12px 28px", borderRadius: "10px", border: "none", cursor: "pointer" }}>
                  Get started free →
                </button>
              </Link>
              <Link href="/features">
                <button style={{ background: "transparent", color: "#666", fontWeight: 600, fontSize: "14px", padding: "11px 24px", borderRadius: "10px", border: "1px solid #333", cursor: "pointer" }}>
                  See all features
                </button>
              </Link>
            </div>
          </div>
        </section>

      </main>
      <FooterHero />
    </div>
  );
}