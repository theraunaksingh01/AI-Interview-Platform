// frontend/src/app/pricing/layout.tsx
// Server-component layout that adds metadata for the client-component pricing page

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Pricing — Free, Pro ₹299/mo, Max ₹699/mo",
  description:
    "Cractal pricing for placement prep. Free plan with 3 sessions/month. Pro at ₹299/month with unlimited mock interviews and OA practice. Max at ₹699/month with everything. No lock-in, cancel anytime.",
  openGraph: {
    title: "Cractal Pricing — Simple Plans for Placement Prep",
    description: "Free, Pro ₹299/mo, Max ₹699/mo. No lock-in. Cancel anytime.",
    url: "https://cractal.in/pricing",
  },
  alternates: {
    canonical: "https://cractal.in/pricing",
  },
};

export default function PricingLayout({ children }: { children: React.ReactNode }) {
  return children;
}