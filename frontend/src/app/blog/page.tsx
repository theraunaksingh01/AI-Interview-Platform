"use client";
import Link from "next/link";
import { FooterHero } from "@/app/components/Footer";
import { motion } from "framer-motion";

const ALL_POSTS = [
  {
    slug: "tcs-nqt-preparation",
    category: "Company Prep",
    categoryColor: "#dbeafe",
    categoryText: "#1d4ed8",
    title: "TCS NQT 2026: The Section-Wise Preparation Guide Nobody Gives You",
    excerpt: "Every placement season, thousands of students practice the wrong things for TCS NQT. Here's what actually gets tested, section by section, and where marks are quietly lost.",
    readTime: "6 min",
    icon: "🎯",
  },
  {
    slug: "off-campus-vs-on-campus",
    category: "Placement Strategy",
    categoryColor: "#fef3c7",
    categoryText: "#92400e",
    title: "Off-Campus vs On-Campus Placements: What Tier-2/3 College Students Should Actually Know",
    excerpt: "If your college doesn't get top companies on campus, that doesn't mean they're out of reach. Here's the honest breakdown of what actually differs.",
    readTime: "7 min",
    icon: "🧭",
  },
  {
    slug: "dsa-patterns",
    category: "DSA & Coding",
    categoryColor: "#fee2e2",
    categoryText: "#991b1b",
    title: "5 DSA Patterns That Cover Most of What Gets Asked in Interviews",
    excerpt: "Solving 300 random problems leaves you re-deriving solutions from scratch. Learn the 5 underlying patterns and dozens of 'different' problems suddenly look familiar.",
    readTime: "8 min",
    icon: "⚡",
  },
  {
    slug: "ai-in-interviews",
    category: "Industry Trends",
    categoryColor: "#ede9fe",
    categoryText: "#5b21b6",
    title: "How AI Quietly Changed the Interview Process — And What It Means for You",
    excerpt: "The interview process most students prepare for isn't quite the one companies actually run anymore. Here's where AI shows up, often invisibly, at every stage.",
    readTime: "7 min",
    icon: "🤖",
  },
  {
    slug: "why-speaking-is-different",
    category: "Communication",
    categoryColor: "#d1fae5",
    categoryText: "#065f46",
    title: "You Know the Answer. So Why Does It Fall Apart When You Say It Out Loud?",
    excerpt: "Knowing a concept and articulating it live under pressure use different mental pathways. Here's why this happens and how to close the gap fast.",
    readTime: "6 min",
    icon: "🎙️",
  },
  {
    slug: "tell-me-about-yourself",
    category: "Communication",
    categoryColor: "#d1fae5",
    categoryText: "#065f46",
    title: "The 'Tell Me About Yourself' Answer That Actually Works in Interviews",
    excerpt: "Most students answer this question like a resume summary. Here's how to structure a story that actually impresses interviewers and gets you to the next round.",
    readTime: "5 min",
    icon: "🗣️",
  },
  {
    slug: "mock-interview-not-working",
    category: "Interview Strategy",
    categoryColor: "#fee2e2",
    categoryText: "#991b1b",
    title: "Doing 20 Mock Interviews and Still Freezing in Real Ones? Here's Why",
    excerpt: "Placement season hits and you've done dozens of mock interviews — with friends, with seniors, maybe even with paid coaches. But when the real interview comes, you blank. Your answers feel flat. You say 'um' constantly and don't realise it until you're driving home.",
    readTime: "4 min",
    icon: "🧪",
  },
  {
    slug: "star-method-overrated",
    category: "Interview Strategy",
    categoryColor: "#fef3c7",
    categoryText: "#92400e",
    title: "The STAR Method Is Overrated. Here's What Actually Works.",
    excerpt: "STAR is a starting point, not a formula. Interviewers can tell when you're reciting a template. Here's how to answer behavioural questions in a way that actually sounds human.",
    readTime: "5 min",
    icon: "⭐",
  },
];

const featured = ALL_POSTS[0];
const rest = ALL_POSTS.slice(1);

export default function BlogIndexPage() {
  return (
    <div className="min-h-screen" style={{ background: "#FFFDF0" }}>
      <main className="pt-24">

        {/* Header */}
        <section className="px-6 pb-14 pt-12">
          <div className="mx-auto max-w-5xl">
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-[11px] font-black uppercase tracking-widest text-[#9CA3AF] mb-3"
            >
              The Cractal Blog
            </motion.p>
            <motion.h1
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              style={{
                fontSize: "clamp(32px, 5vw, 54px)",
                fontWeight: 900,
                letterSpacing: "-2px",
                color: "#111",
                lineHeight: 1.1,
              }}
            >
              Insights for{" "}
              <span
                style={{
                  background: "#FFD600",
                  padding: "2px 10px",
                  borderRadius: "6px",
                  fontStyle: "italic",
                }}
              >
                interview prep.
              </span>
            </motion.h1>
            <p className="mt-4 text-[15px] text-[#6B7280] max-w-lg">
              Real tactics, honest breakdowns, and practical guidance — company-specific prep,
              DSA patterns, and the communication skills interviews actually test.
            </p>
          </div>
        </section>

        {/* Featured post — larger card */}
        <section className="mx-auto max-w-5xl px-6 mb-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <Link
              href={`/blog/${featured.slug}`}
              className="group flex flex-col md:flex-row items-stretch gap-0 rounded-3xl border border-gray-200 bg-white overflow-hidden hover:shadow-lg transition-all"
            >
              <div
                className="flex items-center justify-center md:w-[220px] flex-shrink-0 p-10"
                style={{ background: featured.categoryColor }}
              >
                <span style={{ fontSize: "56px" }}>{featured.icon}</span>
              </div>
              <div className="p-7 md:p-8 flex flex-col justify-center flex-1">
                <span
                  className="inline-block w-fit rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-widest mb-3"
                  style={{ background: featured.categoryColor, color: featured.categoryText }}
                >
                  {featured.category}
                </span>
                <h2 className="text-[22px] md:text-[26px] font-black leading-snug text-[#111] mb-3 group-hover:underline decoration-2 underline-offset-4">
                  {featured.title}
                </h2>
                <p className="text-[14px] text-[#6B7280] leading-relaxed mb-4 max-w-xl">
                  {featured.excerpt}
                </p>
                <div className="flex items-center gap-3">
                  <span className="text-[12px] text-[#9CA3AF]">{featured.readTime} read</span>
                  <span className="text-[13px] font-bold text-[#111]">Read &rarr;</span>
                </div>
              </div>
            </Link>
          </motion.div>
        </section>

        {/* Rest of posts — grid */}
        <section className="mx-auto max-w-5xl px-6 pb-24">
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            {rest.map((post, i) => (
              <motion.div
                key={post.slug}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.06 }}
              >
                <Link
                  href={`/blog/${post.slug}`}
                  className="block h-full rounded-2xl border border-gray-200 bg-white p-6 hover:shadow-md transition-all hover:-translate-y-1"
                >
                  <div
                    className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl text-2xl"
                    style={{ background: post.categoryColor }}
                  >
                    {post.icon}
                  </div>
                  <span
                    className="inline-block rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-widest mb-2"
                    style={{ background: post.categoryColor, color: post.categoryText }}
                  >
                    {post.category}
                  </span>
                  <h3 className="mt-2 text-[16px] font-black leading-snug text-[#111] mb-2">
                    {post.title}
                  </h3>
                  <p className="text-[13px] text-[#6B7280] leading-relaxed mb-4">
                    {post.excerpt}
                  </p>
                  <div className="flex items-center justify-between">
                    <span className="text-[12px] text-[#9CA3AF]">{post.readTime} read</span>
                    <span className="text-[13px] font-bold text-[#111]">Read &rarr;</span>
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