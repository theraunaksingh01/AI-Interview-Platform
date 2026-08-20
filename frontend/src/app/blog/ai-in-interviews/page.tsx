"use client";
import Link from "next/link";
import { FooterHero } from "@/app/components/Footer";
import { motion } from "motion/react";

// SEO keywords: AI interview preparation, how companies use AI in hiring 2026,
// AI interview screening, modern interview process changes, AI resume screening,
// technical interview trends India, AI mock interview practice

export default function BlogPostAIInterviews() {
  return (
    <div className="min-h-screen" style={{ background: "#FFFDF0" }}>
      <main className="pt-24">
        <article className="mx-auto max-w-[720px] px-6 pb-24 pt-12">
          <Link href="/blog" className="text-[13px] font-medium text-[#9CA3AF] hover:text-[#111] transition mb-8 inline-block">
            ← All articles
          </Link>

          {/* Category */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>

            <span
              className="inline-block rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-widest mb-5"
              style={{ background: "#EDE9FE", color: "#5B21B6" }}
            >
              Industry Trends
            </span>

            <h1
              className="font-black text-[#111] mb-4 leading-tight"
              style={{ fontSize: "clamp(28px, 5vw, 42px)", letterSpacing: "-1px" }}
            >
              How AI Quietly Changed the Interview Process — And What It Means for You
            </h1>

            <div className="mt-5 flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#ee3d3d] text-[11px] font-bold text-white">R</div>
              <div>
                <p className="text-[13px] font-semibold text-[#111]">Raunak</p>
                <p className="text-[11px] text-[#9CA3AF]">7 min read</p>
              </div>
            </div>
          </motion.div>

          {/* Divider */}
          <div className="my-8 h-px bg-[#E5E7EB]" />

          <div className="prose-content space-y-6" style={{ fontSize: "16px", lineHeight: 1.75, color: "#374151" }}>

            <p>
              The interview process most students prepare for is not quite the interview process
              companies actually run anymore. Over the last few years, AI has embedded itself into
              hiring at nearly every stage — often invisibly. Understanding where it shows up changes
              how you should actually prepare.
            </p>

            <h2 className="font-black text-[#111]" style={{ fontSize: "24px", marginTop: "36px" }}>
              Resume screening happens before a human ever sees it
            </h2>
            <p>
              Applicant Tracking Systems have used keyword matching for years, but the newer
              generation uses AI models to parse and rank resumes against a role description far more
              contextually — understanding that &quot;built a REST API&quot; and &quot;developed
              backend services&quot; describe similar experience, even without exact keyword overlap.
              What this means practically: a resume that&apos;s technically accurate but vague loses to
              one that names specific technologies, specific outcomes, and specific scale, because
              those are the signals the parsing model weighs most heavily.
            </p>

            <h2 className="font-black text-[#111]" style={{ fontSize: "24px", marginTop: "36px" }}>
              Online assessments increasingly detect more than correctness
            </h2>
            <p>
              Modern OA platforms — the kind used in TCS NQT, Infosys SE, and similar company
              assessments — now commonly track behavioral signals beyond your final answer: how much
              time you spent per question, whether you switched tabs, paste-detection on coding
              questions, and pattern analysis that flags answers unusually inconsistent with your
              demonstrated skill level elsewhere in the test. The exams are the same on the surface,
              but the systems evaluating your attempt are considerably more sophisticated at detecting
              irregularities than they were even three or four years ago.
            </p>

            <h2 className="font-black text-[#111]" style={{ fontSize: "24px", marginTop: "36px" }}>
              Some first-round interviews are already AI-conducted
            </h2>
            <p>
              A growing number of companies — particularly for high-volume roles — use AI-driven video
              interview platforms for an initial screening round before a human interviewer ever gets
              involved. These systems analyze your spoken answers for content, structure, and
              sometimes communication metrics like pace and filler word usage. The upside for
              candidates: unlike a human interviewer having a bad day, an AI screening round applies
              the same standard consistently to everyone. The adjustment required: you need to be
              comfortable articulating clear, complete answers to a camera with no human feedback or
              follow-up cues in the room.
            </p>

            <h2 className="font-black text-[#111]" style={{ fontSize: "24px", marginTop: "36px" }}>
              What hasn&apos;t changed — and won&apos;t
            </h2>
            <p>
              Despite all of this, the fundamentals interviewers evaluate are unchanged: can you solve
              the technical problem in front of you, can you explain your reasoning clearly, and can
              you demonstrate genuine understanding rather than memorized answers. AI has changed the
              screening mechanics — who or what evaluates you first, what signals get tracked — but it
              hasn&apos;t changed what a strong answer actually looks like.
            </p>

            <h2 className="font-black text-[#111]" style={{ fontSize: "24px", marginTop: "36px" }}>
              The practical takeaway
            </h2>
            <p>
              Preparing for interviews today means practicing in conditions that resemble how you&apos;ll
              actually be evaluated — timed assessments with no going back, questions answered aloud
              rather than just thought through silently, and genuine articulation practice rather than
              only reading model answers. Students who only prepare by reading solved problems are
              optimizing for a format that increasingly isn&apos;t how they&apos;ll be assessed.
            </p>

            <div
              className="rounded-2xl p-6 my-10"
              style={{ background: "#F5F3FF", border: "1px solid #DDD6FE" }}
            >
              <p className="font-bold text-[#111] mb-2" style={{ fontSize: "15px" }}>
                Practice the way you&apos;ll actually be evaluated
              </p>
              <p style={{ fontSize: "14px", color: "#555" }}>
                Qued&apos;s mock interviews use live voice-based AI scoring, and OA Practice simulates
                locked-timer, no-going-back assessment formats — the same conditions modern hiring
                systems actually use.
              </p>
              <Link href="/mock" className="inline-block mt-3 text-[13px] font-black text-[#5B21B6] hover:underline">
                Try a mock interview &rarr;
              </Link>
            </div>

            <p>
              None of this should be intimidating — if anything, it rewards genuine preparation over
              guesswork, because these systems are generally better at detecting real understanding
              than a rushed, distracted human interviewer sometimes is. The students who adapt fastest
              are the ones who practice under realistic conditions rather than studying in a vacuum.
            </p>

          </div>
        </article>
      </main>
      <FooterHero />
    </div>
  );
}