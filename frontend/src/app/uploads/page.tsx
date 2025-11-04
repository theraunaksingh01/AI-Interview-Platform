"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import Link from "next/link";
import UploadCard from "../components/ui/UploadCard";

type Upload = {
  id: number;
  filename: string;
  status: "pending" | "processing" | "done" | "failed" | string;
  size?: number | null;
  created_at?: string | null;
};

const API_BASE = (process.env.NEXT_PUBLIC_API_BASE ||
  process.env.NEXT_PUBLIC_API_URL ||
  "http://127.0.0.1:8000").replace(/\/$/, "");

const ENV_TOKEN = process.env.NEXT_PUBLIC_API_TOKEN || "";

const getToken = () => {
  if (typeof window !== "undefined") {
    const ls = localStorage.getItem("API_TOKEN");
    if (ls) return ls;
  }
  return ENV_TOKEN;
};

export default function UploadsPage() {
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [debug, setDebug] = useState<string>("");

  const demoData: Upload[] = useMemo(
    () => [
      { id: 101, filename: "resume_rahul.pdf", status: "done", size: 214567, created_at: new Date().toISOString() },
      { id: 102, filename: "jd_frontend.md", status: "processing", size: 12567, created_at: new Date().toISOString() },
      { id: 103, filename: "dataset.csv", status: "failed", size: 652314, created_at: new Date().toISOString() },
    ],
    []
  );

  const fetchUploads = useCallback(async () => {
    setLoading(true);
    setErr(null);
    setDebug("");
    try {
      const jwt = getToken();
      const headers: Record<string, string> = {};
      if (jwt) headers.Authorization = `Bearer ${jwt}`;

      const res = await fetch(`${API_BASE}/uploads/me`, {
        headers,
        credentials: "include",
        cache: "no-store",
      });

      if (!res.ok) {
        const body = await res.text();
        if (res.status === 401) {
          setDebug(
            `401 from /uploads/me\nToken present: ${jwt ? "yes" : "no"}\nToken head: ${
              jwt ? jwt.slice(0, 12) + "..." : "(none)"
            }\nBody: ${body}`
          );
        }
        throw new Error(`HTTP ${res.status}: ${body}`);
      }

      const data = (await res.json()) as Upload[];
      setUploads(data);
    } catch (e: any) {
      setErr(e?.message ?? "Failed to load uploads");
      setUploads(demoData);
    } finally {
      setLoading(false);
    }
  }, [demoData]);

  useEffect(() => {
    fetchUploads();
  }, [fetchUploads]);

  return (
    <div className="p-6 space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Uploads</h1>
        <button
          className="rounded-md border px-3 py-1.5 text-sm hover:bg-gray-50"
          onClick={fetchUploads}
        >
          Refresh
        </button>
      </header>

      {!getToken() && (
        <p className="text-xs text-amber-600">
          No token found. Run{" "}
          <code>localStorage.setItem("API_TOKEN", "YOUR_JWT")</code> in the console and refresh.
        </p>
      )}

      <section>
        <UploadCard token={getToken()} onDone={fetchUploads} />
      </section>

      {loading ? (
        <div>Loading uploads…</div>
      ) : (
        <>
          {err && (
            <p className="text-sm text-amber-600">
              Backend not responding ({err}). Showing demo data.
            </p>
          )}

          {debug && (
            <pre className="text-xs bg-gray-50 p-2 rounded whitespace-pre-wrap">{debug}</pre>
          )}

          {uploads.length === 0 ? (
            <p>No uploads yet.</p>
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {uploads.map((u) => {
                const pill =
                  u.status === "done"
                    ? "bg-green-100 text-green-800"
                    : u.status === "failed"
                    ? "bg-red-100 text-red-800"
                    : "bg-yellow-100 text-yellow-800";
                            
                async function del() {
                  const jwt =
                    (typeof window !== "undefined" ? localStorage.getItem("API_TOKEN") || "" : "") ||
                    process.env.NEXT_PUBLIC_API_TOKEN || "";
                  const headers: Record<string, string> = {};
                  if (jwt) headers.Authorization = `Bearer ${jwt}`;
                  const res = await fetch(
                    `${(process.env.NEXT_PUBLIC_API_BASE || process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000").replace(/\/$/, "")}/upload/${u.id}`,
                    { method: "DELETE", headers, credentials: "include" }
                  );
                  if (res.ok) {
                    // remove from UI quickly or refetch
                    setUploads((prev) => prev.filter((x) => x.id !== u.id));
                  } else {
                    alert(`Delete failed: ${res.status} ${await res.text()}`);
                  }
                }
              
                return (
                  <li key={u.id} className="border rounded-lg p-4 hover:shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <Link href={`/uploads/${encodeURIComponent(u.id)}`} className="no-underline flex-1">
                        <div className="font-medium truncate">{u.filename}</div>
                        <div className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs mt-2 ${pill}`}>
                          {u.status}
                        </div>
                        {u.created_at && (
                          <div className="text-xs text-gray-500 mt-2">
                            Created: {new Date(u.created_at).toLocaleString()}
                          </div>
                        )}
                      </Link>
                      <button
                        onClick={del}
                        className="text-xs border rounded px-2 py-1 hover:bg-gray-50"
                        title="Delete"
                      >
                        Delete
                      </button>
                    </div>
                  </li>
                );
              })}
              
            </ul>
          )}
        </>
      )}
    </div>
  );
}
