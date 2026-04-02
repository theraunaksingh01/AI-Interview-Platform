"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import dynamic from "next/dynamic";
import { motion, AnimatePresence } from "framer-motion";
import {
  Mic,
  Send,
  Clock,
  Radio,
  Play,
  Pause,
  CheckCircle2,
  AlertCircle,
  User,
  Shield,
  ShieldAlert,
} from "lucide-react";
import { useAntiCheat } from "@/hooks/useAntiCheat";
import { useCoaching } from "@/hooks/useCoaching";

const Monaco = dynamic(() => import("@monaco-editor/react"), { ssr: false });

type Lang = "javascript" | "python" | "java" | "cpp";
type SampleCase = { input: string; expected: string };

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000";
const WS_BASE  = process.env.NEXT_PUBLIC_WS_BASE  ?? "ws://localhost:8000";

const PCM_SEND_THRESHOLD = 16000; // ~1 s at 16 kHz — for confidence scoring only
const ANSWER_TIME_LIMIT  = 120;   // 2-minute countdown

const LANG_LABELS: Record<Lang, string> = { python: "Python", javascript: "JavaScript", java: "Java", cpp: "C++" };
const LANG_MONACO: Record<Lang, string> = { python: "python", javascript: "javascript", java: "java", cpp: "cpp" };
const LANG_DEFAULTS: Record<Lang, string> = {
  python: "import sys\n\ndef solve():\n    # Read input\n    data = sys.stdin.read().strip()\n    # Your solution here\n    pass\n\nsolve()\n",
  javascript: "const fs = require('fs');\nconst input = fs.readFileSync(0, 'utf8').trim();\n\n// Your solution here\n",
  java: "import java.util.*;\n\npublic class Main {\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        // Your solution here\n    }\n}\n",
  cpp: "#include <bits/stdc++.h>\nusing namespace std;\n\nint main() {\n    // Your solution here\n    return 0;\n}\n",
};

type WSMessage =
  | { type: "agent_message"; text: string; question_id?: number; question_type?: string; audio_url?: string; done?: boolean; description?: string; sample_cases?: SampleCase[]; time_limit_seconds?: number; is_followup?: boolean; parent_question_id?: number }
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
  const [isFollowup, setIsFollowup]             = useState(false);
  const [codeAnswer, setCodeAnswer]             = useState("");
  const interruptedRef                          = useRef(false);

  // ── Code IDE state ────────────────────────────────────────────────
  const [lang, setLang]                         = useState<Lang>("python");
  const [codeDescription, setCodeDescription]   = useState("");
  const [sampleCases, setSampleCases]           = useState<SampleCase[]>([]);
  const [activeCaseIdx, setActiveCaseIdx]       = useState(0);
  const [runOutput, setRunOutput]               = useState("");
  const [runVerdict, setRunVerdict]             = useState<"pass" | "fail" | "error" | null>(null);
  const [runningCode, setRunningCode]           = useState(false);
  const [executionTimeMs, setExecutionTimeMs]   = useState(0);
  const [testResults, setTestResults]           = useState<{idx: number; pass: boolean; stdout: string; ms: number}[]>([]);
  const [codeTab, setCodeTab]                   = useState<"cases" | "output" | "results">("cases");
  const [codeTimerLeft, setCodeTimerLeft]       = useState(600);
  const { ingestTranscriptChunk, startAnswer, resetAnswer } = useCoaching();

  // ── Anti-cheat ───────────────────────────────────────────────────────
  const { flags: cheatFlags, addFlag, submitFlags, resetFlags } = useAntiCheat({
    blockContextMenu: true,
    detectDevTools: true,
  });

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

  // ── Code question timer ──────────────────────────────────────────
  useEffect(() => {
    if (!candidateSpeaking || questionType !== "code") return;
    const id = setInterval(() => {
      setCodeTimerLeft((t) => (t > 0 ? t - 1 : 0));
    }, 1000);
    return () => clearInterval(id);
  }, [candidateSpeaking, questionType]);

  // ── Periodic re-send for interrupt detection ─────────────────────
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
        setIsFollowup(!!msg.is_followup);

        // Populate code question metadata
        if (msg.question_type === "code") {
          setCodeDescription(msg.description || msg.text);
          // sample_cases may arrive as a JSON string or array
          let sc = msg.sample_cases || [];
          if (typeof sc === "string") {
            try { sc = JSON.parse(sc); } catch { sc = []; }
          }
          setSampleCases(Array.isArray(sc) ? sc : []);
          setActiveCaseIdx(0);
          setRunOutput("");
          setRunVerdict(null);
          setTestResults([]);
          setCodeTab("cases");
          setCodeTimerLeft(msg.time_limit_seconds || 600);
          setCodeAnswer(LANG_DEFAULTS[lang]);
        }

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
        if (msg.transcript) {
          ingestTranscriptChunk(msg.transcript);
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
    startAnswer();
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

          // Debounce confidence scoring
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
        };

        recognition.onend = () => {
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

    setInterrupted(false);
    setInterruptText("");
    interruptedRef.current = false;

    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }

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

    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current = null;
    }

    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    sampleBufferRef.current = [];

    setCandidateSpeaking(false);
    setAgentStatus("idle");

    const transcript = finalTranscriptRef.current.trim() || liveTranscript || codeAnswer;

    // submit anti-cheat flags for this question
    submitFlags(qid);

    wsRef.current.send(
      JSON.stringify({ type: "candidate_text", question_id: qid, text: transcript })
    );

    setAnswerConfidence(null);
    setLiveTranscript("");
    resetAnswer();
    liveTranscriptRef.current = "";
    finalTranscriptRef.current = "";
    setCodeAnswer("");
  }

  // ── Resume recording after interruption ──────────────────────────
  function continueRecording() {
    setInterrupted(false);
    setInterruptText("");
    interruptedRef.current = false;

    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }

    if (agentAudioRef.current) {
      agentAudioRef.current.pause();
      agentAudioRef.current.currentTime = 0;
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "paused") {
      mediaRecorderRef.current.resume();
    }

    if (recognitionRef.current) {
      try { recognitionRef.current.start(); } catch { /* already running */ }
    }

    if (audioContextRef.current && audioContextRef.current.state === "suspended") {
      audioContextRef.current.resume();
    }
  }

  // ── Code execution helpers ────────────────────────────────────────
  async function runCode(caseIdx?: number) {
    const idx = caseIdx ?? activeCaseIdx;
    const sc = sampleCases[idx];
    const stdin = sc?.input ?? "";
    setRunningCode(true);
    setCodeTab("output");
    try {
      const res = await fetch(`${API_BASE}/code/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lang, code: codeAnswer, stdin }),
      });
      const data = await res.json();
      setRunOutput(data.stdout || data.stderr || "(no output)");
      setExecutionTimeMs(data.execution_time_ms || 0);
      const actual = (data.stdout || "").trim();
      const expected = (sc?.expected || "").trim();
      if (!data.ok) setRunVerdict("error");
      else if (expected && actual === expected) setRunVerdict("pass");
      else if (expected) setRunVerdict("fail");
      else setRunVerdict(null); // no expected output to compare
    } catch {
      setRunOutput("Error: could not reach code runner");
      setRunVerdict("error");
    } finally {
      setRunningCode(false);
    }
  }

  async function runAllCases() {
    if (sampleCases.length === 0) {
      // No test cases — just run once with empty stdin
      await runCode(0);
      return;
    }
    setRunningCode(true);
    setCodeTab("results");
    const results: {idx: number; pass: boolean; stdout: string; ms: number}[] = [];
    for (let i = 0; i < sampleCases.length; i++) {
      const sc = sampleCases[i];
      try {
        const res = await fetch(`${API_BASE}/code/run`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lang, code: codeAnswer, stdin: sc.input }),
        });
        const data = await res.json();
        const actual = (data.stdout || "").trim();
        const expected = (sc.expected || "").trim();
        results.push({ idx: i, pass: data.ok && actual === expected, stdout: data.stdout || "", ms: data.execution_time_ms || 0 });
      } catch {
        results.push({ idx: i, pass: false, stdout: "Runner error", ms: 0 });
      }
    }
    setTestResults(results);
    setRunningCode(false);
  }

  function submitCode() {
    const qid = currentQuestionIdRef.current;
    if (!qid || !wsRef.current) return;

    // submit anti-cheat flags for this question
    submitFlags(qid);

    wsRef.current.send(
      JSON.stringify({
        type: "candidate_code",
        question_id: qid,
        code: codeAnswer,
        lang,
        test_results: testResults.map((r) => ({ case_idx: r.idx, pass: r.pass, ms: r.ms })),
        output: runOutput,
      })
    );

    setCandidateSpeaking(false);
    setAgentStatus("idle");
    setCodeAnswer("");
    setRunOutput("");
    setRunVerdict(null);
    setTestResults([]);
  }

  // ── UI helpers ────────────────────────────────────────────────────
  const minutes = String(Math.floor(timeLeft / 60)).padStart(2, "0");
  const seconds = String(timeLeft % 60).padStart(2, "0");
  const timerColor =
    timeLeft <= 30 ? "text-red-600" : timeLeft <= 60 ? "text-amber-600" : "text-gray-600";

  const confidenceBadge: Record<"low" | "medium" | "high", string> = {
    low:    "bg-red-50 text-red-600 border-red-200",
    medium: "bg-amber-50 text-amber-600 border-amber-200",
    high:   "bg-emerald-50 text-emerald-600 border-emerald-200",
  };

  const statusConfig: Record<typeof agentStatus, { label: string; dotClass: string }> = {
    idle:      { label: "Ready", dotClass: "bg-gray-300" },
    speaking:  { label: "AI Speaking", dotClass: "bg-indigo-500 animate-pulse" },
    listening: { label: "Listening", dotClass: "bg-emerald-500 animate-pulse" },
  };

  const isCodeView = candidateSpeaking && questionType === "code";

  return (
    <div className="flex flex-col h-screen bg-gradient-to-b from-slate-50 to-white text-gray-900">
      <audio ref={agentAudioRef} preload="auto" />

      {/* ── Top Header Bar ── */}
      <header className="flex items-center justify-between px-5 py-3 bg-white border-b border-gray-200 shrink-0">
        {/* Left: Brand */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-cyan-400 flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <Shield className="w-4 h-4 text-white" />
          </div>
          <span className="text-sm font-semibold text-gray-700">AI Interview</span>
        </div>

        {/* Center: Status */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-full px-4 py-1.5">
            <div className={`w-2 h-2 rounded-full ${statusConfig[agentStatus].dotClass}`} />
            <span className="text-xs font-medium text-gray-600">{statusConfig[agentStatus].label}</span>
          </div>
          {candidateSpeaking && questionType === "voice" && (
            <div className={`flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-full px-3 py-1.5 ${interrupted ? "border-amber-300" : ""}`}>
              <Clock className="w-3.5 h-3.5 text-gray-400" />
              <span className={`text-xs font-mono font-bold ${interrupted ? "text-amber-600" : timerColor}`}>
                {interrupted && <span className="text-[10px] mr-1 font-sans">PAUSED</span>}
                {minutes}:{seconds}
              </span>
            </div>
          )}
        </div>

        {/* Right: anti-cheat indicator */}
        <div className="w-32 flex justify-end">
          {cheatFlags.length > 0 && (
            <div className="flex items-center gap-1.5 text-amber-600 bg-amber-50 border border-amber-200 rounded-full px-3 py-1">
              <ShieldAlert className="w-3.5 h-3.5" />
              <span className="text-[10px] font-medium">{cheatFlags.length} flag{cheatFlags.length !== 1 ? "s" : ""}</span>
            </div>
          )}
        </div>
      </header>

      {/* ── Main Content Area ── */}
      <div className={`flex-1 flex min-h-0 ${isCodeView ? "" : "p-4 gap-4"}`}>
        {/* ── Main Panel ── */}
        <div className={`flex-1 flex flex-col ${isCodeView ? "min-h-0" : "gap-4"}`}>

          {/* Question Card */}
          {!isCodeView && (
            <motion.div
              key={questionText}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm"
            >
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-cyan-400 flex items-center justify-center shrink-0 shadow-lg shadow-indigo-500/20">
                  <User className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-medium text-indigo-600">AI Interviewer</span>
                    {isFollowup && (
                      <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full">
                        Follow-up
                      </span>
                    )}
                    <span className="text-[10px] text-gray-400">{statusConfig[agentStatus].label}</span>
                  </div>
                  <p className="text-base text-gray-800 leading-relaxed">
                    {questionText || "Connecting to interview..."}
                  </p>
                </div>
              </div>
            </motion.div>
          )}

          {/* ── Voice Answer Panel ── */}
          <AnimatePresence>
            {candidateSpeaking && questionType === "voice" && (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.3 }}
                className="flex-1 bg-white border border-gray-200 rounded-2xl p-5 flex flex-col gap-4 shadow-sm"
              >
                {/* Recording indicator */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    {interrupted ? (
                      <Pause className="w-4 h-4 text-amber-500" />
                    ) : (
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
                        <Mic className="w-4 h-4 text-red-500" />
                      </div>
                    )}
                    <span className="text-xs font-medium text-gray-500">
                      {interrupted ? "Recording paused" : "Recording..."}
                    </span>
                  </div>

                  {/* Confidence badge */}
                  {answerConfidence && (
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${confidenceBadge[answerConfidence]}`}>
                      {answerConfidence.charAt(0).toUpperCase() + answerConfidence.slice(1)}
                    </span>
                  )}
                </div>

                {/* Waveform animation bars */}
                {!interrupted && (
                  <div className="flex items-end justify-center gap-1 h-8 opacity-60">
                    {Array.from({ length: 24 }).map((_, i) => (
                      <div
                        key={i}
                        className="w-1 bg-indigo-500 rounded-full"
                        style={{
                          height: `${Math.random() * 100}%`,
                          animationName: 'pulse',
                          animationDuration: `${0.5 + Math.random() * 0.8}s`,
                          animationTimingFunction: 'ease-in-out',
                          animationIterationCount: 'infinite',
                          animationDirection: 'alternate',
                          animationDelay: `${i * 0.05}s`,
                        }}
                      />
                    ))}
                  </div>
                )}

                {/* ASR fallback warning */}
                {asrWarning && (
                  <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    {asrWarning}
                  </div>
                )}

                {/* Live transcript */}
                <div className="flex-1 min-h-[3rem] bg-gray-50 rounded-xl p-4 text-sm text-gray-700 leading-relaxed overflow-y-auto">
                  {liveTranscript ? (
                    liveTranscript
                  ) : (
                    <span className="text-gray-300 italic">Start speaking...</span>
                  )}
                </div>

                {/* Interrupt overlay */}
                <AnimatePresence>
                  {interrupted && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.98 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.98 }}
                      className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex flex-col gap-3"
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                        <span className="text-sm font-semibold text-amber-800">Interview Paused</span>
                      </div>
                      <div className="text-sm text-amber-700">{interruptText}</div>
                      <div className="flex gap-3">
                        <button
                          onClick={continueRecording}
                          className="flex-1 flex items-center justify-center gap-2 bg-white hover:bg-gray-50 border border-gray-200 text-gray-700 rounded-xl py-2.5 text-sm font-medium transition-all"
                        >
                          <Play className="w-3.5 h-3.5" />
                          Continue Recording
                        </button>
                        <button
                          onClick={submitAnswer}
                          className="flex-1 flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl py-2.5 text-sm font-medium transition-all"
                        >
                          <Send className="w-3.5 h-3.5" />
                          Submit Answer
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Submit button (hidden during interruption) */}
                {!interrupted && (
                  <button
                    onClick={submitAnswer}
                    className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-600 to-cyan-500 hover:shadow-lg hover:shadow-indigo-500/20 text-white rounded-xl py-3 text-sm font-semibold transition-all hover:-translate-y-0.5"
                  >
                    <Send className="w-4 h-4" />
                    Submit Answer
                  </button>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── Code answer panel — LeetCode-style split pane ── */}
          {candidateSpeaking && questionType === "code" && (
            <div className="flex flex-col flex-1 min-h-0">
              {/* Header bar */}
              <div className="flex items-center justify-between bg-slate-800 border-b border-slate-700 text-white px-4 py-2.5 shrink-0">
                <div className="flex items-center gap-3">
                  <select
                    value={lang}
                    onChange={(e) => {
                      const newLang = e.target.value as Lang;
                      setLang(newLang);
                      if (!codeAnswer || Object.values(LANG_DEFAULTS).includes(codeAnswer)) {
                        setCodeAnswer(LANG_DEFAULTS[newLang]);
                      }
                    }}
                    className="bg-slate-700 text-white text-xs px-2.5 py-1.5 rounded-lg border border-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500/50"
                  >
                    {Object.entries(LANG_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                  <div className="flex items-center gap-1.5 text-slate-400">
                    <Clock className="w-3.5 h-3.5" />
                    <span className="text-xs font-mono">
                      {Math.floor(codeTimerLeft / 60)}:{String(codeTimerLeft % 60).padStart(2, "0")}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => runCode()}
                    disabled={runningCode}
                    className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-xs px-3.5 py-1.5 rounded-lg font-medium transition-colors"
                  >
                    {runningCode ? "Running..." : "Run"}
                  </button>
                  <button
                    onClick={runAllCases}
                    disabled={runningCode}
                    className="bg-amber-600 hover:bg-amber-500 disabled:opacity-40 text-white text-xs px-3.5 py-1.5 rounded-lg font-medium transition-colors"
                  >
                    Run All
                  </button>
                  <button
                    onClick={submitCode}
                    className="bg-gradient-to-r from-indigo-600 to-cyan-500 hover:shadow-lg hover:shadow-indigo-500/20 text-white text-xs px-4 py-1.5 rounded-lg font-medium transition-all"
                  >
                    Submit
                  </button>
                </div>
              </div>

              {/* Split pane: left = problem, right = editor + output */}
              <div className="flex flex-1 min-h-0 overflow-hidden">
                {/* Left panel: Problem description + test cases */}
                <div className="w-2/5 bg-white border-r border-gray-200 overflow-y-auto p-5 flex flex-col gap-4">
                  <h3 className="font-semibold text-sm text-gray-900">{questionText}</h3>
                  <div className="text-sm text-gray-600 whitespace-pre-wrap leading-relaxed">
                    {codeDescription}
                  </div>

                  {sampleCases.length > 0 && (
                    <div className="mt-2">
                      <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Sample Test Cases</div>
                      {sampleCases.map((sc, i) => (
                        <div
                          key={i}
                          className={`mb-2 p-3 rounded-xl border text-xs font-mono transition-all cursor-pointer ${
                            activeCaseIdx === i
                              ? "border-indigo-300 bg-indigo-50"
                              : "border-gray-200 bg-gray-50 hover:bg-gray-100"
                          }`}
                          onClick={() => setActiveCaseIdx(i)}
                        >
                          <div className="flex items-center gap-2 mb-1.5">
                            <span className="font-semibold text-gray-500">Case {i + 1}</span>
                            {testResults[i] && (
                              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                                testResults[i].pass ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
                              }`}>
                                {testResults[i].pass ? "PASS" : "FAIL"}
                              </span>
                            )}
                          </div>
                          <div className="text-gray-400">Input:</div>
                          <pre className="text-gray-700 whitespace-pre-wrap">{sc.input}</pre>
                          <div className="text-gray-400 mt-1">Expected:</div>
                          <pre className="text-gray-700 whitespace-pre-wrap">{sc.expected}</pre>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Right panel: Monaco editor + output tabs */}
                <div className="w-3/5 flex flex-col min-h-0">
                  {/* Monaco editor */}
                  <div className="flex-1 min-h-0">
                    <Monaco
                      language={LANG_MONACO[lang]}
                      theme="vs-dark"
                      value={codeAnswer}
                      onChange={(v) => setCodeAnswer(v || "")}
                      onMount={(editor) => {
                        editor.onDidPaste(() => addFlag("editor-paste"));
                      }}
                      options={{
                        fontSize: 14,
                        minimap: { enabled: false },
                        scrollBeyondLastLine: false,
                        wordWrap: "on",
                        padding: { top: 8 },
                      }}
                    />
                  </div>

                  {/* Output tabs */}
                  <div className="h-40 border-t border-slate-700 bg-slate-900 flex flex-col">
                    <div className="flex border-b border-slate-700">
                      {(["cases", "output", "results"] as const).map((tab) => (
                        <button
                          key={tab}
                          onClick={() => setCodeTab(tab)}
                          className={`px-4 py-2 text-xs font-medium transition-colors ${
                            codeTab === tab
                              ? "text-white border-b-2 border-indigo-400"
                              : "text-slate-400 hover:text-slate-200"
                          }`}
                        >
                          {tab === "cases" ? "Test Cases" : tab === "output" ? "Output" : "Results"}
                        </button>
                      ))}
                      {executionTimeMs > 0 && (
                        <span className="ml-auto text-[10px] text-slate-500 self-center pr-3">
                          {executionTimeMs}ms
                        </span>
                      )}
                    </div>
                    <div className="flex-1 overflow-y-auto p-3 text-xs font-mono text-slate-300">
                      {codeTab === "cases" && sampleCases[activeCaseIdx] && (
                        <div>
                          <div className="text-slate-500">Input:</div>
                          <pre className="text-slate-200 whitespace-pre-wrap">{sampleCases[activeCaseIdx].input}</pre>
                          <div className="text-slate-500 mt-2">Expected:</div>
                          <pre className="text-slate-200 whitespace-pre-wrap">{sampleCases[activeCaseIdx].expected}</pre>
                        </div>
                      )}
                      {codeTab === "output" && (
                        <div>
                          {runVerdict && (
                            <span className={`inline-block mb-2 text-[10px] px-2 py-0.5 rounded-full font-bold ${
                              runVerdict === "pass" ? "bg-emerald-900 text-emerald-300" :
                              runVerdict === "fail" ? "bg-red-900 text-red-300" :
                              "bg-amber-900 text-amber-300"
                            }`}>
                              {runVerdict.toUpperCase()}
                            </span>
                          )}
                          <pre className="text-slate-200 whitespace-pre-wrap">{runOutput || "Run your code to see output"}</pre>
                        </div>
                      )}
                      {codeTab === "results" && (
                        <div className="space-y-1.5">
                          {testResults.length === 0 && <span className="text-slate-500">Click &quot;Run All&quot; to test all cases</span>}
                          {testResults.map((r) => (
                            <div key={r.idx} className="flex items-center gap-2">
                              <span className={`w-12 text-center text-[10px] px-1.5 py-0.5 rounded-lg font-bold ${
                                r.pass ? "bg-emerald-900 text-emerald-300" : "bg-red-900 text-red-300"
                              }`}>
                                {r.pass ? "PASS" : "FAIL"}
                              </span>
                              <span className="text-slate-400">Case {r.idx + 1}</span>
                              <span className="text-slate-600 ml-auto">{r.ms}ms</span>
                            </div>
                          ))}
                          {testResults.length > 0 && (
                            <div className="mt-2 pt-2 border-t border-slate-700 text-slate-400">
                              {testResults.filter((r) => r.pass).length}/{testResults.length} passed
                              {" | "}
                              Total: {testResults.reduce((s, r) => s + r.ms, 0)}ms
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── Idle state — waiting for connection ── */}
          {!candidateSpeaking && !interviewDone && !questionText && (
            <div className="flex-1 flex items-center justify-center">
              <div className="flex flex-col items-center gap-3 text-gray-400">
                <div className="w-12 h-12 rounded-full border-2 border-gray-200 border-t-indigo-500 animate-spin" />
                <span className="text-sm">Connecting to interview...</span>
              </div>
            </div>
          )}

          {/* ── Interview complete ── */}
          <AnimatePresence>
            {interviewDone && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex-1 flex items-center justify-center"
              >
                <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6 flex items-center gap-4 max-w-md">
                  <CheckCircle2 className="w-8 h-8 text-emerald-500 shrink-0" />
                  <div>
                    <div className="text-sm font-semibold text-emerald-800">Interview Complete</div>
                    <div className="text-xs text-emerald-600 mt-1">Scoring your answers. Redirecting to evaluation...</div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ── Camera Sidebar ── */}
        {!isCodeView ? (
          <aside className="w-[280px] shrink-0 flex flex-col gap-3">
            <div className="flex-1 bg-gray-900 border border-gray-200 rounded-2xl overflow-hidden relative shadow-sm">
              <video
                ref={candidateVideoRef}
                autoPlay
                muted
                playsInline
                className="w-full h-full object-cover"
              />
              {/* Gradient overlay at bottom */}
              <div className="absolute bottom-0 inset-x-0 h-16 bg-gradient-to-t from-black/60 to-transparent" />
              {/* Name label */}
              <div className="absolute bottom-3 left-3 flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${candidateSpeaking ? "bg-red-500 animate-pulse" : "bg-emerald-400"}`} />
                <span className="text-xs font-medium text-white/90">You</span>
              </div>
              {/* Recording indicator */}
              {candidateSpeaking && (
                <div className="absolute top-3 right-3 flex items-center gap-1.5 bg-red-500/20 backdrop-blur-sm border border-red-500/30 rounded-full px-2.5 py-1">
                  <Radio className="w-3 h-3 text-red-400" />
                  <span className="text-[10px] font-medium text-red-300">REC</span>
                </div>
              )}
            </div>
          </aside>
        ) : (
          <aside className="w-[180px] shrink-0 bg-gray-50 border-l border-gray-200 p-3 flex flex-col gap-2">
            <div className="flex-1 bg-gray-900 border border-gray-200 rounded-xl overflow-hidden relative">
              <video
                ref={candidateVideoRef}
                autoPlay
                muted
                playsInline
                className="w-full h-full object-cover"
              />
              <div className="absolute bottom-0 inset-x-0 h-10 bg-gradient-to-t from-black/60 to-transparent" />
              <div className="absolute bottom-2 left-2 flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                <span className="text-[10px] font-medium text-white/80">You</span>
              </div>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
