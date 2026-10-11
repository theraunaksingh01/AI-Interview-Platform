"use client";

// frontend/src/app/founding/page.tsx  ->  route: /founding
// Public landing page for the Founding 50 cohort.
// NOTE: match API_BASE to however your other pages define it.

import Link from "next/link";
import { useEffect, useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const CODE = "FOUNDING50";

type Info = { valid: boolean; reason?: string; spots_left?: number; max_uses?: number; days?: number; plan?: string };

export default function FoundingPage() {
  const [info, setInfo] = useState<Info | null>(null);

  useEffect(() => {
    fetch(`${API_BASE}/api/promo/validate/${CODE}`)
      .then((r) => r.json())
      .then(setInfo)
      .catch(() => setInfo(null));
  }, []);

  const full = info && !info.valid;
  const left = info?.spots_left;

  return (
    <main style={{ background: "#FFFDF0", color: "#111", minHeight: "100vh" }}>
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "64px 20px 96px" }}>
        <Link href="/" style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", opacity: 0.5, textDecoration: "none", color: "#111" }}>
          &larr; Cractal
        </Link>

        <div style={{ display: "inline-block", marginTop: 28, marginLeft: 16, background: "#FFD600", fontSize: 11, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", padding: "4px 10px", borderRadius: 4 }}>
          Founding 50
        </div>

        <h1 style={{ fontSize: "clamp(34px, 6vw, 56px)", fontWeight: 900, letterSpacing: "-1.5px", lineHeight: 1.05, margin: "16px 0 14px" }}>
          Help us build Cractal. Get Pro free.
        </h1>
        <p style={{ fontSize: 18, lineHeight: 1.6, color: "#333", margin: 0 }}>
          We&apos;re a small team building placement prep for students like you. We&apos;re giving our first 50 students Pro free for 30 days.
          In return, we ask for your honest feedback after you&apos;ve used it.
        </p>

        <div style={{ margin: "32px 0", padding: "20px 24px", background: "#111", color: "#fff", borderRadius: 16 }}>
          {info === null && <span>Checking spots...</span>}
          {info?.valid && (
            <>
              <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#FFD600" }}>Spots left</div>
              <div style={{ fontSize: 40, fontWeight: 900, letterSpacing: "-1px" }}>
                {left} <span style={{ fontSize: 18, fontWeight: 600, color: "#bbb" }}>of {info.max_uses}</span>
              </div>
            </>
          )}
          {full && <div style={{ fontWeight: 700 }}>All Founding 50 spots are taken. Thank you! You can still sign up free.</div>}
        </div>

        <h2 style={{ fontSize: 20, fontWeight: 800, margin: "0 0 10px" }}>What you get</h2>
        <ul style={{ margin: "0 0 28px", paddingLeft: 20, lineHeight: 1.9, fontSize: 16 }}>
          <li>Pro for 30 days, free. No card needed. We pick students with a test or interview coming up.</li>
          <li>Company-pattern tests, voice mock interviews, and a report that tells you what to fix first.</li>
          <li>A direct line to the founder, who is a student too.</li>
        </ul>

        <h2 style={{ fontSize: 20, fontWeight: 800, margin: "0 0 10px" }}>What we ask</h2>
        <ul style={{ margin: "0 0 36px", paddingLeft: 20, lineHeight: 1.9, fontSize: 16 }}>
          <li>Actually use it for a few days.</li>
          <li>Fill a short feedback form after (about 3 minutes). Be honest, including what is bad.</li>
        </ul>

        {!full && (
          <Link
            href="/founding/apply"
            style={{ display: "inline-block", background: "#FFD600", color: "#111", fontWeight: 800, fontSize: 18, padding: "14px 28px", borderRadius: 999, textDecoration: "none" }}
          >
            Apply for a spot &rarr;
          </Link>
        )}
        <p style={{ fontSize: 13, color: "#777", marginTop: 16 }}>
          Your data stays private. We only use your feedback to improve Cractal.
        </p>
      </div>
    </main>
  );
}
