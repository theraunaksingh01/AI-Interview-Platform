// frontend/src/app/error.tsx
// Root error boundary — catches any unhandled render error anywhere in the app
// that isn't caught by a more specific error.tsx in a nested route

"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log to console for now — swap for a real error tracking service
    // (Sentry, LogRocket, etc.) once you have one wired up
    console.error("[GlobalError]", error);
  }, [error]);

  return (
    <main
      className="min-h-screen flex items-center justify-center px-6"
      style={{ background: "#FFFDF0" }}
    >
      <div className="w-full max-w-[440px] text-center">
        <div className="text-[48px] mb-4">⚠️</div>

        <h1
          className="font-black text-[#111] mb-3"
          style={{ fontSize: "24px", letterSpacing: "-0.5px" }}
        >
          Something went wrong
        </h1>

        <p className="text-[14px] text-[#6B7280] mb-8 leading-relaxed">
          This wasn&apos;t supposed to happen. Your progress up to this point
          should be safe — try refreshing, or head back to your dashboard.
        </p>

        <div className="flex items-center justify-center gap-3 flex-wrap">
          <button
            onClick={reset}
            className="rounded-xl bg-[#111] px-6 py-3 text-[14px] font-black text-white hover:bg-[#333] transition"
          >
            Try again
          </button>
          <Link href="/mock/dashboard">
            <button className="rounded-xl border border-[#E5E7EB] bg-white px-6 py-3 text-[14px] font-bold text-[#374151] hover:border-[#111] transition">
              Go to dashboard
            </button>
          </Link>
        </div>

        <p className="mt-8 text-[12px] text-[#C4C4C4]">
          If this keeps happening, email us at{" "}
          <a href="mailto:hello@cractal.in" className="underline hover:text-[#111] transition-colors">
            hello@cractal.in
          </a>
        </p>
      </div>
    </main>
  );
}