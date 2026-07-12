// frontend/src/app/forgot-password/page.tsx
"use client";

import { useState } from "react";
import Link from "next/link";

const API_BASE = (
  process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:8000"
).replace(/\/$/, "");

export default function ForgotPasswordPage() {
  const [email,     setEmail]     = useState("");
  const [loading,   setLoading]   = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error,     setError]     = useState("");

  const handleSubmit = async () => {
    if (!email.trim()) { setError("Please enter your email"); return; }
    setError("");
    setLoading(true);

    try {
      const res = await fetch(`${API_BASE}/api/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });

      if (res.ok) {
        setSubmitted(true);
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.detail || "Something went wrong. Please try again.");
      }
    } catch {
      setError("Network error. Please check your connection.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main
      className="min-h-screen flex items-center justify-center px-4"
      style={{ background: "#FFFDF0" }}
    >
      <div className="w-full max-w-[400px]">

        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/">
            <span className="text-[22px] font-black text-[#111]">
              Qu<span style={{ background: "#FFD600", padding: "1px 6px", borderRadius: "4px" }}>ed</span>
            </span>
          </Link>
        </div>

        <div
          className="rounded-3xl border border-[#E5E7EB] bg-white overflow-hidden"
          style={{ boxShadow: "0 4px 40px rgba(0,0,0,0.06)" }}
        >
          {submitted ? (
            // Success state
            <div className="px-8 py-10 text-center">
              <div className="text-[48px] mb-4">📬</div>
              <h1 className="text-[20px] font-black text-[#111] mb-2">
                Check your inbox
              </h1>
              <p className="text-[14px] text-[#6B7280] leading-relaxed mb-6">
                If an account exists for <span className="font-bold text-[#111]">{email}</span>,
                you&apos;ll receive a password reset link shortly.
                The link expires in 30 minutes.
              </p>
              <p className="text-[12px] text-[#9CA3AF] mb-6">
                Didn&apos;t get an email? Check your spam folder or
              </p>
              <button
                onClick={() => { setSubmitted(false); setEmail(""); }}
                className="text-[13px] font-bold text-[#111] underline"
              >
                try a different email address
              </button>
            </div>
          ) : (
            // Form state
            <div className="px-8 py-8">
              <h1 className="text-[22px] font-black text-[#111] mb-1">
                Forgot your password?
              </h1>
              <p className="text-[14px] text-[#6B7280] mb-6 leading-relaxed">
                Enter the email you signed up with and we&apos;ll send you a reset link.
              </p>

              <div className="space-y-4">
                <div>
                  <label className="block text-[12px] font-bold text-[#374151] mb-1.5">
                    Email address
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); setError(""); }}
                    onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                    placeholder="you@example.com"
                    className="w-full rounded-xl border border-[#E5E7EB] px-4 py-3 text-[14px] text-[#111] outline-none focus:border-[#111] transition"
                    autoFocus
                    autoComplete="email"
                  />
                </div>

                {error && (
                  <p className="text-[13px] text-red-500 font-medium">{error}</p>
                )}

                <button
                  onClick={handleSubmit}
                  disabled={loading}
                  className="w-full rounded-xl bg-[#111] py-3 text-[14px] font-black text-white hover:bg-[#333] transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? "Sending..." : "Send reset link →"}
                </button>
              </div>

              <div className="mt-6 text-center">
                <Link
                  href="/login"
                  className="text-[13px] font-medium text-[#6B7280] hover:text-[#111] transition"
                >
                  ← Back to login
                </Link>
              </div>
            </div>
          )}
        </div>

      </div>
    </main>
  );
}