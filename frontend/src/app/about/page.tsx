"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { FooterHero } from "@/app/components/Footer";

const TEAM = [
  {
    name: "Raunak",
    role: "Founder & Builder",
    bio: "Final-year CS student who got tired of generic mock interview tools that don't understand Indian campus placements.",
    initial: "R",
    color: "#FFD600",
  },
];

const MILESTONES = [
  { year: "2024", event: "Started building after failing 3 campus interviews despite knowing the answers" },
  { year: "Early 2025", event: "First version with voice scoring and live coaching overlay" },
  { year: "Mid 2025", event: "Added company-specific question bank and per-question model answers" },
  { year: "2026", event: "Launched publicly — 3 free sessions for every engineering student in India" },
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
    body: "A student who scores 35 in session 1 and 68 in session 5 is doing better than one who scores 70 every time and never improves.",
  },
  {
    icon: "🔓",
    title: "No paywalls on the essentials",
    body: "Score, transcript, what was missing — free forever. We monetise model answers and unlimited sessions, not the core feedback.",
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
              About us
            </motion.p>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              style={{ fontSize: "clamp(36px, 6vw, 68px)", fontWeight: 900, letterSpacing: "-2.5px", lineHeight: 1.3, color: "#111" }}
            >
              Built by a student,
              <br />
              for{" "}
              <span style={{ background: "#FFD600", padding: "2px 12px", borderRadius: "6px", fontStyle: "italic" }}>
                students.
              </span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.25 }}
              className="mt-6 max-w-2xl text-[17px] leading-relaxed"
              style={{ color: "#666" }}
            >
              Qued started because the existing mock interview tools were built for US tech companies, not Indian campus placements. We're fixing that — one session at a time.
            </motion.p>

            {/* Stats strip */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.4 }}
              className="mt-10 flex flex-wrap gap-8"
            >
              {[
                { value: "3", label: "Free sessions every month" },
                { value: "6+", label: "Roles supported" },
                { value: "India", label: "First and only focus" },
                { value: "₹149", label: "Pro plan — no VC money needed" },
              ].map(({ value, label }) => (
                <div key={label}>
                  <p className="text-[32px] font-black text-[#111] leading-none">{value}</p>
                  <p className="text-[12px] text-[#9CA3AF] mt-1">{label}</p>
                </div>
              ))}
            </motion.div>
          </div>
        </section>

        {/* ── 2. The story ── */}
        <section className="border-t border-gray-200 bg-white px-6 py-24">
          <div className="mx-auto max-w-5xl grid grid-cols-1 gap-12 lg:grid-cols-2 lg:items-center">
            <motion.div
              initial={{ opacity: 0, x: -24 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              <p className="text-[11px] font-black uppercase tracking-widest text-[#9CA3AF] mb-4">Our story</p>
              <h2 style={{ fontSize: "clamp(26px, 4vw, 40px)", fontWeight: 900, letterSpacing: "-1.5px", color: "#111", lineHeight: 1.3 }}>
                How it started,
                <br />your journey,
                <br />and our{" "}
                <span style={{ background: "#FFD600", padding: "1px 8px", borderRadius: "5px", fontStyle: "italic" }}>milestones.</span>
              </h2>
              <p className="mt-5 text-[15px] leading-relaxed text-[#6B7280]">
                Qued was born from a specific frustration: knowing the answer to a question but completely freezing when asked to explain it out loud. Standard prep — reading textbooks, solving LeetCode — doesn't train you to speak under pressure.
              </p>
              <p className="mt-4 text-[15px] leading-relaxed text-[#6B7280]">
                We built the tool we wish we'd had during our own placements. Voice-first, India-first, honest about where you stand.
              </p>
            </motion.div>

            {/* Timeline */}
            <motion.div
              initial={{ opacity: 0, x: 24 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="space-y-4"
            >
              {MILESTONES.map((m, i) => (
                <div key={i} className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-yellow-400 text-[10px] font-black text-[#111]">
                      {i + 1}
                    </div>
                    {i < MILESTONES.length - 1 && (
                      <div className="mt-1 w-px flex-1 bg-gray-200" style={{ minHeight: "24px" }} />
                    )}
                  </div>
                  <div className="pb-4">
                    <p className="text-[11px] font-black uppercase tracking-widest text-[#9CA3AF] mb-1">{m.year}</p>
                    <p className="text-[14px] text-[#374151] leading-relaxed">{m.event}</p>
                  </div>
                </div>
              ))}
            </motion.div>
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

        {/* ── 4. Team ── */}
        <section className="border-t border-gray-200 bg-white px-6 py-24">
          <div className="mx-auto max-w-5xl">
            <div className="mb-12">
              <p className="text-[11px] font-black uppercase tracking-widest text-[#9CA3AF] mb-3">The team</p>
              <h2 style={{ fontSize: "clamp(26px, 4vw, 42px)", fontWeight: 900, letterSpacing: "-1.5px", color: "#111" }}>
                The people behind{" "}
                <span style={{ background: "#FFD600", padding: "1px 8px", borderRadius: "5px", fontStyle: "italic" }}>Qued.</span>
              </h2>
              <p className="mt-3 text-[15px] text-[#6B7280] max-w-lg">
                Small team, big vision. We're engineering students building the tool we needed.
              </p>
            </div>

            <div className="flex flex-wrap gap-5">
              {TEAM.map((member, i) => (
                <motion.div
                  key={member.name}
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: i * 0.1 }}
                  className="rounded-2xl border border-gray-200 bg-[#F9FAFB] p-6 w-full sm:w-[280px]"
                >
                  <div
                    className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl text-[22px] font-black text-[#111]"
                    style={{ background: member.color }}
                  >
                    {member.initial}
                  </div>
                  <h3 className="text-[16px] font-black text-[#111]">{member.name}</h3>
                  <p className="text-[12px] font-bold text-[#9CA3AF] mb-2">{member.role}</p>
                  <p className="text-[13px] text-[#6B7280] leading-relaxed">{member.bio}</p>
                </motion.div>
              ))}

              {/* Join us card */}
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: 0.1 }}
                className="rounded-2xl border-2 border-dashed border-gray-200 p-6 w-full sm:w-[280px] flex flex-col items-center justify-center text-center"
              >
                <span className="text-[32px] mb-3">👋</span>
                <h3 className="text-[15px] font-black text-[#111] mb-1">Want to join?</h3>
                <p className="text-[12px] text-[#9CA3AF] mb-4">We're a small team looking for designers, engineers, and content writers who care about student outcomes.</p>
                <a
                  href="mailto:hello@qued.in"
                  className="rounded-xl bg-[#111] px-4 py-2 text-[12px] font-bold text-white hover:bg-[#333] transition"
                >
                  Reach out →
                </a>
              </motion.div>
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