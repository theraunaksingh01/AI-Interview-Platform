"use client";

import { useEffect, useState } from "react";

const API_BASE = (
  process.env.NEXT_PUBLIC_API_BASE ||
  process.env.NEXT_PUBLIC_API_URL ||
  "http://127.0.0.1:8000"
).replace(/\/$/, "");

function token() {
  if (typeof window === "undefined") return "";
  return localStorage.getItem("access_token") || localStorage.getItem("API_TOKEN") || "";
}

/**
 * Shows (1) the result of a signup-time promo redeem, once, and
 * (2) a "Have a code?" box for free-plan users.
 * Pass the user's plan if you have it; the code box is hidden for "pro" / "max".
 */
export default function PromoBox({ plan }: { plan?: string | null }) {
  const [flash, setFlash] = useState("");
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    try {
      const m = sessionStorage.getItem("promoMessage");
      if (m) {
        setFlash(m);
        sessionStorage.removeItem("promoMessage");
      }
    } catch { /* ignore */ }
  }, []);

  async function redeem() {
    const c = code.trim().toUpperCase();
    if (!c) return;
    setBusy(true);
    setMsg(null);
    try {
      const r = await fetch(`${API_BASE}/api/promo/redeem`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ code: c }),
      });
      const d = await r.json().catch(() => ({}));
      if (r.ok) {
        setMsg({ ok: true, text: d.message || "Code applied!" });
        setTimeout(() => window.location.reload(), 1500);
      } else {
        setMsg({ ok: false, text: typeof d.detail === "string" ? d.detail : "Could not apply this code." });
      }
    } catch {
      setMsg({ ok: false, text: "Network error. Please try again." });
    }
    setBusy(false);
  }

  // Show unless we know the user is already on a paid plan.
  // (If `plan` is unavailable, the server still rejects non-free users.)
  // Show unless we know the user is already on a paid plan.
  // (If `plan` is unavailable, the server still rejects non-free users.)
  const showBox = plan !== "pro" && plan !== "max";
  if (!flash && !showBox) return null;

  return (
    <div className="mb-5 flex flex-col items-start gap-3">
      {flash && (
        <div
          className="w-full rounded-xl px-4 py-2.5 text-[12px] font-semibold"
          style={{ background: "#FFFDF0", border: "1px solid #FDE68A", color: "#92400E" }}
        >
          {flash}
        </div>
      )}

      {showBox && !open && (
        <button
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-full border border-[#E5E7EB] bg-white px-3.5 py-1.5 text-[12px] font-bold text-[#374151] transition hover:border-[#111] hover:text-[#111]"
        >
          <span aria-hidden>&#127903;</span> Have a code?
        </button>
      )}

      {showBox && open && (
        <div className="w-full max-w-[420px] rounded-2xl border border-[#E5E7EB] bg-white p-3">
          <div className="flex gap-2">
            <input
              autoFocus
              value={code}
              onChange={e => setCode(e.target.value)}
              onKeyDown={e => e.key === "Enter" && redeem()}
              placeholder="Enter code"
              className="min-w-0 flex-1 rounded-xl border border-[#E5E7EB] px-3.5 py-2 text-[13px] uppercase text-[#111] outline-none focus:border-[#111]"
            />
            <button
              onClick={redeem}
              disabled={busy}
              className="rounded-xl bg-[#111] px-4 py-2 text-[12px] font-black text-white disabled:opacity-60"
            >
              {busy ? "..." : "Apply"}
            </button>
            <button
              onClick={() => { setOpen(false); setMsg(null); }}
              aria-label="Close"
              className="px-1 text-[16px] text-[#9CA3AF] hover:text-[#111]"
            >
              &times;
            </button>
          </div>
          {msg && (
            <p className="mt-2 text-[12px]" style={{ color: msg.ok ? "#166534" : "#DC2626" }}>
              {msg.text}
            </p>
          )}
        </div>
      )}
    </div>
  );
}