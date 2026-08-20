"use client";
import Link from "next/link";
import { FooterHero } from "@/app/components/Footer";
import { motion } from "motion/react";

// SEO keywords: DSA patterns for interviews, coding interview patterns,
// data structures algorithms placement, DSA preparation strategy,
// coding interview questions India, how to prepare DSA for placements

export default function BlogPostDSAPatterns() {
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
              style={{ background: "#FEE2E2", color: "#991B1B" }}
            >
              DSA & Coding
            </span>

            <h1
              className="font-black text-[#111] mb-4 leading-tight"
              style={{ fontSize: "clamp(28px, 5vw, 42px)", letterSpacing: "-1px" }}
            >
              5 DSA Patterns That Cover Most of What Gets Asked in Interviews
            </h1>

            <div className="mt-5 flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#23b9d3] text-[11px] font-bold text-white">R</div>
              <div>
                <p className="text-[13px] font-semibold text-[#111]">Raunak</p>
                <p className="text-[11px] text-[#9CA3AF]">8 min read</p>
              </div>
            </div>
          </motion.div>

          {/* Divider */}
          <div className="my-8 h-px bg-[#E5E7EB]" />

          <div className="prose-content space-y-6" style={{ fontSize: "16px", lineHeight: 1.75, color: "#374151" }}>

            <p>
              Students often approach DSA prep by solving problems in random order off a list, which
              means each problem feels like starting from zero. The more effective approach is
              recognizing that a small number of underlying patterns show up repeatedly, disguised in
              different problem statements. Learn the pattern once, and dozens of seemingly different
              problems become variations you already know how to approach.
            </p>

            <h2 className="font-black text-[#111]" style={{ fontSize: "24px", marginTop: "36px" }}>
              1. Two Pointers
            </h2>
            <p>
              Any time you&apos;re searching for pairs, triplets, or subarrays that satisfy a
              condition in a sorted or partially-ordered array, two pointers is almost certainly the
              efficient approach. Problems like &quot;find two numbers that sum to a target&quot; or
              &quot;remove duplicates from a sorted array&quot; are textbook two-pointer setups. The
              tell: if you find yourself writing nested loops for a problem involving a sorted array,
              pause — there&apos;s likely a linear two-pointer solution instead.
            </p>

            <h2 className="font-black text-[#111]" style={{ fontSize: "24px", marginTop: "36px" }}>
              2. Sliding Window
            </h2>
            <p>
              This pattern owns any problem about finding the &quot;best&quot; contiguous subarray or
              substring — longest substring without repeating characters, maximum sum subarray of
              size k, smallest window containing all characters of another string. The core idea is
              maintaining a window that expands and contracts based on a condition, rather than
              recalculating from scratch for every possible window. Once this clicks, an entire
              category of &quot;substring/subarray&quot; problems stops feeling intimidating.
            </p>

            <h2 className="font-black text-[#111]" style={{ fontSize: "24px", marginTop: "36px" }}>
              3. Fast and Slow Pointers (Floyd&apos;s Cycle Detection)
            </h2>
            <p>
              Linked list problems involving cycles, finding the middle element, or detecting
              intersections almost always use this pattern — one pointer moves one step at a time,
              another moves two. It sounds like a narrow trick, but it quietly solves an entire class
              of linked-list problems that otherwise look like they need extra memory to track visited
              nodes.
            </p>

            <h2 className="font-black text-[#111]" style={{ fontSize: "24px", marginTop: "36px" }}>
              4. Binary Search on the Answer
            </h2>
            <p>
              Most students learn binary search only for finding an element in a sorted array. The
              more powerful version — binary search on the answer space itself — applies to a much
              wider set of optimization problems: minimizing the maximum load, finding the smallest
              capacity that satisfies a constraint, and similar &quot;find the minimum value that
              works&quot; problems. If a problem asks you to minimize or maximize some value and you
              can check &quot;does this value work?&quot; in reasonable time, binary search on the
              answer is worth considering even when the input isn&apos;t sorted at all.
            </p>

            <h2 className="font-black text-[#111]" style={{ fontSize: "24px", marginTop: "36px" }}>
              5. BFS/DFS for Graph and Tree Traversal
            </h2>
            <p>
              Once you recognize that grids, trees, and graphs are fundamentally the same traversal
              problem in disguise, an enormous chunk of &quot;hard-looking&quot; problems become
              approachable. Number of islands, level-order traversal, shortest path in an unweighted
              graph — all BFS or DFS with minor variations. The pattern to internalize: BFS for
              shortest-path-in-unweighted-graph problems, DFS for exploring all possibilities or
              detecting structure like cycles and connected components.
            </p>

            <h2 className="font-black text-[#111]" style={{ fontSize: "24px", marginTop: "36px" }}>
              Why patterns beat problem count
            </h2>
            <p>
              Solving 300 random problems without noticing the underlying patterns leaves you
              re-deriving solutions from scratch under interview pressure. Solving 60 problems while
              consciously tagging which pattern each one uses builds actual pattern recognition — the
              skill that lets you look at a new, unfamiliar problem and think &quot;this smells like
              sliding window&quot; within the first thirty seconds. That recognition speed is what
              separates candidates who finish coding rounds with time to spare from those who run out
              of time mid-problem.
            </p>

            <div
              className="rounded-2xl p-6 my-10"
              style={{ background: "#FEF2F2", border: "1px solid #FECACA" }}
            >
              <p className="font-bold text-[#111] mb-2" style={{ fontSize: "15px" }}>
                Practice with real test cases, not just theory
              </p>
              <p style={{ fontSize: "14px", color: "#555" }}>
                Cractal&apos;s DSA Practice has 185 problems across Python, Java, and C++ with real test
                case validation — and shows you the optimal approach and time complexity after you
                submit, so you can see exactly which pattern you should have recognized.
              </p>
              <Link href="/dsa" className="inline-block mt-3 text-[13px] font-black text-[#991B1B] hover:underline">
                Practice DSA patterns &rarr;
              </Link>
            </div>

            <p>
              You don&apos;t need to memorize hundreds of solutions. You need to recognize five or six
              shapes reliably, and most coding interview questions — across TCS, Infosys, Amazon,
              product companies, and everything in between — start looking a lot more familiar.
            </p>

          </div>
        </article>
      </main>
      <FooterHero />
    </div>
  );
}