"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { useBrowserASR } from "@/hooks/useBrowserASR";
import { usePCMAudioCapture } from "@/hooks/usePCMAudioCapture";


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
      audio_url?: string;
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
  const candidateVideoRef = useRef<HTMLVideoElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);

  const agentAudioRef = useRef<HTMLAudioElement | null>(null);
  const audioQueueRef = useRef<string[]>([]);
  const isPlayingRef = useRef(false);

  const currentQuestionIdRef = useRef<number | null>(null);

  /* ---------------- State ---------------- */

  const [questionText, setQuestionText] = useState("");
  const [agentSpeaking, setAgentSpeaking] = useState(false);
  const [candidateSpeaking, setCandidateSpeaking] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(300);

  const [confidence, setConfidence] =
    useState<"listening" | "speaking" | "paused">("listening");

  const recordedChunksRef = useRef<Blob[]>([]);
  const finalChunksRef = useRef<Blob[]>([]);

  const { start: startPCM, stop: stopPCM } = usePCMAudioCapture();

  const [answerConfidence, setAnswerConfidence] =
  useState<"low" | "medium" | "high" | null>(null);



  /* ---------------- Browser ASR (ONLY SOURCE) ---------------- */

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
      `${process.env.NEXT_PUBLIC_WS_BASE ?? "ws://localhost:8000"}/ws/interview/${interviewId}`
    );
    wsRef.current = ws;

    ws.onmessage = (e) => {
      const msg: WSMessage = JSON.parse(e.data);
        
      // 🟢 Normal agent message (question / follow-up)
      if (msg.type === "agent_message") {
        if (msg.text) {
          setQuestionText(msg.text);
        }
      
        if (msg.audio_url) {
          enqueueAgentAudio(msg.audio_url);
        }
      
        if (typeof msg.question_id === "number") {
          currentQuestionIdRef.current = msg.question_id;
        }
        return;
      }
    
      // 🔴 AI interrupt while candidate is speaking
      if (msg.type === "ai_interrupt") {
        console.log("[AI INTERRUPT]", msg.reason ?? "no-reason");
      
        // Stop candidate recording immediately
        mediaRecorderRef.current?.stop();
        setCandidateSpeaking(false);
        setConfidence("paused");
      
        if (msg.text) {
          setQuestionText(msg.text);
        }
      
        if (msg.audio_url) {
          enqueueAgentAudio(msg.audio_url);
        }
        return;
      }
    
      // 🟡 Live confidence signal (NO UI state collision)
      if (msg.type === "live_signal") {
        // This is a SEPARATE signal, not the speaking state
        setAnswerConfidence(msg.confidence);
        return;
      }
    
      // 🔵 Error fallback
      if (msg.type === "error") {
        console.error("[WS ERROR]", msg.message);
        return;
      }
    };
    

        return () => ws.close();
      }, [interviewId]);

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

  /* ---------------- Candidate Recording (UPLOAD ONLY) ---------------- */

  function startCandidateTurn() {
  if (!currentQuestionIdRef.current) return;

  resetTranscript();
  setCandidateSpeaking(true);
  setConfidence("listening");

  navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => {
    finalChunksRef.current = [];

    const mr = new MediaRecorder(stream, {
      mimeType: "audio/webm",
    });

    /* ---------------- PCM CAPTURE (PARALLEL) ---------------- */
    startPCM((pcmChunk: Int16Array) => {
      if (!currentQuestionIdRef.current) return;

      fetch(
        `${process.env.NEXT_PUBLIC_API_BASE}/api/interview/${interviewId}/stream_pcm?question_id=${currentQuestionIdRef.current}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            samples: Array.from(pcmChunk),
          }),
        }
      ).catch(() => {});
    });

    /* ---------------- EXISTING WEBM FLOW (UNCHANGED) ---------------- */

    mr.ondataavailable = async (e) => {
      if (!e.data || e.data.size === 0) return;

      // Collect for final submit
      finalChunksRef.current.push(e.data);

      // Live backend ASR (existing & stable)
      if (!currentQuestionIdRef.current) return;

      const formData = new FormData();
      formData.append("file", e.data, "chunk.webm");
      formData.append("question_id", String(currentQuestionIdRef.current));
      formData.append("partial", "true");

      try {
        await fetch(
          `${process.env.NEXT_PUBLIC_API_BASE}/api/interview/${interviewId}/transcribe_audio`,
          { method: "POST", body: formData }
        );
      } catch (err) {
        console.error("Live ASR failed", err);
      }
    };

    mr.onstop = async () => {
      // 1️⃣ Stop mic tracks
      stream.getTracks().forEach((t) => t.stop());

      // 2️⃣ Stop PCM capture
      stopPCM();

      // 3️⃣ UI state
      setCandidateSpeaking(false);
      setConfidence("paused");

      if (!currentQuestionIdRef.current) return;

      // 4️⃣ Tell backend: "PCM stream finished, transcribe now"
      try {
        await fetch(
          `${process.env.NEXT_PUBLIC_API_BASE}/api/interview/${interviewId}/finalize_pcm?question_id=${currentQuestionIdRef.current}`,
          { method: "POST" }
        );
      } catch (err) {
        console.error("Final PCM ASR failed", err);
      }
    
      // 5️⃣ Cleanup (no WebM buffers anymore)
      finalChunksRef.current = [];
    };

    mr.start(2000); // 2s chunks (unchanged)
    mediaRecorderRef.current = mr;
  });
}


function stopCandidateTurn() {
  mediaRecorderRef.current?.stop(); // triggers mr.onstop
  stopPCM();
  setCandidateSpeaking(false);
}


  /* ---------------- UI ---------------- */

  return (
    <div className="grid grid-cols-[1fr_360px] h-screen bg-gray-100">
      <audio ref={agentAudioRef} preload="auto" playsInline />

      <div className="p-6 flex flex-col gap-4">
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
            <div className="mt-6 bg-gray-50 rounded-xl p-4">
              <div className="text-xs text-gray-500 mb-2">
                Live transcription
              </div>
              <div className="text-gray-900">
                {browserTranscript || "Listening…"}
              </div>
              <div className="mt-2 text-xs">
                {asrListening ? "🎙 Listening" : "⏸ Paused"}
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
