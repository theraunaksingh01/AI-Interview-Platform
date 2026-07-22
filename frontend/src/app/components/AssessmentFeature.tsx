// frontend/src/app/components/AssessmentFeature.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion, useInView } from "framer-motion";

const SECTIONS = [
  { label: "Aptitude",          score: 72, color: "#6366F1" },
  { label: "CS Fundamentals",   score: 85, color: "#10B981" },
  { label: "Programming & DSA", score: 41, color: "#F59E0B" },
  { label: "Communication",     score: 58, color: "#EC4899" },
];

function AnimCount({ to, run }: { to: number; run: boolean }) {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (!run) return;
    let raf: number;
    const t0 = performance.now();
    const dur = 1000;
    const tick = (now: number) => {
      const p = Math.min((now - t0) / dur, 1);
      setV(Math.round((1 - Math.pow(1 - p, 3)) * to));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [run, to]);
  return <>{v}</>;
}

export function AssessmentFeature() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <section ref={ref} style={{ background: "#FFFDF0", padding: "96px 24px" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>

        {/* Eyebrow */}
        <div style={{ textAlign: "center", marginBottom: 56 }}>
          <span style={{
            display: "inline-block",
            background: "#FFF9C4", border: "1.5px solid #FFD600",
            borderRadius: 99, padding: "5px 16px",
            fontSize: 11, fontWeight: 800, letterSpacing: "0.1em",
            color: "#7A6000", textTransform: "uppercase",
          }}>
            Placement Readiness Assessment — Free
          </span>
          <h2 style={{
            marginTop: 20,
            fontSize: "clamp(28px,4vw,44px)", fontWeight: 900,
            letterSpacing: "-1.5px", lineHeight: 1.1, color: "#111",
          }}>
            Know exactly where you stand<br />
            <span style={{ color: "#9CA3AF", fontWeight: 400, fontSize: "0.75em" }}>
              before your first interview.
            </span>
          </h2>
        </div>

        {/* Main layout — score left, details right */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "1fr 1.4fr",
          gap: 2,
          borderRadius: 20,
          overflow: "hidden",
          border: "1.5px solid #E5E7EB",
        }} className="assess-grid">

          {/* Left panel — score */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={inView ? { opacity: 1 } : {}}
            transition={{ duration: 0.5 }}
            style={{
              background: "#111",
              padding: "48px 40px",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              minHeight: 420,
            }}
          >
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", color: "rgba(255,255,255,0.3)", textTransform: "uppercase", marginBottom: 32 }}>
                Overall Readiness Score
              </div>

              {/* Big score */}
              <div style={{ marginBottom: 8 }}>
                <span style={{
                  fontSize: 96, fontWeight: 900, letterSpacing: "-4px",
                  color: "white", lineHeight: 1,
                }}>
                  <AnimCount to={64} run={inView} />
                </span>
                <span style={{ fontSize: 28, color: "rgba(255,255,255,0.25)", fontWeight: 400 }}> /100</span>
              </div>

              <div style={{
                display: "inline-block",
                background: "#FFD600", color: "#111",
                borderRadius: 6, padding: "4px 12px",
                fontSize: 12, fontWeight: 800, marginBottom: 32,
              }}>
                Good Progress
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", display: "flex", gap: 8 }}>
                  <span style={{ color: "#F87171" }}>↓</span>
                  Biggest gap: <span style={{ color: "white" }}>Programming & DSA</span>
                </div>
                <div style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", display: "flex", gap: 8 }}>
                  <span style={{ color: "#34D399" }}>↑</span>
                  Strongest: <span style={{ color: "white" }}>CS Fundamentals</span>
                </div>
              </div>
            </div>

            <Link href="/assessment" style={{ textDecoration: "none" }}>
              <div style={{
                marginTop: 40,
                background: "white", color: "#111",
                borderRadius: 10, padding: "12px 0",
                fontSize: 14, fontWeight: 800,
                textAlign: "center", cursor: "pointer",
              }}>
                Take free assessment →
              </div>
            </Link>
          </motion.div>

          {/* Right panel — breakdown */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={inView ? { opacity: 1 } : {}}
            transition={{ duration: 0.5, delay: 0.15 }}
            style={{ background: "white", padding: "48px 40px" }}
          >
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", color: "#9CA3AF", textTransform: "uppercase", marginBottom: 32 }}>
              Section Breakdown
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
              {SECTIONS.map((s, i) => (
                <motion.div
                  key={s.label}
                  initial={{ opacity: 0, x: 16 }}
                  animate={inView ? { opacity: 1, x: 0 } : {}}
                  transition={{ delay: 0.3 + i * 0.1, duration: 0.4 }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: "#374151" }}>{s.label}</span>
                    <span style={{ fontSize: 14, fontWeight: 800, color: s.color }}>{s.score}%</span>
                  </div>
                  <div style={{ position: "relative", height: 8, background: "#F3F4F6", borderRadius: 99, overflow: "hidden" }}>
                    <motion.div
                      initial={{ width: 0 }}
                      animate={inView ? { width: `${s.score}%` } : {}}
                      transition={{ delay: 0.4 + i * 0.12, duration: 0.9, ease: [0.34, 1.1, 0.64, 1] }}
                      style={{ position: "absolute", top: 0, left: 0, height: "100%", background: s.color, borderRadius: 99 }}
                    />
                  </div>
                </motion.div>
              ))}
            </div>

            {/* What you get */}
            <div style={{
              marginTop: 36,
              background: "#FAFAF8", border: "1px solid #F0EDE6",
              borderRadius: 12, padding: "16px 20px",
            }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#9CA3AF", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 10 }}>
                What you get
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {[
                  "Gap analysis across 4 sections",
                  "Company match for TCS, Infosys, Wipro & more",
                  "3 personalised next steps",
                  "WhatsApp-shareable results card",
                ].map(item => (
                  <div key={item} style={{ fontSize: 13, color: "#555", display: "flex", gap: 8 }}>
                    <span style={{ color: "#10B981", flexShrink: 0 }}>✓</span> {item}
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </div>

        <p style={{ textAlign: "center", marginTop: 16, fontSize: 13, color: "#9CA3AF" }}>
          30 minutes · 5 sections · No login needed to take the test
        </p>
      </div>

      <style>{`
        @media (max-width: 700px) {
          .assess-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </section>
  );
}