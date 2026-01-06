"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";

export const dynamic = "force-dynamic";

/* ---------------- Types ---------------- */

type WSMessage =
  | {
      type: "agent_message";
      text: string;
      question_id?: number;
      done?: boolean;
      audio_url?: string;
    }
  | { type: "scoring_started"; turn_id: number; question_id?: number }
  | { type: "error"; message: string }
  | { type: string; [key: string]: any };

type TranscriptLine = {
  id: number;
  speaker: "agent" | "candidate";
  text: string;
};

let idCounter = 1;

const SHOW_DEBUG =
  process.env.NEXT_PUBLIC_SHOW_DEBUG === "true" ||
  process.env.NODE_ENV === "development";

/* ---------------- Component ---------------- */

export default function LiveInterviewPage() {
  const params = useParams();
  const router = useRouter();
  const interviewId = params.id as string;

  /* ---------- WebSocket ---------- */
  const wsRef = useRef<WebSocket | null>(null);

  /* ---------- State ---------- */
  const [connected, setConnected] = useState(false);
  const [started, setStarted] = useState(false);
  const [finished, setFinished] = useState(false);

  const [currentQuestionId, setCurrentQuestionId] = useState<number | null>(null);
  const [questionIndex, setQuestionIndex] = useState(1);

  const [transcript, setTranscript] = useState<TranscriptLine[]>([]);
  const [answerText, setAnswerText] = useState("");

  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<BlobPart[]>([]);

  const [isAgentSpeaking, setIsAgentSpeaking] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(false);

  const [log, setLog] = useState<string[]>([]);

  /* ---------- Timer ---------- */
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    if (!started || finished) return;
    const t = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [started, finished]);

  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");

  /* ---------- Helpers ---------- */

  function addTranscript(speaker: "agent" | "candidate", text: string) {
    setTranscript((t) => [...t, { id: idCounter++, speaker, text }]);
  }

  function appendLog(l: string) {
    setLog((x) => [...x, l]);
  }

  /* ---------- Audio ---------- */

  function enableAudioAndStart() {
    if (audioEnabled) return;
    setAudioEnabled(true);
    setStarted(true);
    appendLog("Audio enabled & interview started");
  }

  async function playAgentAudioOrTTS(m: any) {
    const text = m.text ?? "";

    if (m.audio_url) {
      try {
        const base = process.env.NEXT_PUBLIC_API_BASE || "";
        const audio = new Audio(
          m.audio_url.startsWith("http") ? m.audio_url : `${base}${m.audio_url}`,
        );
        setIsAgentSpeaking(true);
        await audio.play();
        setIsAgentSpeaking(false);
        return;
      } catch {
        /* fallback below */
      }
    }

    if ("speechSynthesis" in window) {
      const u = new SpeechSynthesisUtterance(text);
      u.onstart = () => setIsAgentSpeaking(true);
      u.onend = () => setIsAgentSpeaking(false);
      window.speechSynthesis.speak(u);
    }
  }

  /* ---------- WebSocket ---------- */

  useEffect(() => {
    if (!interviewId) return;

    const wsBase = process.env.NEXT_PUBLIC_WS_BASE || "ws://localhost:8000";
    const ws = new WebSocket(`${wsBase}/ws/interview/${interviewId}`);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      appendLog("WS connected");
    };

    ws.onclose = () => {
      setConnected(false);
      appendLog("WS closed");
    };

    ws.onmessage = (e) => {
      appendLog(`RAW_WS: ${e.data}`);
      const msg: WSMessage = JSON.parse(e.data);

      if (msg.type === "agent_message") {
        addTranscript("agent", msg.text);
        if (msg.question_id) {
          setCurrentQuestionId(msg.question_id);
          setQuestionIndex((i) => i + 1);
        }
        if (audioEnabled) playAgentAudioOrTTS(msg);
        if (msg.done) setFinished(true);
      }

      if (msg.type === "scoring_started") {
        /* no-op UI */
      }

      if (msg.type === "error") {
        addTranscript("agent", msg.message);
      }
    };

    return () => ws.close();
  }, [interviewId, audioEnabled]);

  /* ---------- Candidate Answer ---------- */

  function sendAnswer() {
    if (!wsRef.current || !currentQuestionId || !answerText.trim()) return;

    wsRef.current.send(
      JSON.stringify({
        type: "candidate_text",
        question_id: currentQuestionId,
        text: answerText.trim(),
      }),
    );

    addTranscript("candidate", answerText.trim());
    setAnswerText("");
  }

  async function startRecording() {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mr = new MediaRecorder(stream);
    audioChunksRef.current = [];
    mr.ondataavailable = (e) => audioChunksRef.current.push(e.data);
    mr.onstop = uploadAndTranscribe;
    mr.start();
    mediaRecorderRef.current = mr;
    setIsRecording(true);
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
  }

  async function uploadAndTranscribe() {
    if (!currentQuestionId) return;

    const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
    const fd = new FormData();
    fd.append("file", blob);
    fd.append("question_id", String(currentQuestionId));

    const api = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";
    const res = await fetch(`${api}/api/interview/${interviewId}/transcribe_audio`, {
      method: "POST",
      body: fd,
    });
    const data = await res.json();
    setAnswerText(data.transcript || "");
  }

  /* ---------------- UI ---------------- */

  return (
    <div className="h-screen flex flex-col bg-neutral-950 text-white">
      {/* TOP BAR */}
      <header className="h-14 px-6 flex items-center justify-between border-b border-neutral-800">
        <div className="font-semibold">AI Interview · Software Engineer</div>
        <div className="text-sm text-neutral-400">
          ⏱ {mm}:{ss} · Question {currentQuestionId ?? "—"}
        </div>
      </header>

      {/* MAIN */}
      <main className="flex-1 grid grid-cols-[1fr_360px]">
        {/* STAGE */}
        <section className="flex flex-col p-6 gap-4">
          {/* AI Interviewer */}
          <div className="flex items-center gap-4 bg-neutral-900 rounded-xl p-4">
            <img
              src="/avatar/interviewer.jpg"
              className="w-16 h-16 rounded-full"
              alt="AI"
            />
            <div>
              <div className="font-semibold">AI Interviewer</div>
              <div className="text-sm text-neutral-400">
                {isAgentSpeaking ? "Speaking…" : "Listening"}
              </div>
            </div>
          </div>

          {/* Candidate */}
          <div className="flex items-center gap-4 bg-neutral-900 rounded-xl p-4">
            <div className="w-16 h-16 rounded-full bg-neutral-700 flex items-center justify-center">
              You
            </div>
            <div>
              <div className="font-semibold">You</div>
              <div className="text-sm text-neutral-400">
                {isRecording ? "Recording…" : "Idle"}
              </div>
            </div>
          </div>

          {/* Transcript */}
          <div className="flex-1 overflow-auto bg-neutral-900 rounded-xl p-4 space-y-2 text-sm">
            {transcript.map((t) => (
              <div key={t.id}>
                <span className="text-neutral-400 mr-2">
                  {t.speaker === "agent" ? "Agent:" : "You:"}
                </span>
                {t.text}
              </div>
            ))}
          </div>
        </section>

        {/* SIDE PANEL */}
        <aside className="border-l border-neutral-800 p-4 flex flex-col gap-3">
          {!started && (
            <button
              onClick={enableAudioAndStart}
              className="bg-blue-600 hover:bg-blue-700 rounded-lg py-2 font-semibold"
            >
              Start Interview
            </button>
          )}

          <textarea
            rows={4}
            value={answerText}
            onChange={(e) => setAnswerText(e.target.value)}
            disabled={!currentQuestionId || finished}
            className="bg-neutral-900 rounded-lg p-2 text-sm"
            placeholder="Your answer…"
          />

          <div className="flex gap-2">
            <button
              onClick={sendAnswer}
              className="flex-1 bg-green-600 rounded-lg py-2"
            >
              Send
            </button>
            <button
              onClick={isRecording ? stopRecording : startRecording}
              className="bg-neutral-700 rounded-lg px-4"
            >
              🎙
            </button>
          </div>

          {SHOW_DEBUG && (
            <pre className="mt-4 text-xs text-neutral-400 overflow-auto">
              {log.join("\n")}
            </pre>
          )}
        </aside>
      </main>

      {/* BOTTOM BAR */}
      <footer className="h-14 border-t border-neutral-800 flex items-center justify-center gap-6">
        <button
          onClick={() => router.push("/dashboard")}
          className="bg-red-600 px-6 py-2 rounded-full"
        >
          Leave Interview
        </button>
      </footer>
    </div>
  );
}
