"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { FooterHero } from "@/app/components/Footer";

const FEATURES = [
  {
    tag: "Live Coaching",
    headline: "A coach in your ear, every answer.",
    body: "While you speak, Qued tracks your words per minute, detects filler words like 'um' and 'basically', and nudges you when you've been silent too long. No more realising your bad habits after the interview.",
    stat: "Real-time pace and filler tracking",
    icon: "🎯",
    color: "#FFF9C4",
    accent: "#7A6000",
    visual: (
      <div className="flex items-end gap-1 mt-4 h-9">
        {[6, 14, 22, 12, 18, 26, 10, 16, 20, 8, 14, 22].map((h, i) => (
          <div key={i} style={{ width: "5px", height: `${h}px`, background: "#FFD600", borderRadius: "3px", opacity: 0.5 + (i % 3) * 0.2 }} />
        ))}
      </div>
    ),
  },
  {
    tag: "AI Scoring",
    headline: "Scored on what matters, not just a number.",
    body: "Technical accuracy, communication clarity, completeness — each answer gets a breakdown. You know exactly what to improve, not just that you scored 62.",
    stat: "Calibrated for Indian campus placement level",
    icon: "✦",
    color: "#EEF2FF",
    accent: "#4338CA",
    visual: (
      <div className="mt-4 flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#111] text-[14px] font-black text-white">62</div>
        <div className="flex-1 space-y-1.5">
          {[70, 55, 80].map((v, i) => (
            <div key={i} className="h-1.5 rounded-full bg-[#E0E7FF] overflow-hidden">
              <div className="h-full rounded-full bg-[#6366F1]" style={{ width: `${v}%` }} />
            </div>
          ))}
        </div>
      </div>
    ),
  },
  {
    tag: "Per-Question Report",
    headline: "See what you said. See what you should have said.",
    body: "Full transcript of your answer, what was missing, and a model answer — what a strong candidate would have said. The fastest way to close the gap.",
    stat: "Model answers included on Pro and Max",
    icon: "📄",
    color: "#F0FDF4",
    accent: "#166534",
    visual: (
      <div className="mt-4 rounded-lg bg-white border border-[#DCFCE7] px-3 py-2.5">
        <p className="text-[10px] font-black text-emerald-700 mb-1">💡 MODEL ANSWER</p>
        <p className="text-[11px] text-[#6B7280] leading-snug">"First, I'd clarify the constraints, then walk through..."</p>
      </div>
    ),
  },
  {
    tag: "Company Prep",
    headline: "TCS is not Amazon. We know the difference.",
    body: "TCS NQT-style questions are nothing like a FAANG system design round. Qued's question bank is tagged by company and role so your prep actually matches what you'll face on the day.",
    stat: "Tagged: TCS, Infosys, Amazon, Microsoft, Wipro",
    icon: "🏢",
    color: "#FFF7ED",
    accent: "#9A3412",
    visual: (
      <div className="flex flex-wrap gap-1.5 mt-4">
        {["TCS", "Amazon", "Microsoft", "Infosys"].map((c) => (
          <span key={c} className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-white border border-[#FED7AA] text-[#9A3412]">
            {c}
          </span>
        ))}
      </div>
    ),
  },
  {
    tag: "Progress Tracking",
    headline: "Numbers that tell the truth.",
    body: "Your dashboard shows score trends over time, your best session, your average, and your improvement from first session to latest. No vanity metrics — just honest progress data.",
    stat: "Streak tracking keeps you consistent",
    icon: "📈",
    color: "#F9FAFB",
    accent: "#111111",
    visual: (
      <svg viewBox="0 0 120 32" className="mt-4 w-full h-8">
        <polyline points="0,28 20,22 40,24 60,14 80,16 100,6 120,4" fill="none" stroke="#111" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    tag: "Follow-up Questions",
    headline: "Real interviews don't stop at the first answer.",
    body: "After your answer, Qued asks follow-ups — 'Can you give an example from a project?' or 'What's the trade-off there?' Training you to handle pressure and think on your feet.",
    stat: "Contextual, based on your actual answer",
    icon: "💬",
    color: "#FDF4FF",
    accent: "#7E22CE",
    visual: (
      <div className="mt-4 space-y-1.5">
        <div className="rounded-lg bg-white border border-[#F3E8FF] px-3 py-1.5 text-[10px] text-[#6B7280]">"Can you give an example?"</div>
        <div className="rounded-lg bg-[#F3E8FF] px-3 py-1.5 text-[10px] text-[#7E22CE] font-bold ml-4">Follow-up #2</div>
      </div>
    ),
  },
];

const COMPARISON = [
  { feature: "Live coaching while you speak",     qued: true,  paper: false, generic: false },
  { feature: "Per-question model answers",        qued: true,  paper: false, generic: false },
  { feature: "Company-specific questions",        qued: true,  paper: true,  generic: false },
  { feature: "WPM + filler word tracking",        qued: true,  paper: false, generic: false },
  { feature: "Instant AI feedback",               qued: true,  paper: false, generic: true  },
  { feature: "Campus placement focus (India)",    qued: true,  paper: true,  generic: false },
  { feature: "Progress tracking over time",       qued: true,  paper: false, generic: false },
  { feature: "Available 24/7, no scheduling",     qued: true,  paper: true,  generic: true  },
];

const FAQS = [
  {
    q: "How is Qued different from just practising with ChatGPT?",
    a: "ChatGPT gives you generic feedback on what you typed. Qued listens to your actual voice, tracks your speaking patterns in real time, scores your answers across multiple dimensions, and shows you a model answer for every question. It's the difference between a text editor and a flight simulator.",
  },
  {
    q: "Is this useful for TCS/Infosys campus placements?",
    a: "Yes — this is exactly who we built it for. The question bank includes TCS NQT and Infosys InfyTQ-style questions. Difficulty is calibrated for campus placement level, not senior engineer level.",
  },
  {
    q: "How many sessions do I need before I see improvement?",
    a: "It varies by student, but the per-question coaching report after each session is the fastest accelerator — students who read it carefully and act on the one specific fix tend to improve fastest.",
  },
  {
    q: "Does it work for non-CS branches?",
    a: "Yes. ECE and IT students use it too. The behavioral and communication questions are relevant for any engineering branch, and technical questions can be filtered by role.",
  },
  {
    q: "What languages can I use for DSA practice?",
    a: "Python, Java, and C++. Pick whichever you're most comfortable with — the scoring and test cases work the same across all three.",
  },
  {
    q: "Do I need to pay to see my score?",
    a: "No. Score, transcript, and what was missing are free forever on every plan. Paid plans unlock model answers, unlimited sessions, company-specific prep, and the Skill Passport.",
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

        {/* ── Feature grid — redesigned cards ── */}
        <section className="mx-auto max-w-6xl px-6 pb-24">
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f, i) => (
              <motion.div
                key={f.tag}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.07 }}
                whileHover={{ y: -5, transition: { duration: 0.18 } }}
                className="relative flex flex-col overflow-hidden rounded-2xl bg-white"
                style={{ border: "1px solid #ECECE4", boxShadow: "0 1px 2px rgba(0,0,0,0.03)" }}
              >
                {/* Top accent strip */}
                <div style={{ height: "4px", width: "100%", background: f.accent, opacity: 0.85 }} />

                <div className="p-6 flex flex-col flex-1">
                  <div className="flex items-center justify-between mb-4">
                    <div
                      className="flex h-11 w-11 items-center justify-center rounded-xl text-xl"
                      style={{ background: f.color }}
                    >
                      {f.icon}
                    </div>
                    <span
                      className="inline-block rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-widest"
                      style={{ background: f.color, color: f.accent }}
                    >
                      {f.tag}
                    </span>
                  </div>

                  <h3 className="text-[18px] font-black leading-snug text-[#111]">
                    {f.headline}
                  </h3>
                  <p className="mt-2 text-[13px] leading-relaxed text-[#6B7280] flex-1">
                    {f.body}
                  </p>

                  {/* Real visual instead of dashed-border stat box */}
                  {f.visual}

                  <div className="mt-4 pt-3 border-t border-[#F0F0EB]">
                    <p className="text-[11px] font-bold text-[#9CA3AF]">{f.stat}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </section>

        {/* ── What the AI actually checks ── */}
        <section className="border-t border-gray-200 bg-white px-6 py-24">
          <div className="mx-auto max-w-5xl">
            <div className="mb-14 text-center">
              <p className="text-[11px] font-black uppercase tracking-widest text-[#9CA3AF] mb-3">Under the hood</p>
              <h2 style={{ fontSize: "clamp(28px, 4vw, 44px)", fontWeight: 900, letterSpacing: "-1.5px", color: "#111" }}>
                What the AI is actually{" "}
                <span style={{ background: "#FFD600", padding: "1px 8px", borderRadius: "5px", fontStyle: "italic" }}>listening for.</span>
              </h2>
              <p className="mt-3 text-[15px] text-[#6B7280] mx-auto max-w-lg">
                Not a black box. Here's exactly what gets evaluated every time you answer.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              {[
                {
                  icon: "🗣️",
                  title: "Did you actually answer the question?",
                  body: "Qued checks if your response addresses what was asked, not just whether you said something fluent-sounding. Rambling around the topic without answering it gets flagged.",
                },
                {
                  icon: "🔍",
                  title: "Did you go deep, or stay surface-level?",
                  body: "Naming the right concept isn't enough. Qued checks whether you explained the why and how — the part interviewers actually probe on follow-up.",
                },
                {
                  icon: "⏱️",
                  title: "How you said it, not just what you said",
                  body: "Speaking pace, filler word frequency, and long silences are tracked live. These are the habits you can't see in yourself until someone points them out.",
                },
                {
                  icon: "🎯",
                  title: "Does it match what this company actually asks?",
                  body: "Your answer is evaluated against the pattern of that specific company's interview style — a TCS-style answer and an Amazon-style answer aren't scored the same way.",
                },
              ].map((item, i) => (
                <motion.div
                  key={item.title}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: i * 0.1 }}
                  className="rounded-2xl border border-gray-100 bg-[#F9FAFB] p-6"
                >
                  <span className="text-[26px] block mb-3">{item.icon}</span>
                  <h3 className="text-[15px] font-black text-[#111] mb-2 leading-snug">{item.title}</h3>
                  <p className="text-[13px] text-[#6B7280] leading-relaxed">{item.body}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Comparison table — generic categories, no named competitors ── */}
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
                    <th className="border-b border-gray-100 px-4 py-4 text-center text-[11px] font-bold text-[#9CA3AF]">Generic prep tools</th>
                  </tr>
                </thead>
                <tbody>
                  {COMPARISON.map((row, i) => (
                    <tr key={row.feature} className={`border-t border-gray-50 ${i % 2 === 0 ? "" : "bg-[#FAFAFA]"}`}>
                      <td className="px-5 py-3.5 text-[13px] text-[#374151]">{row.feature}</td>
                      <td className="px-4 py-3.5 text-center bg-[#111]/[0.02]"><Check filled={row.qued} /></td>
                      <td className="px-4 py-3.5 text-center"><Check filled={row.paper} /></td>
                      <td className="px-4 py-3.5 text-center"><Check filled={row.generic} /></td>
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