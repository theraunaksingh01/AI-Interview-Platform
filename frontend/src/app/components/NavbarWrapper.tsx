"use client";
import { usePathname } from "next/navigation";
import { Navbar } from "@/app/components/Navbar";

export function NavbarWrapper() {
  const pathname = usePathname();
  const hidden = pathname.includes("/mock/session/") || pathname.includes("/interview/");
  if (hidden) return null;
  return <Navbar />;
}