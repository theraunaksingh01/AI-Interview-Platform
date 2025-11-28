"use client";
import React, { useEffect, useState } from "react";


// Raw JSON Modal Component
// --------------------------------------
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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded shadow-xl p-4 max-w-3xl w-full max-h-[80vh] overflow-auto">
        <div className="flex justify-between items-center mb-3">
          <h2 className="font-semibold text-lg">Raw LLM JSON</h2>
          <button
            onClick={onClose}
            className="text-sm px-2 py-1 border rounded"
          >
            Close
          </button>
        </div>

        <pre className="whitespace-pre-wrap text-xs bg-gray-100 p-3 rounded border">
{json || "No raw JSON available"}
        </pre>

        <div className="mt-4 flex justify-end">
          <a
            href={`data:application/json;charset=utf-8,${encodeURIComponent(
              json || ""
            )}`}
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

type AuditRow = {
  id: number;
  interview_id: string;
  scored_at: string;
  overall_score: number;
  section_scores: Record<string, number>;
  per_question: any[];
  model_meta: Record<string, any> | null;
  prompt_hash?: string | null;
  prompt_text?: string | null;
  weights?: Record<string, number>;
  triggered_by?: string | null;
  task_id?: string | null;
  llm_raw_s3_key?: string | null;
  notes?: string | null;
  created_at?: string | null;
};

export default function InterviewAuditPage({ params }: { params: { id: string } }) {
  const interviewId = params.id;
  const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:8000";

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [audits, setAudits] = useState<AuditRow[]>([]);
  const [selected, setSelected] = useState<AuditRow | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [rawModalOpen, setRawModalOpen] = useState(false);
  const [rawModalJSON, setRawModalJSON] = useState<string | null>(null);


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
      setAudits(json || []);
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
      setSelected(json);
    } catch (e: any) {
      setError(String(e?.message || e));
    } finally {
      setDetailLoading(false);
    }
  }

  useEffect(() => {
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
        <div className="flex gap-2">
          <button
            className="px-3 py-1 border rounded text-sm"
            onClick={() => fetchAudits()}
            disabled={loading}
          >
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </div>

      {error && <div className="mb-4 text-sm text-red-600">Error: {error}</div>}

      {audits.length === 0 && !loading && (
        <div className="p-6 bg-gray-50 rounded">No scoring runs found for this interview.</div>
      )}

      {audits.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2">
            <div className="space-y-4">
              {audits.map((a) => (
                <div key={a.id} className="border rounded p-4 flex justify-between items-center">
                  <div>
                    <div className="text-sm text-muted-foreground">{new Date(a.created_at || a.scored_at || "").toLocaleString()}</div>
                    <div className="text-lg font-medium">Overall: {a.overall_score}</div>
                    <div className="text-sm">Triggered by: {a.triggered_by || "-"} • Model: {a.model_meta?.model || a.model_meta?.provider || 'unknown'}</div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      className="px-3 py-1 border rounded text-sm"
                      onClick={() => fetchAuditDetail(a.id)}
                    >
                      View
                    </button>

                    {a.llm_raw_s3_key && (
                      <a
                        className="px-3 py-1 bg-blue-600 text-white rounded text-sm"
                        href={"/"}
                        onClick={async (e) => {
                          e.preventDefault();
                          try {
                            const r = await fetch(`${API_BASE}/interview/${encodeURIComponent(interviewId)}/audit/${a.id}`, { headers: getAuthHeader() });
                            if (!r.ok) throw new Error(await r.text());
                            const det = await r.json();
                            if (det.llm_raw_presigned_url) window.open(det.llm_raw_presigned_url, "_blank");
                            else alert("No presigned URL available");
                          } catch (err: any) {
                            alert(String(err?.message || err));
                          }
                        }}
                      >
                        Download Raw
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="md:col-span-1">
            <div className="border rounded p-4">
              <h3 className="text-lg font-medium mb-2">Selected Run</h3>
              {detailLoading && <div>Loading...</div>}
              {!selected && !detailLoading && <div className="text-sm text-muted-foreground">Select a run to view details</div>}

              {selected && (
                <div className="space-y-3 text-sm">
                  <div><strong>Overall</strong>: {selected.overall_score}</div>
                  <div><strong>Section scores</strong>:</div>
                  <ul className="ml-4 list-disc">
                    {selected.section_scores && Object.entries(selected.section_scores).map(([k,v]) => (
                      <li key={k}>{k}: {v}</li>
                    ))}
                  </ul>

                  <div><strong>Per-question:</strong></div>
                  <div className="max-h-48 overflow-auto bg-gray-50 p-2 rounded text-xs">
                    {selected.per_question.map((q:any) => (
                      <div key={q.question_id} className="mb-2 border-b pb-2">
                        <div className="font-medium">Q{q.question_id} — overall: {q.overall}</div>
                        <div className="text-xs">tech: {q.technical} • comm: {q.communication} • comp: {q.completeness}</div>
                        <div className="mt-1 text-xs italic">{q.ai_feedback?.summary || "-"}</div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-2">
                    <button
                      className="px-3 py-1 border rounded text-sm mr-2"
                      onClick={() => {
                        navigator.clipboard.writeText(JSON.stringify(selected, null, 2));
                        alert('Copied JSON to clipboard');
                      }}
                    >
                      Copy JSON
                    </button>

                    {selected.llm_raw_s3_key && (
                      <button
                          className="px-3 py-1 bg-blue-600 text-white rounded text-sm"
                          onClick={async () => {
                            try {
                              const r = await fetch(
                                `${API_BASE}/interview/${encodeURIComponent(interviewId)}/audit/${selected.id}`,
                                { headers: getAuthHeader() }
                              );
                              if (!r.ok) throw new Error(await r.text());
                              const det = await r.json();
                          
                              if (!det.llm_raw_presigned_url) {
                                alert("No presigned URL available");
                                return;
                              }
                          
                              // Fetch the raw JSON using the presigned URL
                              const rawResp = await fetch(det.llm_raw_presigned_url);
                              const rawText = await rawResp.text();
                          
                              setRawModalJSON(rawText);
                              setRawModalOpen(true);
                            } catch (err: any) {
                              alert(String(err?.message || err));
                            }
                          }}
                        >
                          Open Raw LLM
                        </button>

                    )}
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
      <RawModal
      open={rawModalOpen}
      json={rawModalJSON}
      onClose={() => setRawModalOpen(false)}
    />
    </div>
    
  );
  

}
