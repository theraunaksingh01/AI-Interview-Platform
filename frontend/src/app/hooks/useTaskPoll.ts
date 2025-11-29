// src/app/hooks/useTaskPoll.ts
import { useEffect, useRef, useState } from "react";

type TaskStatus = {
  status: string | null;
  result: any | null;
  error: string | null;
  loading: boolean;
};

export default function useTaskPoll(taskId: string | null, options?: { interval?: number }) {
  const interval = options?.interval ?? 1000;
  const [state, setState] = useState<TaskStatus>({ status: null, result: null, error: null, loading: !!taskId });
  const stopped = useRef(false);

  function getAuthHeader(): Headers {
    const h = new Headers();
    try {
      const token = typeof window !== "undefined" ? (localStorage.getItem("access_token") || localStorage.getItem("token")) : null;
      if (token) h.set("Authorization", `Bearer ${token}`);
    } catch (e) {}
    h.set("Accept", "application/json");
    return h;
  }

  useEffect(() => {
    if (!taskId) {
      setState({ status: null, result: null, error: null, loading: false });
      return;
    }
    stopped.current = false;
    setState({ status: "PENDING", result: null, error: null, loading: true });

    const abort = new AbortController();
    const poll = async () => {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:8000"}/interview/task/${taskId}`, {
          method: "GET",
          headers: getAuthHeader(),
          signal: abort.signal,
        });
        if (!res.ok) {
          // show error but keep polling (server may be slow)
          const txt = await res.text().catch(() => null);
          setState(s => ({ ...s, error: txt || res.statusText }));
          return;
        }
        const j = await res.json().catch(() => null);
        const status = (j?.status || j?.state || null);
        const result = j?.result ?? null;
        setState({ status, result, error: null, loading: status !== "SUCCESS" && status !== "FAILURE" });
        if (status === "SUCCESS" || status === "FAILURE") {
          abort.abort();
        }
      } catch (e: any) {
        if (!abort.signal.aborted) {
          setState(s => ({ ...s, error: String(e?.message || e) }));
        }
      }
    };

    const t = setInterval(() => {
      if (!stopped.current) poll();
    }, interval);

    // immediate first poll
    poll();

    return () => {
      stopped.current = true;
      abort.abort();
      clearInterval(t);
    };
  }, [taskId, interval]);

  return state;
}
