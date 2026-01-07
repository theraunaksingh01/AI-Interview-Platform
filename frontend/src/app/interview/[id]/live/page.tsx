"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";

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
  | {
      type: "scoring_started";
      turn_id: number;
      question_id?: number;
    }
  | { type: "error"; message: string };

/* ---------------- Component ---------------- */

export default function LiveInterviewPage() {
  const { id } = useParams();
  const interviewId = id as string;

  /* ---------------- State ---------------- */

  const wsRef = useRef<WebSocket | null>(null);

  const [connected, setConnected] = useState(false);
  const [questionText, setQuestionText] = useState("");
  const [questionId, setQuestionId] = useState<number | null>(null);

  const [agentSpeaking, setAgentSpeaking] = useState(false);
  const [candidateSpeaking, setCandidateSpeaking] = useState(false);

  const [secondsLeft, setSecondsLeft] = useState(300);
  const [mediaEnabled, setMediaEnabled] = useState(false);

  /* ---------------- Media ---------------- */

  const candidateVideoRef = useRef<HTMLVideoElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  /* ---------------- Enable Camera + Mic ---------------- */

  async function enableMedia() {
  if (mediaEnabled) return;

  // 🔓 REQUIRED: unlock audio playback
  const AudioContext =
    window.AudioContext || (window as any).webkitAudioContext;
  const ctx = new AudioContext();
  await ctx.resume();

  // 🔓 Required for <audio>.play()
  const silentAudio = new Audio();
  silentAudio.src =
    "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YQAAAAA=";
  await silentAudio.play().catch(() => {});

  // 🎥 Request real media AFTER unlocking audio
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: true,
    video: true,
  });

  if (candidateVideoRef.current) {
    candidateVideoRef.current.srcObject = stream;
  }

  setMediaEnabled(true);
}


  /* ---------------- Timer ---------------- */

  useEffect(() => {
    if (!questionId) return;

    setSecondsLeft(300);

    const timer = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          stopRecordingAndSubmit();
          clearInterval(timer);
          return 0;
        }
        return s - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [questionId]);

  /* ---------------- WebSocket ---------------- */

  useEffect(() => {
    const ws = new WebSocket(
      `${process.env.NEXT_PUBLIC_WS_BASE ?? "ws://localhost:8000"}/ws/interview/${interviewId}`,
    );

    wsRef.current = ws;

    ws.onopen = () => setConnected(true);

    ws.onmessage = async (e) => {
      const msg: WSMessage = JSON.parse(e.data);

      if (msg.type === "agent_message") {
        setQuestionText(msg.text);
        setQuestionId(msg.question_id ?? null);

        await playAgentSpeech(msg);
        startCandidateTurn();
      }
    };

    return () => ws.close();
  }, [interviewId]);

  /* ---------------- Agent Speech ---------------- */

  async function playAgentSpeech(msg: WSMessage & { text: string }) {
    setAgentSpeaking(true);
    setCandidateSpeaking(false);

    if ("audio_url" in msg && msg.audio_url) {
      const audio = new Audio(
        msg.audio_url.startsWith("http")
          ? msg.audio_url
          : `${process.env.NEXT_PUBLIC_API_BASE}${msg.audio_url}`,
      );
      await audio.play();
    } else {
      const u = new SpeechSynthesisUtterance(msg.text);
      await new Promise<void>((res) => {
        u.onend = () => res();
        speechSynthesis.speak(u);
      });
    }

    setAgentSpeaking(false);
  }

  /* ---------------- Candidate Recording ---------------- */

  function startCandidateTurn() {
    setCandidateSpeaking(true);

    navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => {
      const mr = new MediaRecorder(stream);
      audioChunksRef.current = [];

      mr.ondataavailable = (e) => audioChunksRef.current.push(e.data);
      mr.onstop = stopRecordingAndSubmit;

      mr.start();
      mediaRecorderRef.current = mr;

      // Auto-stop after silence window
      setTimeout(() => {
        if (mr.state === "recording") mr.stop();
      }, 15000);
    });
  }

  async function stopRecordingAndSubmit() {
    if (!questionId || audioChunksRef.current.length === 0) return;

    const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });

    const fd = new FormData();
    fd.append("file", blob, "answer.webm");
    fd.append("question_id", String(questionId));

    const apiBase =
      process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";

    const res = await fetch(
      `${apiBase}/api/interview/${interviewId}/transcribe_audio`,
      {
        method: "POST",
        body: fd,
      },
    );

    if (!res.ok) {
      console.error("ASR failed", await res.text());
      return;
    }

    const data = await res.json();

    wsRef.current?.send(
      JSON.stringify({
        type: "candidate_text",
        question_id: questionId,
        text: data.transcript,
      }),
    );

    setCandidateSpeaking(false);
  }

  /* ---------------- UI ---------------- */

  return (
    <div className="grid grid-cols-[1fr_360px] h-screen bg-gray-50">
      {/* LEFT — Interview */}
      <div className="flex flex-col p-6 gap-4">
        <header className="flex items-center gap-3">
          <img
            src="/avatar/interviewer.jpg"
            className="w-12 h-12 rounded-full"
          />
          <div>
            <div className="font-semibold">AI Interviewer</div>
            <div className="text-xs text-gray-500">
              {agentSpeaking
                ? "Speaking…"
                : candidateSpeaking
                ? "Your turn"
                : "Listening"}
            </div>
          </div>

          <div className="ml-auto font-mono">
            ⏱ {Math.floor(secondsLeft / 60)}:
            {String(secondsLeft % 60).padStart(2, "0")}
          </div>
        </header>

        <div className="bg-white rounded-xl p-6 shadow flex-1">
          <div className="text-gray-500 mb-2">Interviewer</div>
          <div className="text-lg font-medium">{questionText}</div>
          {candidateSpeaking && (
            <div className="mt-4 text-blue-600">
              🎙 Recording… speak naturally
            </div>
          )}
        </div>
      </div>

      {/* RIGHT — Video Panel */}
      <aside className="bg-gray-900 text-white flex flex-col gap-4 p-4">
        <div className="bg-gray-800 rounded-xl p-3 flex flex-col items-center">
          <img
            src="/avatar/interviewer.jpg"
            className={`w-32 h-32 rounded-full ${
              agentSpeaking ? "ring-4 ring-green-400" : ""
            }`}
          />
          <div className="mt-2 text-sm">AI Interviewer</div>
        </div>

        <div className="bg-black rounded-xl overflow-hidden flex-1">
          <video
            ref={candidateVideoRef}
            autoPlay
            muted
            playsInline
            className="w-full h-full object-cover"
          />
        </div>

        {!mediaEnabled && (
          <button
            onClick={enableMedia}
            className="bg-blue-600 hover:bg-blue-700 py-2 rounded"
          >
            Enable camera & mic
          </button>
        )}
      </aside>
    </div>
  );
}
