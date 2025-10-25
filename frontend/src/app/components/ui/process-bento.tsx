"use client";

import * as React from "react";
import {
  ClipboardCheck,
  FileScan,
  PlayCircle,
  BrainCircuit,
  BarChart3,
} from "lucide-react";
import { cn } from "@/lib/utils";

export function ProcessBento() {
  return (
    <section className="full-bleed relative py-14">
      {/* Top row: heading left, copy right */}
      <div className="mx-auto max-w-7xl px-4 md:px-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-center">
          {/* LEFT SIDE */}
          <div className="space-y-3">
            <span className="text-xs uppercase tracking-wide text-muted-foreground">
              Our process
            </span>
            <h2 className="text-4xl font-bold tracking-tight md:text-5xl">
              Smarter hiring with <span className="text-indigo-500">AI Insights</span>
            </h2>
            <div className="flex gap-8 pt-2 text-sm text-muted-foreground">
              <div>
                <div className="font-semibold text-foreground">+500 roles</div>
                created
              </div>
              <div>
                <div className="font-semibold text-foreground">Trusted by</div>
                100+ teams
              </div>
            </div>
          </div>
        
          {/* RIGHT SIDE */}
          <div className="flex items-center">
            <p className="text-muted-foreground max-w-xl">
              Our platform combines AI, analytics, and evidence-based design to
              supercharge your interview process—from role definition to final
              scoring.
            </p>
          </div>
        </div>
      </div>
        

      {/* Bento grid (5 cards, like your reference) */}
      <div className="mx-auto mt-8 max-w-7xl px-4 md:px-6">
        {/* 12-col grid gives us clean spans with no leftover gaps */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
          {/* 1) Large feature (spans 7) */}
          <Tile
            className="md:col-span-7 h-[260px]"
            bg="bg-indigo-50"
            icon={ClipboardCheck}
            title="Create a role"
            desc="Define scope, skills, and seniority. Get calibrated competencies instantly."
            linkText="Explore →"
          />

          {/* 2) Large feature (spans 5) */}
          <Tile
            className="md:col-span-5 h-[260px]"
            bg="bg-emerald-50"
            icon={BarChart3}
            title="Scoring & analytics"
            desc="Spot trends, strengths, and gaps across interviews at a glance."
            linkText="See dashboard →"
          />

          {/* Row 2: three equal cards (4+4+4) */}
          <Tile
            className="md:col-span-4 h-[220px]"
            bg="bg-sky-50"
            icon={FileScan}
            title="Question banks"
            desc="Reusable prompts with structured rubrics for coding, design, and behavioral."
            linkText="Browse →"
          />
          <Tile
            className="md:col-span-4 h-[220px]"
            bg="bg-amber-50"
            icon={PlayCircle}
            title="Run interviews"
            desc="Guided flows with timers, notes, and consistent scoring."
            linkText="Start →"
          />
          <Tile
            className="md:col-span-4 h-[220px]"
            bg="bg-fuchsia-50"
            icon={BrainCircuit}
            title="Live AI feedback"
            desc="Contextual hints and scoring suggestions while candidates answer."
            linkText="Try it →"
          />
        </div>
      </div>
    </section>
  );
}

/* ——— Card ——— */
function Tile({
  className,
  bg,
  icon: Icon,
  title,
  desc,
  linkText,
}: {
  className?: string;
  bg?: string;
  icon: React.ElementType;
  title: string;
  desc: string;
  linkText?: string;
}) {
  return (
    <article
      className={cn(
        "group relative overflow-hidden rounded-2xl border bg-card",
        "transition-all duration-300 ease-out",
        "hover:-translate-y-1 hover:shadow-xl hover:ring-2 hover:ring-indigo-500/20",
        bg,
        className
      )}
    >
      {/* subtle inner gradient glow on hover */}
      <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
        <div className="absolute -inset-24 rounded-[60px] bg-gradient-to-br from-white/0 via-white/30 to-white/0 blur-2xl" />
      </div>

      <div className="relative z-10 h-full p-6 md:p-7 flex flex-col">
        <div className="mb-3 flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-white shadow-sm">
            <Icon className="text-indigo-600" size={20} />
          </div>
          <h3 className="text-lg font-semibold tracking-tight">{title}</h3>
        </div>

        <p className="text-sm text-muted-foreground leading-relaxed">
          {desc}
        </p>

        {linkText && (
          <button
            className="mt-auto inline-flex w-fit items-center rounded-md bg-white px-3 py-1.5 text-sm font-medium text-indigo-700 shadow-sm transition hover:bg-indigo-50"
            type="button"
          >
            {linkText}
          </button>
        )}
      </div>
    </article>
  );
}
