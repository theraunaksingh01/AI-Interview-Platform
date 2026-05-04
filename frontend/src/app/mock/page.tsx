"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

const API_BASE = (process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:8000").replace(/\/$/, "");

function MicIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path d="M12 14a3 3 0 0 0 3-3V6a3 3 0 1 0-6 0v5a3 3 0 0 0 3 3Z" stroke="currentColor" strokeWidth="1.8" />
      <path d="M7 11a5 5 0 0 0 10 0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function LoaderSpinner() {
  return <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden="true" />;
}

const ROLE_OPTIONS = [
  { icon: "⌁", label: "Software Engineer", value: "Software Engineer", tagline: "Balanced technical + communication", focusArea: "mixed" as const },
  { icon: "◈", label: "Frontend", value: "Frontend", tagline: "UI, performance, state, accessibility", focusArea: "dsa" as const },
  { icon: "⌂", label: "Backend", value: "Backend", tagline: "APIs, systems, scale, reliability", focusArea: "system_design" as const },
  { icon: "⬡", label: "Full Stack", value: "Full Stack", tagline: "Product thinking across layers", focusArea: "mixed" as const },
  { icon: "◉", label: "Data Engineer", value: "Data Engineer", tagline: "Pipelines, orchestration, data quality", focusArea: "system_design" as const },
  { icon: "◆", label: "System Design", value: "System Design", tagline: "Trade-offs, architecture, scale", focusArea: "system_design" as const },
];
const DIFFICULTY_OPTIONS = ["Beginner", "Intermediate", "Advanced"] as const;
const QUESTION_COUNTS = [5, 8, 11] as const;
const ROLE_MAP = Object.fromEntries(ROLE_OPTIONS.map((r) => [r.value, r]));

export default function MockLandingPage() {
  const router = useRouter();

  const [roleTarget, setRoleTarget] = useState<string>("");
  const [seniority, setSeniority] = useState<string>("");
  const [companyType, setCompanyType] = useState<string>("voice");
  const [questionCount, setQuestionCount] = useState<5 | 8 | 11>(8);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [micStatus, setMicStatus] = useState<"ready" | "blocked" | "testing">("ready");
  const [micTesting, setMicTesting] = useState(false);
  const [micPreviewUrl, setMicPreviewUrl] = useState<string | null>(null);

  const mediaStreamRef = useRef<MediaStream | null>(null);

  const selectedRole = (ROLE_MAP as any)[roleTarget] || null;
  const selectedRoleFocus = (selectedRole?.focusArea || "mixed") as "mixed" | "dsa" | "system_design";
  const allSelected = Boolean(roleTarget && seniority && companyType);
  const sessionMinutes = questionCount * 3;

  const roleFocusLabel = selectedRoleFocus === "system_design" ? "System design heavy" : selectedRoleFocus === "dsa" ? "Coding focused" : "Mixed simulation";

  const tipText = useMemo(() => {
    if (!roleTarget || !seniority) return "Select a role and difficulty to see tailored tips.";
    return `This session focuses on ${roleFocusLabel}.`;
  }, [roleTarget, seniority, roleFocusLabel]);

  async function testMic() {
    setMicTesting(true);
    setMicStatus("testing");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      const mediaRecorder = new (window as any).MediaRecorder(stream);
      const chunks: BlobPart[] = [];
      mediaRecorder.ondataavailable = (e: BlobEvent) => chunks.push(e.data);
      mediaRecorder.start();
      await new Promise((r) => setTimeout(r, 1400));
      mediaRecorder.stop();
      await new Promise((r) => (mediaRecorder.onstop = r));
      const blob = new Blob(chunks, { type: "audio/webm" });
      const url = URL.createObjectURL(blob);
      setMicPreviewUrl(url);
      setMicStatus("ready");
    } catch (e) {
      setMicStatus("blocked");
    } finally {
      setMicTesting(false);
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((t) => t.stop());
        mediaStreamRef.current = null;
      }
    }
  }

  async function startMock() {
    if (!allSelected) return;
    setLoading(true);
    setError(null);
    try {
      const resp = await fetch(`${API_BASE}/api/mock/session/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: roleTarget, difficulty: seniority, mode: companyType, questions: questionCount }),
      });
      if (!resp.ok) throw new Error("Failed to start session");
      const data = await resp.json();
      const id = data?.session_id || data?.id || null;
      if (id) {
        router.push(`/mock/${id}`);
      } else {
        setError("Unable to create session");
      }
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    return () => {
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-6 py-12">
        <header className="mb-8">
          <p className="text-xs tracking-widest text-gray-400 font-medium mb-2">MOCK INTERVIEW</p>
          <h1 className="text-3xl font-semibold text-gray-900">Practice, built for real interviews.</h1>
          <p className="text-sm text-gray-500 mt-1">Personalised questions. Live feedback. No pressure.</p>
        </header>

        <div className="mt-8 grid grid-cols-1 lg:grid-cols-5 gap-6">
          <div className="lg:col-span-3">
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8">
              <div className="mb-4">
                <div className="text-sm font-medium text-gray-700">Role</div>
                <div className="text-xs text-gray-400">Choose the interview track</div>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-6">
                {ROLE_OPTIONS.map((role) => {
                  const selected = roleTarget === role.value;
                  return (
                    <button
                      key={role.value}
                      type="button"
                      onClick={() => setRoleTarget(role.value)}
                      className={`text-left rounded-xl border p-4 transition-all duration-150 ${
                        selected ? "border-indigo-500 bg-indigo-50 ring-1 ring-indigo-500" : "border-gray-200 hover:border-indigo-300 hover:bg-indigo-50/30"
                      }`}
                    >
                      <div className="text-2xl">{role.icon}</div>
                      <div className="mt-2 text-sm font-medium text-gray-900">{role.label}</div>
                      <div className="mt-0.5 text-xs text-gray-500">{role.tagline}</div>
                    </button>
                  );
                })}
              </div>

              <div className="mb-6">
                <div className="text-sm font-medium text-gray-700">Difficulty</div>
                <div className="text-xs text-gray-400 mb-3">Sets pacing and question complexity</div>
                <div className="flex gap-3">
                  {DIFFICULTY_OPTIONS.map((level) => {
                    const selected = seniority === level;
                    return (
                      <button
                        key={level}
                        type="button"
                        onClick={() => setSeniority(level)}
                        className={`px-5 py-2 rounded-full text-sm transition ${
                          selected ? "bg-indigo-500 text-white border border-indigo-500 font-medium" : "border border-gray-200 text-gray-600 hover:bg-gray-50"
                        }`}
                      >
                        {level}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="mb-6">
                <div className="text-sm font-medium text-gray-700">Session Type</div>
                <div className="text-xs text-gray-400 mb-3">Choose voice or typed practice</div>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setCompanyType("voice")}
                    className={`rounded-xl p-4 text-center ${companyType === "voice" ? "border-indigo-500 bg-indigo-50" : "border border-gray-200"}`}
                  >
                    <div className="text-2xl">🎙️</div>
                    <div className="mt-2 text-sm font-medium text-gray-900">Voice Interview</div>
                    <div className="mt-1 text-xs text-gray-500">Speak your answers</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setCompanyType("text")}
                    className={`rounded-xl p-4 text-center ${companyType === "text" ? "border-indigo-500 bg-indigo-50" : "border border-gray-200"}`}
                  >
                    <div className="text-2xl">⌨️</div>
                    <div className="mt-2 text-sm font-medium text-gray-900">Text Interview</div>
                    <div className="mt-1 text-xs text-gray-500">Type your answers</div>
                  </button>
                </div>
              </div>

              <div className="mb-6">
                <div className="text-sm font-medium text-gray-700">Number of Questions</div>
                <div className="flex gap-3 mt-3">
                  {QUESTION_COUNTS.map((count) => {
                    const selected = questionCount === count;
                    return (
                      <button
                        key={count}
                        type="button"
                        onClick={() => setQuestionCount(count as 5 | 8 | 11)}
                        className={`px-5 py-2 rounded-full text-sm ${selected ? "bg-indigo-500 text-white" : "border border-gray-200 text-gray-600"}`}
                      >
                        {count}
                      </button>
                    );
                  })}
                </div>
                <div className="text-xs text-gray-400 mt-3">Estimated duration: {sessionMinutes} minutes</div>
              </div>

              {companyType === "voice" && (
                <div className="bg-gray-50 rounded-xl border border-gray-200 px-4 py-3 flex items-center justify-between mb-6">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                    <span className="text-sm text-gray-600">Microphone ready</span>
                  </div>
                  <button type="button" onClick={testMic} className="text-xs text-indigo-600 hover:text-indigo-700 underline">
                    Test mic
                  </button>
                </div>
              )}

              {micPreviewUrl && (
                <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 mb-4">
                  <div className="text-xs uppercase tracking-[0.22em] text-gray-500 mb-2">Preview playback</div>
                  <audio controls className="w-full" src={micPreviewUrl} />
                </div>
              )}

              <div>
                <button
                  type="button"
                  onClick={startMock}
                  disabled={loading || !allSelected}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm py-3.5 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <span className="inline-flex items-center justify-center gap-3">
                      <LoaderSpinner />
                      Starting session...
                    </span>
                  ) : (
                    <span>Start Session →</span>
                  )}
                </button>
              </div>

              {error && <p className="mt-3 text-center text-sm text-rose-500">{error}</p>}
            </div>
          </div>

          <aside className="lg:col-span-2 lg:sticky lg:top-8 space-y-4">
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
              <div className="flex items-center justify-between">
                <div className="text-lg font-semibold text-gray-900">What to expect.</div>
                <div className="text-xs font-medium text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full border border-indigo-100">{sessionMinutes} min</div>
              </div>

              <div className="mt-6 space-y-4">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-sm">🎯</div>
                  <div>
                    <div className="text-sm font-medium text-gray-900">Real-time coaching overlay</div>
                    <div className="text-xs text-gray-500 mt-0.5">Guided nudges while you speak</div>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-sm">✦</div>
                  <div>
                    <div className="text-sm font-medium text-gray-900">AI scoring on 3 dimensions</div>
                    <div className="text-xs text-gray-500 mt-0.5">Technical, communication, completeness</div>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-sm">📄</div>
                  <div>
                    <div className="text-sm font-medium text-gray-900">Full transcript + feedback</div>
                    <div className="text-xs text-gray-500 mt-0.5">Every answer captured with written review</div>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-sm">📈</div>
                  <div>
                    <div className="text-sm font-medium text-gray-900">Communication metrics</div>
                    <div className="text-xs text-gray-500 mt-0.5">WPM, filler words, silence gaps</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
              <div className="text-xs tracking-widest text-gray-400 font-medium">SAMPLE QUESTION</div>
              {roleTarget ? (
                <div className="mt-4 bg-gray-50 rounded-xl border border-gray-200 p-5">
                  <div className="inline-flex items-center bg-indigo-100 text-indigo-700 text-xs font-medium px-2.5 py-1 rounded-full mb-3">{selectedRole?.label}</div>
                  <div className="text-sm text-gray-800 leading-relaxed">{selectedRole?.focusArea === "system_design" ? "How would you design a rate limiter for an API that handles 10,000 RPS?" : selectedRole?.focusArea === "dsa" ? "Explain how you'd optimise a slow React render." : "Walk me through a recent architectural decision."}</div>
                  <div className="mt-4 pt-4 border-t border-gray-100 text-xs text-gray-400 flex justify-between">
                    <div>Topic: {selectedRole ? (selectedRole.focusArea === "dsa" ? "Performance" : selectedRole.focusArea === "system_design" ? "Architecture" : "Mixed") : "—"}</div>
                    <div>Difficulty: {seniority || "Intermediate"}</div>
                  </div>
                </div>
              ) : (
                <div className="mt-4 border-2 border-dashed border-gray-200 rounded-xl p-6 text-center">
                  <div className="text-sm text-gray-400">Select a role to preview a sample question</div>
                </div>
              )}
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 p-5">
              <div className="text-xs tracking-widest text-gray-400 font-medium">YOUR PROGRESS</div>
              <div className="mt-4 flex justify-between text-sm">
                <div className="text-gray-500">Last score</div>
                <div className="text-gray-900 font-medium">—</div>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
