"use client";
import { usePathname } from "next/navigation";
import { ReactNode } from "react";

export default function MockLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  // Hide global navbar on active session pages — fullscreen interview experience
  const isSessionPage = pathname.includes("/mock/session/");
  if (isSessionPage) {
    return <>{children}</>;
  }
  return <>{children}</>;
}