"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Linkedin, Instagram } from "lucide-react";

const FOOTER_LINKS = [
  {
    title: "Practice",
    links: [
      { label: "Mock Interview",    href: "/mock" },
      { label: "Topic Practice",    href: "/topic-practice" },
      { label: "Quick Prep",        href: "/quick-prep" },
      { label: "Resume Prep",       href: "/resume-prep" },
      { label: "DSA Practice",      href: "/dsa" },
      { label: "Peer Practice",     href: "/peer" },
    ],
  },
  {
    title: "Prepare",
    links: [
      { label: "Readiness Assessment", href: "/assessment" },
      { label: "OA Practice Tests",    href: "/oa-practice" },
      { label: "Company Guides",       href: "/companies" },
      { label: "Cheat Sheet",          href: "/cheat-sheet" },
    ],
  },
  {
    title: "Track",
    links: [
      { label: "Dashboard",         href: "/mock/dashboard" },
      { label: "Skill Passport",    href: "/passport" },
      { label: "Interview Calendar",href: "/calendar" },
      { label: "Daily Challenge",   href: "/daily" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "Features",      href: "/features" },
      { label: "Pricing",       href: "/pricing" },
      { label: "About",         href: "/about" },
      { label: "Contact",       href: "/contact" },
      { label: "Privacy",       href: "/privacy" },
      { label: "Terms",         href: "/terms" },
    ],
  },
];

export function FooterHero() {
  const [email,     setEmail]     = useState("");
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
  };

  return (
    <footer className="relative overflow-hidden" style={{ background: "#111111" }}>
      <div className="max-w-6xl mx-auto px-6 pt-16 pb-8">

        {/* ── Top row ── */}
        <div
          className="flex flex-col lg:flex-row items-start justify-between gap-10 pb-12"
          style={{ borderBottom: "1px solid #1E1E1E" }}
        >
          {/* Brand */}
          <div style={{ maxWidth: 280 }}>
            <Link href="/">
              <span className="text-[22px] font-black tracking-tight inline-block mb-3">
                <span style={{ background: "#FFD600", color: "#111", padding: "1px 6px", borderRadius: "4px" }}>Cr</span>
                <span style={{ color: "white" }}>actal</span>
              </span>
            </Link>
            <p style={{ fontSize: "13px", color: "#555", lineHeight: 1.7 }}>
              AI-powered placement prep for India's engineering students.
              Mock interviews, OA practice, placement diagnostics — all in one place.
            </p>

            {/* Social */}
            <div className="flex items-center gap-2 mt-5">
              {[
                { icon: <Linkedin size={14} />, href: "https://linkedin.com/company/Cractal-in", label: "LinkedIn" },
                { icon: <Instagram size={14} />, href: "https://instagram.com/cractal.in", label: "Instagram" },
              ].map((s) => (
                <Link
                  key={s.label}
                  href={s.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={s.label}
                  className="hover:border-[#555] hover:text-white transition-colors"
                  style={{ width: 32, height: 32, borderRadius: "50%", border: "1px solid #2A2A2A", display: "flex", alignItems: "center", justifyContent: "center", color: "#555" }}
                >
                  {s.icon}
                </Link>
              ))}
            </div>
          </div>

          {/* Newsletter */}
          <div>
            <p className="font-bold mb-1" style={{ fontSize: "13px", color: "#888" }}>
              Get placement prep tips in your inbox
            </p>
            <p style={{ fontSize: "12px", color: "#444", marginBottom: 12 }}>
              Weekly — interview tips, DSA patterns, company-specific insights.
            </p>
            {submitted ? (
              <p style={{ fontSize: "13px", color: "#FFD600" }}>✓ You're in — check your inbox soon.</p>
            ) : (
              <form onSubmit={handleSubmit} className="flex gap-2">
                <input
                  type="email"
                  required
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  style={{ background: "#1A1A1A", border: "1px solid #2A2A2A", borderRadius: 8, padding: "9px 14px", fontSize: 13, color: "white", outline: "none", width: 220 }}
                />
                <button
                  type="submit"
                  style={{ background: "#FFD600", color: "#111", fontWeight: 800, fontSize: 13, padding: "9px 18px", borderRadius: 8, border: "none", cursor: "pointer", whiteSpace: "nowrap" }}
                >
                  Subscribe
                </button>
              </form>
            )}
          </div>
        </div>

        {/* ── Link columns ── */}
        <div
          className="grid grid-cols-2 md:grid-cols-4 gap-8 py-12"
          style={{ borderBottom: "1px solid #1E1E1E" }}
        >
          {FOOTER_LINKS.map((col) => (
            <div key={col.title}>
              <h4 style={{ fontSize: 11, fontWeight: 800, color: "#444", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 14 }}>
                {col.title}
              </h4>
              <ul className="space-y-2.5">
                {col.links.map((link) => (
                  <li key={link.label} className="flex items-center gap-2">
                    <Link
                      href={link.href}
                      style={{ fontSize: 13, color: "#555" }}
                      className="hover:text-white transition-colors"
                    >
                      {link.label}
                    </Link>
                    {(link as any).badge && (
                      <span style={{
                        fontSize: 9, fontWeight: 800,
                        background: (link as any).badge === "Free" ? "#FFD600" : "#6366F1",
                        color: (link as any).badge === "Free" ? "#7A6000" : "white",
                        padding: "1px 5px", borderRadius: 99,
                      }}>
                        {(link as any).badge}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* ── Bottom bar ── */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 pt-8">
          <p style={{ fontSize: 12, color: "#333" }}>
            © 2026 Cractal. Built for India's engineering students.
          </p>
          <div className="flex gap-6">
            {[
              { label: "Privacy", href: "/privacy" },
              { label: "Terms",   href: "/terms" },
              { label: "Contact", href: "/contact" },
            ].map(({ label, href }) => (
              <Link key={label} href={href} style={{ fontSize: 12, color: "#333" }} className="hover:text-white transition-colors">
                {label}
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Giant Cractal watermark */}
      <div aria-hidden className="pointer-events-none flex justify-center overflow-hidden" style={{ marginTop: "-16px" }}>
        <span
          className="select-none font-black leading-none"
          style={{ fontSize: "clamp(80px, 20vw, 220px)", color: "rgba(255,255,255,0.03)", letterSpacing: "-4px" }}
        >
          Cractal
        </span>
      </div>
    </footer>
  );
}