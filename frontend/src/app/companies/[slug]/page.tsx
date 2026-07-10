// frontend/src/app/companies/[slug]/page.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

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

// ─── Types ────────────────────────────────────────────────────────────────────

type HiringStep = {
  step: number;
  name: string;
  duration: string;
  description: string;
};

type OASection = {
  name: string;
  questions: number;
  time_min: number;
  type: string;
};

type SalaryRow = {
  role: string;
  ctc: string;
  in_hand: string;
};

type CompanyData = {
  id: number;
  company: string;
  slug: string;
  logo_emoji: string;
  description: string;
  hires_annually: string;
  salary_range: string;
  tier: number;
  difficulty_range: string;
  interview_pattern: { steps: string[] } | string | null;
  interview_style: string;
  what_they_value: string;
  most_asked_topics: string[];
  tips: string;
  hiring_process: HiringStep[];
  oa_pattern: {
    total_time: number;
    total_questions: number;
    sections: OASection[];
    behaviors: string[];
    tracks?: string[];
  } | null;
  eligibility: {
    min_percentage: number;
    backlog_policy: string;
    gap_policy: string;
    eligible_branches: string[];
  } | null;
  salary: SalaryRow[] | null;
  interview_experience_urls: string[];
};

type QuestionCount = {
  voice_count: number;
  dsa_count: number;
  total: number;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function SectionBadge({ type }: { type: string }) {
  const styles: Record<string, { bg: string; color: string; label: string }> = {
    mcq:    { bg: "#EEF2FF", color: "#4338CA", label: "MCQ" },
    coding: { bg: "#F0FDF4", color: "#166534", label: "Coding" },
    essay:  { bg: "#FFF7ED", color: "#9A3412", label: "Written" },
    mixed:  { bg: "#FDF4FF", color: "#7E22CE", label: "Mixed" },
  };
  const s = styles[type] || styles.mcq;
  return (
    <span
      className="rounded-full px-2 py-0.5 text-[10px] font-bold"
      style={{ background: s.bg, color: s.color }}
    >
      {s.label}
    </span>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CompanyDetailPage() {
  const { slug } = useParams() as { slug: string };
  const { user } = useAuth();

  const [data,   setData]   = useState<CompanyData | null>(null);
  const [qcount, setQcount] = useState<QuestionCount | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  useEffect(() => {
    if (!slug) return;
    // Fetch company data — question-count failure is non-fatal
    fetch(`${API_BASE}/api/companies/${slug}`)
      .then((r) => {
        if (!r.ok) throw new Error("Company not found");
        return r.json();
      })
      .then((company) => {
        setData(company);
        // Fetch question count separately — silently ignore if it fails
        fetch(`${API_BASE}/api/companies/${slug}/question-count`)
          .then((r) => r.ok ? r.json() : null)
          .then((counts) => { if (counts) setQcount(counts); })
          .catch(() => {}); // non-fatal
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) {
    return (
      <main className="min-h-screen pt-24 px-4 sm:px-8" style={{ background: "#FAFAF8" }}>
        <div className="mx-auto max-w-[900px] space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-32 animate-pulse rounded-2xl bg-white border border-[#E5E7EB]" />
          ))}
        </div>
      </main>
    );
  }

  if (error || !data) {
    return (
      <main className="min-h-screen pt-24 px-4 sm:px-8" style={{ background: "#FAFAF8" }}>
        <div className="mx-auto max-w-[900px] rounded-2xl border border-rose-200 bg-rose-50 p-8 text-center">
          <p className="text-rose-700 font-medium">{error || "Company not found"}</p>
          <Link href="/companies" className="mt-4 inline-block text-[13px] font-bold text-[#111] underline">
            ← All companies
          </Link>
        </div>
      </main>
    );
  }

  const mockUrl = `/mock?prefill_role=Backend Engineer&prefill_company=${data.slug}`;
  const topics: string[] = Array.isArray(data.most_asked_topics)
    ? data.most_asked_topics
    : [];

  return (
    <main className="min-h-screen pt-24 pb-16 px-4 sm:px-8" style={{ background: "#FAFAF8" }}>
      <div className="mx-auto max-w-[900px] space-y-6">

        {/* ── Back link ── */}
        <Link
          href="/companies"
          className="inline-flex items-center gap-1.5 text-[12px] font-medium text-[#9CA3AF] hover:text-[#111] transition"
        >
          ← All companies
        </Link>

        {/* ── Hero card ── */}
        <div
          className="rounded-3xl border border-[#E5E7EB] bg-white overflow-hidden"
          style={{ boxShadow: "0 4px 40px rgba(0,0,0,0.05)" }}
        >
          <div
            className="px-7 py-8"
            style={{ background: "linear-gradient(135deg, #FFFDF0 0%, #FFF9D6 100%)" }}
          >
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-4">
                <span className="text-[48px]">{getLogo(data.logo_emoji)}</span>
                <div>
                  <h1
                    style={{
                      fontSize: "clamp(24px, 4vw, 36px)",
                      fontWeight: 900,
                      letterSpacing: "-1px",
                      color: "#111",
                    }}
                  >
                    {data.company}
                  </h1>
                  <p className="text-[14px] text-[#6B7280] mt-1 max-w-md leading-relaxed">
                    {data.description}
                  </p>
                </div>
              </div>

              {/* Key stats */}
              <div className="flex gap-6 flex-wrap">
                {[
                  { label: "Hires annually", value: data.hires_annually },
                  { label: "Salary range",   value: data.salary_range   },
                  { label: "Difficulty",     value: data.difficulty_range },
                ].map(({ label, value }) => (
                  <div key={label} className="text-right">
                    <p className="text-[11px] text-[#9CA3AF] font-medium">{label}</p>
                    <p className="text-[15px] font-black text-[#111]">{value}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Interview style strip */}
          <div className="px-7 py-4 border-t border-[#F3F4F6] bg-white">
            <p className="text-[12px] text-[#374151] leading-relaxed">
              <span className="font-bold text-[#111]">Interview style: </span>
              {data.interview_style}
            </p>
          </div>
        </div>

        {/* ── Hiring Process ── */}
        {data.hiring_process?.length > 0 && (
          <div className="rounded-2xl border border-[#E5E7EB] bg-white overflow-hidden">
            <div className="px-6 py-5 border-b border-[#F3F4F6]">
              <h2 className="text-[16px] font-black text-[#111]">Hiring Process</h2>
              <p className="text-[12px] text-[#9CA3AF] mt-0.5">
              {typeof data.interview_pattern === 'object' && data.interview_pattern !== null
                ? (data.interview_pattern as { steps: string[] }).steps?.join(' → ')
                : data.interview_pattern as string}
            </p>
            </div>
            <div className="divide-y divide-[#F9FAFB]">
              {data.hiring_process.map((step, i) => (
                <div key={i} className="flex items-start gap-4 px-6 py-5">
                  <div className="flex-shrink-0 flex h-8 w-8 items-center justify-center rounded-full bg-[#111] text-white text-[12px] font-black">
                    {step.step}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <p className="text-[14px] font-black text-[#111]">{step.name}</p>
                      <span className="rounded-full bg-[#F3F4F6] px-2.5 py-0.5 text-[11px] font-medium text-[#374151]">
                        {step.duration}
                      </span>
                    </div>
                    <p className="text-[13px] text-[#6B7280] leading-relaxed">{step.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── OA Pattern ── */}
        {data.oa_pattern && (
          <div className="rounded-2xl border border-[#E5E7EB] bg-white overflow-hidden">
            <div className="px-6 py-5 border-b border-[#F3F4F6] flex items-center justify-between">
              <div>
                <h2 className="text-[16px] font-black text-[#111]">Online Assessment Pattern</h2>
                <p className="text-[12px] text-[#9CA3AF] mt-0.5">
                  {data.oa_pattern.total_questions} questions · {data.oa_pattern.total_time} minutes total
                </p>
              </div>
              <Link href="/oa-practice">
                <button className="rounded-xl bg-[#111] px-4 py-2 text-[12px] font-black text-white hover:bg-[#333] transition">
                  Practice this pattern →
                </button>
              </Link>
            </div>

            {/* Sections table */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#F3F4F6] bg-[#FAFAF8]">
                    {["Section", "Questions", "Time", "Type"].map((h) => (
                      <th key={h} className="px-5 py-3 text-left text-[11px] font-black uppercase tracking-widest text-[#9CA3AF]">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.oa_pattern.sections.map((s, i) => (
                    <tr key={i} className="border-b border-[#F9FAFB] hover:bg-[#FAFAFA] transition">
                      <td className="px-5 py-3 text-[13px] font-medium text-[#111]">{s.name}</td>
                      <td className="px-5 py-3 text-[13px] text-[#374151]">{s.questions}</td>
                      <td className="px-5 py-3 text-[13px] text-[#374151]">{s.time_min} min</td>
                      <td className="px-5 py-3"><SectionBadge type={s.type} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Behaviors */}
            {data.oa_pattern.behaviors?.length > 0 && (
              <div className="px-6 py-4 border-t border-[#F3F4F6] bg-[#FAFAF8]">
                <p className="text-[11px] font-black uppercase tracking-widest text-[#9CA3AF] mb-2">
                  Key behaviors
                </p>
                <div className="flex flex-wrap gap-2">
                  {data.oa_pattern.behaviors.map((b, i) => (
                    <span
                      key={i}
                      className="rounded-full border border-[#E5E7EB] bg-white px-3 py-1 text-[12px] font-medium text-[#374151]"
                    >
                      {b}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Tracks */}
            {(data.oa_pattern.tracks?.length ?? 0) > 0 && (
              <div className="px-6 py-4 border-t border-[#F3F4F6]">
                <p className="text-[11px] font-black uppercase tracking-widest text-[#9CA3AF] mb-2">
                  Hiring tracks
                </p>
                <div className="flex flex-wrap gap-2">
                  {(data.oa_pattern.tracks ?? []).map((t, i) => (
                    <span
                      key={i}
                      className="rounded-full bg-[#111] px-3 py-1 text-[12px] font-bold text-white"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── What they test in interviews ── */}
        {(topics.length > 0 || data.what_they_value) && (
          <div className="rounded-2xl border border-[#E5E7EB] bg-white p-6">
            <h2 className="text-[16px] font-black text-[#111] mb-1">
              What they test in interviews
            </h2>
            {data.what_they_value && (
              <p className="text-[13px] text-[#6B7280] mb-4 leading-relaxed">
                <span className="font-bold text-[#111]">Values: </span>
                {data.what_they_value}
              </p>
            )}
            {topics.length > 0 && (
              <>
                <p className="text-[11px] font-black uppercase tracking-widest text-[#9CA3AF] mb-3">
                  Most asked topics
                </p>
                <div className="flex flex-wrap gap-2">
                  {topics.map((t, i) => (
                    <span
                      key={i}
                      className="rounded-full px-3 py-1 text-[12px] font-medium border border-[#E5E7EB] bg-[#F9FAFB] text-[#374151]"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              </>
            )}
            {data.tips && (
              <div className="mt-4 rounded-xl bg-yellow-50 border border-yellow-200 px-4 py-3">
                <p className="text-[11px] font-black uppercase tracking-widest text-[#92400E] mb-1">
                  💡 Key tip
                </p>
                <p className="text-[13px] text-[#92400E] leading-relaxed">{data.tips}</p>
              </div>
            )}
          </div>
        )}

        {/* ── Eligibility ── */}
        {data.eligibility && (
          <div className="rounded-2xl border border-[#E5E7EB] bg-white p-6">
            <h2 className="text-[16px] font-black text-[#111] mb-4">Eligibility</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                { label: "Minimum academics", value: `${data.eligibility.min_percentage}% or ${(data.eligibility.min_percentage / 10).toFixed(1)} CGPA` },
                { label: "Backlog policy",    value: data.eligibility.backlog_policy },
                { label: "Gap year policy",   value: data.eligibility.gap_policy    },
              ].map(({ label, value }) => (
                <div key={label} className="rounded-xl bg-[#F9FAFB] border border-[#F3F4F6] px-4 py-3">
                  <p className="text-[11px] font-black uppercase tracking-widest text-[#9CA3AF] mb-1">{label}</p>
                  <p className="text-[13px] font-medium text-[#111]">{value}</p>
                </div>
              ))}
              <div className="rounded-xl bg-[#F9FAFB] border border-[#F3F4F6] px-4 py-3 sm:col-span-2">
                <p className="text-[11px] font-black uppercase tracking-widest text-[#9CA3AF] mb-1">Eligible branches</p>
                <p className="text-[13px] font-medium text-[#111]">
                  {data.eligibility.eligible_branches.join(", ")}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ── Salary ── */}
        {(data.salary?.length ?? 0) > 0 && (
          <div className="rounded-2xl border border-[#E5E7EB] bg-white overflow-hidden">
            <div className="px-6 py-5 border-b border-[#F3F4F6]">
              <h2 className="text-[16px] font-black text-[#111]">Salary</h2>
              <p className="text-[11px] text-[#9CA3AF] mt-0.5">
                Estimated from public reports — verify with official sources
              </p>
            </div>
            <div className="divide-y divide-[#F9FAFB]">
              {(data.salary ?? []).map((row, i) => (
                <div key={i} className="flex items-center justify-between px-6 py-4">
                  <p className="text-[13px] font-medium text-[#374151]">{row.role}</p>
                  <div className="text-right">
                    <p className="text-[14px] font-black text-[#111]">{row.ctc}</p>
                    {row.in_hand && (
                      <p className="text-[11px] text-[#9CA3AF]">{row.in_hand}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Your preparation CTA ── */}
        <div className="rounded-2xl bg-[#111] overflow-hidden">
          <div className="px-7 py-6">
            <p className="text-[11px] font-black uppercase tracking-widest text-[#555] mb-2">
              Your preparation for {data.company}
            </p>
            <h2 className="text-[20px] font-black text-white mb-5">
              Start practicing right now.
            </h2>

            {/* Question bank count */}
            {qcount && qcount.total > 0 && (
              <div className="mb-5 rounded-xl bg-white/5 border border-white/10 px-4 py-3 flex items-center gap-3">
                <span className="text-[20px]">📚</span>
                <p className="text-[13px] text-[#aaa]">
                  <span className="text-white font-bold">{qcount.voice_count} voice questions</span> and{" "}
                  <span className="text-white font-bold">{qcount.dsa_count} DSA problems</span> tagged for {data.company} in the question bank.
                </p>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Link href={mockUrl}>
                <button className="w-full rounded-xl bg-yellow-400 py-3 text-[13px] font-black text-[#111] hover:bg-yellow-300 transition">
                  🎙️ Start {data.company} mock interview →
                </button>
              </Link>
              <Link href="/oa-practice">
                <button className="w-full rounded-xl border border-white/20 bg-white/5 py-3 text-[13px] font-black text-white hover:bg-white/10 transition">
                  📝 Take {data.company} OA practice test →
                </button>
              </Link>
              <Link href="/dsa">
                <button className="w-full rounded-xl border border-white/20 bg-white/5 py-3 text-[13px] font-black text-white hover:bg-white/10 transition">
                  💻 Practice {data.company} DSA problems →
                </button>
              </Link>
              <Link href={`/cheat-sheet?company=${data.slug}`}>
                <button className="w-full rounded-xl border border-white/20 bg-white/5 py-3 text-[13px] font-black text-white hover:bg-white/10 transition">
                  📄 View {data.company} cheat sheet →
                </button>
              </Link>
            </div>
          </div>
        </div>

        {/* ── Contribute your experience ── */}
        <div className="rounded-2xl border border-[#E5E7EB] bg-white p-6">
          <div className="flex items-start gap-4">
            <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-yellow-50 border border-yellow-200 text-[20px]">
              📝
            </span>
            <div className="flex-1">
              <h2 className="text-[16px] font-black text-[#111] mb-1">
                Interviewed at {data.company} recently?
              </h2>
              <p className="text-[13px] text-[#6B7280] leading-relaxed mb-4">
                Share the questions they asked — earn a{" "}
                <span className="font-bold text-[#111]">+1 bonus mock session credit</span>{" "}
                and help other students prepare for the same company. Every approved
                question goes into the Qued question bank.
              </p>
              <Link
                href={`/submit-question?company=${data.slug}`}
                className="inline-flex items-center gap-2 rounded-xl bg-[#111] px-5 py-2.5 text-[13px] font-black text-white hover:bg-[#333] transition"
              >
                Share your experience →
              </Link>
            </div>
          </div>
        </div>

      </div>
    </main>
  );
}