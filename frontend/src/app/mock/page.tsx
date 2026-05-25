"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

const API_BASE = (process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:8000").replace(/\/$/, "");

// ─── Constants ────────────────────────────────────────────────────────────────

const ROLES = [
  { value: "Backend Engineer",      label: "Backend",        icon: "⬡", tag: "APIs · Systems · Scale" },
  { value: "Frontend Engineer",     label: "Frontend",       icon: "◈", tag: "UI · Performance · State" },
  { value: "Full Stack Engineer",   label: "Full Stack",     icon: "⌁", tag: "End-to-end product" },
  { value: "AI Engineer",           label: "AI Engineer",    icon: "◆", tag: "ML · LLMs · Infra" },
  { value: "Data Engineer",         label: "Data",           icon: "◉", tag: "Pipelines · Warehouses" },
  { value: "System Design",         label: "System Design",  icon: "⌂", tag: "Architecture · Trade-offs" },
] as const;

const COMPANIES = [
  { value: "",          label: "General prep",  tag: "Any company" },
  { value: "tcs",       label: "TCS",           tag: "Campus placement" },
  { value: "infosys",   label: "Infosys",       tag: "Campus placement" },
  { value: "wipro",     label: "Wipro",         tag: "Campus placement" },
  { value: "amazon",    label: "Amazon",        tag: "FAANG style" },
  { value: "microsoft", label: "Microsoft",     tag: "FAANG style" },
  { value: "startup",   label: "Startup",       tag: "Product focused" },
] as const;

const DIFFICULTY = [
  { value: "beginner",     label: "Beginner",      sub: "Fresher / 0 yr" },
  { value: "intermediate", label: "Intermediate",  sub: "1–2 yrs / placed" },
  { value: "advanced",     label: "Advanced",      sub: "3+ yrs experience" },
] as const;

const PLAN_QUESTIONS: Record<string, number> = { free: 5, pro: 8, max: 11 };
const PLAN_LABEL: Record<string, string> = { free: "Free", pro: "Pro", max: "Max" };

// ─── Helpers ──────────────────────────────────────────────────────────────────

function LoaderSpinner() {
  return <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function MockLandingPage() {
  const router = useRouter();
  const { user } = useAuth();
  const userPlan = user?.plan ?? "free";
  const questionCount = PLAN_QUESTIONS[userPlan] ?? 5;
  const sessionMins = questionCount * 3;

  const [role, setRole] = useState("");
  const [company, setCompany] = useState("");
  const [difficulty, setDifficulty] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Mic
  const [micStatus, setMicStatus] = useState<"idle" | "testing" | "ready" | "blocked">("idle");
  const [micUrl, setMicUrl] = useState<string | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const canStart = Boolean(role && difficulty);

  async function testMic() {
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
          setError("You've used all 3 free sessions this month. Upgrade to Pro for unlimited sessions.");
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

  const selectedRole = ROLES.find((r) => r.value === role);
  const selectedCompany = COMPANIES.find((c) => c.value === company);

  return (
    <main className="min-h-screen bg-[#F9FAFB] pt-20">
      <div className="mx-auto max-w-275 px-4 py-12 sm:px-6">

        {/* ── Header ── */}
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

          {/* ── Left: Config ── */}
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
                      onClick={() => setRole(r.value)}
                      className={`group relative text-left rounded-xl border px-4 py-3.5 transition-all ${
                        selected
                          ? "border-[#111] bg-[#111] text-white"
                          : "border-[#E5E7EB] bg-white hover:border-[#111] hover:bg-[#F9FAFB]"
                      }`}
                    >
                      <span className="text-[20px] block mb-1.5">{r.icon}</span>
                      <span className={`block text-[13px] font-bold ${selected ? "text-white" : "text-[#111]"}`}>
                        {r.label}
                      </span>
                      <span className={`block text-[11px] mt-0.5 ${selected ? "text-[#9CA3AF]" : "text-[#9CA3AF]"}`}>
                        {r.tag}
                      </span>
                      {selected && (
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
                    <button
                      key={c.value}
                      onClick={() => !locked && setCompany(c.value)}
                      className={`rounded-xl border px-4 py-2 text-[13px] font-medium transition ${
                        selected
                          ? "border-[#111] bg-[#111] text-white"
                          : locked
                          ? "border-[#F3F4F6] bg-[#F9FAFB] text-[#D1D5DB] cursor-not-allowed"
                          : "border-[#E5E7EB] text-[#374151] hover:border-[#111] hover:bg-[#F9FAFB]"
                      }`}
                    >
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
                    <button
                      key={d.value}
                      onClick={() => setDifficulty(d.value)}
                      className={`rounded-xl border px-4 py-3 text-center transition ${
                        selected
                          ? "border-[#111] bg-[#111] text-white"
                          : "border-[#E5E7EB] hover:border-[#111] hover:bg-[#F9FAFB]"
                      }`}
                    >
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

            {/* Mic check */}
            <div className="rounded-2xl border border-[#E5E7EB] bg-white p-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className={`h-2 w-2 rounded-full ${
                    micStatus === "ready" ? "bg-emerald-400 animate-pulse" :
                    micStatus === "blocked" ? "bg-rose-400" :
                    micStatus === "testing" ? "bg-amber-400 animate-pulse" :
                    "bg-gray-300"
                  }`} />
                  <span className="text-[13px] text-[#374151]">
                    {micStatus === "ready" ? "Microphone ready" :
                     micStatus === "blocked" ? "Microphone blocked — check browser permissions" :
                     micStatus === "testing" ? "Testing mic..." :
                     "Microphone not tested"}
                  </span>
                </div>
                <button
                  onClick={testMic}
                  disabled={micStatus === "testing"}
                  className="text-[12px] font-semibold text-[#6366F1] hover:text-[#4F46E5] disabled:opacity-50"
                >
                  {micStatus === "testing" ? "Testing..." : "Test mic →"}
                </button>
              </div>
              {micUrl && (
                <div className="mt-3 pt-3 border-t border-[#F3F4F6]">
                  <p className="text-[11px] text-[#9CA3AF] mb-2 uppercase tracking-wide font-bold">Playback</p>
                  <audio controls className="w-full h-8" src={micUrl} />
                </div>
              )}
            </div>

            {/* Start CTA */}
            <div>
              <button
                onClick={startSession}
                disabled={loading || !canStart}
                className={`w-full rounded-2xl py-4 text-[15px] font-black tracking-tight transition-all ${
                  canStart && !loading
                    ? "bg-[#111] text-white hover:bg-[#333] active:scale-[0.99]"
                    : "bg-[#F3F4F6] text-[#9CA3AF] cursor-not-allowed"
                }`}
              >
                {loading ? (
                  <span className="inline-flex items-center gap-2">
                    <LoaderSpinner />
                    Starting session...
                  </span>
                ) : canStart ? (
                  `Start ${selectedRole?.label ?? ""} Session →`
                ) : (
                  "Select role + difficulty to begin"
                )}
              </button>

              {error && (
                <div className="mt-3 rounded-xl bg-rose-50 border border-rose-100 px-4 py-3 text-[13px] text-rose-700">
                  {error}
                  {error.includes("upgrade") && (
                    <a href="/pricing" className="ml-2 font-bold underline">Upgrade →</a>
                  )}
                </div>
              )}
            </div>

          </div>

          {/* ── Right: Info panel ── */}
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
                <div className="border-t border-[#F3F4F6] pt-3 flex items-center justify-between">
                  <span className="text-[13px] text-[#6B7280]">Questions</span>
                  <span className="text-[13px] font-bold text-[#111]">
                    {questionCount} questions · ~{sessionMins} min
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[13px] text-[#6B7280]">Your plan</span>
                  <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-black ${
                    userPlan === "max" ? "bg-[#111] text-white" :
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
            <div className="rounded-2xl border border-[#E5E7EB] bg-white p-5">
              <p className="text-[11px] font-black uppercase tracking-widest text-[#9CA3AF] mb-4">
                What you get
              </p>
              <div className="space-y-3.5">
                {[
                  { icon: "🎯", label: "Live coaching overlay", sub: "WPM, filler words, silence nudges" },
                  { icon: "✦",  label: "AI scoring after each answer", sub: "Technical, communication, depth" },
                  { icon: "📄", label: "Full transcript + report", sub: "Per-question breakdown" },
                  ...(userPlan !== "free"
                    ? [{ icon: "💡", label: "Model answers", sub: "What you could have said instead" }]
                    : [{ icon: "🔒", label: "Model answers", sub: "Pro plan — unlock ideal answers" }]
                  ),
                ].map(({ icon, label, sub }) => (
                  <div key={label} className="flex items-start gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#F9FAFB] border border-[#F3F4F6] text-[15px]">
                      {icon}
                    </div>
                    <div>
                      <p className="text-[13px] font-semibold text-[#111]">{label}</p>
                      <p className="text-[11px] text-[#9CA3AF]">{sub}</p>
                    </div>
                  </div>
                ))}
              </div>
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
      </div>
    </main>
  );
}