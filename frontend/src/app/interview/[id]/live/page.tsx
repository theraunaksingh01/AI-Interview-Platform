"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000";
const WS_BASE  = process.env.NEXT_PUBLIC_WS_BASE  ?? "ws://localhost:8000";

const PCM_SEND_THRESHOLD = 16000; // ~1 s at 16 kHz — for confidence scoring only
const ANSWER_TIME_LIMIT  = 120;   // 2-minute countdown

type WSMessage =
  | { type: "agent_message"; text: string; question_id?: number; question_type?: string; audio_url?: string; done?: boolean }
  | { type: "live_signal"; question_id: number; confidence: "low" | "medium" | "high"; word_count: number; transcript?: string }
  | { type: "ai_interrupt"; text: string; reason?: string; audio_url?: string }
  | { type: "ai_interrupt_audio"; audio_url: string }
  | { type: "turn_decision"; question_id: number; decision: string };

export default function LiveInterviewPage() {
  const { id } = useParams();
  const interviewId = id as string;

  // ── Refs (never stale in effects/callbacks) ──────────────────────
  const wsRef               = useRef<WebSocket | null>(null);
  const mediaRecorderRef    = useRef<MediaRecorder | null>(null);
  const audioContextRef     = useRef<AudioContext | null>(null);
  const sampleBufferRef     = useRef<number[]>([]);
  const recognitionRef      = useRef<any>(null);          // Web Speech instance
  const finalTranscriptRef  = useRef("");                 // confirmed SpeechRecognition text
  const liveTranscriptRef   = useRef("");                 // latest transcript (for periodic re-send)
  const candidateSpeakingRef = useRef(false);             // mirrors state — avoids stale closure
  const liveTextDebounceRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const candidateVideoRef   = useRef<HTMLVideoElement | null>(null);
  const agentAudioRef       = useRef<HTMLAudioElement | null>(null);
  const currentQuestionIdRef = useRef<number | null>(null);

  // ── State ─────────────────────────────────────────────────────────
  const [questionText, setQuestionText]         = useState("");
  const [agentStatus, setAgentStatus]           = useState<"idle" | "speaking" | "listening">("idle");
  const [answerConfidence, setAnswerConfidence] = useState<"low" | "medium" | "high" | null>(null);
  const [candidateSpeaking, setCandidateSpeaking] = useState(false);
  const [liveTranscript, setLiveTranscript]     = useState("");
  const [timeLeft, setTimeLeft]                 = useState(ANSWER_TIME_LIMIT);
  const [interviewDone, setInterviewDone]       = useState(false);
  const [asrWarning, setAsrWarning]             = useState("");
  const [interrupted, setInterrupted]           = useState(false);
  const [interruptText, setInterruptText]       = useState("");
  const [questionType, setQuestionType]         = useState<"voice" | "code">("voice");
  const [codeAnswer, setCodeAnswer]             = useState("");
  const interruptedRef                          = useRef(false);

  // ── Countdown timer (pauses during interruption) ───────────────────
  useEffect(() => {
    if (!candidateSpeaking) {
      setTimeLeft(ANSWER_TIME_LIMIT);
      return;
    }
    if (interrupted) return; // timer frozen — keep current value
    const id = setInterval(() => {
      setTimeLeft((t) => (t > 0 ? t - 1 : 0));
    }, 1000);
    return () => clearInterval(id);
  }, [candidateSpeaking, interrupted]);

  // Auto-submit when time runs out (skip when interrupted)
  useEffect(() => {
    if (candidateSpeaking && !interrupted && timeLeft === 0) {
      submitAnswer();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeLeft, candidateSpeaking, interrupted]);

  // ── Periodic re-send for interrupt detection ─────────────────────
  // Even if no new speech, re-send transcript every 3 s so the backend
  // can re-evaluate with enough elapsed time (fixes late-interrupt bug).
  useEffect(() => {
    if (!candidateSpeaking || interrupted) return;
    const id = setInterval(() => {
      const qid = currentQuestionIdRef.current;
      const text = liveTranscriptRef.current;
      if (!qid || !text) return;
      console.log("[PERIODIC] Sending live_text:", text.substring(0, 60), "words:", text.split(" ").length);
      fetch(`${API_BASE}/api/interview/${interviewId}/live_text`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question_id: qid, text }),
      }).catch(() => {});
    }, 3000);
    return () => clearInterval(id);
  }, [candidateSpeaking, interrupted, interviewId]);

  // ── Camera preview ────────────────────────────────────────────────
  useEffect(() => {
    navigator.mediaDevices
      .getUserMedia({ video: true })
      .then((stream) => {
        if (candidateVideoRef.current) candidateVideoRef.current.srcObject = stream;
      })
      .catch(() => {});
  }, []);

  // ── WebSocket ─────────────────────────────────────────────────────
  useEffect(() => {
    const ws = new WebSocket(`${WS_BASE}/ws/interview/${interviewId}`);
    wsRef.current = ws;

    ws.onmessage = (e) => {
      const msg: WSMessage = JSON.parse(e.data);

      if (msg.type === "agent_message") {
        setQuestionText(msg.text);
        setAnswerConfidence(null);
        setLiveTranscript("");
        finalTranscriptRef.current = "";
        setCodeAnswer("");

        if (msg.question_id) currentQuestionIdRef.current = msg.question_id;
        if (msg.question_type) setQuestionType(msg.question_type === "code" ? "code" : "voice");

        if (msg.done) {
          setInterviewDone(true);
          setAgentStatus("idle");
          // Finalize: backfill answers + trigger scoring, then redirect to evaluation
          fetch(`${API_BASE}/interview/finalize/${interviewId}`, { method: "POST" })
            .then((r) => r.json())
            .catch(() => ({}));
          setTimeout(() => {
            window.location.href = `/interview/${interviewId}/evaluation`;
          }, 3000);
          return;
        }

        if (msg.audio_url && agentAudioRef.current) {
          setAgentStatus("speaking");
          const audio = agentAudioRef.current;
          audio.src = `${API_BASE}${msg.audio_url}`;
          audio.play()
            .then(() => {
              audio.onended = () => {
                setAgentStatus("listening");
                if (currentQuestionIdRef.current) {
                  const qType = msg.question_type === "code" ? "code" : "voice";
                  if (qType === "voice") startCandidateTurn();
                  else setCandidateSpeaking(true); // show code editor
                }
              };
            })
            .catch(() => {
              setAgentStatus("listening");
              if (currentQuestionIdRef.current) {
                const qType = msg.question_type === "code" ? "code" : "voice";
                if (qType === "voice") startCandidateTurn();
                else setCandidateSpeaking(true);
              }
            });
        } else if (msg.question_id) {
          setAgentStatus("listening");
          const qType = msg.question_type === "code" ? "code" : "voice";
          if (qType === "voice") startCandidateTurn();
          else setCandidateSpeaking(true); // show code editor
        }
      }

      if (msg.type === "live_signal") {
        setAnswerConfidence(msg.confidence);
        // Only show Whisper fallback transcript when Web Speech is unavailable
        if (!recognitionRef.current && msg.transcript) {
          setLiveTranscript(msg.transcript);
          liveTranscriptRef.current = msg.transcript;
        }
      }

      if (msg.type === "ai_interrupt") {
        setInterrupted(true);
        setInterruptText(msg.text);
        interruptedRef.current = true;

        // Pause MediaRecorder
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
          mediaRecorderRef.current.pause();
        }
        // Pause Web Speech recognition
        if (recognitionRef.current) {
          try { recognitionRef.current.stop(); } catch { /* already stopped */ }
        }
        // Suspend PCM capture
        if (audioContextRef.current && audioContextRef.current.state === "running") {
          audioContextRef.current.suspend();
        }

        // Speak interrupt text using browser SpeechSynthesis
        if ("speechSynthesis" in window && msg.text) {
          window.speechSynthesis.cancel();
          const utter = new SpeechSynthesisUtterance(msg.text);
          utter.rate = 1.0;
          utter.pitch = 1.0;
          utter.volume = 1.0;
          window.speechSynthesis.speak(utter);
        }
      }
    };

    return () => ws.close();
  }, [interviewId]);

  // ── Start candidate recording turn ────────────────────────────────
  async function startCandidateTurn() {
    if (!currentQuestionIdRef.current) return;

    setLiveTranscript("");
    finalTranscriptRef.current = "";
    liveTranscriptRef.current = "";
    setCandidateSpeaking(true);
    candidateSpeakingRef.current = true;
    setAsrWarning("");
    setInterrupted(false);
    setInterruptText("");
    interruptedRef.current = false;

    let audioStream: MediaStream;
    try {
      audioStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    } catch {
      return;
    }

    // ── Web Speech API — primary live transcription (Chrome / Edge) ──
    // Sends audio to browser's built-in ASR. Real-time, sentence-accurate.
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (SpeechRecognition) {
      try {
        const recognition = new SpeechRecognition();
        recognition.continuous     = true;
        recognition.interimResults = true;
        recognition.lang           = "en-US";
        recognitionRef.current     = recognition;

        recognition.onresult = (event: any) => {
          let interim = "";
          for (let i = event.resultIndex; i < event.results.length; i++) {
            const t = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
              finalTranscriptRef.current += t + " ";
            } else {
              interim += t;
            }
          }
          const display = (finalTranscriptRef.current + interim).trim();
          setLiveTranscript(display);
          liveTranscriptRef.current = display;

          // Debounce confidence scoring: send transcript to backend every ~1.5 s
          if (liveTextDebounceRef.current) clearTimeout(liveTextDebounceRef.current);
          liveTextDebounceRef.current = setTimeout(() => {
            const qid = currentQuestionIdRef.current;
            if (!qid || !display) return;
            console.log("[DEBOUNCE] Sending live_text:", display.substring(0, 60), "words:", display.split(" ").length);
            fetch(`${API_BASE}/api/interview/${interviewId}/live_text`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ question_id: qid, text: display }),
            }).catch(() => {});
          }, 1500);
        };

        recognition.onerror = (event: any) => {
          if (event.error === "not-allowed" || event.error === "service-not-allowed") {
            setAsrWarning("Mic permission denied — using Whisper fallback.");
            recognitionRef.current = null;
          } else if (event.error === "network") {
            setAsrWarning("Speech recognition needs internet — using Whisper fallback.");
            recognitionRef.current = null;
          }
          // other transient errors (no-speech, aborted) are ignored; onend restarts
        };

        // Auto-restart on pause (browser stops recognition after silence)
        recognition.onend = () => {
          // Only restart if this instance is still active (not cleared by submitAnswer)
          if (recognitionRef.current === recognition && candidateSpeakingRef.current && !interruptedRef.current) {
            try { recognition.start(); } catch { /* already started */ }
          }
        };

        recognition.start();
      } catch {
        recognitionRef.current = null;
        setAsrWarning("Speech recognition unavailable — using Whisper fallback.");
      }
    } else {
      setAsrWarning("Browser speech recognition not supported — using Whisper fallback.");
    }

    // ── MediaRecorder — buffers WebM for final Whisper pass on submit ──
    const mr = new MediaRecorder(audioStream, { mimeType: "audio/webm" });
    mr.ondataavailable = async (e) => {
      if (!e.data || e.data.size === 0) return;
      const form = new FormData();
      form.append("file", e.data, "chunk.webm");
      form.append("question_id", String(currentQuestionIdRef.current));
      form.append("partial", "true");
      await fetch(`${API_BASE}/api/interview/${interviewId}/transcribe_audio`, {
        method: "POST",
        body: form,
      }).catch(() => {});
    };
    mr.start(5000);
    mediaRecorderRef.current = mr;

    // ── WebAudio PCM → /stream_pcm — confidence scoring only ──────────
    // Whisper on short windows is inaccurate; we only use it for signal strength.
    try {
      const audioCtx = new AudioContext({ sampleRate: 16000 });
      audioContextRef.current = audioCtx;
      sampleBufferRef.current = [];

      const source    = audioCtx.createMediaStreamSource(audioStream);
      // eslint-disable-next-line deprecation/deprecation
      const processor = audioCtx.createScriptProcessor(4096, 1, 1);

      processor.onaudioprocess = (e) => {
        const floats = e.inputBuffer.getChannelData(0);
        const buf = sampleBufferRef.current;
        for (let i = 0; i < floats.length; i++) {
          buf.push(Math.max(-32768, Math.min(32767, Math.round(floats[i] * 32768))));
        }
        if (buf.length >= PCM_SEND_THRESHOLD) {
          const toSend = buf.splice(0, PCM_SEND_THRESHOLD);
          const qid = currentQuestionIdRef.current;
          if (!qid) return;
          fetch(
            `${API_BASE}/api/interview/${interviewId}/stream_pcm?question_id=${qid}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(toSend),
            }
          ).catch(() => {});
        }
      };

      source.connect(processor);
      processor.connect(audioCtx.destination);
    } catch {
      /* PCM unavailable — confidence badge won't show */
    }
  }

  // ── Submit answer ─────────────────────────────────────────────────
  function submitAnswer() {
    const qid = currentQuestionIdRef.current;
    if (!qid || !wsRef.current) return;

    // Clear interrupted state if active
    setInterrupted(false);
    setInterruptText("");
    interruptedRef.current = false;

    // Stop speech synthesis if still speaking
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }

    // Stop Web Speech first — null ref BEFORE .stop() so onend won't restart
    candidateSpeakingRef.current = false;
    if (liveTextDebounceRef.current) {
      clearTimeout(liveTextDebounceRef.current);
      liveTextDebounceRef.current = null;
    }
    if (recognitionRef.current) {
      const rec = recognitionRef.current;
      recognitionRef.current = null;
      try { rec.stop(); } catch { /* already stopped */ }
    }

    // Stop MediaRecorder
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current = null;
    }

    // Stop PCM capture
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    sampleBufferRef.current = [];

    setCandidateSpeaking(false);
    setAgentStatus("idle");

    // Prefer Web Speech accumulated text; fall back to last Whisper broadcast; fall back to code answer
    const transcript = finalTranscriptRef.current.trim() || liveTranscript || codeAnswer;

    wsRef.current.send(
      JSON.stringify({ type: "candidate_text", question_id: qid, text: transcript })
    );

    setAnswerConfidence(null);
    setLiveTranscript("");
    liveTranscriptRef.current = "";
    finalTranscriptRef.current = "";
    setCodeAnswer("");
  }

  // ── Resume recording after interruption ──────────────────────────
  function continueRecording() {
    setInterrupted(false);
    setInterruptText("");
    interruptedRef.current = false;

    // Stop speech synthesis if still speaking
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }

    // Stop interrupt audio if still playing
    if (agentAudioRef.current) {
      agentAudioRef.current.pause();
      agentAudioRef.current.currentTime = 0;
    }

    // Resume MediaRecorder
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "paused") {
      mediaRecorderRef.current.resume();
    }

    // Restart Web Speech recognition
    if (recognitionRef.current) {
      try { recognitionRef.current.start(); } catch { /* already running */ }
    }

    // Resume PCM capture
    if (audioContextRef.current && audioContextRef.current.state === "suspended") {
      audioContextRef.current.resume();
    }
  }

  // ── UI helpers ────────────────────────────────────────────────────
  const minutes = String(Math.floor(timeLeft / 60)).padStart(2, "0");
  const seconds = String(timeLeft % 60).padStart(2, "0");
  const timerColor =
    timeLeft <= 30 ? "text-red-600" : timeLeft <= 60 ? "text-yellow-600" : "text-gray-700";

  const confidenceBadge: Record<"low" | "medium" | "high", string> = {
    low:    "bg-red-100 text-red-700",
    medium: "bg-yellow-100 text-yellow-700",
    high:   "bg-green-100 text-green-700",
  };

  const agentStatusLabel: Record<typeof agentStatus, string> = {
    idle:      "Ready",
    speaking:  "Speaking...",
    listening: "Listening...",
  };

  return (
    <div className="grid grid-cols-[1fr_360px] h-screen bg-gray-100">
      <audio ref={agentAudioRef} preload="auto" />

      {/* ── Main panel ── */}
      <div className="p-6 flex flex-col gap-4">
        <header className="flex items-center gap-3">
          <img src="/avatar/interviewer.jpg" className="w-12 h-12 rounded-full" alt="interviewer" />
          <div>
            <div className="font-semibold">AI Interviewer</div>
            <div className="text-xs text-gray-500">{agentStatusLabel[agentStatus]}</div>
          </div>
        </header>

        <div className="bg-white rounded-xl p-6 shadow flex-1 flex flex-col">
          <div className="text-gray-500 text-sm mb-2">Interviewer</div>
          <div className="text-lg font-medium">{questionText || "Connecting..."}</div>

          {/* ── Candidate answer panel ── */}
          {candidateSpeaking && questionType === "voice" && (
            <div className="mt-6 bg-gray-50 rounded-xl p-4 flex flex-col gap-3">

              {/* Header: label + countdown timer */}
              <div className="flex items-center justify-between">
                <div className="text-xs text-gray-500 font-medium">
                  {interrupted ? "Recording paused" : "Live transcription"}
                </div>
                <div className={`text-sm font-mono font-bold ${interrupted ? "text-amber-600" : timerColor}`}>
                  {interrupted && <span className="text-xs mr-1">PAUSED</span>}
                  {minutes}:{seconds}
                </div>
              </div>

              {/* ASR fallback warning */}
              {asrWarning && (
                <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-1.5">
                  {asrWarning}
                </div>
              )}

              {/* Live transcript */}
              <div className="min-h-[3rem] text-sm text-gray-800 leading-relaxed">
                {liveTranscript ? (
                  liveTranscript
                ) : (
                  <span className="text-gray-400 italic">Start speaking…</span>
                )}
              </div>

              {/* Confidence badge */}
              {answerConfidence && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">Answer confidence</span>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${confidenceBadge[answerConfidence]}`}>
                    {answerConfidence.charAt(0).toUpperCase() + answerConfidence.slice(1)}
                  </span>
                </div>
              )}

              {/* Interrupt overlay */}
              {interrupted && (
                <div className="bg-amber-50 border border-amber-300 rounded-xl p-4 flex flex-col gap-3">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                    <span className="text-sm font-semibold text-amber-800">Interview Paused</span>
                  </div>
                  <div className="text-sm text-amber-900">{interruptText}</div>
                  <div className="flex gap-3">
                    <button
                      onClick={continueRecording}
                      className="flex-1 bg-white hover:bg-gray-50 border border-gray-300 text-gray-700 rounded-lg py-2 text-sm font-medium transition-colors"
                    >
                      Continue Recording
                    </button>
                    <button
                      onClick={submitAnswer}
                      className="flex-1 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-lg py-2 text-sm font-medium transition-colors"
                    >
                      Submit Answer
                    </button>
                  </div>
                </div>
              )}

              {/* Submit button (hidden during interruption) */}
              {!interrupted && (
                <button
                  onClick={submitAnswer}
                  className="mt-1 w-full bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-lg py-2 text-sm font-medium transition-colors"
                >
                  Submit Answer
                </button>
              )}
            </div>
          )}

          {/* ── Code answer panel ── */}
          {candidateSpeaking && questionType === "code" && (
            <div className="mt-6 bg-gray-50 rounded-xl p-4 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div className="text-xs text-gray-500 font-medium">Code Editor</div>
                <div className={`text-sm font-mono font-bold ${timerColor}`}>
                  {minutes}:{seconds}
                </div>
              </div>

              <textarea
                value={codeAnswer}
                onChange={(e) => setCodeAnswer(e.target.value)}
                placeholder="Write your code here..."
                className="w-full min-h-[200px] bg-gray-900 text-green-400 font-mono text-sm p-4 rounded-lg border border-gray-700 focus:border-blue-500 focus:outline-none resize-y"
                spellCheck={false}
              />

              <button
                onClick={submitAnswer}
                className="mt-1 w-full bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-lg py-2 text-sm font-medium transition-colors"
              >
                Submit Code
              </button>
            </div>
          )}

          {/* ── Interview complete ── */}
          {interviewDone && (
            <div className="mt-6 bg-green-50 border border-green-200 rounded-xl p-4 text-green-800 font-medium text-sm">
              Interview complete — scoring your answers. Redirecting to evaluation...
            </div>
          )}
        </div>
      </div>

      {/* ── Camera sidebar ── */}
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
