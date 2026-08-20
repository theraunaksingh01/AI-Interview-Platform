"use client";

import { Suspense, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/context/AuthContext";

const WELCOME_SLIDES = [
  {
    icon: "🎯",
    title: "Pick up where you left off",
    desc: "Your session history, scores, and Skill Passport are waiting.",
  },
  {
    icon: "🔥",
    title: "Keep your streak alive",
    desc: "Consistent daily practice is what actually moves your readiness score.",
  },
  {
    icon: "📈",
    title: "Track your improvement",
    desc: "See exactly how much you've grown since your first session.",
  },
];

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { token, login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [slideIdx, setSlideIdx] = useState(0);

  const next = searchParams.get("next") || "/mock/dashboard";
  const resetSuccess = searchParams.get("reset") === "success";

  useEffect(() => {
    if (token) router.replace(next);
  }, [token, router, next]);

  useEffect(() => {
    const id = setInterval(() => setSlideIdx(v => (v + 1) % WELCOME_SLIDES.length), 4000);
    return () => clearInterval(id);
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    try {
      await login(email, password);
      router.replace(next);
    } catch (e: any) {
      setErr(e?.message || "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-3 pt-24 sm:p-6 sm:pt-28"
      style={{ background: "#F3F1E9" }}
    >
      <div
        className="w-full flex flex-col lg:flex-row overflow-hidden"
        style={{
          maxWidth: 1100,
          minHeight: "min(680px, 88vh)",
          borderRadius: 28,
          boxShadow: "0 20px 60px rgba(0,0,0,0.08)",
        }}
      >
        {/* ── LEFT: brand panel ── */}
        <div
          className="hidden lg:flex flex-col justify-between relative overflow-hidden"
          style={{ width: 420, flexShrink: 0, background: "#111" }}
        >
          <div className="relative z-10 px-8 pt-8">
            <Link href="/" className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[12px] font-medium transition"
              style={{ background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.7)" }}>
              &larr; Back to home
            </Link>
          </div>

          <div aria-hidden className="absolute pointer-events-none"
            style={{
              top: "-10%", right: "-30%", width: 400, height: 400, borderRadius: "50%",
              background: "radial-gradient(circle, rgba(255,214,0,0.15) 0%, transparent 70%)"
            }} />
          <div aria-hidden className="absolute pointer-events-none"
            style={{
              bottom: "-15%", left: "-20%", width: 300, height: 300, borderRadius: "50%",
              background: "radial-gradient(circle, rgba(99,102,241,0.12) 0%, transparent 70%)"
            }} />

          <div className="relative z-10 px-8">
            <div className="mb-8">
              <span className="text-[24px] font-black tracking-tight">
                <span style={{ background: "#FFD600", color: "#111", padding: "1px 7px", borderRadius: 5 }}>Qu</span>
                <span style={{ color: "white" }}>ed</span>
              </span>
            </div>
            <h1 className="text-[30px] font-black text-white leading-tight mb-3" style={{ letterSpacing: "-0.5px" }}>
              Welcome back.<br />
              <span style={{ color: "#FFD600" }}>Keep building momentum.</span>
            </h1>
            <p className="text-[13px] leading-relaxed" style={{ color: "#777" }}>
              Placement season doesn&apos;t wait. Neither should your prep.
            </p>
          </div>

          <div className="relative z-10 px-8 pb-8">
            <AnimatePresence mode="wait">
              <motion.div
                key={slideIdx}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.3 }}
                className="rounded-2xl p-5"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}
              >
                <span className="text-[24px] block mb-3">{WELCOME_SLIDES[slideIdx].icon}</span>
                <p className="text-[14px] font-black text-white mb-1.5 leading-snug">
                  {WELCOME_SLIDES[slideIdx].title}
                </p>
                <p className="text-[12px] leading-relaxed" style={{ color: "#777" }}>
                  {WELCOME_SLIDES[slideIdx].desc}
                </p>
              </motion.div>
            </AnimatePresence>

            <div className="flex gap-1.5 mt-4">
              {WELCOME_SLIDES.map((_, i) => (
                <span key={i} className="rounded-full transition-all"
                  style={{ height: 4, width: i === slideIdx ? 20 : 4, background: i === slideIdx ? "#FFD600" : "rgba(255,255,255,0.15)" }} />
              ))}
            </div>
          </div>
        </div>

        {/* ── RIGHT: form panel ── */}
        <div
          className="flex-1 flex flex-col justify-center overflow-y-auto"
          style={{ background: "white", padding: "40px 44px" }}
        >
          <div className="w-full max-w-[380px] mx-auto">

            {/* Mobile logo */}
            <div className="lg:hidden mb-6">
              <Link href="/">
                <span className="text-[20px] font-black tracking-tight">
                  <span style={{ background: "#FFD600", color: "#111", padding: "1px 6px", borderRadius: 4 }}>Qu</span>ed
                </span>
              </Link>
            </div>

            <h2 className="text-[24px] font-black text-[#111] mb-1" style={{ letterSpacing: "-0.5px" }}>
              Welcome back
            </h2>
            <p className="text-[13px] text-[#9CA3AF] mb-6">Sign in to your interview coach.</p>

            {resetSuccess && (
              <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                <p className="text-[12px] font-medium text-emerald-700">
                  &#10003; Password reset successfully. Log in with your new password.
                </p>
              </div>
            )}

            <form onSubmit={onSubmit} className="space-y-3.5">
              <div>
                <label className="block text-[11px] font-bold text-[#374151] mb-1.5">Email</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@college.edu"
                  className="w-full rounded-xl border border-[#E5E7EB] px-3.5 py-2.5 text-[13px] text-[#111] outline-none focus:border-[#111] transition"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[#374151] mb-1.5">Password</label>
                <div className="relative">
                  <input
                    type={show ? "text" : "password"}
                    required
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    className="w-full rounded-xl border border-[#E5E7EB] px-3.5 py-2.5 pr-14 text-[13px] text-[#111] outline-none focus:border-[#111] transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShow(s => !s)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[11px] font-bold text-[#9CA3AF] hover:text-[#111] transition"
                  >
                    {show ? "Hide" : "Show"}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-[12px] text-[#6B7280]">
                  <input
                    type="checkbox"
                    checked={remember}
                    onChange={e => setRemember(e.target.checked)}
                    className="rounded border-[#D1D5DB]"
                  />
                  Remember me
                </label>
                <a href="/forgot-password" className="text-[11px] font-bold text-[#9CA3AF] hover:text-[#111] transition">
                  Forgot password?
                </a>
              </div>



              {err && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-[12px] text-red-600">
                  {err}
                </div>
              )}

              <button
                disabled={loading}
                className="w-full rounded-xl bg-[#111] py-3 text-[13px] font-black text-white transition hover:bg-[#333] disabled:opacity-60"
              >
                {loading ? "Signing in..." : "Sign in"}
              </button>
            </form>

            <p className="mt-5 text-center text-[12px] text-[#9CA3AF]">
              New here?{" "}
              <Link href="/signup" className="font-bold text-[#111] hover:underline">
                Create an account
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}