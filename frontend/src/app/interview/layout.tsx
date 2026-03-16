"use client";

import { usePathname } from "next/navigation";
import { AppShell } from "@/app/components/AppShell";

/** Candidate-facing sub-routes that should NOT show the recruiter sidebar */
const CANDIDATE_SUFFIXES = ["/join", "/prepare", "/live"];

export default function InterviewLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const isCandidatePage = CANDIDATE_SUFFIXES.some((s) => pathname.endsWith(s));

  if (isCandidatePage) {
    return <>{children}</>;
  }

  return <AppShell>{children}</AppShell>;
}
