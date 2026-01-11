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
  | { type: "error"; message: string };

export default function LiveInterviewPage() {
  const { id } = useParams();
  const interviewId = id as string;

  /* ---------------- Refs ---------------- */

  const wsRef = useRef<WebSocket | null>(null);
  const candidateVideoRef = useRef<HTMLVideoElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);

  const agentAudioRef = useRef<HTMLAudioElement | null>(null);
  const audioQueueRef = useRef<string[]>([]);
  const isPlayingRef = useRef(false);

  const currentQuestionIdRef = useRef<number | null>(null);
  const pendingQuestionIdRef = useRef<number | null>(null);


  /* ---------------- State ---------------- */

  const [questionText, setQuestionText] = useState("");
  const [agentSpeaking, setAgentSpeaking] = useState(false);
  const [candidateSpeaking, setCandidateSpeaking] = useState(false);

  const [secondsLeft, setSecondsLeft] = useState(300);

  const [partialTranscript, setPartialTranscript] = useState("");
  const [confidence, setConfidence] =
    useState<"listening" | "speaking" | "paused">("listening");

  /* ---------------- Camera ---------------- */

  useEffect(() => {
    navigator.mediaDevices
      .getUserMedia({ video: true, audio: false })
      .then((stream) => {
        if (candidateVideoRef.current) {
          candidateVideoRef.current.srcObject = stream;
        }
      })
      .catch(() => {});
  }, []);

  /* ---------------- Timer ---------------- */

  useEffect(() => {
    if (!candidateSpeaking) return;

    setSecondsLeft(300);
    const t = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          mediaRecorderRef.current?.stop();
          clearInterval(t);
          return 0;
        }
        return s - 1;
      });
    }, 1000);

    return () => clearInterval(t);
  }, [candidateSpeaking]);

  /* ---------------- WebSocket ---------------- */

  useEffect(() => {
    const ws = new WebSocket(
      `${process.env.NEXT_PUBLIC_WS_BASE ?? "ws://localhost:8000"}/ws/interview/${interviewId}`,
    );
    wsRef.current = ws;

    ws.onmessage = (e) => {
      const msg: WSMessage = JSON.parse(e.data);
      if (msg.type !== "agent_message") return;

      setQuestionText(msg.text);

      if (msg.audio_url) {
        enqueueAgentAudio(msg.audio_url);
      }

      if (typeof msg.question_id === "number") {
        currentQuestionIdRef.current = msg.question_id;
      }
    };

    return () => ws.close();
  }, [interviewId]);

  /* ---------------- Agent Audio Queue ---------------- */

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
      // Agent finished → start candidate
      startCandidateTurn();
      return;
    }

    const audio = agentAudioRef.current;
    const src = audioQueueRef.current.shift()!;

    isPlayingRef.current = true;
    setAgentSpeaking(true);
    setCandidateSpeaking(false);

    audio.src = src;
    audio.volume = 1;

    audio.onended = finishAgentAudio;
    audio.onerror = finishAgentAudio;

    audio.play().catch(finishAgentAudio);
  }

  function finishAgentAudio() {
    isPlayingRef.current = false;
    setAgentSpeaking(false);
    tryPlayNextAudio();
  }

  /* ---------------- Candidate Recording + Streaming ASR ---------------- */

  function startCandidateTurn() {
    if (!currentQuestionIdRef.current) return;

    setCandidateSpeaking(true);
    setConfidence("listening");
    setPartialTranscript("");

    navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => {
      const mr = new MediaRecorder(stream, {
        mimeType: "audio/webm",
      });

      mr.ondataavailable = async (e) => {
        if (!e.data || e.data.size === 0) return;

        const formData = new FormData();

        // ✅ REQUIRED by FastAPI
        formData.append("file", e.data, "chunk.webm");
        if (!currentQuestionIdRef.current) return;

        formData.append(
          "question_id",
          String(currentQuestionIdRef.current)
        );
        
        formData.append("partial", "true"); // MUST be string

        try {
          const res = await fetch(
            `${process.env.NEXT_PUBLIC_API_BASE}/api/interview/${interviewId}/transcribe_audio`,
            {
              method: "POST",
              body: formData,
            }
          );
        
          if (!res.ok) {
            console.error("ASR failed", await res.text());
            return;
          }
        
          const data = await res.json();
        
          if (data?.text) {
            setPartialTranscript(data.text);
          }
        } catch (err) {
          console.error("ASR error", err);
        }
      };



      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        setCandidateSpeaking(false);
        setConfidence("paused");

        // final submit
        const blob = new Blob([], { type: "audio/webm" });
        const form = new FormData();
        form.append("file", blob);
        form.append("question_id", String(currentQuestionIdRef.current));
        form.append("partial", "false");

        await fetch(
          `${process.env.NEXT_PUBLIC_API_BASE}/api/interview/${interviewId}/transcribe_audio`,
          { method: "POST", body: form },
        );
      };

      mr.start(2000);
      mediaRecorderRef.current = mr;
    });
  }

  /* ---------------- UI ---------------- */

  return (
    <div className="grid grid-cols-[1fr_360px] h-screen bg-gray-100">
      <audio ref={agentAudioRef} preload="auto" playsInline />

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
              <div className="text-gray-900">{partialTranscript}</div>
              <div className="mt-2 text-xs">
                {confidence === "speaking" && "🟢 Speaking"}
                {confidence === "listening" && "🎙 Listening"}
                {confidence === "paused" && "🟡 Pause detected"}
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
