// src/app/interview/[id]/audit/page.tsx
"use client";

import React, { useEffect, useState } from "react";
import CompareModal from "./CompareModal"; 
import ModelInspector from "@/app/components/ui/ModelInspector"; 

type AuditRow = {
  id: number;
  interview_id: string;
  scored_at?: string | null;
  created_at?: string | null;
  overall_score: number;
  section_scores: Record<string, number>;
  per_question: Array<any>;
  model_meta?: Record<string, any> | null;
  prompt_hash?: string | null;
  prompt_text?: string | null;
  weights?: Record<string, number> | null;
  triggered_by?: string | null;
  task_id?: string | null;
  llm_raw_s3_key?: string | null;
  notes?: string | null;
};

function RawModal({
  open,
  json,
  onClose,
}: {
  open: boolean;
  json?: string | null;
  onClose: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded shadow-xl p-4 max-w-3xl w-full max-h-[80vh] overflow-auto">
        <div className="flex justify-between items-center mb-3">
          <h2 className="font-semibold text-lg">Raw LLM JSON</h2>
          <button onClick={onClose} className="text-sm px-2 py-1 border rounded">Close</button>
        </div>
        <pre className="whitespace-pre-wrap text-xs bg-gray-100 p-3 rounded border overflow-auto">
          {json || "No raw JSON available"}
        </pre>
        <div className="mt-4 flex justify-end">
          <a
            href={`data:application/json;charset=utf-8,${encodeURIComponent(json || "")}`}
            download={`llm_raw_${Date.now()}.json`}
            className="px-3 py-1 bg-blue-600 text-white rounded"
          >
            Download JSON
          </a>
        </div>
      </div>
    </div>
  );
}

export default function InterviewAuditPage({ params }: { params: { id: string } }) {
  // Keep familiar params access for now (see Next.js migration note)
  const interviewId = (params && (params as any).id) || "";
  const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:8000";

  const [audits, setAudits] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedRun, setSelectedRun] = useState<AuditRow | null>(null);
  const [selectedForCompare, setSelectedForCompare] = useState<number[]>([]); // up to 2 ids
  const [compareError, setCompareError] = useState<string | null>(null);

  // Modals / external inspector
  const [rawModalOpen, setRawModalOpen] = useState(false);
  const [rawModalJSON, setRawModalJSON] = useState<string | null>(null);

  const [modelModalOpen, setModelModalOpen] = useState(false);
  const [modelModalData, setModelModalData] = useState<any>(null);

  const [compareModalOpen, setCompareModalOpen] = useState(false);
  const [compareLeft, setCompareLeft] = useState<AuditRow | null>(null);
  const [compareRight, setCompareRight] = useState<AuditRow | null>(null);

  function getAuthHeader(): Headers {
    const h = new Headers();
    try {
      const token = typeof window !== "undefined" ? (localStorage.getItem("access_token") || localStorage.getItem("token")) : null;
      if (token) h.set("Authorization", `Bearer ${token}`);
    } catch (e) {}
    h.set("Accept", "application/json");
    return h;
  }

  async function fetchAudits() {
    setLoading(true);
    setError(null);
    try {
      const url = `${API_BASE}/interview/${encodeURIComponent(interviewId)}/audit`;
      const res = await fetch(url, { headers: getAuthHeader() });
      if (!res.ok) throw new Error(await res.text());
      const json = await res.json();
      setAudits(Array.isArray(json) ? json : []);
    } catch (e: any) {
      setError(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }

  async function fetchAuditDetail(aid: number) {
    setDetailLoading(true);
    setError(null);
    try {
      const url = `${API_BASE}/interview/${encodeURIComponent(interviewId)}/audit/${aid}`;
      const res = await fetch(url, { headers: getAuthHeader() });
      if (!res.ok) throw new Error(await res.text());
      const json = await res.json();
      setSelectedRun(json);
    } catch (e: any) {
      setError(String(e?.message || e));
    } finally {
      setDetailLoading(false);
    }
  }

  // Download or open raw LLM presigned url (best-effort)
  async function openRaw(aid: number) {
    try {
      const url = `${API_BASE}/interview/${encodeURIComponent(interviewId)}/audit/${aid}`;
      const r = await fetch(url, { headers: getAuthHeader() });
      if (!r.ok) throw new Error(await r.text());
      const det = await r.json();
      if (det.llm_raw_presigned_url) {
        window.open(det.llm_raw_presigned_url, "_blank");
        return;
      }
      if (det.llm_raw_full) {
        setRawModalJSON(JSON.stringify(det.llm_raw_full, null, 2));
        setRawModalOpen(true);
        return;
      }
      alert("No raw LLM available");
    } catch (e: any) {
      alert(String(e?.message || e));
    }
  }

  // Fetch raw content and show modal (Used by Selected Run -> Open Raw LLM)
  async function fetchAndShowRaw(aid: number) {
    try {
      const url = `${API_BASE}/interview/${encodeURIComponent(interviewId)}/audit/${aid}`;
      const r = await fetch(url, { headers: getAuthHeader() });
      if (!r.ok) throw new Error(await r.text());
      const det = await r.json();
      if (det.llm_raw_presigned_url) {
        const rawResp = await fetch(det.llm_raw_presigned_url);
        const txt = await rawResp.text();
        setRawModalJSON(txt);
        setRawModalOpen(true);
        return;
      }
      if (det.llm_raw_full) {
        setRawModalJSON(JSON.stringify(det.llm_raw_full, null, 2));
        setRawModalOpen(true);
        return;
      }
      alert("No raw LLM JSON available for this run");
    } catch (err: any) {
      alert(String(err?.message || err));
    }
  }

  function toggleCompareSelect(aid: number) {
    setCompareError(null);
    setSelectedForCompare((prev) => {
      const found = prev.indexOf(aid);
      if (found >= 0) {
        // remove
        return prev.filter((x) => x !== aid);
      } else {
        // add (max 2) — if adding beyond 2 keep most recent two
        if (prev.length >= 2) {
          return [prev[1], aid];
        }
        return [...prev, aid];
      }
    });
  }

  async function openModelInspectorFor(aid: number) {
    try {
      const url = `${API_BASE}/interview/${encodeURIComponent(interviewId)}/audit/${aid}`;
      const r = await fetch(url, { headers: getAuthHeader() });
      if (!r.ok) throw new Error(await r.text());
      const det = await r.json();
      setModelModalData(det);
      setModelModalOpen(true);
    } catch (err: any) {
      alert(String(err?.message || err));
    }
  }

  async function doCompare() {
    setCompareError(null);
    if (selectedForCompare.length !== 2) {
      setCompareError("Select exactly two runs to compare.");
      return;
    }
    const [a, b] = selectedForCompare;
    try {
      const urlA = `${API_BASE}/interview/${encodeURIComponent(interviewId)}/audit/${a}`;
      const urlB = `${API_BASE}/interview/${encodeURIComponent(interviewId)}/audit/${b}`;
      const [ra, rb] = await Promise.all([
        fetch(urlA, { headers: getAuthHeader() }),
        fetch(urlB, { headers: getAuthHeader() }),
      ]);
      if (!ra.ok) throw new Error(await ra.text());
      if (!rb.ok) throw new Error(await rb.text());
      const da = await ra.json();
      const db = await rb.json();

      // Provide fetched rows to the CompareModal via state
      setCompareLeft(da);
      setCompareRight(db);
      setCompareModalOpen(true);
    } catch (e: any) {
      setCompareError(String(e?.message || e));
    }
  }

  useEffect(() => {
    if (!interviewId) return;
    fetchAudits();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interviewId]);

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold">Scoring History</h1>
          <div className="text-sm text-muted-foreground">Interview: {interviewId}</div>
        </div>

        <div className="flex gap-2 items-center">
          <button className="px-3 py-1 border rounded text-sm" onClick={() => fetchAudits()} disabled={loading}>
            {loading ? "Refreshing..." : "Refresh"}
          </button>
          <button
            className="px-3 py-1 bg-blue-600 text-white rounded text-sm"
            onClick={() => doCompare()}
            disabled={selectedForCompare.length !== 2}
            title={selectedForCompare.length === 2 ? "Compare selected runs" : "Select exactly two runs to compare"}
          >
            Compare ({selectedForCompare.length}/2)
          </button>
        </div>
      </div>

      {compareError && <div className="mb-3 text-sm text-red-600">{compareError}</div>}
      {error && <div className="mb-3 text-sm text-red-600">Error: {error}</div>}

      {audits.length === 0 && !loading && (
        <div className="p-6 bg-gray-50 rounded">No scoring runs found for this interview.</div>
      )}

      {audits.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Left: list */}
          <div className="md:col-span-2 space-y-4">
            {audits.map((a) => (
              <div key={a.id} className="border rounded p-4 flex flex-col md:flex-row md:justify-between md:items-center">
                <div>
                  <div className="text-sm text-muted-foreground">
                    {new Date(a.created_at || a.scored_at || "").toLocaleString()}
                  </div>
                  <div className="text-lg font-medium">Overall: {a.overall_score}</div>
                  <div className="text-sm">Triggered by: {a.triggered_by || "-"} • Model: {a.model_meta?.model || a.model_meta?.provider || "unknown"}</div>
                </div>

                <div className="mt-3 md:mt-0 flex items-center gap-2">
                  <button
                    className="px-3 py-1 border rounded text-sm"
                    onClick={() => fetchAuditDetail(a.id)}
                  >
                    View
                  </button>

                  <button
                    className="px-3 py-1 bg-blue-600 text-white rounded text-sm"
                    onClick={() => openRaw(a.id)}
                  >
                    Download Raw
                  </button>

                  <label className="inline-flex items-center gap-2 text-sm ml-2">
                    <input
                      type="checkbox"
                      className="form-checkbox"
                      checked={selectedForCompare.indexOf(a.id) >= 0}
                      onChange={() => toggleCompareSelect(a.id)}
                      aria-label={`Select run ${a.id} for comparison`}
                    />
                    <span>Compare</span>
                  </label>
                </div>
              </div>
            ))}
          </div>

          {/* Right: selected run details */}
          <div className="md:col-span-1">
            <div className="border rounded p-4">
              <h3 className="text-lg font-medium mb-2">Selected Run</h3>

              {detailLoading && <div>Loading...</div>}
              {!selectedRun && !detailLoading && <div className="text-sm text-muted-foreground">Select a run to view details</div>}

              {selectedRun && (
                <div className="space-y-3 text-sm">
                  <div><strong>Overall</strong>: {selectedRun.overall_score}</div>

                  <div><strong>Section scores</strong>:</div>
                  <ul className="ml-4 list-disc">
                    {selectedRun.section_scores && Object.entries(selectedRun.section_scores).map(([k, v]) => (
                      <li key={k}>{k}: {v}</li>
                    ))}
                  </ul>

                  <div><strong>Per-question:</strong></div>
                  <div className="max-h-48 overflow-auto bg-gray-50 p-2 rounded text-xs">
                    {selectedRun.per_question && selectedRun.per_question.length ? (
                      selectedRun.per_question.map((q: any) => (
                        <div key={q.question_id || q.questionId || Math.random()} className="mb-2 border-b pb-2">
                          <div className="font-medium">Q{q.question_id} — overall: {q.overall ?? q.overall_score ?? "-"}</div>
                          <div className="text-xs">tech: {q.technical ?? "-"} • comm: {q.communication ?? "-"} • comp: {q.completeness ?? "-"}</div>
                          <div className="mt-1 text-xs italic">{q.ai_feedback?.summary || "-"}</div>
                        </div>
                      ))
                    ) : (
                      <div className="text-xs text-muted-foreground">No per-question data</div>
                    )}
                  </div>

                  <div className="mt-2 flex gap-2">
                    <button
                      className="px-3 py-1 border rounded text-sm"
                      onClick={() => {
                        navigator.clipboard.writeText(JSON.stringify(selectedRun, null, 2));
                        alert("Copied JSON to clipboard");
                      }}
                    >
                      Copy JSON
                    </button>

                    <button
                      className="px-3 py-1 border rounded text-sm"
                      onClick={() => openModelInspectorFor(selectedRun.id)}
                    >
                      Model Inspector
                    </button>

                    <button
                      className="px-3 py-1 bg-blue-600 text-white rounded text-sm"
                      onClick={() => fetchAndShowRaw(selectedRun.id)}
                    >
                      Open Raw LLM
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="mt-4 text-xs text-muted-foreground">
              <div>Tip: "Download Raw" opens the presigned URL stored by the backend (expires per server setting).</div>
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      <RawModal open={rawModalOpen} json={rawModalJSON} onClose={() => setRawModalOpen(false)} />

      {/* Use your external ModelInspector component */}
      <ModelInspector
        open={modelModalOpen}
        modelMeta={modelModalData?.model_meta}
        promptHash={modelModalData?.prompt_hash}
        promptText={modelModalData?.prompt_text}
        weights={modelModalData?.weights}
        taskId={modelModalData?.task_id}
        onClose={() => { setModelModalOpen(false); setModelModalData(null); }}
      />

      {/* Use external CompareModal and pass left/right runs */}
      <CompareModal
        open={compareModalOpen}
        left={compareLeft}
        right={compareRight}
        onClose={() => { setCompareModalOpen(false); setCompareLeft(null); setCompareRight(null); }}
      />
    </div>
  );
}
