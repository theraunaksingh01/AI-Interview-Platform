"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

type QItem = {
  question_id: number;
  type: string;
  question_text: string;
  time_limit_seconds?: number;
  answer_id?: number | null;
  upload_id?: number | null;
  code_answer?: string | null;
  code_output?: string | null;
  test_results?: any;
  cheat_flags?: any;
  transcript?: string | null;
  ai_feedback?: Record<string, any> | null;
  created_at?: string;
  llm_raw?: string | null;
  [k: string]: any;
};

export default function InterviewReviewPage() {
  const params = useParams();
  const router = useRouter();
  const id = (params && (params as any).id) || "";
  const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:8000";

  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<QItem[] | null>(null);
  const [rawVisible, setRawVisible] = useState<boolean>(false);
  const [pdfStatus, setPdfStatus] = useState<string | null>(null);
  const [rescoreLoading, setRescoreLoading] = useState<boolean>(false);

  function getAuthHeader(): Headers {
    const h = new Headers();
    try {
      const token =
        typeof window !== "undefined"
          ? localStorage.getItem("access_token") || localStorage.getItem("token")
          : null;
      if (token) {
        h.set("Authorization", `Bearer ${token}`);
      }
    } catch (e) {}
    h.set("Accept", "application/json");
    return h;
  }

  async function fetchReport() {
    setLoading(true);
    setError(null);
    try {
      if (!id) {
        setError("Missing interview id");
        setLoading(false);
        return;
      }
      // backend report endpoint returns array of question objects
      const url = `${API_BASE}/interview/report/${encodeURIComponent(id)}`;
      const resp = await fetch(url, { headers: getAuthHeader() });
      if (!resp.ok) {
        const txt = await resp.text();
        throw new Error(txt || resp.statusText);
      }
      const json = await resp.json();
      setReport(json);
    } catch (e: any) {
      let msg = String(e?.message || e);
      try {
        msg = JSON.parse(msg);
      } catch {}
      setError(typeof msg === "string" ? msg : JSON.stringify(msg));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function downloadPdf() {
    setPdfStatus(null);
    try {
      const url = `${API_BASE}/interview/report/${encodeURIComponent(id)}/pdf`;
      const resp = await fetch(url, { headers: getAuthHeader() });
      if (resp.status === 202) {
        const data = await resp.json().catch(() => null);
        setPdfStatus(data?.detail || "PDF generating. Try again in a moment.");
        return;
      }
      if (resp.status === 404) {
        const data = await resp.json().catch(() => null);
        setPdfStatus(data?.detail || "PDF not found");
        return;
      }
      if (!resp.ok) {
        const txt = await resp.text();
        throw new Error(txt || resp.statusText);
      }
      // If server returned binary stream
      const blob = await resp.blob();
      if (blob.type === "application/json") {
        // maybe server returned presigned_url JSON
        const txt = await blob.text();
        try {
          const j = JSON.parse(txt);
          if (j.presigned_url) {
            window.open(j.presigned_url, "_blank");
            setPdfStatus("Opened presigned URL in new tab");
            return;
          }
        } catch {}
      }
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = `interview-${id}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(blobUrl);
      setPdfStatus("Downloaded");
    } catch (e: any) {
      setPdfStatus(String(e?.message || e));
    }
  }

  async function rescoreWhole() {
    setRescoreLoading(true);
    setError(null);
    try {
      const url = `${API_BASE}/interview/score/${encodeURIComponent(id)}`;
      const resp = await fetch(url, { method: "POST", headers: getAuthHeader() });
      if (!resp.ok) {
        const txt = await resp.text();
        throw new Error(txt || resp.statusText);
      }
      await fetchReport();
    } catch (e: any) {
      setError(String(e?.message || e));
    } finally {
      setRescoreLoading(false);
    }
  }

  async function rescoreQuestion(qid: number) {
    setRescoreLoading(true);
    setError(null);
    try {
      // If backend doesn't provide per-question endpoint, this will return 404.
      // UI will show the error string so admin knows to use whole-interview re-score.
      const url = `${API_BASE}/interview/score_question/${encodeURIComponent(String(qid))}`;
      const resp = await fetch(url, { method: "POST", headers: getAuthHeader() });
      if (!resp.ok) {
        const txt = await resp.text();
        throw new Error(txt || resp.statusText);
      }
      await fetchReport();
    } catch (e: any) {
      setError(String(e?.message || e));
    } finally {
      setRescoreLoading(false);
    }
  }

  function getNum(a: any, k: string) {
    if (!a) return 0;
    const v = a[k];
    if (typeof v === "number") return v;
    const n = parseInt(String(v ?? "0"), 10);
    return Number.isNaN(n) ? 0 : n;
  }

  // Try to derive an upload URL for audio preview (best effort: depends on your uploads route or S3)
 function uploadPreviewUrl(uploadId: number | null): string | undefined {
    if (!uploadId) return undefined;
    // common patterns: /uploads/{id} (app page) or presigned S3 object — we keep app link
    return `/uploads/${encodeURIComponent(String(uploadId))}`;
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-3xl font-bold">Interview Review</h1>
          <div className="text-sm text-muted-foreground">Interview ID: {id}</div>
        </div>

        <div className="flex gap-3">
          <button
            className="px-3 py-1 text-sm bg-blue-600 text-white rounded"
            onClick={downloadPdf}
            disabled={!id}
          >
            Download PDF
          </button>

          <button
            className="px-3 py-1 text-sm border rounded"
            onClick={() => setRawVisible((s) => !s)}
          >
            {rawVisible ? "Hide raw" : "Show raw"}
          </button>

          <button
            className="px-3 py-1 text-sm bg-orange-500 text-white rounded"
            onClick={rescoreWhole}
            disabled={rescoreLoading || !id}
          >
            {rescoreLoading ? "Rescoring..." : "Re-score (whole interview)"}
          </button>
        </div>
      </div>

      {pdfStatus && <div className="mb-4 text-sm text-red-600">Download status: {String(pdfStatus)}</div>}

      {loading && <div>Loading report...</div>}
      {error && <div className="mb-4 text-sm text-red-600">Error: {error}</div>}

      {!loading && report && (
        <>
          <div className="mb-4">
            <strong>Full report (summary below)</strong>
          </div>

          {rawVisible && (
            <pre className="bg-gray-100 p-4 rounded mb-4 overflow-auto text-sm">
              {JSON.stringify(report, null, 2)}
            </pre>
          )}

          <div className="space-y-6">
            {report.map((q) => {
              const ai = q.ai_feedback || {};
              const technical = getNum(ai, "technical");
              const communication = getNum(ai, "communication");
              const completeness = getNum(ai, "completeness");
              // fallback overall calc if not present in report
              const overall = Math.round(0.6 * technical + 0.3 * communication + 0.1 * completeness);

              const qtype = (String(q.type || "").toLowerCase() || "voice");

              return (
                <div key={q.question_id} className="border rounded p-6">
                  <div className="flex flex-col lg:flex-row justify-between">
                    <div style={{ flex: 1, paddingRight: 20 }}>
                      <h3 className="text-lg font-semibold">
                        Q{q.question_id} — Score: {overall}
                      </h3>
                      <p className="mt-2 text-sm text-gray-800">{q.question_text}</p>

                      {/* For code questions: show submitted code + outputs */}
                      {qtype === "code" && (
                        <div className="mt-4">
                          <div className="font-medium mb-2">Code answer</div>
                          <pre className="bg-gray-50 p-3 rounded text-sm overflow-auto whitespace-pre-wrap max-h-52">
                            {q.code_answer ? String(q.code_answer) : "—"}
                          </pre>

                          <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
                            <div>
                              <div className="text-xs text-muted-foreground">Test results</div>
                              <div className="mt-1 text-sm">
                                {q.test_results
                                  ? (() => {
                                      const t = q.test_results as any;
                                      // Common shapes: { passed: X, total: Y } or { correctness: 0.85 }
                                      if (typeof t.passed !== "undefined" && typeof t.total !== "undefined") {
                                        return `${t.passed} / ${t.total} passed`;
                                      }
                                      if (typeof t.correctness !== "undefined") {
                                        return `Correctness: ${Math.round((t.correctness || 0) * 100)}%`;
                                      }
                                      return JSON.stringify(t);
                                    })()
                                  : "—"}
                              </div>
                            </div>

                            <div>
                              <div className="text-xs text-muted-foreground">Code output</div>
                              <div className="mt-1 text-sm break-words">
                                {q.code_output ? String(q.code_output) : "—"}
                              </div>
                            </div>

                            <div>
                              <div className="text-xs text-muted-foreground">Cheat flags</div>
                              <div className="mt-1 text-sm">
                                {Array.isArray(q.cheat_flags) && q.cheat_flags.length ? q.cheat_flags.join(", ") : "—"}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* For voice questions: show transcript, audio link if upload exists */}
                      {qtype !== "code" && (
                        <div className="mt-4">
                          <div className="font-medium mb-2">Transcript</div>
                          <div className="bg-gray-50 p-3 rounded text-sm whitespace-pre-wrap">
                            {q.transcript ? String(q.transcript) : "—"}
                          </div>

                          {q.upload_id ? (
                            <div className="mt-3 flex items-center gap-3">
                              <a
                                className="text-sm underline"
                                href={uploadPreviewUrl(q.upload_id)}
                                target="_blank"
                                rel="noreferrer"
                              >
                                View recording
                              </a>
                              {/* If you have a direct URL for audio you can embed an <audio> here.
                                  We keep a link since presigned S3 access often required. */}
                            </div>
                          ) : null}
                        </div>
                      )}
                    </div>

                    <div className="mt-4 lg:mt-0 text-right" style={{ minWidth: 170 }}>
                      <div className="text-sm">Technical: {technical}</div>
                      <div className="text-sm">Communication: {communication}</div>
                      <div className="text-sm">Completeness: {completeness}</div>

                      <div className="mt-4 flex flex-col gap-2 items-end">
                        <button
                          className="px-3 py-1 text-sm border rounded"
                          onClick={() => rescoreQuestion(q.question_id)}
                        >
                          Re-score
                        </button>

                        {/* keep raw LLM view lower down */}
                      </div>
                    </div>
                  </div>

                  <div className="mt-6">
                    <h4 className="font-medium mb-2">AI Feedback</h4>
                    <pre className="bg-gray-50 p-4 rounded text-sm overflow-auto">
                      {JSON.stringify(ai, null, 2)}
                    </pre>

                    <div className="mt-3">
                      <strong>Raw LLM (if available)</strong>
                      <div className="mt-2 bg-gray-50 p-3 rounded text-sm">
                        {q.llm_raw ? String(q.llm_raw) : "—"}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
