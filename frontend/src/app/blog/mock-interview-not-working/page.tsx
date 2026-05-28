"use client";
import Link from "next/link";
import { motion } from "framer-motion";
import { FooterHero } from "@/app/components/Footer";

export default function MockNotWorkingPost() {
  return (
    <div className="min-h-screen" style={{ background: "#FFFDF0" }}>
      <main className="pt-24">
        <article className="mx-auto max-w-[720px] px-6 pb-24 pt-12">
          <Link href="/blog" className="text-[13px] font-medium text-[#9CA3AF] hover:text-[#111] transition mb-8 inline-block">← All articles</Link>

          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <span className="inline-block rounded-full bg-[#fee2e2] px-3 py-1 text-[11px] font-black uppercase tracking-widest text-[#991b1b] mb-4">Mock Tips</span>
            <h1 style={{ fontSize: "clamp(26px, 4vw, 42px)", fontWeight: 900, letterSpacing: "-1.5px", color: "#111", lineHeight: 1.2 }}>
              5 Signs Your Mock Interview Practice Isn't Translating to Real Results
            </h1>
            <p className="mt-4 text-[16px] text-[#6B7280] leading-relaxed">
              Doing 20 mock interviews and still freezing in real ones? The problem isn't quantity — it's how you're practising. Here's what to change.
            </p>
            <div className="mt-5 flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#991b1b] text-[11px] font-bold text-white">QD</div>
              <div>
                <p className="text-[13px] font-semibold text-[#111]">Qued Team</p>
                <p className="text-[11px] text-[#9CA3AF]">4 min read</p>
              </div>
            </div>
          </motion.div>

          <div className="my-8 h-px bg-[#E5E7EB]" />

          <div className="space-y-6 text-[15px] text-[#374151] leading-relaxed">
            <p>
              Placement season hits and you've done dozens of mock interviews — with friends, with seniors, maybe even with paid coaches. But when the real interview comes, you blank. Your answers feel flat. You say "um" constantly and don't realise it until you're driving home.
            </p>
            <p>
              The problem usually isn't that you didn't practise enough. It's that you practised in the wrong conditions.
            </p>

            <h2 style={{ fontSize: "22px", fontWeight: 800, color: "#111", marginTop: "2rem", marginBottom: "0.5rem" }}>The 5 signs</h2>

            <div className="space-y-4">
              {[
                {
                  sign: "1. You only practise with friends who are too nice",
                  body: "When your mock interviewer is your hostel roommate, they're not going to push back on a weak answer, ask follow-up questions you can't answer, or tell you that your explanation was confusing. Comfortable practice builds confidence in a false environment.",
                },
                {
                  sign: "2. You read your answers instead of speaking them",
                  body: "Writing out answers to practice questions and then reading them back to yourself is almost useless for interview prep. Interviews are spoken. The retrieval mechanism is completely different. You need to practise speaking out loud, from memory, under mild time pressure.",
                },
                {
                  sign: "3. You never review what you actually said",
                  body: "Most students practise, finish, and move on. No transcript, no recording, no review. You have no idea how many filler words you used, whether your answer was actually 2 minutes or 5, or whether you actually answered the question that was asked.",
                },
                {
                  sign: "4. You practise questions you already know well",
                  body: "It feels productive to nail questions you're comfortable with. But interviews test your weakest areas, not your strengths. If you only practise system design and avoid DSA because it's harder, you're building confidence in the wrong place.",
                },
                {
                  sign: "5. You're measuring sessions, not quality",
                  body: "'I did 10 mocks this week' is a vanity metric. Did your score improve? Did you use fewer filler words? Did your answers get more structured? Without measuring quality, more sessions just reinforces whatever habits you already have — including the bad ones.",
                },
              ].map(({ sign, body }) => (
                <div key={sign} className="rounded-xl border border-[#E5E7EB] bg-white p-5">
                  <p className="font-black text-[#111] text-[15px] mb-2">{sign}</p>
                  <p className="text-[13px] text-[#6B7280] leading-relaxed">{body}</p>
                </div>
              ))}
            </div>

            <h2 style={{ fontSize: "22px", fontWeight: 800, color: "#111", marginTop: "2rem", marginBottom: "0.5rem" }}>What effective practice actually looks like</h2>
            <p>The students who improve fastest follow a simple 3-session loop:</p>

            <div className="rounded-2xl border border-[#E5E7EB] bg-white p-5 space-y-4">
              {[
                { step: "Session 1", body: "Do the mock. Don't prepare specific answers — go in cold. Treat it like a real interview." },
                { step: "Review (same day)", body: "Read your transcript. Note every question where your answer was weak, too long, or structureless. Write down what you should have said." },
                { step: "Session 2 (next day)", body: "Do another mock on the same role/difficulty. Specifically watch for the weak spots you identified. Did you improve on them?" },
              ].map(({ step, body }) => (
                <div key={step} className="flex gap-3">
                  <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-yellow-400 text-[10px] font-black text-[#111] mt-0.5">→</div>
                  <div>
                    <p className="font-bold text-[#111] text-[14px]">{step}</p>
                    <p className="text-[13px] text-[#6B7280] mt-0.5">{body}</p>
                  </div>
                </div>
              ))}
            </div>

            <p>
              The review step is what most students skip. It's also the step that creates the most improvement. Qued's per-question report — transcript, what was missing, model answer — exists specifically to make this review fast and actionable.
            </p>

            <h2 style={{ fontSize: "22px", fontWeight: 800, color: "#111", marginTop: "2rem", marginBottom: "0.5rem" }}>One last thing</h2>
            <p>
              The goal of mock practice isn't to get comfortable with interview questions. It's to get comfortable with being uncomfortable — with not knowing the answer perfectly, with a follow-up question that catches you off guard, with the silence after you finish and the interviewer doesn't immediately respond.
            </p>
            <p>
              That discomfort is exactly what Qued's AI interviewer creates. It doesn't nod along. It asks follow-ups. It scores you honestly. That's the point.
            </p>

            <div className="rounded-2xl bg-[#111] p-6 text-center mt-8">
              <p className="text-white font-black text-[18px] mb-2">Start practising the right way.</p>
              <p className="text-[#9CA3AF] text-[13px] mb-4">Per-question breakdown, transcript review, and model answers — free for 3 sessions.</p>
              <Link href="/mock">
                <button className="rounded-xl bg-yellow-400 px-6 py-2.5 text-[13px] font-black text-[#111] hover:bg-yellow-300 transition">Start mock interview →</button>
              </Link>
            </div>
          </div>
        </article>
      </main>
      <FooterHero />
    </div>
  );
}