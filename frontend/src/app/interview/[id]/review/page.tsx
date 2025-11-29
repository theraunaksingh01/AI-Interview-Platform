"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import ScoreGauge from "@/app/components/ui/ScoreGauge";
import ScoreBars from "@/app/components/ui/ScoreBars";
import RadarChartComponent from "@/app/components/ui/RadarChartComponent";
import PerQuestionBar from "@/app/components/ui/PerQuestionBar";

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

// Inline task poll hook (self-contained)
// Inline task poll hook (self-contained)
function useTaskPoll(taskId: string | null, opts?: { interval?: number }) {
  const intervalMs = opts?.interval ?? 1500;
  const [state, setState] = useState<{ status: string | null; result: any | null; error: string | null; loading: boolean }>({
    status: null,
    result: null,
    error: null,
    loading: false,
  });

  useEffect(() => {
    // if no taskId, reset and return early
    if (!taskId) {
      setState({ status: null, result: null, error: null, loading: false });
      return;
    }

    let stopped = false;
    const controller = new AbortController();

    async function pollOnce() {
      try {
        setState((s) => ({ ...s, loading: true, error: null }));

        // coerce taskId to string (safe because we've returned above if falsy)
        const tid = String(taskId);

        const base = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:8000";
        const res = await fetch(`${base}/interview/task/${encodeURIComponent(tid)}`, {
          method: "GET",
          headers: (() => {
            const h = new Headers();
            try {
              const token = typeof window !== "undefined" ? (localStorage.getItem("access_token") || localStorage.getItem("token")) : null;
              if (token) h.set("Authorization", `Bearer ${token}`);
            } catch (e) {}
            h.set("Accept", "application/json");
            return h;
          })(),
          signal: controller.signal,
        });

        if (!res.ok) {
          const txt = await res.text().catch(() => res.statusText);
          setState((s) => ({ ...s, error: `Task endpoint returned ${res.status}: ${txt}` }));
          return;
        }

        const j = await res.json().catch(() => null);
        const status = (j && (j.status || j.state || j.task_state || null)) ?? null;
        const result = j?.result ?? j;
        setState({ status, result, error: null, loading: !(status === "SUCCESS" || status === "FAILURE") });

        if (status === "SUCCESS" || status === "FAILURE") {
          stopped = true;
          controller.abort();
        }
      } catch (err: any) {
        if (!controller.signal.aborted) {
          setState((s) => ({ ...s, error: String(err?.message || err), loading: false }));
        }
      }
    }

    pollOnce();
    const t = setInterval(() => {
      if (!stopped) pollOnce();
    }, intervalMs);

    return () => {
      stopped = true;
      controller.abort();
      clearInterval(t);
    };
  }, [taskId, intervalMs]);

  return state;
}


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

  // track currently active task (for polling)
  const [currentTaskId, setCurrentTaskId] = useState<string | null>(null);
  // optionally remember which question is being rescored (null = whole interview)
  const [currentTaskQuestion, setCurrentTaskQuestion] = useState<number | null>(null);

  // use the inline hook to poll task status
  const taskState = useTaskPoll(currentTaskId, { interval: 1500 });

  // weights used in frontend displays (mirror backend)
  const TECH_W = 0.6;
  const COMM_W = 0.3;
  const COMP_W = 0.1;

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

  // react to task polling state changes
  useEffect(() => {
    if (!currentTaskId) return;
    // when task completes (SUCCESS), refresh report and clear task state
    if (taskState.status === "SUCCESS") {
      // success: refresh and clear
      fetchReport();
      setCurrentTaskId(null);
      setCurrentTaskQuestion(null);
    } else if (taskState.status === "FAILURE") {
      // failure: surface error and clear task state
      setError("Rescore task failed: " + (JSON.stringify(taskState.result || taskState.error) || "unknown"));
      setCurrentTaskId(null);
      setCurrentTaskQuestion(null);
    }
    // if taskState.error present and not finished, show it but keep polling
    if (!taskState.loading && taskState.error) {
      setError(taskState.error);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskState.status, taskState.error, currentTaskId]);

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

  // NEW: rescoreWhole now enqueues and uses polling
  async function rescoreWhole() {
    // if a task already running, ignore
    if (currentTaskId) return;
    setError(null);
    try {
      const url = `${API_BASE}/interview/score/${encodeURIComponent(id)}`;
      const resp = await fetch(url, { method: "POST", headers: getAuthHeader() });
      if (!resp.ok) {
        const txt = await resp.text();
        throw new Error(txt || resp.statusText);
      }
      const j = await resp.json().catch(() => null);
      const tid = j?.task_id || j?.task || j;
      if (!tid) {
        // fallback: server didn't return a task id — refresh immediately
        await fetchReport();
        return;
      }
      setCurrentTaskId(String(tid));
      setCurrentTaskQuestion(null); // whole interview
    } catch (e: any) {
      setError(String(e?.message || e));
    }
  }

  // NEW: rescore individual question with polling
  async function rescoreQuestion(qid: number) {
    // don't start if another task is already running
    if (currentTaskId) return;
    setError(null);
    try {
      // some implementations expect interview_id query param — include it
      const url = `${API_BASE}/interview/score_question/${encodeURIComponent(String(qid))}?interview_id=${encodeURIComponent(
        String(id)
      )}`;
      const resp = await fetch(url, { method: "POST", headers: getAuthHeader() });
      if (!resp.ok) {
        const txt = await resp.text();
        throw new Error(txt || resp.statusText);
      }
      const j = await resp.json().catch(() => null);
      const tid = j?.task_id || j?.task || j;
      if (!tid) {
        // fallback: server didn't return a task id — refresh immediately
        await fetchReport();
        return;
      }
      setCurrentTaskId(String(tid));
      setCurrentTaskQuestion(qid);
    } catch (e: any) {
      setError(String(e?.message || e));
    }
  }

  function getNum(a: any, k: string) {
    if (!a) return 0;
    const v = a[k];
    if (typeof v === "number") return v;
    const n = parseInt(String(v ?? "0"), 10);
    return Number.isNaN(n) ? 0 : n;
  }

  // derive an upload URL for audio preview (best effort)
  function uploadPreviewUrl(uploadId: number | null): string | undefined {
    if (!uploadId) return undefined;
    return `/uploads/${encodeURIComponent(String(uploadId))}`;
  }

  // compute aggregated section scores and per-question list for charts
  function computeAggregate(rs: QItem[] | null) {
    if (!rs || !rs.length) {
      return {
        section: { technical: 0, communication: 0, completeness: 0 },
        overall: 0,
        perQuestion: [] as { name: string; technical: number }[],
      };
    }
    let techSum = 0,
      commSum = 0,
      compSum = 0,
      cntTech = 0,
      cntComm = 0,
      cntComp = 0;

    const perq: { name: string; technical: number }[] = [];

    rs.forEach((q) => {
      const ai = (q.ai_feedback || {}) as any;
      const t = getNum(ai, "technical");
      const c = getNum(ai, "communication");
      const p = getNum(ai, "completeness");

      if (typeof t === "number") {
        techSum += t;
        cntTech++;
      }
      if (typeof c === "number") {
        commSum += c;
        cntComm++;
      }
      if (typeof p === "number") {
        compSum += p;
        cntComp++;
      }

      // For per-question bars use technical if available else overall fallback
      let perScore = t;
      if (!perScore) {
        perScore = Math.round(TECH_W * t + COMM_W * c + COMP_W * p) || 0;
      }
      perq.push({ name: `Q${q.question_id}`, technical: perScore });
    });

    const techAvg = cntTech ? Math.round(techSum / cntTech) : 0;
    const commAvg = cntComm ? Math.round(commSum / cntComm) : 0;
    const compAvg = cntComp ? Math.round(compSum / cntComp) : 0;
    const overall = Math.round(TECH_W * techAvg + COMM_W * commAvg + COMP_W * compAvg);

    return {
      section: { technical: techAvg, communication: commAvg, completeness: compAvg },
      overall,
      perQuestion: perq,
    };
  }

  const agg = computeAggregate(report);

  // helpers to display current task state in UI
  const isTaskRunning = Boolean(currentTaskId && taskState.loading);
  const taskLabel = currentTaskId
    ? taskState.loading
      ? currentTaskQuestion
        ? `Rescoring Q${currentTaskQuestion}...`
        : "Rescoring interview..."
      : taskState.status === "SUCCESS"
      ? "Rescore succeeded"
      : taskState.status === "FAILURE"
      ? "Rescore failed"
      : "Rescore (done)"
    : "";

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-3xl font-bold">Interview Review</h1>
          <div className="text-sm text-muted-foreground">Interview ID: {id}</div>
          {taskLabel && <div className="text-xs text-muted-foreground mt-1">{taskLabel}</div>}
        </div>

        <div className="flex gap-3">
          <button className="px-3 py-1 text-sm bg-blue-600 text-white rounded" onClick={downloadPdf} disabled={!id}>
            Download PDF
          </button>

          <button className="px-3 py-1 border rounded text-sm" onClick={() => router.push(`/interview/${encodeURIComponent(id)}/audit`)}>
            View Scoring History
          </button>

          <button className="px-3 py-1 text-sm border rounded" onClick={() => setRawVisible((s) => !s)}>
            {rawVisible ? "Hide raw" : "Show raw"}
          </button>

          <button
            className="px-3 py-1 text-sm bg-orange-500 text-white rounded"
            onClick={rescoreWhole}
            disabled={isTaskRunning || !id}
          >
            {isTaskRunning && currentTaskQuestion === null ? "Rescoring..." : "Re-score (whole interview)"}
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
            <pre className="bg-gray-100 p-4 rounded mb-4 overflow-auto text-sm">{JSON.stringify(report, null, 2)}</pre>
          )}

          {/* Charts Panel */}
          <div className="mb-6 border rounded p-4">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
              <div className="flex justify-center">
                <ScoreGauge value={agg.overall} />
              </div>

              <div className="lg:col-span-2">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <ScoreBars technical={agg.section.technical} communication={agg.section.communication} completeness={agg.section.completeness} />
                  </div>
                  <div>
                    <RadarChartComponent technical={agg.section.technical} communication={agg.section.communication} completeness={agg.section.completeness} />
                  </div>
                </div>

                <div className="mt-4">
                  <h4 className="text-sm font-medium mb-2">Per-question technical scores</h4>
                  <PerQuestionBar items={agg.perQuestion} />
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            {report.map((q) => {
              const ai = q.ai_feedback || {};
              const technical = getNum(ai, "technical");
              const communication = getNum(ai, "communication");
              const completeness = getNum(ai, "completeness");
              const overall = Math.round(0.6 * technical + 0.3 * communication + 0.1 * completeness);

              const qtype = (String(q.type || "").toLowerCase() || "voice");

              const isThisQuestionRunning = isTaskRunning && currentTaskQuestion === q.question_id;

              return (
                <div key={q.question_id} className="border rounded p-6">
                  <div className="flex flex-col lg:flex-row justify-between">
                    <div style={{ flex: 1, paddingRight: 20 }}>
                      <h3 className="text-lg font-semibold">
                        Q{q.question_id} — Score: {overall}
                      </h3>
                      <p className="mt-2 text-sm text-gray-800">{q.question_text}</p>

                      {qtype === "code" && (
                        <div className="mt-4">
                          <div className="font-medium mb-2">Code answer</div>
                          <pre className="bg-gray-50 p-3 rounded text-sm overflow-auto whitespace-pre-wrap max-h-52">{q.code_answer ? String(q.code_answer) : "—"}</pre>

                          <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
                            <div>
                              <div className="text-xs text-muted-foreground">Test results</div>
                              <div className="mt-1 text-sm">
                                {q.test_results
                                  ? (() => {
                                      const t = q.test_results as any;
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
                              <div className="mt-1 text-sm break-words">{q.code_output ? String(q.code_output) : "—"}</div>
                            </div>

                            <div>
                              <div className="text-xs text-muted-foreground">Cheat flags</div>
                              <div className="mt-1 text-sm">{Array.isArray(q.cheat_flags) && q.cheat_flags.length ? q.cheat_flags.join(", ") : "—"}</div>
                            </div>
                          </div>
                        </div>
                      )}

                      {qtype !== "code" && (
                        <div className="mt-4">
                          <div className="font-medium mb-2">Transcript</div>
                          <div className="bg-gray-50 p-3 rounded text-sm whitespace-pre-wrap">{q.transcript ? String(q.transcript) : "—"}</div>

                          {q.upload_id ? (
                            <div className="mt-3 flex items-center gap-3">
                              <a className="text-sm underline" href={uploadPreviewUrl(q.upload_id)} target="_blank" rel="noreferrer">
                                View recording
                              </a>
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
                          disabled={isTaskRunning}
                        >
                          {isThisQuestionRunning ? "Rescoring..." : "Re-score"}
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="mt-6">
                    <h4 className="font-medium mb-2">AI Feedback</h4>
                    <pre className="bg-gray-50 p-4 rounded text-sm overflow-auto">{JSON.stringify(ai, null, 2)}</pre>

                    <div className="mt-3">
                      <strong>Raw LLM (if available)</strong>
                      <div className="mt-2 bg-gray-50 p-3 rounded text-sm">{q.llm_raw ? String(q.llm_raw) : "—"}</div>
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
