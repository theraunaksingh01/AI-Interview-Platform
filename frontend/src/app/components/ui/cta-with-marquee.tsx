"use client";

import Link from "next/link";

export default function CtaVideoLeft() {
  return (
    <section className="full-bleed bg-background py-14 md:py-20">
      <div className="mx-auto max-w-7xl px-6">
        <div className="rounded-2xl border bg-background/70 backdrop-blur-sm shadow-sm p-6 md:p-10">
          <div className="grid lg:grid-cols-[1.1fr_1fr] gap-8 items-center">
            {/* LEFT: video (isolated overflow) */}
            <div className="relative">
              <div className="relative w-full overflow-hidden rounded-xl">
                <video
                  src="https://static.cdn-luma.com/files/site/api/ray2/RAY2%20API%20Launch%20Twitter_smaller.mp4"
                  autoPlay
                  loop
                  muted
                  playsInline
                  className="w-full h-auto object-cover"
                />
              </div>
            </div>

            {/* RIGHT: copy */}
            <div className="space-y-4">
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
                Experience AI-assisted interviews in minutes
              </h2>
              <p className="text-muted-foreground">
                Create a role, pick questions, and watch live AI scoring with
                transparent rubrics. Most teams set up their first interview in
                under 10 minutes.
              </p>

              <div className="flex flex-wrap gap-3 pt-2">
                <Link
                  href="#roles"
                  className="inline-flex items-center justify-center rounded-full bg-primary px-6 py-3 text-primary-foreground font-semibold hover:bg-primary/90 transition-colors"
                >
                  Create a role
                </Link>
                <Link
                  href="#videos"
                  className="inline-flex items-center justify-center rounded-full border px-6 py-3 font-semibold hover:bg-accent transition-colors"
                >
                  Watch a quick demo
                </Link>
              </div>

              {/* small trust row */}
              <div className="text-xs text-muted-foreground pt-3">
                SOC 2 ready · GDPR aligned · Bias-aware scoring
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
