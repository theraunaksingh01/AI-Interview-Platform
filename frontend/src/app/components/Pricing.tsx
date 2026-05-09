"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";

const plans = [
  {
    name: "Free",
    badge: null,
    price: "₹0",
    period: "forever",
    desc: "Start practicing with no commitment.",
    cta: "Start free",
    ctaStyle: {
      background: "white",
      color: "#111",
      border: "1.5px solid #E8E8E0",
    },
    featured: false,
    features: [
      { text: "3 mock interviews per month", included: true },
      { text: "Basic feedback report", included: true },
      { text: "General question bank", included: true },
      { text: "Single AI interviewer", included: true },
      { text: "Company-specific prep", included: false },
      { text: "Real-time coaching overlay", included: false },
      { text: "Skill Passport", included: false },
      { text: "Multi-agent panel", included: false },
    ],
  },
  {
    name: "Pro",
    badge: "Most Popular",
    price: "₹199",
    period: "per month",
    desc: "Everything you need to crack placements.",
    cta: "Start Pro — ₹199/mo",
    ctaStyle: {
      background: "#111111",
      color: "white",
      border: "none",
    },
    featured: true,
    features: [
      { text: "Unlimited mock interviews", included: true },
      { text: "Detailed actionable report", included: true },
      { text: "Company-specific prep (TCS, Amazon...)", included: true },
      { text: "Real-time coaching overlay", included: true },
      { text: "Skill Passport", included: true },
      { text: "Progress tracking & analytics", included: true },
      { text: "Multi-agent panel interview", included: true },
      { text: "Priority support", included: true },
    ],
  },
  {
    name: "Placement Cell",
    badge: null,
    price: "Custom",
    period: "per college",
    desc: "For placement officers managing batches.",
    cta: "Contact us →",
    ctaStyle: {
      background: "white",
      color: "#111",
      border: "1.5px solid #E8E8E0",
    },
    featured: false,
    features: [
      { text: "Everything in Pro", included: true },
      { text: "College admin dashboard", included: true },
      { text: "Batch student management", included: true },
      { text: "Faculty progress reports", included: true },
      { text: "Custom question bank", included: true },
      { text: "Branded experience", included: true },
      { text: "Dedicated support", included: true },
      { text: "Bulk pricing discounts", included: true },
    ],
  },
];

export function Pricing() {
  const [hovered, setHovered] = useState<number | null>(null);

  return (
    <section
      className="py-24 px-6"
      style={{ background: "#FFFDF0" }}
    >
      <div className="max-w-5xl mx-auto">

        {/* Header */}
        <div className="text-center mb-16">
          <span
            className="inline-block text-xs font-bold tracking-widest uppercase mb-4 px-4 py-1.5 rounded-full"
            style={{
              background: "#FFF9C4",
              color: "#7A6000",
              border: "1px solid #FFD600",
            }}
          >
            PRICING
          </span>
          <h2
            className="font-black leading-tight"
            style={{
              fontSize: "clamp(32px, 5vw, 52px)",
              letterSpacing: "-1.5px",
              color: "#111111",
            }}
          >
            Simple pricing
            <br />
            for{" "}
            <span
              style={{
                background: "#FFD600",
                padding: "2px 10px",
                borderRadius: "6px",
                fontStyle: "italic",
              }}
            >
              students
            </span>
          </h2>
          <p
            className="mt-4"
            style={{
              fontSize: "16px",
              color: "#666",
              lineHeight: 1.7,
            }}
          >
            No corporate pricing. No tricks. Cancel anytime.
          </p>
        </div>

        {/* Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {plans.map((plan, i) => (
            <motion.div
              key={plan.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.1 }}
              onHoverStart={() => setHovered(i)}
              onHoverEnd={() => setHovered(null)}
              style={{
                background: plan.featured ? "#111111" : "white",
                border: plan.featured
                  ? "2px solid #FFD600"
                  : "1px solid #E8E8E0",
                borderRadius: "24px",
                padding: "32px 28px",
                position: "relative",
                transform:
                  plan.featured
                    ? "scale(1.04)"
                    : hovered === i
                    ? "translateY(-4px)"
                    : "none",
                transition: "transform 0.2s ease, box-shadow 0.2s ease",
                boxShadow:
                  plan.featured
                    ? "0 20px 60px rgba(0,0,0,0.15)"
                    : hovered === i
                    ? "0 8px 32px rgba(0,0,0,0.08)"
                    : "none",
              }}
            >
              {/* Badge */}
              {plan.badge && (
                <div
                  style={{
                    position: "absolute",
                    top: "-14px",
                    left: "50%",
                    transform: "translateX(-50%)",
                    background: "#FFD600",
                    color: "#111",
                    fontSize: "11px",
                    fontWeight: 800,
                    padding: "4px 16px",
                    borderRadius: "20px",
                    whiteSpace: "nowrap",
                  }}
                >
                  {plan.badge}
                </div>
              )}

              {/* Plan name */}
              <p
                style={{
                  fontSize: "12px",
                  fontWeight: 700,
                  letterSpacing: "1px",
                  textTransform: "uppercase",
                  color: plan.featured ? "#6366F1" : "#999",
                  marginBottom: "12px",
                }}
              >
                {plan.name}
              </p>

              {/* Price */}
              <div className="flex items-baseline gap-2" style={{ marginBottom: "8px" }}>
                <span
                  style={{
                    fontSize: "42px",
                    fontWeight: 900,
                    letterSpacing: "-2px",
                    color: plan.featured ? "white" : "#111",
                  }}
                >
                  {plan.price}
                </span>
                <span
                  style={{
                    fontSize: "13px",
                    color: plan.featured ? "#666" : "#999",
                  }}
                >
                  {plan.period}
                </span>
              </div>

              <p
                style={{
                  fontSize: "13px",
                  color: plan.featured ? "#888" : "#666",
                  marginBottom: "24px",
                  lineHeight: 1.6,
                }}
              >
                {plan.desc}
              </p>

              {/* CTA */}
              <Link href={plan.name === "Placement Cell" ? "/contact" : "/signup"}>
                <button
                  style={{
                    width: "100%",
                    padding: "13px",
                    borderRadius: "12px",
                    fontSize: "14px",
                    fontWeight: 700,
                    cursor: "pointer",
                    marginBottom: "24px",
                    ...plan.ctaStyle,
                  }}
                >
                  {plan.cta}
                </button>
              </Link>

              {/* Divider */}
              <div
                style={{
                  borderTop: `1px solid ${plan.featured ? "rgba(255,255,255,0.08)" : "#F0F0EB"}`,
                  marginBottom: "20px",
                }}
              />

              {/* Features */}
              <ul className="space-y-3">
                {plan.features.map((f) => (
                  <li
                    key={f.text}
                    className="flex items-start gap-3"
                  >
                    <span
                      style={{
                        width: "18px",
                        height: "18px",
                        borderRadius: "50%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "10px",
                        fontWeight: 800,
                        flexShrink: 0,
                        marginTop: "1px",
                        background: f.included
                          ? plan.featured
                            ? "#6366F1"
                            : "#D1FAE5"
                          : plan.featured
                          ? "rgba(255,255,255,0.06)"
                          : "#F5F5F0",
                        color: f.included
                          ? plan.featured
                            ? "white"
                            : "#065F46"
                          : "#CCC",
                      }}
                    >
                      {f.included ? "✓" : "×"}
                    </span>
                    <span
                      style={{
                        fontSize: "13px",
                        color: f.included
                          ? plan.featured
                            ? "#CCC"
                            : "#444"
                          : plan.featured
                          ? "#444"
                          : "#BBB",
                        lineHeight: 1.5,
                      }}
                    >
                      {f.text}
                    </span>
                  </li>
                ))}
              </ul>
            </motion.div>
          ))}
        </div>

        {/* Bottom note */}
        <p
          className="text-center mt-10"
          style={{ fontSize: "13px", color: "#999" }}
        >
          All plans include free access to interview tips and company guides.
          <br />
          Student discount available — email us with your college ID.
        </p>
      </div>
    </section>
  );
}