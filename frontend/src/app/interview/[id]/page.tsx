// frontend/src/app/interview/[id]/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

type InterviewQuestion = {
  id: number;
  question_text: string;
  type: "voice" | "code";
  time_limit_seconds: number;
};

export default function InterviewFlowPage() {
  const { id } = useParams() as { id: string };
  const API = process.env.NEXT_PUBLIC_API_URL!;
  const [questions, setQuestions] = useState<InterviewQuestion[]>([]);
  const [step, setStep] = useState(0);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const token =
    typeof window !== "undefined"
      ? localStorage.getItem("access_token") || ""
      : "";

  async function load() {
    try {
      setLoading(true);
      setErr(null);
      const res = await fetch(`${API}/interview/questions/${id}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`HTTP ${res.status}: ${txt}`);
      }
      const json = (await res.json()) as InterviewQuestion[];
      setQuestions(json);
    } catch (e: any) {
      setErr(e?.message || String(e));
      setQuestions([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const question = questions[step];

  return (
    <div style={{ padding: 20 }}>
      <div style={{ marginBottom: 12 }}>
        <a href="/uploads" style={{ textDecoration: "underline" }}>
          ← Back to Uploads
        </a>
      </div>

      {loading && <div>Loading interview questions…</div>}

      {!loading && err && (
        <div style={{ background: "#fff7ed", padding: 12, borderRadius: 6, marginBottom: 12 }}>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>Couldn’t load questions</div>
          <pre style={{ whiteSpace: "pre-wrap", fontSize: 12 }}>{err}</pre>
          {!token && (
            <div style={{ marginTop: 8, fontSize: 12 }}>
              Tip: Log in first so localStorage has <code>access_token</code>.
            </div>
          )}
          <button
            onClick={load}
            style={{ marginTop: 8, padding: "6px 12px", borderRadius: 6 }}
          >
            Retry
          </button>
        </div>
      )}

      {!loading && !err && !question && (
        <div>No questions found for this interview.</div>
      )}

      {!loading && !err && question && (
        <>
          <h1>Question {step + 1}</h1>
          <p style={{ fontSize: "18px" }}>{question.question_text}</p>

          {question.type === "voice" ? (
            <a href={`/interview/${id}/record?question=${question.id}`}>
              <button style={btn}>🎤 Start Recording</button>
            </a>
          ) : (
            <a href={`/interview/${id}/code?question=${question.id}`}>
              <button style={btn}>💻 Start Coding</button>
            </a>
          )}

          <br />
          <br />

          <button
            disabled={step === 0}
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            style={navBtn}
          >
            ← Previous
          </button>
          <button
            disabled={step >= questions.length - 1}
            onClick={() => setStep((s) => Math.min(questions.length - 1, s + 1))}
            style={navBtn}
          >
            Next →
          </button>
        </>
      )}
    </div>
  );
}

const btn = {
  padding: "10px 20px",
  background: "blue",
  color: "white",
  borderRadius: "6px",
};

const navBtn = { padding: "6px 12px", marginRight: "10px" };
