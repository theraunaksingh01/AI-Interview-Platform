// frontend/src/app/oa-practice/[company]/error.tsx
// Catches crashes during a locked-timer OA test session.

"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function OATestError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[OATestError]", error);
  }, [error]);

  return (
    <main
      className="min-h-screen flex items-center justify-center px-6"
      style={{ background: "#FFFDF0" }}
    >
      <div className="w-full max-w-[460px] text-center">
        <div className="text-[48px] mb-4">📝</div>

        <h1
          className="font-black text-[#111] mb-3"
          style={{ fontSize: "24px", letterSpacing: "-0.5px" }}
        >
          Your test session hit a snag
        </h1>

        <p className="text-[14px] text-[#6B7280] mb-2 leading-relaxed">
          Something went wrong during this OA attempt. This won&apos;t count
          against your monthly attempts.
        </p>
        <p className="text-[13px] text-[#9CA3AF] mb-8">
          You can start a fresh attempt whenever you&apos;re ready.
        </p>

        <div className="flex items-center justify-center gap-3 flex-wrap">
          <Link href="/oa-practice">
            <button className="rounded-xl bg-[#111] px-6 py-3 text-[14px] font-black text-white hover:bg-[#333] transition">
              Try again
            </button>
          </Link>
          <Link href="/mock/dashboard">
            <button className="rounded-xl border border-[#E5E7EB] bg-white px-6 py-3 text-[14px] font-bold text-[#374151] hover:border-[#111] transition">
              Back to dashboard
            </button>
          </Link>
        </div>

        <p className="mt-8 text-[12px] text-[#C4C4C4]">
          Keeps happening? Email{" "}
          <a href="mailto:hello@qued.in" className="underline hover:text-[#111] transition-colors">
            hello@qued.in
          </a>
        </p>
      </div>
    </main>
  );
}