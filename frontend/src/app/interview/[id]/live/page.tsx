// src/app/interview/[interviewId]/live/page.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";

type AgentMessage = {
  text: string;
  question_id?: number;
};

type WSMessage =
  | { type: "agent_message"; text: string; question_id?: number; done?: boolean }
  | { type: "scoring_started"; turn_id: number; question_id?: number; task_id: string }
  | { type: "error"; message: string }
  | { type: string; [key: string]: any };

export default function LiveInterviewPage() {
  const params = useParams();
  const interviewId = params.id as string; 

  const wsRef = useRef<WebSocket | null>(null);

  const [connected, setConnected] = useState(false);
  const [agentMessages, setAgentMessages] = useState<AgentMessage[]>([]);
  const [currentQuestionId, setCurrentQuestionId] = useState<number | null>(null);
  const [answerText, setAnswerText] = useState("");
  const [log, setLog] = useState<string[]>([]);
  const [isFinished, setIsFinished] = useState(false);
  const [isScoring, setIsScoring] = useState(false);

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
    };

    ws.onclose = () => {
      setConnected(false);
      appendLog("WebSocket closed");
    };

    ws.onerror = (ev) => {
      appendLog("WebSocket error");
      console.error(ev);
    };

    ws.onmessage = (event) => {
      try {
        const msg: WSMessage = JSON.parse(event.data);
        handleWSMessage(msg);
      } catch (e) {
        console.error("Error parsing WS message", e);
      }
    };

    return () => {
      ws.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interviewId]);

  function appendLog(line: string) {
    setLog((prev) => [...prev, line]);
  }

  function handleWSMessage(msg: WSMessage) {
    if (msg.type === "agent_message") {
      const m = msg as WSMessage & { text: string; question_id?: number; done?: boolean };

      setAgentMessages((prev) => [...prev, { text: m.text, question_id: m.question_id }]);

      if (typeof m.question_id === "number") {
        setCurrentQuestionId(m.question_id);
        appendLog(`Agent asked question_id=${m.question_id}`);
      } else {
        appendLog(`Agent says: ${m.text}`);
      }

      if (m.done) {
        setIsFinished(true);
        appendLog("Interview finished by agent.");
      }
    } else if (msg.type === "scoring_started") {
      const m = msg as { type: string; turn_id: number; question_id?: number; task_id: string };
      setIsScoring(true);
      appendLog(
        `Scoring started for turn_id=${m.turn_id}, question_id=${m.question_id}, task_id=${m.task_id}`,
      );
    } else if (msg.type === "error") {
      const m = msg as { type: string; message: string };
      appendLog(`ERROR: ${m.message}`);
    } else {
      appendLog(`Unknown WS message: ${JSON.stringify(msg)}`);
    }
  }

  function sendAnswer() {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      appendLog("Cannot send, WS not open");
      return;
    }
    if (!answerText.trim()) {
      appendLog("Cannot send empty answer");
      return;
    }
    if (!currentQuestionId) {
      appendLog("No currentQuestionId set");
      return;
    }

    const payload = {
      type: "candidate_text",
      question_id: currentQuestionId,
      text: answerText.trim(),
    };

    wsRef.current.send(JSON.stringify(payload));
    appendLog(`Sent answer for question_id=${currentQuestionId}`);

    setAnswerText("");
    setIsScoring(false); // will flip true when scoring_started arrives
  }

  return (
    <div style={{ padding: 24, fontFamily: "sans-serif", maxWidth: 900, margin: "0 auto" }}>
      <h1>Live Interview</h1>
      <p>
        Interview ID: <b>{interviewId}</b>
      </p>
      <p>
        WebSocket status:{" "}
        <b style={{ color: connected ? "green" : "red" }}>{connected ? "Connected" : "Disconnected"}</b>
      </p>

      <hr />

      <section style={{ marginBottom: 24 }}>
        <h2>Agent</h2>
        {agentMessages.length === 0 && <p>Waiting for agent…</p>}
        <ul>
          {agentMessages.map((m, idx) => (
            <li key={idx}>
              {m.question_id && <strong>[Q {m.question_id}] </strong>}
              {m.text}
            </li>
          ))}
        </ul>
        {isFinished && <p style={{ color: "blue" }}>Interview completed.</p>}
      </section>

      <section style={{ marginBottom: 24 }}>
        <h2>Your Answer</h2>
        <p>
          Current question id:{" "}
          <b>{currentQuestionId ? currentQuestionId : "none (waiting for agent question)"}</b>
        </p>
        <textarea
          rows={4}
          style={{ width: "100%", marginBottom: 8 }}
          value={answerText}
          onChange={(e) => setAnswerText(e.target.value)}
          disabled={!connected || isFinished}
          placeholder="Type your answer here (later this will come from audio ASR)…"
        />
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <button
            onClick={sendAnswer}
            disabled={!connected || !currentQuestionId || isFinished || !answerText.trim()}
          >
            Send Answer
          </button>
          {isScoring && <span>Scoring in progress…</span>}
        </div>
      </section>

      <section>
        <h2>Debug Log</h2>
        <pre
          style={{
            background: "#111",
            color: "#0f0",
            padding: 12,
            fontSize: 12,
            maxHeight: 240,
            overflow: "auto",
          }}
        >
          {log.join("\n")}
        </pre>
      </section>
    </div>
  );
}
