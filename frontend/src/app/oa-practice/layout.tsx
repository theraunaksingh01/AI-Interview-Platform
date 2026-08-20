// frontend/src/app/oa-practice/layout.tsx

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "OA Practice Tests — TCS NQT, Infosys SE, Wipro NLTH, Cognizant",
  description:
    "Practice TCS NQT, Infosys SE, Wipro NLTH, and Cognizant GenC online assessments with locked timers and band prediction. 734 real-format questions across 4 companies.",
  keywords: [
    "TCS NQT practice test",
    "Infosys online assessment practice",
    "Wipro NLTH mock test",
    "Cognizant OA practice",
    "placement OA practice India",
    "TCS NQT mock test free",
  ],
  openGraph: {
    title: "OA Practice Tests — TCS, Infosys, Wipro, Cognizant | Qued",
    description:
      "Simulate the real OA with locked section timers and band prediction. 734 questions across TCS NQT, Infosys SE, Wipro NLTH, Cognizant GenC.",
    url: "https://qued.in/oa-practice",
  },
  alternates: {
    canonical: "https://qued.in/oa-practice",
  },
};

export default function OAPracticeLayout({ children }: { children: React.ReactNode }) {
  return children;
}