// ============================================================
// FILE 1: frontend/src/app/blog/page.tsx  (Blog index)
// ============================================================

// blog/page.tsx
"use client";
import Link from "next/link";
import { FooterHero } from "@/app/components/Footer";
import { motion } from "framer-motion";

const ALL_POSTS = [
  {
    slug: "tell-me-about-yourself",
    category: "Interview Strategy",
    categoryColor: "#d1fae5",
    categoryText: "#065f46",
    title: "How to Answer 'Tell Me About Yourself' Without Sounding Scripted",
    excerpt: "Most candidates rehearse this answer until it sounds robotic. Here's a framework to structure it naturally — and why the first 30 seconds determine the interviewer's entire perception of you.",
    readTime: "6 min",
    icon: "📝",
  },
  {
    slug: "system-design-failures",
    category: "System Design",
    categoryColor: "#ede9fe",
    categoryText: "#5b21b6",
    title: "Why Candidates Fail System Design — Even When They Know the Answer",
    excerpt: "Knowing the concepts isn't enough. System design interviews test how you think out loud, handle ambiguity, and structure your approach under pressure.",
    readTime: "8 min",
    icon: "🏗️",
  },
  {
    slug: "star-method-overrated",
    category: "Behavioural",
    categoryColor: "#fef3c7",
    categoryText: "#92400e",
    title: "The STAR Method Is Overrated. Here's What Actually Works.",
    excerpt: "STAR is a starting point, not a formula. Interviewers can tell when you're reciting a template. Here's how to answer behavioural questions in a way that actually sounds human.",
    readTime: "5 min",
    icon: "🎭",
  },
  {
    slug: "mock-interview-not-working",
    category: "Mock Tips",
    categoryColor: "#fee2e2",
    categoryText: "#991b1b",
    title: "5 Signs Your Mock Interview Practice Isn't Translating to Real Results",
    excerpt: "Doing 20 mock interviews and still freezing in real ones? The problem isn't quantity — it's how you're practising. Here's what to change.",
    readTime: "4 min",
    icon: "📊",
  },
];

export default function BlogIndexPage() {
  return (
    <div className="min-h-screen" style={{ background: "#FFFDF0" }}>
      <main className="pt-24">
        <section className="px-6 pb-16 pt-12">
          <div className="mx-auto max-w-4xl">
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-[11px] font-black uppercase tracking-widest text-[#9CA3AF] mb-3">
              The Qued Blog
            </motion.p>
            <motion.h1
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              style={{ fontSize: "clamp(32px, 5vw, 54px)", fontWeight: 900, letterSpacing: "-2px", color: "#111", lineHeight: 1.1 }}
            >
              Insights for{" "}
              <span style={{ background: "#FFD600", padding: "2px 10px", borderRadius: "6px", fontStyle: "italic" }}>
                interview prep.
              </span>
            </motion.h1>
            <p className="mt-4 text-[15px] text-[#6B7280] max-w-lg">
              Real tactics, honest breakdowns, and AI-backed research — so every mock session becomes smarter than the last.
            </p>
          </div>
        </section>

        <section className="mx-auto max-w-4xl px-6 pb-24">
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            {ALL_POSTS.map((post, i) => (
              <motion.div
                key={post.slug}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.07 }}
              >
                <Link href={`/blog/${post.slug}`} className="block rounded-2xl border border-gray-200 bg-white p-6 hover:shadow-md transition-all hover:-translate-y-1">
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl text-2xl" style={{ background: post.categoryColor }}>
                    {post.icon}
                  </div>
                  <span className="inline-block rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-widest mb-2" style={{ background: post.categoryColor, color: post.categoryText }}>
                    {post.category}
                  </span>
                  <h2 className="mt-2 text-[17px] font-black leading-snug text-[#111] mb-2">{post.title}</h2>
                  <p className="text-[13px] text-[#6B7280] leading-relaxed mb-4">{post.excerpt}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-[12px] text-[#9CA3AF]">{post.readTime} read</span>
                    <span className="text-[13px] font-bold text-[#111]">Read →</span>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        </section>
      </main>
      <FooterHero />
    </div>
  );
}