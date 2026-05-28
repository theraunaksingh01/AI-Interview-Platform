"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const API_BASE = (
  process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:8000"
).replace(/\/$/, "");

// ─── Types ────────────────────────────────────────────────────────────────────

type Step = "account" | "about" | "goal" | "roles" | "level";

interface OnboardingData {
  college: string;
  year_of_study: string;
  branch: string;
  placement_goal: string;
  target_roles: string[];
  self_level: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STEPS: Step[] = ["account", "about", "goal", "roles", "level"];

const YEARS = [
  { value: "1st", label: "1st Year" },
  { value: "2nd", label: "2nd Year" },
  { value: "3rd", label: "3rd Year" },
  { value: "final", label: "Final Year" },
  { value: "graduated", label: "Graduated" },
];

const BRANCHES = [
  { value: "cs", label: "Computer Science" },
  { value: "it", label: "Information Technology" },
  { value: "ece", label: "Electronics (ECE)" },
  { value: "other", label: "Other" },
];

const GOALS = [
  {
    value: "campus",
    label: "On-campus placement",
    sub: "TCS, Infosys, Wipro, Cognizant",
    icon: "🎓",
  },
  {
    value: "product",
    label: "Product company",
    sub: "Amazon, Flipkart, Razorpay, startup",
    icon: "🚀",
  },
  {
    value: "faang",
    label: "FAANG / top tier",
    sub: "Google, Meta, Microsoft, Apple",
    icon: "⚡",
  },
  {
    value: "exploring",
    label: "Just exploring",
    sub: "Not sure yet, figuring it out",
    icon: "🧭",
  },
];

const ROLES = [
  { value: "Backend Engineer", label: "Backend", icon: "⬡" },
  { value: "Frontend Engineer", label: "Frontend", icon: "◈" },
  { value: "Full Stack Engineer", label: "Full Stack", icon: "⌁" },
  { value: "AI Engineer", label: "AI / ML", icon: "◆" },
  { value: "Data Engineer", label: "Data", icon: "◉" },
  { value: "System Design", label: "System Design", icon: "⌂" },
];

const LEVELS = [
  {
    value: "beginner",
    label: "Still learning",
    sub: "Can't solve most DSA problems yet, learning the basics",
    emoji: "🌱",
  },
  {
    value: "intermediate",
    label: "Know the basics",
    sub: "Understand concepts but struggle to explain clearly in interviews",
    emoji: "📈",
  },
  {
    value: "ready",
    label: "Interview ready",
    sub: "Solid fundamentals, need mock practice to build confidence",
    emoji: "🎯",
  },
];

// ─── Progress bar ─────────────────────────────────────────────────────────────

function ProgressDots({ current }: { current: number }) {
  // current is 0-indexed step index (0=account shown differently)
  const onboardingSteps = 4; // about, goal, roles, level
  const onboardingIndex = current - 1; // 0-3

  if (current === 0) return null;

  return (
    <div className="flex items-center gap-2 mb-8">
      {Array.from({ length: onboardingSteps }).map((_, i) => (
        <div
          key={i}
          className={`h-1 rounded-full transition-all duration-500 ${
            i < onboardingIndex
              ? "bg-[#111] w-6"
              : i === onboardingIndex
              ? "bg-yellow-400 w-8"
              : "bg-[#E5E7EB] w-4"
          }`}
        />
      ))}
      <span className="ml-2 text-[12px] text-[#9CA3AF]">
        {onboardingIndex + 1} / {onboardingSteps}
      </span>
    </div>
  );
}

// ─── Animated container ───────────────────────────────────────────────────────

function SlideIn({
  children,
  stepKey,
}: {
  children: React.ReactNode;
  stepKey: string;
}) {
  const [visible, setVisible] = useState(false);
  const prevKey = useRef(stepKey);

  useEffect(() => {
    setVisible(false);
    const t = setTimeout(() => {
      setVisible(true);
      prevKey.current = stepKey;
    }, 60);
    return () => clearTimeout(t);
  }, [stepKey]);

  return (
    <div
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(12px)",
        transition: "opacity 280ms ease, transform 280ms ease",
      }}
    >
      {children}
    </div>
  );
}

// ─── Option pill ──────────────────────────────────────────────────────────────

function Pill({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl border px-4 py-2.5 text-[13px] font-medium transition-all duration-150 ${
        selected
          ? "border-[#111] bg-[#111] text-white"
          : "border-[#E5E7EB] bg-white text-[#374151] hover:border-[#111] hover:bg-[#F9FAFB]"
      }`}
    >
      {children}
    </button>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function SignUpPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("account");
  const stepIndex = STEPS.indexOf(step);

  // Account fields
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);

  // Onboarding fields
  const [data, setData] = useState<OnboardingData>({
    college: "",
    year_of_study: "",
    branch: "",
    placement_goal: "",
    target_roles: [],
    self_level: "",
  });

  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [token, setToken] = useState<string | null>(null);

  function set<K extends keyof OnboardingData>(key: K, val: OnboardingData[K]) {
    setData((prev) => ({ ...prev, [key]: val }));
  }

  function toggleRole(role: string) {
    setData((prev) => ({
      ...prev,
      target_roles: prev.target_roles.includes(role)
        ? prev.target_roles.filter((r) => r !== role)
        : prev.target_roles.length < 2
        ? [...prev.target_roles, role]
        : prev.target_roles,
    }));
  }

  // ── Step 1: Create account ──────────────────────────────────────────────────
  async function handleCreateAccount(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (pw !== confirm) { setMsg("Passwords don't match."); return; }
    if (pw.length < 6) { setMsg("Password must be at least 6 characters."); return; }

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password: pw, full_name: name }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg(body?.detail || "Registration failed.");
        return;
      }

      // Store token for subsequent onboarding calls
      localStorage.setItem("access_token", body.access_token);
      localStorage.setItem("API_TOKEN", body.access_token);
      setToken(body.access_token);
      setStep("about");
    } catch {
      setMsg("Network error. Try again.");
    } finally {
      setLoading(false);
    }
  }

  // ── Save onboarding + redirect ──────────────────────────────────────────────
  async function finishOnboarding() {
    setLoading(true);
    try {
      const t = token || localStorage.getItem("access_token");
      await fetch(`${API_BASE}/auth/onboarding`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(t ? { Authorization: `Bearer ${t}` } : {}),
        },
        body: JSON.stringify(data),
      });
      // Store onboarding selections so mock page can pre-fill
      if (data.target_roles.length > 0) {
        localStorage.setItem("onboarding_role", data.target_roles[0]);
      }
      if (data.self_level) {
        localStorage.setItem("onboarding_level", data.self_level);
      }
      if (data.placement_goal) {
        localStorage.setItem("onboarding_goal", data.placement_goal);
      }
    } catch {
      // Non-fatal — onboarding data is nice-to-have
    } finally {
      router.push("/mock");
    }
  }

  async function skipOnboarding() {
    router.push("/mock");
  }

  // ── Step navigation ─────────────────────────────────────────────────────────
  function next() {
    const nextStep = STEPS[stepIndex + 1];
    if (nextStep) setStep(nextStep);
  }

  // ── Testimonials rotation ───────────────────────────────────────────────────
  const testimonials = [
    { text: "Improved my system design score from 4.2 to 8.6 in 6 sessions", author: "Priya, IIT Bombay" },
    { text: "The coaching overlay caught 14 filler words I didn't know I was saying", author: "Rohan, NIT Trichy" },
    { text: "Got placed at Amazon after 3 weeks of mock practice", author: "Aditya, BITS Pilani" },
  ];
  const [tIdx, setTIdx] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTIdx((v) => (v + 1) % 3), 3500);
    return () => clearInterval(id);
  }, []);

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-white lg:grid lg:grid-cols-2">

      {/* ── Left: form panel ── */}
      <div className="flex min-h-screen flex-col justify-center px-6 py-12 sm:px-10 lg:px-14">
        <div className="mx-auto w-full max-w-110">

          {/* Logo */}
          <Link href="/" className="mb-8 inline-block">
            <span className="text-[20px] font-black tracking-tight">
              Qu<span className="bg-yellow-400 px-1 rounded-sm text-black">ed</span>
            </span>
          </Link>

          {/* Progress */}
          <ProgressDots current={stepIndex} />

          <SlideIn stepKey={step}>

            {/* ── STEP 1: Account ── */}
            {step === "account" && (
              <form onSubmit={handleCreateAccount} className="space-y-5">
                <div>
                  <h1 className="text-[28px] font-black tracking-tight text-[#111]">
                    Create your account
                  </h1>
                  <p className="mt-1 text-[14px] text-[#9CA3AF]">
                    Your AI interview coach is waiting.
                  </p>
                </div>

                <div>
                  <label className="block text-[12px] font-bold uppercase tracking-wide text-[#374151] mb-1.5">
                    Full name
                  </label>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Qued Op"
                    className="h-11 w-full rounded-xl border border-[#E5E7EB] px-4 text-[14px] text-[#111] placeholder:text-[#D1D5DB] focus:border-[#111] focus:outline-none focus:ring-2 focus:ring-[#111]/10 transition"
                  />
                </div>

                <div>
                  <label className="block text-[12px] font-bold uppercase tracking-wide text-[#374151] mb-1.5">
                    Email
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@college.edu"
                    className="h-11 w-full rounded-xl border border-[#E5E7EB] px-4 text-[14px] text-[#111] placeholder:text-[#D1D5DB] focus:border-[#111] focus:outline-none focus:ring-2 focus:ring-[#111]/10 transition"
                  />
                </div>

                <div>
                  <label className="block text-[12px] font-bold uppercase tracking-wide text-[#374151] mb-1.5">
                    Password
                  </label>
                  <div className="relative">
                    <input
                      type={showPw ? "text" : "password"}
                      required
                      value={pw}
                      onChange={(e) => setPw(e.target.value)}
                      placeholder="Min 6 characters"
                      className="h-11 w-full rounded-xl border border-[#E5E7EB] px-4 pr-12 text-[14px] text-[#111] placeholder:text-[#D1D5DB] focus:border-[#111] focus:outline-none focus:ring-2 focus:ring-[#111]/10 transition"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPw((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[12px] font-medium text-[#9CA3AF] hover:text-[#111]"
                    >
                      {showPw ? "Hide" : "Show"}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-[12px] font-bold uppercase tracking-wide text-[#374151] mb-1.5">
                    Confirm password
                  </label>
                  <input
                    type="password"
                    required
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    placeholder="••••••••"
                    className="h-11 w-full rounded-xl border border-[#E5E7EB] px-4 text-[14px] text-[#111] placeholder:text-[#D1D5DB] focus:border-[#111] focus:outline-none focus:ring-2 focus:ring-[#111]/10 transition"
                  />
                </div>

                {msg && (
                  <div className="rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-[13px] text-rose-700">
                    {msg}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading || !email || !pw}
                  className="h-12 w-full rounded-xl bg-[#111] text-[14px] font-black text-white transition hover:bg-[#333] disabled:bg-[#F3F4F6] disabled:text-[#9CA3AF] disabled:cursor-not-allowed"
                >
                  {loading ? "Creating account..." : "Continue →"}
                </button>

                <p className="text-center text-[13px] text-[#9CA3AF]">
                  Already have an account?{" "}
                  <Link href="/login" className="font-bold text-[#111] hover:underline">
                    Sign in
                  </Link>
                </p>
              </form>
            )}

            {/* ── STEP 2: About you ── */}
            {step === "about" && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-[26px] font-black tracking-tight text-[#111]">
                    Tell us about yourself
                  </h2>
                  <p className="mt-1 text-[14px] text-[#9CA3AF]">
                    So we can tailor your prep.
                  </p>
                </div>

                <div>
                  <label className="block text-[12px] font-bold uppercase tracking-wide text-[#374151] mb-2">
                    College / University
                  </label>
                  <input
                    value={data.college}
                    onChange={(e) => set("college", e.target.value)}
                    placeholder="IIT Kanpur, NIT Trichy, BITS..."
                    className="h-11 w-full rounded-xl border border-[#E5E7EB] px-4 text-[14px] text-[#111] placeholder:text-[#D1D5DB] focus:border-[#111] focus:outline-none focus:ring-2 focus:ring-[#111]/10 transition"
                  />
                </div>

                <div>
                  <label className="block text-[12px] font-bold uppercase tracking-wide text-[#374151] mb-2">
                    Year of study
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {YEARS.map((y) => (
                      <Pill
                        key={y.value}
                        selected={data.year_of_study === y.value}
                        onClick={() => set("year_of_study", y.value)}
                      >
                        {y.label}
                      </Pill>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-[12px] font-bold uppercase tracking-wide text-[#374151] mb-2">
                    Branch
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {BRANCHES.map((b) => (
                      <Pill
                        key={b.value}
                        selected={data.branch === b.value}
                        onClick={() => set("branch", b.value)}
                      >
                        {b.label}
                      </Pill>
                    ))}
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    onClick={next}
                    disabled={!data.year_of_study || !data.branch}
                    className="h-12 flex-1 rounded-xl bg-[#111] text-[14px] font-black text-white transition hover:bg-[#333] disabled:bg-[#F3F4F6] disabled:text-[#9CA3AF] disabled:cursor-not-allowed"
                  >
                    Continue →
                  </button>
                  <button
                    onClick={skipOnboarding}
                    className="h-12 rounded-xl border border-[#E5E7EB] px-5 text-[13px] font-medium text-[#9CA3AF] hover:text-[#111] transition"
                  >
                    Skip
                  </button>
                </div>
              </div>
            )}

            {/* ── STEP 3: Goal ── */}
            {step === "goal" && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-[26px] font-black tracking-tight text-[#111]">
                    What's your goal?
                  </h2>
                  <p className="mt-1 text-[14px] text-[#9CA3AF]">
                    We'll focus your prep on the right companies.
                  </p>
                </div>

                <div className="space-y-2.5">
                  {GOALS.map((g) => {
                    const selected = data.placement_goal === g.value;
                    return (
                      <button
                        key={g.value}
                        type="button"
                        onClick={() => set("placement_goal", g.value)}
                        className={`w-full rounded-xl border px-4 py-3.5 text-left transition-all duration-150 ${
                          selected
                            ? "border-[#111] bg-[#111] text-white"
                            : "border-[#E5E7EB] bg-white hover:border-[#111] hover:bg-[#F9FAFB]"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-[20px]">{g.icon}</span>
                          <div>
                            <p className={`text-[14px] font-bold ${selected ? "text-white" : "text-[#111]"}`}>
                              {g.label}
                            </p>
                            <p className={`text-[12px] ${selected ? "text-[#9CA3AF]" : "text-[#9CA3AF]"}`}>
                              {g.sub}
                            </p>
                          </div>
                          {selected && (
                            <span className="ml-auto flex h-5 w-5 items-center justify-center rounded-full bg-yellow-400 text-[10px] font-black text-[#111]">
                              ✓
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={next}
                    disabled={!data.placement_goal}
                    className="h-12 flex-1 rounded-xl bg-[#111] text-[14px] font-black text-white transition hover:bg-[#333] disabled:bg-[#F3F4F6] disabled:text-[#9CA3AF] disabled:cursor-not-allowed"
                  >
                    Continue →
                  </button>
                  <button
                    onClick={skipOnboarding}
                    className="h-12 rounded-xl border border-[#E5E7EB] px-5 text-[13px] font-medium text-[#9CA3AF] hover:text-[#111] transition"
                  >
                    Skip
                  </button>
                </div>
              </div>
            )}

            {/* ── STEP 4: Roles ── */}
            {step === "roles" && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-[26px] font-black tracking-tight text-[#111]">
                    Which roles?
                  </h2>
                  <p className="mt-1 text-[14px] text-[#9CA3AF]">
                    Pick up to 2. We'll prioritise these questions.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  {ROLES.map((r) => {
                    const selected = data.target_roles.includes(r.value);
                    const maxed = data.target_roles.length >= 2 && !selected;
                    return (
                      <button
                        key={r.value}
                        type="button"
                        onClick={() => !maxed && toggleRole(r.value)}
                        className={`relative rounded-xl border px-4 py-3.5 text-left transition-all duration-150 ${
                          selected
                            ? "border-[#111] bg-[#111] text-white"
                            : maxed
                            ? "border-[#F3F4F6] bg-[#F9FAFB] opacity-40 cursor-not-allowed"
                            : "border-[#E5E7EB] bg-white hover:border-[#111] hover:bg-[#F9FAFB]"
                        }`}
                      >
                        <span className="text-[18px] block mb-1">{r.icon}</span>
                        <span className={`text-[13px] font-bold block ${selected ? "text-white" : "text-[#111]"}`}>
                          {r.label}
                        </span>
                        {selected && (
                          <span className="absolute top-2 right-2 flex h-4 w-4 items-center justify-center rounded-full bg-yellow-400 text-[9px] font-black text-[#111]">
                            ✓
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>

                {data.target_roles.length === 2 && (
                  <p className="text-[12px] text-[#9CA3AF] text-center">
                    Max 2 roles selected — deselect one to change
                  </p>
                )}

                <div className="flex gap-3">
                  <button
                    onClick={next}
                    disabled={data.target_roles.length === 0}
                    className="h-12 flex-1 rounded-xl bg-[#111] text-[14px] font-black text-white transition hover:bg-[#333] disabled:bg-[#F3F4F6] disabled:text-[#9CA3AF] disabled:cursor-not-allowed"
                  >
                    Continue →
                  </button>
                  <button
                    onClick={skipOnboarding}
                    className="h-12 rounded-xl border border-[#E5E7EB] px-5 text-[13px] font-medium text-[#9CA3AF] hover:text-[#111] transition"
                  >
                    Skip
                  </button>
                </div>
              </div>
            )}

            {/* ── STEP 5: Level ── */}
            {step === "level" && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-[26px] font-black tracking-tight text-[#111]">
                    Be honest with yourself.
                  </h2>
                  <p className="mt-1 text-[14px] text-[#9CA3AF]">
                    We'll set the right starting difficulty.
                  </p>
                </div>

                <div className="space-y-2.5">
                  {LEVELS.map((l) => {
                    const selected = data.self_level === l.value;
                    return (
                      <button
                        key={l.value}
                        type="button"
                        onClick={() => set("self_level", l.value)}
                        className={`w-full rounded-xl border px-4 py-4 text-left transition-all duration-150 ${
                          selected
                            ? "border-[#111] bg-[#111]"
                            : "border-[#E5E7EB] bg-white hover:border-[#111] hover:bg-[#F9FAFB]"
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <span className="text-[22px] mt-0.5">{l.emoji}</span>
                          <div className="flex-1">
                            <p className={`text-[14px] font-bold ${selected ? "text-white" : "text-[#111]"}`}>
                              {l.label}
                            </p>
                            <p className={`text-[12px] mt-0.5 leading-snug ${selected ? "text-[#9CA3AF]" : "text-[#9CA3AF]"}`}>
                              {l.sub}
                            </p>
                          </div>
                          {selected && (
                            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-yellow-400 text-[10px] font-black text-[#111] mt-0.5">
                              ✓
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>

                <button
                  onClick={finishOnboarding}
                  disabled={!data.self_level || loading}
                  className="h-12 w-full rounded-xl bg-[#111] text-[14px] font-black text-white transition hover:bg-[#333] disabled:bg-[#F3F4F6] disabled:text-[#9CA3AF] disabled:cursor-not-allowed"
                >
                  {loading ? "Setting up your account..." : "Start practising →"}
                </button>
              </div>
            )}

          </SlideIn>
        </div>
      </div>

      {/* ── Right: visual panel ── */}
      <div className="hidden bg-[#F9FAFB] lg:flex lg:flex-col lg:items-center lg:justify-center px-12 py-16 border-l border-[#E5E7EB]">
        <div className="w-full max-w-105">

          {/* Dynamic right panel content based on step */}
          <SlideIn stepKey={`right-${step}`}>
            {step === "account" && (
              <>
                <p className="text-[11px] font-black uppercase tracking-widest text-[#9CA3AF] mb-6">
                  What you're getting
                </p>
                <div className="space-y-4 mb-10">
                  {[
                    { icon: "🎯", title: "Live coaching", sub: "Real-time feedback while you speak" },
                    { icon: "📊", title: "Per-question breakdown", sub: "What you said, what was missing, what to say" },
                    { icon: "💡", title: "Model answers", sub: "AI shows you the ideal response after each answer" },
                    { icon: "📈", title: "Progress tracking", sub: "Watch your scores improve session by session" },
                  ].map(({ icon, title, sub }) => (
                    <div key={title} className="flex items-start gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white border border-[#E5E7EB] text-[16px]">
                        {icon}
                      </div>
                      <div>
                        <p className="text-[14px] font-bold text-[#111]">{title}</p>
                        <p className="text-[12px] text-[#9CA3AF]">{sub}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Testimonial */}
                <div
                  key={tIdx}
                  style={{ animation: "fadeUp 400ms ease both" }}
                  className="rounded-2xl bg-white border border-[#E5E7EB] p-5"
                >
                  <p className="text-[14px] text-[#374151] leading-relaxed mb-3">
                    &ldquo;{testimonials[tIdx].text}&rdquo;
                  </p>
                  <p className="text-[12px] font-bold text-[#9CA3AF]">
                    — {testimonials[tIdx].author}
                  </p>
                </div>
                <div className="mt-3 flex gap-1.5 justify-center">
                  {[0, 1, 2].map((i) => (
                    <span
                      key={i}
                      className={`rounded-full transition-all ${
                        i === tIdx ? "w-5 h-1.5 bg-[#111]" : "w-1.5 h-1.5 bg-[#E5E7EB]"
                      }`}
                    />
                  ))}
                </div>
              </>
            )}

            {step === "about" && (
              <>
                <p className="text-[11px] font-black uppercase tracking-widest text-[#9CA3AF] mb-4">
                  Why we ask
                </p>
                <h3 className="text-[22px] font-black text-[#111] mb-3 leading-snug">
                  Prep that knows your context.
                </h3>
                <p className="text-[14px] text-[#6B7280] leading-relaxed mb-6">
                  A final-year student at NIT targeting TCS needs different prep than someone at IIT targeting Google. We use your profile to prioritise the right questions.
                </p>
                <div className="rounded-2xl bg-white border border-[#E5E7EB] p-5">
                  <p className="text-[12px] font-bold text-[#9CA3AF] uppercase tracking-wide mb-3">Example</p>
                  <p className="text-[14px] text-[#374151] leading-relaxed">
                    Final year · CS · Campus placement → We'll start with TCS NQT-style questions at Beginner difficulty and increase as you improve.
                  </p>
                </div>
              </>
            )}

            {step === "goal" && (
              <>
                <p className="text-[11px] font-black uppercase tracking-widest text-[#9CA3AF] mb-4">
                  What changes based on your goal
                </p>
                <div className="space-y-3">
                  {[
                    { label: "Question bank", desc: data.placement_goal === "campus" ? "TCS NQT, Infosys InfyTQ style questions" : data.placement_goal === "product" ? "DSA + system design + behavioural mix" : data.placement_goal === "faang" ? "Hard DSA, system design, leadership principles" : "General questions across all topics" },
                    { label: "Difficulty default", desc: data.placement_goal === "campus" ? "Beginner to Intermediate" : data.placement_goal === "product" ? "Intermediate" : data.placement_goal === "faang" ? "Advanced" : "Based on your level" },
                    { label: "Company prep", desc: data.placement_goal === "campus" ? "TCS, Infosys, Wipro, Cognizant" : data.placement_goal === "product" ? "Amazon, Flipkart, Razorpay, Swiggy" : data.placement_goal === "faang" ? "Google, Meta, Microsoft, Apple" : "All companies" },
                  ].map(({ label, desc }) => (
                    <div key={label} className="rounded-xl border border-[#E5E7EB] bg-white p-4">
                      <p className="text-[11px] font-black uppercase tracking-widest text-[#9CA3AF] mb-1">{label}</p>
                      <p className="text-[14px] font-semibold text-[#111]">{desc}</p>
                    </div>
                  ))}
                </div>
                {!data.placement_goal && (
                  <p className="mt-4 text-[13px] text-[#D1D5DB] text-center">Select a goal to see your tailored prep</p>
                )}
              </>
            )}

            {step === "roles" && (
              <>
                <p className="text-[11px] font-black uppercase tracking-widest text-[#9CA3AF] mb-4">
                  Your selection
                </p>
                {data.target_roles.length === 0 ? (
                  <p className="text-[14px] text-[#D1D5DB]">No roles selected yet</p>
                ) : (
                  <div className="space-y-2">
                    {data.target_roles.map((r) => {
                      const role = ROLES.find((x) => x.value === r);
                      return (
                        <div key={r} className="flex items-center gap-3 rounded-xl border border-[#111] bg-[#111] px-4 py-3">
                          <span className="text-[18px]">{role?.icon}</span>
                          <span className="text-[14px] font-bold text-white">{role?.label}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
                <p className="mt-4 text-[13px] text-[#9CA3AF]">
                  Questions will be weighted toward your selected roles. You can always change this later.
                </p>
              </>
            )}

            {step === "level" && (
              <>
                <p className="text-[11px] font-black uppercase tracking-widest text-[#9CA3AF] mb-4">
                  How level affects your session
                </p>
                <div className="space-y-3">
                  <div className="rounded-xl border border-[#E5E7EB] bg-white p-4">
                    <p className="text-[13px] font-bold text-[#111] mb-1">🌱 Still learning</p>
                    <p className="text-[12px] text-[#9CA3AF]">Difficulty 1-2 questions. Fundamental concepts only. More hints during session.</p>
                  </div>
                  <div className="rounded-xl border border-[#E5E7EB] bg-white p-4">
                    <p className="text-[13px] font-bold text-[#111] mb-1">📈 Know the basics</p>
                    <p className="text-[12px] text-[#9CA3AF]">Difficulty 2-3 questions. Mix of concept and application. Standard coaching.</p>
                  </div>
                  <div className="rounded-xl border border-[#111] bg-[#111] p-4">
                    <p className="text-[13px] font-bold text-white mb-1">🎯 Interview ready</p>
                    <p className="text-[12px] text-[#9CA3AF]">Difficulty 3-4 questions. Deep follow-ups. Strict scoring calibration.</p>
                  </div>
                </div>
              </>
            )}
          </SlideIn>
        </div>
      </div>

      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}