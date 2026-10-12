// src/app/candidate/interview/page.tsx
"use client";
import React, { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

type QItem = {
  question_id: number;
  question_text?: string;
  type?: string;
};

export default function CandidateInterviewPage() {
  const params = useSearchParams();
  const interviewId = params?.get("interview_id") || "";
  const API_BASE =
    process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:8000";

  const [questions, setQuestions] = useState<QItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [submitted, setSubmitted] = useState<Record<number, boolean>>({});

  async function loadQuestions() {
  if (!interviewId) return;
  setLoading(true);
  setError(null);

  // Try the public questions endpoint (candidate-view)
  const questionsUrl = `${API_BASE}/public/interview/${encodeURIComponent(interviewId)}/questions`;

  // Polling loop: try up to N times (3s interval) until questions present
  const maxAttempts = 20; // ~1 minute (20 * 3s). Tune as needed.
  const delayMs = 3000;

  try {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const resp = await fetch(questionsUrl, { method: "GET" });

        // If 404 -> questions not created yet
        if (resp.status === 404) {
          // if last attempt show friendly message
          if (attempt === maxAttempts) {
            setQuestions([]);
            return;
          }
          // wait then retry
          await new Promise((res) => setTimeout(res, delayMs));
          continue;
        }

        if (!resp.ok) {
          // other errors -> show and stop polling
          const txt = await resp.text().catch(() => resp.statusText);
          throw new Error(txt || resp.statusText);
        }

        const json = await resp.json();
        // normalize shape: expecting array of { question_id, question_text, type }
        const qlist = (json || []).map((q: any) => ({
          question_id: q.question_id ?? q.id ?? q.questionId,
          question_text: q.question_text ?? q.question_text ?? q.prompt ?? q.text ?? "",
          type: q.type ?? "voice",
        })).filter((x: any) => !!x.question_id);

        setQuestions(qlist);
        return;
      } catch (innerErr: any) {
        // If attemptable error, wait and retry; otherwise surface it on final attempt
        if (attempt === maxAttempts) throw innerErr;
        await new Promise((res) => setTimeout(res, delayMs));
      }
    }
  } catch (e: any) {
    setQuestions([]);
    setError(String(e?.message || e));
  } finally {
    setLoading(false);
  }
}


  async function submitAnswer(qid: number) {
    const txt = answers[qid] || "";
    if (!txt) {
      alert("Please type an answer (demo uses text answers).");
      return;
    }

    try {
      const fd = new FormData();
      fd.append("question_id", String(qid));
      fd.append("answer_text", txt);

      // 🔁 NOW USING PUBLIC ANSWER ENDPOINT
      const resp = await fetch(
        `${API_BASE}/public/interview/${encodeURIComponent(
          interviewId
        )}/answer`,
        {
          method: "POST",
          body: fd,
        }
      );

      if (!resp.ok) {
        const txt = await resp.text();
        throw new Error(txt || resp.statusText);
      }

      await resp.json();
      setSubmitted((prev) => ({ ...prev, [qid]: true }));
      alert("Answer submitted. Scoring will run shortly.");
    } catch (e: any) {
      alert(String(e?.message || e));
    }
  }

  if (!interviewId) {
    return (
      <div className="p-6">
        Missing <code>interview_id</code> in URL. Please open the link sent
        after submission.
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto p-6">
      <h1 className="text-2xl font-semibold mb-4">Candidate Interview</h1>
      <div className="mb-4 text-sm">Interview ID: {interviewId}</div>

      <div className="mb-3 flex gap-2 items-center">
        <button
          className="px-3 py-1 border rounded text-sm"
          onClick={loadQuestions}
          disabled={loading}
        >
          {loading ? "Refreshing..." : "Refresh now"}
        </button>
      </div>

      {error && (
        <div className="mb-3 text-sm text-red-600">Error: {error}</div>
      )}

      {loading && <div>Loading questions...</div>}

      {!loading && questions.length === 0 && (
        <div>
          No questions available yet. Wait a few seconds — question
          generation happens asynchronously.
        </div>
      )}

      <div className="space-y-6">
        {questions.map((q) => (
          <div key={q.question_id} className="border rounded p-4">
            <div className="font-medium">Q{q.question_id}</div>
            <div className="mt-2">{q.question_text || "—"}</div>

            <textarea
              placeholder="Type your answer here (demo uses text answers)."
              value={answers[q.question_id] || ""}
              onChange={(e) =>
                setAnswers((prev) => ({
                  ...prev,
                  [q.question_id]: e.target.value,
                }))
              }
              className="w-full border p-2 rounded mt-3 min-h-[120px]"
              disabled={!!submitted[q.question_id]}
            />

            <div className="mt-3">
              <button
                className="px-3 py-1 bg-green-600 text-white rounded"
                onClick={() => submitAnswer(q.question_id)}
                disabled={!!submitted[q.question_id]}
              >
                {submitted[q.question_id] ? "Submitted" : "Submit Answer"}
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 text-sm text-muted-foreground">
        After you submit answers, scoring jobs will run (visible in the
        admin review dashboard).
      </div>
    </div>
  );
}
