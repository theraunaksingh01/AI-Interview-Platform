// frontend/src/app/components/OAPracticeFeature.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion, useInView } from "framer-motion";

const COMPANIES = [
  { slug: "tcs",       name: "TCS NQT",      emoji: "🔷", time: 30*60,  sections: ["Numerical", "Verbal", "Reasoning"],            bands: ["Ninja","Digital","Prime"],         activeBand: 1, color: "#6366F1" },
  { slug: "infosys",   name: "Infosys SE",    emoji: "🟦", time: 25*60,  sections: ["Reasoning", "Quant", "Verbal", "Pseudo"],       bands: ["SE","SP","DSE"],                   activeBand: 1, color: "#10B981" },
  { slug: "wipro",     name: "Wipro NLTH",    emoji: "🟡", time: 20*60,  sections: ["Aptitude", "Verbal"],                           bands: ["Project Eng","Turbo"],             activeBand: 1, color: "#F59E0B" },
  { slug: "cognizant", name: "Cognizant GenC",emoji: "🔵", time: 25*60,  sections: ["Quant", "Reasoning", "Verbal"],                  bands: ["GenC","GenC Next","Elevate"],       activeBand: 1, color: "#3B82F6" },
];

function Timer({ totalSec, running }: { totalSec: number; running: boolean }) {
  const [sec, setSec] = useState(totalSec);
  useEffect(() => { setSec(totalSec); }, [totalSec]);
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setSec(s => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, [running]);
  const m = Math.floor(sec / 60).toString().padStart(2, "0");
  const s = (sec % 60).toString().padStart(2, "0");
  const isLow = sec < totalSec * 0.2;
  return (
    <span style={{
      fontFamily: "monospace",
      fontSize: 18, fontWeight: 900,
      color: isLow ? "#EF4444" : "#111",
      background: isLow ? "#FEF2F2" : "#F3F4F6",
      padding: "4px 10px", borderRadius: 8,
      letterSpacing: "0.05em",
    }}>
      {m}:{s}
    </span>
  );
}

export function OAPracticeFeature() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  const [active, setActive] = useState(0);
  const company = COMPANIES[active];

  useEffect(() => {
    if (!inView) return;
    const id = setInterval(() => setActive(a => (a + 1) % COMPANIES.length), 3500);
    return () => clearInterval(id);
  }, [inView]);

  return (
    <section ref={ref} style={{ background: "#F7F6F3", padding: "96px 24px", borderTop: "1px solid #E8E5DC", borderBottom: "1px solid #E8E5DC" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>

        {/* Eyebrow */}
        <div style={{ textAlign: "center", marginBottom: 56 }}>
          <span style={{
            display: "inline-block",
            background: "#F0EEFF", border: "1.5px solid #C4B5FD",
            borderRadius: 99, padding: "5px 16px",
            fontSize: 11, fontWeight: 800, letterSpacing: "0.1em",
            color: "#5B21B6", textTransform: "uppercase",
          }}>
            OA Practice Tests — Pro & Max
          </span>
          <h2 style={{
            marginTop: 20,
            fontSize: "clamp(28px,4vw,44px)", fontWeight: 900,
            letterSpacing: "-1.5px", lineHeight: 1.1, color: "#111",
          }}>
            Simulate the real OA.<br />
            <span style={{ color: "#9CA3AF", fontWeight: 400, fontSize: "0.75em" }}>
              Locked timers. No going back. Band prediction.
            </span>
          </h2>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1.6fr", gap: 40, alignItems: "start" }} className="oa-grid">

          {/* Left: feature list */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={inView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.5 }}
            style={{ paddingTop: 8 }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
              {[
                { icon: "⏱", title: "Locked section timers", desc: "Time runs out — section closes. Exactly how the real OA works." },
                { icon: "🔒", title: "No going back", desc: "Once you move to the next question, you cannot return." },
                { icon: "🎯", title: "Band prediction", desc: "See your Ninja / Digital / Prime prediction after each attempt." },
                { icon: "🔁", title: "50+ questions per section", desc: "Fresh questions every retake — no repeats for 5 attempts." },
              ].map(({ icon, title, desc }, i) => (
                <motion.div
                  key={title}
                  initial={{ opacity: 0, y: 12 }}
                  animate={inView ? { opacity: 1, y: 0 } : {}}
                  transition={{ delay: 0.1 + i * 0.08, duration: 0.4 }}
                  style={{
                    display: "flex", gap: 16, padding: "20px 0",
                    borderBottom: i < 3 ? "1px solid #E8E5DC" : "none",
                  }}
                >
                  <span style={{ fontSize: 22, flexShrink: 0, marginTop: 2 }}>{icon}</span>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 800, color: "#111", marginBottom: 4 }}>{title}</div>
                    <div style={{ fontSize: 13, color: "#777", lineHeight: 1.5 }}>{desc}</div>
                  </div>
                </motion.div>
              ))}
            </div>

            <div style={{ display: "flex", gap: 10, marginTop: 32, flexWrap: "wrap" }}>
              <Link href="/oa-practice" style={{ textDecoration: "none" }}>
                <div style={{
                  background: "#111", color: "white",
                  borderRadius: 10, padding: "12px 22px",
                  fontSize: 14, fontWeight: 800,
                }}>
                  Practice OA tests →
                </div>
              </Link>
              <Link href="/pricing" style={{ textDecoration: "none" }}>
                <div style={{
                  background: "white", color: "#374151",
                  border: "1.5px solid #E5E7EB",
                  borderRadius: 10, padding: "12px 22px",
                  fontSize: 14, fontWeight: 600,
                }}>
                  See plans
                </div>
              </Link>
            </div>
          </motion.div>

          {/* Right: exam window */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.1 }}
          >
            {/* Company picker */}
            <div style={{ display: "flex", gap: 6, marginBottom: 10, flexWrap: "wrap" }}>
              {COMPANIES.map((c, i) => (
                <button
                  key={c.slug}
                  onClick={() => setActive(i)}
                  style={{
                    background: active === i ? "#111" : "white",
                    color: active === i ? "white" : "#6B7280",
                    border: "1.5px solid",
                    borderColor: active === i ? "#111" : "#E5E7EB",
                    borderRadius: 99, padding: "5px 12px",
                    fontSize: 12, fontWeight: 700, cursor: "pointer",
                    transition: "all 0.18s",
                    display: "flex", alignItems: "center", gap: 5,
                  }}
                >
                  <span>{c.emoji}</span>{c.name}
                </button>
              ))}
            </div>

            {/* Exam window */}
            <motion.div
              key={active}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.22 }}
              style={{
                background: "white",
                border: "1.5px solid #E5E7EB",
                borderRadius: 16,
                overflow: "hidden",
                boxShadow: "0 4px 24px rgba(0,0,0,0.06)",
              }}
            >
              {/* Top bar */}
              <div style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "12px 18px", background: "#FAFAF8",
                borderBottom: "1px solid #F0EDE6",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 20 }}>{company.emoji}</span>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 800, color: "#111" }}>{company.name}</div>
                    <div style={{ fontSize: 11, color: "#9CA3AF" }}>Foundation track</div>
                  </div>
                  <span style={{
                    fontSize: 10, fontWeight: 800, letterSpacing: "0.06em",
                    background: "#FEE2E2", color: "#DC2626",
                    borderRadius: 4, padding: "2px 7px",
                  }}>● LIVE</span>
                </div>
                <Timer totalSec={company.time} running={inView} />
              </div>

              {/* Section tabs */}
              <div style={{
                display: "flex", gap: 4, padding: "10px 16px",
                borderBottom: "1px solid #F0EDE6", overflowX: "auto",
              }}>
                {company.sections.map((s, i) => (
                  <span key={s} style={{
                    flexShrink: 0,
                    background: i === 0 ? "#111" : "#F3F4F6",
                    color: i === 0 ? "white" : "#9CA3AF",
                    borderRadius: 7, padding: "5px 11px",
                    fontSize: 11, fontWeight: 700,
                    display: "flex", alignItems: "center", gap: 4,
                  }}>
                    {s} {i > 0 && "🔒"}
                  </span>
                ))}
              </div>

              {/* Q + options */}
              <div style={{ padding: "18px 18px 12px" }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "#9CA3AF", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 10 }}>
                  Q7 of 10 · {company.sections[0]}
                </div>
                <p style={{ fontSize: 14, color: "#374151", lineHeight: 1.65, marginBottom: 14 }}>
                  A train travels 360 km in 4 hours. A car covers the same distance in 6 hours.
                  What is the ratio of their speeds?
                </p>

                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {["2 : 3", "3 : 2", "1 : 2", "4 : 3"].map((opt, i) => (
                    <div key={opt} style={{
                      display: "flex", alignItems: "center", gap: 10,
                      padding: "9px 12px", borderRadius: 9, cursor: "pointer",
                      background: i === 1 ? "#FFFBEB" : "#FAFAF8",
                      border: i === 1 ? "1.5px solid #FFD600" : "1px solid #F3F4F6",
                    }}>
                      <span style={{
                        width: 22, height: 22, borderRadius: "50%",
                        background: i === 1 ? "#FFD600" : "#EDEDEC",
                        color: i === 1 ? "#111" : "#9CA3AF",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 10, fontWeight: 800, flexShrink: 0,
                      }}>
                        {["A","B","C","D"][i]}
                      </span>
                      <span style={{ fontSize: 13, fontWeight: i === 1 ? 700 : 400, color: i === 1 ? "#111" : "#6B7280" }}>
                        {opt}
                      </span>
                      {i === 1 && <span style={{ marginLeft: "auto", fontSize: 11, color: "#6B7280" }}>Selected</span>}
                    </div>
                  ))}
                </div>

                <div style={{ marginTop: 12, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 11, color: "#D1D5DB" }}>⚠ Cannot go back to previous questions</span>
                  <div style={{
                    background: "#111", color: "white",
                    borderRadius: 7, padding: "6px 16px",
                    fontSize: 12, fontWeight: 800, cursor: "pointer",
                  }}>Next →</div>
                </div>
              </div>

              {/* Band strip */}
              <div style={{
                borderTop: "1px solid #F3F4F6",
                padding: "10px 18px",
                display: "flex", alignItems: "center", justifyContent: "space-between",
                background: "#FAFAF8",
              }}>
                <span style={{ fontSize: 11, color: "#9CA3AF", fontWeight: 600 }}>Band prediction</span>
                <div style={{ display: "flex", gap: 5 }}>
                  {company.bands.map((b, i) => (
                    <span key={b} style={{
                      borderRadius: 99, padding: "3px 10px",
                      fontSize: 11, fontWeight: 800,
                      background: i === company.activeBand ? company.color + "18" : "transparent",
                      color: i === company.activeBand ? company.color : "#D1D5DB",
                      border: `1.5px solid ${i === company.activeBand ? company.color + "50" : "transparent"}`,
                    }}>{b}</span>
                  ))}
                </div>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </div>

      <style>{`
        @media (max-width: 700px) { .oa-grid { grid-template-columns: 1fr !important; } }
      `}</style>
    </section>
  );
}