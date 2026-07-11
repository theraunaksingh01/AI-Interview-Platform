// frontend/src/app/assessment/page.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

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
};

type Questions = {
  aptitude: Question[];
  cs_fundamentals: Question[];
  programming_dsa: Question[];
};

type Answer = {
  question_id: number;
  selected_option: number | null;
  time_sec: number;
};

type SelfAssessment = {
  dbms_confidence: string;
  dsa_solved: string;
  has_project: string;
  mock_done: string;
};

// ─── Section metadata ─────────────────────────────────────────────────────────

const SECTIONS = [
  {
    key: "aptitude",
    label: "Aptitude",
    icon: "🧮",
    description: "Basic quantitative and logical reasoning",
    time: 12,
  },
  {
    key: "cs_fundamentals",
    label: "CS Fundamentals",
    icon: "💻",
    description: "DBMS, OS, OOP, and Computer Networks",
    time: 10,
  },
  {
    key: "programming_dsa",
    label: "Programming & DSA",
    icon: "⚡",
    description: "Code output and algorithm approach",
    time: 10,
  },
  {
    key: "communication",
    label: "Communication",
    icon: "🎙️",
    description: "60-second spoken self-introduction",
    time: 2,
  },
  {
    key: "profile",
    label: "Profile Setup",
    icon: "📋",
    description: "Tell us about your placement timeline",
    time: 2,
  },
] as const;

type SectionKey = (typeof SECTIONS)[number]["key"];

const SECTION_ORDER: SectionKey[] = [
  "aptitude",
  "cs_fundamentals",
  "programming_dsa",
  "communication",
  "profile",
];

const TARGET_COMPANIES = [
  "TCS", "Infosys", "Wipro", "Cognizant", "Accenture",
  "Capgemini", "Amazon", "Microsoft", "HCL", "Tech Mahindra",
];

// ─── Component ────────────────────────────────────────────────────────────────

export default function AssessmentPage() {
  const router = useRouter();

  // Flow state
  const [phase, setPhase] = useState<"intro" | "test" | "submitting" | "login_wall">("intro");
  const [currentSection, setCurrentSection] = useState<SectionKey>("aptitude");
  const [currentQIndex, setCurrentQIndex] = useState(0);

  // Data
  const [attemptId, setAttemptId] = useState<number | null>(null);
  const [guestToken, setGuestToken] = useState<string | null>(null);
  const [questions, setQuestions] = useState<Questions | null>(null);
  const [answers, setAnswers] = useState<Record<number, Answer>>({});
  const [selectedOption, setSelectedOption] = useState<number | null>(null);

  // Timer
  const [timeLeft, setTimeLeft] = useState(0);
  const [questionStartTime, setQuestionStartTime] = useState(Date.now());
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Voice section
  const [recording, setRecording] = useState(false);
  const [voiceTranscript, setVoiceTranscript] = useState("");
  const [voiceDuration, setVoiceDuration] = useState(0);
  const [voiceDone, setVoiceDone] = useState(false);
  const recognitionRef = useRef<any>(null);
  const voiceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Profile section
  const [selfAssessment, setSelfAssessment] = useState<SelfAssessment>({
    dbms_confidence: "",
    dsa_solved: "",
    has_project: "",
    mock_done: "",
  });
  const [targetCompanies, setTargetCompanies] = useState<string[]>([]);
  const [placementMonths, setPlacementMonths] = useState<string>("");

  // Preview from submit
  const [preview, setPreview] = useState<any>(null);

  // ── Start assessment ──────────────────────────────────────────────────────

  const startAssessment = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/assessment/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();
      setAttemptId(data.attempt_id);
      setGuestToken(data.guest_token);
      setQuestions(data.questions);

      // Persist in localStorage so we can claim after login
      localStorage.setItem("qued_assessment_attempt_id", String(data.attempt_id));
      localStorage.setItem("qued_assessment_guest_token", data.guest_token);
      sessionStorage.setItem("qued_assessment_attempt_id", String(data.attempt_id));
      sessionStorage.setItem("qued_assessment_guest_token", data.guest_token);

      setPhase("test");
      setCurrentSection("aptitude");
      setCurrentQIndex(0);
      startSectionTimer("aptitude");
    } catch {
      alert("Failed to start assessment. Please try again.");
    }
  };

  // ── Timer ─────────────────────────────────────────────────────────────────

  const startSectionTimer = (section: SectionKey) => {
    const meta = SECTIONS.find((s) => s.key === section);
    if (!meta) return;
    const seconds = meta.time * 60;
    setTimeLeft(seconds);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          advanceSection();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60).toString().padStart(2, "0");
    const s = (sec % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  useEffect(() => {
    setQuestionStartTime(Date.now());
    setSelectedOption(null);
  }, [currentQIndex, currentSection]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (voiceTimerRef.current) clearInterval(voiceTimerRef.current);
    };
  }, []);

  // ── MCQ navigation ────────────────────────────────────────────────────────

  const currentQuestions =
    questions && currentSection !== "communication" && currentSection !== "profile"
      ? (questions as any)[currentSection] as Question[]
      : [];

  const currentQuestion = currentQuestions[currentQIndex] ?? null;

  const selectOption = (idx: number) => {
    setSelectedOption(idx);
  };

  const saveAndNext = () => {
    if (!currentQuestion) return;
    const elapsed = Math.round((Date.now() - questionStartTime) / 1000);
    setAnswers((prev) => ({
      ...prev,
      [currentQuestion.id]: {
        question_id: currentQuestion.id,
        selected_option: selectedOption,
        time_sec: elapsed,
      },
    }));

    if (currentQIndex < currentQuestions.length - 1) {
      setCurrentQIndex((i) => i + 1);
    } else {
      advanceSection();
    }
  };

  const advanceSection = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    const idx = SECTION_ORDER.indexOf(currentSection);
    if (idx < SECTION_ORDER.length - 1) {
      const next = SECTION_ORDER[idx + 1];
      setCurrentSection(next);
      setCurrentQIndex(0);
      setSelectedOption(null);
      startSectionTimer(next);
    }
  };

  // ── Voice recording ───────────────────────────────────────────────────────

  const startVoiceRecording = () => {
    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Voice recording not supported in this browser. Use Chrome.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = "en-IN";
    recognitionRef.current = recognition;

    let transcript = "";
    recognition.onresult = (event: any) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript + " ";
      }
      setVoiceTranscript(transcript.trim());
    };

    recognition.start();
    setRecording(true);
    setVoiceDuration(0);

    // 60-second auto stop
    let elapsed = 0;
    voiceTimerRef.current = setInterval(() => {
      elapsed += 1;
      setVoiceDuration(elapsed);
      if (elapsed >= 60) {
        stopVoiceRecording();
      }
    }, 1000);
  };

  const stopVoiceRecording = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    if (voiceTimerRef.current) {
      clearInterval(voiceTimerRef.current);
    }
    setRecording(false);
    setVoiceDone(true);
  };

  // ── Profile section ───────────────────────────────────────────────────────

  const toggleCompany = (company: string) => {
    setTargetCompanies((prev) =>
      prev.includes(company)
        ? prev.filter((c) => c !== company)
        : [...prev, company]
    );
  };

  // ── Submit ────────────────────────────────────────────────────────────────

  const submitAssessment = async () => {
    if (!attemptId || !guestToken) return;
    setPhase("submitting");
    if (timerRef.current) clearInterval(timerRef.current);

    try {
      const res = await fetch(`${API_BASE}/api/assessment/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          attempt_id: attemptId,
          guest_token: guestToken,
          answers: Object.values(answers),
          voice_transcript: voiceTranscript || null,
          voice_duration_sec: voiceDuration || null,
          self_assessment: selfAssessment,
          target_companies: targetCompanies,
          placement_months_away: placementMonths ? parseInt(placementMonths) : null,
        }),
      });

      const data = await res.json();
      setPreview(data.preview);
      setPhase("login_wall");
    } catch {
      alert("Submission failed. Please try again.");
      setPhase("test");
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  if (phase === "intro") {
    return (
      <main className="min-h-screen pt-24 pb-16 px-4" style={{ background: "#FAFAF8" }}>
        <div className="mx-auto max-w-[680px]">

          <div className="rounded-3xl border border-[#E5E7EB] bg-white overflow-hidden"
            style={{ boxShadow: "0 4px 40px rgba(0,0,0,0.06)" }}>

            <div className="px-8 py-10 text-center"
              style={{ background: "linear-gradient(135deg, #FFFDF0 0%, #FFF9D6 100%)" }}>
              <span className="text-[48px] block mb-4">📊</span>
              <h1 className="text-[28px] font-black text-[#111] mb-2" style={{ letterSpacing: "-1px" }}>
                Placement Readiness Assessment
              </h1>
              <p className="text-[15px] text-[#6B7280] max-w-md mx-auto leading-relaxed">
                A free 30-minute diagnostic. Find out exactly where you stand
                and what to do next before your placement season starts.
              </p>
            </div>

            <div className="px-8 py-6 border-t border-[#F3F4F6]">
              <div className="grid grid-cols-1 gap-3">
                {SECTIONS.map((s) => (
                  <div key={s.key}
                    className="flex items-center gap-4 rounded-xl bg-[#F9FAFB] border border-[#F3F4F6] px-4 py-3">
                    <span className="text-[24px] w-8 text-center">{s.icon}</span>
                    <div className="flex-1">
                      <p className="text-[14px] font-bold text-[#111]">{s.label}</p>
                      <p className="text-[12px] text-[#9CA3AF]">{s.description}</p>
                    </div>
                    <span className="text-[12px] font-medium text-[#9CA3AF] flex-shrink-0">
                      {s.time} min
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="px-8 py-6 border-t border-[#F3F4F6] space-y-3">
              <div className="flex flex-wrap gap-3 text-[12px] text-[#6B7280]">
                <span className="flex items-center gap-1">✓ Completely free</span>
                <span className="flex items-center gap-1">✓ No login needed to take the test</span>
                <span className="flex items-center gap-1">✓ Results in under 30 seconds</span>
              </div>
              <button
                onClick={startAssessment}
                className="w-full rounded-xl bg-[#111] py-3.5 text-[15px] font-black text-white hover:bg-[#333] transition"
              >
                Start assessment →
              </button>
              <p className="text-center text-[11px] text-[#9CA3AF]">
                You'll create a free account to view your results
              </p>
            </div>
          </div>
        </div>
      </main>
    );
  }

  if (phase === "submitting") {
    return (
      <main className="min-h-screen flex items-center justify-center" style={{ background: "#FAFAF8" }}>
        <div className="text-center">
          <div className="text-[48px] mb-4 animate-bounce">📊</div>
          <h2 className="text-[20px] font-black text-[#111] mb-2">Calculating your results...</h2>
          <p className="text-[14px] text-[#9CA3AF]">Scoring your answers and evaluating your communication</p>
        </div>
      </main>
    );
  }

  if (phase === "login_wall") {
    return (
      <main className="min-h-screen flex items-center justify-center px-4" style={{ background: "#FAFAF8" }}>
        <div className="w-full max-w-[480px]">
          <div className="rounded-3xl border border-[#E5E7EB] bg-white overflow-hidden"
            style={{ boxShadow: "0 4px 40px rgba(0,0,0,0.08)" }}>

            {/* Preview score — teaser */}
            {preview && (
              <div className="px-8 py-8 text-center"
                style={{ background: "linear-gradient(135deg, #111 0%, #1a1a1a 100%)" }}>
                <p className="text-[11px] font-black uppercase tracking-widest text-[#555] mb-2">
                  Your result is ready
                </p>
                <div className="text-[64px] font-black text-white leading-none mb-1">
                  {preview.total_score}%
                </div>
                <div className="inline-block rounded-full bg-yellow-400 px-3 py-1 text-[12px] font-black text-[#111] mb-3">
                  {preview.label}
                </div>
                <p className="text-[13px] text-[#555]">
                  Biggest gap:{" "}
                  <span className="text-white font-bold">
                    {preview.biggest_gap?.replace("_", " ")}
                  </span>
                </p>
              </div>
            )}

            <div className="px-8 py-8">
              <h2 className="text-[20px] font-black text-[#111] mb-2">
                Create a free account to see your full results
              </h2>
              <p className="text-[13px] text-[#6B7280] mb-6 leading-relaxed">
                Your detailed score breakdown, gap analysis, company match, and
                personalised prep recommendations are waiting.
              </p>

              <div className="space-y-3">
                <a href={`/signup?next=/assessment/results/${attemptId}`}>
                  <button className="w-full rounded-xl bg-[#111] py-3 text-[14px] font-black text-white hover:bg-[#333] transition">
                    Create free account →
                  </button>
                </a>
                <a href={`/login?next=/assessment/results/${attemptId}`}>
                  <button className="w-full rounded-xl border border-[#E5E7EB] bg-white py-3 text-[14px] font-semibold text-[#374151] hover:bg-[#F9FAFB] transition">
                    Already have an account? Log in
                  </button>
                </a>
              </div>

              <p className="mt-4 text-center text-[11px] text-[#9CA3AF]">
                Free forever. No credit card.
              </p>
            </div>
          </div>
        </div>
      </main>
    );
  }

  // ── TEST PHASE ────────────────────────────────────────────────────────────

  const sectionMeta = SECTIONS.find((s) => s.key === currentSection)!;
  const sectionIdx = SECTION_ORDER.indexOf(currentSection);
  const progress = ((sectionIdx) / SECTION_ORDER.length) * 100;

  return (
    <main className="min-h-screen pt-20 pb-16 px-4" style={{ background: "#FAFAF8" }}>
      <div className="mx-auto max-w-[680px]">

        {/* Progress bar */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[12px] font-bold text-[#111]">
              {sectionMeta.icon} {sectionMeta.label}
            </span>
            <span className="text-[12px] font-mono font-bold text-[#374151]">
              {formatTime(timeLeft)}
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-[#E5E7EB] overflow-hidden">
            <div
              className="h-full rounded-full bg-[#111] transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="flex gap-1.5 mt-2">
            {SECTION_ORDER.map((s, i) => (
              <div
                key={s}
                className="flex-1 h-1 rounded-full"
                style={{
                  background: i < sectionIdx ? "#111" : i === sectionIdx ? "#FFD600" : "#E5E7EB"
                }}
              />
            ))}
          </div>
        </div>

        {/* ── MCQ sections ── */}
        {(currentSection === "aptitude" ||
          currentSection === "cs_fundamentals" ||
          currentSection === "programming_dsa") &&
          currentQuestion && (
            <div className="rounded-3xl border border-[#E5E7EB] bg-white p-8"
              style={{ boxShadow: "0 4px 40px rgba(0,0,0,0.06)" }}>

              <div className="flex items-center justify-between mb-6">
                <span className="text-[12px] font-black uppercase tracking-widest text-[#9CA3AF]">
                  Question {currentQIndex + 1} of {currentQuestions.length}
                </span>
                <span className="rounded-full bg-[#F3F4F6] px-2.5 py-0.5 text-[11px] font-medium text-[#374151]">
                  {currentQuestion.topic?.replace(/_/g, " ")}
                </span>
              </div>

              <p className="text-[17px] font-medium text-[#111] leading-relaxed mb-8 whitespace-pre-line">
                {currentQuestion.question_text}
              </p>

              <div className="space-y-3 mb-8">
                {currentQuestion.options.map((opt, idx) => (
                  <button
                    key={idx}
                    onClick={() => selectOption(idx)}
                    className="w-full text-left rounded-xl border px-4 py-3.5 text-[14px] transition"
                    style={{
                      borderColor: selectedOption === idx ? "#111" : "#E5E7EB",
                      background: selectedOption === idx ? "#111" : "white",
                      color: selectedOption === idx ? "white" : "#374151",
                      fontWeight: selectedOption === idx ? 600 : 400,
                    }}
                  >
                    <span className="font-bold mr-2">
                      {["A", "B", "C", "D"][idx]}.
                    </span>
                    {opt}
                  </button>
                ))}
              </div>

              <button
                onClick={saveAndNext}
                className="w-full rounded-xl py-3 text-[14px] font-black transition"
                style={{
                  background: selectedOption !== null ? "#111" : "#F3F4F6",
                  color: selectedOption !== null ? "white" : "#9CA3AF",
                  cursor: selectedOption !== null ? "pointer" : "default",
                }}
              >
                {currentQIndex < currentQuestions.length - 1
                  ? "Next question →"
                  : "Continue to next section →"}
              </button>

              {selectedOption === null && (
                <p className="text-center text-[11px] text-[#9CA3AF] mt-2">
                  Select an answer to continue — you can skip if unsure
                </p>
              )}
              {selectedOption === null && (
                <button
                  onClick={saveAndNext}
                  className="w-full text-center text-[12px] text-[#9CA3AF] hover:text-[#374151] mt-1 transition"
                >
                  Skip this question
                </button>
              )}
            </div>
          )}

        {/* ── Communication section ── */}
        {currentSection === "communication" && (
          <div className="rounded-3xl border border-[#E5E7EB] bg-white p-8"
            style={{ boxShadow: "0 4px 40px rgba(0,0,0,0.06)" }}>

            <h2 className="text-[20px] font-black text-[#111] mb-2">
              Introduce yourself
            </h2>
            <p className="text-[14px] text-[#6B7280] mb-6 leading-relaxed">
              As you would in a placement interview. You have{" "}
              <span className="font-bold text-[#111]">60 seconds</span>. Speak
              clearly about who you are, your branch, your projects, and what
              you&apos;re looking for.
            </p>

            {!voiceDone ? (
              <div className="text-center">
                {!recording ? (
                  <button
                    onClick={startVoiceRecording}
                    className="inline-flex items-center gap-2 rounded-xl bg-[#111] px-8 py-4 text-[15px] font-black text-white hover:bg-[#333] transition"
                  >
                    🎙️ Start recording
                  </button>
                ) : (
                  <div>
                    <div className="inline-flex items-center gap-2 rounded-xl bg-red-500 px-8 py-4 text-[15px] font-black text-white mb-4">
                      <span className="animate-pulse">●</span> Recording — {voiceDuration}s / 60s
                    </div>
                    <div className="h-2 rounded-full bg-[#E5E7EB] overflow-hidden mb-4">
                      <div
                        className="h-full rounded-full bg-red-500 transition-all"
                        style={{ width: `${(voiceDuration / 60) * 100}%` }}
                      />
                    </div>
                    <button
                      onClick={stopVoiceRecording}
                      className="text-[13px] font-medium text-[#374151] hover:text-[#111] transition"
                    >
                      Stop recording early
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div>
                <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 mb-4">
                  <p className="text-[12px] font-black text-emerald-700 mb-1">
                    ✓ Recorded ({voiceDuration}s)
                  </p>
                  {voiceTranscript && (
                    <p className="text-[13px] text-[#374151] leading-relaxed line-clamp-3">
                      &ldquo;{voiceTranscript}&rdquo;
                    </p>
                  )}
                </div>
                <button
                  onClick={advanceSection}
                  className="w-full rounded-xl bg-[#111] py-3 text-[14px] font-black text-white hover:bg-[#333] transition"
                >
                  Continue to profile setup →
                </button>
              </div>
            )}

            {!recording && !voiceDone && (
              <button
                onClick={advanceSection}
                className="w-full text-center text-[12px] text-[#9CA3AF] hover:text-[#374151] mt-4 transition"
              >
                Skip voice section
              </button>
            )}
          </div>
        )}

        {/* ── Profile section ── */}
        {currentSection === "profile" && (
          <div className="rounded-3xl border border-[#E5E7EB] bg-white p-8"
            style={{ boxShadow: "0 4px 40px rgba(0,0,0,0.06)" }}>

            <h2 className="text-[20px] font-black text-[#111] mb-6">
              A few last questions
            </h2>

            <div className="space-y-6">

              {/* DSA solved */}
              <div>
                <p className="text-[13px] font-bold text-[#111] mb-2">
                  How many DSA problems have you solved?
                </p>
                <div className="flex flex-wrap gap-2">
                  {["0-20", "20-50", "50-100", "100+"].map((v) => (
                    <button
                      key={v}
                      onClick={() => setSelfAssessment((p) => ({ ...p, dsa_solved: v }))}
                      className="rounded-xl border px-4 py-2 text-[13px] font-medium transition"
                      style={{
                        background: selfAssessment.dsa_solved === v ? "#111" : "white",
                        color: selfAssessment.dsa_solved === v ? "white" : "#374151",
                        borderColor: selfAssessment.dsa_solved === v ? "#111" : "#E5E7EB",
                      }}
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </div>

              {/* Has project */}
              <div>
                <p className="text-[13px] font-bold text-[#111] mb-2">
                  Do you have a project you can explain for 2 minutes?
                </p>
                <div className="flex gap-2">
                  {["Yes", "No"].map((v) => (
                    <button
                      key={v}
                      onClick={() => setSelfAssessment((p) => ({ ...p, has_project: v }))}
                      className="rounded-xl border px-6 py-2 text-[13px] font-medium transition"
                      style={{
                        background: selfAssessment.has_project === v ? "#111" : "white",
                        color: selfAssessment.has_project === v ? "white" : "#374151",
                        borderColor: selfAssessment.has_project === v ? "#111" : "#E5E7EB",
                      }}
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </div>

              {/* Target companies */}
              <div>
                <p className="text-[13px] font-bold text-[#111] mb-2">
                  Which companies are you targeting?
                </p>
                <div className="flex flex-wrap gap-2">
                  {TARGET_COMPANIES.map((c) => (
                    <button
                      key={c}
                      onClick={() => toggleCompany(c)}
                      className="rounded-xl border px-3 py-1.5 text-[12px] font-medium transition"
                      style={{
                        background: targetCompanies.includes(c) ? "#111" : "white",
                        color: targetCompanies.includes(c) ? "white" : "#374151",
                        borderColor: targetCompanies.includes(c) ? "#111" : "#E5E7EB",
                      }}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>

              {/* Placement months */}
              <div>
                <p className="text-[13px] font-bold text-[#111] mb-2">
                  When does your placement season start?
                </p>
                <select
                  value={placementMonths}
                  onChange={(e) => setPlacementMonths(e.target.value)}
                  className="w-full rounded-xl border border-[#E5E7EB] px-4 py-2.5 text-[13px] text-[#374151] bg-white"
                >
                  <option value="">Select timeframe</option>
                  <option value="1">Less than 1 month</option>
                  <option value="2">1-3 months</option>
                  <option value="5">3-6 months</option>
                  <option value="8">6-12 months</option>
                  <option value="15">More than 12 months</option>
                </select>
              </div>

            </div>

            <button
              onClick={submitAssessment}
              className="w-full mt-8 rounded-xl bg-[#111] py-3.5 text-[15px] font-black text-white hover:bg-[#333] transition"
            >
              Submit and see my results →
            </button>
          </div>
        )}

      </div>
    </main>
  );
}