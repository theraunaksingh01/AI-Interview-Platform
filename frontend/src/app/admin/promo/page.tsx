"use client";

import { useCallback, useEffect, useState } from "react";

const API_BASE = (
  process.env.NEXT_PUBLIC_API_BASE ||
  process.env.NEXT_PUBLIC_API_URL ||
  "http://127.0.0.1:8000"
).replace(/\/$/, "");

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://cractal.in").replace(/\/$/, "");

type App = {
  id: number;
  name: string;
  email: string;
  college: string | null;
  city: string | null;
  branch: string | null;
  year: string | null;
  next_test: string | null;
  current_prep: string | null;
  whatsapp: string | null;
  status: "applied" | "accepted" | "waitlist" | "rejected" | "joined";
  created_at: string | null;
};

type ListResp = {
  items: App[];
  counts: Record<string, number>;
  spots_left: number;
  max_uses: number;
  code: string;
};

const FILTERS = ["applied", "accepted", "waitlist", "rejected", "joined", "all"] as const;

function token() {
  if (typeof window === "undefined") return "";
  return localStorage.getItem("access_token") || localStorage.getItem("API_TOKEN") || "";
}

function waNumber(raw: string | null): string {
  if (!raw) return "";
  let d = raw.replace(/\D/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  if (d.length === 11 && d.startsWith("0")) d = d.slice(1);
  if (d.length === 10) d = "91" + d;
  return d;
}

function inviteMessage(name: string) {
  const first = (name || "").trim().split(" ")[0] || "there";
  return (
    `Hi ${first}, you're in the Cractal Founding 50! 🎉\n\n` +
    `Sign up with the SAME email you applied with:\n${SITE_URL}/signup?code=FOUNDING50\n\n` +
    `You get Pro free for 30 days. In a few days I'll ask for your honest feedback. Thanks!`
  );
}

const STATUS_STYLE: Record<string, { bg: string; fg: string }> = {
  applied: { bg: "#F3F4F6", fg: "#374151" },
  accepted: { bg: "#DCFCE7", fg: "#166534" },
  waitlist: { bg: "#FEF3C7", fg: "#92400E" },
  rejected: { bg: "#FEE2E2", fg: "#991B1B" },
  joined: { bg: "#DBEAFE", fg: "#1E40AF" },
};

export default function AdminPromoPage() {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("applied");
  const [data, setData] = useState<ListResp | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const qs = filter === "all" ? "" : `?status=${filter}`;
      const res = await fetch(`${API_BASE}/api/admin/promo/applications${qs}`, {
        headers: { Authorization: `Bearer ${token()}` },
      });
      if (res.status === 403) { setError("Admin access required."); setLoading(false); return; }
      if (!res.ok) { setError(`Failed to load (${res.status})`); setLoading(false); return; }
      setData(await res.json());
    } catch {
      setError("Network error. Is the backend running?");
    }
    setLoading(false);
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  async function setStatus(id: number, status: string) {
    setBusyId(id);
    try {
      const res = await fetch(`${API_BASE}/api/admin/promo/applications/${id}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(typeof d.detail === "string" ? d.detail : "Update failed");
      } else {
        setError("");
        await load();
      }
    } catch {
      setError("Network error");
    }
    setBusyId(null);
  }

  const counts = data?.counts || {};

  return (
    <div className="p-6 max-w-[1100px]">
      <h1 className="text-[22px] font-black text-[#111] mb-1">Founding 50 applications</h1>
      <p className="text-[13px] text-[#6B7280] mb-5">
        Accept an application, then send the WhatsApp invite. Pro unlocks automatically when they sign up with the same email.
      </p>

      {/* Counters */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-5">
        {[
          { label: "Applied", v: counts.applied ?? 0 },
          { label: "Accepted", v: counts.accepted ?? 0 },
          { label: "Waitlist", v: counts.waitlist ?? 0 },
          { label: "Joined", v: counts.joined ?? 0 },
          { label: "Spots left", v: data ? `${data.spots_left}/${data.max_uses}` : "-" },
        ].map(c => (
          <div key={c.label} className="rounded-xl border border-[#E5E7EB] bg-white px-4 py-3">
            <p className="text-[11px] font-bold text-[#9CA3AF] uppercase tracking-wide">{c.label}</p>
            <p className="text-[22px] font-black text-[#111]">{c.v}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-4">
        {FILTERS.map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className="rounded-full border px-3.5 py-1.5 text-[12px] font-semibold capitalize transition"
            style={{
              borderColor: filter === f ? "#111" : "#E5E7EB",
              background: filter === f ? "#111" : "white",
              color: filter === f ? "white" : "#374151",
            }}
          >
            {f}
          </button>
        ))}
      </div>

      {error && <p className="mb-3 text-[12px] text-red-500">{error}</p>}
      {loading && <p className="text-[13px] text-[#9CA3AF]">Loading...</p>}
      {!loading && data && data.items.length === 0 && (
        <p className="text-[13px] text-[#9CA3AF]">No applications in this view.</p>
      )}

      <div className="space-y-3">
        {data?.items.map(a => {
          const st = STATUS_STYLE[a.status] || STATUS_STYLE.applied;
          const num = waNumber(a.whatsapp);
          const waHref = num ? `https://wa.me/${num}?text=${encodeURIComponent(inviteMessage(a.name))}` : "";
          const busy = busyId === a.id;
          return (
            <div key={a.id} className="rounded-2xl border border-[#E5E7EB] bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-[14px] font-black text-[#111]">
                    {a.name}{" "}
                    <span
                      className="ml-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase"
                      style={{ background: st.bg, color: st.fg }}
                    >
                      {a.status}
                    </span>
                  </p>
                  <p className="text-[12px] text-[#6B7280]">{a.email} · {a.whatsapp || "no WhatsApp"}</p>
                </div>
                <p className="text-[11px] text-[#9CA3AF]">
                  #{a.id} · {a.created_at ? new Date(a.created_at).toLocaleString() : ""}
                </p>
              </div>

              <p className="mt-2 text-[12px] text-[#374151]">
                {[a.college, a.city].filter(Boolean).join(", ")}
                {a.branch ? ` · ${a.branch}` : ""}
                {a.year ? ` · ${a.year}` : ""}
              </p>
              {a.next_test && <p className="text-[12px] text-[#374151]"><b>Next test:</b> {a.next_test}</p>}
              {a.current_prep && <p className="text-[12px] text-[#374151]"><b>Current prep:</b> {a.current_prep}</p>}

              <div className="mt-3 flex flex-wrap gap-2">
                {a.status !== "joined" && (
                  <>
                    <button disabled={busy || a.status === "accepted"} onClick={() => setStatus(a.id, "accepted")}
                      className="rounded-lg bg-[#111] px-3 py-1.5 text-[12px] font-bold text-white disabled:opacity-40">
                      Accept
                    </button>
                    <button disabled={busy || a.status === "waitlist"} onClick={() => setStatus(a.id, "waitlist")}
                      className="rounded-lg border border-[#E5E7EB] px-3 py-1.5 text-[12px] font-bold text-[#374151] disabled:opacity-40">
                      Waitlist
                    </button>
                    <button disabled={busy || a.status === "rejected"} onClick={() => setStatus(a.id, "rejected")}
                      className="rounded-lg border border-[#E5E7EB] px-3 py-1.5 text-[12px] font-bold text-[#991B1B] disabled:opacity-40">
                      Reject
                    </button>
                  </>
                )}
                {a.status === "accepted" && waHref && (
                  <a href={waHref} target="_blank" rel="noopener noreferrer"
                    className="rounded-lg px-3 py-1.5 text-[12px] font-bold"
                    style={{ background: "#FFD600", color: "#111" }}>
                    Open in WhatsApp
                  </a>
                )}
                {a.status === "accepted" && !waHref && (
                  <span className="text-[12px] text-[#9CA3AF] self-center">No valid WhatsApp number</span>
                )}
                {a.status === "accepted" && (
                  <button
                    onClick={() => navigator.clipboard?.writeText(inviteMessage(a.name))}
                    className="rounded-lg border border-[#E5E7EB] px-3 py-1.5 text-[12px] font-bold text-[#374151]">
                    Copy message
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}