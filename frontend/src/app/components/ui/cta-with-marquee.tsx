"use client";

import Link from "next/link";
import { motion } from "framer-motion";

export default function FinalCTA() {
  return (
    <section className="px-6 py-24" style={{ background: "#111111" }}>
      <div className="mx-auto max-w-3xl text-center">

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        >
          <span
            className="inline-block rounded-full px-4 py-1.5 text-[11px] font-black uppercase tracking-widest mb-6"
            style={{ background: "#1A1A1A", color: "#FFD600", border: "1px solid #2A2A2A" }}
          >
            Placement season doesn't wait
          </span>

          <h2
            style={{
              fontSize: "clamp(32px, 6vw, 56px)",
              fontWeight: 900,
              letterSpacing: "-2px",
              color: "white",
              lineHeight: 1.5,
            }}
          >
            Your next interview is{" "}
            <span style={{ background: "#FFD600", color: "#111", padding: "2px 12px", borderRadius: "8px", fontStyle: "italic" }}>
              closer than you think.
            </span>
          </h2>

          <p
            className="mx-auto mt-6 max-w-md"
            style={{ fontSize: "16px", color: "#888", lineHeight: 1.7 }}
          >
            3 free mock sessions every month. No credit card. Start practicing in under 60 seconds.
          </p>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <Link href="/signup">
              <button
                style={{
                  background: "#FFD600",
                  color: "#111",
                  fontWeight: 800,
                  fontSize: "15px",
                  padding: "15px 36px",
                  borderRadius: "12px",
                  border: "none",
                  cursor: "pointer",
                }}
                className="hover:brightness-95 transition-all active:scale-[0.98]"
              >
                Start your free mock interview →
              </button>
            </Link>
            <Link href="/pricing">
              <button
                style={{
                  background: "transparent",
                  color: "#999",
                  fontWeight: 600,
                  fontSize: "14px",
                  padding: "14px 28px",
                  borderRadius: "12px",
                  border: "1px solid #2A2A2A",
                  cursor: "pointer",
                }}
                className="hover:text-white hover:border-[#444] transition-colors"
              >
                See pricing
              </button>
            </Link>
          </div>

          <p className="mt-6 text-[12px]" style={{ color: "#555" }}>
            Free forever tier · Cancel anytime · Built for Indian campus placements
          </p>
          <hr className="mt-12 mb-6 border-gray-300" />
        </motion.div>
      </div>
    </section>
  );
}