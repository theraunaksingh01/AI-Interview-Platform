"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/context/AuthContext";

const API_BASE = (
  process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:8000"
).replace(/\/$/, "");

// ─── Types ────────────────────────────────────────────────────────────────────

type Concept = {
  id: string;
  concept_name: string;
  topic: string;
  subtopic: string | null;
  ask_prompt: string;
  good_answer_summary: string;
  refresher_short: string;
  refresher_full: string;
  interview_edge_tip: string | null;
  rapid_fire_prompt: string | null;
  rapid_fire_answer: string | null;
  key_terms: string[];
  difficulty: string;
  phase: "warmup" | "targeted" | "rapid_fire";
};

type SessionData = {
  session_id: string;
  duration_minutes: number;
  total_concepts: number;
  concepts: Concept[];
};

type SummaryData = {
  concepts_covered: number;
  solid: number;
  revised: number;
  new: number;
  skipped: number;
  key_reminders: { concept_name: string; topic: string; refresher: string }[];
  closing_message: string;
  total_quick_prep_sessions: number;
};

type ViewState = "setup" | "permissions" | "active" | "summary" | "upgrade";

// ─── Constants ────────────────────────────────────────────────────────────────

const COMPANIES = [
  { key: "tcs", name: "TCS" },
  { key: "infosys", name: "Infosys" },
  { key: "wipro", name: "Wipro" },
  { key: "amazon", name: "Amazon" },
  { key: "microsoft", name: "Microsoft" },
  { key: "google", name: "Google" },
  { key: "general", name: "General prep" },
];

const DURATIONS = [
  { value: 10, label: "10 min", desc: "~13 concepts" },
  { value: 15, label: "15 min", desc: "~20 concepts" },
  { value: 20, label: "20 min", desc: "~27 concepts" },
];

const FOCUS_AREAS = [
  { value: "auto", label: "Auto", desc: "Based on your weak spots" },
  { value: "technical", label: "Technical", desc: "DBMS, OS, CN, OOP" },
  { value: "dsa_concepts", label: "DSA Theory", desc: "Concepts, not coding" },
  { value: "mixed", label: "Mixed", desc: "Everything" },
];

const TOPIC_META: Record<string, { icon: string; color: string; bg: string }> = {
  DBMS: { icon: "🗄️", color: "#5b21b6", bg: "#ede9fe" },
  OS: { icon: "⚙️", color: "#92400e", bg: "#fef3c7" },
  CN: { icon: "🌐", color: "#1e40af", bg: "#dbeafe" },
  OOP: { icon: "🧱", color: "#065f46", bg: "#d1fae5" },
  DSA: { icon: "💻", color: "#5b21b6", bg: "#ede9fe" },
  "System Design": { icon: "🏗️", color: "#92400e", bg: "#fef3c7" },
  Behavioral: { icon: "🎭", color: "#065f46", bg: "#d1fae5" },
};

function topicMeta(topic: string) {
  return TOPIC_META[topic] || { icon: "📝", color: "#374151", bg: "#f3f4f6" };
}

// ─── Setup screen — split layout on desktop ────────────────────────────────────

function SetupScreen({
  onStart,
  loading,
  error,
}: {
  onStart: (params: { company: string | null; duration: number; focus: string }) => void;
  loading: boolean;
  error: string | null;
}) {
  const [company, setCompany] = useState<string | null>(null);
  const [duration, setDuration] = useState(15);
  const [focus, setFocus] = useState("auto");

  const focusInfo = FOCUS_AREAS.find(f => f.value === focus);
  const durationInfo = DURATIONS.find(d => d.value === duration);

  return (
    <div className="grid min-h-[calc(100vh-72px)] grid-cols-1 lg:grid-cols-2">

      {/* LEFT: Form */}
      <div className="flex flex-col justify-center px-6 py-10 lg:px-14 lg:py-12 bg-[#FFFDF0] border-r border-[#F0F0EE]">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="max-w-[440px] mx-auto w-full">

          <div className="inline-flex items-center gap-2 rounded-full border border-[#E5E7EB] bg-white px-3 py-1.5 mb-5">
            <span className="h-1.5 w-1.5 rounded-full bg-yellow-400 animate-pulse" />
            <span className="text-[11px] font-black uppercase tracking-widest text-[#374151]">Quick Prep</span>
          </div>
          <h1 style={{ fontSize: "clamp(26px, 4vw, 38px)", fontWeight: 900, letterSpacing: "-1px", color: "#111", lineHeight: 1.15 }}
            className="mb-2">
            Revise fast,<br />
            <span style={{ background: "#FFD600", padding: "1px 10px", borderRadius: "6px", fontStyle: "italic" }}>
              walk in calm.
            </span>
          </h1>
          <p className="mb-8 text-[14px] text-[#6B7280] leading-relaxed">
            No scoring. No pressure. Just a quick check on what you remember before your interview.
          </p>

          <div className="mb-6">
            <p className="text-[11px] font-black uppercase tracking-widest text-[#9CA3AF] mb-3">
              Company <span className="text-[#D1D5DB]">(optional)</span>
            </p>
            <div className="flex flex-wrap gap-2">
              {COMPANIES.map(c => (
                <button key={c.key} onClick={() => setCompany(company === c.key ? null : c.key)}
                  className={`rounded-xl px-3 py-1.5 text-[12px] font-bold border transition-all ${
                    company === c.key
                      ? "border-[#111] bg-[#111] text-white"
                      : "border-[#E5E7EB] bg-white text-[#374151] hover:border-[#111]"
                  }`}>
                  {c.name}
                </button>
              ))}
            </div>
          </div>

          <div className="mb-6">
            <p className="text-[11px] font-black uppercase tracking-widest text-[#9CA3AF] mb-3">How much time do you have?</p>
            <div className="grid grid-cols-3 gap-2">
              {DURATIONS.map(d => (
                <button key={d.value} onClick={() => setDuration(d.value)}
                  className={`rounded-2xl border-2 px-3 py-3 text-center transition-all ${
                    duration === d.value
                      ? "border-[#111] bg-[#111]"
                      : "border-[#E5E7EB] bg-white hover:border-[#D1D5DB]"
                  }`}>
                  <p className={`text-[16px] font-black ${duration === d.value ? "text-white" : "text-[#111]"}`}>
                    {d.label}
                  </p>
                  <p className={`text-[10px] mt-0.5 ${duration === d.value ? "text-white/50" : "text-[#9CA3AF]"}`}>
                    {d.desc}
                  </p>
                </button>
              ))}
            </div>
          </div>

          <div className="mb-8">
            <p className="text-[11px] font-black uppercase tracking-widest text-[#9CA3AF] mb-3">Focus area</p>
            <div className="grid grid-cols-2 gap-2">
              {FOCUS_AREAS.map(f => (
                <button key={f.value} onClick={() => setFocus(f.value)}
                  className={`rounded-2xl border-2 px-3 py-3 text-left transition-all ${
                    focus === f.value
                      ? "border-[#111] bg-[#111]"
                      : "border-[#E5E7EB] bg-white hover:border-[#D1D5DB]"
                  }`}>
                  <p className={`text-[13px] font-black ${focus === f.value ? "text-white" : "text-[#111]"}`}>
                    {f.label}
                  </p>
                  <p className={`text-[10px] mt-0.5 ${focus === f.value ? "text-white/50" : "text-[#9CA3AF]"}`}>
                    {f.desc}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {error && (
            <div className="mb-4 rounded-xl border border-rose-100 bg-rose-50 px-4 py-3">
              <p className="text-[13px] text-rose-700">{error}</p>
            </div>
          )}

          <button
            onClick={() => onStart({ company, duration, focus })}
            disabled={loading}
            className="w-full rounded-2xl bg-[#111] py-4 text-[15px] font-black text-white hover:bg-[#333] transition disabled:opacity-50"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                Building your revision...
              </span>
            ) : "Start Quick Prep →"}
          </button>
          <p className="mt-3 text-center text-[11px] text-[#9CA3AF]">
            Works best with earphones in a quiet spot
          </p>
        </motion.div>
      </div>

      {/* RIGHT: Live preview (desktop only) */}
      <div className="hidden lg:flex flex-col bg-white overflow-y-auto">
        <AnimatePresence mode="wait">
          <motion.div key={`${company}-${duration}-${focus}`}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="h-full flex flex-col"
          >
            <div className="px-8 pt-10 pb-6 border-b border-[#F3F4F6]">
              <p className="text-[10px] font-black uppercase tracking-widest text-[#9CA3AF] mb-3">
                What this session looks like
              </p>

              <div className="flex items-center gap-4 mb-4">
                <div className="flex flex-col items-center justify-center h-16 w-16 rounded-2xl bg-[#111] text-white flex-shrink-0">
                  <p className="text-[20px] font-black leading-none">{durationInfo?.label.split(" ")[0]}</p>
                  <p className="text-[9px] text-[#9CA3AF] uppercase tracking-wide">min</p>
                </div>
                <div>
                  <p className="text-[16px] font-black text-[#111] leading-tight">
                    {durationInfo?.desc} · {focusInfo?.label}
                  </p>
                  <p className="text-[12px] text-[#6B7280] mt-1">
                    {company ? `Personalized for ${COMPANIES.find(c => c.key === company)?.name}` : "General revision — pick a company for tailored prep"}
                  </p>
                </div>
              </div>

              <div className="flex gap-2">
                <div className="flex-1 rounded-xl bg-[#FFFBEB] border border-yellow-200 px-3 py-2 text-center">
                  <p className="text-[10px] font-black text-[#92400E]">WARM-UP</p>
                  <p className="text-[11px] text-[#92400E]/70 mt-0.5">1 concept</p>
                </div>
                <div className="flex-1 rounded-xl bg-[#F0FDF4] border border-emerald-200 px-3 py-2 text-center">
                  <p className="text-[10px] font-black text-[#065F46]">REVISION</p>
                  <p className="text-[11px] text-[#065F46]/70 mt-0.5">most of it</p>
                </div>
                <div className="flex-1 rounded-xl bg-[#EFF6FF] border border-blue-200 px-3 py-2 text-center">
                  <p className="text-[10px] font-black text-[#1E40AF]">RAPID FIRE</p>
                  <p className="text-[11px] text-[#1E40AF]/70 mt-0.5">last stretch</p>
                </div>
              </div>
            </div>

            <div className="px-8 py-6 flex-1">
              <p className="text-[10px] font-black uppercase tracking-widest text-[#9CA3AF] mb-4">How it flows</p>
              <div className="space-y-3">
                {[
                  { icon: "🎙️", title: "AI asks a concept", sub: "Spoken aloud — \"Explain normalization in databases\"" },
                  { icon: "💬", title: "You explain it", sub: "Speak naturally, or type if you prefer" },
                  { icon: "✅", title: "Instant feedback", sub: "\"Solid — you covered 1NF to 3NF. Remember BCNF too.\"" },
                  { icon: "⚡", title: "Or skip ahead", sub: "\"I know this\" moves on instantly — no need to prove it" },
                ].map(({ icon, title, sub }) => (
                  <div key={title} className="flex items-start gap-3">
                    <span className="text-[18px] mt-0.5">{icon}</span>
                    <div>
                      <p className="text-[13px] font-bold text-[#111]">{title}</p>
                      <p className="text-[11px] text-[#9CA3AF] mt-0.5 leading-relaxed">{sub}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-6 rounded-2xl bg-[#111] p-4">
                <p className="text-[11px] font-black uppercase tracking-widest text-[#555] mb-2">At the end</p>
                <p className="text-[13px] text-white leading-relaxed">
                  &quot;You&apos;re solid on DBMS and OS. Brush up on TCP vs UDP — that&apos;s your one weak spot. You&apos;ve done several practice sessions. You&apos;re more prepared than you think.&quot;
                </p>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

// ─── Permissions screen ────────────────────────────────────────────────────────

function PermissionsScreen({ onGranted, onSkip }: { onGranted: () => void; onSkip: () => void }) {
  const [requesting, setRequesting] = useState(false);
  const [denied, setDenied] = useState(false);

  async function requestMic() {
    setRequesting(true);
    setDenied(false);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(t => t.stop());
      onGranted();
    } catch {
      setDenied(true);
    } finally {
      setRequesting(false);
    }
  }

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
      className="flex min-h-[calc(100vh-72px)] items-center justify-center">
      <div className="mx-auto max-w-[420px] px-5 text-center">
        <div className="text-[56px] mb-5">🎙️</div>
        <h2 className="text-[22px] font-black text-[#111] mb-2" style={{ letterSpacing: "-0.5px" }}>
          Allow microphone access
        </h2>
        <p className="text-[14px] text-[#6B7280] mb-8 leading-relaxed">
          Quick Prep is voice-first — you&apos;ll speak your answers and hear responses. We need mic access to listen.
        </p>

        {denied && (
          <div className="mb-4 rounded-xl border border-amber-100 bg-amber-50 px-4 py-3">
            <p className="text-[13px] text-amber-700">
              Mic access denied. You can still continue and type your answers instead.
            </p>
          </div>
        )}

        <button onClick={requestMic} disabled={requesting}
          className="w-full rounded-2xl bg-[#111] py-4 text-[15px] font-black text-white hover:bg-[#333] transition disabled:opacity-50 mb-3">
          {requesting ? "Requesting..." : "Allow microphone →"}
        </button>
        <button onClick={onSkip} className="text-[13px] text-[#9CA3AF] hover:text-[#111] transition">
          Continue without mic (type instead)
        </button>
      </div>
    </motion.div>
  );
}

// ─── Active session screen — mobile-first, split on desktop ───────────────────

function ActiveSession({
  session,
  authHeader,
  onFinish,
  micAllowed,
}: {
  session: SessionData;
  authHeader: () => Record<string, string>;
  onFinish: () => void;
  micAllowed: boolean;
}) {
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<"ask" | "listening" | "ai_response">("ask");
  const [transcript, setTranscript] = useState("");
  const [aiText, setAiText] = useState("");
  const [typedAnswer, setTypedAnswer] = useState("");
  const [elapsedSecs, setElapsedSecs] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  const recognitionRef = useRef<any>(null);
  const startTimeRef = useRef(Date.now());

  const concept = session.concepts[index];
  const isLast = index === session.concepts.length - 1;

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsedSecs(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const speak = useCallback((text: string) => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.05;
    utterance.pitch = 1.0;
    window.speechSynthesis.speak(utterance);
  }, []);

  useEffect(() => {
    setPhase("ask");
    setTranscript("");
    setAiText("");
    setTypedAnswer("");
    if (concept) {
      speak(concept.ask_prompt);
    }
    return () => {
      if (typeof window !== "undefined" && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, [index, concept, speak]);

  function startListening() {
    setPhase("listening");
    setTranscript("");

    if (!micAllowed) return;

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    recognitionRef.current = recognition;

    let finalText = "";
    recognition.onresult = (event: any) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript;
        if (event.results[i].isFinal) finalText += t + " ";
        else interim += t;
      }
      setTranscript((finalText + interim).trim());
    };
    recognition.onerror = () => {};
    recognition.start();
  }

  function stopListening() {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
  }

  async function submitExplanation() {
    stopListening();
    setSubmitting(true);
    const answerText = micAllowed ? transcript : typedAnswer;

    try {
      const res = await fetch(`${API_BASE}/api/quick-prep/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader() },
        body: JSON.stringify({
          session_id: session.session_id,
          concept_id: concept.id,
          mode: "explain",
          transcript: answerText,
        }),
      });
      const data = await res.json();

      setAiText(data.ai_text || "");
      speak(data.ai_text || "");
      setPhase("ai_response");

      const result = data.result || "revised";
      await fetch(`${API_BASE}/api/quick-prep/log-result`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader() },
        body: JSON.stringify({
          session_id: session.session_id,
          concept_id: concept.id,
          result,
          student_transcript: answerText,
        }),
      });

      const delay = data.ask_repeat ? 6000 : 3500;
      setTimeout(() => advance(), delay);

    } catch {
      advance();
    } finally {
      setSubmitting(false);
    }
  }

  async function markKnowThis() {
    await fetch(`${API_BASE}/api/quick-prep/log-result`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeader() },
      body: JSON.stringify({
        session_id: session.session_id,
        concept_id: concept.id,
        result: "solid",
        student_transcript: "",
      }),
    });
    advance();
  }

  async function skip() {
    await fetch(`${API_BASE}/api/quick-prep/log-result`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeader() },
      body: JSON.stringify({
        session_id: session.session_id,
        concept_id: concept.id,
        result: "skipped",
        student_transcript: "",
      }),
    });
    advance();
  }

  function advance() {
    stopListening();
    if (isLast) {
      onFinish();
    } else {
      setIndex(i => i + 1);
    }
  }

  const minutes = String(Math.floor(elapsedSecs / 60)).padStart(2, "0");
  const seconds = String(elapsedSecs % 60).padStart(2, "0");
  const meta = topicMeta(concept?.topic || "");

  return (
    <div className="flex flex-col min-h-[calc(100vh-72px)] bg-[#FAFAF8]">

      {/* Top bar */}
      <div className="flex items-center justify-between px-5 lg:px-8 py-3 border-b border-[#F0F0EE] bg-white">
        <div className="flex items-center gap-2">
          <span className="text-[12px] font-black text-[#111]">Quick Prep</span>
          <span className="rounded-full px-2 py-0.5 text-[10px] font-black" style={{ background: meta.bg, color: meta.color }}>
            {meta.icon} {concept?.topic}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[12px] font-mono text-[#9CA3AF]">{minutes}:{seconds}</span>
          <span className="text-[12px] font-black text-[#111]">{index + 1}/{session.concepts.length}</span>
        </div>
      </div>

      {/* Progress dots */}
      <div className="flex gap-1 px-5 lg:px-8 py-2">
        {session.concepts.map((_, i) => (
          <div key={i} className={`h-1.5 flex-1 rounded-full transition-colors ${
            i < index ? "bg-[#111]" : i === index ? "bg-yellow-400" : "bg-[#F3F4F6]"
          }`} />
        ))}
      </div>

      {/* Main content — split on desktop */}
      <div className="flex-1 flex flex-col lg:flex-row">

        {/* Center: question/interaction */}
        <div className="flex-1 flex flex-col items-center justify-center px-5 py-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={`${index}-${phase}`}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
              className="w-full max-w-[440px]"
            >
              {phase === "ask" && (
                <div className="text-center">
                  <p className="text-[11px] font-black uppercase tracking-widest text-[#9CA3AF] mb-4">
                    {concept.phase === "rapid_fire" ? "Rapid fire" : concept.phase === "warmup" ? "Warm-up" : "Concept check"}
                  </p>
                  <h2 className="text-[22px] font-black text-[#111] leading-snug mb-8" style={{ letterSpacing: "-0.5px" }}>
                    {concept.concept_name}
                  </h2>
                  <div className="rounded-2xl bg-white border border-[#E5E7EB] p-5 mb-8">
                    <p className="text-[15px] text-[#374151] leading-relaxed">{concept.ask_prompt}</p>
                  </div>

                  <div className="flex flex-col gap-2.5">
                    <button onClick={startListening}
                      className="w-full rounded-2xl bg-[#111] py-4 text-[14px] font-black text-white hover:bg-[#333] transition">
                      🎙️ Explain it
                    </button>
                    <button onClick={markKnowThis}
                      className="w-full rounded-2xl border-2 border-[#E5E7EB] bg-white py-3.5 text-[14px] font-bold text-[#374151] hover:border-[#111] transition">
                      ✓ I know this
                    </button>
                    <button onClick={skip}
                      className="text-[12px] text-[#9CA3AF] hover:text-[#111] transition py-1">
                      Skip →
                    </button>
                  </div>
                </div>
              )}

              {phase === "listening" && (
                <div className="text-center">
                  <p className="text-[11px] font-black uppercase tracking-widest text-[#9CA3AF] mb-4">
                    {concept.concept_name}
                  </p>
                  <div className="flex items-end justify-center gap-1 h-12 mb-6">
                    {Array.from({ length: 20 }).map((_, i) => (
                      <div key={i} className="w-1 bg-[#111] rounded-full"
                        style={{
                          height: `${20 + Math.random() * 80}%`,
                          animationName: "qpPulse",
                          animationDuration: `${0.5 + Math.random() * 0.6}s`,
                          animationTimingFunction: "ease-in-out",
                          animationIterationCount: "infinite",
                          animationDirection: "alternate",
                          animationDelay: `${i * 0.04}s`,
                        }} />
                    ))}
                  </div>
                  <style>{`
                    @keyframes qpPulse {
                      from { opacity: 0.3; }
                      to { opacity: 1; }
                    }
                  `}</style>

                  {micAllowed ? (
                    <div className="rounded-2xl bg-white border border-[#E5E7EB] p-4 mb-6 min-h-[80px] text-left">
                      <p className="text-[14px] text-[#374151] leading-relaxed">
                        {transcript || <span className="text-[#D1D5DB] italic">Start speaking...</span>}
                      </p>
                    </div>
                  ) : (
                    <textarea
                      value={typedAnswer}
                      onChange={e => setTypedAnswer(e.target.value)}
                      placeholder="Type your explanation..."
                      className="w-full rounded-2xl bg-white border border-[#E5E7EB] p-4 mb-6 min-h-[100px] text-[14px] text-[#374151] focus:border-[#111] focus:outline-none resize-none"
                    />
                  )}

                  <button onClick={submitExplanation} disabled={submitting}
                    className="w-full rounded-2xl bg-[#111] py-4 text-[14px] font-black text-white hover:bg-[#333] transition disabled:opacity-50">
                    {submitting ? "Checking..." : "Done →"}
                  </button>
                </div>
              )}

              {phase === "ai_response" && (
                <div className="text-center">
                  <div className="flex items-center justify-center gap-2 mb-4">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-yellow-400 text-[13px] font-black text-[#111]">
                      AI
                    </div>
                    <p className="text-[11px] font-black uppercase tracking-widest text-[#9CA3AF]">Study Partner</p>
                  </div>
                  <div className="rounded-2xl bg-white border border-[#E5E7EB] p-5 mb-4">
                    <p className="text-[15px] text-[#374151] leading-relaxed">{aiText}</p>
                  </div>
                  <p className="text-[12px] text-[#D1D5DB]">Moving on...</p>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Right: concept queue (desktop only) */}
        <div className="hidden lg:flex lg:w-80 lg:flex-shrink-0 flex-col border-l border-[#F0F0EE] bg-white p-5 overflow-y-auto">
          <p className="text-[11px] font-black uppercase tracking-widest text-[#9CA3AF] mb-4">Session checklist</p>
          <div className="space-y-2">
            {session.concepts.map((c, i) => {
              const m = topicMeta(c.topic);
              const isCurrent = i === index;
              const isDone = i < index;
              return (
                <div key={c.id} className={`flex items-center gap-2.5 rounded-xl px-3 py-2.5 transition-colors ${
                  isCurrent ? "bg-yellow-50 border border-yellow-200" :
                  isDone ? "opacity-50" : "bg-[#F9FAFB]"
                }`}>
                  <div className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-lg text-[10px] font-black ${
                    isDone ? "bg-[#111] text-white" : isCurrent ? "bg-yellow-400 text-[#111]" : "bg-[#F3F4F6] text-[#9CA3AF]"
                  }`}>
                    {isDone ? "✓" : i + 1}
                  </div>
                  <span className="text-[11px]">{m.icon}</span>
                  <p className={`text-[12px] font-medium truncate ${isCurrent ? "text-[#111] font-bold" : "text-[#6B7280]"}`}>
                    {c.concept_name}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Summary screen ──────────────────────────────────────────────────────────

function SummaryScreen({ summary }: { summary: SummaryData }) {
  function shareWhatsApp() {
    const text = `Just did a Quick Prep session on Qued — revised ${summary.concepts_covered} concepts in a few minutes before my interview. ${summary.closing_message}`;
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, "_blank");
  }

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
      className="flex min-h-[calc(100vh-72px)] items-center justify-center py-10">
      <div className="mx-auto max-w-[520px] px-5 w-full">

        <div className="text-center mb-8">
          <div className="text-[48px] mb-3">✅</div>
          <h1 className="text-[24px] font-black text-[#111]" style={{ letterSpacing: "-0.5px" }}>
            Revision complete
          </h1>
          <p className="text-[14px] text-[#6B7280] mt-1">
            You covered {summary.concepts_covered} concepts
          </p>
        </div>

        <div className="grid grid-cols-4 gap-2 mb-6">
          {[
            { label: "Solid", value: summary.solid, color: "#10B981", bg: "#F0FDF4" },
            { label: "Revised", value: summary.revised, color: "#F59E0B", bg: "#FFFBEB" },
            { label: "New", value: summary.new, color: "#3B82F6", bg: "#EFF6FF" },
            { label: "Skipped", value: summary.skipped, color: "#9CA3AF", bg: "#F9FAFB" },
          ].map(s => (
            <div key={s.label} className="rounded-2xl border border-[#E5E7EB] p-3 text-center" style={{ background: s.bg }}>
              <p className="text-[22px] font-black" style={{ color: s.color }}>{s.value}</p>
              <p className="text-[10px] text-[#9CA3AF] mt-0.5 uppercase tracking-wide">{s.label}</p>
            </div>
          ))}
        </div>

        {summary.key_reminders.length > 0 && (
          <div className="rounded-2xl border border-[#E5E7EB] bg-white p-5 mb-6">
            <p className="text-[11px] font-black uppercase tracking-widest text-[#9CA3AF] mb-3">
              ⚡ Key reminders before you go in
            </p>
            <div className="space-y-3">
              {summary.key_reminders.map((r, i) => {
                const meta = topicMeta(r.topic);
                return (
                  <div key={i} className="flex items-start gap-3">
                    <span className="text-[16px] mt-0.5">{meta.icon}</span>
                    <div>
                      <p className="text-[13px] font-bold text-[#111]">{r.concept_name}</p>
                      <p className="text-[12px] text-[#6B7280] mt-0.5 leading-relaxed">{r.refresher}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="rounded-2xl bg-[#111] p-5 mb-6">
          <div className="flex items-start gap-3">
            <span className="text-[20px]">💪</span>
            <p className="text-[14px] text-white leading-relaxed">{summary.closing_message}</p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-2.5">
          <button onClick={shareWhatsApp}
            className="flex-1 rounded-2xl bg-[#25D366] py-3.5 text-[14px] font-black text-white hover:opacity-90 transition flex items-center justify-center gap-2">
            💬 Share on WhatsApp
          </button>
          <Link href="/mock/dashboard" className="flex-1 block rounded-2xl border-2 border-[#E5E7EB] bg-white py-3.5 text-center text-[14px] font-bold text-[#374151] hover:border-[#111] transition">
            Back to dashboard
          </Link>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Upgrade screen (Free tier) ────────────────────────────────────────────────

function UpgradeScreen() {
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
      className="flex min-h-[calc(100vh-72px)] items-center justify-center">
      <div className="mx-auto max-w-[420px] px-5 text-center">
        <div className="text-[52px] mb-5">⚡</div>
        <h1 className="text-[24px] font-black text-[#111] mb-2" style={{ letterSpacing: "-0.5px" }}>
          Quick Prep is a Pro feature
        </h1>
        <p className="text-[14px] text-[#6B7280] mb-8 leading-relaxed">
          Quick Prep gives you a voice-based revision session before your interview — personalized to your weak spots, no scoring, no pressure. Available on Pro and Max.
        </p>
        <Link href="/pricing">
          <button className="w-full rounded-2xl bg-[#111] py-4 text-[15px] font-black text-white hover:bg-[#333] transition">
            View plans →
          </button>
        </Link>
      </div>
    </motion.div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function QuickPrepPage() {
  const { user, authHeader } = useAuth();
  const [view, setView] = useState<ViewState>("setup");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [session, setSession] = useState<SessionData | null>(null);
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [micAllowed, setMicAllowed] = useState(false);
  const [pendingStart, setPendingStart] = useState<{ company: string | null; duration: number; focus: string } | null>(null);

  function handleStart(params: { company: string | null; duration: number; focus: string }) {
    setPendingStart(params);
    setView("permissions");
  }

  const actuallyStart = useCallback(async () => {
    if (!pendingStart) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/quick-prep/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader() },
        body: JSON.stringify({
          company: pendingStart.company,
          duration_minutes: pendingStart.duration,
          focus_area: pendingStart.focus,
        }),
      });

      if (res.status === 403) {
        setView("upgrade");
        return;
      }

      const data = await res.json();
      if (!res.ok) throw new Error(data?.detail || "Failed to start");

      setSession(data);
      setView("active");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to start");
      setView("setup");
    } finally {
      setLoading(false);
    }
  }, [pendingStart, authHeader]);

  async function handleFinish() {
    if (!session) return;
    try {
      const res = await fetch(`${API_BASE}/api/quick-prep/end`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader() },
        body: JSON.stringify({ session_id: session.session_id, was_audio_only: false }),
      });
      const data = await res.json();
      setSummary(data);
      setView("summary");
    } catch {
      setView("summary");
      setSummary({
        concepts_covered: session.concepts.length,
        solid: 0, revised: 0, new: 0, skipped: 0,
        key_reminders: [],
        closing_message: "Good work — every bit of revision helps.",
        total_quick_prep_sessions: 1,
      });
    }
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#FAFAF8] flex items-center justify-center px-6">
        <div className="text-center max-w-[400px]">
          <div className="text-[52px] mb-5">☕</div>
          <h1 className="text-[24px] font-black text-[#111] mb-2" style={{ letterSpacing: "-0.5px" }}>Quick Prep</h1>
          <p className="text-[14px] text-[#6B7280] mb-6 leading-relaxed">
            Sign in to access voice-based revision before your interview.
          </p>
          <div className="flex gap-3 justify-center">
            <Link href="/login" className="rounded-xl bg-[#111] px-6 py-3 text-[13px] font-black text-white hover:bg-[#333] transition">Sign in</Link>
            <Link href="/signup" className="rounded-xl border border-[#E5E7EB] bg-white px-6 py-3 text-[13px] font-medium text-[#374151] hover:bg-[#F9FAFB] transition">Create account</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAFAF8]">
      <main className="pt-[72px]">
        <AnimatePresence mode="wait">
          {view === "setup" && (
            <SetupScreen key="setup" onStart={handleStart} loading={loading} error={error} />
          )}
          {view === "permissions" && (
            <PermissionsScreen
              key="permissions"
              onGranted={() => { setMicAllowed(true); actuallyStart(); }}
              onSkip={() => { setMicAllowed(false); actuallyStart(); }}
            />
          )}
          {view === "active" && session && (
            <ActiveSession key="active" session={session} authHeader={authHeader} onFinish={handleFinish} micAllowed={micAllowed} />
          )}
          {view === "summary" && summary && (
            <SummaryScreen key="summary" summary={summary} />
          )}
          {view === "upgrade" && (
            <UpgradeScreen key="upgrade" />
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}