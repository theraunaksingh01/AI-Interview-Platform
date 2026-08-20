// frontend/src/app/assessment/layout.tsx

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Free Placement Readiness Assessment — 30-Min Diagnostic",
  description:
    "Free 30-minute placement readiness assessment for engineering students. Get scored across aptitude, CS fundamentals, DSA, and communication. No login needed. Results in 30 seconds.",
  keywords: [
    "placement readiness test",
    "engineering aptitude test free",
    "CS fundamentals test online",
    "free placement assessment India",
    "campus placement diagnostic test",
  ],
  openGraph: {
    title: "Free Placement Readiness Assessment | Cractal",
    description:
      "Find out where you stand before your first placement interview. 30 minutes, 5 sections, instant results — no login required.",
    url: "https://cractal.in/assessment",
  },
  alternates: {
    canonical: "https://cractal.in/assessment",
  },
};

export default function AssessmentLayout({ children }: { children: React.ReactNode }) {
  return children;
}