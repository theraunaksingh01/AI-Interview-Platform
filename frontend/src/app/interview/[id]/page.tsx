// frontend/src/app/interview/[id]/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";

type Q = {
  id: number;
  question_text: string;
  type: "voice" | "code";
  time_limit_seconds: number;
};

export default function InterviewFlowPage() {
  const { id } = useParams() as { id: string };
  const API = process.env.NEXT_PUBLIC_API_URL!;
  const token =
    typeof window !== "undefined" ? localStorage.getItem("access_token") || "" : "";

  const [qs, setQs] = useState<Q[]>([]);
  const [idx, setIdx] = useState(0);
  const [loading, setLoading] = useState(true);

  const pct = useMemo(
    () => (qs.length ? Math.round(((idx + 1) / qs.length) * 100) : 0),
    [qs.length, idx]
  );

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`${API}/interview/questions/${id}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        });
        const data: Q[] = await r.json();
        setQs(data || []);
      } finally {
        setLoading(false);
      }
    })();
  }, [API, id, token]);

  if (loading) {
    return (
      <div className="min-h-[60vh] grid place-items-center text-gray-600">
        Loading interview questions…
      </div>
    );
  }

  if (!qs.length) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <a href="/uploads" className="text-sm underline text-gray-600">← Back to Uploads</a>
        <h1 className="text-2xl font-semibold mt-4">No questions yet</h1>
        <p className="text-gray-600 mt-2">Seed questions for this interview to proceed.</p>
      </div>
    );
  }

  const q = qs[idx];

  function go(delta: number) {
    setIdx((i) => Math.min(Math.max(0, i + delta), qs.length - 1));
  }

  const primaryBtn =
    "inline-flex items-center gap-2 rounded-xl px-4 py-2 text-white bg-indigo-600 hover:bg-indigo-700 transition";
  const ghostBtn =
    "inline-flex items-center gap-2 rounded-xl px-3 py-2 border border-gray-200 hover:bg-gray-50 transition";

  return (
    <div className="max-w-3xl mx-auto p-6">
      {/* top bar */}
      <div className="flex items-center justify-between">
        <a href="/uploads" className="text-sm underline text-gray-600">
          ← Back to Uploads
        </a>
        <div className="text-sm text-gray-600">
          Question <b>{idx + 1}</b> / {qs.length}
        </div>
      </div>

      {/* progress */}
      <div className="w-full h-2 bg-gray-100 rounded mt-3 overflow-hidden">
        <div
          className="h-full bg-indigo-600 transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* card */}
      <div className="mt-6 rounded-2xl border border-gray-200 shadow-sm p-6 bg-white">
        <div className="text-xs uppercase tracking-wide text-gray-500">
          {q.type === "voice" ? "Voice Answer" : "Coding"}
        </div>
        <h1 className="text-2xl font-semibold mt-2">{q.question_text}</h1>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          {q.type === "voice" ? (
            <a href={`/interview/${id}/record?question=${q.id}`} className={primaryBtn}>
              🎤 Start Recording
            </a>
          ) : (
            <a href={`/interview/${id}/code?question=${q.id}`} className={primaryBtn}>
              💻 Start Coding
            </a>
          )}
          <span className="text-sm px-3 py-1 rounded-full bg-gray-100 text-gray-700">
            ⏳ Time limit: {Math.round((q.time_limit_seconds || 0) / 60)} min
          </span>
        </div>

        <div className="mt-8 flex items-center justify-between text-sm">
          <button onClick={() => go(-1)} className={ghostBtn} disabled={idx === 0}>
            ← Previous
          </button>
          <button
            onClick={() => go(1)}
            className={ghostBtn}
            disabled={idx === qs.length - 1}
          >
            Next →
          </button>
        </div>
      </div>

      {/* report link */}
      <div className="mt-6 text-right">
        <a
          href={`/interview/${id}/report`}
          className="text-sm text-indigo-600 hover:text-indigo-700 underline"
        >
          View Report →
        </a>
      </div>
    </div>
  );
}
