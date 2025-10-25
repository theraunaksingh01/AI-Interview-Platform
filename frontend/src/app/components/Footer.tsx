"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { Github, Linkedin, Youtube, Twitter, Instagram } from "lucide-react";

type FooterLink = { label: string; href: string };

interface FooterHeroProps {
  className?: string;
  brandWord?: string; // Giant word at the bottom
  leftMenu?: FooterLink[]; // Left vertical menu
  company?: FooterLink[];
  resources?: FooterLink[];
  account?: FooterLink[];
  socials?: { icon: React.ReactNode; href: string; label: string }[];
  legal?: FooterLink[];
}

export function FooterHero({
  className,
  brandWord = "AI INTERVIEW",
  leftMenu = [
    { label: "Features", href: "#features" },
    { label: "Solution", href: "#solution" },
    { label: "Pricing", href: "#pricing" },
    { label: "About", href: "#about" },
  ],
  company = [
    { label: "About", href: "#" },
    { label: "Blog", href: "#" },
    { label: "Careers", href: "#" },
    { label: "Partnerships", href: "#" },
  ],
  resources = [
    { label: "Customer Support", href: "#" },
    { label: "Service", href: "#" },
    { label: "Corporate Sales", href: "#" },
    { label: "Financing", href: "#" },
  ],
  account = [
    { label: "Log in", href: "#" },
    { label: "Orders", href: "#" },
  ],
  socials = [
    { icon: <Linkedin className="size-4" />, href: "#", label: "LinkedIn" },
    { icon: <Github className="size-4" />, href: "#", label: "GitHub" },
    { icon: <Twitter className="size-4" />, href: "#", label: "Twitter/X" },
    { icon: <Instagram className="size-4" />, href: "#", label: "Instagram" },
    { icon: <Youtube className="size-4" />, href: "#", label: "YouTube" },
  ],
  legal = [
    { label: "Media Inquiries", href: "#" },
    { label: "Terms", href: "#" },
    { label: "Privacy", href: "#" },
    { label: "Supplier Terms", href: "#" },
  ],
}: FooterHeroProps) {
  return (
    <footer
      className={cn(
        // NOTE: overflow-visible is required so the big word can sit slightly outside and still be visible
        "full-bleed relative overflow-visible border-t bg-white text-foreground",
        className
      )}
    >
      {/* Subtle texture (behind everything) */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-0 opacity-[0.03]"
        style={{
          backgroundImage:
            "repeating-radial-gradient(#000 0 1px, transparent 2px 40px)",
          backgroundSize: "22px 22px",
        }}
      />

      {/* Content (on top of brand word) */}
      <div className="relative z-20 mx-auto max-w-7xl px-6 pt-16 pb-44">
        <div className="grid grid-cols-1 gap-x-10 gap-y-14 md:grid-cols-12">
          {/* Left vertical menu */}
          <nav className="md:col-span-3">
            <ul className="space-y-4">
              {leftMenu.map((l) => (
                <li key={l.label}>
                  <Link
                    href={l.href}
                    className="text-xl font-medium text-neutral-600 hover:text-black"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          {/* Link columns */}
          <div className="md:col-span-9">
            <div className="grid grid-cols-1 gap-10 sm:grid-cols-3">
              <div>
                <h3 className="mb-3 font-semibold tracking-wide">Company</h3>
                <ul className="space-y-2 text-sm text-neutral-600">
                  {company.map((l) => (
                    <li key={l.label}>
                      <Link href={l.href} className="hover:text-black">
                        {l.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <h3 className="mb-3 font-semibold tracking-wide">Resources</h3>
                <ul className="space-y-2 text-sm text-neutral-600">
                  {resources.map((l) => (
                    <li key={l.label}>
                      <Link href={l.href} className="hover:text-black">
                        {l.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <h3 className="mb-3 font-semibold tracking-wide">Account</h3>
                <ul className="space-y-2 text-sm text-neutral-600">
                  {account.map((l) => (
                    <li key={l.label}>
                      <Link href={l.href} className="hover:text-black">
                        {l.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Social + legal */}
            <div className="mt-8 flex flex-wrap items-center gap-4 text-sm">
              <div className="flex items-center gap-3">
                {socials.map((s) => (
                  <Link
                    key={s.label}
                    href={s.href}
                    aria-label={s.label}
                    className="inline-flex items-center justify-center rounded-full border p-2 text-neutral-600 transition hover:border-black hover:text-black"
                  >
                    {s.icon}
                  </Link>
                ))}
              </div>

              <div className="mx-3 hidden h-4 w-px bg-neutral-200 sm:block" />

              <ul className="flex flex-wrap items-center gap-x-5 gap-y-2 text-neutral-600">
                {legal.map((l) => (
                  <li key={l.label}>
                    <Link href={l.href} className="hover:text-black">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Giant brand word (between texture and content) */}
      <div
  aria-hidden
  className="pointer-events-none absolute inset-x-0 bottom-0 translate-y-[45%] flex justify-center z-0"
>
  <span className="block select-none font-black leading-none tracking-tighter text-[26vw] md:text-[20vw] text-neutral-200/70">
    {brandWord}
  </span>
</div>
    </footer>
  );
}
