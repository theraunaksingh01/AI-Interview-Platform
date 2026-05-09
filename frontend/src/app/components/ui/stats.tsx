// frontend/src/app/components/ui/stats.tsx
"use client";

import { motion } from "framer-motion";

interface StatsSectionProps {
  id?: string;
}

const stats = [
  { value: "2,400+", label: "Active Students" },
  { value: "18K+", label: "Sessions Completed" },
  { value: "4.9x", label: "Avg. Score Improvement" },
  { value: "24 min", label: "Avg. Session Time" },
];

export default function StatsSection({ id }: StatsSectionProps) {
  return (
    <section
      id={id}
      className="py-16 px-6"
      style={{ background: "#FFFDF0" }}
    >
      <div className="max-w-3xl mx-auto">

        {/* Top text */}
        <div className="text-center mb-8">
          <p
            className="mb-3"
            style={{ fontSize: "15px", color: "#555" }}
          >
            Loved by{" "}
            <strong style={{ color: "#111", fontWeight: 700 }}>
              2,400+ students
            </strong>{" "}
            across India
          </p>

          {/* Stars */}
          <div
            className="flex items-center justify-center gap-2"
            style={{ fontSize: "14px", color: "#555" }}
          >
            <span style={{ color: "#FFD600", fontSize: "18px", letterSpacing: "2px" }}>
              ★★★★★
            </span>
            <span style={{ fontWeight: 700, color: "#111" }}>4.9/5</span>
            <span style={{ color: "#999" }}>from 380+ reviews</span>
          </div>
        </div>

        {/* Stats bar */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="grid grid-cols-2 md:grid-cols-4"
          style={{
            background: "white",
            borderRadius: "16px",
            border: "1px solid #E8E8E0",
            overflow: "hidden",
          }}
        >
          {stats.map((stat, i) => (
            <div
              key={stat.label}
              className="flex flex-col items-start justify-center px-8 py-7"
              style={{
                borderRight:
                  i < stats.length - 1 ? "1px solid #F0F0EB" : "none",
              }}
            >
              <div
                className="font-black leading-none"
                style={{
                  fontSize: "clamp(28px, 4vw, 40px)",
                  letterSpacing: "-1px",
                  color: "#111111",
                }}
              >
                {stat.value}
              </div>
              <div
                className="mt-2"
                style={{ fontSize: "13px", color: "#999" }}
              >
                {stat.label}
              </div>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}