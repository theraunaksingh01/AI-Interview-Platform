"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { useBrowserASR } from "@/hooks/useBrowserASR";

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
      type: "ai_interrupt";
      text: string;
      reason?: string;
    }
  | {
      type: "live_signal";
      question_id: number;
      confidence: "low" | "medium" | "high";
      word_count: number;
    }
  | {
      type: "error";
      message: string;
    };

export default function LiveInterviewPage() {
  const { id } = useParams();
  const interviewId = id as string;

  /* ---------------- Refs ---------------- */

  const wsRef = useRef<WebSocket | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const candidateVideoRef = useRef<HTMLVideoElement | null>(null);

  const agentAudioRef = useRef<HTMLAudioElement | null>(null);
  const audioQueueRef = useRef<string[]>([]);
  const isPlayingRef = useRef(false);

  const currentQuestionIdRef = useRef<number | null>(null);

  /* ---------------- State ---------------- */

  const [questionText, setQuestionText] = useState("");
  const [agentSpeaking, setAgentSpeaking] = useState(false);
  const [candidateSpeaking, setCandidateSpeaking] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(300);

  const [answerConfidence, setAnswerConfidence] =
    useState<"low" | "medium" | "high" | null>(null);

  /* ---------------- Browser ASR ---------------- */

  const {
    transcript: browserTranscript,
    listening: asrListening,
    resetTranscript,
  } = useBrowserASR({
    enabled: candidateSpeaking,
  });

  /* ---------------- Camera ---------------- */

  useEffect(() => {
    navigator.mediaDevices
      .getUserMedia({ video: true })
      .then((stream) => {
        if (candidateVideoRef.current) {
          candidateVideoRef.current.srcObject = stream;
        }
      })
      .catch(() => {});
  }, []);

  /* ---------------- Timer (FIXED) ---------------- */

  useEffect(() => {
    if (!candidateSpeaking) return;

    setSecondsLeft(300);
    const t = setInterval(() => {
      setSecondsLeft((s) => Math.max(0, s - 1));
    }, 1000);

    return () => clearInterval(t);
  }, [candidateSpeaking]);

  /* ---------------- WebSocket ---------------- */

  useEffect(() => {
    const ws = new WebSocket(
      `${process.env.NEXT_PUBLIC_WS_BASE ?? "ws://localhost:8000"}/ws/interview/${interviewId}`
    );
    wsRef.current = ws;

    ws.onmessage = (e) => {
      const msg: WSMessage = JSON.parse(e.data);

      /* 🟢 Normal agent message */
      if (msg.type === "agent_message") {
        setQuestionText(msg.text);

        if (msg.audio_url) enqueueAgentAudio(msg.audio_url);

        if (typeof msg.question_id === "number") {
          currentQuestionIdRef.current = msg.question_id;
        }
        return;
      }

      /* 🔴 AI interrupt (ADVISORY ONLY) */
      if (msg.type === "ai_interrupt") {
        console.log("[AI INTERRUPT]", msg.reason ?? "unknown");

        // ❌ DO NOT stop recorder
        // ❌ DO NOT stop timer
        // ❌ DO NOT change candidateSpeaking

        setQuestionText(msg.text);
        return;
      }

      /* 🟡 Live confidence signal */
      if (msg.type === "live_signal") {
        setAnswerConfidence(msg.confidence);
        return;
      }

      if (msg.type === "error") {
        console.error("[WS ERROR]", msg.message);
      }
    };

    return () => ws.close();
  }, [interviewId]);

  /* ---------------- Send live text ---------------- */

  useEffect(() => {
    if (!candidateSpeaking) return;
    if (!browserTranscript) return;
    if (!currentQuestionIdRef.current) return;

    fetch(
      `${process.env.NEXT_PUBLIC_API_BASE}/api/interview/${interviewId}/live_text`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question_id: currentQuestionIdRef.current,
          text: browserTranscript,
        }),
      }
    ).catch(() => {});
  }, [browserTranscript]);

  /* ---------------- Agent Audio ---------------- */

  function enqueueAgentAudio(audioUrl: string) {
    const fullUrl = audioUrl.startsWith("http")
      ? audioUrl
      : `${process.env.NEXT_PUBLIC_API_BASE}${audioUrl}`;

    audioQueueRef.current.push(fullUrl);
    tryPlayNextAudio();
  }

  function tryPlayNextAudio() {
    if (!agentAudioRef.current) return;
    if (isPlayingRef.current) return;

    if (audioQueueRef.current.length === 0) {
      startCandidateTurn();
      return;
    }

    const audio = agentAudioRef.current;
    const src = audioQueueRef.current.shift()!;

    isPlayingRef.current = true;
    setAgentSpeaking(true);
    setCandidateSpeaking(false);

    audio.src = src;
    audio.onended = finishAgentAudio;
    audio.onerror = finishAgentAudio;

    audio.play().catch(finishAgentAudio);
  }

  function finishAgentAudio() {
    isPlayingRef.current = false;
    setAgentSpeaking(false);
    tryPlayNextAudio();
  }

  /* ---------------- Candidate Recording ---------------- */

  function startCandidateTurn() {
    if (!currentQuestionIdRef.current) return;

    resetTranscript();
    setCandidateSpeaking(true);

    navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => {
      const mr = new MediaRecorder(stream, { mimeType: "audio/webm" });

      mr.ondataavailable = async (e) => {
        if (!e.data || e.data.size === 0) return;

        const form = new FormData();
        form.append("file", e.data, "chunk.webm");
        form.append("question_id", String(currentQuestionIdRef.current));
        form.append("partial", "true");

        await fetch(
          `${process.env.NEXT_PUBLIC_API_BASE}/api/interview/${interviewId}/transcribe_audio`,
          { method: "POST", body: form }
        );
      };

      mr.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        setCandidateSpeaking(false);
      };

      mr.start(2000);
      mediaRecorderRef.current = mr;
    });
  }

  /* ---------------- UI ---------------- */

  return (
    <div className="grid grid-cols-[1fr_360px] h-screen bg-gray-100">
      <audio ref={agentAudioRef} preload="auto" />

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

          {candidateSpeaking && (
            <div className="mt-6 bg-gray-50 rounded-xl p-4">
              <div className="text-xs text-gray-500 mb-2">
                Live transcription
              </div>
              <div>{browserTranscript || "Listening…"}</div>
              <div className="mt-2 text-xs">
                Confidence: {answerConfidence ?? "…"}
              </div>
            </div>
          )}
        </div>
      </div>

      <aside className="bg-gray-900 p-4">
        <video
          ref={candidateVideoRef}
          autoPlay
          muted
          playsInline
          className="w-full h-full object-cover rounded-xl"
        />
      </aside>
    </div>
  );
}
