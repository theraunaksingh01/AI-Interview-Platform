"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/context/AuthContext";

const API_BASE = (
  process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:8000"
).replace(/\/$/, "");

type Question = {
  concept_id: string;
  concept_name: string;
  topic: string;
  question_text: string;
  good_answer_summary: string;
  difficulty: string;
};

type RoomData = {
  room_id: string;
  room_code: string;
  questions: Question[];
  expires_at: string;
  share_url: string;
};

type ViewState = "entry" | "create-setup" | "code-ready" | "answering" | "share" | "upgrade" | "join-error";
type Mode = "create" | "join";

const TOPICS = [
  { key: "mixed", label: "Mixed", icon: "🎲", color: "#8B5CF6", bg: "#EDE9FE" },
  { key: "DBMS", label: "DBMS", icon: "🗄️", color: "#5B21B6", bg: "#EDE9FE" },
  { key: "OS", label: "OS", icon: "⚙️", color: "#92400E", bg: "#FEF3C7" },
  { key: "Behavioral", label: "Behavioral", icon: "🎭", color: "#065F46", bg: "#D1FAE5" },
];

function Waveform({ color = "#111" }: { color?: string }) {
  return (
    <>
      <div className="flex items-end justify-center gap-1 h-12 mb-2">
        {Array.from({ length: 24 }).map((_, i) => (
          <div key={i} className="w-1 rounded-full" style={{
            height: `${20 + Math.random() * 80}%`,
            background: color,
            animationName: "peerPulse",
            animationDuration: `${0.4 + Math.random() * 0.7}s`,
            animationTimingFunction: "ease-in-out",
            animationIterationCount: "infinite",
            animationDirection: "alternate",
            animationDelay: `${i * 0.03}s`,
          }} />
        ))}
      </div>
      <style>{`@keyframes peerPulse { from { opacity: 0.25; } to { opacity: 1; } }`}</style>
    </>
  );
}

export default function PeerCreatePage() {
  const { user, authHeader } = useAuth();
  const router = useRouter();
  const [view, setView] = useState<ViewState>("entry");
  const [topic, setTopic] = useState("mixed");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [room, setRoom] = useState<RoomData | null>(null);

  // Join state
  const [joinDigits, setJoinDigits] = useState<string[]>(["", "", "", "", "", ""]);
  const joinRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [joinChecking, setJoinChecking] = useState(false);

  // Answering state
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<"ask" | "listening" | "submitted">("ask");
  const [transcript, setTranscript] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);

  const userPlan = (user as any)?.plan ?? "free";
  const canCreate = userPlan === "pro" || userPlan === "max";

  function handleDigitChange(i: number, val: string) {
    const clean = val.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 1);
    const next = [...joinDigits];
    next[i] = clean;
    setJoinDigits(next);
    if (clean && i < 5) joinRefs.current[i + 1]?.focus();
  }

  function handleDigitKeyDown(i: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !joinDigits[i] && i > 0) {
      joinRefs.current[i - 1]?.focus();
    }
  }

  function handleDigitPaste(e: React.ClipboardEvent<HTMLInputElement>) {
    const pasted = e.clipboardData.getData("text").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
    if (pasted.length === 6) {
      e.preventDefault();
      setJoinDigits(pasted.split(""));
      joinRefs.current[5]?.focus();
    }
  }

  async function joinRoom() {
    const code = joinDigits.join("");
    if (code.length !== 6) {
      setError("Enter the full 6-character code");
      return;
    }
    setJoinChecking(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/peer/room/${code}`, { headers: authHeader() });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        if (res.status === 404) throw new Error("That code doesn't exist. Double-check and try again.");
        if (res.status === 410) throw new Error("This room has expired.");
        throw new Error(data?.detail || "Couldn't find that room");
      }
      router.push(`/peer/${code}`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Couldn't find that room");
    } finally {
      setJoinChecking(false);
    }
  }

  async function createRoom() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/peer/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader() },
        body: JSON.stringify({ topic }),
      });
      if (res.status === 403) { setView("upgrade"); return; }
      const data = await res.json();
      if (!res.ok) throw new Error(data?.detail || "Failed to create room");
      setRoom(data);
      setView("code-ready");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to create room");
    } finally {
      setLoading(false);
    }
  }

  function startListening() {
    setPhase("listening");
    setTranscript("");
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";
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
    recognition.start();
    (window as any).__peerRecognition = recognition;
  }

  function stopListening() {
    if ((window as any).__peerRecognition) (window as any).__peerRecognition.stop();
  }

  async function submitAnswer() {
    if (!room) return;
    stopListening();
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/api/peer/room/${room.room_code}/answer`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader() },
        body: JSON.stringify({ question_index: index, transcript }),
      });
      const data = await res.json();
      setPhase("submitted");
      setTimeout(() => {
        if (data.all_done) {
          setView("share");
        } else {
          setIndex(i => i + 1);
          setPhase("ask");
          setTranscript("");
        }
      }, 1200);
    } catch {
      // ignore, allow retry
    } finally {
      setSubmitting(false);
    }
  }

  function copyCode() {
    if (!room) return;
    navigator.clipboard.writeText(room.room_code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function shareWhatsApp() {
    if (!room) return;
    const url = `${window.location.origin}/peer/${room.room_code}`;
    const text = `I just answered 5 interview questions on Qued. Can you beat my score? 🔥\n\nTry here: ${url}`;
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, "_blank");
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#FAFAF8] flex items-center justify-center px-6">
        <div className="text-center max-w-[400px]">
          <div className="text-[52px] mb-5">⚔️</div>
          <h1 className="text-[24px] font-black text-[#111] mb-2" style={{ letterSpacing: "-0.5px" }}>Peer Practice</h1>
          <p className="text-[14px] text-[#6B7280] mb-6">Sign in to challenge a friend.</p>
          <div className="flex gap-3 justify-center">
            <Link href="/login" className="rounded-xl bg-[#111] px-6 py-3 text-[13px] font-black text-white hover:bg-[#333] transition">Sign in</Link>
            <Link href="/signup" className="rounded-xl border border-[#E5E7EB] bg-white px-6 py-3 text-[13px] font-medium text-[#374151] hover:bg-[#F9FAFB] transition">Create account</Link>
          </div>
        </div>
      </div>
    );
  }

  if (view === "upgrade") {
    return (
      <div className="min-h-screen bg-[#FAFAF8] flex items-center justify-center px-6">
        <div className="text-center max-w-[420px]">
          <div className="text-[52px] mb-5">⚔️</div>
          <h1 className="text-[24px] font-black text-[#111] mb-2" style={{ letterSpacing: "-0.5px" }}>
            Creating a challenge needs Pro
          </h1>
          <p className="text-[14px] text-[#6B7280] mb-6 leading-relaxed">
            Free users can accept challenges from friends. Upgrade to Pro to create your own and challenge anyone.
          </p>
          <Link href="/pricing">
            <button className="w-full rounded-2xl bg-[#111] py-4 text-[15px] font-black text-white hover:bg-[#333] transition mb-3">
              View plans →
            </button>
          </Link>
          <button onClick={() => setView("entry")} className="text-[13px] text-[#9CA3AF] hover:text-[#111] transition">
            ← Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAFAF8]">
      <main className="pt-[88px] pb-20 px-4 sm:px-6">

        <AnimatePresence mode="wait">

          {/* ── ENTRY: Create or Join split ── */}
          {view === "entry" && (
            <motion.div key="entry" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
              className="mx-auto max-w-[920px]">

              <div className="text-center mb-10">
                <div className="inline-flex items-center gap-2 rounded-full border border-[#E5E7EB] bg-white px-3 py-1.5 mb-5">
                  <span className="h-1.5 w-1.5 rounded-full bg-yellow-400 animate-pulse" />
                  <span className="text-[11px] font-black uppercase tracking-widest text-[#374151]">Peer Practice</span>
                </div>
                <h1 style={{ fontSize: "clamp(28px, 5vw, 44px)", fontWeight: 900, letterSpacing: "-1.5px", color: "#111", lineHeight: 1.3 }}>
                  Challenge a friend.<br />
                  <span style={{ background: "#FFD600", padding: "1px 12px", borderRadius: "8px", fontStyle: "italic" }}>
                    Who scores higher?
                  </span>
                </h1>
                <p className="mt-4 text-[15px] text-[#6B7280] max-w-md mx-auto leading-relaxed">
                  Answer 5 questions, share the code, see who did better — with AI breaking down exactly where you each won.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

                {/* Create card */}
                <motion.button
                  whileHover={{ y: -3 }}
                  onClick={() => canCreate ? setView("create-setup") : setView("upgrade")}
                  className="text-left rounded-3xl border border-[#E5E7EB] bg-white p-7 transition-all hover:border-[#111] relative overflow-hidden"
                  style={{ boxShadow: "0 4px 32px rgba(0,0,0,0.05)" }}
                >
                  {!canCreate && (
                    <span className="absolute top-5 right-5 rounded-full bg-[#111] px-2.5 py-1 text-[10px] font-black text-white">
                      PRO
                    </span>
                  )}
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#111] text-[22px] mb-4">
                    ⚡
                  </div>
                  <p className="text-[19px] font-black text-[#111] mb-1.5">Create a challenge</p>
                  <p className="text-[13px] text-[#6B7280] leading-relaxed mb-4">
                    Pick a topic, answer 5 questions, get a code to share with anyone.
                  </p>
                  <span className="text-[13px] font-bold text-[#111] flex items-center gap-1">
                    {canCreate ? "Start →" : "Upgrade to create →"}
                  </span>
                </motion.button>

                {/* Join card */}
                <motion.div
                  whileHover={{ y: -3 }}
                  className="text-left rounded-3xl border border-[#E5E7EB] bg-white p-7 transition-all"
                  style={{ boxShadow: "0 4px 32px rgba(0,0,0,0.05)" }}
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-yellow-400 text-[22px] mb-4">
                    🎯
                  </div>
                  <p className="text-[19px] font-black text-[#111] mb-1.5">Got a code?</p>
                  <p className="text-[13px] text-[#6B7280] leading-relaxed mb-4">
                    Enter your friend&apos;s challenge code to accept it.
                  </p>

                  <div className="flex gap-1.5 mb-3" onPaste={handleDigitPaste}>
                    {joinDigits.map((d, i) => (
                      <input
                        key={i}
                        ref={el => { joinRefs.current[i] = el; }}
                        value={d}
                        onChange={e => handleDigitChange(i, e.target.value)}
                        onKeyDown={e => handleDigitKeyDown(i, e)}
                        maxLength={1}
                        className="h-12 w-full rounded-xl border-2 border-[#E5E7EB] text-center text-[18px] font-black text-[#111] focus:border-[#111] focus:outline-none transition uppercase"
                      />
                    ))}
                  </div>

                  {error && view === "entry" && (
                    <p className="text-[12px] text-rose-600 mb-3">{error}</p>
                  )}

                  <button onClick={joinRoom} disabled={joinChecking || joinDigits.join("").length !== 6}
                    className="w-full rounded-xl bg-[#111] py-3 text-[13px] font-black text-white hover:bg-[#333] transition disabled:opacity-30">
                    {joinChecking ? "Checking..." : "Join challenge →"}
                  </button>
                </motion.div>
              </div>

              {/* Stats teaser strip */}
              <div className="mt-8 rounded-2xl border border-[#E5E7EB] bg-white p-5 flex items-center justify-center gap-8 text-center">
                <div>
                  <p className="text-[20px] font-black text-[#111]">5</p>
                  <p className="text-[10px] text-[#9CA3AF] uppercase tracking-wide">Questions</p>
                </div>
                <div className="h-8 w-px bg-[#F0F0EE]" />
                <div>
                  <p className="text-[20px] font-black text-[#111]">Medium</p>
                  <p className="text-[10px] text-[#9CA3AF] uppercase tracking-wide">Fair difficulty</p>
                </div>
                <div className="h-8 w-px bg-[#F0F0EE]" />
                <div>
                  <p className="text-[20px] font-black text-[#111]">7 days</p>
                  <p className="text-[10px] text-[#9CA3AF] uppercase tracking-wide">Code expires</p>
                </div>
              </div>
            </motion.div>
          )}

          {/* ── CREATE SETUP: pick topic ── */}
          {view === "create-setup" && (
            <motion.div key="create-setup" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
              className="mx-auto max-w-[920px]">

              <button onClick={() => setView("entry")} className="mb-6 text-[13px] font-bold text-[#9CA3AF] hover:text-[#111] transition">
                ← Back
              </button>

              <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-5">
                <div className="rounded-3xl border border-[#E5E7EB] bg-white p-7"
                  style={{ boxShadow: "0 4px 32px rgba(0,0,0,0.05)" }}>
                  <h2 className="text-[22px] font-black text-[#111] mb-1" style={{ letterSpacing: "-0.5px" }}>Pick a focus</h2>
                  <p className="text-[13px] text-[#6B7280] mb-5">Both players get the exact same 5 questions</p>

                  <div className="grid grid-cols-2 gap-3 mb-6">
                    {TOPICS.map(t => (
                      <button key={t.key} onClick={() => setTopic(t.key)}
                        className={`relative rounded-2xl border-2 px-4 py-4 text-left transition-all ${
                          topic === t.key ? "border-[#111] bg-[#111]" : "border-[#E5E7EB] bg-white hover:border-[#D1D5DB]"
                        }`}>
                        <div className="flex h-9 w-9 items-center justify-center rounded-xl text-[17px] mb-2"
                          style={{ background: topic === t.key ? "rgba(255,255,255,0.1)" : t.bg }}>
                          {t.icon}
                        </div>
                        <p className={`text-[14px] font-black ${topic === t.key ? "text-white" : "text-[#111]"}`}>{t.label}</p>
                      </button>
                    ))}
                  </div>

                  {error && (
                    <div className="mb-4 rounded-xl border border-rose-100 bg-rose-50 px-4 py-3">
                      <p className="text-[13px] text-rose-700">{error}</p>
                    </div>
                  )}

                  <button onClick={createRoom} disabled={loading}
                    className="w-full rounded-2xl bg-[#111] py-4 text-[15px] font-black text-white hover:bg-[#333] transition disabled:opacity-50">
                    {loading ? (
                      <span className="flex items-center justify-center gap-2">
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                        Creating room...
                      </span>
                    ) : "Create challenge →"}
                  </button>
                </div>

                <div className="hidden lg:block rounded-3xl border border-[#E5E7EB] bg-white overflow-hidden">
                  <div className="px-6 pt-6 pb-5 border-b border-[#F3F4F6]" style={{ background: "linear-gradient(160deg, #FFFDF0 0%, #FFF9D6 100%)" }}>
                    <p className="text-[10px] font-black uppercase tracking-widest text-[#9CA3AF] mb-2">Preview</p>
                    <div className="flex items-center gap-2">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#111] text-[14px] font-black text-white">7.6</div>
                      <p className="text-[10px] text-[#9CA3AF]">vs</p>
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-yellow-400 text-[14px] font-black text-[#111]">7.4</div>
                    </div>
                    <p className="text-[12px] font-bold text-[#111] mt-3">You won by 0.2! 🏆</p>
                  </div>
                  <div className="px-6 py-5 space-y-3">
                    {[
                      { icon: "🎙️", t: "Answer 5 questions by voice" },
                      { icon: "🔗", t: "Get a 6-character room code" },
                      { icon: "📲", t: "Share it on WhatsApp" },
                      { icon: "📊", t: "See exactly where you each won" },
                    ].map(({ icon, t }) => (
                      <div key={t} className="flex items-center gap-3">
                        <span className="text-[16px]">{icon}</span>
                        <p className="text-[12px] text-[#374151] font-medium">{t}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* ── CODE READY ── */}
          {view === "code-ready" && room && (
            <motion.div key="code-ready" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
              className="mx-auto max-w-[480px] text-center">
              <div className="text-[44px] mb-3">🎯</div>
              <h1 className="text-[24px] font-black text-[#111] mb-2" style={{ letterSpacing: "-0.5px" }}>Room created!</h1>
              <p className="text-[14px] text-[#6B7280] mb-6">Share this code now, or answer the questions first — either way works.</p>

              <div className="rounded-3xl border-2 border-[#111] bg-white py-6 mb-3">
                <p className="text-[36px] font-black text-[#111] tracking-[0.3em]">{room.room_code}</p>
              </div>
              <button onClick={copyCode} className="mb-6 text-[13px] font-bold text-[#374151] hover:text-[#111] transition">
                {copied ? "✓ Copied!" : "Copy code"}
              </button>

              <button onClick={shareWhatsApp}
                className="w-full rounded-2xl bg-[#25D366] py-4 text-[14px] font-black text-white hover:opacity-90 transition flex items-center justify-center gap-2 mb-3">
                💬 Share on WhatsApp
              </button>
              <button onClick={() => setView("answering")}
                className="w-full rounded-2xl bg-[#111] py-4 text-[14px] font-black text-white hover:bg-[#333] transition mb-3">
                Answer the 5 questions →
              </button>
              <p className="text-[11px] text-[#9CA3AF]">Room expires in 7 days · your friend can join right now with this code</p>
            </motion.div>
          )}

          {/* ── ANSWERING ── */}
          {view === "answering" && room && (
            <motion.div key="answering" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mx-auto max-w-[480px]">
              <div className="flex items-center justify-between mb-4">
                <span className="text-[12px] font-black text-[#111]">Your turn</span>
                <span className="text-[12px] font-black text-[#9CA3AF]">{index + 1}/{room.questions.length}</span>
              </div>
              <div className="flex gap-1 mb-6">
                {room.questions.map((_, i) => (
                  <div key={i} className={`h-1.5 flex-1 rounded-full ${i < index ? "bg-[#111]" : i === index ? "bg-yellow-400" : "bg-[#F3F4F6]"}`} />
                ))}
              </div>

              <AnimatePresence mode="wait">
                <motion.div key={`${index}-${phase}`} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
                  {phase === "ask" && (
                    <div>
                      <div className="rounded-2xl bg-white border border-[#E5E7EB] p-5 mb-6">
                        <p className="text-[11px] font-black uppercase tracking-widest text-[#9CA3AF] mb-2">{room.questions[index].topic}</p>
                        <p className="text-[15px] text-[#111] font-medium leading-relaxed">{room.questions[index].question_text}</p>
                      </div>
                      <button onClick={startListening} className="w-full rounded-2xl bg-[#111] py-4 text-[14px] font-black text-white hover:bg-[#333] transition">
                        🎙️ Answer
                      </button>
                    </div>
                  )}
                  {phase === "listening" && (
                    <div>
                      <div className="rounded-2xl bg-white border border-[#E5E7EB] p-5 mb-4">
                        <Waveform />
                        <div className="min-h-[60px] text-[14px] text-[#374151] leading-relaxed">
                          {transcript || <span className="text-[#D1D5DB] italic">Start speaking...</span>}
                        </div>
                      </div>
                      <button onClick={submitAnswer} disabled={submitting}
                        className="w-full rounded-2xl bg-[#111] py-4 text-[14px] font-black text-white hover:bg-[#333] transition disabled:opacity-50">
                        {submitting ? "Submitting..." : "Done →"}
                      </button>
                    </div>
                  )}
                  {phase === "submitted" && (
                    <div className="text-center py-10">
                      <p className="text-[36px] mb-2">✓</p>
                      <p className="text-[14px] font-bold text-[#111]">Answer locked in</p>
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>
            </motion.div>
          )}

          {/* ── SHARE (after finishing all questions) ── */}
          {view === "share" && room && (
            <motion.div key="share" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
              className="mx-auto max-w-[480px] text-center">
              <div className="text-[44px] mb-3">✅</div>
              <h1 className="text-[24px] font-black text-[#111] mb-2" style={{ letterSpacing: "-0.5px" }}>All done!</h1>
              <p className="text-[14px] text-[#6B7280] mb-6">Share the code so your friend can answer the same questions</p>

              <div className="rounded-3xl border-2 border-[#111] bg-white py-6 mb-3">
                <p className="text-[36px] font-black text-[#111] tracking-[0.3em]">{room.room_code}</p>
              </div>
              <button onClick={copyCode} className="mb-6 text-[13px] font-bold text-[#374151] hover:text-[#111] transition">
                {copied ? "✓ Copied!" : "Copy code"}
              </button>

              <button onClick={shareWhatsApp}
                className="w-full rounded-2xl bg-[#25D366] py-4 text-[14px] font-black text-white hover:opacity-90 transition flex items-center justify-center gap-2 mb-3">
                💬 Share on WhatsApp
              </button>
              <Link href={`/peer/${room.room_code}`} className="block w-full rounded-2xl border-2 border-[#E5E7EB] bg-white py-3.5 text-center text-[14px] font-bold text-[#374151] hover:border-[#111] transition mb-3">
                View room status
              </Link>
              <p className="text-[11px] text-[#9CA3AF]">Room expires in 7 days</p>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}