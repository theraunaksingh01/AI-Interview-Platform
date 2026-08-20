// frontend/src/app/components/ConsentModal.tsx
// One-time consent modal for audio/video processing — shown before mic/camera
// permission is requested on mock, topic-practice, or any voice-based feature.

"use client";

import { useState } from "react";

const API_BASE = (process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:8000").replace(/\/$/, "");

interface ConsentModalProps {
  onAccept: () => void;
  onDecline: () => void;
}

export function ConsentModal({ onAccept, onDecline }: ConsentModalProps) {
  const [checked, setChecked] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleAccept() {
    if (!checked) return;
    setSubmitting(true);
    try {
      const token = localStorage.getItem("access_token") || localStorage.getItem("API_TOKEN");
      await fetch(`${API_BASE}/auth/me/consent`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ consent: true }),
      });
    } catch {
      // Even if the save fails, let them proceed — don't block on a network hiccup.
      // The modal will just reappear next session, which is a minor inconvenience, not a blocker.
    }
    setSubmitting(false);
    onAccept();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
    >
      <div
        className="w-full max-w-[440px] rounded-3xl bg-white overflow-hidden"
        style={{ boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}
      >
        <div className="px-7 pt-7 pb-5" style={{ borderBottom: "1px solid #F0EDE6" }}>
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl text-[22px] mb-4"
            style={{ background: "#EEF2FF" }}>
            🎙️
          </div>
          <h2 className="text-[19px] font-black text-[#111] mb-1" style={{ letterSpacing: "-0.3px" }}>
            Before we begin
          </h2>
          <p className="text-[13px] text-[#6B7280]">
            This session uses your microphone and camera.
          </p>
        </div>

        <div className="px-7 py-5 space-y-3">
          {[
            { icon: "🎤", text: "Your voice is transcribed in real-time to text for scoring." },
            { icon: "🚫", text: "Raw audio is not stored after processing — only the text transcript and score are saved." },
            { icon: "📹", text: "Camera is used for a live preview only — no video is recorded or stored." },
            { icon: "🔒", text: "Transcripts are private to your account and never shared." },
          ].map(({ icon, text }) => (
            <div key={text} className="flex items-start gap-3">
              <span className="text-[15px] flex-shrink-0 mt-0.5">{icon}</span>
              <p className="text-[12px] text-[#374151] leading-relaxed">{text}</p>
            </div>
          ))}

          <a
            href="/privacy"
            target="_blank"
            className="inline-block text-[12px] font-bold text-[#6366F1] hover:underline mt-1"
          >
            Read full privacy policy →
          </a>
        </div>

        <div className="px-7 pb-6">
          <label className="flex items-start gap-2.5 mb-4 cursor-pointer">
            <input
              type="checkbox"
              checked={checked}
              onChange={(e) => setChecked(e.target.checked)}
              className="mt-0.5 rounded border-[#D1D5DB]"
            />
            <span className="text-[12px] text-[#374151] leading-relaxed">
              I consent to my voice being processed for transcription and scoring,
              and my camera being used for a live preview during this session.
            </span>
          </label>

          <div className="flex gap-2.5">
            <button
              onClick={onDecline}
              className="flex-1 rounded-xl border border-[#E5E7EB] py-3 text-[13px] font-bold text-[#374151] hover:bg-[#F9FAFB] transition"
            >
              Not now
            </button>
            <button
              onClick={handleAccept}
              disabled={!checked || submitting}
              className="flex-1 rounded-xl py-3 text-[13px] font-black text-white transition disabled:opacity-40"
              style={{ background: "#111" }}
            >
              {submitting ? "..." : "Agree & continue"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}