"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const testimonials = [
  {
    quote:
      "I fumbled every mock I did with friends. After 2 weeks on Qued I could actually structure my answers. Cracked TCS and Infosys both in the same placement season.",
    name: "Priya S.",
    role: "Final Year CSE, VIT Vellore",
    bg: "#FFE4E6",
    rotate: "-4deg",
    zIndex: 1,
  },
  {
    quote:
      "The feedback was brutally specific. Not 'improve communication' — it said I used 18 filler words and my pace jumped on Q3. That kind of feedback you don't get from friends or YouTube.",
    name: "Arjun K.",
    role: "CSE 2025, Amity University",
    bg: "#FEF08A",
    rotate: "-1deg",
    zIndex: 2,
  },
  {
    quote:
      "Prepared for Amazon SDE-1 in 3 weeks. The company-specific questions and Leadership Principles prep was accurate to what actually came up in the real interview.",
    name: "Rahul M.",
    role: "Final Year, IIIT Hyderabad",
    bg: "#D8B4FE",
    rotate: "2deg",
    zIndex: 3,
  },
  {
    quote:
      "As someone from a Tier 3 college I always felt like I had no access to good coaching. Qued changed that completely. Got placed at Wipro and Accenture both.",
    name: "Sneha R.",
    role: "IT 2025, LNCT Bhopal",
    bg: "#FED7AA",
    rotate: "5deg",
    zIndex: 2,
  },
  {
    quote:
      "I failed 4 campus interviews before Qued. What I was missing was not knowledge — it was how to present what I know. The WPM tracker made me realize I speak way too fast when nervous. Fixed it in a week.",
    name: "Karan P.",
    role: "Final Year, SRM Chennai",
    bg: "#D1FAE5",
    rotate: "8deg",
    zIndex: 1,
  },
];

export function Testimonials() {
  const [showAll, setShowAll] = useState(false);

  return (
    <section
      className="py-24 px-6 overflow-hidden"
      style={{ background: "#F5F5F0" }}
    >
      <div className="max-w-6xl mx-auto">

        {/* Header row */}
        <div className="flex items-start justify-between mb-16 gap-6">
          <div>
            <h2
              className="font-black leading-none mb-4"
              style={{
                fontSize: "clamp(36px, 5vw, 64px)",
                letterSpacing: "-2px",
                color: "#111111",
                textTransform: "uppercase",
                lineHeight: 1,
              }}
            >
              STUDENTS WHO
              <br />
              GOT LOUD
            </h2>
            <p
              style={{
                fontSize: "15px",
                color: "#666",
                lineHeight: 1.7,
                maxWidth: "480px",
              }}
            >
              Great practice creates confidence, and confidence gets loud.
              Here's what students shared after cracking their placement
              interviews.
            </p>
          </div>

          {/* More praise button */}
          <motion.button
            onClick={() => setShowAll(!showAll)}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.97 }}
            className="flex items-center gap-2 flex-shrink-0"
            style={{
              background: "#A3E635",
              color: "#111",
              fontWeight: 700,
              fontSize: "14px",
              padding: "12px 20px",
              borderRadius: "100px",
              border: "none",
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            {showAll ? "Show less" : "More praise"}
            <span
              style={{
                width: "28px",
                height: "28px",
                borderRadius: "50%",
                background: "#84CC16",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "16px",
                fontWeight: 900,
              }}
            >
              ↗
            </span>
          </motion.button>
        </div>

        {/* Fanned cards row */}
        <div
          className="relative flex items-end justify-center"
          style={{
            height: "360px",
            perspective: "1200px",
          }}
        >
          {testimonials.map((t, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 60 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              whileHover={{
                rotate: "0deg",
                y: -16,
                zIndex: 10,
                transition: { duration: 0.2 },
              }}
              style={{
                background: t.bg,
                rotate: t.rotate,
                zIndex: t.zIndex,
                width: "clamp(200px, 22vw, 280px)",
                minHeight: "300px",
                borderRadius: "20px",
                padding: "28px 24px",
                position: "absolute",
                left: `${i * 18}%`,
                bottom: 0,
                cursor: "pointer",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                boxShadow: "0 4px 24px rgba(0,0,0,0.08)",
              }}
            >
              {/* Quote mark */}
              <div
                style={{
                  fontSize: "48px",
                  lineHeight: 1,
                  color: "rgba(0,0,0,0.15)",
                  fontFamily: "Georgia, serif",
                  marginBottom: "8px",
                }}
              >
                "
              </div>

              {/* Quote text */}
              <p
                style={{
                  fontSize: "14px",
                  color: "#111111",
                  lineHeight: 1.7,
                  fontWeight: 500,
                  flex: 1,
                }}
              >
                "{t.quote}"
              </p>

              {/* Person */}
              <div
                className="flex items-center gap-3 mt-6 pt-4"
                style={{ borderTop: "1px solid rgba(0,0,0,0.08)" }}
              >
                {/* Avatar initial circle */}
                <div
                  style={{
                    width: "36px",
                    height: "36px",
                    borderRadius: "50%",
                    background: "rgba(0,0,0,0.12)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "14px",
                    fontWeight: 800,
                    color: "#111",
                    flexShrink: 0,
                  }}
                >
                  {t.name[0]}
                </div>
                <div>
                  <div
                    style={{
                      fontSize: "13px",
                      fontWeight: 700,
                      color: "#111",
                    }}
                  >
                    {t.name}
                  </div>
                  <div
                    style={{
                      fontSize: "11px",
                      color: "rgba(0,0,0,0.5)",
                      marginTop: "1px",
                      textTransform: "uppercase",
                      letterSpacing: "0.3px",
                    }}
                  >
                    {t.role}
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Extra testimonials when "More praise" clicked */}
        <AnimatePresence>
          {showAll && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.4 }}
              className="overflow-hidden"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-8">
                {[
                  {
                    quote:
                      "I failed 4 campus interviews before Qued. What I was missing was not knowledge — it was how to present what I know. Fixed it in 2 weeks.",
                    name: "Karan P.",
                    role: "Final Year, SRM Chennai",
                    bg: "#D1FAE5",
                  },
                  {
                    quote:
                      "The streak feature kept me consistent. Practiced every day for 3 weeks before placements. Got 2 offers. Worth every rupee.",
                    name: "Meera K.",
                    role: "CSE, BITS Pilani",
                    bg: "#E0F2FE",
                  },
                  {
                    quote:
                      "Company-specific questions are real — not generic. TCS pattern was spot on. Got selected in the first round.",
                    name: "Divya M.",
                    role: "IT 2025, Bennett University",
                    bg: "#FEF3C7",
                  },
                  {
                    quote:
                      "I liked that it told me ONE specific thing to fix after each session. Not 10 things. Just one. Actually actionable.",
                    name: "Aditya S.",
                    role: "Final Year, DTU Delhi",
                    bg: "#FCE7F3",
                  },
                ].map((t, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.1 }}
                    style={{
                      background: t.bg,
                      borderRadius: "16px",
                      padding: "24px",
                    }}
                  >
                    <p
                      style={{
                        fontSize: "14px",
                        color: "#111",
                        lineHeight: 1.7,
                        fontWeight: 500,
                        marginBottom: "16px",
                      }}
                    >
                      "{t.quote}"
                    </p>
                    <div>
                      <div
                        style={{
                          fontSize: "13px",
                          fontWeight: 700,
                          color: "#111",
                        }}
                      >
                        {t.name}
                      </div>
                      <div
                        style={{
                          fontSize: "11px",
                          color: "rgba(0,0,0,0.5)",
                          textTransform: "uppercase",
                          letterSpacing: "0.3px",
                          marginTop: "2px",
                        }}
                      >
                        {t.role}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </section>
  );
}