// src/app/components/ui/UploadCard.tsx
"use client";
import { useRef, useState } from "react";

const API_BASE = (process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:8000").replace(/\/$/, "");
const ENV_TOKEN = process.env.NEXT_PUBLIC_API_TOKEN || "";

export default function UploadCard({ token, onDone }: { token?: string; onDone?: (u:any)=>void }) {
  const fileRef = useRef<HTMLInputElement|null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  async function start() {
    const file = fileRef.current?.files?.[0];
    if (!file) return setMsg("Pick a file first.");
    setBusy(true); setMsg("");

    try {
      const form = new FormData();
      form.append("file", file);
      const jwt = token || ENV_TOKEN;
      const headers: Record<string,string> = {};
      if (jwt) headers.Authorization = `Bearer ${jwt}`;

      const res = await fetch(`${API_BASE}/upload/proxy`, { method: "POST", body: form, headers, credentials: "include" });
      const text = await res.text();
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${text}`);
      const data = JSON.parse(text);
      setMsg(`Upload started (id ${data.id})`);
      onDone?.(data);
    } catch (e:any) {
      setMsg(e?.message || "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="border rounded-lg p-4 space-y-2">
      <input ref={fileRef} type="file" />
      <button onClick={start} disabled={busy} className="rounded border px-3 py-1.5 text-sm">
        {busy ? "Uploading…" : "Start upload"}
      </button>
      {msg && <div className="text-sm text-gray-600">{msg}</div>}
    </div>
  );
}
