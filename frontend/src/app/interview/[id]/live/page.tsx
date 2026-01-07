"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";

/* ---------------- Types ---------------- */

type WSMessage =
  | {
      type: "agent_message";
      text: string;
      question_id?: number;
      audio_url?: string;
      done?: boolean;
    }
  | {
      type: "scoring_started";
      turn_id: number;
      question_id?: number;
    }
  | { type: "error"; message: string };

export default function LiveInterviewPage() {
  const { id } = useParams();
  const interviewId = id as string;

  /* ---------------- Refs ---------------- */

  const wsRef = useRef<WebSocket | null>(null);
  const candidateVideoRef = useRef<HTMLVideoElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  /* ---------------- State ---------------- */

  const [connected, setConnected] = useState(false);
  const [questionText, setQuestionText] = useState("");
  const [questionId, setQuestionId] = useState<number | null>(null);

  const [agentSpeaking, setAgentSpeaking] = useState(false);
  const [candidateSpeaking, setCandidateSpeaking] = useState(false);

  const [secondsLeft, setSecondsLeft] = useState(300);

  // 🔥 Phase 6D-7
  const [liveTranscript, setLiveTranscript] = useState("");
  const [partialTranscript, setPartialTranscript] = useState("");
  const [confidence, setConfidence] =
    useState<"listening" | "speaking" | "paused">("listening");

  /* ---------------- Restore Camera ---------------- */

  useEffect(() => {
    navigator.mediaDevices
      .getUserMedia({ video: true, audio: true })
      .then((stream) => {
        if (candidateVideoRef.current) {
          candidateVideoRef.current.srcObject = stream;
        }
      });
  }, []);

  /* ---------------- Timer ---------------- */

  useEffect(() => {
    if (!questionId) return;

    setSecondsLeft(300);
    const t = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          stopRecordingAndSubmit();
          clearInterval(t);
          return 0;
        }
        return s - 1;
      });
    }, 1000);

    return () => clearInterval(t);
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

        // 🔥 Start candidate turn AFTER agent finishes
        if (msg.question_id) {
          startCandidateTurn();
        }
      }
    };

    return () => ws.close();
  }, [interviewId]);

  /* ---------------- Agent Speech ---------------- */

  async function playAgentSpeech(msg: {
    text: string;
    audio_url?: string;
  }) {
    setAgentSpeaking(true);
    setCandidateSpeaking(false);

    if (msg.audio_url) {
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

  /* ---------------- Candidate Recording (6D-7) ---------------- */

  function startCandidateTurn() {
    if (!questionId) return;

    setCandidateSpeaking(true);
    setConfidence("listening");
    setLiveTranscript("");
    setPartialTranscript("");

    navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => {
      const mr = new MediaRecorder(stream);
      audioChunksRef.current = [];

      mr.ondataavailable = async (e) => {
        if (e.data.size === 0) return;

        audioChunksRef.current.push(e.data);
        setConfidence("speaking");

        await sendPartialChunk(e.data);
      };

      mr.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        setCandidateSpeaking(false);
      };

      mr.start(2000); // every 2 seconds
      mediaRecorderRef.current = mr;
    });
  }

  async function sendPartialChunk(blob: Blob) {
    if (!questionId) return;

    const fd = new FormData();
    fd.append("file", blob, "chunk.webm");
    fd.append("question_id", String(questionId));
    fd.append("partial", "true");

    const api = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";

    const res = await fetch(
      `${api}/api/interview/${interviewId}/transcribe_audio`,
      {
        method: "POST",
        body: fd,
      },
    );

    if (!res.ok) return;

    const data = await res.json();

    if (data.transcript) {
      setPartialTranscript(data.transcript);
      setLiveTranscript((prev) => prev + " " + data.transcript);
    }
  }

  async function stopRecordingAndSubmit() {
    if (!questionId) return;

    const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
    const fd = new FormData();
    fd.append("file", blob, "answer.webm");
    fd.append("question_id", String(questionId));

    await fetch(
      `${process.env.NEXT_PUBLIC_API_BASE}/api/interview/${interviewId}/transcribe_audio`,
      { method: "POST", body: fd },
    );

    setCandidateSpeaking(false);
  }

  /* ---------------- Pause Detection ---------------- */

  useEffect(() => {
    if (!candidateSpeaking) return;

    const t = setTimeout(() => {
      setConfidence("paused");
    }, 4000);

    return () => clearTimeout(t);
  }, [partialTranscript, candidateSpeaking]);

  /* ---------------- UI ---------------- */

  return (
    <div className="grid grid-cols-[1fr_360px] h-screen bg-gray-100">
      {/* LEFT */}
      <div className="p-6 flex flex-col gap-4">
        <header className="flex items-center gap-3">
          <img src="/avatar/interviewer.jpg" className="w-12 h-12 rounded-full" />
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

          {/* 🔥 Live Transcription */}
          {candidateSpeaking && (
            <div className="mt-6 bg-gray-50 rounded-xl p-4">
              <div className="text-xs text-gray-500 mb-2">
                Live transcription
              </div>
              <div className="text-gray-900 leading-relaxed">
                {liveTranscript}
                <span className="opacity-60"> {partialTranscript}</span>
              </div>
              <div className="mt-2 text-xs">
                {confidence === "speaking" && "🟢 Speaking clearly"}
                {confidence === "listening" && "🎙 Listening…"}
                {confidence === "paused" && "🟡 Pause detected"}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* RIGHT */}
      <aside className="bg-gray-900 text-white p-4 flex flex-col gap-4">
        <div className="bg-gray-800 rounded-xl p-3 text-center">
          <img
            src="/avatar/interviewer.jpg"
            className={`mx-auto w-32 h-32 rounded-full ${
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
      </aside>
    </div>
  );
}
