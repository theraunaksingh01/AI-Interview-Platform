// src/app/uploads/[id]/page.tsx
"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";

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

const ENV_TOKEN = process.env.NEXT_PUBLIC_API_TOKEN || "";
const getToken = () =>
  (typeof window !== "undefined" ? localStorage.getItem("API_TOKEN") || "" : "") ||
  ENV_TOKEN;

export default function UploadDetailPage({ params }: { params: { id: string } }) {
  // Guard: /uploads/13 (no brackets). If not a number, show a friendly message.
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

  // Queue badge state: null = unknown, true = online, false = offline
  const [queueOnline, setQueueOnline] = useState<boolean | null>(null);
  const prevQueueOnline = useRef<boolean | null>(null);
  const autoRetriedOnce = useRef<boolean>(false); // prevent loops

  // Fetch once and also return the payload so poller can decide to stop
  const fetchOnce = useCallback(async (): Promise<Upload | null> => {
    try {
      setErr(null);
      const jwt = getToken();
      const headers: Record<string, string> = {};
      if (jwt) headers.Authorization = `Bearer ${jwt}`;

      const res = await fetch(`${API_BASE}/upload/${idNum}`, {
        headers,
        cache: "no-store",
      });
      if (!res.ok) {
        const body = await res.text();
        throw new Error(`HTTP ${res.status}: ${body}`);
      }
      const data = (await res.json()) as Upload;
      setU(data);
      return data;
    } catch (e: any) {
      setErr(e?.message ?? "Failed to load");
      return null;
    } finally {
      setLoading(false);
    }
  }, [idNum]);

  // Poll until status is done/failed
  useEffect(() => {
    let stop = false;

    async function tick() {
      const data = await fetchOnce();
      const s = (data?.status || "").toString();
      const finished = s === "done" || s === "failed";
      if (!stop && !finished) {
        setTimeout(tick, 2000);
      }
    }

    tick();
    return () => {
      stop = true;
    };
  }, [fetchOnce]);

  async function retry() {
    setRetryMsg("");
    try {
      const jwt = getToken();
      const headers: Record<string, string> = {};
      if (jwt) headers.Authorization = `Bearer ${jwt}`;

      const res = await fetch(`${API_BASE}/upload/${idNum}/retry`, {
        method: "POST",
        headers,
      });
      const text = await res.text();
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${text}`);
      setRetryMsg("Re-queued for processing.");
      autoRetriedOnce.current = true; // avoid immediate repeat auto-retry
      // Kick the poller by fetching immediately
      await fetchOnce();
    } catch (e: any) {
      setRetryMsg(e?.message || "Retry failed.");
    }
  }

  async function deleteIt() {
    try {
      const jwt = getToken();
      const headers: Record<string, string> = {};
      if (jwt) headers.Authorization = `Bearer ${jwt}`;

      const res = await fetch(`${API_BASE}/upload/${idNum}`, {
        method: "DELETE",
        headers,
      });
      if (!res.ok) {
        const text = await res.text();
        alert(`Delete failed: ${res.status} ${text}`);
        return;
      }
      // Navigate back to list
      window.location.href = "/uploads";
    } catch (e: any) {
      alert(e?.message || "Delete failed");
    }
  }

  // ---- Queue badge poller (every ~5s) ----
  useEffect(() => {
    let stop = false;

    async function ping() {
      try {
        const res = await fetch(`${API_BASE}/ops/queue`, { cache: "no-store" });
        const j = await res.json().catch(() => ({}));
        const nowOnline = j?.redis === "online";
        const prev = prevQueueOnline.current;

        // Detect offline -> online transition and auto-retry if still pending
        const stillPending = (u?.status === "pending" || u?.status === "processing"); // auto-retry mainly for pending; allow processing safe no-op
        if (prev === false && nowOnline === true && stillPending && !autoRetriedOnce.current) {
          // Fire and forget; don't await to avoid blocking the poll loop
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

    // initialize prev value on first run
    if (prevQueueOnline.current === null) prevQueueOnline.current = queueOnline;

    ping();
    return () => {
      stop = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [u?.status]); // re-evaluate when upload status changes

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
            {u.created_at && (
              <div>Created: {new Date(u.created_at).toLocaleString()}</div>
            )}
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
