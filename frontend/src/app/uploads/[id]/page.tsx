// src/app/uploads/[id]/page.tsx
"use client";

import { useEffect, useState, useCallback } from "react";
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

  const pill =
    u?.status === "done"
      ? "bg-green-100 text-green-800"
      : u?.status === "failed"
      ? "bg-red-100 text-red-800"
      : "bg-yellow-100 text-yellow-800";

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Upload #{idNum}</h1>
        <Link href="/uploads" className="text-sm underline">
          ← Back to uploads
        </Link>
      </div>

      {loading ? (
        <div>Loading…</div>
      ) : err ? (
        <p className="text-sm text-red-600">{err}</p>
      ) : u ? (
        <div className="space-y-4">
          <div className="text-lg font-medium break-words">{u.filename}</div>
          <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm ${pill}`}>
            {u.status}
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
