"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const faqs = [
  {
    q: "How is Qued different from other mock interview platforms?",
    a: "Qued provides AI-driven interviews that give specific, actionable feedback — not generic scores. We tell you exactly what to fix: 'You said um 18 times on Q3 and your pace jumped to 148 WPM.' We also have company-specific question banks for TCS, Amazon, Microsoft and more, built specifically for Indian engineering students.",
  },
  {
    q: "Is there a free trial available for Qued's AI interviews?",
    a: "Yes — you get 3 free mock interviews per month with no credit card required. Free sessions include basic feedback reports and access to our general question bank. Upgrade to Pro for unlimited sessions, company-specific prep, detailed coaching reports, and your Skill Passport.",
  },
  {
    q: "Who should use Qued's AI interview coaching?",
    a: "Qued is built for final year engineering students preparing for campus placements at TCS, Infosys, Wipro, Amazon, Microsoft, and startups. If you've never done a real technical interview before, or if you've failed interviews and don't know why, Qued will tell you exactly what to fix.",
  },
  {
    q: "What is the typical length of an AI interview session?",
    a: "A standard session is 8 questions and takes approximately 24 minutes. You can choose 5, 8, or 11 questions when setting up your session. Each question allows you to answer by voice or text, and the AI coaching overlay is active throughout the session.",
  },
  {
    q: "How does Qued analyze my responses and provide feedback?",
    a: "Your voice is transcribed in real time using Faster-Whisper ASR. After each answer, Claude AI evaluates your response across three dimensions: Technical Accuracy, Communication Clarity, and Completeness. After the full session, you receive one specific action to take before your next interview.",
  },
  {
    q: "Can I customize my interview experience for different job roles?",
    a: "Yes. You choose your role (Backend, Frontend, Full Stack, Data Engineer, System Design, Software Engineer), difficulty level (Beginner, Intermediate, Advanced), and optionally the company you're targeting. The question bank serves questions specific to that combination.",
  },
];

export function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section
      style={{ background: "#FFFDF0" }}
      className="py-24 px-6"
    >
      <div className="max-w-3xl mx-auto">

        {/* Header */}
        <div className="text-center mb-16">
          <div
            className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 mb-6 text-xs font-bold tracking-widest uppercase"
            style={{
              background: "#FFF9C4",
              border: "1px solid #FFD600",
              color: "#7A6000",
            }}
          >
            FAQ
          </div>
          <h2
            className="font-black leading-tight"
            style={{
              fontSize: "clamp(32px, 5vw, 48px)",
              letterSpacing: "-1px",
              color: "#111111",
            }}
          >
            Frequently asked questions
          </h2>
          <p className="mt-4 text-gray-500" style={{ fontSize: "16px" }}>
            Everything you need to know about Qued and our AI interview platform.
          </p>
        </div>

        {/* Accordion */}
        <div className="space-y-0">
          {faqs.map((faq, i) => (
            <div
              key={i}
              className="border-b"
              style={{ borderColor: "#E8E8E0" }}
            >
              <button
                onClick={() => setOpenIndex(openIndex === i ? null : i)}
                className="w-full text-left py-6 flex items-start justify-between gap-4 group"
              >
                <span
                  className="font-bold text-base leading-snug"
                  style={{
                    color: openIndex === i ? "#111111" : "#333333",
                    fontSize: "15px",
                  }}
                >
                  {faq.q}
                </span>
                <span
                  className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-lg font-light transition-all duration-200"
                  style={{
                    background: openIndex === i ? "#FFD600" : "#F0F0EB",
                    color: "#111",
                    marginTop: "2px",
                  }}
                >
                  {openIndex === i ? "−" : "+"}
                </span>
              </button>

              <AnimatePresence initial={false}>
                {openIndex === i && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25, ease: "easeInOut" }}
                    style={{ overflow: "hidden" }}
                  >
                    <p
                      className="pb-6 leading-relaxed"
                      style={{
                        fontSize: "14px",
                        color: "#666666",
                        lineHeight: 1.75,
                      }}
                    >
                      {faq.a}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}