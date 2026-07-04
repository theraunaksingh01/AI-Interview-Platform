"use client";

import Link from "next/link";
import { useState } from "react";

export default function ContributeCard() {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  return (
    <div className="rounded-2xl border border-[#E5E7EB] bg-white overflow-hidden">
      <div className="px-6 py-5 flex items-start justify-between gap-4">

        {/* Left */}
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl bg-yellow-50 border border-yellow-200 text-[16px]">
            ⚡
          </span>
          <div className="min-w-0">
            <p className="text-[14px] font-black text-[#111] leading-snug">
              Had a real placement interview recently?
            </p>
            <p className="text-[12px] text-[#6B7280] mt-1 leading-relaxed">
              Share what they asked — every approved question earns you{" "}
              <span className="font-bold text-[#111]">+1 bonus session</span>.
              Takes 2 minutes.
            </p>
            <Link
              href="/submit-question"
              className="inline-block mt-3 rounded-xl bg-[#111] px-4 py-2 text-[12px] font-black text-white hover:bg-[#333] transition"
            >
              Contribute a question →
            </Link>
          </div>
        </div>

        {/* Dismiss */}
        <button
          onClick={() => setDismissed(true)}
          className="flex-shrink-0 text-[#D1D5DB] hover:text-[#9CA3AF] transition text-[18px] leading-none mt-0.5"
          aria-label="Dismiss"
        >
          ×
        </button>

      </div>
    </div>
  );
}