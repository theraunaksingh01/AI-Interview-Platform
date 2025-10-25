"use client";

import React from "react";
import { motion } from "motion/react";

/** ------------ Types ------------ */
type Testimonial = {
  text: string;
  image: string;
  name: string;
  role: string;
};

/** ------------ Internal Column (kept inside same file) ------------ */
const Column: React.FC<{
  testimonials: Testimonial[];
  className?: string;
  duration?: number; // seconds for one full scroll
}> = ({ testimonials, className, duration = 16 }) => {
  return (
    <div className={className}>
      <motion.div
        animate={{ translateY: "-50%" }}
        transition={{
          duration,
          repeat: Infinity,
          ease: "linear",
          repeatType: "loop",
        }}
        className="flex flex-col gap-6 pb-6 bg-background"
      >
        {[...Array(2)].map((_, dup) => (
          <React.Fragment key={dup}>
            {testimonials.map(({ text, image, name, role }, i) => (
              <div
                key={`${name}-${i}-${dup}`}
                className="p-6 sm:p-7 md:p-8 rounded-2xl border shadow-md shadow-primary/10 max-w-xs w-full"
              >
                <div className="text-sm sm:text-[15px] leading-relaxed">
                  {text}
                </div>

                <div className="flex items-center gap-3 mt-5">
                  <img
                    width={40}
                    height={40}
                    src={image}
                    alt={name}
                    className="h-10 w-10 rounded-full object-cover"
                    loading="lazy"
                  />
                  <div className="flex flex-col">
                    <div className="font-medium leading-5">{name}</div>
                    <div className="text-muted-foreground leading-5 text-sm">
                      {role}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </React.Fragment>
        ))}
      </motion.div>
    </div>
  );
};

/** ------------ Main Section (default export) ------------ */
export default function Testimonials() {
  // tailor these to your AI interview platform
  const data: Testimonial[] = [
    {
      text:
        "AI scoring cut our review time nearly in half. Consistent rubrics made decisions easier.",
      image: "https://randomuser.me/api/portraits/women/65.jpg",
      name: "Isha Verma",
      role: "Hiring Manager · FinTech",
    },
    {
      text:
        "Question banks + reviewer notes made interviews repeatable across teams. Quality went up.",
      image: "https://randomuser.me/api/portraits/men/12.jpg",
      name: "Marcus Young",
      role: "Head of Engineering · SaaS",
    },
    {
      text:
        "Transparency matters: each score explains why. Candidates felt the process was fair and fast.",
      image: "https://randomuser.me/api/portraits/women/21.jpg",
      name: "Riya Shah",
      role: "People Ops · Marketplace",
    },
    {
      text:
        "Reviewer alignment improved a lot. Our pass/fail debates dropped dramatically.",
      image: "https://randomuser.me/api/portraits/men/33.jpg",
      name: "Daniel Lopes",
      role: "Sr. Recruiter · HealthTech",
    },
    {
      text:
        "Setup took a day. Now we reuse role templates and export results to Sheets/ATS.",
      image: "https://randomuser.me/api/portraits/women/44.jpg",
      name: "Helena Kim",
      role: "Talent Lead · DevTools",
    },
    {
      text:
        "The live scoring demo sold our team—structured, bias-aware, explainable.",
      image: "https://randomuser.me/api/portraits/men/54.jpg",
      name: "Victor Tran",
      role: "VP Engineering · EdTech",
    },
    {
      text:
        "Candidates appreciated fast feedback. Our interview NPS moved up 17 points.",
      image: "https://randomuser.me/api/portraits/women/72.jpg",
      name: "Amira Ali",
      role: "Recruiting Ops · AI Startup",
    },
    {
      text:
        "Notes, timing, rubric scores—debriefs are painless now.",
      image: "https://randomuser.me/api/portraits/men/77.jpg",
      name: "Jared Brooks",
      role: "Staff Engineer · Logistics",
    },
    {
      text:
        "Great for multi-region hiring. Templates keep standards consistent while we scale.",
      image: "https://randomuser.me/api/portraits/women/31.jpg",
      name: "Lucía Romero",
      role: "HRBP · E-commerce",
    },
  ];

  const col1 = data.slice(0, 3);
  const col2 = data.slice(3, 6);
  const col3 = data.slice(6, 9);

  return (
    <section className="full-bleed py-16 md:py-24">
      <div className="mx-auto max-w-7xl px-6">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          viewport={{ once: true }}
          className="flex flex-col items-center justify-center max-w-[640px] mx-auto"
        >
          <div className="inline-flex items-center rounded-lg border px-3 py-1 text-xs uppercase tracking-wide text-muted-foreground">
            Testimonials
          </div>
          <h2 className="mt-4 text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-center">
            What teams say after switching to AI-assisted interviews
          </h2>
          <p className="text-center mt-4 text-muted-foreground">
            Short, honest notes from hiring managers, recruiters, and engineers.
          </p>
        </motion.div>

        <div
          className="mt-12 flex justify-center gap-6
                     [mask-image:linear-gradient(to_bottom,transparent,black_18%,black_82%,transparent)]
                     max-h-[740px] overflow-hidden"
        >
          <Column testimonials={col1} duration={16} />
          <Column testimonials={col2} duration={20} className="hidden md:block" />
          <Column testimonials={col3} duration={18} className="hidden lg:block" />
        </div>
      </div>
    </section>
  );
}
