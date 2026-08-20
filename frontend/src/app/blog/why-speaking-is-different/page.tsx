"use client";
import Link from "next/link";
import { FooterHero } from "@/app/components/Footer";
import { motion } from "motion/react";

// SEO keywords: how to improve communication skills interview, filler words interview,
// speaking clearly in interviews, interview communication tips India,
// nervous during interview how to fix, articulate answers interview practice

export default function BlogPostCommunication() {
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
              style={{ background: "#D1FAE5", color: "#065F46" }}
            >
              Communication
            </span>

            <h1
              className="font-black text-[#111] mb-4 leading-tight"
              style={{ fontSize: "clamp(28px, 5vw, 42px)", letterSpacing: "-1px" }}
            >
              You Know the Answer. So Why Does It Fall Apart When You Say It Out Loud?
            </h1>

            <div className="mt-5 flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#c56123] text-[11px] font-bold text-white">R</div>
              <div>
                <p className="text-[13px] font-semibold text-[#111]">Raunak</p>
                <p className="text-[11px] text-[#9CA3AF]">5 min read</p>
              </div>
            </div>
          </motion.div>
          
          {/* Divider */}
          <div className="my-8 h-px bg-[#E5E7EB]" />

          <div className="prose-content space-y-6" style={{ fontSize: "16px", lineHeight: 1.75, color: "#374151" }}>

            <p>
              This is one of the most common and least discussed problems in interview prep. A student
              can explain database normalization perfectly on paper, understands it deeply enough to
              teach it — and then freezes, rambles, or trails off mid-sentence the moment an
              interviewer actually asks them to explain it out loud. The gap isn&apos;t knowledge.
              It&apos;s a completely different skill that nobody explicitly teaches: speaking
              technical content clearly under real-time pressure.
            </p>

            <h2 className="font-black text-[#111]" style={{ fontSize: "24px", marginTop: "36px" }}>
              Why this happens even to strong students
            </h2>
            <p>
              Reading and understanding a concept uses different cognitive pathways than retrieving
              and articulating it live, with someone watching and evaluating you in real time. Add
              interview nerves, and working memory gets consumed by anxiety instead of being fully
              available for structuring your answer. This is why students who write excellent answers
              in a quiet room often perform noticeably worse saying the same content aloud to another
              person — it&apos;s not a knowledge gap, it&apos;s an unpracticed skill.
            </p>

            <h2 className="font-black text-[#111]" style={{ fontSize: "24px", marginTop: "36px" }}>
              Filler words are a symptom, not the actual problem
            </h2>
            <p>
              Most advice tells you to &quot;stop saying um.&quot; That&apos;s treating the symptom.
              Filler words spike specifically when you&apos;re thinking of your next point while still
              talking — your mouth is running ahead of a fully-formed thought. The actual fix is
              structuring your answer&apos;s shape before you start speaking, even if that structuring
              takes place in the first two seconds of silence. A brief pause before answering reads as
              confidence. A stream of &quot;um, so basically, like&quot; while you figure out what
              you&apos;re trying to say reads as uncertainty — even when the underlying knowledge is
              solid.
            </p>

            <h2 className="font-black text-[#111]" style={{ fontSize: "24px", marginTop: "36px" }}>
              A structure that works under pressure
            </h2>
            <p>
              For most technical explanation questions, a simple shape holds up well: state the core
              definition in one clear sentence, give a concrete example, then add one layer of depth —
              a trade-off, an edge case, or when you&apos;d use it versus an alternative. This isn&apos;t
              about memorizing a script. It&apos;s about having a default shape to reach for so you&apos;re
              not improvising the entire structure while also trying to recall the content itself.
            </p>

            <h2 className="font-black text-[#111]" style={{ fontSize: "24px", marginTop: "36px" }}>
              Why practicing with friends often doesn&apos;t fix this
            </h2>
            <p>
              Practicing out loud with a friend helps, but has a real limitation: friends rarely give
              specific, honest feedback. &quot;That was good&quot; doesn&apos;t tell you that you used
              filler words fourteen times, or that your pace doubled the moment you got nervous around
              question three, or that you never actually answered what was asked and instead talked
              around it. Vague encouragement feels supportive but doesn&apos;t change behavior, because
              you don&apos;t know specifically what to adjust.
            </p>

            <h2 className="font-black text-[#111]" style={{ fontSize: "24px", marginTop: "36px" }}>
              What actually improves this, and how fast
            </h2>
            <p>
              This is a trainable skill with a genuinely short feedback loop. Recording yourself
              answering questions out loud — even without anyone reviewing it — surfaces problems you
              didn&apos;t know you had, simply because hearing yourself back is uncomfortable in a
              useful way. Add specific, honest feedback on pace, filler frequency, and structure, and
              most students see a real, noticeable shift within five to seven practice sessions. This
              isn&apos;t a personality trait some people have and others don&apos;t — it&apos;s closer to
              a muscle that responds quickly to targeted use.
            </p>

            <div
              className="rounded-2xl p-6 my-10"
              style={{ background: "#ECFDF5", border: "1px solid #A7F3D0" }}
            >
              <p className="font-bold text-[#111] mb-2" style={{ fontSize: "15px" }}>
                Get the specific feedback friends won&apos;t give you
              </p>
              <p style={{ fontSize: "14px", color: "#555" }}>
                Qued&apos;s mock interviews track your pace, filler word count, and silence gaps live
                while you speak — then show you exactly what to fix, not just a score.
              </p>
              <Link href="/mock" className="inline-block mt-3 text-[13px] font-black text-[#065F46] hover:underline">
                Practice speaking your answers &rarr;
              </Link>
            </div>

            <p>
              Knowing the concept was never the hard part for most students. Saying it clearly, in
              real time, while someone evaluates you — that&apos;s the actual skill interviews test, and
              it&apos;s the one almost nobody explicitly practices until it&apos;s too late to matter.
            </p>

          </div>
        </article>
      </main>
      <FooterHero />
    </div>
  );
}