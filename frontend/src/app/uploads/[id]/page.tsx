"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

type Feedback = {
  communication: number;
  technical: number;
  completeness: number;
  red_flags: string[];
  summary: string;
};

type Upload = {
  id: number;
  filename: string;
  status: string;
  transcript?: string | null;
  ai_feedback?: Feedback | null;
};

export default function UploadDetail() {
  const { id } = useParams() as { id: string };
  const [data, setData] = useState<Upload | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const API = process.env.NEXT_PUBLIC_API_URL!;

  async function fetchUpload() {
    setLoading(true);
    const token = localStorage.getItem("access_token") || "";
    const res = await fetch(`${API}/upload/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const json = await res.json();
    setData(json);
    setLoading(false);
  }

  async function scoreNow() {
    setBusy(true);
    const token = localStorage.getItem("access_token") || "";
    const res = await fetch(`${API}/score/upload/${id}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      alert(`Scoring failed: ${res.status}`);
    }
    await fetchUpload(); // refresh to show new ai_feedback
    setBusy(false);
  }

  useEffect(() => {
    fetchUpload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (loading) return <div className="p-6">Loading…</div>;
  if (!data) return <div className="p-6">Not found</div>;

  const fb = data.ai_feedback;

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Upload #{data.id}</h1>
      <div className="mt-2">
      <a
        href="/uploads"
        className="text-sm underline text-blue-600 hover:text-blue-800"
      >
        ← Back to Uploads
      </a>
      </div>
      <div className="text-sm text-gray-600">
        File: <b>{data.filename}</b> • Status: <b>{data.status}</b>
      </div>

      <div className="space-x-2">
        <button
          onClick={scoreNow}
          disabled={busy}
          className="rounded-md border px-3 py-1.5 text-sm hover:bg-gray-50"
        >
          {busy ? "Scoring…" : "Score now"}
        </button>
        <button
          onClick={fetchUpload}
          className="rounded-md border px-3 py-1.5 text-sm hover:bg-gray-50"
        >
          Refresh
        </button>
      </div>

      <section className="border rounded p-4">
        <h2 className="font-semibold mb-2">Transcript</h2>
        {data.transcript ? (
          <p className="whitespace-pre-wrap text-sm">{data.transcript}</p>
        ) : (
          <p className="text-sm text-gray-500">No transcript yet.</p>
        )}
      </section>

      <section className="border rounded p-4">
        <h2 className="font-semibold mb-2">AI Evaluation</h2>
        {fb ? (
          <div className="space-y-1 text-sm">
            <div>Communication: <b>{fb.communication}</b>/10</div>
            <div>Technical: <b>{fb.technical}</b>/10</div>
            <div>Completeness: <b>{fb.completeness}</b>/10</div>
            <div>
              Red flags:{" "}
              {fb.red_flags?.length ? fb.red_flags.join(", ") : "None"}
            </div>
            <div className="text-gray-600 mt-2">{fb.summary}</div>
          </div>
        ) : (
          <p className="text-sm text-gray-500">
            Not scored yet. Click <b>Score now</b>.
          </p>
        )}
      </section>
    </div>
  );
}
