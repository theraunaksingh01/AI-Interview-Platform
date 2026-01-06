"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";

export const dynamic = "force-dynamic";

/* ===================== CONFIG ===================== */

const QUESTION_TIME_SEC = 5 * 60; // 5 minutes
const SHOW_DEBUG =
  process.env.NODE_ENV === "development" ||
  process.env.NEXT_PUBLIC_SHOW_DEBUG === "true";

/* ===================== TYPES ===================== */

type WSMessage =
  | {
      type: "agent_message";
      text: string;
      question_id?: number;
      done?: boolean;
      audio_url?: string;
    }
  | { type: "scoring_started" }
  | { type: "error"; message: string };

type AgentMessage = {
  type: "agent_message";
  text: string;
  question_id?: number;
  audio_url?: string;
  done?: boolean;
};


type Phase = "idle" | "agent" | "candidate";

/* ===================== COMPONENT ===================== */

export default function LiveInterviewPage() {
  const { id: interviewId } = useParams();
  const router = useRouter();

  /* ---------- Core state ---------- */

  const wsRef = useRef<WebSocket | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<BlobPart[]>([]);
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);

  const [started, setStarted] = useState(false);
  const [connected, setConnected] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [agentText, setAgentText] = useState("");
  const [displayText, setDisplayText] = useState("");
  const [currentQuestion, setCurrentQuestion] = useState<number | null>(null);
  const [timeLeft, setTimeLeft] = useState(QUESTION_TIME_SEC);
  const [log, setLog] = useState<string[]>([]);

  /* ===================== HELPERS ===================== */

  function appendLog(s: string) {
    setLog((p) => [...p, s]);
  }

  /* ===================== AUDIO ===================== */

  function speakViaBrowser(text: string) {
    return new Promise<void>((resolve) => {
      const u = new SpeechSynthesisUtterance(text);
      u.rate = 1;
      u.pitch = 1;
      u.onend = () => resolve();
      speechSynthesis.speak(u);
    });
  }

  async function playAgent(m: AgentMessage) {

    setPhase("agent");
    setAgentText(m.text);
    setDisplayText("");

    // typing effect
    const words = m.text.split(" ");
    for (let i = 0; i < words.length; i++) {
      setDisplayText((p) => (p ? p + " " : "") + words[i]);
      await new Promise((r) => setTimeout(r, 120));
    }

    if (m.audio_url) {
      const base = process.env.NEXT_PUBLIC_API_BASE || "";
      const audio = new Audio(
        m.audio_url.startsWith("http") ? m.audio_url : base + m.audio_url,
      );
      await audio.play();
    } else {
      await speakViaBrowser(m.text);
    }

    if (m.question_id) {
      startCandidateTurn(m.question_id);
    }
  }

  /* ===================== RECORDING ===================== */

  async function startCandidateTurn(qid: number) {
    setPhase("candidate");
    setCurrentQuestion(qid);
    setTimeLeft(QUESTION_TIME_SEC);

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mr = new MediaRecorder(stream);
    mediaRecorderRef.current = mr;
    audioChunksRef.current = [];

    mr.ondataavailable = (e) => audioChunksRef.current.push(e.data);

    mr.onstop = () => {
      stream.getTracks().forEach((t) => t.stop());
      submitAudio();
    };

    mr.start();

    silenceTimerRef.current = setTimeout(stopRecording, QUESTION_TIME_SEC * 1000);
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop();
  }

  async function submitAudio() {
    const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
    const fd = new FormData();
    fd.append("file", blob);
    fd.append("question_id", String(currentQuestion));

    const api = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";
    await fetch(`${api}/api/interview/${interviewId}/transcribe_audio`, {
      method: "POST",
      body: fd,
    });
  }

  /* ===================== TIMER ===================== */

  useEffect(() => {
    if (phase !== "candidate") return;
    const t = setInterval(() => {
      setTimeLeft((p) => {
        if (p <= 1) {
          stopRecording();
          return 0;
        }
        return p - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [phase]);

  /* ===================== WEBSOCKET ===================== */

  function startInterview() {
    setStarted(true);

    const wsBase = process.env.NEXT_PUBLIC_WS_BASE || "ws://localhost:8000";
    const ws = new WebSocket(`${wsBase}/ws/interview/${interviewId}`);
    wsRef.current = ws;

    ws.onopen = () => setConnected(true);

    ws.onmessage = async (e) => {
      const msg: WSMessage = JSON.parse(e.data);
      appendLog(e.data);

      if (msg.type === "agent_message") {
        const agentMsg: AgentMessage = msg;
        await playAgent(agentMsg);
      }


      if (msg.type === "error") {
        alert(msg.message);
      }
    };
  }

  /* ===================== UI ===================== */

  return (
    <div className="full-bleed h-screen grid grid-cols-[1fr_320px] bg-gray-100">
      {/* LEFT: STAGE */}
      <div className="flex flex-col p-6 gap-4">
        {/* HEADER */}
        <div className="flex items-center gap-4">
          <img src="/avatar/interviewer.jpg" className="w-14 h-14 rounded-full" />
          <div>
            <div className="font-semibold text-lg">AI Interviewer</div>
            <div className="text-sm text-gray-500">
              {phase === "agent"
                ? "Interviewer speaking"
                : phase === "candidate"
                ? "Your turn"
                : "Waiting"}
            </div>
          </div>

          {phase === "candidate" && (
            <div className="ml-auto font-mono text-lg">
              ⏱ {Math.floor(timeLeft / 60)}:
              {(timeLeft % 60).toString().padStart(2, "0")}
            </div>
          )}
        </div>

        {/* CONTENT */}
        <div className="flex-1 rounded-xl bg-white p-6 text-lg shadow">
          {!started && (
            <button
              onClick={startInterview}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg"
            >
              Start Interview
            </button>
          )}

          {started && (
            <>
              <div className="font-semibold mb-2">Interviewer</div>
              <div className="text-gray-800">{displayText}</div>

              {phase === "candidate" && (
                <div className="mt-6 text-sm text-gray-500">
                  🎙 Recording… speak your answer naturally
                </div>
              )}
            </>
          )}
        </div>

        {/* FOOTER */}
        <div className="flex justify-between">
          <button
            onClick={() => router.push("/")}
            className="text-sm text-red-600"
          >
            Leave interview
          </button>
        </div>
      </div>

      {/* RIGHT: STATUS */}
      <aside className="border-l bg-white p-4">
        <h3 className="font-semibold mb-2">Interview Status</h3>
        <p>Status: {connected ? "Connected" : "Connecting…"}</p>
        <p>Question: {currentQuestion ?? "—"}</p>

        {SHOW_DEBUG && (
          <pre className="mt-4 text-xs bg-black text-green-400 p-2 h-64 overflow-auto">
            {log.join("\n")}
          </pre>
        )}
      </aside>
    </div>
  );
}
