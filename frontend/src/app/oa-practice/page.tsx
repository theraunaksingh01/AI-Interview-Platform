// frontend/src/app/oa-practice/page.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";

const API_BASE = (
  process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:8000"
).replace(/\/$/, "");

const COMPANIES = [
  {
    slug: "tcs",
    name: "TCS NQT",
    full: "Tata Consultancy Services National Qualifier Test",
    emoji: "🔷",
    duration: "190 min",
    sections: "Numerical + Verbal + Reasoning",
    bands: ["Ninja", "Digital", "Prime"],
    available: true,
  },
  {
    slug: "infosys",
    name: "Infosys InfyTQ",
    full: "Infosys System Engineer Assessment",
    emoji: "🟦",
    duration: "90 min",
    sections: "Reasoning + Quantitative + Verbal + Pseudocode",
    bands: ["SE", "SP", "DSE"],
    available: true,
  },
  {
    slug: "wipro",
    name: "Wipro NLTH",
    full: "Wipro National Level Talent Hunt",
    emoji: "🟡",
    duration: "60 min",
    sections: "Aptitude + Verbal",
    bands: ["Project Engineer", "Turbo"],
    available: true,
  },
  {
    slug: "cognizant",
    name: "Cognizant GenC",
    full: "Cognizant Online Assessment",
    emoji: "🔵",
    duration: "120 min",
    sections: "Quantitative + Reasoning + Verbal",
    bands: ["GenC", "GenC Next", "GenC Elevate"],
    available: true,
  },
];

export default function OAPracticePage() {
  const { user } = useAuth();
  const [history, setHistory] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;
    const token = localStorage.getItem("API_TOKEN") || localStorage.getItem("access_token") || "";
    fetch(`${API_BASE}/api/oa/history`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.ok ? r.json() : { attempts: [] })
      .then((d) => setHistory(d.attempts || []))
      .catch(() => {});
  }, [user]);

  const lastAttempt = history[0];

  return (
    <main className="min-h-screen pt-24 pb-16 px-4 sm:px-8" style={{ background: "#FAFAF8" }}>
      <div className="mx-auto max-w-[900px]">

        {/* Header */}
        <div className="mb-8">
          <p className="text-[11px] font-black uppercase tracking-widest text-[#9CA3AF] mb-2">
            OA Practice
          </p>
          <h1
            style={{
              fontSize: "clamp(24px, 4vw, 36px)",
              fontWeight: 900,
              letterSpacing: "-1px",
              color: "#111",
              lineHeight: 1.1,
            }}
          >
            Practice the{" "}
            <span
              style={{
                background: "#FFD600",
                padding: "2px 10px",
                borderRadius: "6px",
                fontStyle: "italic",
              }}
            >
              real OA pattern.
            </span>
          </h1>
          <p className="mt-2 text-[14px] text-[#6B7280] max-w-lg">
            Company-specific online assessments with locked section timers —
            exactly like the real thing. No going back, no skipping sections.
          </p>
        </div>

        {/* Last attempt banner */}
        {lastAttempt && (
          <div className="mb-6 rounded-2xl bg-[#111] px-6 py-4 flex items-center justify-between gap-4">
            <div>
              <p className="text-[11px] font-black uppercase tracking-widest text-[#555] mb-0.5">
                Last attempt
              </p>
              <p className="text-[14px] font-black text-white">
                {lastAttempt.company?.toUpperCase()} —{" "}
                <span className="text-yellow-400">{lastAttempt.total_score}%</span>
                {lastAttempt.band_prediction && lastAttempt.band_prediction !== "not_qualified" && (
                  <span className="ml-2 text-[12px] text-[#555]">
                    ({lastAttempt.band_prediction} band)
                  </span>
                )}
              </p>
            </div>
            <Link href={`/oa-practice/results/${lastAttempt.id}`}>
              <button className="flex-shrink-0 rounded-xl bg-white px-4 py-2 text-[12px] font-black text-[#111] hover:bg-gray-100 transition">
                View results →
              </button>
            </Link>
          </div>
        )}

        {/* Company cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {COMPANIES.map((c) => (
            <div
              key={c.slug}
              className={`rounded-2xl border bg-white overflow-hidden ${
                c.available ? "border-[#E5E7EB] hover:border-[#111] hover:shadow-md transition-all" : "border-[#E5E7EB] opacity-60"
              }`}
            >
              <div className="p-6">
                <div className="flex items-start justify-between mb-3">
                  <span className="text-[32px]">{c.emoji}</span>
                  {!c.available && (
                    <span className="rounded-full bg-[#F3F4F6] px-2.5 py-0.5 text-[10px] font-black text-[#9CA3AF]">
                      Coming soon
                    </span>
                  )}
                </div>
                <h2 className="text-[16px] font-black text-[#111] mb-0.5">{c.name}</h2>
                <p className="text-[12px] text-[#9CA3AF] mb-3">{c.full}</p>

                <div className="space-y-1.5 mb-4">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-[#9CA3AF] w-16">Duration</span>
                    <span className="text-[12px] font-bold text-[#374151]">{c.duration}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-[#9CA3AF] w-16">Sections</span>
                    <span className="text-[12px] font-bold text-[#374151]">{c.sections}</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-[11px] text-[#9CA3AF] w-16 mt-0.5">Tracks</span>
                    <div className="flex flex-wrap gap-1">
                      {c.bands.map((b) => (
                        <span
                          key={b}
                          className="rounded-full bg-[#F3F4F6] px-2 py-0.5 text-[10px] font-bold text-[#374151]"
                        >
                          {b}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {c.available ? (
                  <Link href={`/oa-practice/${c.slug}`}>
                    <button className="w-full rounded-xl bg-[#111] py-2.5 text-[13px] font-black text-white hover:bg-[#333] transition">
                      Start {c.name} practice →
                    </button>
                  </Link>
                ) : (
                  <button
                    disabled
                    className="w-full rounded-xl bg-[#F3F4F6] py-2.5 text-[13px] font-black text-[#9CA3AF] cursor-not-allowed"
                  >
                    Coming soon
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Rules note */}
        <div className="mt-6 rounded-2xl border border-[#E5E7EB] bg-white p-5">
          <p className="text-[12px] font-black uppercase tracking-widest text-[#9CA3AF] mb-3">
            How OA practice works
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              { icon: "⏱️", text: "Section timers are locked — time runs out, section closes" },
              { icon: "🔒", text: "Cannot go back to previous questions once submitted" },
              { icon: "📊", text: "Get band prediction (Ninja/Digital/Prime) after completion" },
              { icon: "🔁", text: "Retake as many times as you want — different questions each time" },
            ].map(({ icon, text }) => (
              <div key={text} className="flex items-start gap-2.5">
                <span className="text-[16px] mt-0.5">{icon}</span>
                <p className="text-[12px] text-[#6B7280] leading-relaxed">{text}</p>
              </div>
            ))}
          </div>
        </div>

      </div>
    </main>
  );
}