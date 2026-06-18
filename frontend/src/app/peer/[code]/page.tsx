"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
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
  difficulty: string;
};

type RoomInfo = {
  room_id: string;
  room_code: string;
  is_creator: boolean;
  creator_name: string;
  questions: Question[];
  my_answered_count: number;
  my_answered_indices: number[];
  total_questions: number;
  other_participant_exists: boolean;
  other_progress: number;
  expires_at: string;
};

type ComparisonQuestion = {
  question_index: number;
  concept_name: string;
  topic: string;
  question_text: string;
  a_score: number;
  b_score: number;
  a_edge: string;
  b_edge: string;
  combined_insight: string;
};

type ComparisonData = {
  ready: boolean;
  my_answered_count?: number;
  total_questions?: number;
  waiting_message?: string;
  you_name?: string;
  them_name?: string;
  you_score?: number;
  them_score?: number;
  result?: "win" | "loss" | "draw";
  questions?: ComparisonQuestion[];
  key_learning?: string;
};

type ViewState = "loading" | "intro" | "answering" | "waiting" | "comparison" | "error";

function Waveform({ color = "#111" }: { color?: string }) {
  return (
    <>
      <div className="flex items-end justify-center gap-1 h-12 mb-2">
        {Array.from({ length: 24 }).map((_, i) => (
          <div key={i} className="w-1 rounded-full" style={{
            height: `${20 + Math.random() * 80}%`,
            background: color,
            animationName: "peerPulse2",
            animationDuration: `${0.4 + Math.random() * 0.7}s`,
            animationTimingFunction: "ease-in-out",
            animationIterationCount: "infinite",
            animationDirection: "alternate",
            animationDelay: `${i * 0.03}s`,
          }} />
        ))}
      </div>
      <style>{`@keyframes peerPulse2 { from { opacity: 0.25; } to { opacity: 1; } }`}</style>
    </>
  );
}

function scoreColor(score: number) {
  if (score >= 7) return "#10B981";
  if (score >= 5) return "#F59E0B";
  return "#EF4444";
}

export default function PeerRoomPage() {
  const { code } = useParams() as { code: string };
  const { user, authHeader } = useAuth();
  const [view, setView] = useState<ViewState>("loading");
  const [room, setRoom] = useState<RoomInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<"ask" | "listening" | "submitted">("ask");
  const [transcript, setTranscript] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [comparison, setComparison] = useState<ComparisonData | null>(null);
  const [polling, setPolling] = useState(false);

  const loadRoom = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/peer/room/${code}`, { headers: authHeader() });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.detail || "Room not found");
      setRoom(data);

      if (data.my_answered_count >= data.total_questions) {
        checkComparison();
      } else {
        setIndex(data.my_answered_count);
        setView(data.my_answered_count === 0 ? "intro" : "answering");
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load room");
      setView("error");
    }
  }, [code, authHeader]);

  const checkComparison = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/peer/room/${code}/comparison`, { headers: authHeader() });
      const data = await res.json();
      setComparison(data);
      if (data.ready) {
        setView("comparison");
        setPolling(false);
      } else {
        setView("waiting");
        setPolling(true);
      }
    } catch {
      setView("waiting");
    }
  }, [code, authHeader]);

  useEffect(() => {
    if (user) loadRoom();
  }, [user, loadRoom]);

  useEffect(() => {
    if (!polling) return;
    const interval = setInterval(checkComparison, 5000);
    return () => clearInterval(interval);
  }, [polling, checkComparison]);

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
    (window as any).__peerRecognition2 = recognition;
  }

  async function submitAnswer() {
    if (!room) return;
    if ((window as any).__peerRecognition2) (window as any).__peerRecognition2.stop();
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/api/peer/room/${code}/answer`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader() },
        body: JSON.stringify({ question_index: index, transcript }),
      });
      const data = await res.json();
      setPhase("submitted");
      setTimeout(() => {
        if (data.all_done) {
          checkComparison();
        } else {
          setIndex(i => i + 1);
          setPhase("ask");
          setTranscript("");
          setView("answering");
        }
      }, 1200);
    } catch {
      // allow retry
    } finally {
      setSubmitting(false);
    }
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#FAFAF8] flex items-center justify-center px-6">
        <div className="text-center max-w-[400px]">
          <div className="text-[52px] mb-5">⚔️</div>
          <h1 className="text-[24px] font-black text-[#111] mb-2" style={{ letterSpacing: "-0.5px" }}>
            You&apos;ve been challenged!
          </h1>
          <p className="text-[14px] text-[#6B7280] mb-6">Sign in or create an account to accept and answer the questions.</p>
          <div className="flex gap-3 justify-center">
            <Link href={`/login?redirect=/peer/${code}`} className="rounded-xl bg-[#111] px-6 py-3 text-[13px] font-black text-white hover:bg-[#333] transition">Sign in</Link>
            <Link href={`/signup?redirect=/peer/${code}`} className="rounded-xl border border-[#E5E7EB] bg-white px-6 py-3 text-[13px] font-medium text-[#374151] hover:bg-[#F9FAFB] transition">Sign up</Link>
          </div>
        </div>
      </div>
    );
  }

  if (view === "loading") {
    return (
      <div className="min-h-screen bg-[#FAFAF8] flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-3 border-gray-200 border-t-[#111]" />
      </div>
    );
  }

  if (view === "error") {
    return (
      <div className="min-h-screen bg-[#FAFAF8] flex items-center justify-center px-6">
        <div className="text-center max-w-[400px]">
          <div className="text-[44px] mb-3">😕</div>
          <p className="text-[16px] font-bold text-[#111] mb-2">{error}</p>
          <Link href="/peer" className="text-[13px] font-bold text-[#374151] hover:text-[#111] transition">Create your own challenge →</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAFAF8]">
      <main className="pt-[88px] pb-20 px-4 sm:px-6">
        <div className="mx-auto max-w-[520px]">

          {view === "intro" && room && (
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="text-center">
              <div className="text-[44px] mb-3">⚔️</div>
              <h1 className="text-[24px] font-black text-[#111] mb-2" style={{ letterSpacing: "-0.5px" }}>
                {room.creator_name} challenged you!
              </h1>
              <p className="text-[14px] text-[#6B7280] mb-8 leading-relaxed">
                Same {room.total_questions} questions, same scoring. Let&apos;s see who does better.
              </p>
              <button onClick={() => setView("answering")}
                className="w-full rounded-2xl bg-[#111] py-4 text-[15px] font-black text-white hover:bg-[#333] transition">
                Accept challenge →
              </button>
            </motion.div>
          )}

          {view === "answering" && room && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <div className="flex items-center justify-between mb-4">
                <span className="text-[12px] font-black text-[#111]">vs {room.creator_name}</span>
                <span className="text-[12px] font-black text-[#9CA3AF]">{index + 1}/{room.total_questions}</span>
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

          {view === "waiting" && (
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="text-center py-10">
              <div className="mx-auto mb-5 h-10 w-10 animate-pulse rounded-full bg-yellow-100 flex items-center justify-center text-[20px]">⏳</div>
              <p className="text-[16px] font-bold text-[#111] mb-1">You&apos;re done!</p>
              <p className="text-[13px] text-[#9CA3AF] mb-1">{comparison?.waiting_message}</p>
              <p className="text-[11px] text-[#D1D5DB]">Checking automatically every few seconds...</p>
            </motion.div>
          )}

          {view === "comparison" && comparison?.ready && (
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
              {/* Result header */}
              <div className="text-center mb-6">
                <p className="text-[44px] mb-2">
                  {comparison.result === "win" ? "🏆" : comparison.result === "draw" ? "🤝" : "💪"}
                </p>
                <h1 className="text-[24px] font-black text-[#111]" style={{ letterSpacing: "-0.5px" }}>
                  {comparison.result === "win" ? "You won!" : comparison.result === "draw" ? "It's a draw!" : "Close one!"}
                </h1>
              </div>

              {/* Score comparison */}
              <div className="rounded-3xl border border-[#E5E7EB] bg-white p-6 mb-4">
                <div className="flex items-center justify-between">
                  <div className="text-center flex-1">
                    <p className="text-[28px] font-black" style={{ color: scoreColor(comparison.you_score || 0) }}>{comparison.you_score}</p>
                    <p className="text-[12px] font-bold text-[#111] mt-1">{comparison.you_name}</p>
                    <p className="text-[10px] text-[#9CA3AF]">You</p>
                  </div>
                  <p className="text-[20px] text-[#D1D5DB] font-black px-4">vs</p>
                  <div className="text-center flex-1">
                    <p className="text-[28px] font-black" style={{ color: scoreColor(comparison.them_score || 0) }}>{comparison.them_score}</p>
                    <p className="text-[12px] font-bold text-[#111] mt-1">{comparison.them_name}</p>
                    <p className="text-[10px] text-[#9CA3AF]">Them</p>
                  </div>
                </div>
              </div>

              {/* Key learning */}
              {comparison.key_learning && (
                <div className="rounded-2xl bg-[#111] p-5 mb-4">
                  <p className="text-[11px] font-black uppercase tracking-widest text-[#555] mb-2">Key takeaway</p>
                  <p className="text-[13px] text-white leading-relaxed">{comparison.key_learning}</p>
                </div>
              )}

              {/* Per-question breakdown */}
              <p className="text-[11px] font-black uppercase tracking-widest text-[#9CA3AF] mb-3 px-1">Question by question</p>
              <div className="space-y-3">
                {comparison.questions?.map((q, i) => (
                  <div key={i} className="rounded-2xl border border-[#E5E7EB] bg-white p-4">
                    <p className="text-[10px] font-black uppercase tracking-widest text-[#D1D5DB] mb-1">Q{i + 1} · {q.topic}</p>
                    <p className="text-[13px] font-bold text-[#111] mb-3">{q.concept_name}</p>
                    <div className="flex items-center gap-3 mb-3">
                      <div className="flex-1 text-center rounded-xl py-2" style={{ background: scoreColor(q.a_score) + "10" }}>
                        <p className="text-[16px] font-black" style={{ color: scoreColor(q.a_score) }}>{q.a_score}</p>
                        <p className="text-[9px] text-[#9CA3AF]">You</p>
                      </div>
                      <div className="flex-1 text-center rounded-xl py-2" style={{ background: scoreColor(q.b_score) + "10" }}>
                        <p className="text-[16px] font-black" style={{ color: scoreColor(q.b_score) }}>{q.b_score}</p>
                        <p className="text-[9px] text-[#9CA3AF]">Them</p>
                      </div>
                    </div>
                    <p className="text-[11px] text-[#6B7280] leading-relaxed">{q.combined_insight}</p>
                  </div>
                ))}
              </div>

              <div className="flex flex-col sm:flex-row gap-2.5 mt-6">
                <Link href="/peer" className="flex-1 block rounded-2xl bg-[#111] py-3.5 text-center text-[14px] font-black text-white hover:bg-[#333] transition">
                  Challenge someone else →
                </Link>
                <Link href="/mock/dashboard" className="flex-1 block rounded-2xl border-2 border-[#E5E7EB] bg-white py-3.5 text-center text-[14px] font-bold text-[#374151] hover:border-[#111] transition">
                  Back to dashboard
                </Link>
              </div>
            </motion.div>
          )}
        </div>
      </main>
    </div>
  );
}