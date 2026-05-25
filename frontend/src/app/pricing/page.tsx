"use client";

import Link from "next/link";
import { Fragment } from "react";

// ─── Data ─────────────────────────────────────────────────────────────────────

const tiers = [
  {
    name: "Free",
    price: "₹0",
    period: "forever",
    desc: "Start practicing, no commitment.",
    cta: "Get started",
    ctaHref: "/signup",
    dark: false,
    badge: null,
  },
  {
    name: "Pro",
    price: "₹149",
    period: "/ month",
    desc: "Everything to crack placements.",
    cta: "Start Pro",
    ctaHref: "/signup",
    dark: true,
    badge: "Most Popular",
  },
  {
    name: "Max",
    price: "₹299",
    period: "/ month",
    desc: "For serious candidates who want every edge.",
    cta: "Start Max",
    ctaHref: "/signup",
    dark: false,
    badge: null,
  },
] as const;

type FeatureValue = boolean | string;

interface FeatureRow {
  label: string;
  section?: string;
  free: FeatureValue;
  pro: FeatureValue;
  max: FeatureValue;
}

const features: FeatureRow[] = [
  { label: "Sessions per month",         section: "Core",      free: "3 / month",  pro: "Unlimited",     max: "Unlimited" },
  { label: "Questions per session",                             free: "5",          pro: "8",             max: "11" },
  { label: "Score after interview",                             free: true,         pro: true,            max: true },
  { label: "What was missing",                                  free: true,         pro: true,            max: true },
  { label: "Streak tracking",                                   free: true,         pro: true,            max: true },
  { label: "Model answers",              section: "Report",    free: false,        pro: true,            max: true },
  { label: "Full communication report",                         free: false,        pro: true,            max: true },
  { label: "WPM + filler word analysis",                        free: false,        pro: true,            max: true },
  { label: "STAR method scoring",                               free: false,        pro: true,            max: true },
  { label: "Session history + trends",   section: "Progress",  free: false,        pro: true,            max: true },
  { label: "Improvement graph",                                 free: false,        pro: true,            max: true },
  { label: "Weak spot detector",                                free: false,        pro: "Coming soon",   max: "Coming soon" },
  { label: "Company-specific prep",      section: "Advanced",  free: false,        pro: true,            max: true },
  { label: "Follow-up questions",                               free: false,        pro: true,            max: true },
  { label: "Skill Passport",                                    free: false,        pro: true,            max: true },
  { label: "Retry answer on report",                            free: false,        pro: false,           max: true },
  { label: "Multi-agent panel",                                 free: false,        pro: "Coming soon",   max: "Coming soon" },
  { label: "Personal training plan",                            free: false,        pro: false,           max: "Coming soon" },
];

const faqs = [
  { q: "Can I cancel anytime?", a: "Yes. No lock-in, no cancellation fees. Cancel from your account settings anytime." },
  { q: "What payment methods do you accept?", a: "Razorpay integration is coming soon. Reach out to us directly until then." },
  { q: "Is there a student discount?", a: "Yes — email us with your college ID for a discount on Pro or Max." },
  { q: "What happens to my data if I downgrade?", a: "All your sessions and reports are preserved. You just lose access to locked features." },
];

// ─── Cell ─────────────────────────────────────────────────────────────────────

function FeatureCell({ value, colIndex }: { value: FeatureValue; colIndex: number }) {
  const isProCol = colIndex === 1;

  if (value === true) {
    return (
      <span className={`inline-flex h-[22px] w-[22px] items-center justify-center rounded-full text-[11px] font-bold ${
        isProCol ? "bg-[#111] text-white" : "bg-[#ECFDF5] text-emerald-600"
      }`}>
        ✓
      </span>
    );
  }

  if (value === false) {
    return <span className="text-[#D1D5DB] text-base font-light select-none">—</span>;
  }

  if (String(value).toLowerCase().includes("coming")) {
    return (
      <span className="inline-block rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-600">
        Soon
      </span>
    );
  }

  return (
    <span className={`inline-block rounded-lg px-2.5 py-0.5 text-[12px] font-bold ${
      isProCol ? "bg-white text-[#111]" : "bg-[#F3F4F6] text-[#374151]"
    }`}>
      {value}
    </span>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PricingPage() {
  return (
    <main className="min-h-screen bg-[#F9FAFB] pt-20">

      {/* ── Hero ── */}
      <section className="px-4 pb-14 pt-12 text-center sm:px-8">
        <p className="mb-4 text-[11px] font-black uppercase tracking-widest text-[#9CA3AF]">
          Pricing
        </p>
        <h1 className="mx-auto max-w-[560px] text-[38px] font-black leading-[1.3] tracking-tight text-[#111] sm:text-[52px]">
          Plans built for{" "}
          <span className="bg-yellow-400 px-2 rounded-md italic">
            students
          </span>
        </h1>
        <p className="mx-auto mt-5 max-w-[400px] text-[15px] leading-relaxed text-[#6B7280]">
          No corporate pricing. No tricks. Cancel anytime.
        </p>
      </section>

      <section className="mx-auto max-w-[1100px] px-4 pb-24 sm:px-6">

        {/* ── Desktop comparison table ── */}
        <div className="hidden overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white shadow-sm sm:block">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                {/* Label column */}
                <th className="w-[34%] border-b border-[#E5E7EB] bg-[#F9FAFB] px-8 py-7 text-left">
                  <span className="text-[15px] font-bold text-[#374151]">Features</span>
                </th>

                {tiers.map((tier) => (
                  <th
                    key={tier.name}
                    className={`border-b border-[#E5E7EB] px-6 py-7 text-center align-top ${
                      tier.dark ? "bg-[#111]" : "bg-white"
                    }`}
                  >
                    {/* Badge */}
                    <div className="mb-2 flex h-5 justify-center">
                      {tier.badge && (
                        <span className="rounded-full bg-yellow-400 px-2.5 py-0.5 text-[10px] font-black text-[#111]">
                          {tier.badge}
                        </span>
                      )}
                    </div>

                    {/* Name */}
                    <p className={`text-[11px] font-black uppercase tracking-widest mb-2 ${
                      tier.dark ? "text-[#9CA3AF]" : "text-[#9CA3AF]"
                    }`}>
                      {tier.name}
                    </p>

                    {/* Price */}
                    <div className="flex items-baseline justify-center gap-1 mb-1">
                      <span className={`text-[32px] font-black leading-none ${
                        tier.dark ? "text-white" : "text-[#111]"
                      }`}>
                        {tier.price}
                      </span>
                      <span className={`text-[12px] ${tier.dark ? "text-[#9CA3AF]" : "text-[#9CA3AF]"}`}>
                        {tier.period}
                      </span>
                    </div>

                    {/* Desc */}
                    <p className={`text-[12px] mb-5 leading-snug ${
                      tier.dark ? "text-[#6B7280]" : "text-[#9CA3AF]"
                    }`}>
                      {tier.desc}
                    </p>

                    {/* CTA */}
                    <Link href={tier.ctaHref}>
                      <button className={`w-full rounded-xl py-2.5 text-[13px] font-bold transition ${
                        tier.dark
                          ? "bg-white text-[#111] hover:bg-gray-100"
                          : "bg-[#111] text-white hover:bg-[#333]"
                      }`}>
                        {tier.cta}
                      </button>
                    </Link>
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {features.map((row, i) => (
                <Fragment key={`row-${i}`}>
                  {/* Section header */}
                  {row.section && (
                    <tr>
                      <td
                        colSpan={4}
                        className="border-t-2 border-[#E5E7EB] bg-[#F3F4F6] px-8 py-3"
                      >
                        <span className="text-[12px] font-black uppercase tracking-widest text-[#374151]">
                          {row.section}
                        </span>
                      </td>
                    </tr>
                  )}

                  {/* Feature row */}
                  <tr className="border-t border-[#F3F4F6] hover:bg-[#FAFAFA] transition">
                    <td className="px-8 py-4 text-[14px] text-[#374151]">
                      {row.label}
                    </td>
                    {([row.free, row.pro, row.max] as FeatureValue[]).map((val, j) => (
                      <td
                        key={j}
                        className={`px-6 py-4 text-center ${
                          j === 1 ? "bg-[#111]/[0.015]" : ""
                        }`}
                      >
                        <FeatureCell value={val} colIndex={j} />
                      </td>
                    ))}
                  </tr>
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>

        {/* ── Mobile tier cards ── */}
        <div className="space-y-4 sm:hidden">
          {tiers.map((tier) => (
            <div
              key={tier.name}
              className={`relative rounded-2xl p-6 ${
                tier.dark ? "bg-[#111]" : "border border-[#E5E7EB] bg-white"
              }`}
            >
              {tier.badge && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-yellow-400 px-3 py-0.5 text-[11px] font-black text-[#111]">
                  {tier.badge}
                </span>
              )}
              <p className={`text-[11px] font-black uppercase tracking-widest mb-2 ${
                tier.dark ? "text-[#9CA3AF]" : "text-[#9CA3AF]"
              }`}>
                {tier.name}
              </p>
              <div className="flex items-baseline gap-1 mb-1">
                <span className={`text-[34px] font-black ${tier.dark ? "text-white" : "text-[#111]"}`}>
                  {tier.price}
                </span>
                <span className={`text-[13px] ${tier.dark ? "text-[#9CA3AF]" : "text-[#9CA3AF]"}`}>
                  {tier.period}
                </span>
              </div>
              <p className={`text-[13px] mb-5 ${tier.dark ? "text-[#6B7280]" : "text-[#9CA3AF]"}`}>
                {tier.desc}
              </p>
              <Link href={tier.ctaHref}>
                <button className={`w-full rounded-xl py-2.5 text-[13px] font-bold transition ${
                  tier.dark
                    ? "bg-white text-[#111] hover:bg-gray-100"
                    : "bg-[#111] text-white hover:bg-[#333]"
                }`}>
                  {tier.cta}
                </button>
              </Link>
            </div>
          ))}
        </div>

        {/* ── FAQ ── */}
        <div className="mt-10 rounded-2xl border border-[#E5E7EB] bg-white p-6 sm:p-8">
          <h2 className="mb-6 text-[17px] font-bold text-[#111]">Common questions</h2>
          <div className="grid gap-6 sm:grid-cols-2">
            {faqs.map(({ q, a }) => (
              <div key={q}>
                <p className="text-[13px] font-semibold text-[#111] mb-1">{q}</p>
                <p className="text-[13px] text-[#6B7280] leading-relaxed">{a}</p>
              </div>
            ))}
          </div>
        </div>

        <p className="mt-8 text-center text-[13px] text-[#9CA3AF]">
          Student discount available — email us with your college ID.
        </p>

      </section>
    </main>
  );
}