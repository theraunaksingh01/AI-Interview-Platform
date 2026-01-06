"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";

export const dynamic = "force-dynamic";

/* ---------------- Types ---------------- */

type ChatMessage = {
  id: number;
  from: "agent" | "candidate" | "system";
  text: string;
  questionId?: number | null;
};

type WSMessage =
  | {
      type: "agent_message";
      text: string;
      question_id?: number;
      done?: boolean;
      audio_url?: string;
    }
  | { type: "scoring_started"; turn_id: number; question_id?: number; task_id: string }
  | { type: "error"; message: string }
  | { type: string; [key: string]: any };

let messageIdCounter = 1;

// Debug visible only in dev
const SHOW_DEBUG =
  process.env.NEXT_PUBLIC_SHOW_DEBUG === "true" ||
  process.env.NODE_ENV === "development";

/* ---------------- Component ---------------- */

export default function LiveInterviewPage() {
  const params = useParams();
  const interviewId = params.id as string;

  const wsRef = useRef<WebSocket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const [connected, setConnected] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [currentQuestionId, setCurrentQuestionId] = useState<number | null>(null);
  const [answerText, setAnswerText] = useState("");
  const [log, setLog] = useState<string[]>([]);
  const [isFinished, setIsFinished] = useState(false);
  const [isScoring, setIsScoring] = useState(false);

  /* -------- Recording (candidate voice answers) -------- */

  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<BlobPart[]>([]);

  /* -------- Agent audio / TTS handling -------- */

  const [isAgentSpeaking, setIsAgentSpeaking] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(false);

  const userGestureRef = useRef(false);
  const pendingAudioRef = useRef<{ fullUrl: string; text: string }[]>([]);
  const ttsQueueRef = useRef<string[]>([]);
  const ttsProcessingRef = useRef(false);

  /* ---------------- Helpers ---------------- */

  function appendLog(line: string) {
    setLog((prev) => [...prev, line]);
  }

  function addMessage(partial: Omit<ChatMessage, "id">) {
    setMessages((prev) => [
      ...prev,
      {
        id: messageIdCounter++,
        ...partial,
      },
    ]);
  }

  function addSystemMessage(text: string) {
    addMessage({ from: "system", text });
  }

  /* ---------------- Audio Enable (Autoplay Policy) ---------------- */

  function enableAudio() {
    if (userGestureRef.current) return;
    userGestureRef.current = true;
    setAudioEnabled(true);
    appendLog("Audio enabled by user gesture.");

    (async () => {
      while (pendingAudioRef.current.length > 0) {
        const p = pendingAudioRef.current.shift()!;
        try {
          const audio = new Audio(p.fullUrl);
          setIsAgentSpeaking(true);
          await audio.play();
          setIsAgentSpeaking(false);
        } catch {
          enqueueSpeak(p.text);
        }
      }
    })();
  }

  useEffect(() => {
    function onClick() {
      enableAudio();
    }
    window.addEventListener("click", onClick);
    return () => window.removeEventListener("click", onClick);
  }, []);

  /* ---------------- Browser TTS (fallback) ---------------- */

  function speakViaBrowser(text: string) {
    if (!("speechSynthesis" in window)) return Promise.resolve();

    return new Promise<void>((resolve) => {
      const u = new SpeechSynthesisUtterance(text);
      u.rate = 1;
      u.pitch = 1;
      u.onstart = () => setIsAgentSpeaking(true);
      u.onend = () => {
        setIsAgentSpeaking(false);
        resolve();
      };
      u.onerror = () => {
        setIsAgentSpeaking(false);
        resolve();
      };
      window.speechSynthesis.speak(u);
    });
  }

  async function enqueueSpeak(text: string) {
    if (!text.trim()) return;
    ttsQueueRef.current.push(text);
    if (ttsProcessingRef.current) return;

    ttsProcessingRef.current = true;
    while (ttsQueueRef.current.length > 0) {
      const t = ttsQueueRef.current.shift()!;
      if (!userGestureRef.current) {
        appendLog("Waiting for user gesture to enable audio...");
        await new Promise((r) => window.addEventListener("click", r, { once: true }));
      }
      await speakViaBrowser(t);
      await new Promise((r) => setTimeout(r, 120));
    }
    ttsProcessingRef.current = false;
  }

  async function playAgentAudioOrTTS(m: any) {
    const text = m.text ?? "";
    if (m.audio_url) {
      const base = process.env.NEXT_PUBLIC_API_BASE || "";
      const full = m.audio_url.startsWith("http") ? m.audio_url : `${base}${m.audio_url}`;
      try {
        const audio = new Audio(full);
        setIsAgentSpeaking(true);
        await audio.play();
        setIsAgentSpeaking(false);
        return;
      } catch {
        pendingAudioRef.current.push({ fullUrl: full, text });
      }
    }
    enqueueSpeak(text);
  }

  /* ---------------- WebSocket ---------------- */

  useEffect(() => {
    if (!interviewId) return;

    const wsBase = process.env.NEXT_PUBLIC_WS_BASE || "ws://localhost:8000";
    const ws = new WebSocket(`${wsBase}/ws/interview/${interviewId}`);
    wsRef.current = ws;

    appendLog("Connecting to WebSocket…");

    ws.onopen = () => {
      setConnected(true);
      addSystemMessage("Connected. Waiting for agent…");
    };

    ws.onclose = () => {
      setConnected(false);
      addSystemMessage("Connection closed.");
    };

    ws.onmessage = (e) => {
      appendLog(`RAW_WS: ${e.data}`);
      const msg: WSMessage = JSON.parse(e.data);
      handleWSMessage(msg);
    };

    return () => ws.close();
  }, [interviewId]);

  function handleWSMessage(msg: WSMessage) {
    if (msg.type === "agent_message") {
      addMessage({
        from: "agent",
        text: msg.text,
        questionId: msg.question_id ?? null,
      });

      if (msg.question_id) {
        setCurrentQuestionId(msg.question_id);
      }

      void playAgentAudioOrTTS(msg);

      if (msg.done) {
        setIsFinished(true);
        addSystemMessage("Interview completed.");
      }
    }

    if (msg.type === "scoring_started") {
      setIsScoring(true);
      addSystemMessage("Scoring your answer…");
    }

    if (msg.type === "error") {
      addSystemMessage(`Error: ${msg.message}`);
    }
  }

  /* ---------------- Candidate Answer ---------------- */

  function sendAnswer() {
    if (!wsRef.current || !currentQuestionId) return;
    wsRef.current.send(
      JSON.stringify({
        type: "candidate_text",
        question_id: currentQuestionId,
        text: answerText.trim(),
      }),
    );
    addMessage({ from: "candidate", text: answerText, questionId: currentQuestionId });
    setAnswerText("");
  }

  async function startRecording() {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mr = new MediaRecorder(stream);
    audioChunksRef.current = [];
    mr.ondataavailable = (e) => audioChunksRef.current.push(e.data);
    mr.onstop = () => uploadAndTranscribe();
    mr.start();
    mediaRecorderRef.current = mr;
    setIsRecording(true);
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
  }

  async function uploadAndTranscribe() {
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
  <div
    style={{
      height: "100vh",
      display: "grid",
      gridTemplateColumns: "1fr 480px",
      background: "#0b1220",
      color: "#e5e7eb",
      fontFamily: "Inter, system-ui, sans-serif",
    }}
  >
    {/* ===== MAIN INTERVIEW CANVAS ===== */}
    <main
      style={{
        padding: 24,
        display: "flex",
        flexDirection: "column",
        gap: 16,
      }}
    >
      {/* Interviewer Identity (Fabric-like) */}
      <header
        style={{
          display: "flex",
          alignItems: "center",
          gap: 14,
          paddingBottom: 12,
          borderBottom: "1px solid #1f2937",
        }}
      >
        <img
          src="/avatar/interviewer.jpg"
          alt="AI Interviewer"
          style={{
            width: 52,
            height: 52,
            borderRadius: "50%",
            border: "2px solid #334155",
          }}
        />
        <div>
          <div style={{ fontWeight: 600, fontSize: 16 }}>AI Interviewer</div>
          <div style={{ fontSize: 12, color: "#9ca3af" }}>
            {isAgentSpeaking ? "Speaking…" : "Live interview"}
          </div>
        </div>
      </header>

      {/* Enable audio CTA */}
      {!audioEnabled && (
        <div
          style={{
            background: "#111827",
            padding: 12,
            borderRadius: 8,
            fontSize: 14,
          }}
        >
          <button
            onClick={enableAudio}
            style={{
              background: "#2563eb",
              color: "white",
              padding: "10px 16px",
              borderRadius: 6,
              border: "none",
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            Enable audio & start interview
          </button>
          <div style={{ marginTop: 8, fontSize: 12, color: "#9ca3af" }}>
            Required once due to browser audio policies.
          </div>
        </div>
      )}

      {/* Conversation Stream */}
      <section
        style={{
          flex: 1,
          overflowY: "auto",
          background: "#020617",
          borderRadius: 12,
          padding: 16,
        }}
      >
        {messages.map((m) => {
          const isAgent = m.from === "agent";
          const isCandidate = m.from === "candidate";

          return (
            <div
              key={m.id}
              style={{
                marginBottom: 16,
                display: "flex",
                justifyContent: isCandidate ? "flex-end" : "flex-start",
              }}
            >
              <div
                style={{
                  maxWidth: "75%",
                  padding: "10px 14px",
                  borderRadius: 12,
                  background: isAgent ? "#1e293b" : "#2563eb",
                  color: "white",
                  fontSize: 14,
                }}
              >
                {m.text}
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </section>

      {/* Answer Controls */}
      <div>
        <textarea
          rows={3}
          value={answerText}
          onChange={(e) => setAnswerText(e.target.value)}
          disabled={!currentQuestionId || isFinished}
          placeholder="Speak or type your answer…"
          style={{
            width: "100%",
            borderRadius: 8,
            padding: 12,
            background: "#020617",
            border: "1px solid #1f2937",
            color: "white",
          }}
        />

        <div style={{ display: "flex", gap: 12, marginTop: 10 }}>
          <button
            onClick={sendAnswer}
            disabled={!answerText.trim()}
            style={{
              padding: "8px 14px",
              borderRadius: 6,
              background: "#22c55e",
              border: "none",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Send
          </button>

          <button
            onClick={isRecording ? stopRecording : startRecording}
            style={{
              padding: "8px 14px",
              borderRadius: 6,
              background: "#1f2937",
              border: "1px solid #334155",
              color: "white",
              cursor: "pointer",
            }}
          >
            {isRecording ? "Stop recording" : "🎙 Record"}
          </button>
        </div>
      </div>
    </main>

    {/* ===== STATUS SIDEBAR ===== */}
    <aside
      style={{
        padding: 16,
        borderLeft: "1px solid #1f2937",
        background: "#020617",
      }}
    >
      <h3 style={{ marginBottom: 12 }}>Interview Status</h3>
      <p>Question: {currentQuestionId ?? "Waiting…"}</p>
      <p>Status: {connected ? "Connected" : "Disconnected"}</p>
      {isAgentSpeaking && <p style={{ marginTop: 8 }}>🔊 Agent speaking</p>}

      {SHOW_DEBUG && (
        <pre
          style={{
            fontSize: 11,
            marginTop: 16,
            color: "#9ca3af",
            whiteSpace: "pre-wrap",
          }}
        >
          {log.join("\n")}
        </pre>
      )}
    </aside>
  </div>
);
}