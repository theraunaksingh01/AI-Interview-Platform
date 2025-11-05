"use client";

import { useState, useRef } from "react";
import { requestJSON } from "@/lib/http";
import { getJwt } from "@/lib/auth";

const API_BASE = (
  process.env.NEXT_PUBLIC_API_BASE ||
  process.env.NEXT_PUBLIC_API_URL ||
  "http://127.0.0.1:8000"
).replace(/\/$/, "");

type Props = {
  token?: string;       // optional – if not provided we use getJwt()
  onDone?: () => void;  // optional callback to refresh list
};

export default function UploadCard({ token, onDone }: Props) {
  const [mode, setMode] = useState<"proxy" | "browser">("proxy");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string>("");
  const fileRef = useRef<HTMLInputElement | null>(null);

  async function ensureAuth(): Promise<void> {
    if (token) return;
    await getJwt(); // kicks possible refresh
  }

  async function uploadViaProxy(file: File) {
    const form = new FormData();
    form.append("file", file);

    const data = await requestJSON(
      `${API_BASE}/upload/proxy`,
      { method: "POST", body: form },
      { withAuth: true }
    );
    setMsg(`Upload started (id ${data.id}). Status: ${data.status}`);
    onDone?.();
  }

  async function uploadViaBrowser(file: File) {
    // 1) presign
    const presign = await requestJSON<{ url: string; key: string; expires_in: number }>(
      `${API_BASE}/upload/presign`,
      {
        method: "POST",
        body: JSON.stringify({
          filename: file.name,
          content_type: file.type || "application/octet-stream",
          folder: "browser",
        }),
      },
      { withAuth: true }
    );

    // 2) PUT directly to S3/MinIO
    const putRes = await fetch(presign.url, {
      method: "PUT",
      body: file,
      headers: { "Content-Type": file.type || "application/octet-stream" },
    });
    if (!putRes.ok) {
      const t = await putRes.text();
      throw new Error(`S3 PUT failed: ${putRes.status} ${t}`);
    }

    // 3) finalize so backend creates DB row
    const fin = await requestJSON<{ id: number; status: string }>(
      `${API_BASE}/upload/finalize`,
      {
        method: "POST",
        body: JSON.stringify({
          key: presign.key,
          filename: file.name,
          content_type: file.type || "application/octet-stream",
          size: file.size,
        }),
      },
      { withAuth: true }
    );

    setMsg(`Browser upload ok. Finalized as id ${fin.id} (${fin.status}).`);
    onDone?.();
  }

  async function startUpload() {
    setMsg("");
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setMsg("Pick a file first.");
      return;
    }
    setBusy(true);
    try {
      await ensureAuth();
      if (mode === "proxy") await uploadViaProxy(file);
      else await uploadViaBrowser(file);
    } catch (e: any) {
      setMsg(e?.message || "Failed to upload");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="border rounded-lg p-4 space-y-3">
      <div className="flex gap-2 text-sm">
        <button
          className={`px-2 py-1 rounded border ${mode === "proxy" ? "bg-gray-100" : ""}`}
          onClick={() => setMode("proxy")}
        >
          Proxy upload
        </button>
        <button
          className={`px-2 py-1 rounded border ${mode === "browser" ? "bg-gray-100" : ""}`}
          onClick={() => setMode("browser")}
        >
          Browser (presigned)
        </button>
      </div>

      <input ref={fileRef} type="file" className="block" />
      <button
        onClick={startUpload}
        disabled={busy}
        className="rounded-md border px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-50"
      >
        {busy ? "Uploading…" : "Start upload"}
      </button>

      {msg && <p className="text-sm text-gray-700">{msg}</p>}
    </div>
  );
}
