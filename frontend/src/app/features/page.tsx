"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { FooterHero } from "@/app/components/Footer";

// ─── SEO meta is in a separate layout or head tag ─────────────────────────────
// Primary keywords: AI mock interview India, campus placement preparation,
// mock interview platform for engineering students, AI interview coach

const FEATURES = [
  {
    tag: "Live Coaching",
    headline: "A coach in your ear, every answer.",
    body: "While you speak, Qued tracks your words per minute, detects filler words like 'um' and 'basically', and nudges you when you've been silent too long. No more realising your bad habits after the interview.",
    stat: "14 filler words caught on average per session",
    icon: "🎯",
    color: "#FFF9C4",
    accent: "#FFD600",
  },
  {
    tag: "AI Scoring",
    headline: "Scored on 5 dimensions, not just a number.",
    body: "Technical accuracy, problem solving, communication clarity, depth of knowledge, relevance — each answer gets a breakdown. You know exactly what to improve, not just that you scored 62.",
    stat: "Calibrated for Indian campus placement level",
    icon: "✦",
    color: "#EEF2FF",
    accent: "#6366F1",
  },
  {
    tag: "Per-Question Report",
    headline: "See what you said. See what you should have said.",
    body: "Full transcript of your answer, what was missing, and a model answer — what a strong candidate would have said. The fastest way to close the gap between where you are and where you need to be.",
    stat: "Model answers included for Pro and Max plans",
    icon: "📄",
    color: "#F0FDF4",
    accent: "#22C55E",
  },
  {
    tag: "Company Prep",
    headline: "TCS is not Amazon. We know the difference.",
    body: "TCS NQT-style questions are nothing like a FAANG system design round. Qued's question bank is tagged by company and role so your prep actually matches what you'll face on the day.",
    stat: "Questions tagged: TCS, Infosys, Amazon, Microsoft, Wipro",
    icon: "🏢",
    color: "#FFF7ED",
    accent: "#F59E0B",
  },
  {
    tag: "Progress Tracking",
    headline: "Numbers that tell the truth.",
    body: "Your dashboard shows score trends over time, your best session, your average, and your improvement from first session to latest. No vanity metrics — just honest progress data.",
    stat: "Streak tracking keeps you consistent",
    icon: "📈",
    color: "#F9FAFB",
    accent: "#111111",
  },
  {
    tag: "Follow-up Questions",
    headline: "Real interviews don't stop at the first answer.",
    body: "After your answer, Qued asks follow-ups — 'Can you give an example from a project?' or 'What's the trade-off there?' Training you to handle pressure and think on your feet.",
    stat: "Contextual follow-ups based on your actual answer",
    icon: "💬",
    color: "#FDF4FF",
    accent: "#A855F7",
  },
];

const COMPARISON = [
  { feature: "Live coaching while you speak",     qued: true,  paper: false, pramp: false, interviewbit: false },
  { feature: "Per-question model answers",        qued: true,  paper: false, pramp: false, interviewbit: false },
  { feature: "Company-specific questions",        qued: true,  paper: true,  pramp: false, interviewbit: true  },
  { feature: "WPM + filler word tracking",        qued: true,  paper: false, pramp: false, interviewbit: false },
  { feature: "Instant AI feedback",               qued: true,  paper: false, pramp: true,  interviewbit: false },
  { feature: "Campus placement focus (India)",    qued: true,  paper: true,  pramp: false, interviewbit: true  },
  { feature: "Progress tracking over time",       qued: true,  paper: false, pramp: false, interviewbit: true  },
  { feature: "Available 24/7, no scheduling",     qued: true,  paper: true,  pramp: false, interviewbit: true  },
];

const FAQS = [
  {
    q: "How is Qued different from just practising with ChatGPT?",
    a: "ChatGPT gives you generic feedback on what you typed. Qued listens to your actual voice, tracks your speaking patterns in real time, scores you across 5 dimensions, and shows you a model answer for every question. It's the difference between a text editor and a flight simulator.",
  },
  {
    q: "Is this useful for TCS/Infosys campus placements?",
    a: "Yes — this is exactly who we built it for. The question bank has TCS NQT and Infosys InfyTQ-style questions. Beginner difficulty is calibrated for campus placement level, not senior engineer level.",
  },
  {
    q: "How many sessions do I need before I see improvement?",
    a: "Most students see measurable score improvement by session 3-4. The per-question coaching report after each session is the fastest accelerator — students who read it carefully improve 2x faster.",
  },
  {
    q: "Does it work for non-CS branches?",
    a: "Yes. ECE and IT students use it regularly. The behavioral and communication questions are relevant for any engineering branch. Technical questions can be filtered by role.",
  },
];

function Check({ filled }: { filled: boolean }) {
  return filled ? (
    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[#111] text-[11px] font-bold text-white">✓</span>
  ) : (
    <span className="text-[#D1D5DB] text-lg">—</span>
  );
}

export default function FeaturesPage() {
  return (
    <div className="min-h-screen overflow-x-hidden" style={{ background: "#FFFDF0" }}>
      <main className="pt-24">

        {/* ── Hero ── */}
        <section className="px-6 pb-20 pt-16 text-center">
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-1.5 shadow-sm mb-8"
          >
            <span className="flex h-4 w-4 items-center justify-center rounded-sm bg-yellow-400 text-[10px] font-black text-yellow-900">✦</span>
            <span className="text-sm font-semibold text-gray-600">Built for India's engineering students</span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="mx-auto max-w-3xl"
            style={{ fontSize: "clamp(36px, 5vw, 62px)", fontWeight: 900, letterSpacing: "-2px", lineHeight: 1.5, color: "#111" }}
          >
            Everything you need to{" "}
            <span style={{ background: "#FFD600", padding: "2px 10px", borderRadius: "6px", fontStyle: "italic" }}>
              crack placements.
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.25 }}
            className="mx-auto mt-6 max-w-xl text-[17px] leading-relaxed"
            style={{ color: "#666" }}
          >
            Not another quiz app. Qued is a full mock interview experience with live coaching, AI scoring, and model answers — all calibrated for campus placements in India.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="mt-8 flex items-center justify-center gap-3 flex-wrap"
          >
            <Link href="/signup">
              <button style={{ background: "#111", color: "white", fontWeight: 700, fontSize: "14px", padding: "12px 28px", borderRadius: "10px", border: "none", cursor: "pointer" }}>
                Start for free →
              </button>
            </Link>
            <Link href="/pricing">
              <button style={{ background: "white", color: "#111", fontWeight: 600, fontSize: "14px", padding: "11px 24px", borderRadius: "10px", border: "1.5px solid #ddd", cursor: "pointer" }}>
                See pricing
              </button>
            </Link>
          </motion.div>
        </section>

        {/* ── Feature grid ── */}
        <section className="mx-auto max-w-6xl px-6 pb-24">
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f, i) => (
              <motion.div
                key={f.tag}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.07 }}
                className="rounded-2xl border border-gray-200 bg-white p-6 hover:shadow-md transition-shadow"
              >
                <div
                  className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl text-xl"
                  style={{ background: f.color }}
                >
                  {f.icon}
                </div>
                <span
                  className="mb-2 inline-block rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-widest"
                  style={{ background: f.color, color: f.accent }}
                >
                  {f.tag}
                </span>
                <h3 className="mt-2 text-[18px] font-black leading-snug text-[#111]">
                  {f.headline}
                </h3>
                <p className="mt-2 text-[13px] leading-relaxed text-[#6B7280]">
                  {f.body}
                </p>
                <div className="mt-4 rounded-xl border border-dashed border-gray-200 px-3 py-2">
                  <p className="text-[11px] font-bold text-[#9CA3AF]">{f.stat}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </section>

        {/* ── How it works ── */}
        <section className="border-t border-gray-200 bg-white px-6 py-24">
          <div className="mx-auto max-w-5xl">
            <div className="mb-14 text-center">
              <p className="text-[11px] font-black uppercase tracking-widest text-[#9CA3AF] mb-3">How it works</p>
              <h2 style={{ fontSize: "clamp(28px, 4vw, 44px)", fontWeight: 900, letterSpacing: "-1.5px", color: "#111" }}>
                From zero to{" "}
                <span style={{ background: "#FFD600", padding: "1px 8px", borderRadius: "5px", fontStyle: "italic" }}>placement-ready</span>
                {" "}in 4 steps.
              </h2>
            </div>

            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { step: "01", title: "Pick your role", body: "Choose Backend, Frontend, AI, or System Design. Pick your target company. Set difficulty.", icon: "🎯" },
                { step: "02", title: "Do the interview", body: "Answer questions out loud. Qued coaches you in real time — pace, fillers, silence.", icon: "🎙️" },
                { step: "03", title: "Get your report", body: "Per-question breakdown, model answers, your transcript, what was missing.", icon: "📊" },
                { step: "04", title: "Repeat and improve", body: "Track your score trend. The dashboard shows exactly where you're improving.", icon: "📈" },
              ].map((s, i) => (
                <motion.div
                  key={s.step}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: i * 0.1 }}
                  className="rounded-2xl border border-gray-100 bg-[#F9FAFB] p-6"
                >
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-[28px]">{s.icon}</span>
                    <span className="text-[32px] font-black text-[#E5E7EB]">{s.step}</span>
                  </div>
                  <h3 className="text-[16px] font-black text-[#111] mb-2">{s.title}</h3>
                  <p className="text-[13px] text-[#6B7280] leading-relaxed">{s.body}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Comparison table ── */}
        <section className="px-6 py-24" style={{ background: "#FFFDF0" }}>
          <div className="mx-auto max-w-4xl">
            <div className="mb-12 text-center">
              <p className="text-[11px] font-black uppercase tracking-widest text-[#9CA3AF] mb-3">Comparison</p>
              <h2 style={{ fontSize: "clamp(26px, 4vw, 42px)", fontWeight: 900, letterSpacing: "-1.5px", color: "#111" }}>
                Why not just practise on paper?
              </h2>
              <p className="mt-3 text-[15px] text-[#6B7280] mx-auto max-w-lg">
                Here's what Qued does that other approaches can't.
              </p>
            </div>

            <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr>
                    <th className="border-b border-gray-100 bg-[#F9FAFB] px-5 py-4 text-left text-[12px] font-bold text-[#374151]">Feature</th>
                    <th className="border-b border-gray-100 bg-[#111] px-4 py-4 text-center text-[12px] font-black text-white">Qued</th>
                    <th className="border-b border-gray-100 px-4 py-4 text-center text-[11px] font-bold text-[#9CA3AF]">On paper</th>
                    <th className="border-b border-gray-100 px-4 py-4 text-center text-[11px] font-bold text-[#9CA3AF]">Pramp</th>
                    <th className="border-b border-gray-100 px-4 py-4 text-center text-[11px] font-bold text-[#9CA3AF]">InterviewBit</th>
                  </tr>
                </thead>
                <tbody>
                  {COMPARISON.map((row, i) => (
                    <tr key={row.feature} className={`border-t border-gray-50 ${i % 2 === 0 ? "" : "bg-[#FAFAFA]"}`}>
                      <td className="px-5 py-3.5 text-[13px] text-[#374151]">{row.feature}</td>
                      <td className="px-4 py-3.5 text-center bg-[#111]/[0.02]"><Check filled={row.qued} /></td>
                      <td className="px-4 py-3.5 text-center"><Check filled={row.paper} /></td>
                      <td className="px-4 py-3.5 text-center"><Check filled={row.pramp} /></td>
                      <td className="px-4 py-3.5 text-center"><Check filled={row.interviewbit} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* ── FAQ ── */}
        <section className="border-t border-gray-200 bg-white px-6 py-24">
          <div className="mx-auto max-w-3xl">
            <div className="mb-12 text-center">
              <p className="text-[11px] font-black uppercase tracking-widest text-[#9CA3AF] mb-3">FAQ</p>
              <h2 style={{ fontSize: "clamp(26px, 4vw, 40px)", fontWeight: 900, letterSpacing: "-1.5px", color: "#111" }}>
                Questions students ask us.
              </h2>
            </div>
            <div className="space-y-4">
              {FAQS.map((faq, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 12 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: i * 0.08 }}
                  className="rounded-2xl border border-gray-100 bg-[#F9FAFB] p-6"
                >
                  <h3 className="text-[15px] font-bold text-[#111] mb-2">{faq.q}</h3>
                  <p className="text-[13px] text-[#6B7280] leading-relaxed">{faq.a}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ── CTA ── */}
        <section className="px-6 py-24" style={{ background: "#111" }}>
          <div className="mx-auto max-w-2xl text-center">
            <h2 style={{ fontSize: "clamp(30px, 5vw, 52px)", fontWeight: 900, letterSpacing: "-2px", color: "white", lineHeight: 1.5 }}>
              Your next interview is{" "}
              <span style={{ background: "#FFD600", color: "#111", padding: "2px 10px", borderRadius: "6px", fontStyle: "italic" }}>
                closer than you think.
              </span>
            </h2>
            <p className="mt-5 text-[15px] text-[#666] mx-auto max-w-md">
              3 free sessions. No card required. Start in 60 seconds.
            </p>
            <Link href="/signup">
              <button className="mt-8 rounded-xl bg-white px-8 py-3.5 text-[15px] font-black text-[#111] hover:bg-gray-100 transition">
                Start practising free →
              </button>
            </Link>
          </div>
        </section>

      </main>
      <FooterHero />
    </div>
  );
}