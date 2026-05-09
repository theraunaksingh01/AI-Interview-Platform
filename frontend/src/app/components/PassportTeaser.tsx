"use client";

import React from "react";
import { motion, useInView } from "framer-motion";
import { useRef } from "react";

const skills = [
  { label: "Technical", pct: 78, color: "#6366F1" },
  { label: "Communication", pct: 85, color: "#14B8A6" },
  { label: "Consistency", pct: 71, color: "#A78BFA" },
];

export function PassportTeaser() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true });

  return (
    <section
      className="py-28 px-6 overflow-hidden"
      style={{
        background: "linear-gradient(to bottom, #FFFDF0, #EEF2FF)",
      }}
    >
      <div className="max-w-6xl mx-auto">

        {/* Header */}
        <div className="text-center mb-20">
          <span
            className="inline-block text-xs font-bold tracking-widest uppercase mb-4 px-4 py-1.5 rounded-full"
            style={{
              background: "#EEF2FF",
              color: "#6366F1",
              border: "1px solid #C7D2FE",
            }}
          >
            SKILL PASSPORT
          </span>
          <h2
            className="font-black leading-tight"
            style={{
              fontSize: "clamp(32px, 5vw, 52px)",
              letterSpacing: "-1.5px",
              color: "#111111",
            }}
          >
            Every session builds
            <br />
            your verified profile
          </h2>
          <p
            className="mt-4 mx-auto"
            style={{
              fontSize: "16px",
              color: "#666",
              maxWidth: "440px",
              lineHeight: 1.7,
            }}
          >
            Track improvement over time. Share proof
            of preparation — not just claims.
          </p>
        </div>

        {/* Main visual */}
        <div
          ref={ref}
          className="relative flex justify-center items-center"
          style={{ minHeight: "420px" }}
        >

          {/* Floating card — left */}
          <motion.div
            initial={{ opacity: 0, x: -40 }}
            animate={inView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="absolute hidden lg:block"
            style={{ left: "2%", top: "10%" }}
          >
            <div
              style={{
                background: "white",
                border: "1px solid #E8E8E0",
                borderRadius: "16px",
                padding: "18px 20px",
                width: "170px",
                boxShadow: "0 4px 24px rgba(0,0,0,0.06)",
              }}
            >
              <p style={{ fontSize: "11px", color: "#999", marginBottom: "8px" }}>
                📈 Improvement
              </p>
              <p style={{ fontSize: "13px", fontWeight: 700, color: "#111" }}>
                Technical
              </p>
              <p style={{ fontSize: "22px", fontWeight: 900, color: "#6366F1" }}>
                45 → 78
              </p>
              <p style={{ fontSize: "11px", color: "#999" }}>in 4 weeks</p>
            </div>
          </motion.div>

          {/* Floating card — top right */}
          <motion.div
            initial={{ opacity: 0, x: 40 }}
            animate={inView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="absolute hidden lg:block"
            style={{ right: "2%", top: "5%" }}
          >
            <div
              style={{
                background: "#6366F1",
                borderRadius: "16px",
                padding: "18px 20px",
                width: "160px",
                boxShadow: "0 4px 24px rgba(99,102,241,0.3)",
              }}
            >
              <p style={{ fontSize: "11px", color: "#C7D2FE", marginBottom: "8px" }}>
                Sessions this week
              </p>
              <p style={{ fontSize: "40px", fontWeight: 900, color: "white", lineHeight: 1 }}>
                7
              </p>
              <p style={{ fontSize: "11px", color: "#A5B4FC", marginTop: "4px" }}>
                ↑ 3 from last week
              </p>
            </div>
          </motion.div>

          {/* Floating card — bottom right */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.5 }}
            className="absolute hidden lg:block"
            style={{ right: "3%", bottom: "5%" }}
          >
            <div
              style={{
                background: "white",
                border: "1px solid #E8E8E0",
                borderRadius: "16px",
                padding: "16px 18px",
                width: "158px",
                boxShadow: "0 4px 24px rgba(0,0,0,0.06)",
              }}
            >
              <p style={{ fontSize: "11px", color: "#999", marginBottom: "10px" }}>
                🏢 Practiced for
              </p>
              <div className="flex flex-col gap-1.5">
                {["TCS", "Amazon", "Microsoft"].map((c) => (
                  <span
                    key={c}
                    style={{
                      fontSize: "11px",
                      fontWeight: 700,
                      background: "#EEF2FF",
                      color: "#6366F1",
                      borderRadius: "20px",
                      padding: "3px 10px",
                      display: "inline-block",
                      width: "fit-content",
                    }}
                  >
                    {c}
                  </span>
                ))}
              </div>
            </div>
          </motion.div>

          {/* Passport card — center */}
          <motion.div
            initial={{ opacity: 0, y: 40, scale: 0.95 }}
            animate={inView ? { opacity: 1, y: 0, scale: 1 } : {}}
            transition={{ duration: 0.7, ease: "easeOut" }}
            style={{
              background: "#111111",
              borderRadius: "28px",
              padding: "36px",
              width: "340px",
              position: "relative",
              zIndex: 10,
              boxShadow: "0 32px 64px rgba(0,0,0,0.2)",
              border: "1px solid rgba(255,255,255,0.08)",
            }}
          >
            {/* Subtle gradient overlay */}
            <div
              style={{
                position: "absolute",
                inset: 0,
                borderRadius: "28px",
                background:
                  "radial-gradient(circle at 30% 20%, rgba(99,102,241,0.15) 0%, transparent 60%)",
                pointerEvents: "none",
              }}
            />

            {/* Top row */}
            <div
              className="flex justify-between items-center"
              style={{ marginBottom: "24px" }}
            >
              <span
                style={{
                  fontSize: "11px",
                  fontWeight: 700,
                  letterSpacing: "1px",
                  color: "#6366F1",
                }}
              >
                ◆ QUED PASSPORT
              </span>
              <div
                style={{
                  width: "8px",
                  height: "8px",
                  borderRadius: "50%",
                  background: "#6366F1",
                  animation: "pulse 2s infinite",
                }}
              />
            </div>

            {/* Name */}
            <p style={{ fontSize: "26px", fontWeight: 900, color: "white", letterSpacing: "-0.5px" }}>
              Raunak Singh
            </p>
            <p style={{ fontSize: "13px", color: "#666", marginTop: "4px" }}>
              Backend Engineer · Final Year
            </p>

            {/* Divider */}
            <div
              style={{
                borderTop: "1px solid rgba(255,255,255,0.08)",
                margin: "20px 0",
              }}
            />

            {/* Stats row */}
            <div className="grid grid-cols-3 gap-3" style={{ marginBottom: "20px" }}>
              {[
                { val: "24", label: "Sessions" },
                { val: "84", label: "Best score" },
                { val: "🔥 12", label: "Day streak" },
              ].map((s) => (
                <div key={s.label}>
                  <p style={{ fontSize: "20px", fontWeight: 900, color: "white" }}>
                    {s.val}
                  </p>
                  <p style={{ fontSize: "11px", color: "#555", marginTop: "2px" }}>
                    {s.label}
                  </p>
                </div>
              ))}
            </div>

            {/* Skill bars */}
            <div className="space-y-3">
              {skills.map((s, i) => (
                <div key={s.label}>
                  <div
                    className="flex justify-between"
                    style={{ marginBottom: "6px" }}
                  >
                    <span style={{ fontSize: "12px", color: "#888" }}>
                      {s.label}
                    </span>
                    <span style={{ fontSize: "12px", color: "white", fontWeight: 700 }}>
                      {s.pct}%
                    </span>
                  </div>
                  <div
                    style={{
                      background: "rgba(255,255,255,0.08)",
                      borderRadius: "4px",
                      height: "6px",
                    }}
                  >
                    <motion.div
                      initial={{ width: 0 }}
                      animate={inView ? { width: `${s.pct}%` } : {}}
                      transition={{ duration: 1, delay: 0.8 + i * 0.15 }}
                      style={{
                        background: s.color,
                        height: "6px",
                        borderRadius: "4px",
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Bottom */}
            <div
              className="flex justify-between items-center"
              style={{
                marginTop: "24px",
                paddingTop: "20px",
                borderTop: "1px solid rgba(255,255,255,0.08)",
              }}
            >
              <span style={{ fontSize: "11px", color: "#444", fontFamily: "monospace" }}>
                qued.in/passport/raunak-singh
              </span>
              <button
                style={{
                  background: "#6366F1",
                  color: "white",
                  fontSize: "12px",
                  fontWeight: 700,
                  padding: "6px 16px",
                  borderRadius: "20px",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                Share
              </button>
            </div>
          </motion.div>
        </div>

        {/* 3 feature points */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-20 text-center">
          {[
            {
              icon: "📊",
              title: "Track growth",
              desc: "See Technical, Communication, and Structure improving session by session.",
            },
            {
              icon: "✓",
              title: "Verified practice",
              desc: "Not self-reported — AI evaluated sessions with real scores.",
            },
            {
              icon: "🔗",
              title: "Share your profile",
              desc: "Coming soon: recruiters can view your passport and skip screening.",
            },
          ].map((p) => (
            <div key={p.title}>
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4 text-xl"
                style={{ background: "#EEF2FF" }}
              >
                {p.icon}
              </div>
              <h3
                style={{
                  fontSize: "15px",
                  fontWeight: 700,
                  color: "#111",
                  marginBottom: "8px",
                }}
              >
                {p.title}
              </h3>
              <p style={{ fontSize: "13px", color: "#888", lineHeight: 1.7 }}>
                {p.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}