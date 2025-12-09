"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";

export const dynamic = "force-dynamic";

type ChatMessage = {
  id: number;
  from: "agent" | "candidate" | "system";
  text: string;
  questionId?: number | null;
};

type WSMessage =
  | { type: "agent_message"; text: string; question_id?: number; done?: boolean; audio_url?: string }
  | { type: "scoring_started"; turn_id: number; question_id?: number; task_id: string }
  | { type: "error"; message: string }
  | { type: string; [key: string]: any };

let messageIdCounter = 1;

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

  // 🔊 recording state
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<BlobPart[]>([]);

  // 🔊 agent speaking state (for small UI indicator)
  const [isAgentSpeaking, setIsAgentSpeaking] = useState(false);

  // ----------------- TTS queue + playback refs -----------------
  const ttsQueueRef = useRef<string[]>([]);
  const ttsProcessingRef = useRef(false);
  const userGestureRef = useRef(false);

  // pending audio attempts to retry after user gesture
  const pendingAudioRef = useRef<{ fullUrl: string; text: string }[]>([]);

  // UI state for audio enablement button
  const [audioEnabled, setAudioEnabled] = useState(false);

  // record a user gesture so autoplay policies allow audio
  useEffect(() => {
    function handleUserGesture() {
      // If user clicks anywhere (fallback), act as enabling audio.
      enableAudio();
    }
    window.addEventListener("click", handleUserGesture);
    return () => window.removeEventListener("click", handleUserGesture);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // function to enable audio (call on explicit button click or initial document click)
  function enableAudio() {
    if (userGestureRef.current) return;
    userGestureRef.current = true;
    setAudioEnabled(true);
    appendLog("Audio enabled by user gesture.");

    // drain pending audio attempts sequentially
    (async () => {
      try {
        while (pendingAudioRef.current.length > 0) {
          const p = pendingAudioRef.current.shift()!;
          appendLog("Retrying queued audio...");
          try {
            const audio = new Audio(p.fullUrl);
            audio.onended = () => setIsAgentSpeaking(false);
            audio.onerror = (ev) => {
              console.warn("retry audio playback failed, falling back to TTS", ev);
              enqueueSpeak(p.text);
            };
            setIsAgentSpeaking(true);
            const playPromise = audio.play();
            if (playPromise !== undefined) {
              await playPromise.catch((err) => {
                console.warn("retry audio.play() rejected, fallback to TTS", err);
                setIsAgentSpeaking(false);
                enqueueSpeak(p.text);
              });
            }
          } catch (err) {
            console.warn("Exception retrying queued audio, fallback to TTS", err);
            enqueueSpeak(p.text);
          }
          // tiny gap
          await new Promise((r) => setTimeout(r, 120));
        }
      } catch (e) {
        console.error("Error draining pending audio", e);
      }
    })();
  }

  // low-level speak via browser speechSynthesis, returns a promise that resolves when finished
  function _speakViaBrowser(text: string) {
    if (typeof window === "undefined") return Promise.resolve();
    if (!("speechSynthesis" in window)) {
      appendLog("speechSynthesis not available in this browser.");
      return Promise.resolve();
    }
    return new Promise<void>((resolve) => {
      try {
        const u = new SpeechSynthesisUtterance(text);
        u.rate = 1.0;
        u.pitch = 1.0;
        u.onstart = () => setIsAgentSpeaking(true);
        u.onend = () => {
          setIsAgentSpeaking(false);
          resolve();
        };
        u.onerror = (err) => {
          console.error("speechSynthesis error", err);
          setIsAgentSpeaking(false);
          resolve();
        };
        window.speechSynthesis.speak(u);
      } catch (e) {
        console.error("speak failed", e);
        setIsAgentSpeaking(false);
        resolve();
      }
    });
  }

  // queueing wrapper so utterances don't cut each other off
  async function enqueueSpeak(text: string) {
    if (!text || !text.trim()) return;
    ttsQueueRef.current.push(text);
    if (ttsProcessingRef.current) return;
    ttsProcessingRef.current = true;

    while (ttsQueueRef.current.length > 0) {
      const t = ttsQueueRef.current.shift()!;

      // wait for a user gesture or a short timeout (autoplay rules)
      if (!userGestureRef.current) {
        appendLog("Waiting for user gesture to enable audio (click anywhere)...");
        await new Promise<void>((res) => {
          let done = false;
          function onClick() {
            if (done) return;
            done = true;
            res();
          }
          window.addEventListener("click", onClick, { once: true });
          setTimeout(() => {
            if (!done) {
              done = true;
              res();
            }
          }, 5000);
        });
      }

      await _speakViaBrowser(t).catch(() => {});
      // small gap between utterances
      // eslint-disable-next-line no-await-in-loop
      await new Promise((r) => setTimeout(r, 120));
    }

    ttsProcessingRef.current = false;
  }

  // play server audio_url if present, otherwise fallback to enqueueSpeak(browser TTS)
  async function playAgentAudioOrTTS(m: any) {
    const audioUrl = m.audio_url ?? null;
    const text = m.text ?? "";

    if (audioUrl) {
      const base = process.env.NEXT_PUBLIC_API_BASE || "";
      const full = audioUrl.startsWith("http") ? audioUrl : `${base}${audioUrl}`;
      try {
        const audio = new Audio(full);
        audio.onended = () => setIsAgentSpeaking(false);
        audio.onerror = (ev) => {
          console.warn("audio playback failed, falling back to TTS", ev);
          enqueueSpeak(text);
        };
        setIsAgentSpeaking(true);

        const playPromise = audio.play();
        if (playPromise !== undefined) {
          await playPromise.catch((err) => {
            // play rejected — queue for retry after explicit user gesture
            console.warn("audio.play() rejected, queuing for retry after gesture", err);
            setIsAgentSpeaking(false);
            pendingAudioRef.current.push({ fullUrl: full, text });
            appendLog("Queued audio for retry after user gesture");
          });
        }
        return;
      } catch (e) {
        console.warn("Exception while playing audio_url, fallback to TTS", e);
        setIsAgentSpeaking(false);
        enqueueSpeak(text);
        return;
      }
    }

    // no server audio — use browser TTS
    enqueueSpeak(text);
  }

  // Auto-scroll chat
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  useEffect(() => {
    if (!interviewId) return;

    const wsBase = process.env.NEXT_PUBLIC_WS_BASE || "ws://localhost:8000";
    const wsUrl = `${wsBase}/ws/interview/${interviewId}`;

    appendLog(`Connecting to ${wsUrl}...`);
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      appendLog("WebSocket connected");
      addSystemMessage("Connected to interview. Waiting for agent…");
    };

    ws.onclose = () => {
      setConnected(false);
      appendLog("WebSocket closed");
      addSystemMessage("Connection closed.");
    };

    ws.onerror = (ev) => {
      appendLog("WebSocket error");
      console.error(ev);
      addSystemMessage("A connection error occurred.");
    };

    ws.onmessage = (event) => {
      // raw log to UI debug box
      appendLog(`RAW_WS: ${event.data}`);

      try {
        const msg: WSMessage = JSON.parse(event.data);
        appendLog(`PARSED_WS type=${msg.type}`);
        handleWSMessage(msg);
      } catch (e) {
        console.error("Error parsing WS message", e);
        appendLog("Error parsing WS message: " + String(e));
      }
    };

    return () => {
      try {
        ws.close();
      } catch (e) {
        // ignore
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interviewId]);

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
    addMessage({ from: "system", text, questionId: null });
  }

  function handleWSMessage(msg: WSMessage) {
    if (msg.type === "agent_message") {
      const m = msg as WSMessage & { text: string; question_id?: number; done?: boolean; audio_url?: string };

      addMessage({
        from: "agent",
        text: m.text,
        questionId: m.question_id ?? null,
      });

      // accept both question_id or questionId (defensive)
      const qid = (m as any).question_id ?? (m as any).questionId ?? null;
      if (qid !== null && !Number.isNaN(Number(qid))) {
        setCurrentQuestionId(Number(qid));
        appendLog(`Agent asked question_id=${qid}`);
      } else {
        appendLog(`Agent says: ${m.text}`);
      }

      // Play server audio (if provided) else use browser TTS fallback (queued)
      void playAgentAudioOrTTS(m);

      setIsScoring(false);

      if (m.done) {
        setIsFinished(true);
        appendLog("Interview finished by agent.");
        addSystemMessage("Interview completed. Thank you for your time!");
      }
    } else if (msg.type === "scoring_started") {
      const m = msg as { type: string; turn_id: number; question_id?: number; task_id: string };
      setIsScoring(true);
      appendLog(
        `Scoring started for turn_id=${m.turn_id}, question_id=${m.question_id}, task_id=${m.task_id}`,
      );
      addSystemMessage("Scoring your answer…");
    } else if (msg.type === "error") {
      const m = msg as { type: string; message: string };
      appendLog(`ERROR: ${m.message}`);
      addSystemMessage(`Error: ${m.message}`);
    } else {
      appendLog(`Unknown WS message: ${JSON.stringify(msg)}`);
      addSystemMessage("Received an unknown message from server.");
    }
  }

  function sendAnswer() {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      appendLog("Cannot send, WS not open");
      addSystemMessage("Cannot send answer: connection not open.");
      return;
    }
    if (!answerText.trim()) {
      appendLog("Cannot send empty answer");
      return;
    }
    if (!currentQuestionId) {
      appendLog("No currentQuestionId set");
      addSystemMessage("No active question to answer yet.");
      return;
    }

    const trimmed = answerText.trim();

    const payload = {
      type: "candidate_text",
      question_id: currentQuestionId,
      text: trimmed,
    };

    try {
      wsRef.current.send(JSON.stringify(payload));
      appendLog(`Sent answer for question_id=${currentQuestionId}`);
    } catch (e) {
      appendLog("Failed to send answer over WebSocket: " + String(e));
    }

    addMessage({
      from: "candidate",
      text: trimmed,
      questionId: currentQuestionId,
    });

    setAnswerText("");
  }

  // 🔊 Start recording audio
  async function startRecording() {
    if (!currentQuestionId || isFinished || isScoring) {
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        void uploadAndTranscribe();
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
      setIsRecording(true);
      addSystemMessage("Recording started. Speak your answer...");
      appendLog("Recording started");
    } catch (err) {
      console.error("Error starting recording", err);
      addSystemMessage("Could not access microphone. Please check permissions.");
    }
  }

  function stopRecording() {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      addSystemMessage("Recording stopped. Transcribing your answer…");
      appendLog("Recording stopped");
    }
  }

  async function uploadAndTranscribe() {
    if (!currentQuestionId) {
      addSystemMessage("No active question to attach audio to.");
      return;
    }

    const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
    audioChunksRef.current = [];

    const formData = new FormData();
    formData.append("file", blob, "answer.webm");
    formData.append("question_id", String(currentQuestionId));

    try {
      const apiBase = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";

      const res = await fetch(
        `${apiBase}/api/interview/${interviewId}/transcribe_audio`,
        {
          method: "POST",
          body: formData,
        },
      );

      if (!res.ok) {
        addSystemMessage("Failed to transcribe audio. Please try again or type your answer.");
        appendLog(`Transcription failed with status ${res.status}`);
        return;
      }

      const data: { transcript: string; question_id?: number } = await res.json();
      const transcript = data.transcript || "";

      if (!transcript) {
        addSystemMessage("Transcription returned empty text. Please try again or type your answer.");
        return;
      }

      setAnswerText(transcript);
      addSystemMessage("Transcription ready. Review or edit your answer, then click Send.");
      appendLog(`Transcription received: ${transcript.slice(0, 80)}...`);
    } catch (err) {
      console.error("Error uploading audio", err);
      addSystemMessage("Error uploading audio. Please try again or type your answer.");
    }
  }

  const isSendDisabled =
    !connected || !currentQuestionId || isFinished || !answerText.trim() || isScoring;

  return (
    <div
      style={{
        padding: 24,
        fontFamily: "sans-serif",
        maxWidth: 900,
        margin: "0 auto",
        display: "flex",
        flexDirection: "column",
        gap: 16,
        height: "100vh",
      }}
    >
      <header>
        <h1>Live Interview</h1>
        <p>
          Interview ID: <b>{interviewId}</b>
        </p>
        <p>
          WebSocket status:{" "}
          <b style={{ color: connected ? "green" : "red" }}>
            {connected ? "Connected" : "Disconnected"}
          </b>
        </p>

        {/* prominent enable-audio CTA */}
        {!audioEnabled && (
          <div style={{ marginTop: 12 }}>
            <button
              onClick={enableAudio}
              style={{
                padding: "10px 16px",
                background: "#2563eb",
                color: "white",
                border: "none",
                borderRadius: 6,
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              Enable audio & start interview
            </button>
            <div style={{ fontSize: 12, color: "#666", marginTop: 8 }}>
              Click the button to enable agent voice playback (required by browser autoplay policies).
            </div>
          </div>
        )}

        {isAgentSpeaking && (
          <p style={{ fontSize: 12, color: "#555", marginTop: 4 }}>
            🔊 Agent is speaking…
          </p>
        )}
      </header>

      {/* Chat area */}
      <section
        style={{
          flex: 1,
          border: "1px solid #ddd",
          borderRadius: 8,
          padding: 16,
          overflowY: "auto",
          background: "#fafafa",
        }}
      >
        {messages.length === 0 && (
          <p style={{ color: "#777" }}>Waiting for agent to start the interview…</p>
        )}

        {messages.map((m) => {
          const isAgent = m.from === "agent";
          const isCandidate = m.from === "candidate";
          const isSystem = m.from === "system";

          const align = isCandidate ? "flex-end" : "flex-start";
          const bg = isSystem ? "#eee" : isAgent ? "#e3f2fd" : "#e8f5e9";
          const color = "#111";
          const label = isSystem ? "" : isAgent ? "Agent" : "You";

          return (
            <div
              key={m.id}
              style={{
                display: "flex",
                justifyContent: align,
                marginBottom: 8,
              }}
            >
              <div
                style={{
                  maxWidth: "75%",
                  background: bg,
                  color,
                  borderRadius: 8,
                  padding: "8px 12px",
                  fontSize: 14,
                  boxShadow: "0 1px 2px rgba(0,0,0,0.08)",
                }}
              >
                {label && (
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      marginBottom: 4,
                      opacity: 0.7,
                    }}
                  >
                    {label}{" "}
                    {m.questionId ? (
                      <span style={{ fontWeight: 400 }}>· Q {m.questionId}</span>
                    ) : null}
                  </div>
                )}
                <div>{m.text}</div>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </section>

      {/* Answer input + mic controls */}
      <section>
        <h2 style={{ marginBottom: 8 }}>Your Answer</h2>
        <p style={{ marginBottom: 8 }}>
          Current question id:{" "}
          <b>{currentQuestionId ? currentQuestionId : "none (waiting for agent question)"}</b>
        </p>
        <textarea
          rows={4}
          style={{ width: "100%", marginBottom: 8, padding: 8, borderRadius: 6, border: "1px solid #ccc" }}
          value={answerText}
          onChange={(e) => setAnswerText(e.target.value)}
          disabled={!connected || isFinished || !currentQuestionId || isScoring}
          placeholder={
            isFinished
              ? "Interview is completed."
              : !currentQuestionId
              ? "Waiting for the next question from the agent…"
              : "Type your answer or use the mic to speak your answer…"
          }
        />
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <button
            onClick={sendAnswer}
            disabled={isSendDisabled}
            style={{
              padding: "8px 16px",
              borderRadius: 6,
              border: "none",
              cursor: isSendDisabled ? "not-allowed" : "pointer",
              opacity: isSendDisabled ? 0.6 : 1,
            }}
          >
            Send Answer
          </button>

          <button
            type="button"
            onClick={isRecording ? stopRecording : startRecording}
            disabled={!connected || !currentQuestionId || isFinished || isScoring}
            style={{
              padding: "8px 16px",
              borderRadius: 6,
              border: "1px solid #ccc",
              cursor:
                !connected || !currentQuestionId || isFinished || isScoring
                  ? "not-allowed"
                  : "pointer",
              opacity:
                !connected || !currentQuestionId || isFinished || isScoring
                  ? 0.6
                  : 1,
            }}
          >
            {isRecording ? "Stop & Transcribe" : "🎙 Record Answer"}
          </button>

          {isScoring && <span>Scoring in progress…</span>}
        </div>
      </section>

      {/* Debug log */}
      <section>
        <h2>Debug Log</h2>
        <pre
          style={{
            background: "#111",
            color: "#0f0",
            padding: 12,
            fontSize: 12,
            maxHeight: 180,
            overflow: "auto",
            borderRadius: 6,
          }}
        >
          {log.join("\n")}
        </pre>
      </section>
    </div>
  );
}
