// frontend/src/app/components/HeroSection.tsx
"use client";

import React from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import AnimatedGroup from "@/app/components/ui/animated-group";
import { motion } from "framer-motion";

const transitionVariants = {
  item: {
    hidden: { opacity: 0, filter: "blur(12px)", y: 12 },
    visible: {
      opacity: 1,
      filter: "blur(0px)",
      y: 0,
      transition: { type: "spring", bounce: 0.3, duration: 1.5 },
    },
  },
};

const logos: { src: string; alt: string }[] = [];

const FloatingCard = ({
  className,
  rotate,
  delay = 0,
  children,
}: {
  className?: string;
  rotate: string;
  delay?: number;
  children: React.ReactNode;
}) => (
  <motion.div
    className={`absolute hidden lg:block pointer-events-none bg-white border border-gray-200 rounded-xl shadow-md p-3 ${className ?? ""}`}
    style={{ rotate }}
    animate={{ y: [0, -8, 0] }}
    transition={{
      duration: 3.5 + delay,
      repeat: Infinity,
      ease: "easeInOut",
      delay,
    }}
  >
    {children}
  </motion.div>
);

export function HeroSection() {
  return (
    <main className="overflow-hidden" style={{ background: "#FFFDF0" }}>

      {/* ── HERO ── */}
      <section className="relative">
        <div className="relative pt-32 pb-0 text-center">

          {/* Floating decorative cards */}
          <FloatingCard
            className="left-[6%] top-[38%] w-32"
            rotate="-8deg"
            delay={0}
          >
            <div className="space-y-1.5 mb-2">
              <div className="h-1.5 w-full bg-gray-200 rounded" />
              <div className="h-1.5 w-4/5 bg-gray-200 rounded" />
              <div className="h-1.5 w-3/4 bg-yellow-300 rounded" />
            </div>
            <p className="text-[10px] text-gray-300 font-medium">
              Interview Score
            </p>
          </FloatingCard>

          <FloatingCard
            className="right-[6%] top-[38%] w-28"
            rotate="6deg"
            delay={0.5}
          >
            <div className="space-y-1.5 mb-2">
              <div className="h-1.5 w-full bg-gray-200 rounded" />
              <div className="h-1.5 w-3/4 bg-gray-200 rounded" />
              <div className="h-1.5 w-1/2 bg-gray-200 rounded" />
            </div>
            <p className="text-[10px] text-gray-300 font-medium">
              AI Feedback
            </p>
          </FloatingCard>

          <FloatingCard
            className="left-[4%] top-[58%] w-36"
            rotate="-4deg"
            delay={1}
          >
            <div className="space-y-1.5 mb-3">
              <div className="h-1.5 w-full bg-gray-200 rounded" />
              <div className="h-1.5 w-4/5 bg-gray-200 rounded" />
            </div>
            <span className="inline-block bg-yellow-100 text-yellow-800 text-[10px] font-bold px-2 py-0.5 rounded">
              ✓ Passed
            </span>
          </FloatingCard>

          <FloatingCard
            className="right-[5%] top-[55%] w-28"
            rotate="5deg"
            delay={1.5}
          >
            <div className="space-y-1.5 mb-2">
              <div className="h-1.5 w-full bg-gray-200 rounded" />
              <div className="h-1.5 w-2/3 bg-indigo-200 rounded" />
              <div className="h-1.5 w-3/4 bg-gray-200 rounded" />
            </div>
            <p className="text-[10px] text-gray-300 font-medium">
              Report Ready
            </p>
          </FloatingCard>

          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="inline-flex items-center gap-2 bg-white border border-gray-200 rounded-full px-4 py-1.5 shadow-sm mb-8"
          >
            <span className="w-4 h-4 rounded-sm bg-yellow-400 flex items-center justify-center text-[10px] font-black text-yellow-900">
              ✦
            </span>
            <span className="text-sm font-semibold text-gray-600">
              Next-Gen AI Technology
            </span>
          </motion.div>

          {/* Heading */}
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="mx-auto max-w-3xl px-2"
            style={{
              fontSize: "clamp(40px, 6vw, 68px)",
              fontWeight: 900,
              letterSpacing: "-2px",
              lineHeight: 1.3,
              color: "#111111",
            }}
          >
            Practice for your exact
            <br />
           
            <span
              style={{
                background: "#FFD600",
                color: "#111111",
                padding: "2px 12px",
                borderRadius: "6px",
                fontStyle: "italic",
                display: "inline",
              }}
            >
              Placement  Interview
            </span>
          </motion.h1>

          {/* Subtext */}
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.35 }}
            className="mx-auto mt-6 max-w-xl px-6"
            style={{
              fontSize: "17px",
              color: "#666666",
              lineHeight: 1.65,
            }}
          >
            Mock interviews with the same questions TCS, Infosys, and Amazon 
            actually ask at campus drives. Speak your answer. Get scored instantly. 
            See what you should have said.
          </motion.p>

          {/* Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.5 }}
            className="mt-8 flex items-center justify-center gap-3 flex-wrap px-6"
          >
            <Link href="/mock">
              <button
                style={{
                  background: "#111111",
                  color: "white",
                  fontWeight: 700,
                  fontSize: "14px",
                  padding: "12px 24px",
                  borderRadius: "8px",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                Start Free Mock Interview
              </button>
            </Link>
            <Link href="#how-it-works">
              <button
                style={{
                  background: "white",
                  color: "#111111",
                  fontWeight: 600,
                  fontSize: "14px",
                  padding: "11px 24px",
                  borderRadius: "8px",
                  border: "1.5px solid #ddd",
                  cursor: "pointer",
                }}
              >
                Watch How It Works
              </button>
            </Link>
          </motion.div>

          {/* Trusted by */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.65 }}
            className="mt-6 flex items-center justify-center gap-4 flex-wrap px-6 pb-2"
          >
            <span style={{ fontSize: "12px", color: "#999", fontWeight: 500 }}>
              Trusted by Students:
            </span>
            {["IIT Bombay", "VIT", "BITS Pilani", "DTU", "Amity"].map(
              (name) => (
                <span
                  key={name}
                  style={{ fontSize: "13px", fontWeight: 700, color: "#ccc" }}
                >
                  {name}
                </span>
              )
            )}
          </motion.div>

          {/* Product screenshot — unchanged from original */}
          <AnimatedGroup
            variants={{
              container: {
                visible: {
                  transition: { staggerChildren: 0.05, delayChildren: 0.75 },
                },
              },
              ...transitionVariants,
            }}
          >
            <div className="relative -mr-56 mt-12 overflow-hidden px-2 sm:mr-0 sm:mt-12 md:mt-16">
              <div
                aria-hidden
                className="absolute inset-0 z-10 from-transparent from-35%"
                style={{
                  background:
                    "linear-gradient(to bottom, transparent 35%, #FFFDF0)",
                }}
              />
              <div className="relative mx-auto max-w-6xl overflow-hidden rounded-2xl border p-4 shadow-lg shadow-zinc-950/15 ring-1 ring-background bg-background inset-shadow-2xs">
                <img
                  className="aspect-15/8 relative hidden rounded-2xl dark:block bg-background"
                  src="https://tailark.com//_next/image?url=%2Fmail2.png&w=3840&q=75"
                  alt="app screen"
                  width={2700}
                  height={1440}
                />
                <img
                  className="z-2 aspect-15/8 relative rounded-2xl border border-border/25 dark:hidden"
                  src="https://tailark.com/_next/image?url=%2Fmail2-light.png&w=3840&q=75"
                  alt="app screen"
                  width={2700}
                  height={1440}
                />
              </div>
            </div>
          </AnimatedGroup>
        </div>
      </section>

      {/* Logos strip */}
      {logos.length > 0 && (
        <section
          className="pb-16 pt-16 md:pb-32"
          style={{ background: "#FFFDF0" }}
        >
          <div className="group relative m-auto max-w-5xl px-6">
            <div className="absolute inset-0 z-10 flex scale-95 items-center justify-center opacity-0 duration-500 group-hover:scale-100 group-hover:opacity-100">
              <Link
                href="/"
                className="block text-sm duration-150 hover:opacity-75"
              >
                <span>Meet Our Students</span>
                <ChevronRight className="ml-1 inline-block size-3" />
              </Link>
            </div>
            <div className="group-hover:blur-xs mx-auto mt-12 grid max-w-2xl grid-cols-4 gap-x-12 gap-y-8 transition-all duration-500 group-hover:opacity-50 sm:gap-x-16 sm:gap-y-14">
              {logos.map((l) => (
                <img
                  key={l.alt}
                  src={l.src}
                  alt={l.alt}
                  className="h-9 w-auto object-contain opacity-70"
                />
              ))}
            </div>
          </div>
        </section>
      )}
    </main>
  );
}