// /frontend/src/app/page.tsx
"use client";

import React, { useState } from "react";
import "../app/style/globals.css";
import Features from "./components/Features";
import RoleForm from "./components/RoleForm";
import RolesList from "./components/RolesList";

// ✅ Icons required by <Features />
import { Code, Server, BarChart2 } from "lucide-react";

// ✅ Stacked-cards primitives
import { ContainerScroll, CardSticky } from "./components/ui/cards-stack";

import { VideoShowcase } from "./components/video-showcase";

import StatsSection from "./components/ui/stats";
import { MarqueeLogoScroller } from "./components/ui/marquee-logo-scroller";



export default function Page() {
  const [refreshFlag, setRefreshFlag] = useState(0);

  const START_INDEX = 2;         // because you're using index + 2
  const INCR_Y = 68;             // spacing between pinned cards (was 60)
  const BOTTOM_BUFFER_PX = 96;   // extra safety so the last card fully pins

  // ⬇️ Include `icon` for each feature item
  const sampleFeatures = [
    {
      id: 1,
      icon: Code,
      title: "Interactive Feedback",
      description:
        "AI-driven, contextual feedback that helps candidates iterate faster.",
      image:
        "https://images.unsplash.com/photo-1542831371-29b0f74f9713?q=80&w=1200&auto=format&fit=crop",
    },
    {
      id: 2,
      icon: Server,
      title: "Custom Question Banks",
      description:
        "Create reusable question templates to standardize interviews across roles.",
      image:
        "https://images.unsplash.com/photo-1555949963-ff9fe0c870eb?q=80&w=1200&auto=format&fit=crop",
    },
    {
      id: 3,
      icon: BarChart2,
      title: "Scoring & Analytics",
      description:
        "Aggregate results and surface trends to improve hiring outcomes.",
      image:
        "https://images.unsplash.com/photo-1551281044-8af2b8c6f5a4?q=80&w=1200&auto=format&fit=crop",
    },
  ];

  const PROCESS_PHASES = [
    {
      id: "process-1",
      title: "Research and Analysis",
      description:
        "We examine competitors, industry trends, and user preferences so your interview flow stands out and measures what matters.",
    },
    {
      id: "process-2",
      title: "Wireframing and Prototyping",
      description:
        "We outline interview steps, prompts, and scoring rubrics. These ‘skeletal’ flows let us test and refine early.",
    },
    {
      id: "process-3",
      title: "Design Creation",
      description:
        "We bring the experience to life—clear prompts, candidate guidance, and evaluator UX aligned with your hiring brand.",
    },
    {
      id: "process-4",
      title: "Development and Testing",
      description:
        "We implement and run dry-runs to validate timing, difficulty, and analytics so the process is reliable.",
    },
    {
      id: "process-5",
      title: "Launch and Support",
      description:
        "Roll out to the team and monitor results. We tweak and support as roles evolve.",
    },
  ];

  //Video Showcase data
  const feature = {
  id: "feat-1",
  title: "Live AI scoring",
  src: "/videos/ai-scoring.mp4",
  poster: "/videos/poster-scoring.jpg", // optional
  caption: "Answers are auto-scored in real time with rubric alignment.",
  };

  const clips = [
    { id: "c1", title: "Create a role", src: "/videos/create-role.mp4" },
    { id: "c2", title: "Question banks", src: "/videos/question-banks.mp4" },
    { id: "c3", title: "Run interview", src: "/videos/run-interview.mp4" },
    { id: "c4", title: "Reviewer notes", src: "/videos/reviewer-notes.mp4" },
    { id: "c5", title: "Analytics", src: "/videos/analytics.mp4" },
    { id: "c6", title: "Exports", src: "/videos/exports.mp4" },
  ];

  // Marquee
  const partners = [
  {
    src: "https://svgl.app/library/slack.svg",
    alt: "Slack",
    gradient: { from: "#7C4DFF", via: "#5E35B1", to: "#311B92" },
  },
  {
    src: "https://svgl.app/library/google-drive.svg",
    alt: "Google Drive",
    gradient: { from: "#00C853", via: "#00E676", to: "#1DE9B6" },
  },
  {
    src: "https://svgl.app/library/github.svg",
    alt: "GitHub",
    gradient: { from: "#6A6A6A", via: "#434343", to: "#1F1F1F" },
  },
  {
    src: "https://svgl.app/library/zoom.svg",
    alt: "Zoom",
    gradient: { from: "#64B5F6", via: "#2196F3", to: "#1976D2" },
  },
  {
    src: "https://svgl.app/library/notion.svg",
    alt: "Notion",
    gradient: { from: "#8E8E8E", via: "#5A5A5A", to: "#2C2C2C" },
  },
  {
    src: "https://svgl.app/library/google-sheets.svg",
    alt: "Google Sheets",
    gradient: { from: "#66BB6A", via: "#43A047", to: "#2E7D32" },
  },
  {
    src: "https://svgl.app/library/greenhouse.svg",
    alt: "Greenhouse ATS",
    gradient: { from: "#00C2A8", via: "#00A892", to: "#008F7D" },
  },
  {
    src: "https://svgl.app/library/lever.svg",
    alt: "Lever ATS",
    gradient: { from: "#B0BEC5", via: "#90A4AE", to: "#607D8B" },
  },
];

  return (
    <div className="space-y-16">

      <VideoShowcase />

      <StatsSection />

      {/* -------- Features -------- */}
      <Features features={sampleFeatures} />

      {/* -------- Process (left sticky copy + right stacked sticky cards) -------- */}
      <section className="container px-4 md:px-6 isolate pb-16">
        <div className="grid md:grid-cols-2 md:gap-8 xl:gap-12 items-start">
          {/* LEFT: sticky copy (no md:h-svh) */}
          <div className="md:sticky top-[calc(var(--header-h)+24px)] md:py-6 self-start">
            <h5 className="text-xs uppercase tracking-wide">our process</h5>
            <h2 className="mb-6 mt-4 text-4xl font-bold tracking-tight">
              Planning your <span className="text-indigo-500">project development</span> journey
            </h2>
            <p className="max-w-prose text-sm text-muted-foreground">
              We start with a deep discovery into the role and skills required.
              Together we map responsibilities and outcomes you expect from candidates.
              Then we iterate the flow until it fits your hiring bar.
            </p>
          </div>

          {/* RIGHT: stacked cards */}
          <ContainerScroll
            className="space-y-8 py-12"
            style={{
              // exact height = last card's sticky top + viewport + a small buffer
              minHeight: `calc(${(START_INDEX + PROCESS_PHASES.length - 1) * INCR_Y}px + 100vh + ${BOTTOM_BUFFER_PX}px)`,
            }}
          >
            {PROCESS_PHASES.map((phase, i) => (
              <CardSticky
                key={phase.id}
                index={i + START_INDEX}
                incrementY={INCR_Y}
                className="rounded-2xl border bg-background p-8 shadow-md backdrop-blur-md"
              >
                <div className="flex items-center justify-between gap-4">
                  <h3 className="my-6 text-2xl font-bold tracking-tight">{phase.title}</h3>
                  <div className="text-2xl font-bold text-indigo-500">
                    {String(i + 1).padStart(2, "0")}
                  </div>
                </div>
                <p className="text-muted-foreground">{phase.description}</p>
              </CardSticky>
            ))}
          </ContainerScroll>
        </div>
    </section>

       {/* -------- Marquee Logo Scroller -------- */}     
      <MarqueeLogoScroller
        title="Plays nicely with your stack"
        description="Connect AI scoring, reviews, and exports with your existing tools — from Slack updates to ATS pushes."
        logos={partners}
        speed="normal"
      />

      {/* -------- Roles (form + list) -------- */}
      <section className="max-w-6xl mx-auto px-4 pb-24">
        <div className="mb-6 text-center">
          <h2 className="text-2xl font-bold">Manage Roles</h2>
          <p className="mt-2 text-muted-foreground">Create, view and manage interview roles for your team.</p>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div>
            <RoleForm onCreated={() => setRefreshFlag((f) => f + 1)} />
          </div>
          <div>
            <h3 className="mb-2 text-lg font-semibold">Existing roles</h3>
            <RolesList refreshFlag={refreshFlag} />
          </div>
        </div>
      </section>
    </div>
  );
}
