"use client";

import * as React from "react";
import { motion } from "framer-motion";

// ── Swap this when your video is ready ──────────────────────────────
// YouTube: "https://www.youtube.com/embed/VIDEO_ID"
// Loom:    "https://www.loom.com/embed/VIDEO_ID"
// Leave null to show the placeholder thumbnail with play button.
const DEMO_VIDEO_URL: string | null = null;
// ──────────────────────────────────────────────────────────────────

export function ProductDemo() {
  const [playing, setPlaying] = React.useState(false);

  return (
    <section className="py-24 px-6" style={{ background: "#FFFDF0" }}>
      <div className="max-w-5xl mx-auto">

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="text-center mb-12"
        >
          <span
            className="text-xs font-bold tracking-widest uppercase mb-3 block"
            style={{ color: "#999" }}
          >
            Watch it work
          </span>
          <h2
            className="font-black leading-tight"
            style={{
              fontSize: "clamp(32px, 4vw, 44px)",
              letterSpacing: "-1.5px",
              color: "#111111",
            }}
          >
            See it in action
          </h2>
          <p
            className="mt-3 mx-auto"
            style={{ fontSize: "16px", color: "#666", maxWidth: "440px", lineHeight: 1.7 }}
          >
            A real mock interview session — question, voice answer, live
            coaching, and the score reveal. 90 seconds, no fluff.
          </p>
        </motion.div>

        {/* Video frame */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, ease: "easeOut", delay: 0.1 }}
          className="relative rounded-2xl overflow-hidden"
          style={{
            border: "1px solid #E8E8E0",
            boxShadow: "0 20px 60px rgba(0,0,0,0.12)",
          }}
        >
          <div className="relative aspect-video w-full bg-[#0F0F17]">

            {playing && DEMO_VIDEO_URL ? (
              <iframe
                src={`${DEMO_VIDEO_URL}${DEMO_VIDEO_URL.includes("?") ? "&" : "?"}autoplay=1`}
                title="Qued product demo"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="absolute inset-0 h-full w-full"
              />
            ) : (
              <button
                onClick={() => DEMO_VIDEO_URL && setPlaying(true)}
                className="absolute inset-0 flex flex-col items-center justify-center w-full h-full group"
                style={{ cursor: DEMO_VIDEO_URL ? "pointer" : "default" }}
              >
                {/* Thumbnail backdrop — mirrors hero product visual */}
                <div className="absolute inset-0 flex flex-col justify-between p-10"
                  style={{
                    background: "linear-gradient(135deg, #15151F 0%, #0F0F17 100%)",
                  }}
                >
                  <div className="flex justify-between items-start">
                    <span className="inline-block rounded-full bg-yellow-400/15 px-3 py-1 text-[11px] font-bold text-yellow-400">
                      QUESTION 2 OF 5
                    </span>
                  </div>
                  <div className="flex items-end gap-1 h-10 self-center opacity-40">
                    {[8, 16, 24, 14, 20, 28, 12, 18, 22, 10, 16, 24, 8, 14, 20].map((h, i) => (
                      <div key={i} className="rounded-full"
                        style={{ width: "5px", height: `${h}px`, background: "#6366F1" }} />
                    ))}
                  </div>
                </div>

                {/* Play button */}
                <div className="relative z-10 flex flex-col items-center gap-4">
                  <div
                    className="flex items-center justify-center rounded-full transition-transform duration-200 group-hover:scale-110"
                    style={{
                      width: "76px",
                      height: "76px",
                      background: "#FFD600",
                      boxShadow: "0 8px 24px rgba(255,214,0,0.35)",
                    }}
                  >
                    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" style={{ marginLeft: "3px" }}>
                      <path d="M6 4L19 12L6 20V4Z" fill="#111111" />
                    </svg>
                  </div>
                  <span className="text-[13px] font-bold text-white/70">
                    {DEMO_VIDEO_URL ? "Watch the 90-second demo" : "Demo video coming soon"}
                  </span>
                </div>
              </button>
            )}
          </div>

          {/* Caption strip */}
          <div
            className="flex items-center justify-between px-6 py-4"
            style={{ background: "white", borderTop: "1px solid #F0F0EB" }}
          >
            <p className="text-[13px] font-medium" style={{ color: "#666" }}>
              Real mock interview · Live coaching · Instant score
            </p>
            <span className="text-[12px] font-bold" style={{ color: "#999" }}>
              0:90
            </span>
          </div>
        </motion.div>
      </div>
    </section>
  );
}