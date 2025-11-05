"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { requestJSON } from "@/lib/http";

type Upload = {
  id: number;
  filename: string;
  status: "pending" | "processing" | "done" | "failed" | string;
  transcript?: string | null;
  created_at?: string | null;
  size?: number | null;
  content_type?: string | null;
};

const API_BASE = (
  process.env.NEXT_PUBLIC_API_BASE ||
  process.env.NEXT_PUBLIC_API_URL ||
  "http://127.0.0.1:8000"
).replace(/\/$/, "");

export default function UploadDetailPage({ params }: { params: { id: string } }) {
  const idNum = Number(params.id);
  if (Number.isNaN(idNum)) {
    return (
      <div className="p-6">
        Invalid ID in URL. Use <code>/uploads/13</code> (no brackets).
      </div>
    );
  }

  const [u, setU] = useState<Upload | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [retryMsg, setRetryMsg] = useState<string>("");

  // Queue badge state
  const [queueOnline, setQueueOnline] = useState<boolean | null>(null);
  const prevQueueOnline = useRef<boolean | null>(null);
  const autoRetriedOnce = useRef<boolean>(false);

  const fetchOnce = useCallback(async (): Promise<Upload | null> => {
    try {
      setErr(null);
      const data = await requestJSON<Upload>(
        `${API_BASE}/upload/${idNum}`,
        {},
        { withAuth: true }
      );
      setU(data);
      return data;
    } catch (e: any) {
      setErr(e?.message ?? "Failed to load");
      return null;
    } finally {
      setLoading(false);
    }
  }, [idNum]);

  // Poll status
  useEffect(() => {
    let stop = false;
    async function tick() {
      const data = await fetchOnce();
      const s = (data?.status || "").toString();
      if (!stop && s !== "done" && s !== "failed") {
        setTimeout(tick, 2000);
      }
    }
    tick();
    return () => { stop = true; };
  }, [fetchOnce]);

  async function retry() {
    setRetryMsg("");
    try {
      await requestJSON(`${API_BASE}/upload/${idNum}/retry`, { method: "POST" }, { withAuth: true });
      setRetryMsg("Re-queued for processing.");
      autoRetriedOnce.current = true;
      await fetchOnce();
    } catch (e: any) {
      setRetryMsg(e?.message || "Retry failed.");
    }
  }

  async function deleteIt() {
    try {
      await requestJSON(`${API_BASE}/upload/${idNum}`, { method: "DELETE" }, { withAuth: true });
      window.location.href = "/uploads";
    } catch (e: any) {
      alert(e?.message || "Delete failed");
    }
  }

  // Queue badge poller
  useEffect(() => {
    let stop = false;
    async function ping() {
      try {
        const j = await requestJSON<{ redis?: "online" | "offline" }>(
          `${API_BASE}/ops/queue`,
          { cache: "no-store" as any }, // satisfies TS for RequestInit
          {}
        );
        const nowOnline = j?.redis === "online";
        const prev = prevQueueOnline.current;

        const stillPending = u?.status === "pending" || u?.status === "processing";
        if (prev === false && nowOnline === true && stillPending && !autoRetriedOnce.current) {
          retry();
        }

        if (!stop) {
          prevQueueOnline.current = nowOnline;
          setQueueOnline(nowOnline);
        }
      } catch {
        if (!stop) {
          prevQueueOnline.current = false;
          setQueueOnline(false);
        }
      } finally {
        if (!stop) setTimeout(ping, 5000);
      }
    }

    if (prevQueueOnline.current === null) prevQueueOnline.current = queueOnline;
    ping();
    return () => { stop = true; };
    // re-run when status flips to finished/pending again
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [u?.status]);

  const pill =
    u?.status === "done"
      ? "bg-green-100 text-green-800"
      : u?.status === "failed"
      ? "bg-red-100 text-red-800"
      : "bg-yellow-100 text-yellow-800";

  const showSpinner = u?.status === "pending" || u?.status === "processing";

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Upload #{idNum}</h1>
        <Link href="/uploads" className="text-sm underline">
          ← Back to uploads
        </Link>
      </div>

      {/* Queue status badge */}
      <div className="text-xs">
        Queue:&nbsp;
        {queueOnline == null ? (
          "…"
        ) : queueOnline ? (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-green-100 text-green-800">
            online ✅
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-red-100 text-red-800">
            offline ⛔
          </span>
        )}
      </div>

      {loading ? (
        <div>Loading…</div>
      ) : err ? (
        <p className="text-sm text-red-600">{err}</p>
      ) : u ? (
        <div className="space-y-4">
          <div className="text-lg font-medium break-words">{u.filename}</div>
          <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm ${pill}`}>
            <span>{u.status}</span>
            {showSpinner && (
              <span
                className="ml-2 inline-block w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin"
                aria-label="loading"
              />
            )}
          </div>

          <div className="text-sm text-gray-600 space-y-1">
            {u.created_at && <div>Created: {new Date(u.created_at).toLocaleString()}</div>}
            {u.size != null && <div>Size: {u.size} bytes</div>}
            {u.content_type && <div>Type: {u.content_type}</div>}
          </div>

          <div className="flex gap-2">
            {(u.status === "failed" || u.status === "pending" || u.status === "processing") && (
              <button
                onClick={retry}
                className="rounded-md border px-3 py-1.5 text-sm hover:bg-gray-50"
              >
                Retry processing
              </button>
            )}
            <button
              onClick={deleteIt}
              className="rounded-md border px-3 py-1.5 text-sm hover:bg-gray-50"
            >
              Delete
            </button>
          </div>
          {retryMsg && <p className="text-sm text-gray-700">{retryMsg}</p>}

          {u.transcript && (
            <div>
              <h2 className="text-base font-semibold mb-2">Transcript</h2>
              <pre className="whitespace-pre-wrap rounded bg-gray-50 p-3 text-sm">
                {u.transcript}
              </pre>
            </div>
          )}
        </div>
      ) : (
        <p>Not found.</p>
      )}
    </div>
  );
}
