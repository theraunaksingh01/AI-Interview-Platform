"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Github, Linkedin, Twitter, Instagram } from "lucide-react";

export function FooterHero() {
  const [email, setEmail] = useState("");

  return (
    <footer
      className="relative overflow-hidden"
      style={{ background: "#111111" }}
    >
      {/* Main footer content */}
      <div className="max-w-6xl mx-auto px-6 pt-16 pb-8">

        {/* Top row — logo + newsletter */}
        <div
          className="flex flex-col md:flex-row items-start justify-between gap-8 pb-12"
          style={{ borderBottom: "1px solid #222222" }}
        >
          {/* Logo */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span
                className="text-2xl font-black tracking-tight"
                style={{ color: "white" }}
              >
                <span
                  style={{
                    background: "#FFD600",
                    color: "#111",
                    padding: "1px 6px",
                    borderRadius: "4px",
                  }}
                >
                  Qu
                </span>{" "}
                <span style={{ color: "white" }}>ed</span>
              </span>
            </div>
            <p style={{ fontSize: "13px", color: "#555", maxWidth: "220px", lineHeight: 1.6 }}>
              AI-powered mock interviews built for India's engineering students.
            </p>
          </div>

          {/* Newsletter */}
          <div>
            <p
              className="font-semibold mb-3"
              style={{ fontSize: "13px", color: "#888" }}
            >
              Sign up to our News letter
            </p>
            <div className="flex gap-2">
              <input
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{
                  background: "#1a1a1a",
                  border: "1px solid #333",
                  borderRadius: "6px",
                  padding: "9px 14px",
                  fontSize: "13px",
                  color: "white",
                  outline: "none",
                  width: "220px",
                }}
              />
              <button
                style={{
                  background: "#FFD600",
                  color: "#111",
                  fontWeight: 700,
                  fontSize: "13px",
                  padding: "9px 18px",
                  borderRadius: "6px",
                  border: "none",
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                Submit
              </button>
            </div>

            {/* Social icons */}
            <div className="flex items-center gap-3 mt-4">
              {[
                { icon: <Linkedin size={14} />, href: "#", label: "LinkedIn" },
                { icon: <Github size={14} />, href: "#", label: "GitHub" },
                { icon: <Twitter size={14} />, href: "#", label: "Twitter" },
                { icon: <Instagram size={14} />, href: "#", label: "Instagram" },
              ].map((s) => (
                <Link
                  key={s.label}
                  href={s.href}
                  aria-label={s.label}
                  style={{
                    width: "32px",
                    height: "32px",
                    borderRadius: "50%",
                    border: "1px solid #333",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#666",
                  }}
                  className="hover:border-gray-500 hover:text-white transition-colors"
                >
                  {s.icon}
                </Link>
              ))}
            </div>
          </div>
        </div>

        {/* Link columns */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 py-12"
          style={{ borderBottom: "1px solid #222222" }}
        >
          {[
            {
              title: "Categories",
              links: ["Mock Interview", "Company Prep", "Skill Passport", "Pricing"],
            },
            {
              title: "Quick Links",
              links: ["Home", "About", "Blog", "Contact"],
            },
            {
              title: "Features",
              links: ["Real-time coaching", "AI scoring", "Voice interview", "Progress tracking"],
            },
            {
              title: "Company",
              links: ["About us", "Careers", "Privacy Policy", "Terms of Service"],
            },
          ].map((col) => (
            <div key={col.title}>
              <h4
                className="font-bold mb-4"
                style={{ fontSize: "13px", color: "#888", textTransform: "uppercase", letterSpacing: "0.5px" }}
              >
                {col.title}
              </h4>
              <ul className="space-y-3">
                {col.links.map((link) => (
                  <li key={link}>
                    <Link
                      href="#"
                      style={{ fontSize: "13px", color: "#555" }}
                      className="hover:text-white transition-colors"
                    >
                      {link}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 pt-8">
          <p style={{ fontSize: "12px", color: "#444" }}>
            © 2026 Qued. Built for India's engineering students.
          </p>
          <div className="flex gap-6">
            {["Media Inquiries", "Terms", "Privacy"].map((l) => (
              <Link
                key={l}
                href="#"
                style={{ fontSize: "12px", color: "#444" }}
                className="hover:text-white transition-colors"
              >
                {l}
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Giant QUED text at bottom — exactly like Skillora */}
      <div
        aria-hidden
        className="pointer-events-none flex justify-center overflow-hidden"
        style={{ marginTop: "-16px" }}
      >
        <span
          className="select-none font-black leading-none tracking-tighter"
          style={{
            fontSize: "clamp(80px, 20vw, 220px)",
            color: "rgba(255,255,255,0.04)",
            letterSpacing: "-4px",
          }}
        >
          QUED
        </span>
      </div>
    </footer>
  );
}