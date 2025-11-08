"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

type ReportRow = {
  question_id: number;
  type: "voice" | "code";
  question_text: string;
  time_limit_seconds: number;
  answer_id: number | null;
  upload_id: number | null;
  code_answer: string | null;
  code_output: string | null;
  test_results: any | null;
  cheat_flags: string[] | null;
  transcript: string | null;
  ai_feedback: any | null;
  created_at: string | null;
};

type Summary = {
  weights?: { communication: number; technical: number; completeness: number };
  section_scores?: { communication: number; technical: number; completeness: number };
  overall_score?: number;
  red_flags?: string[];
  per_question?: Array<{ question_id: number; type: string; ai_feedback?: any; correctness?: number }>;
};

export default function ReportPage() {
  const { id } = useParams() as { id: string };

  const API = process.env.NEXT_PUBLIC_API_URL!;
  const token = typeof window !== "undefined" ? localStorage.getItem("access_token") || "" : "";

  const [rows, setRows] = useState<ReportRow[] | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    try {
      setLoading(true);
      setErr(null);

      const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};

      // rows (per-question view)
      const r1 = await fetch(`${API}/interview/report/${id}`, { headers });
      if (!r1.ok) throw new Error(`HTTP ${r1.status}`);
      const data: ReportRow[] = await r1.json();
      setRows(data);

      // try to fetch summary (stored on interviews.report if you ran /score)
      // we’ll probe the PDF endpoint to get a presigned link too.
      try {
        const rPdf = await fetch(`${API}/interview/report/${id}/pdf`, { headers });
        if (rPdf.ok) {
          const j = await rPdf.json();
          setPdfUrl(j?.presigned_url || null);
        } else {
          setPdfUrl(null);
        }
      } catch {
        setPdfUrl(null);
      }

      // Optional: if you also exposed GET /interview/score/summary, you could load it here.
      // For now we infer from the most recent rows’ ai_feedback where possible:
      const sections = {
        communication: 0,
        technical: 0,
        completeness: 0,
      };
      let commCount = 0, techCount = 0, compCount = 0;
      const redFlags = new Set<string>();

      data.forEach((row) => {
        const fb = (row.ai_feedback as any) || {};
        if (row.type === "voice") {
          if (typeof fb.communication === "number") { sections.communication += fb.communication; commCount++; }
          if (typeof fb.technical === "number") { sections.technical += fb.technical; techCount++; }
          if (typeof fb.completeness === "number") { sections.completeness += fb.completeness; compCount++; }
          (fb.red_flags || []).forEach((f: string) => redFlags.add(f));
        } else {
          if (typeof fb.technical === "number") { sections.technical += fb.technical; techCount++; }
          if (typeof fb.completeness === "number") { sections.completeness += fb.completeness; compCount++; }
        }
        (row.cheat_flags || []).forEach((f) => redFlags.add(f));
      });

      const secAvg = {
        communication: commCount ? Math.round(sections.communication / commCount) : 0,
        technical: techCount ? Math.round(sections.technical / techCount) : 0,
        completeness: compCount ? Math.round(sections.completeness / compCount) : 0,
      };

      setSummary({
        section_scores: secAvg,
        overall_score: Math.round(0.3 * secAvg.communication + 0.6 * secAvg.technical + 0.1 * secAvg.completeness),
        red_flags: Array.from(redFlags),
      });
    } catch (e: any) {
      setErr(e?.message || "Failed to load report");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  return (
    <div className="max-w-5xl mx-auto p-6">
      <div className="flex items-center justify-between mb-4">
        <a href={`/interview/${id}`} className="text-sm text-gray-600 underline">
          ← Back to Questions
        </a>
        <h1 className="text-2xl font-semibold">Interview Report</h1>
        <div />
      </div>

      {loading && <div>Loading…</div>}
      {err && <div className="text-rose-700 bg-rose-50 border border-rose-200 p-3 rounded">{err}</div>}

      {!loading && !err && (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="rounded-xl border p-4">
              <div className="text-xs text-gray-500">Overall</div>
              <div className="text-2xl font-bold">{summary?.overall_score ?? 0}</div>
            </div>
            <div className="rounded-xl border p-4">
              <div className="text-xs text-gray-500">Technical</div>
              <div className="text-xl font-semibold">{summary?.section_scores?.technical ?? 0}</div>
            </div>
            <div className="rounded-xl border p-4">
              <div className="text-xs text-gray-500">Communication</div>
              <div className="text-xl font-semibold">{summary?.section_scores?.communication ?? 0}</div>
            </div>
            <div className="rounded-xl border p-4">
              <div className="text-xs text-gray-500">Completeness</div>
              <div className="text-xl font-semibold">{summary?.section_scores?.completeness ?? 0}</div>
            </div>
          </div>

          {/* Red flags */}
          {(summary?.red_flags?.length ?? 0) > 0 && (
            <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4">
              <div className="text-sm font-semibold mb-2">Red Flags</div>
              <div className="text-sm text-amber-900">
                {summary!.red_flags!.join(" · ")}
              </div>
            </div>
          )}

          {/* Per-question */}
          <div className="space-y-4">
            {rows?.map((r) => {
              const fb = (r.ai_feedback as any) || {};
              return (
                <div key={r.question_id} className="rounded-2xl border p-4 bg-white">
                  <div className="flex items-center justify-between">
                    <div className="font-semibold">
                      Q{r.question_id} • {r.type.toUpperCase()}
                    </div>
                    {r.test_results?.correctness != null && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 border">
                        Correctness: {r.test_results.correctness}%
                      </span>
                    )}
                  </div>
                  <div className="mt-1 text-sm text-gray-700">{r.question_text}</div>

                  {/* Voice transcript */}
                  {r.type === "voice" && r.transcript && (
                    <div className="mt-3 text-sm">
                      <div className="text-gray-500 mb-1">Transcript</div>
                      <div className="rounded border bg-gray-50 p-2 whitespace-pre-wrap">{r.transcript}</div>
                    </div>
                  )}

                  {/* Code output preview */}
                  {r.type === "code" && r.code_output && (
                    <div className="mt-3 text-sm">
                      <div className="text-gray-500 mb-1">Program Output (preview)</div>
                      <pre className="rounded border bg-gray-50 p-2 max-h-40 overflow-auto whitespace-pre-wrap">
                        {r.code_output}
                      </pre>
                    </div>
                  )}

                  {/* AI feedback */}
                  {fb?.summary && (
                    <div className="mt-3 text-sm">
                      <div className="text-gray-500 mb-1">AI Feedback</div>
                      <div className="rounded border bg-gray-50 p-2 whitespace-pre-wrap">
                        {fb.summary}
                      </div>
                    </div>
                  )}

                  {/* Cheat flags */}
                  {(r.cheat_flags?.length ?? 0) > 0 && (
                    <div className="mt-3 text-xs text-amber-800">
                      Flags: {r.cheat_flags!.join(" · ")}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* PDF */}
          <div className="mt-6 flex gap-3">
            <a
              href={pdfUrl || "#"}
              target="_blank"
              rel="noreferrer"
              className={`px-4 py-2 rounded-lg border ${pdfUrl ? "border-indigo-200 text-indigo-700 bg-indigo-50 hover:bg-indigo-100" : "pointer-events-none opacity-50"}`}
            >
              Download PDF
            </a>
            <a
              href={`/interview/${id}`}
              className="px-4 py-2 rounded-lg border border-gray-200 hover:bg-gray-50"
            >
              Back to Questions
            </a>
          </div>
        </>
      )}
    </div>
  );
}
