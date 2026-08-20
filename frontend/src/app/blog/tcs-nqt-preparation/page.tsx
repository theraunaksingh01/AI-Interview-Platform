"use client";
import Link from "next/link";
import { motion } from "framer-motion";
import { FooterHero } from "@/app/components/Footer";

// SEO keywords: TCS NQT preparation 2026, TCS NQT syllabus, TCS NQT numerical ability,
// TCS NQT verbal reasoning, TCS NQT programming section, how to crack TCS NQT,
// TCS National Qualifier Test tips, TCS off campus drive preparation

export default function BlogPostTCSNQT() {
  return (
    <div className="min-h-screen" style={{ background: "#FFFDF0" }}>
      <main className="pt-24">
        <article className="mx-auto max-w-[720px] px-6 pb-24 pt-12">
          {/* Back */}
          <Link href="/blog" className="text-[13px] font-medium text-[#9CA3AF] hover:text-[#111] transition mb-8 inline-block">
            ← All articles
          </Link>

          {/* Category */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <span
              className="inline-block rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-widest mb-4"
              style={{ background: "#DBEAFE", color: "#1D4ED8" }}
            >
              Company Prep
            </span>

            {/* Title */}
            <h1
              className="font-black text-[#111] mb-4 leading-tight"
              style={{ fontSize: "clamp(28px, 5vw, 42px)", letterSpacing: "-1px" }}
            >
              TCS NQT 2026: The Section-Wise Preparation Guide Nobody Gives You
            </h1>

            <div className="mt-5 flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#2ba933] text-[11px] font-bold text-white">R</div>
              <div>
                <p className="text-[13px] font-semibold text-[#111]">Raunak</p>
                <p className="text-[11px] text-[#9CA3AF]">6 min read</p>
              </div>
            </div>
          </motion.div>

          {/* Divider */}
          <div className="my-8 h-px bg-[#E5E7EB]" />

          {/* Body */}
          <div className="prose-content space-y-6" style={{ fontSize: "16px", lineHeight: 1.75, color: "#374151" }}>

            <p>
              Every placement season, thousands of students walk into the TCS National Qualifier Test
              having practiced the wrong things. They grind LeetCode for weeks, only to discover the
              coding section is a small fraction of what actually decides their result. Here&apos;s what
              the TCS NQT actually tests, section by section, and where most students lose marks
              without realizing it.
            </p>

            <h2 className="font-black text-[#111]" style={{ fontSize: "24px", marginTop: "36px" }}>
              The format nobody explains clearly
            </h2>
            <p>
              TCS NQT runs as a single sitting with distinct sections — Numerical Ability, Verbal
              Ability, Reasoning Ability, and Programming Logic — each with its own time limit that
              locks independently. This is the detail that trips people up most: you cannot go back
              to a previous section once its timer ends, and you cannot borrow time from a section
              you finish early. Students who practice with untimed question banks walk in expecting
              flexibility that simply doesn&apos;t exist in the real exam.
            </p>

            <h2 className="font-black text-[#111]" style={{ fontSize: "24px", marginTop: "36px" }}>
              Numerical Ability — where most marks are actually lost
            </h2>
            <p>
              This section leans heavily on time-speed-distance, percentages, profit and loss, and
              simple/compound interest — the kind of questions you solved in Class 10 but haven&apos;t
              touched in four years of engineering. The trap isn&apos;t difficulty, it&apos;s speed. You
              need to solve these almost instinctively, not derive them from first principles under
              exam pressure. If you find yourself setting up equations from scratch during practice,
              that&apos;s a signal to drill fundamentals, not attempt harder problems.
            </p>

            <h2 className="font-black text-[#111]" style={{ fontSize: "24px", marginTop: "36px" }}>
              Verbal Ability — the section students skip practicing
            </h2>
            <p>
              Reading comprehension, para jumbles, error spotting, and sentence correction make up
              this section. Indian engineering curricula rarely emphasize English comprehension under
              time pressure, which means most candidates are weakest here precisely because they never
              practiced it. Fifteen minutes of daily reading comprehension practice in the weeks before
              your exam compounds meaningfully — this is a skill that improves fast with light,
              consistent effort.
            </p>

            <h2 className="font-black text-[#111]" style={{ fontSize: "24px", marginTop: "36px" }}>
              Reasoning Ability — pattern recognition under a clock
            </h2>
            <p>
              Seating arrangements, blood relations, coding-decoding, and syllogisms dominate here.
              The core skill isn&apos;t intelligence, it&apos;s pattern speed — recognizing the question
              type in the first five seconds and applying the right method without re-deriving it.
              Students who&apos;ve solved fifty seating arrangement questions solve the fifty-first in
              under a minute. Students who&apos;ve solved five take five minutes on the sixth.
            </p>

            <h2 className="font-black text-[#111]" style={{ fontSize: "24px", marginTop: "36px" }}>
              Programming Logic — smaller than you think, but not skippable
            </h2>
            <p>
              This section tests fundamentals — output prediction, basic data structures, simple
              algorithmic thinking — not competitive programming. If you can write correct, working
              code for arrays, strings, and basic loops in your chosen language, you&apos;re already
              ahead of a large share of test-takers who over-invested in advanced DSA and
              under-invested in getting the basics airtight.
            </p>

            <h2 className="font-black text-[#111]" style={{ fontSize: "24px", marginTop: "36px" }}>
              What actually moves your band prediction
            </h2>
            <p>
              TCS NQT results place you into readiness bands — commonly discussed as Ninja, Digital,
              and Prime tiers, each unlocking different roles and pay bands. Consistency across all
              four sections matters more than excelling in one and struggling in another. A candidate
              who scores solidly across the board typically outperforms one who aces programming but
              drops significantly in verbal or numerical.
            </p>

            <div
              className="rounded-2xl p-6 my-10"
              style={{ background: "#F0F9FF", border: "1px solid #BAE6FD" }}
            >
              <p className="font-bold text-[#111] mb-2" style={{ fontSize: "15px" }}>
                Practice under the real format
              </p>
              <p style={{ fontSize: "14px", color: "#555" }}>
                Qued&apos;s OA Practice simulates TCS NQT exactly — locked section timers, no going
                back, band prediction after every attempt. It&apos;s the closest you can get to the
                real exam without waiting for exam day.
              </p>
              <Link href="/oa-practice" className="inline-block mt-3 text-[13px] font-black text-[#0369A1] hover:underline">
                Practice TCS NQT format &rarr;
              </Link>
            </div>

            <p>
              The students who do well on TCS NQT aren&apos;t necessarily the strongest coders in
              their batch — they&apos;re the ones who practiced under realistic conditions and knew
              exactly what to expect walking in. That preparation gap is closeable in two to three
              weeks with focused, section-wise practice.
            </p>

          </div>
        </article>
      </main>
      <FooterHero />
    </div >
  );
}