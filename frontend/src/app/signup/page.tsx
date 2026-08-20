"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/context/AuthContext";

const API_BASE = (process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:8000").replace(/\/$/, "");

const STEPS = ["account", "college", "role", "companies"] as const;
type Step = (typeof STEPS)[number];

const ROLES = [
  "Software Engineer (SDE)", "Data Engineer", "Full Stack Developer",
  "Backend Developer", "Frontend Developer", "DevOps / Cloud Engineer",
  "Data Scientist / ML Engineer", "Product Manager", "Business Analyst",
];

const COMPANY_OPTIONS = [
  "TCS", "Infosys", "Wipro", "Cognizant", "Accenture",
  "HCL", "Tech Mahindra", "Capgemini",
  "Amazon", "Microsoft", "Google", "Meta",
  "Flipkart", "Razorpay", "Zerodha", "Swiggy", "Zomato",
];

const FEATURE_SLIDES = [
  {
    icon: "🎤",
    title: "Mock interviews with live coaching",
    desc: "Answer by voice. Get scored on technical accuracy and communication — instantly.",
  },
  {
    icon: "📊",
    title: "Free placement readiness assessment",
    desc: "30-minute diagnostic across aptitude, CS, DSA and communication. Know your gaps.",
  },
  {
    icon: "📝",
    title: "OA practice with locked timers",
    desc: "TCS NQT, Infosys SE, Wipro NLTH — exact format. Locked timers, no going back.",
  },
  {
    icon: "💻",
    title: "DSA practice with a real IDE",
    desc: "185 problems in Python, Java, C++. See the optimal solution after you submit.",
  },
];

function ProgressDots({ current }: { current: number }) {
  return (
    <div className="flex items-center gap-2 mb-6">
      {STEPS.map((_, i) => (
        <div
          key={i}
          className="transition-all duration-300 rounded-full"
          style={{
            width: i === current ? 22 : 7,
            height: 7,
            background: i <= current ? "#111" : "#E5E7EB",
          }}
        />
      ))}
      <span className="ml-1 text-[11px] font-medium text-[#9CA3AF]">
        Step {current + 1} of {STEPS.length}
      </span>
    </div>
  );
}

function SlideIn({ children, stepKey }: { children: React.ReactNode; stepKey: string }) {
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={stepKey}
        initial={{ opacity: 0, x: 14 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -14 }}
        transition={{ duration: 0.22, ease: "easeOut" }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

export default function SignupPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login } = useAuth();
  const refCode = searchParams.get("ref");

  const [referralValidation, setReferralValidation] = useState<{
    valid: boolean; message: string; name: string;
  } | null>(null);

  useEffect(() => {
    if (!refCode) return;
    fetch(`${API_BASE}/api/referral/validate/${refCode}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.valid) setReferralValidation(d); })
      .catch(() => { });
  }, [refCode]);

  // Feature slide rotation
  const [slideIdx, setSlideIdx] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setSlideIdx(v => (v + 1) % FEATURE_SLIDES.length), 4000);
    return () => clearInterval(id);
  }, []);

  const [step, setStep] = useState<Step>("account");
  const stepIndex = STEPS.indexOf(step);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [college, setCollege] = useState("");
  const [year, setYear] = useState("");
  const [branch, setBranch] = useState("");
  const [targetRoles, setTargetRoles] = useState<string[]>([]);
  const [targetCompanies, setTargetCompanies] = useState<string[]>([]);
  const [selfLevel, setSelfLevel] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function toggleCompany(c: string) {
    setTargetCompanies(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]);
  }

  function toggleRole(role: string) {
    setTargetRoles(prev => {
      if (prev.includes(role)) return prev.filter(r => r !== role);
      if (prev.length >= 2) return prev; // cap at 2
      return [...prev, role];
    });
  }

  async function handleAccountNext() {
    setError("");
    if (!fullName.trim()) { setError("Please enter your name"); return; }
    if (!email.trim() || !email.includes("@")) { setError("Please enter a valid email"); return; }
    if (password.length < 6) { setError("Password must be at least 6 characters"); return; }
    if (password !== confirmPassword) { setError("Passwords don't match"); return; }
    setStep("college");
  }

  function handleCollegeNext() {
    setError("");
    if (!college.trim()) { setError("Please enter your college name"); return; }
    if (!year) { setError("Please select your year of study"); return; }
    setStep("role");
  }

  function handleRoleNext() {
    setError("");
    if (targetRoles.length === 0) {
      setError("Please select at least one target role");
      return;
    } setStep("companies");
  }

  async function handleFinalSubmit() {
    setLoading(true);
    setError("");
    try {
      // Step 1: Register the account
      const res = await fetch(`${API_BASE}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: fullName.trim(),
          email: email.trim().toLowerCase(),
          password,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.detail || "Signup failed. Please try again.");
        setLoading(false);
        return;
      }

      const token = data.access_token;
      localStorage.setItem("access_token", token);
      localStorage.setItem("API_TOKEN", token);
      document.cookie = `access_token=${token};path=/;max-age=${60 * 60 * 24 * 7};SameSite=Lax`;

      // Step 2: Save onboarding data (college, year, branch, role, level)
      try {
        await fetch(`${API_BASE}/auth/onboarding`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            college: college.trim(),
            year_of_study: year,
            branch: branch.trim(),
            target_roles: targetRoles,
            target_companies: targetCompanies,
            self_level: selfLevel,
          }),
        });
      } catch {
        // Onboarding data is nice-to-have — don't block signup on this failing
      }

      // Step 3: Claim referral if present
      if (refCode) {
        try {
          await fetch(`${API_BASE}/api/referral/claim`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ referral_code: refCode }),
          });
        } catch { /* silent */ }
      }

      window.location.href = "/mock/dashboard";
    } catch (err) {
      console.error("Signup error:", err);
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
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
          minHeight: "min(760px, 92vh)",
          borderRadius: 28,
          boxShadow: "0 20px 60px rgba(0,0,0,0.08)",
        }}
      >
        {/* ── LEFT: brand panel ── */}
        <div
          className="hidden lg:flex flex-col justify-between relative overflow-hidden"
          style={{ width: 420, flexShrink: 0, background: "#111" }}
        >
          {/* Back link */}
          <div className="relative z-10 px-8 pt-8">
            <Link href="/" className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[12px] font-medium transition"
              style={{ background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.7)" }}>
              &larr; Back to home
            </Link>
          </div>

          {/* Decorative glow */}
          <div
            aria-hidden
            className="absolute pointer-events-none"
            style={{
              top: "-10%", right: "-30%",
              width: 400, height: 400, borderRadius: "50%",
              background: "radial-gradient(circle, rgba(255,214,0,0.15) 0%, transparent 70%)",
            }}
          />
          <div
            aria-hidden
            className="absolute pointer-events-none"
            style={{
              bottom: "-15%", left: "-20%",
              width: 300, height: 300, borderRadius: "50%",
              background: "radial-gradient(circle, rgba(99,102,241,0.12) 0%, transparent 70%)",
            }}
          />

          {/* Middle: logo + headline */}
          <div className="relative z-10 px-8">
            <div className="mb-8">
              <span className="text-[24px] font-black tracking-tight">
                <span style={{ background: "#FFD600", color: "#111", padding: "1px 7px", borderRadius: 5 }}>Qu</span>
                <span style={{ color: "white" }}>ed</span>
              </span>
            </div>
            <h1 className="text-[30px] font-black text-white leading-tight mb-3" style={{ letterSpacing: "-0.5px" }}>
              Your placement season{" "}
              <span style={{ color: "#FFD600" }}>starts here.</span>
            </h1>
            <p className="text-[13px] leading-relaxed" style={{ color: "#777" }}>
              Built for Indian engineering students preparing for campus drives and off-campus applications.
            </p>
          </div>

          {/* Bottom: rotating feature card */}
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
                <span className="text-[24px] block mb-3">{FEATURE_SLIDES[slideIdx].icon}</span>
                <p className="text-[14px] font-black text-white mb-1.5 leading-snug">
                  {FEATURE_SLIDES[slideIdx].title}
                </p>
                <p className="text-[12px] leading-relaxed" style={{ color: "#777" }}>
                  {FEATURE_SLIDES[slideIdx].desc}
                </p>
              </motion.div>
            </AnimatePresence>

            <div className="flex gap-1.5 mt-4">
              {FEATURE_SLIDES.map((_, i) => (
                <span
                  key={i}
                  className="rounded-full transition-all"
                  style={{
                    height: 4,
                    width: i === slideIdx ? 20 : 4,
                    background: i === slideIdx ? "#FFD600" : "rgba(255,255,255,0.15)",
                  }}
                />
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

            {/* Mobile logo (shown only when left panel hidden) */}
            <div className="lg:hidden mb-6">
              <Link href="/">
                <span className="text-[20px] font-black tracking-tight">
                  <span style={{ background: "#FFD600", color: "#111", padding: "1px 6px", borderRadius: 4 }}>Qu</span>ed
                </span>
              </Link>
            </div>

            {/* Referral banner */}
            {referralValidation?.valid && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-5 flex items-center gap-3 rounded-2xl px-4 py-3"
                style={{ background: "#F0FDF4", border: "1px solid #BBF7D0" }}
              >
                <span className="text-[18px]">&#127873;</span>
                <div>
                  <p className="text-[12px] font-black" style={{ color: "#065F46" }}>
                    {referralValidation.name} invited you
                  </p>
                  <p className="text-[11px]" style={{ color: "#6B7280" }}>
                    You&apos;ll get 2 bonus sessions when you sign up
                  </p>
                </div>
              </motion.div>
            )}

            <ProgressDots current={stepIndex} />

            <SlideIn stepKey={step}>
              {/* Step 1: Account */}
              {step === "account" && (
                <div>
                  <h2 className="text-[24px] font-black text-[#111] mb-1" style={{ letterSpacing: "-0.5px" }}>
                    Create your account
                  </h2>
                  <p className="text-[13px] text-[#9CA3AF] mb-6">Your AI interview coach is waiting.</p>
                  <div className="space-y-3.5">
                    <div>
                      <label className="block text-[11px] font-bold text-[#374151] mb-1.5">Full name</label>
                      <input type="text" value={fullName} onChange={e => setFullName(e.target.value)}
                        placeholder="Rahul Kumar"
                        className="w-full rounded-xl border border-[#E5E7EB] px-3.5 py-2.5 text-[13px] text-[#111] outline-none focus:border-[#111] transition" />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-[#374151] mb-1.5">Email</label>
                      <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                        placeholder="you@college.edu"
                        className="w-full rounded-xl border border-[#E5E7EB] px-3.5 py-2.5 text-[13px] text-[#111] outline-none focus:border-[#111] transition" />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-[#374151] mb-1.5">Password</label>
                      <div className="relative">
                        <input type={showPassword ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)}
                          placeholder="Min 6 characters"
                          className="w-full rounded-xl border border-[#E5E7EB] px-3.5 py-2.5 pr-14 text-[13px] text-[#111] outline-none focus:border-[#111] transition" />
                        <button type="button" onClick={() => setShowPassword(p => !p)}
                          className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[11px] font-bold text-[#9CA3AF] hover:text-[#111] transition">
                          {showPassword ? "Hide" : "Show"}
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-[#374151] mb-1.5">Confirm password</label>
                      <input type="password" value={confirmPassword} onChange={e => setConfirm(e.target.value)}
                        placeholder="Re-enter password"
                        className="w-full rounded-xl border border-[#E5E7EB] px-3.5 py-2.5 text-[13px] text-[#111] outline-none focus:border-[#111] transition"
                        onKeyDown={e => e.key === "Enter" && handleAccountNext()} />
                    </div>
                  </div>
                  {error && <p className="mt-3 text-[12px] text-red-500">{error}</p>}
                  <button onClick={handleAccountNext}
                    className="mt-5 w-full rounded-xl bg-[#111] py-3 text-[13px] font-black text-white hover:bg-[#333] transition">
                    Continue &rarr;
                  </button>
                  <p className="mt-4 text-center text-[12px] text-[#9CA3AF]">
                    Already have an account?{" "}
                    <Link href="/login" className="font-bold text-[#111] hover:underline">Sign in</Link>
                  </p>
                </div>
              )}

              {/* Step 2: College */}
              {step === "college" && (
                <div>
                  <h2 className="text-[24px] font-black text-[#111] mb-1" style={{ letterSpacing: "-0.5px" }}>Your college</h2>
                  <p className="text-[13px] text-[#9CA3AF] mb-6">We use this to personalise your prep.</p>
                  <div className="space-y-3.5">
                    <div>
                      <label className="block text-[11px] font-bold text-[#374151] mb-1.5">College name</label>
                      <input type="text" value={college} onChange={e => setCollege(e.target.value)}
                        placeholder="e.g. LDRP Institute of Technology"
                        className="w-full rounded-xl border border-[#E5E7EB] px-3.5 py-2.5 text-[13px] text-[#111] outline-none focus:border-[#111] transition" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-bold text-[#374151] mb-1.5">Year</label>
                        <select value={year} onChange={e => setYear(e.target.value)}
                          className="w-full rounded-xl border border-[#E5E7EB] px-3.5 py-2.5 text-[13px] text-[#111] outline-none focus:border-[#111] transition">
                          <option value="">Select</option>
                          {["1st year", "2nd year", "3rd year", "4th year", "Passed out"].map((y, i) => (
                            <option key={y} value={i === 4 ? "passed_out" : String(i + 1)}>{y}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-[#374151] mb-1.5">Branch</label>
                        <input type="text" value={branch} onChange={e => setBranch(e.target.value)}
                          placeholder="CSE, IT, ECE"
                          className="w-full rounded-xl border border-[#E5E7EB] px-3.5 py-2.5 text-[13px] text-[#111] outline-none focus:border-[#111] transition" />
                      </div>
                    </div>
                  </div>
                  {error && <p className="mt-3 text-[12px] text-red-500">{error}</p>}
                  <button onClick={handleCollegeNext}
                    className="mt-5 w-full rounded-xl bg-[#111] py-3 text-[13px] font-black text-white hover:bg-[#333] transition">
                    Continue &rarr;
                  </button>
                  <button onClick={() => setStep("account")}
                    className="mt-2 w-full text-center text-[12px] text-[#9CA3AF] hover:text-[#111] transition">
                    &larr; Back
                  </button>
                </div>
              )}


              {/* Step 3: Role */}
              {step === "role" && (
                <div>
                  <h2 className="text-[24px] font-black text-[#111] mb-1" style={{ letterSpacing: "-0.5px" }}>Target role</h2>
                  <p className="text-[13px] text-[#9CA3AF] mb-5">Questions weighted toward this role.</p>
                  <p className="text-[11px] text-[#9CA3AF] mb-2">Select up to 2 roles</p>
                  <div className="space-y-1.5 max-h-[260px] overflow-y-auto pr-1">
                    {ROLES.map(role => {
                      const selected = targetRoles.includes(role);
                      const disabled = !selected && targetRoles.length >= 2;
                      return (
                        <button key={role} type="button" onClick={() => toggleRole(role)}
                          disabled={disabled}
                          className="w-full flex items-center justify-between rounded-xl border px-3.5 py-2.5 text-left text-[12px] font-medium transition disabled:opacity-40 disabled:cursor-not-allowed"
                          style={{
                            borderColor: selected ? "#111" : "#E5E7EB",
                            background: selected ? "#111" : "white",
                            color: selected ? "white" : "#374151",
                          }}>
                          {role}
                          {selected && <span>&#10003;</span>}
                        </button>
                      );
                    })}
                  </div>
                  <div className="mt-4">
                    <label className="block text-[11px] font-bold text-[#374151] mb-2">Rate yourself</label>
                    <div className="grid grid-cols-3 gap-2">
                      {[{ val: "beginner", label: "Beginner" }, { val: "intermediate", label: "Intermediate" }, { val: "advanced", label: "Advanced" }].map(({ val, label }) => (
                        <button key={val} type="button" onClick={() => setSelfLevel(val)}
                          className="rounded-xl border py-2 text-[11px] font-bold transition"
                          style={{
                            borderColor: selfLevel === val ? "#111" : "#E5E7EB",
                            background: selfLevel === val ? "#FFFDF0" : "white",
                            color: selfLevel === val ? "#111" : "#6B7280",
                          }}>
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                  {error && <p className="mt-3 text-[12px] text-red-500">{error}</p>}
                  <button onClick={handleRoleNext}
                    className="mt-5 w-full rounded-xl bg-[#111] py-3 text-[13px] font-black text-white hover:bg-[#333] transition">
                    Continue &rarr;
                  </button>
                  <button onClick={() => setStep("college")}
                    className="mt-2 w-full text-center text-[12px] text-[#9CA3AF] hover:text-[#111] transition">
                    &larr; Back
                  </button>
                </div>
              )}

              {/* Step 4: Companies */}
              {step === "companies" && (
                <div>
                  <h2 className="text-[24px] font-black text-[#111] mb-1" style={{ letterSpacing: "-0.5px" }}>Target companies</h2>
                  <p className="text-[13px] text-[#9CA3AF] mb-5">Pick all that apply.</p>
                  <div className="flex flex-wrap gap-1.5 mb-4 max-h-[220px] overflow-y-auto">
                    {COMPANY_OPTIONS.map(company => {
                      const selected = targetCompanies.includes(company);
                      return (
                        <button key={company} type="button" onClick={() => toggleCompany(company)}
                          className="rounded-full border px-3.5 py-1.5 text-[11px] font-semibold transition"
                          style={{
                            borderColor: selected ? "#111" : "#E5E7EB",
                            background: selected ? "#111" : "white",
                            color: selected ? "white" : "#374151",
                          }}>
                          {company}
                        </button>
                      );
                    })}
                  </div>
                  {error && <p className="mb-3 text-[12px] text-red-500">{error}</p>}
                  <button onClick={handleFinalSubmit} disabled={loading}
                    className="w-full rounded-xl bg-[#111] py-3 text-[13px] font-black text-white hover:bg-[#333] transition disabled:opacity-60">
                    {loading ? "Creating account..." : "Start preparing \u2192"}
                  </button>
                  <button onClick={() => setStep("role")}
                    className="mt-2 w-full text-center text-[12px] text-[#9CA3AF] hover:text-[#111] transition">
                    &larr; Back
                  </button>
                </div>
              )}
            </SlideIn>
          </div>
        </div>
      </div>
    </div>
  );
}