"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const companies = [
  {
    id: "all",
    label: "All Companies",
    icon: "◈",
  },
  {
    id: "tcs",
    label: "TCS",
    icon: "T",
  },
  {
    id: "infosys",
    label: "Infosys",
    icon: "I",
  },
  {
    id: "amazon",
    label: "Amazon",
    icon: "A",
  },
  {
    id: "microsoft",
    label: "Microsoft",
    icon: "M",
  },
  {
    id: "wipro",
    label: "Wipro",
    icon: "W",
  },
  {
    id: "startup",
    label: "Startup",
    icon: "S",
  },
];

type Question = {
  topic: string;
  topicColor: string;
  topicBg: string;
  title: string;
  desc: string;
  difficulty: "Easy" | "Medium" | "Hard";
  type: "voice" | "code";
  company: string;
};

const questions: Question[] = [
  // TCS
  {
    topic: "Fundamentals",
    topicColor: "#1D4ED8",
    topicBg: "#DBEAFE",
    title: "Explain OOP concepts with a real-world example",
    desc: "Walk through the four pillars of object-oriented programming using a practical example from your projects or daily life.",
    difficulty: "Easy",
    type: "voice",
    company: "tcs",
  },
  {
    topic: "Databases",
    topicColor: "#065F46",
    topicBg: "#D1FAE5",
    title: "Write a SQL query to find the second highest salary",
    desc: "Given an Employee table with columns id, name, and salary — write a query that returns the second highest salary without using LIMIT.",
    difficulty: "Medium",
    type: "code",
    company: "tcs",
  },
  {
    topic: "HR Round",
    topicColor: "#7C3AED",
    topicBg: "#EDE9FE",
    title: "Where do you see yourself in 5 years?",
    desc: "Describe your career goals and how this role at TCS fits into your long-term professional development plan.",
    difficulty: "Easy",
    type: "voice",
    company: "tcs",
  },
  // Infosys
  {
    topic: "Logical Reasoning",
    topicColor: "#9D174D",
    topicBg: "#FCE7F3",
    title: "Explain the difference between process and thread",
    desc: "What is the fundamental difference between a process and a thread? When would you use one over the other in an application?",
    difficulty: "Medium",
    type: "voice",
    company: "infosys",
  },
  {
    topic: "Communication",
    topicColor: "#92400E",
    topicBg: "#FEF3C7",
    title: "Describe a challenge you overcame in a team project",
    desc: "Using the STAR method, walk us through a situation where you had a conflict or challenge in a team and how you resolved it.",
    difficulty: "Easy",
    type: "voice",
    company: "infosys",
  },
  {
    topic: "Aptitude",
    topicColor: "#065F46",
    topicBg: "#D1FAE5",
    title: "Puzzle: 3 bulbs and 3 switches",
    desc: "There are 3 light bulbs in a room and 3 switches outside. You can only enter the room once. How do you find which switch controls which bulb?",
    difficulty: "Medium",
    type: "voice",
    company: "infosys",
  },
  // Amazon
  {
    topic: "Leadership Principles",
    topicColor: "#92400E",
    topicBg: "#FEF3C7",
    title: "Tell me about a time you took ownership",
    desc: "Describe a situation where you took ownership of a problem that wasn't strictly your responsibility. What happened and what did you learn?",
    difficulty: "Medium",
    type: "voice",
    company: "amazon",
  },
  {
    topic: "System Design",
    topicColor: "#1D4ED8",
    topicBg: "#DBEAFE",
    title: "Design a URL shortener like bit.ly",
    desc: "Walk through the complete architecture for a URL shortening service — data model, API design, hashing strategy, and how you'd scale to millions of URLs.",
    difficulty: "Hard",
    type: "voice",
    company: "amazon",
  },
  {
    topic: "Algorithms",
    topicColor: "#7C3AED",
    topicBg: "#EDE9FE",
    title: "Implement LRU Cache",
    desc: "Design and implement a data structure for Least Recently Used (LRU) cache. It should support get and put operations in O(1) time.",
    difficulty: "Hard",
    type: "code",
    company: "amazon",
  },
  // Microsoft
  {
    topic: "Problem Solving",
    topicColor: "#065F46",
    topicBg: "#D1FAE5",
    title: "Find all pairs in array that sum to target",
    desc: "Given an array of integers and a target sum, return all pairs of indices whose values add up to the target. Optimize for time complexity.",
    difficulty: "Medium",
    type: "code",
    company: "microsoft",
  },
  {
    topic: "System Design",
    topicColor: "#1D4ED8",
    topicBg: "#DBEAFE",
    title: "Design real-time notifications for 1M users",
    desc: "How would you architect a real-time notification system that needs to handle 1 million concurrent users with low latency?",
    difficulty: "Hard",
    type: "voice",
    company: "microsoft",
  },
  {
    topic: "Culture Fit",
    topicColor: "#9D174D",
    topicBg: "#FCE7F3",
    title: "How do you approach learning something new?",
    desc: "Describe your process when you need to learn an unfamiliar technology or concept quickly. Give a specific example from your experience.",
    difficulty: "Easy",
    type: "voice",
    company: "microsoft",
  },
  // Wipro
  {
    topic: "Technical",
    topicColor: "#7C3AED",
    topicBg: "#EDE9FE",
    title: "Explain SOLID principles with examples",
    desc: "Walk through each of the five SOLID principles of object-oriented design and provide a practical example for each.",
    difficulty: "Medium",
    type: "voice",
    company: "wipro",
  },
  {
    topic: "HR Round",
    topicColor: "#92400E",
    topicBg: "#FEF3C7",
    title: "Why do you want to join Wipro?",
    desc: "What specifically attracts you to Wipro over other companies? Be honest and specific — generic answers don't impress interviewers.",
    difficulty: "Easy",
    type: "voice",
    company: "wipro",
  },
  {
    topic: "Algorithms",
    topicColor: "#065F46",
    topicBg: "#D1FAE5",
    title: "Reverse a linked list without extra space",
    desc: "Given the head of a singly linked list, reverse the list in-place and return the new head. O(1) space complexity required.",
    difficulty: "Medium",
    type: "code",
    company: "wipro",
  },
  // Startup
  {
    topic: "Practical Coding",
    topicColor: "#1D4ED8",
    topicBg: "#DBEAFE",
    title: "Build a rate limiter for an API",
    desc: "Design and implement a rate limiter that restricts clients to 100 requests per minute. Discuss your approach and trade-offs.",
    difficulty: "Hard",
    type: "code",
    company: "startup",
  },
  {
    topic: "Culture Fit",
    topicColor: "#9D174D",
    topicBg: "#FCE7F3",
    title: "How do you handle ambiguity at work?",
    desc: "Startups move fast with unclear requirements. Describe a time you had to make a decision without complete information.",
    difficulty: "Medium",
    type: "voice",
    company: "startup",
  },
  {
    topic: "System Thinking",
    topicColor: "#065F46",
    topicBg: "#D1FAE5",
    title: "How would you prioritize 10 bugs with 2 days?",
    desc: "Given a list of 10 bugs of varying severity and a 2-day sprint, how would you prioritize and communicate your plan to the team?",
    difficulty: "Medium",
    type: "voice",
    company: "startup",
  },
];

const difficultyStyle = {
  Easy: { bg: "#D1FAE5", color: "#065F46" },
  Medium: { bg: "#FEF3C7", color: "#92400E" },
  Hard: { bg: "#FEE2E2", color: "#991B1B" },
};

export function CompanyPrep() {
  const [active, setActive] = useState("all");

  const filtered =
    active === "all"
      ? questions
      : questions.filter((q) => q.company === active);

  return (
    <section
      className="py-24 px-6"
      style={{ background: "#FAFAF7" }}
    >
      <div className="max-w-6xl mx-auto">

        {/* Header */}
        <div className="text-center mb-4">
          <h2
            className="font-black leading-tight mb-4"
            style={{
              fontSize: "clamp(32px, 5vw, 52px)",
              letterSpacing: "-1.5px",
              color: "#111111",
            }}
          >
            Prepare for the exact
            <br />
            company you{" "}
            <span
              style={{
                background: "#FFD600",
                padding: "2px 10px",
                borderRadius: "6px",
                fontStyle: "italic",
              }}
            >
              want
            </span>
          </h2>
          <p
            style={{
              fontSize: "16px",
              color: "#666",
              maxWidth: "480px",
              margin: "0 auto",
              lineHeight: 1.7,
            }}
          >
            Different companies test differently.
            We know the patterns — built from real interview experiences.
          </p>
        </div>

        {/* Tabs */}
        <div
          className="mt-10 mb-8 rounded-2xl p-1.5 flex items-center gap-1 overflow-x-auto"
          style={{
            background: "white",
            border: "1px solid #E8E8E0",
            scrollbarWidth: "none",
          }}
        >
          {companies.map((c) => (
            <button
              key={c.id}
              onClick={() => setActive(c.id)}
              className="flex items-center gap-2 whitespace-nowrap transition-all duration-200 flex-shrink-0"
              style={{
                padding: "10px 18px",
                borderRadius: "12px",
                fontSize: "14px",
                fontWeight: active === c.id ? 700 : 500,
                background:
                  active === c.id ? "#111111" : "transparent",
                color: active === c.id ? "white" : "#666",
                border: "none",
                cursor: "pointer",
              }}
            >
              {active === c.id && (
                <span
                  style={{
                    width: "6px",
                    height: "6px",
                    borderRadius: "50%",
                    background: "#FFD600",
                    display: "inline-block",
                  }}
                />
              )}
              {c.label}
            </button>
          ))}
        </div>

        {/* Question cards grid */}
        <AnimatePresence mode="wait">
          <motion.div
            key={active}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
          >
            {filtered.slice(0, 6).map((q, i) => (
              <motion.div
                key={`${q.company}-${i}`}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.06 }}
                whileHover={{ y: -4, transition: { duration: 0.15 } }}
                className="flex flex-col"
                style={{
                  background: "white",
                  border: "1px solid #E8E8E0",
                  borderRadius: "20px",
                  padding: "24px",
                  cursor: "pointer",
                }}
              >
                {/* Top row — topic + type */}
                <div className="flex items-center justify-between mb-4">
                  <span
                    className="text-xs font-bold px-3 py-1 rounded-full"
                    style={{
                      background: q.topicBg,
                      color: q.topicColor,
                    }}
                  >
                    {q.topic}
                  </span>
                  <span
                    className="text-xs font-bold px-2.5 py-1 rounded-full"
                    style={{
                      background:
                        q.type === "code" ? "#111" : "#F5F5F0",
                      color:
                        q.type === "code" ? "#FFD600" : "#888",
                    }}
                  >
                    {q.type === "code" ? "⌨ Code" : "🎙 Voice"}
                  </span>
                </div>

                {/* Visual placeholder — gradient bar */}
                <div
                  className="rounded-xl mb-4 flex items-center justify-center"
                  style={{
                    height: "100px",
                    background:
                      q.type === "code"
                        ? "linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)"
                        : `linear-gradient(135deg, ${q.topicBg} 0%, white 100%)`,
                    border: "1px solid #F0F0EB",
                  }}
                >
                  {q.type === "code" ? (
                    <div className="flex flex-col gap-1.5 px-4 w-full">
                      {[
                        { w: "60%", color: "#6366F1" },
                        { w: "80%", color: "#14B8A6" },
                        { w: "45%", color: "#F59E0B" },
                        { w: "70%", color: "#6366F1" },
                      ].map((line, li) => (
                        <div
                          key={li}
                          style={{
                            width: line.w,
                            height: "6px",
                            background: line.color,
                            borderRadius: "3px",
                            opacity: 0.7,
                          }}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="flex items-end gap-1 px-4">
                      {[12, 24, 18, 32, 20, 28, 16, 24, 20].map(
                        (h, wi) => (
                          <div
                            key={wi}
                            style={{
                              width: "6px",
                              height: `${h}px`,
                              background: q.topicColor,
                              borderRadius: "3px",
                              opacity: 0.4 + (wi % 3) * 0.2,
                            }}
                          />
                        )
                      )}
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className="flex-1">
                  <h3
                    className="font-bold leading-snug mb-2"
                    style={{
                      fontSize: "15px",
                      color: "#111111",
                    }}
                  >
                    {q.title}
                  </h3>
                  <p
                    style={{
                      fontSize: "13px",
                      color: "#888",
                      lineHeight: 1.65,
                    }}
                  >
                    {q.desc}
                  </p>
                </div>

                {/* Bottom row */}
                <div
                  className="flex items-center justify-between mt-4 pt-4"
                  style={{ borderTop: "1px solid #F0F0EB" }}
                >
                  <span
                    className="text-xs font-bold px-2.5 py-1 rounded-full"
                    style={{
                      background:
                        difficultyStyle[q.difficulty].bg,
                      color: difficultyStyle[q.difficulty].color,
                    }}
                  >
                    {q.difficulty}
                  </span>
                  <button
                    style={{
                      fontSize: "13px",
                      fontWeight: 700,
                      color: "#111",
                      background: "#FFD600",
                      border: "none",
                      borderRadius: "8px",
                      padding: "6px 14px",
                      cursor: "pointer",
                    }}
                  >
                    Practice →
                  </button>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </AnimatePresence>

        {/* Bottom CTA */}
        <div className="text-center mt-10">
          <p
            className="mb-4"
            style={{ fontSize: "14px", color: "#888" }}
          >
            {active === "all"
              ? "160+ questions across all companies"
              : `${filtered.length} questions for ${
                  companies.find((c) => c.id === active)?.label
                }`}
          </p>
          <button
            style={{
              background: "#111111",
              color: "white",
              fontWeight: 700,
              fontSize: "14px",
              padding: "13px 32px",
              borderRadius: "10px",
              border: "none",
              cursor: "pointer",
            }}
          >
            Start practicing free →
          </button>
        </div>
      </div>
    </section>
  );
}