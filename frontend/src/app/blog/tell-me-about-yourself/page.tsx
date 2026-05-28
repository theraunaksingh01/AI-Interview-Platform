"use client";
import Link from "next/link";
import { motion } from "framer-motion";
import { FooterHero } from "@/app/components/Footer";

// SEO keywords: tell me about yourself interview answer, how to introduce yourself interview,
// campus placement self introduction, tell me about yourself engineering student India

export default function BlogPost1() {
  return (
    <div className="min-h-screen" style={{ background: "#FFFDF0" }}>
      <main className="pt-24">
        <article className="mx-auto max-w-[720px] px-6 pb-24 pt-12">

          {/* Back */}
          <Link href="/blog" className="text-[13px] font-medium text-[#9CA3AF] hover:text-[#111] transition mb-8 inline-block">
            ← All articles
          </Link>

          {/* Header */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <span className="inline-block rounded-full bg-[#d1fae5] px-3 py-1 text-[11px] font-black uppercase tracking-widest text-[#065f46] mb-4">
              Interview Strategy
            </span>
            <h1 style={{ fontSize: "clamp(26px, 4vw, 42px)", fontWeight: 900, letterSpacing: "-1.5px", color: "#111", lineHeight: 1.2 }}>
              How to Answer "Tell Me About Yourself" Without Sounding Scripted
            </h1>
            <p className="mt-4 text-[16px] text-[#6B7280] leading-relaxed">
              Most candidates rehearse this answer until it sounds robotic. Here's a framework to structure it naturally — and why the first 30 seconds determine the interviewer's entire perception of you.
            </p>
            <div className="mt-5 flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#4f46e5] text-[11px] font-bold text-white">AM</div>
              <div>
                <p className="text-[13px] font-semibold text-[#111]">Aryan Mehta</p>
                <p className="text-[11px] text-[#9CA3AF]">Ex-Google SDE · 6 min read</p>
              </div>
            </div>
          </motion.div>

          {/* Divider */}
          <div className="my-8 h-px bg-[#E5E7EB]" />

          {/* Content */}
          <div className="prose-custom space-y-6 text-[15px] text-[#374151] leading-relaxed">

            <p>
              "Tell me about yourself" is the most common interview question in India — and the most wasted opportunity. Most candidates either recite their resume chronologically or deliver a memorised paragraph that sounds like it was written by their placement officer.
            </p>

            <p>
              Neither works. Here's why, and what to do instead.
            </p>

            <h2 style={{ fontSize: "22px", fontWeight: 800, color: "#111", marginTop: "2rem", marginBottom: "0.5rem" }}>
              Why rehearsed answers fail
            </h2>
            <p>
              Interviewers at TCS, Infosys, and every product company have heard thousands of these answers. When yours sounds rehearsed, two things happen: they stop listening, and they assume the rest of your answers will be equally generic.
            </p>
            <p>
              The first 30 seconds of your self-introduction sets the interviewer's mental frame for everything that follows. If you start strong, they look for evidence to confirm you're good. If you start weak, they look for confirmation you're not ready.
            </p>

            <h2 style={{ fontSize: "22px", fontWeight: 800, color: "#111", marginTop: "2rem", marginBottom: "0.5rem" }}>
              The 3-part framework that actually works
            </h2>
            <p>Structure your answer in three beats — each 15-20 seconds long:</p>

            <div className="rounded-2xl border border-[#E5E7EB] bg-white p-5 space-y-4">
              {[
                { num: "1", title: "Who you are right now", body: "Current year, branch, college. One sentence. Don't over-explain your college's ranking — they can see your resume." },
                { num: "2", title: "What you've actually built or done", body: "One specific project or experience. Not 'I did an internship at X' — 'I built a REST API that handled 10k requests/day at X'. The specificity signals competence." },
                { num: "3", title: "Why this role / company", body: "One sentence connecting your experience to what they do. This shows you're not just applying everywhere — you thought about this." },
              ].map(({ num, title, body }) => (
                <div key={num} className="flex gap-3">
                  <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-yellow-400 text-[11px] font-black text-[#111] mt-0.5">{num}</div>
                  <div>
                    <p className="font-bold text-[#111] text-[14px]">{title}</p>
                    <p className="text-[13px] text-[#6B7280] mt-0.5">{body}</p>
                  </div>
                </div>
              ))}
            </div>

            <h2 style={{ fontSize: "22px", fontWeight: 800, color: "#111", marginTop: "2rem", marginBottom: "0.5rem" }}>
              Example: campus placement (TCS/Infosys)
            </h2>
            <div className="rounded-2xl bg-[#F9FAFB] border border-[#F3F4F6] p-5 italic text-[14px] text-[#374151]">
              "I'm a final-year CS student at NIT Trichy. Over the past year I built a full-stack attendance system used by 2,000 students in my college — it handles real-time updates using WebSockets and a PostgreSQL backend. I'm applying to TCS because I want to work on large-scale systems where reliability matters, and the Digital product division aligns directly with what I've been building."
            </div>
            <p className="text-[13px] text-[#9CA3AF]">~45 seconds. Specific. Confident. Not memorised-sounding.</p>

            <h2 style={{ fontSize: "22px", fontWeight: 800, color: "#111", marginTop: "2rem", marginBottom: "0.5rem" }}>
              The one mistake that kills good answers
            </h2>
            <p>
              Ending with "...so that's basically about me." This signals you're done talking and puts pressure on the interviewer to carry the conversation. Instead, end with a forward-looking statement or a question: <em>"I'm excited to learn more about the team structure here."</em>
            </p>
            <p>
              It's a small thing that keeps the conversation momentum going in your favour.
            </p>

            <h2 style={{ fontSize: "22px", fontWeight: 800, color: "#111", marginTop: "2rem", marginBottom: "0.5rem" }}>
              How to practise this without it sounding rehearsed
            </h2>
            <p>
              The irony is that you need to practise to not sound like you're practising. The goal isn't memorisation — it's internalising the structure so you can deliver it differently each time while hitting the same three points.
            </p>
            <p>
              Record yourself on your phone. Listen back. If you cringe at how scripted it sounds, that's the version the interviewer is hearing too. Practise until it sounds like a conversation, not a speech.
            </p>
            <p>
              Qued's mock interview mode gives you live feedback on your WPM and filler words while you answer — which is exactly where self-introductions go wrong. Students who practise this specific question 4-5 times on Qued typically cut their filler word count by 60%.
            </p>

            {/* CTA */}
            <div className="rounded-2xl bg-[#111] p-6 text-center mt-8">
              <p className="text-white font-black text-[18px] mb-2">Practise your self-introduction right now.</p>
              <p className="text-[#9CA3AF] text-[13px] mb-4">Get real-time feedback on pace, fillers, and clarity. Free.</p>
              <Link href="/mock">
                <button className="rounded-xl bg-yellow-400 px-6 py-2.5 text-[13px] font-black text-[#111] hover:bg-yellow-300 transition">
                  Start mock interview →
                </button>
              </Link>
            </div>
          </div>
        </article>
      </main>
      <FooterHero />
    </div>
  );
}