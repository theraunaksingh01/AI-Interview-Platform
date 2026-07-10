// frontend/src/app/companies/page.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const API_BASE = (
  process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:8000"
).replace(/\/$/, "");

const LOGO_MAP: Record<string, string> = {
  tcs:     "🔷",
  infy:    "🟦",
  wipro:   "🟡",
  cogni:   "🔵",
  acc:     "🟣",
  cap:     "🌐",
  amzn:    "🟠",
  msft:    "🪟",
  hcl:     "🟢",
  techmah: "🔴",
};
const getLogo = (code: string) => LOGO_MAP[code] ?? "🏢";

type Company = {
  id: number;
  company: string;
  slug: string;
  logo_emoji: string;
  description: string;
  hires_annually: string;
  salary_range: string;
  tier: number;
  difficulty_range: string;
};

const TIER_LABELS: Record<number, string> = {
  1: "High Volume Hiring",
  2: "Product & Mid-tier",
};

export default function CompaniesPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading]     = useState(true);

  useEffect(() => {
    fetch(`${API_BASE}/api/companies`)
      .then((r) => r.json())
      .then((d) => setCompanies(d.companies || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const tier1 = companies.filter((c) => c.tier === 1);
  const tier2 = companies.filter((c) => c.tier === 2);

  return (
    <main className="min-h-screen pt-24 pb-16 px-4 sm:px-8" style={{ background: "#FAFAF8" }}>
      <div className="mx-auto max-w-[1100px]">

        {/* Header */}
        <div className="mb-10">
          <p className="text-[11px] font-black uppercase tracking-widest text-[#9CA3AF] mb-3">
            Company Prep
          </p>
          <h1
            style={{
              fontSize: "clamp(28px, 5vw, 44px)",
              fontWeight: 900,
              letterSpacing: "-1.5px",
              color: "#111",
              lineHeight: 1.1,
            }}
          >
            Prepare for your{" "}
            <span
              style={{
                background: "#FFD600",
                padding: "2px 10px",
                borderRadius: "6px",
                fontStyle: "italic",
              }}
            >
              exact company.
            </span>
          </h1>
          <p className="mt-3 text-[15px] text-[#6B7280] max-w-xl">
            Hiring process, OA pattern, what they test in interviews, eligibility,
            and salary — all in one place. Pick your target company and start.
          </p>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-40 animate-pulse rounded-2xl bg-white border border-[#E5E7EB]" />
            ))}
          </div>
        ) : (
          <div className="space-y-10">
            {[
              { tier: 1, list: tier1 },
              { tier: 2, list: tier2 },
            ].map(({ tier, list }) =>
              list.length === 0 ? null : (
                <div key={tier}>
                  <div className="flex items-center gap-3 mb-4">
                    <p className="text-[11px] font-black uppercase tracking-widest text-[#9CA3AF]">
                      {TIER_LABELS[tier]}
                    </p>
                    <div className="flex-1 h-px bg-[#E5E7EB]" />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {list.map((c) => (
                      <Link key={c.slug} href={`/companies/${c.slug}`}>
                        <div className="group rounded-2xl border border-[#E5E7EB] bg-white p-5 hover:border-[#111] hover:shadow-md transition-all cursor-pointer h-full">
                          <div className="flex items-start justify-between mb-3">
                            <span className="text-[32px]">{getLogo(c.logo_emoji)}</span>
                            <span
                              className="rounded-full px-2.5 py-0.5 text-[11px] font-bold"
                              style={{
                                background:
                                  c.difficulty_range === "Hard"
                                    ? "#FFF1F2"
                                    : "#F0FDF4",
                                color:
                                  c.difficulty_range === "Hard"
                                    ? "#991B1B"
                                    : "#065F46",
                              }}
                            >
                              {c.difficulty_range}
                            </span>
                          </div>
                          <h2 className="text-[16px] font-black text-[#111] mb-1">
                            {c.company}
                          </h2>
                          <p className="text-[12px] text-[#6B7280] leading-relaxed mb-3 line-clamp-2">
                            {c.description}
                          </p>
                          <div className="flex items-center justify-between mt-auto pt-3 border-t border-[#F3F4F6]">
                            <div>
                              <p className="text-[11px] text-[#9CA3AF]">Salary range</p>
                              <p className="text-[13px] font-bold text-[#111]">{c.salary_range}</p>
                            </div>
                            <span className="text-[13px] font-black text-[#9CA3AF] group-hover:text-[#111] transition">
                              Prepare →
                            </span>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )
            )}
          </div>
        )}

        {/* Off-campus note */}
        <div className="mt-10 rounded-2xl border border-[#E5E7EB] bg-white px-6 py-5 flex items-start gap-3">
          <span className="text-[20px] mt-0.5 flex-shrink-0">💼</span>
          <div>
            <p className="text-[13px] font-bold text-[#111]">Applying off-campus?</p>
            <p className="text-[12px] text-[#6B7280] mt-0.5 leading-relaxed">
              The interview process for off-campus applications is identical to on-campus. Pick
              the company you&apos;re targeting and prepare the same way. Your college tier
              doesn&apos;t affect the interview content.
            </p>
          </div>
        </div>

      </div>
    </main>
  );
}