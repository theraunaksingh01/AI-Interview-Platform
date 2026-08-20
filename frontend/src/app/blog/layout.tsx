// frontend/src/app/blog/layout.tsx

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Blog — Interview Prep Tips & Placement Strategy",
  description:
    "Real tactics for placement interviews — TCS NQT prep, DSA patterns, off-campus strategy, and communication tips for Indian engineering students.",
  openGraph: {
    title: "The Cractal Blog — Interview Prep Insights",
    description:
      "Company-specific prep guides, DSA patterns, and communication tips for engineering students preparing for placements.",
    url: "https://cractal.in/blog",
  },
  alternates: {
    canonical: "https://cractal.in/blog",
  },
};

export default function BlogLayout({ children }: { children: React.ReactNode }) {
  return children;
}