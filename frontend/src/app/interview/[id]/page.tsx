"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

type Q = {
  id: number;
  question_text: string;
  type: "voice" | "code";
  time_limit_seconds: number;
};

type Progress = { total: number; answered: number; percent: number };

export default function InterviewQuestionsPage() {
  const { id } = useParams() as { id: string };
  const API = process.env.NEXT_PUBLIC_API_URL!;
  const token = typeof window !== "undefined" ? localStorage.getItem("access_token") || "" : "";

  const [qs, setQs] = useState<Q[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [active, setActive] = useState(0);

  // NEW: progress + finishing state
  const [progress, setProgress] = useState<Progress>({ total: 0, answered: 0, percent: 0 });
  const [finishing, setFinishing] = useState(false);
  const [status, setStatus] = useState<string>("");

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
      const [rQ, rP] = await Promise.all([
        fetch(`${API}/interview/questions/${id}`, { headers }),
        fetch(`${API}/interview/progress/${id}`, { headers }),
      ]);
      if (!rQ.ok) throw new Error(`Questions HTTP ${rQ.status}`);
      if (!rP.ok) throw new Error(`Progress HTTP ${rP.status}`);
      const rows: Q[] = await rQ.json();
      const prog: Progress = await rP.json();
      setQs(rows);
      setProgress(prog);
    } catch (e: any) {
      setErr(e?.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  // also refresh progress when we return from a subpage
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const current = useMemo(() => qs[active], [qs, active]);

  async function finishAndScore() {
    if (!token) return alert("Not logged in.");
    if (progress.total === 0 || progress.answered < progress.total) {
      return alert("Please answer all questions before finishing.");
    }

    setFinishing(true);
    setStatus("Scoring interview…");
    try {
      let r = await fetch(`${API}/interview/score/${id}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!r.ok) throw new Error(await r.text());

      setStatus("Generating PDF…");
      r = await fetch(`${API}/interview/report/${id}/pdf`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!r.ok) throw new Error(await r.text());

      setStatus("Opening report…");
      window.location.href = `/interview/${id}/report`;
    } catch (e: any) {
      console.error(e);
      alert(e?.message || "Failed to finish & score");
    } finally {
      setFinishing(false);
      setStatus("");
    }
  }

  return (
    <div className="max-w-5xl mx-auto p-6 pb-28"> {/* bottom padding for sticky footer */}
      <header className="flex items-center justify-between mb-4">
        <Link href="/uploads" className="text-sm underline text-gray-600">
          ← Back to Uploads
        </Link>
        <h1 className="text-2xl font-semibold">Interview</h1>
        <div />
      </header>

      <div className="rounded-xl border p-4 bg-white flex items-center gap-3">
        <div className="text-sm text-gray-600">
          {loading ? "Loading interview questions…" : err ? err : `${qs.length} questions`}
        </div>
        <div className="ml-auto flex items-center gap-3">
          <div className="text-xs text-gray-600">
            {progress.answered}/{progress.total} answered
          </div>
          <div className="w-40 h-2 rounded bg-gray-200 overflow-hidden">
            <div
              className="h-2 bg-indigo-600"
              style={{ width: `${progress.percent}%` }}
            />
          </div>
        </div>
      </div>

      {status && (
        <div className="mt-3 rounded-lg border border-indigo-200 bg-indigo-50 p-3 text-sm text-indigo-900">
          {status}
        </div>
      )}

      {/* Nav */}
      {!loading && !err && qs.length > 0 && (
        <div className="mt-4 flex items-center gap-2 flex-wrap">
          {qs.map((q, i) => (
            <button
              key={q.id}
              onClick={() => setActive(i)}
              className={`px-3 py-1.5 rounded-lg border text-sm ${
                i === active ? "bg-gray-900 text-white border-gray-900" : "bg-white hover:bg-gray-50"
              }`}
            >
              Q{i + 1}
            </button>
          ))}
        </div>
      )}

      {/* Body */}
      {!loading && !err && current && (
        <div className="mt-4 rounded-2xl border p-5 bg-white space-y-3">
          <div className="text-xs uppercase tracking-wide text-gray-500">
            {current.type === "voice" ? "Voice" : "Coding"} • {current.time_limit_seconds}s
          </div>
          <div className="text-lg font-semibold">{current.question_text}</div>

          <div className="pt-2 flex gap-3">
            {current.type === "voice" ? (
              <Link
                href={`/interview/${id}/record?question=${current.id}`}
                className="px-4 py-2 rounded-lg text-white bg-emerald-600 hover:bg-emerald-700"
              >
                🎤 Start Recording
              </Link>
            ) : (
              <Link
                href={`/interview/${id}/code?question=${current.id}`}
                className="px-4 py-2 rounded-lg text-white bg-blue-600 hover:bg-blue-700"
              >
                💻 Start Coding
              </Link>
            )}
          </div>

          <div className="flex items-center justify-between pt-6">
            <button
              onClick={() => setActive((i) => Math.max(0, i - 1))}
              className="text-sm text-gray-600 underline disabled:opacity-40"
              disabled={active === 0}
            >
              ← Previous
            </button>
            <button
              onClick={() => setActive((i) => Math.min(qs.length - 1, i + 1))}
              className="text-sm text-gray-600 underline disabled:opacity-40"
              disabled={active >= qs.length - 1}
            >
              Next →
            </button>
          </div>
        </div>
      )}

      {/* STICKY FOOTER */}
      <div className="fixed left-0 right-0 bottom-0 border-t bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/70">
        <div className="max-w-5xl mx-auto p-3 flex items-center gap-3">
          <div className="text-sm text-gray-700">
            Progress: {progress.answered}/{progress.total} answered
          </div>
          <div className="flex-1 h-2 rounded bg-gray-200 overflow-hidden">
            <div
              className="h-2 bg-indigo-600 transition-all"
              style={{ width: `${progress.percent}%` }}
            />
          </div>
          <button
            onClick={finishAndScore}
            disabled={
              finishing || progress.total === 0 || progress.answered < progress.total
            }
            className={`px-4 py-2 rounded-lg text-white ${
              finishing
                ? "bg-gray-400"
                : progress.answered < progress.total
                ? "bg-gray-400 cursor-not-allowed"
                : "bg-indigo-600 hover:bg-indigo-700"
            }`}
            title={
              progress.answered < progress.total
                ? "Answer all questions to enable"
                : "Score interview and build the PDF"
            }
          >
            {finishing ? "Finishing…" : "Finish & Score →"}
          </button>
        </div>
      </div>
    </div>
  );
}
