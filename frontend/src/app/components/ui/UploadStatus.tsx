// src/app/components/ui/UploadStatus.tsx
"use client";
import { useEffect, useState } from "react";

const API_BASE = (process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:8000").replace(/\/$/, "");
const ENV_TOKEN = process.env.NEXT_PUBLIC_API_TOKEN || "";

type Upload = { id:number; status:string; transcript?:string|null };

export default function UploadStatus({ id, token }: { id:number; token?:string }) {
  const [u, setU] = useState<Upload | null>(null);

  useEffect(() => {
    let stop = false;
    const jwt = token || ENV_TOKEN || (typeof window !== "undefined" ? localStorage.getItem("API_TOKEN") || "" : "");
    const headers: Record<string,string> = {};
    if (jwt) headers.Authorization = `Bearer ${jwt}`;

    async function poll() {
      try {
        const r = await fetch(`${API_BASE}/upload/${id}`, { headers, credentials: "include" });
        if (r.ok) {
          const data = await r.json();
          setU(data);
          if (data.status === "done" || data.status === "failed") return;
        }
      } catch {}
      if (!stop) setTimeout(poll, 2000);
    }
    poll();
    return () => { stop = true; };
  }, [id, token]);

  return (
    <div className="space-y-2">
      <div className="text-sm">Status: {u?.status ?? "pending"}</div>
      {u?.transcript && <pre className="bg-gray-50 p-3 rounded text-sm whitespace-pre-wrap">{u.transcript}</pre>}
    </div>
  );
}
