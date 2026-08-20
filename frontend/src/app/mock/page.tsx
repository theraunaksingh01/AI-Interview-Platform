"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { AnimatePresence, motion } from "framer-motion";
import { ConsentModal } from "@/app/components/ConsentModal";

const API_BASE = (process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:8000").replace(/\/$/, "");

// ─── Constants ────────────────────────────────────────────────────────────────

const ROLES = [
  { value: "Backend Engineer", label: "SDE", icon: "⬡", tag: "APIs · Systems · Scale", comingSoon: false },
  { value: "AI Engineer", label: "AI / ML", icon: "◆", tag: "ML · LLMs · Infra", comingSoon: false },
  { value: "Data Engineer", label: "Data", icon: "◉", tag: "Pipelines · Warehouses", comingSoon: false },
  { value: "Frontend Engineer", label: "Frontend", icon: "◈", tag: "UI · Performance · State", comingSoon: true },
  { value: "Full Stack Engineer", label: "Full Stack", icon: "✌", tag: "End-to-end product", comingSoon: true },
  { value: "System Design", label: "System Design", icon: "✂", tag: "Architecture · Trade-offs", comingSoon: true },
] as const;

const COMPANIES = [
  { value: "", label: "General prep", tag: "Any company" },
  { value: "tcs", label: "TCS", tag: "Campus placement" },
  { value: "infosys", label: "Infosys", tag: "Campus placement" },
  { value: "wipro", label: "Wipro", tag: "Campus placement" },
  { value: "amazon", label: "Amazon", tag: "FAANG style" },
  { value: "microsoft", label: "Microsoft", tag: "FAANG style" },
  { value: "startup", label: "Startup", tag: "Product focused" },
] as const;

const DIFFICULTY = [
  { value: "beginner", label: "Beginner", sub: "Fresher / 0 yr" },
  { value: "intermediate", label: "Intermediate", sub: "1–2 yrs / placed" },
  { value: "advanced", label: "Advanced", sub: "3+ yrs experience" },
] as const;

const VALID_ROLES = ROLES.map((r) => r.value);
const VALID_DIFFICULTIES = ["beginner", "intermediate", "advanced"];

const PLAN_QUESTIONS: Record<string, number> = { free: 5, pro: 8, max: 11 };
const PLAN_LABEL: Record<string, string> = { free: "Free", pro: "Pro", max: "Max" };

// Roles that include DSA/coding questions — show language preference only for these
const DSA_ROLES = new Set([
  "Backend Engineer",
  "Full Stack Engineer",
  "AI Engineer",
  "Data Engineer",
]);

const LANGUAGES = [
  { value: "python", label: "Python" },
  { value: "java", label: "Java" },
  { value: "cpp", label: "C++" },
  { value: "", label: "No preference" },
] as const;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function LoaderSpinner() {
  return <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />;
}

function SessionLimitModal({ onClose }: { onClose: () => void }) {
  const [selected, setSelected] = useState<"pro" | "max">("max");

  const plans = {
    pro: {
      price: "₹199",
      label: "Pro",
      questions: 8,
      features: [
        "Unlimited sessions every month",
        "8 questions per session",
        "Model answers after every question",
        "Company-specific prep questions",
        "Full Skill Passport + progress tracking",
      ],
    },
    max: {
      price: "₹499",
      label: "Max",
      questions: 11,
      features: [
        "Unlimited sessions every month",
        "11 questions per session",
        "Model answers after every question",
        "Company-specific prep questions",
        "Full Skill Passport + progress tracking",
        "Retry any answer on the report",
        "Priority AI scoring",
      ],
    },
  };

  const current = plans[selected];

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center px-0 sm:px-4"
      style={{ background: "rgba(0,0,0,0.55)" }}
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 40 }}
        transition={{ duration: 0.25, ease: "easeOut" }}
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-105 overflow-hidden bg-white sm:rounded-3xl rounded-t-3xl"
        style={{
          boxShadow: "0 -8px 40px rgba(0,0,0,0.15), 0 0 0 1px rgba(0,0,0,0.06)",
          maxHeight: "90vh",
          overflowY: "auto",
        }}
      >
        {/* Hero top */}
        <div className="relative overflow-hidden px-7 pt-6 pb-4 text-center"
          style={{ background: "linear-gradient(160deg, #FFFDF0 0%, #FFF9D6 100%)" }}>
          <button onClick={onClose}
            className="absolute top-4 right-4 flex h-8 w-8 items-center justify-center rounded-full bg-white/80 text-[#374151] hover:bg-white transition text-[16px] shadow-sm">
            ×
          </button>
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-3xl border-2 border-yellow-400 bg-white shadow-md">
            <div className="text-center">
              <p className="text-[22px] font-black text-[#111] leading-none">3</p>
              <p className="text-[9px] text-[#9CA3AF] uppercase tracking-wide">/ 3 used</p>
            </div>
          </div>
          <h2 className="text-[18px] font-black text-[#111] leading-tight mb-1" style={{ letterSpacing: "-0.5px" }}>
            You&apos;ve used all your
          </h2>
          <p className="text-[18px] font-black leading-tight" style={{ letterSpacing: "-0.5px" }}>
            <span style={{ background: "#FFD600", padding: "1px 10px", borderRadius: "6px", fontStyle: "italic" }}>
              free sessions
            </span>
          </p>
          <p className="mt-1 text-[13px] text-[#6B7280]">
            Upgrade to keep practising — your next interview won&apos;t wait.
          </p>
        </div>

        {/* Plan selector */}
        <div className="px-7 pt-4">
          <p className="text-[11px] font-black uppercase tracking-widest text-[#9CA3AF] mb-3">Select your plan</p>
          <div className="grid grid-cols-2 gap-2.5 mb-3">
            {(["pro", "max"] as const).map((plan) => (
              <button key={plan} onClick={() => setSelected(plan)}
                className={`relative rounded-2xl border-2 px-4 py-3 text-left transition-all ${selected === plan ? "border-[#111] bg-[#111]" : "border-[#E5E7EB] bg-white hover:border-[#D1D5DB]"
                  }`}>
                {plan === "max" && (
                  <span className="absolute -top-2 left-3 rounded-full bg-yellow-400 px-2 py-0.5 text-[9px] font-black text-[#111]">
                    BEST VALUE
                  </span>
                )}
                <p className={`text-[15px] font-black mb-0.5 ${selected === plan ? "text-white" : "text-[#111]"}`}>
                  {plans[plan].label}
                </p>
                <p className={`text-[18px] font-black leading-none ${selected === plan ? "text-white" : "text-[#111]"}`}>
                  {plans[plan].price}
                  <span className={`text-[11px] font-medium ml-1 ${selected === plan ? "text-white/50" : "text-[#9CA3AF]"}`}>
                    /mo
                  </span>
                </p>
              </button>
            ))}
          </div>

          <p className="text-[11px] font-black uppercase tracking-widest text-[#9CA3AF] mb-3">What you get</p>
          <div className="space-y-2 mb-6">
            {current.features.map((f, i) => (
              <motion.div key={f} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }} className="flex items-center gap-2.5">
                <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#111] text-[9px] font-black text-white">
                  ✓
                </div>
                <p className="text-[13px] text-[#374151]">{f}</p>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Sticky CTA */}
        <div className="border-t border-[#F3F4F6] px-7 py-4 bg-white">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[13px] text-[#6B7280]">{current.label} plan</p>
            <p className="text-[18px] font-black text-[#111]">
              {current.price}
              <span className="text-[12px] font-medium text-[#9CA3AF] ml-1">/month</span>
            </p>
          </div>
          <a href="/pricing" className="block w-full">
            <button className="w-full rounded-2xl bg-[#111] py-3.5 text-[14px] font-black text-white hover:bg-[#333] transition active:scale-[0.99]">
              Upgrade to {current.label} →
            </button>
          </a>
          <button onClick={onClose}
            className="mt-2.5 w-full py-2 text-center text-[12px] text-[#9CA3AF] hover:text-[#111] transition">
            Maybe next month
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function MockLandingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();   // ← use Next.js hook, not window.location
  const { user } = useAuth();

  const userPlan = user?.plan ?? "free";
  const questionCount = PLAN_QUESTIONS[userPlan] ?? 5;
  const sessionMins = questionCount * 3;

  // ── FIXED: initialise state directly from URL params on first render ──────
  const initialRole = (() => {
    const p = searchParams.get("prefill_role") ?? "";
    return VALID_ROLES.includes(p as typeof VALID_ROLES[number]) ? p : "";
  })();

  const initialDifficulty = (() => {
    const p = searchParams.get("prefill_difficulty") ?? "";
    return VALID_DIFFICULTIES.includes(p) ? p : "";
  })();

  const [role, setRole] = useState(initialRole);
  const [company, setCompany] = useState("");
  const [difficulty, setDifficulty] = useState(initialDifficulty);
  const [language, setLanguage] = useState("");  // preferred coding language
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showLimitModal, setShowLimitModal] = useState(false);
  const [showConsent, setShowConsent] = useState(false);
  const [hasConsented, setHasConsented] = useState<boolean | null>(null);

  // Onboarding prefill (localStorage) — only runs once, doesn't override URL params
  useEffect(() => {
    const onboardingRole = localStorage.getItem("onboarding_role");
    const onboardingLevel = localStorage.getItem("onboarding_level");

    if (onboardingRole && !role) {
      setRole(onboardingRole);
      localStorage.removeItem("onboarding_role");
    }
    if (onboardingLevel && !difficulty) {
      const levelMap: Record<string, string> = {
        beginner: "beginner",
        intermediate: "intermediate",
        ready: "advanced",
      };
      setDifficulty(levelMap[onboardingLevel] || onboardingLevel);
      localStorage.removeItem("onboarding_level");
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const token = localStorage.getItem("access_token") || localStorage.getItem("API_TOKEN");
    if (!token) return;
    fetch(`${API_BASE}/auth/me/consent`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.ok ? r.json() : { consent: false })
      .then(d => setHasConsented(d.consent))
      .catch(() => setHasConsented(false));
  }, []);

  // Mic
  const [micStatus, setMicStatus] = useState<"idle" | "testing" | "ready" | "blocked">("idle");
  const [micUrl, setMicUrl] = useState<string | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraStatus, setCameraStatus] = useState<"idle" | "testing" | "ready" | "blocked">("idle");
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const canStart = Boolean(role && difficulty && micStatus === "ready" && cameraStatus === "ready");

  async function testMic() {
    if (hasConsented === false) {
      setShowConsent(true);
      return;
    }
    setMicStatus("testing");
    setMicUrl(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const recorder = new MediaRecorder(stream);
      const chunks: BlobPart[] = [];
      recorder.ondataavailable = (e) => chunks.push(e.data);
      recorder.start();
      await new Promise((r) => setTimeout(r, 1500));
      recorder.stop();
      await new Promise((r) => (recorder.onstop = r));
      const blob = new Blob(chunks, { type: "audio/webm" });
      setMicUrl(URL.createObjectURL(blob));
      setMicStatus("ready");
    } catch {
      setMicStatus("blocked");
    } finally {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }

  async function testCamera() {
    if (hasConsented === false) {
      setShowConsent(true);
      return;
    }
    setCameraStatus("testing");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      setCameraStream(stream);
      setCameraStatus("ready");
    } catch {
      setCameraStatus("blocked");
    }
  }

  async function startSession() {
    if (!canStart) return;
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem("access_token") || localStorage.getItem("API_TOKEN");
      const res = await fetch(`${API_BASE}/api/mock/session/start`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          role_target: role,
          seniority: difficulty,
          company_type: company || null,
          focus_area: "mixed",
          duration_mins: questionCount * 3,
          resume_uploaded: false,
        }),
      });

      if (res.status === 403) {
        const body = await res.json().catch(() => ({}));
        if (body?.detail === "limit_reached") {
          setShowLimitModal(true);
          setError("");
          return;
        }
      }

      if (!res.ok) throw new Error("Failed to start session");
      const data = await res.json();
      if (data?.session_id) {
        router.push(`/mock/session/${data.session_id}`);
      } else {
        setError("Could not create session. Try again.");
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    return () => { streamRef.current?.getTracks().forEach((t) => t.stop()); };
  }, []);

  useEffect(() => {
    return () => {
      if (cameraStream) {
        cameraStream.getTracks().forEach(t => t.stop());
      }
    };
  }, [cameraStream]);

  useEffect(() => {
    if (cameraStream && videoRef.current) {
      videoRef.current.srcObject = cameraStream;
    }
  }, [cameraStream, cameraStatus]);

  const selectedRole = ROLES.find((r) => r.value === role);
  const selectedCompany = COMPANIES.find((c) => c.value === company);

  return (
    <main className="min-h-screen bg-[#F9FAFB] pt-20">
      <div className="mx-auto max-w-275 px-4 py-12 sm:px-6">

        {/* Header */}
        <div className="mb-10">
          <p className="text-[11px] font-black uppercase tracking-widest text-[#9CA3AF] mb-2">
            Mock Interview
          </p>
          <h1 className="text-[34px] font-black tracking-tight text-[#111] leading-[1.1] sm:text-[42px]">
            Practice that actually{" "}
            <span className="bg-yellow-400 px-2 rounded-md italic">prepares you.</span>
          </h1>
          <p className="mt-3 text-[15px] text-[#6B7280]">
            Personalised questions. Live coaching. Instant feedback.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_340px]">

          {/* Left: Config */}
          <div className="space-y-5">

            {/* Role */}
            <div className="rounded-2xl border border-[#E5E7EB] bg-white p-6">
              <p className="text-[13px] font-bold text-[#111] mb-0.5">Role</p>
              <p className="text-[12px] text-[#9CA3AF] mb-4">What are you interviewing for?</p>
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                {ROLES.map((r) => {
                  const selected = role === r.value;
                  return (
                    <button
                      key={r.value}
                      onClick={() => !r.comingSoon && setRole(r.value)}
                      disabled={r.comingSoon}
                      className={`group relative text-left rounded-xl border px-4 py-3.5 transition-all ${r.comingSoon
                        ? "border-[#F3F4F6] bg-[#FAFAF8] cursor-not-allowed opacity-60"
                        : selected
                          ? "border-[#111] bg-[#111] text-white"
                          : "border-[#E5E7EB] bg-white hover:border-[#111] hover:bg-[#F9FAFB]"
                        }`}
                    >
                      <span className="text-[20px] block mb-1.5">{r.icon}</span>
                      <span className={`block text-[13px] font-bold ${r.comingSoon ? "text-[#9CA3AF]" : selected ? "text-white" : "text-[#111]"}`}>
                        {r.label}
                      </span>
                      <span className="block text-[11px] mt-0.5 text-[#9CA3AF]">
                        {r.tag}
                      </span>
                      {r.comingSoon && (
                        <span className="absolute top-2.5 right-2.5 rounded-full bg-[#F3F4F6] px-2 py-0.5 text-[9px] font-black text-[#9CA3AF]">
                          Coming soon
                        </span>
                      )}
                      {selected && !r.comingSoon && (
                        <span className="absolute top-2.5 right-2.5 flex h-4 w-4 items-center justify-center rounded-full bg-yellow-400 text-[9px] font-black text-[#111]">
                          ✓
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Company */}
            <div className="rounded-2xl border border-[#E5E7EB] bg-white p-6">
              <p className="text-[13px] font-bold text-[#111] mb-0.5">Target Company</p>
              <p className="text-[12px] text-[#9CA3AF] mb-4">
                Questions tailored to company style
                {userPlan === "free" && (
                  <span className="ml-2 rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 text-[10px] font-bold text-amber-600">
                    Pro feature
                  </span>
                )}
              </p>
              <div className="flex flex-wrap gap-2">
                {COMPANIES.map((c) => {
                  const selected = company === c.value;
                  const locked = userPlan === "free" && c.value !== "";
                  return (
                    <button key={c.value} onClick={() => !locked && setCompany(c.value)}
                      className={`rounded-xl border px-4 py-2 text-[13px] font-medium transition ${selected
                        ? "border-[#111] bg-[#111] text-white"
                        : locked
                          ? "border-[#F3F4F6] bg-[#F9FAFB] text-[#D1D5DB] cursor-not-allowed"
                          : "border-[#E5E7EB] text-[#374151] hover:border-[#111] hover:bg-[#F9FAFB]"
                        }`}>
                      {c.label}
                      {locked && <span className="ml-1 text-[10px]">🔒</span>}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Difficulty */}
            <div className="rounded-2xl border border-[#E5E7EB] bg-white p-6">
              <p className="text-[13px] font-bold text-[#111] mb-0.5">Difficulty</p>
              <p className="text-[12px] text-[#9CA3AF] mb-4">Sets question complexity and scoring bar</p>
              <div className="grid grid-cols-3 gap-2.5">
                {DIFFICULTY.map((d) => {
                  const selected = difficulty === d.value;
                  return (
                    <button key={d.value} onClick={() => setDifficulty(d.value)}
                      className={`rounded-xl border px-4 py-3 text-center transition ${selected
                        ? "border-[#111] bg-[#111] text-white"
                        : "border-[#E5E7EB] hover:border-[#111] hover:bg-[#F9FAFB]"
                        }`}>
                      <span className={`block text-[13px] font-bold ${selected ? "text-white" : "text-[#111]"}`}>
                        {d.label}
                      </span>
                      <span className={`block text-[11px] mt-0.5 ${selected ? "text-[#9CA3AF]" : "text-[#9CA3AF]"}`}>
                        {d.sub}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Language preference — only for DSA roles */}
            {DSA_ROLES.has(role) && (
              <div className="rounded-2xl border border-[#E5E7EB] bg-white p-6">
                <p className="text-[13px] font-bold text-[#111] mb-0.5">Preferred coding language</p>
                <p className="text-[12px] text-[#9CA3AF] mb-4">
                  DSA questions will be in your chosen language — or language-agnostic if you pick No preference
                </p>
                <div className="flex flex-wrap gap-2">
                  {LANGUAGES.map((l) => {
                    const selected = language === l.value;
                    return (
                      <button
                        key={l.value}
                        onClick={() => setLanguage(l.value)}
                        className="rounded-xl border px-4 py-2 text-[13px] font-medium transition"
                        style={{
                          background: selected ? "#111" : "white",
                          color: selected ? "white" : "#374151",
                          borderColor: selected ? "#111" : "#E5E7EB",
                        }}
                      >
                        {l.label}
                        {selected && <span className="ml-1.5 text-yellow-400">✓</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="rounded-2xl border border-[#E5E7EB] bg-white p-5">
              <p className="text-[13px] font-bold text-[#111] mb-0.5">Camera & Microphone</p>
              <p className="text-[12px] text-[#9CA3AF] mb-4">Required to start your session</p>

              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={testMic}
                  disabled={micStatus === "testing"}
                  className="rounded-xl border px-4 py-3.5 text-left transition-all"
                  style={{
                    borderColor: micStatus === "ready" ? "#10B981" : "#E5E7EB",
                    background: micStatus === "ready" ? "#F0FDF4" : "white",
                  }}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[18px]">🎤</span>
                    {micStatus === "ready" && (
                      <span className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-[9px] font-black text-white">✓</span>
                    )}
                    {micStatus === "blocked" && (
                      <span className="flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[9px] font-black text-white">!</span>
                    )}
                  </div>
                  <p className="text-[12px] font-bold text-[#111]">
                    {micStatus === "ready" ? "Mic enabled" :
                      micStatus === "blocked" ? "Mic blocked" :
                        micStatus === "testing" ? "Enabling..." :
                          "Enable mic"}
                  </p>
                  <p className="text-[10px] text-[#9CA3AF] mt-0.5">
                    {micStatus === "blocked" ? "Check browser settings" : "Click to allow access"}
                  </p>
                </button>

                <button
                  onClick={testCamera}
                  disabled={cameraStatus === "testing"}
                  className="rounded-xl border px-4 py-3.5 text-left transition-all"
                  style={{
                    borderColor: cameraStatus === "ready" ? "#10B981" : "#E5E7EB",
                    background: cameraStatus === "ready" ? "#F0FDF4" : "white",
                  }}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[18px]">📹</span>
                    {cameraStatus === "ready" && (
                      <span className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-[9px] font-black text-white">✓</span>
                    )}
                    {cameraStatus === "blocked" && (
                      <span className="flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[9px] font-black text-white">!</span>
                    )}
                  </div>
                  <p className="text-[12px] font-bold text-[#111]">
                    {cameraStatus === "ready" ? "Camera enabled" :
                      cameraStatus === "blocked" ? "Camera blocked" :
                        cameraStatus === "testing" ? "Enabling..." :
                          "Enable camera"}
                  </p>
                  <p className="text-[10px] text-[#9CA3AF] mt-0.5">
                    {cameraStatus === "blocked" ? "Check browser settings" : "Click to allow access"}
                  </p>
                </button>
              </div>

              {(cameraStatus === "ready" || micStatus === "ready") && (
                <div className="mt-4 pt-4 border-t border-[#F3F4F6]">
                  <div className="grid grid-cols-2 gap-3 items-start">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wide text-[#9CA3AF] mb-1.5">Microphone</p>
                      {micStatus === "ready" && micUrl ? (
                        <div className="rounded-xl bg-[#FAFAF8] border border-[#F3F4F6] p-3 h-full flex flex-col justify-center">
                          <audio controls className="w-full h-8" src={micUrl} />
                        </div>
                      ) : (
                        <div className="w-full rounded-xl bg-[#F3F4F6] aspect-video flex items-center justify-center">
                          <span className="text-[11px] text-[#D1D5DB]">Not enabled</span>
                        </div>
                      )}
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wide text-[#9CA3AF] mb-1.5">Camera preview</p>
                      {cameraStatus === "ready" ? (
                        <video ref={videoRef} autoPlay muted playsInline className="w-full rounded-xl bg-black aspect-video object-cover" />
                      ) : (
                        <div className="w-full rounded-xl bg-[#F3F4F6] aspect-video flex items-center justify-center">
                          <span className="text-[11px] text-[#D1D5DB]">Not enabled</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Start CTA */}
            <div>
              <button onClick={startSession} disabled={loading || !canStart}
                className={`w-full rounded-2xl py-4 text-[15px] font-black tracking-tight transition-all ${canStart && !loading
                  ? "bg-[#111] text-white hover:bg-[#333] active:scale-[0.99]"
                  : "bg-[#F3F4F6] text-[#9CA3AF] cursor-not-allowed"
                  }`}>
                {loading ? (
                  <span className="inline-flex items-center gap-2">
                    <LoaderSpinner />
                    Starting session...
                  </span>
                ) : canStart ? (
                  `Start ${selectedRole?.label ?? ""} Session →`
                ) : !role || !difficulty ? (
                  "Select role + difficulty to begin"
                ) : micStatus !== "ready" ? (
                  "Enable microphone to continue"
                ) : (
                  "Enable camera to continue"
                )}
              </button>

              {error && !showLimitModal && (
                <div className="mt-3 rounded-xl bg-rose-50 border border-rose-100 px-4 py-3 text-[13px] text-rose-700">
                  {error}
                  {error.includes("upgrade") && (
                    <a href="/pricing" className="ml-2 font-bold underline">Upgrade →</a>
                  )}
                </div>
              )}
            </div>

          </div>

          {/* Right: Info panel */}
          <div className="space-y-4 lg:sticky lg:top-24 lg:self-start">

            {/* Session summary */}
            <div className="rounded-2xl border border-[#E5E7EB] bg-white p-5">
              <p className="text-[11px] font-black uppercase tracking-widest text-[#9CA3AF] mb-4">
                Your session
              </p>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[13px] text-[#6B7280]">Role</span>
                  <span className="text-[13px] font-semibold text-[#111]">
                    {selectedRole?.label ?? <span className="text-[#D1D5DB]">Not selected</span>}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[13px] text-[#6B7280]">Company</span>
                  <span className="text-[13px] font-semibold text-[#111]">
                    {selectedCompany?.label ?? "General prep"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[13px] text-[#6B7280]">Difficulty</span>
                  <span className="text-[13px] font-semibold text-[#111] capitalize">
                    {difficulty || <span className="text-[#D1D5DB]">Not selected</span>}
                  </span>
                </div>
                {DSA_ROLES.has(role) && (
                  <div className="flex items-center justify-between">
                    <span className="text-[13px] text-[#6B7280]">Coding language</span>
                    <span className="text-[13px] font-semibold text-[#111]">
                      {language
                        ? LANGUAGES.find(l => l.value === language)?.label ?? language
                        : <span className="text-[#D1D5DB]">No preference</span>}
                    </span>
                  </div>
                )}
                <div className="border-t border-[#F3F4F6] pt-3 flex items-center justify-between">
                  <span className="text-[13px] text-[#6B7280]">Questions</span>
                  <span className="text-[13px] font-bold text-[#111]">
                    {questionCount} questions · ~{sessionMins} min
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[13px] text-[#6B7280]">Your plan</span>
                  <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-black ${userPlan === "max" ? "bg-[#111] text-white" :
                    userPlan === "pro" ? "bg-[#F3F4F6] text-[#374151] border border-[#E5E7EB]" :
                      "bg-[#F9FAFB] text-[#9CA3AF] border border-[#E5E7EB]"
                    }`}>
                    {PLAN_LABEL[userPlan] ?? "Free"}
                  </span>
                </div>
              </div>
              {userPlan === "free" && (
                <div className="mt-4 rounded-xl bg-amber-50 border border-amber-100 px-3 py-2.5">
                  <p className="text-[12px] text-amber-700">
                    <span className="font-bold">Free plan:</span> 5 questions, no model answers.{" "}
                    <a href="/pricing" className="font-bold underline">Upgrade for 8+ questions →</a>
                  </p>
                </div>
              )}
            </div>

            {/* What you get */}
            <div className="rounded-2xl overflow-hidden" style={{ background: "#111" }}>
              <div className="px-5 pt-5 pb-4" style={{ borderBottom: "1px solid #222" }}>
                <p className="text-[11px] font-black uppercase tracking-widest mb-1" style={{ color: "#FFD600" }}>
                  What you get
                </p>
                <p className="text-[13px] font-bold text-white">Every session includes</p>
              </div>
              <div className="p-5 space-y-4">
                {[
                  { icon: "🎯", label: "Live coaching overlay", sub: "WPM, filler words, silence nudges — while you speak" },
                  { icon: "✦", label: "AI scoring after each answer", sub: "Technical accuracy, communication, depth" },
                  { icon: "📄", label: "Full transcript + report", sub: "Per-question breakdown of what you said" },
                  ...(userPlan !== "free"
                    ? [{ icon: "💡", label: "Model answers", sub: "What a strong candidate would have said" }]
                    : [{ icon: "🔒", label: "Model answers", sub: "Unlock with Pro — see the ideal answer" }]
                  ),
                ].map(({ icon, label, sub }) => (
                  <div key={label} className="flex items-start gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-[15px]"
                      style={{ background: "rgba(255,255,255,0.06)" }}>
                      {icon}
                    </div>
                    <div>
                      <p className="text-[13px] font-bold text-white">{label}</p>
                      <p className="text-[11px]" style={{ color: "#666" }}>{sub}</p>
                    </div>
                  </div>
                ))}
              </div>
              {userPlan === "free" && (
                <div className="px-5 py-4" style={{ borderTop: "1px solid #222", background: "rgba(255,214,0,0.04)" }}>
                  <p className="text-[11px] mb-2" style={{ color: "#888" }}>
                    Free plan: 3 sessions/month · 5 questions/session
                  </p>
                  <a href="/pricing" className="text-[12px] font-black" style={{ color: "#FFD600" }}>
                    Upgrade for unlimited sessions →
                  </a>
                </div>
              )}
            </div>

            {/* Sample question preview */}
            {role && (
              <div className="rounded-2xl border border-[#E5E7EB] bg-white p-5">
                <p className="text-[11px] font-black uppercase tracking-widest text-[#9CA3AF] mb-3">
                  Sample question
                </p>
                <div className="rounded-xl bg-[#F9FAFB] border border-[#F3F4F6] p-4">
                  <span className="inline-block rounded-full bg-[#111] text-white text-[10px] font-bold px-2.5 py-0.5 mb-3">
                    {selectedRole?.label}
                  </span>
                  <p className="text-[13px] text-[#374151] leading-relaxed">
                    {role === "Backend Engineer" && "Explain database indexing and when you'd choose a composite index over a single-column one."}
                    {role === "Frontend Engineer" && "How does React reconciliation work, and how would you optimise a slow render?"}
                    {role === "Full Stack Engineer" && "Walk me through a recent feature you built end-to-end — what trade-offs did you make?"}
                    {role === "AI Engineer" && "How would you evaluate the quality of an LLM-generated response at scale?"}
                    {role === "Data Engineer" && "Design a pipeline that ingests 10M events/day with exactly-once semantics."}
                    {role === "System Design" && "Design a URL shortener like bit.ly. Walk through your approach."}
                  </p>
                </div>
              </div>
            )}

          </div>
        </div>

        <AnimatePresence>
          {showLimitModal && (
            <SessionLimitModal onClose={() => setShowLimitModal(false)} />
          )}
        </AnimatePresence>

        {showConsent && (
          <ConsentModal
            onAccept={() => {
              setHasConsented(true);
              setShowConsent(false);
            }}
            onDecline={() => setShowConsent(false)}
          />
        )}

      </div>
    </main>
  );
}