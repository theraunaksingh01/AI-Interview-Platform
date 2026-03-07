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
  }
  | {
    type: "live_signal";
    question_id: number;
    confidence: "low" | "medium" | "high";
    word_count: number;
  }
  | {
    type: "ai_interrupt";
    text: string;
    question_id: number;
    reason?: string;
    audio_url?: string;
  }
  | {
    type: "live_transcript";
    text: string;
    question_id: number;
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
  const currentQuestionIdRef = useRef<number | null>(null);

  const audioContextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  const agentAudioRef = useRef<HTMLAudioElement | null>(null);
  const audioQueueRef = useRef<string[]>([]);
  const isPlayingRef = useRef(false);

  const finalizedRef = useRef(false);

  /* ---------------- State ---------------- */

  const [questionText, setQuestionText] = useState("");
  const [agentSpeaking, setAgentSpeaking] = useState(false);
  const [candidateSpeaking, setCandidateSpeaking] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(300);
  const [answerConfidence, setAnswerConfidence] =
    useState<"low" | "medium" | "high" | null>(null);
  const [liveTranscript, setLiveTranscript] = useState("");

  /* ---------------- Browser ASR ---------------- */



  /* ---------------- Camera ---------------- */

  useEffect(() => {
    navigator.mediaDevices
      .getUserMedia({ video: true })
      .then((stream) => {
        if (candidateVideoRef.current) {
          candidateVideoRef.current.srcObject = stream;
        }
      })
      .catch(() => { });
  }, []);

  /* ---------------- Timer (SAFE VERSION) ---------------- */

  useEffect(() => {
    if (!candidateSpeaking) return;

    const t = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          if (!finalizedRef.current) {
            finalizedRef.current = true;
            finalizeAnswer();
          }
          return 0;
        }
        return s - 1;
      });
    }, 1000);

    return () => clearInterval(t);
  }, [candidateSpeaking]);

  /* 🔥 FINALIZE when timer hits zero */
  useEffect(() => {
    if (secondsLeft === 0 && candidateSpeaking) {
      finalizeAnswer();
    }
  }, [secondsLeft, candidateSpeaking]);

  /* ---------------- WebSocket ---------------- */

  useEffect(() => {
    const ws = new WebSocket(
      `${process.env.NEXT_PUBLIC_WS_BASE ?? "ws://localhost:8000"
      }/ws/interview/${interviewId}`
    );

    wsRef.current = ws;

    ws.onmessage = (e) => {
      const msg: WSMessage = JSON.parse(e.data);

      if (msg.type === "agent_message") {
        setQuestionText(msg.text);

        if (msg.question_id) {
          currentQuestionIdRef.current = msg.question_id;
        }

        if (msg.audio_url) enqueueAgentAudio(msg.audio_url);
      }

      if (msg.type === "live_signal") {
        setAnswerConfidence(msg.confidence);
      }

      if (msg.type === "live_transcript") {
        setLiveTranscript(msg.text);
      }

      if (msg.type === "ai_interrupt") {
        console.log("AI INTERRUPT RECEIVED", msg);

        // 🔴 Stop candidate immediately
        stopAudioCapture();

        setCandidateSpeaking(false);
        setAgentSpeaking(true);

        setQuestionText(msg.text || "Let me clarify something...");

        if (msg.audio_url) {
          enqueueAgentAudio(msg.audio_url);
        }
      }
    };

    return () => {
      ws.close();
      stopAudioCapture();
    };
  }, [interviewId]);

  /* ---------------- Live Confidence ---------------- */



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

  async function finishAgentAudio() {
    isPlayingRef.current = false;
    setAgentSpeaking(false);

    // 🎤 Resume mic if still same question and time remains
    if (secondsLeft > 0 && currentQuestionIdRef.current) {
      setCandidateSpeaking(true);
    }

    tryPlayNextAudio();
  }

  /* ---------------- PCM Streaming ---------------- */

  async function startCandidateTurn() {
    if (!currentQuestionIdRef.current) return;


    setCandidateSpeaking(true);

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaStreamRef.current = stream;

    // Chrome ignores sampleRate and uses 48kHz. We send actual rate so backend can resample.
    const audioContext = new AudioContext();
    audioContextRef.current = audioContext;

    const source = audioContext.createMediaStreamSource(stream);
    const processor = audioContext.createScriptProcessor(4096, 1, 1);
    processorRef.current = processor;

    source.connect(processor);
    // Connect to silent gain so processor runs but mic is not played back (avoids feedback)
    const silentGain = audioContext.createGain();
    silentGain.gain.value = 0;
    processor.connect(silentGain);
    silentGain.connect(audioContext.destination);

    processor.onaudioprocess = async (event) => {
      const floatData = event.inputBuffer.getChannelData(0);

      // Float32 [-1, 1] → Int16 at native sample rate (usually 48kHz on Chrome)
      const int16Buffer = new Int16Array(floatData.length);
      for (let i = 0; i < floatData.length; i++) {
        let s = floatData[i];
        if (s > 1) s = 1;
        else if (s < -1) s = -1;
        int16Buffer[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
      }

      const sampleRate = audioContext.sampleRate;
      await fetch(
        `${process.env.NEXT_PUBLIC_API_BASE}/api/interview/${interviewId}/stream_pcm?question_id=${currentQuestionIdRef.current}&sample_rate=${sampleRate}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(Array.from(int16Buffer)),
        }
      ).catch(() => { });
    };
  }

  /* ---------------- FINALIZE ---------------- */

  async function finalizeAnswer() {
    if (finalizedRef.current) return;
    finalizedRef.current = true;

    if (!currentQuestionIdRef.current) return;

    console.log("FINALIZE TRIGGERED");

    await fetch(
      `${process.env.NEXT_PUBLIC_API_BASE}/api/interview/${interviewId}/finalize_pcm?question_id=${currentQuestionIdRef.current}`,
      { method: "POST" }
    ).catch((err) => console.error("Finalize failed", err));

    stopAudioCapture();
    setCandidateSpeaking(false);
  }

  async function stopAudioCapture() {
    try {
      processorRef.current?.disconnect();
      processorRef.current = null;

      mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;

      if (
        audioContextRef.current &&
        audioContextRef.current.state !== "closed"
      ) {
        await audioContextRef.current.close();
      }

      audioContextRef.current = null;
    } catch (err) {
      console.error("Stop capture error", err);
    }
  }

  /* ---------------- UI ---------------- */

  return (
    <div className="grid grid-cols-[1fr_360px] h-screen bg-gray-100">
      <audio ref={agentAudioRef} preload="auto" />

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
              <div>{liveTranscript || "Listening…"}</div>
              <div className="mt-2 text-xs">
                Confidence: {answerConfidence ?? "..."}
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
