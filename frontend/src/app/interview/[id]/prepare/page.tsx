"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

const API_BASE = (
  process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000"
).replace(/\/$/, "");

export default function PreparePage() {
  const { id } = useParams();
  const router = useRouter();
  const [status, setStatus] = useState("Generating interview questions...");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        // Use public endpoint — no auth required for candidates
        const res = await fetch(`${API_BASE}/public/interview/${id}/status`);

        if (!res.ok) {
          setError("Failed to check interview status");
          return;
        }

        const data = await res.json();

        if (cancelled) return;

        if (data.questions_ready) {
          setStatus("Questions ready! Starting interview...");
          setTimeout(() => {
            if (!cancelled) router.replace(`/interview/${id}/live`);
          }, 800);
          return;
        }

        // Keep polling
        setTimeout(() => {
          if (!cancelled) poll();
        }, 2000);
      } catch {
        if (!cancelled) setError("Connection error. Retrying...");
        setTimeout(() => {
          if (!cancelled) poll();
        }, 3000);
      }
    }

    poll();
    return () => { cancelled = true; };
  }, [id, router]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
      <Loader2 className="h-10 w-10 animate-spin text-indigo-600" />
      <h1 className="text-xl font-semibold text-slate-800">{status}</h1>
      <p className="text-sm text-slate-500">
        This usually takes a few seconds. You&apos;ll be redirected automatically.
      </p>
      {error && (
        <p className="text-sm text-amber-600 bg-amber-50 rounded-lg px-4 py-2">{error}</p>
      )}
    </div>
  );
}
