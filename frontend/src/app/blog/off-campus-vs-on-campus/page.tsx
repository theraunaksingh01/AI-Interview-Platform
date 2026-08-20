"use client";
import Link from "next/link";
import { FooterHero } from "@/app/components/Footer";
import { motion } from "motion/react";

// SEO keywords: off campus placement India, off campus vs on campus placement,
// tier 3 college placement preparation, off campus interview preparation,
// how to get placed off campus, engineering student job search India

export default function BlogPostOffCampus() {
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
              style={{ background: "#FEF3C7", color: "#92400E" }}
            >
              Placement Strategy
            </span>

            <h1
              className="font-black text-[#111] mb-4 leading-tight"
              style={{ fontSize: "clamp(28px, 5vw, 42px)", letterSpacing: "-1px" }}
            >
              Off-Campus vs On-Campus Placements: What Tier-2/3 College Students Should Actually Know
            </h1>

            <div className="mt-5 flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#db2acf] text-[11px] font-bold text-white">R</div>
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
              If your college doesn&apos;t get Amazon, Microsoft, or Google on campus, that doesn&apos;t
              mean those companies are out of reach. It means the path to them looks different than
              what your campus placement cell is built to offer. Here&apos;s the honest breakdown of
              how these two paths actually differ, and where students waste effort assuming campus
              access is a prerequisite for a good outcome.
            </p>

            <h2 className="font-black text-[#111]" style={{ fontSize: "24px", marginTop: "36px" }}>
              The interview is identical either way
            </h2>
            <p>
              This is the part students consistently underestimate. A TCS interview through your
              campus drive and a TCS interview through an off-campus application follow the same
              rounds, the same evaluation criteria, and often literally the same interviewers. The
              company doesn&apos;t interview you differently because you applied through a portal
              instead of a campus drive. Your college&apos;s brand name doesn&apos;t change what happens
              once you&apos;re in the interview room — your preparation does.
            </p>

            <h2 className="font-black text-[#111]" style={{ fontSize: "24px", marginTop: "36px" }}>
              What genuinely differs: getting the interview, not passing it
            </h2>
            <p>
              On-campus, the company comes to you and pre-filters candidates through your placement
              cell. Off-campus, you&apos;re responsible for finding open roles yourself — through
              company career pages, LinkedIn, referrals, and platforms like Unstop or Internshala. This
              is a real difference, but it&apos;s a logistics problem, not a merit problem. Students
              often conflate &quot;harder to find&quot; with &quot;harder to get,&quot; and end up
              under-preparing for interviews they eventually do land, because they spent all their
              energy just searching.
            </p>

            <h2 className="font-black text-[#111]" style={{ fontSize: "24px", marginTop: "36px" }}>
              Off-campus applications actually widen your options
            </h2>
            <p>
              Most students only think about the companies that don&apos;t visit their campus. But
              off-campus access also means you&apos;re not limited to whichever roles and CTC brackets
              your placement cell negotiated. Product-based startups, fast-growing companies like
              Razorpay or Zerodha, and remote-first roles rarely do traditional campus drives at all —
              they hire almost entirely through applications and referrals. If you only think in terms
              of &quot;what visits my campus,&quot; you&apos;re accidentally filtering out an entire
              category of strong opportunities.
            </p>

            <h2 className="font-black text-[#111]" style={{ fontSize: "24px", marginTop: "36px" }}>
              The real bottleneck: application volume and consistency
            </h2>
            <p>
              Campus placements create artificial urgency — a fixed date, a fixed process, a cohort
              going through it together. Off-campus has no such structure, which means the biggest
              risk isn&apos;t rejection, it&apos;s inconsistency. Students apply to five roles, hear
              nothing back for two weeks, and quietly give up. The students who succeed off-campus
              treat it like a numbers game with a process — steady weekly applications, tracked
              systematically, rather than sporadic bursts of effort followed by long gaps.
            </p>

            <h2 className="font-black text-[#111]" style={{ fontSize: "24px", marginTop: "36px" }}>
              What actually predicts success in either path
            </h2>
            <p>
              Whether you&apos;re walking into a campus drive interview room or a video call for an
              off-campus application, the same three things determine your outcome: whether you can
              solve the technical problem in front of you, whether you can explain your thinking
              clearly while doing it, and whether you know what that specific company&apos;s interview
              process actually looks like. None of these depend on how you got the interview.
            </p>

            <div
              className="rounded-2xl p-6 my-10"
              style={{ background: "#FFFBEB", border: "1px solid #FDE68A" }}
            >
              <p className="font-bold text-[#111] mb-2" style={{ fontSize: "15px" }}>
                Prep is prep, regardless of how you got the interview
              </p>
              <p style={{ fontSize: "14px", color: "#555" }}>
                Qued was built for students at any college — tier 1, 2, or 3 — preparing for
                interviews they got through campus drives or their own applications. The mock
                interviews, DSA practice, and OA simulations are the same regardless of your college&apos;s
                placement record.
              </p>
              <Link href="/assessment" className="inline-block mt-3 text-[13px] font-black text-[#92400E] hover:underline">
                Take the free readiness assessment &rarr;
              </Link>
            </div>

            <p>
              Your college&apos;s placement statistics describe your college, not your ceiling.
              Off-campus hiring is how a meaningful share of engineers in India actually land strong
              roles — it just requires you to be the one driving the process instead of waiting for
              it to come to you.
            </p>

          </div>
        </article>
      </main>
      <FooterHero />
    </div>
  );
}