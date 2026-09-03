// frontend/src/app/oa-practice/[company]/page.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { useAntiCheat } from "@/hooks/useAntiCheat";

const API_BASE = (
  process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:8000"
).replace(/\/$/, "");

// ─── Types ────────────────────────────────────────────────────────────────────

type Question = {
  id: number;
  question_text: string;
  options: string[];
  section: string;
  topic: string;
  time_limit_sec: number;
};

type SectionConfig = {
  key: string;
  label: string;
  questions: number;
  time_min: number;
};

type OAData = {
  attempt_id: number;
  company: string;
  track: string;
  config: any;
  questions: Record<string, Question[]>;
  section_order: string[];
  section_configs: SectionConfig[];
};

type Answer = {
  question_id: number;
  selected_option: number | null;
  time_sec: number;
  section: string;
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function OATestPage() {
  const { company } = useParams() as { company: string };
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  // Phase: intro | test | submitting | results_redirect
  const [phase, setPhase] = useState<"intro" | "loading" | "test" | "submitting">("intro");

  // OA data
  const [oaData, setOaData] = useState<OAData | null>(null);
  const oaDataRef = useRef<OAData | null>(null);
  const [showFullscreenPrompt, setShowFullscreenPrompt] = useState(false);
  const exitedFullscreenOnce = useRef(false);
  const [config, setConfig] = useState<any>(null);

  // Test state
  const [currentSectionIdx, setCurrentSectionIdx] = useState(0);
  const [currentQIdx, setCurrentQIdx] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [sectionLocked, setSectionLocked] = useState(false);

  const { addFlag, flags } = useAntiCheat({
    blockPaste: false,
    blockCopy: false,
    blockContextMenu: false,
    detectDevTools: false,
  });

  // Fullscreen-specific proctoring — separate from the generic anti-cheat
  // toast system, since exiting fullscreen during a locked OA test needs
  // to pause everything immediately, not just log a flag.
  useEffect(() => {
    const onFsChange = () => {
      const isFullscreen = !!document.fullscreenElement;
      if (isFullscreen || phase !== "test") return; // only care about exits during the actual test

      if (!exitedFullscreenOnce.current) {
        // First exit — pause the test, show the re-entry prompt
        exitedFullscreenOnce.current = true;
        if (sectionTimerRef.current) clearInterval(sectionTimerRef.current);
        if (totalTimerRef.current) clearInterval(totalTimerRef.current);
        setShowFullscreenPrompt(true);
      } else {
        // Second exit — end the test immediately
        if (oaDataRef.current) {
          handleSubmit(oaDataRef.current, "proctoring_violation");
        }
      }
    };
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, [phase]);

  const handleReEnterFullscreen = async () => {
    try {
      await document.documentElement.requestFullscreen();
      setShowFullscreenPrompt(false);
      // Resume timers from wherever they left off
      startSectionTimer(sectionTimeLeft, oaData!);
      startTotalTimer(totalTimeLeft, oaData!);
    } catch {
      // Browser denied re-entry (e.g. requires direct user gesture) —
      // keep the prompt open so they can try the button again
    }
  };
  const [lastFlag, setLastFlag] = useState("");
  const [showFlagWarning, setShowFlagWarning] = useState(false);

  // Timers
  const [sectionTimeLeft, setSectionTimeLeft] = useState(0);
  const [totalTimeLeft, setTotalTimeLeft] = useState(0);
  const [questionStartTime, setQuestionStartTime] = useState(Date.now());
  const sectionTimerRef = useRef<NodeJS.Timeout | null>(null);
  const totalTimerRef = useRef<NodeJS.Timeout | null>(null);
  const testStartTime = useRef<number>(Date.now());

  useEffect(() => {
    return () => {
      if (sectionTimerRef.current) clearInterval(sectionTimerRef.current);
      if (totalTimerRef.current) clearInterval(totalTimerRef.current);
    };
  }, []);

  // Redirect if not logged in
  useEffect(() => {
    if (!authLoading && !user) {
      router.replace(`/login?next=/oa-practice/${company}`);
    }
  }, [user, authLoading, company, router]);

  // Load config on mount
  useEffect(() => {
    if (!company) return;
    fetch(`${API_BASE}/api/oa/config/${company}`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d) setConfig(d); })
      .catch(() => { });
  }, [company]);

  // ── Helpers ───────────────────────────────────────────────────────────────

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60).toString().padStart(2, "0");
    const s = (sec % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  const authHeader = () => {
    const token = localStorage.getItem("API_TOKEN") || localStorage.getItem("access_token") || "";
    return { Authorization: `Bearer ${token}` };
  };

  // ── Start test ────────────────────────────────────────────────────────────

  const startTest = async () => {
    setPhase("loading");
    try {
      const res = await fetch(`${API_BASE}/api/oa/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader() },
        body: JSON.stringify({ company, track: "foundation" }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        if (res.status === 403) {
          // Plan gate — redirect to pricing
          router.push("/pricing?upgrade=oa");
          return;
        }
        throw new Error(err.detail || "Failed to start");
      }
      const data = await res.json();
      setOaData(data);
      oaDataRef.current = data;

      // Start timers
      const totalSec = (data.config?.total_time_min || 30) * 60;
      setTotalTimeLeft(totalSec);
      testStartTime.current = Date.now();

      const firstSection = data.section_configs?.[0];
      const firstSec = (firstSection?.time_min || 10) * 60;
      setSectionTimeLeft(firstSec);

      setPhase("test");
      try {
        await document.documentElement.requestFullscreen();
      } catch { /* graceful if denied */ }
      startSectionTimer(firstSec, data);
      startTotalTimer(totalSec, data);
    } catch (e) {
      alert("Failed to start OA. Please try again.");
      setPhase("intro");
    }
  };

  // ── Timers ────────────────────────────────────────────────────────────────

  const startSectionTimer = (seconds: number, data: OAData) => {
    if (sectionTimerRef.current) clearInterval(sectionTimerRef.current);
    sectionTimerRef.current = setInterval(() => {
      setSectionTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(sectionTimerRef.current!);
          // Section time expired — lock and advance
          setSectionLocked(true);
          setTimeout(() => advanceSection(data), 1500);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const startTotalTimer = (seconds: number, data: OAData) => {
    if (totalTimerRef.current) clearInterval(totalTimerRef.current);
    totalTimerRef.current = setInterval(() => {
      setTotalTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(totalTimerRef.current!);
          // Total time expired — auto submit
          handleSubmit(data);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  // ── Navigation ────────────────────────────────────────────────────────────

  const currentSection = oaData?.section_order[currentSectionIdx] ?? "";
  const currentQuestions = (oaData?.questions[currentSection] ?? []) as Question[];
  const currentQuestion = currentQuestions[currentQIdx] ?? null;
  const currentSectionConfig = oaData?.section_configs[currentSectionIdx];

  useEffect(() => {
    setQuestionStartTime(Date.now());
    setSelectedOption(null);
    setSectionLocked(false);
  }, [currentQIdx, currentSectionIdx]);

  useEffect(() => {
    if (flags.length === 0) return;
    const latest = flags[flags.length - 1];
    const messages: Record<string, string> = {
      "tab-switch": "Tab switch detected. In the real TCS NQT, switching tabs ends your test immediately.",
      "window-blur": "You left this window. Real OA tests track and flag this behavior.",
      "paste": "Paste detected. Practice properly — the real exam has no internet access.",
      "fullscreen-exit": "You exited fullscreen. The real OA runs in locked fullscreen mode.",
    };
    setLastFlag(messages[latest] || `Flagged: ${latest}`);
    setShowFlagWarning(true);
    setTimeout(() => setShowFlagWarning(false), 4000);
  }, [flags.length]);

  const saveAnswer = (goToNext: boolean) => {
    if (!currentQuestion) return;
    const elapsed = Math.round((Date.now() - questionStartTime) / 1000);

    setAnswers((prev) => {
      const existing = prev.findIndex((a) => a.question_id === currentQuestion.id);
      const newAnswer: Answer = {
        question_id: currentQuestion.id,
        selected_option: selectedOption,
        time_sec: elapsed,
        section: currentSection,
      };
      if (existing >= 0) {
        const updated = [...prev];
        updated[existing] = newAnswer;
        return updated;
      }
      return [...prev, newAnswer];
    });

    if (goToNext) {
      if (currentQIdx < currentQuestions.length - 1) {
        setCurrentQIdx((i) => i + 1);
      } else {
        advanceSection(oaData!);
      }
    }
  };

  const advanceSection = (data: OAData) => {
    if (sectionTimerRef.current) clearInterval(sectionTimerRef.current);
    const nextIdx = currentSectionIdx + 1;

    if (nextIdx >= (data.section_order?.length ?? 0)) {
      handleSubmit(data);
      return;
    }

    setCurrentSectionIdx(nextIdx);
    setCurrentQIdx(0);
    setSelectedOption(null);
    setSectionLocked(false);

    const nextSectionConfig = data.section_configs?.[nextIdx];
    const nextSec = (nextSectionConfig?.time_min || 10) * 60;
    setSectionTimeLeft(nextSec);
    startSectionTimer(nextSec, data);
  };

  // ── Submit ────────────────────────────────────────────────────────────────

  const handleSubmit = async (data: OAData, endReason?: string) => {
    if (sectionTimerRef.current) clearInterval(sectionTimerRef.current);
    if (totalTimerRef.current) clearInterval(totalTimerRef.current);
    setPhase("submitting");
    const timeTaken = Math.round((Date.now() - testStartTime.current) / 1000);
    try {
      const res = await fetch(`${API_BASE}/api/oa/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader() },
        body: JSON.stringify({
          attempt_id: data.attempt_id,
          answers: answers,
          time_taken_sec: timeTaken,
          ended_early_reason: endReason ?? null,
        }),
      });
      const result = await res.json();
      router.push(`/oa-practice/results/${data.attempt_id}`);
    } catch {
      alert("Submission failed. Please try again.");
      setPhase("test");
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  if (authLoading) return null;

  // ── Intro ─────────────────────────────────────────────────────────────────
  if (phase === "intro" || phase === "loading") {
    const companyName = config?.name || company?.toUpperCase();
    const sections = config?.sections?.foundation || [];
    const rules = config?.rules || [];

    return (
      <main className="min-h-screen pt-24 pb-16 px-4" style={{ background: "#FAFAF8" }}>
        <div className="mx-auto max-w-[640px]">

          <Link href="/oa-practice" className="inline-flex items-center gap-1 text-[12px] font-medium text-[#9CA3AF] hover:text-[#111] transition mb-6">
            ← All OA tests
          </Link>

          <div className="rounded-3xl border border-[#E5E7EB] bg-white overflow-hidden"
            style={{ boxShadow: "0 4px 40px rgba(0,0,0,0.06)" }}>

            <div className="px-8 py-8 text-center"
              style={{ background: "linear-gradient(135deg, #111 0%, #1a1a1a 100%)" }}>
              <div className="text-[48px] mb-3">📝</div>
              <h1 className="text-[24px] font-black text-white mb-1">{companyName}</h1>
              <p className="text-[13px] text-[#555]">{config?.full_name}</p>
            </div>

            {/* Section breakdown */}
            {sections.length > 0 && (
              <div className="divide-y divide-[#F3F4F6]">
                {sections.map((s: SectionConfig, i: number) => (
                  <div key={i} className="flex items-center justify-between px-6 py-4">
                    <div>
                      <p className="text-[13px] font-bold text-[#111]">{s.label}</p>
                      <p className="text-[11px] text-[#9CA3AF]">{s.questions} questions</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[13px] font-bold text-[#111]">{s.time_min} min</p>
                      <p className="text-[11px] text-[#9CA3AF]">locked timer</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Rules */}
            {rules.length > 0 && (
              <div className="px-6 py-5 border-t border-[#F3F4F6] bg-[#FAFAF8]">
                <p className="text-[11px] font-black uppercase tracking-widest text-[#9CA3AF] mb-3">
                  Rules — read before starting
                </p>
                <ul className="space-y-2">
                  {rules.map((rule: string, i: number) => (
                    <li key={i} className="flex items-start gap-2 text-[12px] text-[#374151]">
                      <span className="text-red-500 mt-0.5 flex-shrink-0">⚠</span>
                      {rule}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="px-6 pb-6 pt-4">
              <button
                onClick={startTest}
                disabled={phase === "loading"}
                className="w-full rounded-xl bg-[#111] py-3.5 text-[14px] font-black text-white hover:bg-[#333] transition disabled:opacity-50"
              >
                {phase === "loading" ? "Loading questions..." : `Start ${companyName} practice →`}
              </button>
              <p className="text-center text-[11px] text-[#9CA3AF] mt-3">
                Once you start, you cannot pause or go back to previous questions.
              </p>
            </div>
          </div>
        </div>
      </main>
    );
  }

  // ── Submitting ────────────────────────────────────────────────────────────
  if (phase === "submitting") {
    return (
      <main className="min-h-screen flex items-center justify-center" style={{ background: "#FAFAF8" }}>
        <div className="text-center">
          <div className="text-[48px] mb-4">📊</div>
          <h2 className="text-[20px] font-black text-[#111] mb-2">Submitting your answers...</h2>
          <p className="text-[14px] text-[#9CA3AF]">Calculating your band prediction</p>
        </div>
      </main>
    );
  }

  // ── Test ──────────────────────────────────────────────────────────────────
  if (phase === "test" && oaData) {
    const totalSections = oaData.section_order.length;
    const answeredInSection = answers.filter((a) => a.section === currentSection).length;
    const sectionProgress = currentQuestions.length > 0
      ? ((currentQIdx) / currentQuestions.length) * 100
      : 0;

    const sectionTimePercent = currentSectionConfig
      ? (sectionTimeLeft / (currentSectionConfig.time_min * 60)) * 100
      : 100;

    const isTimeLow = sectionTimeLeft < 60;

    return (
      <main className="min-h-screen pt-16 pb-8 px-4" style={{ background: "#FAFAF8" }}>
        <div className="mx-auto max-w-[680px]">

          {showFlagWarning && (
            <div className="fixed top-20 left-1/2 z-50 -translate-x-1/2 w-[90vw] max-w-[520px]">
              <div
                className="rounded-2xl px-5 py-4 flex items-start gap-3"
                style={{
                  background: flags.length >= 3 ? "#7F1D1D" : "#111",
                  border: flags.length >= 3 ? "1.5px solid #EF4444" : "1.5px solid #333",
                  boxShadow: "0 8px 32px rgba(0,0,0,0.4)"
                }}
              >
                <span className="text-[20px]">{flags.length >= 3 ? "🚨" : "⚠️"}</span>
                <div className="flex-1">
                  <p className="text-[13px] font-bold text-white leading-relaxed">{lastFlag}</p>
                  <p className="text-[11px] mt-1" style={{ color: "rgba(255,255,255,0.4)" }}>
                    {flags.length} violation{flags.length !== 1 ? "s" : ""} recorded · In the real exam this would disqualify you
                  </p>
                </div>
                <button onClick={() => setShowFlagWarning(false)} style={{ color: "rgba(255,255,255,0.4)", fontSize: 18 }}>×</button>
              </div>
            </div>
          )}

          {/* Fullscreen proctoring modal — blocks everything until re-entry, no dismiss button */}
          {showFullscreenPrompt && (
            <div
              className="fixed inset-0 z-[100] flex items-center justify-center p-4"
              style={{ background: "rgba(0,0,0,0.85)", backdropFilter: "blur(4px)" }}
            >
              <div
                className="w-full max-w-[440px] rounded-2xl p-7 text-center"
                style={{ background: "#111", border: "1.5px solid #EF4444" }}
              >
                <div className="text-[40px] mb-3">⏸️</div>
                <p className="text-[16px] font-black text-white mb-2">Your test is paused</p>
                <p className="text-[13px] leading-relaxed mb-6" style={{ color: "rgba(255,255,255,0.6)" }}>
                  You exited fullscreen. Real OA proctoring does not allow this — you get one chance to return.
                  If you exit fullscreen again, your test will end immediately and be submitted as-is.
                </p>
                <button
                  onClick={handleReEnterFullscreen}
                  className="w-full rounded-xl bg-white py-3 text-[14px] font-black text-[#111] hover:bg-gray-100 transition"
                >
                  Re-enter fullscreen and continue
                </button>
              </div>
            </div>
          )}

          {/* Top bar */}
          <div className="mb-4 flex items-center justify-between gap-4">
            <div>
              <p className="text-[11px] font-black uppercase tracking-widest text-[#9CA3AF]">
                {currentSectionConfig?.label}
              </p>
              <p className="text-[12px] text-[#374151]">
                Q{currentQIdx + 1} of {currentQuestions.length}
              </p>
            </div>

            {/* Section timer */}
            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="text-[10px] text-[#9CA3AF] uppercase tracking-widest">Section</p>
                <p
                  className="text-[18px] font-black font-mono"
                  style={{ color: isTimeLow ? "#EF4444" : "#111" }}
                >
                  {formatTime(sectionTimeLeft)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[10px] text-[#9CA3AF] uppercase tracking-widest">Total</p>
                <p className="text-[18px] font-black font-mono text-[#9CA3AF]">
                  {formatTime(totalTimeLeft)}
                </p>
              </div>
            </div>
          </div>

          {/* Section progress bar */}
          <div className="mb-4">
            <div className="h-1 rounded-full bg-[#E5E7EB] overflow-hidden mb-1.5">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${sectionTimePercent}%`,
                  background: isTimeLow ? "#EF4444" : "#111",
                }}
              />
            </div>
            <div className="flex gap-1">
              {oaData.section_order.map((s, i) => (
                <div
                  key={s}
                  className="flex-1 h-1 rounded-full"
                  style={{
                    background: i < currentSectionIdx ? "#111"
                      : i === currentSectionIdx ? "#FFD600"
                        : "#E5E7EB",
                  }}
                />
              ))}
            </div>
          </div>

          {/* Section locked overlay */}
          {sectionLocked && (
            <div className="mb-4 rounded-xl bg-[#111] px-5 py-3 text-center">
              <p className="text-[13px] font-black text-white">
                Section time expired — moving to next section
              </p>
            </div>
          )}

          {/* Question card */}
          {currentQuestion && !sectionLocked && (
            <div className="rounded-3xl border border-[#E5E7EB] bg-white p-7"
              style={{ boxShadow: "0 4px 40px rgba(0,0,0,0.05)" }}>

              <div className="flex items-center justify-between mb-5">
                <span className="text-[11px] font-bold text-[#9CA3AF] uppercase tracking-widest">
                  {currentQuestion.topic?.replace(/_/g, " ")}
                </span>
                <span className="text-[11px] text-[#9CA3AF]">
                  {answeredInSection} answered
                </span>
              </div>

              <p className="text-[16px] font-medium text-[#111] leading-relaxed mb-7 whitespace-pre-line">
                {currentQuestion.question_text}
              </p>

              <div className="space-y-3 mb-7">
                {currentQuestion.options.map((opt, idx) => (
                  <button
                    key={idx}
                    onClick={() => setSelectedOption(idx)}
                    className="w-full text-left rounded-xl border px-4 py-3.5 text-[14px] transition"
                    style={{
                      borderColor: selectedOption === idx ? "#111" : "#E5E7EB",
                      background: selectedOption === idx ? "#111" : "white",
                      color: selectedOption === idx ? "white" : "#374151",
                      fontWeight: selectedOption === idx ? 600 : 400,
                    }}
                  >
                    <span className="font-bold mr-2">{["A", "B", "C", "D"][idx]}.</span>
                    {opt}
                  </button>
                ))}
              </div>

              <div className="flex items-center justify-between gap-3">
                {/* Cannot go back — intentional */}
                <p className="text-[11px] text-[#9CA3AF]">
                  ⚠ Cannot go back to previous questions
                </p>
                <button
                  onClick={() => { saveAnswer(true); }}
                  className="rounded-xl px-6 py-2.5 text-[13px] font-black transition"
                  style={{
                    background: "#111",
                    color: "white",
                    cursor: "pointer",
                  }}
                >
                  {currentQIdx < currentQuestions.length - 1
                    ? "Next →"
                    : currentSectionIdx < totalSections - 1
                      ? "Next section →"
                      : "Submit test →"}
                </button>
              </div>

              {selectedOption === null && (
                <p className="text-center text-[11px] text-[#9CA3AF] mt-3">
                  No answer selected — you can still proceed (will be marked 0)
                </p>
              )}
            </div>
          )}

        </div>
      </main>
    );
  }

  return null;
}