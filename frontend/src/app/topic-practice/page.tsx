"use client";

import { useCallback, useRef, useState, useEffect } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/context/AuthContext";

const API_BASE = (
  process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:8000"
).replace(/\/$/, "");

// ─── Types ────────────────────────────────────────────────────────────────────

type Subtopic = { key: string; label: string };
type TopicMeta = {
  label: string; icon: string; color: string; bg: string;
  subtopics: Subtopic[];
};
type TopicTree = Record<string, TopicMeta>;

type Question = {
  concept_id: string;
  question_text: string;
  concept_name: string;
  topic: string;
  subtopic: string | null;
  difficulty: string;
  refresher_short: string;
  interview_edge_tip: string | null;
};

type SessionData = {
  session_id: string;
  topic: string;
  subtopic: string;
  is_behavioral: boolean;
  total_questions: number;
  questions: Question[];
  plan: string;
};

type EvalResult = {
  result: "solid" | "needs_work" | "skipped";
  score: number;
  feedback: string;
  refresher: string;
  missing_points: string[];
  show_refresher: boolean;
};

type SummaryData = {
  topic: string;
  subtopic: string | null;
  questions_asked: number;
  solid: number;
  needs_work: number;
  skipped: number;
  depth_reached: string;
  avg_score: number;
  weak_concepts: { concept_name: string; subtopic: string; refresher: string }[];
  next_recommended: Subtopic | null;
};

type ViewState = "browse" | "active" | "summary" | "upgrade";

// ─── Constants ────────────────────────────────────────────────────────────────

const TOPIC_FILTERS = [
  { key: "all", label: "All Topics" },
  { key: "DBMS", label: "DBMS" },
  { key: "OS", label: "Operating Systems" },
  { key: "Behavioral", label: "Behavioral & HR" },
];

const TOPIC_META: Record<string, { color: string; bg: string; icon: string }> = {
  DBMS:       { color: "#5b21b6", bg: "#ede9fe", icon: "🗄️" },
  OS:         { color: "#92400e", bg: "#fef3c7", icon: "⚙️" },
  Behavioral: { color: "#065f46", bg: "#d1fae5", icon: "🎭" },
};

const DIFFICULTY_STYLE: Record<string, { bg: string; color: string }> = {
  easy:   { bg: "#D1FAE5", color: "#065F46" },
  medium: { bg: "#FEF3C7", color: "#92400E" },
  hard:   { bg: "#FEE2E2", color: "#991B1B" },
};

const DEPTH_META: Record<string, { label: string; color: string; bg: string; pct: number }> = {
  basic:        { label: "Basic",        color: "#F59E0B", bg: "#FFFBEB", pct: 33  },
  intermediate: { label: "Intermediate", color: "#3B82F6", bg: "#EFF6FF", pct: 66  },
  advanced:     { label: "Advanced",     color: "#10B981", bg: "#F0FDF4", pct: 100 },
};

// ─── Static concept cards for browsing ────────────────────────────────────────
// These are previews — clicking "Practice →" starts a real session

const BROWSE_CARDS = [
  // DBMS
  { topic: "DBMS", subtopic: "Transactions", concept_name: "ACID Properties",
    title: "Explain the ACID properties of transactions", difficulty: "easy",
    desc: "Walk through Atomicity, Consistency, Isolation, and Durability with a real-world example for each." },
  { topic: "DBMS", subtopic: "Schema Design", concept_name: "Normalization",
    title: "What is database normalization and why does it matter?", difficulty: "medium",
    desc: "Explain 1NF through BCNF with examples. What anomalies does normalization prevent?" },
  { topic: "DBMS", subtopic: "SQL", concept_name: "Joins",
    title: "Explain the different types of SQL joins", difficulty: "easy",
    desc: "When would you use INNER vs LEFT vs FULL OUTER JOIN? Give a practical example for each." },
  { topic: "DBMS", subtopic: "Performance", concept_name: "Indexing",
    title: "How does database indexing work?", difficulty: "medium",
    desc: "Explain B-tree indexes, when to use them, and the read vs write performance tradeoff." },
  { topic: "DBMS", subtopic: "Scaling", concept_name: "Sharding",
    title: "What is database sharding and what are the challenges?", difficulty: "hard",
    desc: "How do you split data across servers? What makes a good shard key, and what goes wrong?" },
  { topic: "DBMS", subtopic: "Transactions", concept_name: "Isolation Levels",
    title: "Explain transaction isolation levels", difficulty: "hard",
    desc: "What are dirty reads, non-repeatable reads, and phantom reads? How does each level prevent them?" },
  // OS
  { topic: "OS", subtopic: "Processes", concept_name: "Process vs Thread",
    title: "What is the difference between a process and a thread?", difficulty: "easy",
    desc: "How do they differ in memory, creation cost, and communication? When would you use each?" },
  { topic: "OS", subtopic: "Concurrency", concept_name: "Deadlock",
    title: "What is a deadlock? What are the four conditions for it?", difficulty: "medium",
    desc: "Name the Coffman conditions and explain how removing any one of them prevents deadlock." },
  { topic: "OS", subtopic: "Memory Management", concept_name: "Paging",
    title: "Explain virtual memory and how paging works", difficulty: "hard",
    desc: "What happens on a page fault? What is thrashing and why does it occur?" },
  { topic: "OS", subtopic: "Scheduling", concept_name: "CPU Scheduling",
    title: "Compare CPU scheduling algorithms", difficulty: "medium",
    desc: "Explain FCFS, SJF, Round Robin, and Priority Scheduling. What are the tradeoffs of each?" },
  { topic: "OS", subtopic: "Concurrency", concept_name: "Mutex vs Semaphore",
    title: "What is the difference between a mutex and a semaphore?", difficulty: "medium",
    desc: "When would you use each? What does ownership mean in the context of a mutex?" },
  { topic: "OS", subtopic: "Processes", concept_name: "Context Switching",
    title: "What is context switching and what is the overhead?", difficulty: "medium",
    desc: "What gets saved and restored? Why is switching between processes more expensive than threads?" },
  // Behavioral
  { topic: "Behavioral", subtopic: "Introduction", concept_name: "Tell Me About Yourself",
    title: "Tell me about yourself", difficulty: "medium",
    desc: "Structure a 60-90 second intro: current context, key strength, one concrete project, why this role." },
  { topic: "Behavioral", subtopic: "STAR Method Stories", concept_name: "STAR Method",
    title: "Tell me about a significant technical challenge you faced", difficulty: "medium",
    desc: "Use the STAR method. Which part should be longest? What does 'we did this' signal to an interviewer?" },
  { topic: "Behavioral", subtopic: "Motivation Questions", concept_name: "Why This Company",
    title: "Why do you want to work here specifically?", difficulty: "easy",
    desc: "What should you never say? How do you answer this honestly for a service company like TCS?" },
  { topic: "Behavioral", subtopic: "Self Assessment", concept_name: "Strengths and Weaknesses",
    title: "What is your greatest strength and weakness?", difficulty: "easy",
    desc: "What makes a weakness answer good vs. bad? What must every weakness answer include?" },
  { topic: "Behavioral", subtopic: "Leadership", concept_name: "Leadership and Initiative",
    title: "Tell me about a time you showed leadership without a formal role", difficulty: "medium",
    desc: "What counts as leadership for students? What makes a strong leadership story at this stage?" },
  { topic: "Behavioral", subtopic: "Motivation Questions", concept_name: "Career Goals",
    title: "Where do you see yourself in 3-5 years?", difficulty: "easy",
    desc: "How specific should you be? What should you never say even if it's true?" },
];

// ─── Browse screen ─────────────────────────────────────────────────────────────

function BrowseScreen({
  onStart,
  loading,
  error,
}: {
  onStart: (topic: string, subtopic: string, count: number) => void;
  loading: boolean;
  error: string | null;
}) {
  const [activeFilter, setActiveFilter] = useState("all");
  const [selectedCard, setSelectedCard] = useState<typeof BROWSE_CARDS[0] | null>(null);

  const filtered = activeFilter === "all"
    ? BROWSE_CARDS
    : BROWSE_CARDS.filter(c => c.topic === activeFilter);

  return (
    <section className="min-h-[calc(100vh-72px)] py-10 px-6" style={{ background: "#FAFAF7" }}>
      <div className="max-w-6xl mx-auto">

        {/* Header */}
        <div className="text-center mb-4">
          <h1
            className="font-black leading-tight mb-4"
            style={{ fontSize: "clamp(28px, 4vw, 48px)", letterSpacing: "-1.5px", color: "#111" }}
          >
            Drill one topic,
            <br />
            go{" "}
            <span style={{ background: "#FFD600", padding: "2px 10px", borderRadius: "6px", fontStyle: "italic" }}>
              deep.
            </span>
          </h1>
          <p style={{ fontSize: "16px", color: "#666", maxWidth: "480px", margin: "0 auto", lineHeight: 1.7 }}>
            Pick a subject and answer 5-10 questions on it. Scored and tracked. Feeds your Skill Passport.
          </p>
        </div>

        {/* Topic filter tabs */}
        <div
          className="mt-10 mb-8 rounded-2xl p-1.5 flex items-center gap-1 overflow-x-auto"
          style={{ background: "white", border: "1px solid #E8E8E0", scrollbarWidth: "none" as any }}
        >
          {TOPIC_FILTERS.map(f => (
            <button
              key={f.key}
              onClick={() => setActiveFilter(f.key)}
              className="flex items-center gap-2 whitespace-nowrap transition-all duration-200 flex-shrink-0"
              style={{
                padding: "10px 18px",
                borderRadius: "12px",
                fontSize: "14px",
                fontWeight: activeFilter === f.key ? 700 : 500,
                background: activeFilter === f.key ? "#111" : "transparent",
                color: activeFilter === f.key ? "white" : "#555",
              }}
            >
              {f.key !== "all" && <span>{TOPIC_META[f.key]?.icon}</span>}
              {f.label}
            </button>
          ))}
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 rounded-xl border border-rose-100 bg-rose-50 px-4 py-3">
            <p className="text-[13px] text-rose-700">{error}</p>
          </div>
        )}

        {/* Cards grid */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeFilter}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
          >
            {filtered.map((card, i) => {
              const meta = TOPIC_META[card.topic] || { color: "#374151", bg: "#f3f4f6", icon: "📝" };
              const diff = DIFFICULTY_STYLE[card.difficulty] || DIFFICULTY_STYLE.medium;
              const isSelected = selectedCard?.concept_name === card.concept_name;

              return (
                <motion.div
                  key={`${card.topic}-${i}`}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                  whileHover={{ y: -4, transition: { duration: 0.15 } }}
                  className="flex flex-col cursor-pointer"
                  onClick={() => setSelectedCard(isSelected ? null : card)}
                  style={{
                    background: "white",
                    border: isSelected ? "2px solid #111" : "1px solid #E8E8E0",
                    borderRadius: "20px",
                    padding: "24px",
                  }}
                >
                  {/* Top row */}
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-xs font-bold px-3 py-1 rounded-full"
                      style={{ background: meta.bg, color: meta.color }}>
                      {card.subtopic}
                    </span>
                    <span className="text-xs font-bold px-2.5 py-1 rounded-full"
                      style={{ background: "#F5F5F0", color: "#888" }}>
                      🎙 Voice
                    </span>
                  </div>

                  {/* Visual */}
                  <div
                    className="rounded-xl mb-4 flex items-center justify-center"
                    style={{
                      height: "90px",
                      background: `linear-gradient(135deg, ${meta.bg} 0%, white 100%)`,
                      border: "1px solid #F0F0EB",
                    }}
                  >
                    <div className="flex items-end gap-1 px-4">
                      {[12, 24, 18, 32, 20, 28, 16, 24, 20, 14, 26].map((h, wi) => (
                        <div key={wi} style={{
                          width: "5px",
                          height: `${h}px`,
                          background: meta.color,
                          borderRadius: "3px",
                          opacity: 0.3 + (wi % 3) * 0.25,
                        }} />
                      ))}
                    </div>
                  </div>

                  {/* Content */}
                  <div className="flex-1">
                    <h3 className="font-bold leading-snug mb-2" style={{ fontSize: "15px", color: "#111" }}>
                      {card.title}
                    </h3>
                    <p style={{ fontSize: "13px", color: "#888", lineHeight: 1.6 }}>
                      {card.desc}
                    </p>
                  </div>

                  {/* Footer */}
                  <div className="flex items-center justify-between mt-4 pt-4"
                    style={{ borderTop: "1px solid #F0F0EB" }}>
                    <span className="text-xs font-semibold px-2.5 py-1 rounded-full capitalize"
                      style={{ background: diff.bg, color: diff.color }}>
                      {card.difficulty}
                    </span>

                    {isSelected ? (
                      <div className="flex gap-2">
                        {[5, 7, 10].map(n => (
                          <button
                            key={n}
                            onClick={e => { e.stopPropagation(); onStart(card.topic, card.subtopic || "all", n); }}
                            disabled={loading}
                            className="rounded-xl px-3 py-1.5 text-[12px] font-black transition-all"
                            style={{ background: "#111", color: "white" }}
                          >
                            {loading ? "..." : `${n} Qs`}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <button
                        onClick={e => { e.stopPropagation(); setSelectedCard(card); }}
                        className="text-sm font-bold transition-all hover:gap-2"
                        style={{ color: "#111", display: "flex", alignItems: "center", gap: "4px" }}
                      >
                        Practice <span>→</span>
                      </button>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        </AnimatePresence>

        {/* Bottom CTA — start full topic session */}
        <div className="mt-10 rounded-2xl border border-[#E5E7EB] bg-white p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <p className="text-[15px] font-black text-[#111]">Want a full mixed session?</p>
            <p className="text-[13px] text-[#9CA3AF] mt-0.5">
              Pick a topic and get 7 questions across all subtopics — best for a comprehensive drill.
            </p>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            {[
              { topic: "DBMS", label: "DBMS session" },
              { topic: "OS", label: "OS session" },
              { topic: "Behavioral", label: "Behavioral session" },
            ].map(({ topic, label }) => {
              const meta = TOPIC_META[topic];
              return (
                <button
                  key={topic}
                  onClick={() => onStart(topic, "all", 7)}
                  disabled={loading}
                  className="rounded-xl px-4 py-2.5 text-[13px] font-bold border transition-all hover:border-[#111]"
                  style={{ borderColor: "#E5E7EB", color: "#374151" }}
                >
                  {meta.icon} {label}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Active session ────────────────────────────────────────────────────────────

function ActiveSession({
  session,
  authHeader,
  onFinish,
}: {
  session: SessionData;
  authHeader: () => Record<string, string>;
  onFinish: () => void;
}) {
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<"question" | "listening" | "feedback">("question");
  const [transcript, setTranscript] = useState("");
  const [evaluation, setEvaluation] = useState<EvalResult | null>(null);
  const [elapsedSecs, setElapsedSecs] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [showRefresher, setShowRefresher] = useState(false);

  const recognitionRef = useRef<any>(null);
  const startTimeRef = useRef(Date.now());

  const question = session.questions[index];
  const isLast = index === session.questions.length - 1;
  const meta = TOPIC_META[session.topic] || { color: "#374151", bg: "#f3f4f6", icon: "📝" };

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsedSecs(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    setPhase("question");
    setTranscript("");
    setEvaluation(null);
    setShowRefresher(false);
  }, [index]);

  function startListening() {
    setPhase("listening");
    setTranscript("");
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
    if (recognitionRef.current) { recognitionRef.current.stop(); recognitionRef.current = null; }
  }

  async function submitAnswer(skip = false) {
    stopListening();
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/api/topic-practice/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader() },
        body: JSON.stringify({
          session_id: session.session_id,
          concept_id: question.concept_id,
          question_text: question.question_text,
          transcript: skip ? "" : transcript,
          topic: session.topic,
          subtopic: question.subtopic,
        }),
      });
      const data = await res.json();
      setEvaluation(data);
      setPhase("feedback");
    } catch { advance(); }
    finally { setSubmitting(false); }
  }

  function advance() {
    stopListening();
    if (isLast) onFinish();
    else setIndex(i => i + 1);
  }

  const minutes = String(Math.floor(elapsedSecs / 60)).padStart(2, "0");
  const secs = String(elapsedSecs % 60).padStart(2, "0");

  return (
    <div className="flex flex-col min-h-[calc(100vh-72px)] bg-[#FAFAF8]">

      {/* Top bar */}
      <div className="flex items-center justify-between px-5 lg:px-8 py-3 border-b border-[#F0F0EE] bg-white">
        <div className="flex items-center gap-2">
          <span className="text-[14px]">{meta.icon}</span>
          <span className="text-[12px] font-black text-[#111]">{session.topic}</span>
          {session.subtopic && session.subtopic !== "all" && (
            <span className="text-[11px] text-[#9CA3AF]">· {session.subtopic}</span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[12px] font-mono text-[#9CA3AF]">{minutes}:{secs}</span>
          <span className="text-[12px] font-black text-[#111]">{index + 1}/{session.total_questions}</span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-[#F3F4F6]">
        <div className="h-1 bg-[#111] transition-all duration-500"
          style={{ width: `${((index + (phase === "feedback" ? 1 : 0)) / session.total_questions) * 100}%` }} />
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col lg:flex-row">
        <div className="flex-1 flex flex-col items-center justify-center px-5 py-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={`${index}-${phase}`}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="w-full max-w-[500px]"
            >
              {phase === "question" && (
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <span className="rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wide"
                      style={{ background: meta.bg, color: meta.color }}>
                      {meta.icon} {question.topic}
                    </span>
                    <span className="text-[10px] text-[#9CA3AF] capitalize">{question.difficulty}</span>
                  </div>
                  <div className="rounded-2xl bg-white border border-[#E5E7EB] p-5 mb-6 shadow-sm">
                    <p className="text-[15px] text-[#111] leading-relaxed font-medium">
                      {question.question_text}
                    </p>
                  </div>
                  <div className="flex flex-col gap-2.5">
                    <button onClick={startListening}
                      className="w-full rounded-2xl bg-[#111] py-4 text-[14px] font-black text-white hover:bg-[#333] transition">
                      🎙️ Answer by voice
                    </button>
                    <button onClick={() => submitAnswer(true)}
                      className="text-[12px] text-[#9CA3AF] hover:text-[#111] transition py-1">
                      Skip this question →
                    </button>
                  </div>
                </div>
              )}

              {phase === "listening" && (
                <div>
                  <p className="text-[12px] text-[#9CA3AF] mb-3 text-center">{question.concept_name}</p>
                  <div className="rounded-2xl bg-white border border-[#E5E7EB] p-4 mb-3 text-[13px] text-[#374151] leading-relaxed min-h-[80px]">
                    {transcript || <span className="text-[#D1D5DB] italic">Start speaking...</span>}
                  </div>
                  <div className="flex items-end justify-center gap-0.5 h-8 mb-5">
                    {Array.from({ length: 28 }).map((_, i) => (
                      <div key={i} className="w-1 rounded-full" style={{
                        height: `${20 + Math.random() * 80}%`,
                        background: meta.color,
                        animationName: "tpPulse",
                        animationDuration: `${0.4 + Math.random() * 0.7}s`,
                        animationTimingFunction: "ease-in-out",
                        animationIterationCount: "infinite",
                        animationDirection: "alternate",
                        animationDelay: `${i * 0.03}s`,
                      }} />
                    ))}
                  </div>
                  <style>{`@keyframes tpPulse { from { opacity: 0.2; } to { opacity: 1; } }`}</style>
                  <button onClick={() => submitAnswer(false)} disabled={submitting}
                    className="w-full rounded-2xl bg-[#111] py-4 text-[14px] font-black text-white hover:bg-[#333] transition disabled:opacity-50">
                    {submitting ? "Evaluating..." : "Done — evaluate my answer →"}
                  </button>
                </div>
              )}

              {phase === "feedback" && evaluation && (
                <div>
                  <div className="flex items-center justify-center gap-3 mb-5">
                    <div className={`flex h-12 w-12 items-center justify-center rounded-2xl text-[18px] font-black ${
                      evaluation.result === "solid" ? "bg-emerald-100 text-emerald-700" :
                      evaluation.result === "skipped" ? "bg-[#F3F4F6] text-[#9CA3AF]" :
                      "bg-amber-100 text-amber-700"
                    }`}>
                      {evaluation.result === "solid" ? "✓" : evaluation.result === "skipped" ? "→" : Math.round(evaluation.score)}
                    </div>
                    <div>
                      <p className="text-[14px] font-black text-[#111]">
                        {evaluation.result === "solid" ? "Solid answer" :
                         evaluation.result === "skipped" ? "Skipped" : "Needs work"}
                      </p>
                      {evaluation.result !== "skipped" && (
                        <p className="text-[11px] text-[#9CA3AF]">{Math.round(evaluation.score)}/10</p>
                      )}
                    </div>
                  </div>

                  {evaluation.feedback && (
                    <div className="rounded-2xl bg-white border border-[#E5E7EB] p-4 mb-3">
                      <p className="text-[13px] text-[#374151] leading-relaxed">{evaluation.feedback}</p>
                    </div>
                  )}

                  {evaluation.missing_points.length > 0 && (
                    <div className="rounded-2xl bg-amber-50 border border-amber-200 p-4 mb-3">
                      <p className="text-[11px] font-black text-[#92400E] mb-2">What you missed:</p>
                      {evaluation.missing_points.map((p, i) => (
                        <div key={i} className="flex items-start gap-2 mb-1">
                          <span className="text-amber-500 mt-0.5 text-[12px]">•</span>
                          <p className="text-[12px] text-[#92400E]">{p}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {evaluation.show_refresher && evaluation.refresher && (
                    <div className="mb-3">
                      <button onClick={() => setShowRefresher(r => !r)}
                        className="text-[12px] font-bold text-[#111] hover:underline">
                        {showRefresher ? "Hide" : "Show"} full explanation →
                      </button>
                      <AnimatePresence>
                        {showRefresher && (
                          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                            <div className="mt-2 rounded-2xl bg-[#F9FAFB] border border-[#F3F4F6] p-4">
                              <p className="text-[12px] text-[#6B7280] leading-relaxed">{evaluation.refresher}</p>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  )}

                  <button onClick={advance}
                    className="w-full rounded-2xl bg-[#111] py-3.5 text-[14px] font-black text-white hover:bg-[#333] transition">
                    {isLast ? "See my results →" : "Next question →"}
                  </button>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Desktop: question list sidebar */}
        <div className="hidden lg:flex lg:w-72 flex-col border-l border-[#F0F0EE] bg-white p-5 overflow-y-auto">
          <p className="text-[11px] font-black uppercase tracking-widest text-[#9CA3AF] mb-4">Questions</p>
          <div className="space-y-2">
            {session.questions.map((q, i) => {
              const isDone = i < index;
              const isCurrent = i === index;
              return (
                <div key={i} className={`rounded-xl px-3 py-2.5 ${
                  isCurrent ? "bg-yellow-50 border border-yellow-200" :
                  isDone ? "bg-[#F9FAFB] opacity-60" : "bg-[#F9FAFB]"
                }`}>
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className={`text-[10px] font-black ${isCurrent ? "text-yellow-700" : isDone ? "text-[#9CA3AF]" : "text-[#D1D5DB]"}`}>
                      Q{i + 1}
                    </span>
                    <span className="text-[9px] text-[#D1D5DB] capitalize">{q.difficulty}</span>
                  </div>
                  <p className="text-[11px] text-[#6B7280] font-medium truncate">{q.concept_name}</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Summary screen ────────────────────────────────────────────────────────────

function SummaryScreen({ summary, onRetry }: { summary: SummaryData; onRetry: () => void }) {
  const depth = DEPTH_META[summary.depth_reached] || DEPTH_META.basic;
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
      className="flex min-h-[calc(100vh-72px)] items-center justify-center py-10">
      <div className="mx-auto max-w-[520px] px-5 w-full">
        <div className="text-center mb-8">
          <div className="text-[44px] mb-3">📊</div>
          <h1 className="text-[24px] font-black text-[#111]" style={{ letterSpacing: "-0.5px" }}>
            {summary.topic} — {summary.subtopic || "Mixed"}
          </h1>
          <p className="text-[14px] text-[#6B7280] mt-1">
            {summary.questions_asked} questions · {summary.avg_score}/10 avg
          </p>
        </div>

        <div className="rounded-2xl border border-[#E5E7EB] bg-white p-5 mb-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[13px] font-black text-[#111]">Depth reached</p>
            <span className="rounded-full px-3 py-1 text-[12px] font-black"
              style={{ background: depth.bg, color: depth.color }}>{depth.label}</span>
          </div>
          <div className="h-3 w-full rounded-full bg-[#F3F4F6] overflow-hidden">
            <motion.div initial={{ width: 0 }} animate={{ width: `${depth.pct}%` }}
              transition={{ duration: 1, ease: "easeOut" }}
              className="h-full rounded-full" style={{ background: depth.color }} />
          </div>
          <div className="flex justify-between mt-2">
            <span className="text-[10px] text-[#D1D5DB]">Basic</span>
            <span className="text-[10px] text-[#D1D5DB]">Intermediate</span>
            <span className="text-[10px] text-[#D1D5DB]">Advanced</span>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 mb-5">
          {[
            { label: "Solid", value: summary.solid, color: "#10B981", bg: "#F0FDF4" },
            { label: "Needs work", value: summary.needs_work, color: "#F59E0B", bg: "#FFFBEB" },
            { label: "Skipped", value: summary.skipped, color: "#9CA3AF", bg: "#F9FAFB" },
          ].map(s => (
            <div key={s.label} className="rounded-2xl border border-[#E5E7EB] p-3 text-center" style={{ background: s.bg }}>
              <p className="text-[22px] font-black" style={{ color: s.color }}>{s.value}</p>
              <p className="text-[10px] text-[#9CA3AF] mt-0.5 uppercase tracking-wide">{s.label}</p>
            </div>
          ))}
        </div>

        {summary.weak_concepts.length > 0 && (
          <div className="rounded-2xl border border-[#E5E7EB] bg-white p-5 mb-5">
            <p className="text-[11px] font-black uppercase tracking-widest text-[#9CA3AF] mb-3">
              Review before your next session
            </p>
            <div className="space-y-3">
              {summary.weak_concepts.map((c, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span className="text-amber-400 mt-0.5">⚡</span>
                  <div>
                    <p className="text-[13px] font-bold text-[#111]">{c.concept_name}</p>
                    <p className="text-[11px] text-[#6B7280] mt-0.5 leading-relaxed">{c.refresher}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {summary.next_recommended && (
          <div className="rounded-2xl bg-[#111] p-4 mb-5">
            <p className="text-[11px] text-[#555] mb-1">Next recommended</p>
            <p className="text-[14px] font-black text-white">{summary.next_recommended.label}</p>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-2.5">
          <button onClick={onRetry}
            className="flex-1 rounded-2xl bg-[#111] py-3.5 text-[14px] font-black text-white hover:bg-[#333] transition">
            Practice again →
          </button>
          <Link href="/passport" className="flex-1 block rounded-2xl border-2 border-[#E5E7EB] bg-white py-3.5 text-center text-[14px] font-bold text-[#374151] hover:border-[#111] transition">
            View Skill Passport
          </Link>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Upgrade screen ────────────────────────────────────────────────────────────

function UpgradeScreen() {
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
      className="flex min-h-[calc(100vh-72px)] items-center justify-center">
      <div className="mx-auto max-w-[420px] px-5 text-center">
        <div className="text-[52px] mb-5">📊</div>
        <h1 className="text-[24px] font-black text-[#111] mb-2" style={{ letterSpacing: "-0.5px" }}>
          Monthly limit reached
        </h1>
        <p className="text-[14px] text-[#6B7280] mb-8 leading-relaxed">
          Free plan includes 3 topic practice sessions per month. Upgrade for unlimited drilling.
        </p>
        <Link href="/pricing">
          <button className="w-full rounded-2xl bg-[#111] py-4 text-[15px] font-black text-white hover:bg-[#333] transition mb-3">
            View plans →
          </button>
        </Link>
      </div>
    </motion.div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function TopicPracticePage() {
  const { user, authHeader } = useAuth();
  const [view, setView] = useState<ViewState>("browse");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [session, setSession] = useState<SessionData | null>(null);
  const [summary, setSummary] = useState<SummaryData | null>(null);

  async function handleStart(topic: string, subtopic: string, count: number) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/topic-practice/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader() },
        body: JSON.stringify({ topic, subtopic, question_count: count }),
      });
      if (res.status === 403) { setView("upgrade"); return; }
      const data = await res.json();
      if (!res.ok) throw new Error(data?.detail || "Failed to start");
      setSession(data);
      setView("active");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to start");
    } finally {
      setLoading(false);
    }
  }

  async function handleFinish() {
    if (!session) return;
    try {
      const res = await fetch(`${API_BASE}/api/topic-practice/end`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader() },
        body: JSON.stringify({ session_id: session.session_id }),
      });
      const data = await res.json();
      setSummary(data);
      setView("summary");
    } catch { setView("browse"); }
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#FAFAF8] flex items-center justify-center px-6">
        <div className="text-center max-w-[400px]">
          <div className="text-[52px] mb-5">📊</div>
          <h1 className="text-[24px] font-black text-[#111] mb-2" style={{ letterSpacing: "-0.5px" }}>Topic Practice</h1>
          <p className="text-[14px] text-[#6B7280] mb-6">Sign in to start drilling and track your depth.</p>
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
          {view === "browse" && (
            <BrowseScreen key="browse" onStart={handleStart} loading={loading} error={error} />
          )}
          {view === "active" && session && (
            <ActiveSession key="active" session={session} authHeader={authHeader} onFinish={handleFinish} />
          )}
          {view === "summary" && summary && (
            <SummaryScreen key="summary" summary={summary} onRetry={() => setView("browse")} />
          )}
          {view === "upgrade" && (
            <UpgradeScreen key="upgrade" />
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}