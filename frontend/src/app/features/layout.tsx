// frontend/src/app/features/layout.tsx

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Features — Mock Interviews, OA Practice, DSA & More",
  description:
    "Every Cractal feature: AI mock interviews with live coaching, OA practice tests, placement readiness assessment, DSA practice with real IDE, company guides, and progress tracking.",
  openGraph: {
    title: "Platform Features | Cractal",
    description:
      "Mock interviews, OA practice, DSA practice, placement diagnostics, company guides, and progress tracking — everything for placement prep in one platform.",
    url: "https://cractal.in/features",
  },
  alternates: {
    canonical: "https://cractal.in/features",
  },
};

export default function FeaturesLayout({ children }: { children: React.ReactNode }) {
  return children;
}