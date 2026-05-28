"use client";
import Link from "next/link";
import { motion } from "framer-motion";
import { FooterHero } from "@/app/components/Footer";

export default function StarMethodPost() {
  return (
    <div className="min-h-screen" style={{ background: "#FFFDF0" }}>
      <main className="pt-24">
        <article className="mx-auto max-w-[720px] px-6 pb-24 pt-12">
          <Link href="/blog" className="text-[13px] font-medium text-[#9CA3AF] hover:text-[#111] transition mb-8 inline-block">← All articles</Link>

          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <span className="inline-block rounded-full bg-[#fef3c7] px-3 py-1 text-[11px] font-black uppercase tracking-widest text-[#92400e] mb-4">Behavioural</span>
            <h1 style={{ fontSize: "clamp(26px, 4vw, 42px)", fontWeight: 900, letterSpacing: "-1.5px", color: "#111", lineHeight: 1.2 }}>
              The STAR Method Is Overrated. Here's What Actually Works.
            </h1>
            <p className="mt-4 text-[16px] text-[#6B7280] leading-relaxed">
              STAR is a starting point, not a formula. Interviewers can tell when you're reciting a template. Here's how to answer behavioural questions in a way that actually sounds human.
            </p>
            <div className="mt-5 flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#92400e] text-[11px] font-bold text-white">QD</div>
              <div>
                <p className="text-[13px] font-semibold text-[#111]">Qued Team</p>
                <p className="text-[11px] text-[#9CA3AF]">5 min read</p>
              </div>
            </div>
          </motion.div>

          <div className="my-8 h-px bg-[#E5E7EB]" />

          <div className="space-y-6 text-[15px] text-[#374151] leading-relaxed">
            <p>
              Every placement cell in India teaches STAR. Situation, Task, Action, Result. It's drilled into students as the universal formula for behavioural interviews. And it's made a generation of candidates sound identical.
            </p>
            <p>
              That doesn't mean STAR is wrong — it means most people use it wrong.
            </p>

            <h2 style={{ fontSize: "22px", fontWeight: 800, color: "#111", marginTop: "2rem", marginBottom: "0.5rem" }}>What STAR gets right</h2>
            <p>
              STAR exists because unstructured answers are worse. Without a framework, most people either ramble for 3 minutes or give a 10-second non-answer. STAR forces structure, which is genuinely useful when you're nervous.
            </p>
            <p>
              The problem is that when everyone uses the same template, it stops being a signal of competence and starts being a noise pattern. Experienced interviewers — especially at Amazon, which created the Leadership Principles behavioural format — have heard thousands of STAR answers and can immediately tell which ones are genuine and which ones are recited.
            </p>

            <h2 style={{ fontSize: "22px", fontWeight: 800, color: "#111", marginTop: "2rem", marginBottom: "0.5rem" }}>The real problem: STAR makes answers sound like bullet points</h2>
            <p>
              A textbook STAR answer sounds like this: "The situation was X. My task was Y. The action I took was Z. The result was A." It's grammatically correct and completely devoid of personality.
            </p>
            <p>
              What interviewers are actually looking for in behavioural questions: how you think, how you handle pressure, what you value, and whether you take ownership. None of that comes through in a bullet-point recitation.
            </p>

            <h2 style={{ fontSize: "22px", fontWeight: 800, color: "#111", marginTop: "2rem", marginBottom: "0.5rem" }}>Try CARE instead</h2>
            <div className="rounded-2xl border border-[#E5E7EB] bg-white p-5 space-y-4">
              {[
                { letter: "C", label: "Context", body: "Set the scene briefly — enough for the interviewer to understand the stakes. Don't over-explain." },
                { letter: "A", label: "Action", body: "What did you specifically do? Use 'I', not 'we'. Interviewers want to know your contribution, not the team's." },
                { letter: "R", label: "Result", body: "Quantify if possible. 'The bug was fixed' is weak. 'We reduced load time by 40%, which stopped the client from churning' is strong." },
                { letter: "E", label: "Effect", body: "What did you learn? What would you do differently? This is what separates candidates who grew from ones who just got lucky." },
              ].map(({ letter, label, body }) => (
                <div key={letter} className="flex gap-3">
                  <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-yellow-400 text-[13px] font-black text-[#111]">{letter}</div>
                  <div>
                    <p className="font-bold text-[#111] text-[14px]">{label}</p>
                    <p className="text-[13px] text-[#6B7280] mt-0.5">{body}</p>
                  </div>
                </div>
              ))}
            </div>

            <h2 style={{ fontSize: "22px", fontWeight: 800, color: "#111", marginTop: "2rem", marginBottom: "0.5rem" }}>Example: "Tell me about a time you handled a conflict"</h2>

            <div className="space-y-3">
              <div className="rounded-xl border border-rose-200 bg-rose-50 p-4">
                <p className="text-[11px] font-black uppercase tracking-widest text-rose-600 mb-2">❌ Generic STAR answer</p>
                <p className="text-[13px] text-[#374151] italic">
                  "The situation was that my teammate and I disagreed on the database design. My task was to resolve it. The action I took was to have a meeting and discuss pros and cons. The result was we reached a consensus."
                </p>
              </div>
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                <p className="text-[11px] font-black uppercase tracking-widest text-emerald-600 mb-2">✓ CARE answer</p>
                <p className="text-[13px] text-[#374151] italic">
                  "We were 2 days from a hackathon deadline and my teammate wanted to use MongoDB, I wanted PostgreSQL. Instead of arguing, I spent an hour writing out the specific queries our app needed and showed him why relational made more sense for our use case — not generally, specifically. He changed his mind when he saw the actual query complexity. We shipped on time and the data layer held up under the demo load. What I learned is that abstract debates don't resolve quickly — concrete examples do. I use that now whenever I'm in a technical disagreement."
                </p>
              </div>
            </div>

            <p>
              The second answer is longer but it doesn't feel longer — because it's a story, not a template. The interviewer learns how you think, how you handle pressure, and that you actually reflected on the experience.
            </p>

            <h2 style={{ fontSize: "22px", fontWeight: 800, color: "#111", marginTop: "2rem", marginBottom: "0.5rem" }}>How to prepare without over-rehearsing</h2>
            <p>
              Prepare 5-6 real stories from your projects, internships, or college life. Know them well enough to tell them naturally. Then practise adapting the same story to different questions — "tell me about a time you led", "a time you failed", "a time you disagreed" can often all be answered with the same underlying story, just with different emphasis.
            </p>

            <div className="rounded-2xl bg-[#111] p-6 text-center mt-8">
              <p className="text-white font-black text-[18px] mb-2">Practise behavioural questions with live feedback.</p>
              <p className="text-[#9CA3AF] text-[13px] mb-4">Qued scores your STAR structure and flags when your answers sound too scripted.</p>
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