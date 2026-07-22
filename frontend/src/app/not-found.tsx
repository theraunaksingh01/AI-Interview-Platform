// frontend/src/app/not-found.tsx
// Next.js App Router 404 page — place at src/app/not-found.tsx

import Link from "next/link";

const QUICK_LINKS = [
  { label: "Mock Interview",        href: "/mock",         icon: "🎤" },
  { label: "Readiness Assessment",  href: "/assessment",   icon: "📊" },
  { label: "OA Practice",           href: "/oa-practice",  icon: "📝" },
  { label: "DSA Practice",          href: "/dsa",          icon: "💻" },
  { label: "Company Guides",        href: "/companies",    icon: "🏢" },
  { label: "Pricing",               href: "/pricing",      icon: "💳" },
];

export default function NotFound() {
  return (
    <main
      className="min-h-screen flex flex-col items-center justify-center px-6 py-24"
      style={{ background: "#FFFDF0" }}
    >
      <div className="max-w-[520px] w-full text-center">

        {/* 404 number */}
        <div
          className="font-black leading-none mb-6 select-none"
          style={{
            fontSize: "clamp(80px, 20vw, 140px)",
            letterSpacing: "-6px",
            color: "#111",
          }}
        >
          4
          <span
            style={{
              background: "#FFD600",
              padding: "0 8px",
              borderRadius: 12,
              fontStyle: "italic",
            }}
          >
            0
          </span>
          4
        </div>

        <h1
          className="font-black text-[#111] mb-3"
          style={{ fontSize: "clamp(20px, 3vw, 28px)", letterSpacing: "-0.5px" }}
        >
          This page doesn't exist.
        </h1>
        <p className="text-[#6B7280] text-[15px] leading-relaxed mb-10 max-w-sm mx-auto">
          You might have followed a broken link or typed the URL wrong.
          Here's where you probably wanted to go:
        </p>

        {/* Quick links grid */}
        <div className="grid grid-cols-2 gap-3 mb-10">
          {QUICK_LINKS.map(({ label, href, icon }) => (
            <Link key={href} href={href}>
              <div
                className="flex items-center gap-3 rounded-xl border border-[#E5E7EB] bg-white px-4 py-3 text-left hover:border-[#111] hover:shadow-sm transition-all group"
              >
                <span className="text-[18px]">{icon}</span>
                <span className="text-[13px] font-bold text-[#374151] group-hover:text-[#111] transition-colors">
                  {label}
                </span>
              </div>
            </Link>
          ))}
        </div>

        {/* Home CTA */}
        <Link href="/">
          <button
            className="rounded-xl bg-[#111] px-8 py-3 text-[14px] font-black text-white hover:bg-[#333] transition"
          >
            ← Back to home
          </button>
        </Link>

        {/* Subtle brand */}
        <p className="mt-10 text-[12px] text-[#C4C4C4]">
          Lost? Email us at{" "}
          <a
            href="mailto:hello@qued.in"
            className="underline hover:text-[#111] transition-colors"
          >
            hello@qued.in
          </a>
        </p>
      </div>
    </main>
  );
}