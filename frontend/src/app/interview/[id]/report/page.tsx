// frontend/src/app/interview/[id]/report/page.tsx
"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

export default function ReportPage() {
  const { id } = useParams() as { id: string };
  const API = process.env.NEXT_PUBLIC_API_URL!;
  const token = typeof window !== "undefined" ? localStorage.getItem("access_token") || "" : "";

  const [rows, setRows] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);

  // Build headers safely (no undefined values)
  const authHeaders = (): HeadersInit | undefined =>
    token ? { Authorization: `Bearer ${token}` } : undefined;

  async function fetchReport() {
    const r = await fetch(`${API}/interview/report/${id}`, {
      headers: authHeaders(),
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const j = await r.json();
    setRows(j || []);
  }

  async function score() {
    setBusy(true);
    await fetch(`${API}/interview/score/${id}`, {
      method: "POST",
      headers: authHeaders(),
    });
    // simple poll once after a short delay
    setTimeout(fetchReport, 1500);
    setBusy(false);
  }

  async function makePdf() {
    setBusy(true);
    await fetch(`${API}/interview/report/${id}/pdf`, {
      method: "POST",
      headers: authHeaders(),
    });
    setTimeout(async () => {
      const r = await fetch(`${API}/interview/report/${id}/pdf`, {
        headers: authHeaders(),
      });
      const j = await r.json();
      alert(j.key ? `PDF stored at: ${j.key}` : "PDF not ready yet");
      setBusy(false);
    }, 1500);
  }

  useEffect(() => {
    fetchReport().catch((e) => console.error(e));
  }, []);

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center gap-3">
        <a href={`/interview/${id}`} className="underline">← Back</a>
        <button onClick={score} disabled={busy} className="border rounded px-3 py-1.5">Run AI Scoring</button>
        <button onClick={makePdf} disabled={busy} className="border rounded px-3 py-1.5">Generate PDF</button>
      </div>

      <h1 className="text-2xl font-bold">Interview Report</h1>

      {rows.length === 0 ? (
        <p>No data yet. Click “Run AI Scoring”.</p>
      ) : (
        <div className="space-y-4">
          {rows.map((row: any) => (
            <div key={row.question_id} className="border rounded p-4">
              <div className="text-xs text-gray-500">
                Q#{row.question_id} • {row.type?.toUpperCase?.() || "—"}
              </div>
              <div className="font-medium">{row.question_text}</div>

              {row.test_results && (
                <div className="text-sm mt-2">
                  Correctness: <b>{row.test_results.correctness}%</b>
                </div>
              )}

              {Array.isArray(row.cheat_flags) && row.cheat_flags.length > 0 && (
                <div className="text-xs text-amber-700 mt-1">
                  Flags: {row.cheat_flags.join(" · ")}
                </div>
              )}

              {row.ai_feedback?.summary && (
                <div className="text-sm mt-2">AI: {row.ai_feedback.summary}</div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
