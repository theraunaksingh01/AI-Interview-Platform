// frontend/src/app/components/ReferralCard.tsx
"use client";

import { useEffect, useState } from "react";

const API_BASE = (
  process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:8000"
).replace(/\/$/, "");

function getToken() {
  return localStorage.getItem("access_token") || localStorage.getItem("API_TOKEN") || "";
}

function authHeaders() {
  return { Authorization: `Bearer ${getToken()}` };
}

type ReferralData = {
  referral_code: string;
  referral_link: string;
  total_referrals: number;
  rewarded_referrals: number;
  bonus_sessions_earned: number;
  bonus_sessions_remaining: number;
  referred_users: { name: string; joined: string | null; reward_given: boolean }[];
  rewards: {
    referrer_gets: string;
    referred_gets: string;
    max_rewarded: number;
  };
};

export function ReferralCard({ prefetchedData }: { prefetchedData?: any }) {
  const [data, setData]           = useState<ReferralData | null>(prefetchedData || null);
  const [loading, setLoading]     = useState(!prefetchedData);
  const [copied, setCopied]       = useState(false);
  const [claimCode, setClaimCode] = useState("");
  const [claiming, setClaiming]   = useState(false);
  const [claimMsg, setClaimMsg]   = useState("");
  const [claimError, setClaimError] = useState("");

  useEffect(() => {
    if (prefetchedData) {
      setData(prefetchedData);
      setLoading(false);
      return;
    }
    const tok = getToken();
    if (!tok) { setLoading(false); return; }
    fetch(`${API_BASE}/api/referral/my`, { headers: authHeaders() })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [prefetchedData]);

  const copyLink = async () => {
    if (!data) return;
    await navigator.clipboard.writeText(data.referral_link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const shareWhatsApp = () => {
    if (!data) return;
    const msg = encodeURIComponent(
      `I've been preparing for placements on Qued — AI mock interviews, OA practice tests, and placement readiness assessment. It's free to try.\n\nUse my link to get 2 bonus sessions when you sign up: ${data.referral_link}`
    );
    window.open(`https://wa.me/?text=${msg}`, "_blank");
  };

  const claimReferral = async () => {
    if (!claimCode.trim()) return;
    setClaiming(true);
    setClaimMsg("");
    setClaimError("");
    try {
      const res = await fetch(`${API_BASE}/api/referral/claim`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ referral_code: claimCode.trim() }),
      });
      const result = await res.json();
      if (res.ok) {
        setClaimMsg(result.message);
        setClaimCode("");
        // Refresh data
        const r2 = await fetch(`${API_BASE}/api/referral/my`, { headers: authHeaders() });
        if (r2.ok) setData(await r2.json());
      } else {
        setClaimError(result.detail || "Invalid code");
      }
    } catch {
      setClaimError("Something went wrong. Try again.");
    }
    setClaiming(false);
  };

  if (loading) {
    return (
      <div className="rounded-2xl border border-[#E5E7EB] bg-white p-6 animate-pulse">
        <div className="h-4 w-32 bg-[#F3F4F6] rounded mb-3" />
        <div className="h-10 w-full bg-[#F3F4F6] rounded" />
      </div>
    );
  }

  if (!data) return (
    <div className="rounded-2xl border border-[#E5E7EB] bg-white p-6 text-center">
      <p className="text-[13px] text-[#9CA3AF]">Unable to load referral data. Please refresh.</p>
    </div>
  );

  return (
    <div className="rounded-2xl border border-[#E5E7EB] bg-white overflow-hidden">

      {/* Header */}
      <div className="px-6 py-5 border-b border-[#F3F4F6]"
        style={{ background: "linear-gradient(135deg, #FFFDF0 0%, #FFF9D6 100%)" }}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[11px] font-black uppercase tracking-widest text-[#9CA3AF] mb-1">
              Refer a friend
            </p>
            <h3 className="text-[18px] font-black text-[#111]" style={{ letterSpacing: "-0.5px" }}>
              Get 3 bonus sessions per referral
            </h3>
            <p className="text-[12px] text-[#6B7280] mt-1">
              Your friend gets 2 bonus sessions too — both of you win.
            </p>
          </div>
          <div className="text-[32px]">🎁</div>
        </div>
      </div>

      <div className="p-6 space-y-5">

        {/* Stats row */}
        {data.total_referrals > 0 && (
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Friends referred",       value: data.total_referrals },
              { label: "Rewarded",               value: data.rewarded_referrals },
              { label: "Bonus sessions earned",  value: data.bonus_sessions_earned },
            ].map(({ label, value }) => (
              <div key={label}
                className="rounded-xl border border-[#F3F4F6] bg-[#FAFAF8] px-3 py-3 text-center">
                <p className="text-[22px] font-black text-[#111]">{value}</p>
                <p className="text-[10px] text-[#9CA3AF] mt-0.5 leading-tight">{label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Referral link */}
        <div>
          <p className="text-[11px] font-black uppercase tracking-widest text-[#9CA3AF] mb-2">
            Your referral link
          </p>
          <div className="flex gap-2">
            <div className="flex-1 rounded-xl border border-[#E5E7EB] bg-[#FAFAF8] px-4 py-2.5 font-mono text-[12px] text-[#374151] truncate">
              {data.referral_link}
            </div>
            <button
              onClick={copyLink}
              className="flex-shrink-0 rounded-xl px-4 py-2.5 text-[12px] font-black transition"
              style={{ background: copied ? "#10B981" : "#111", color: "white" }}
            >
              {copied ? "✓ Copied" : "Copy"}
            </button>
          </div>

          <div className="flex gap-2 mt-2">
            <button
              onClick={shareWhatsApp}
              className="flex-1 flex items-center justify-center gap-2 rounded-xl py-2.5 text-[12px] font-bold transition hover:opacity-90"
              style={{ background: "#25D366", color: "white" }}
            >
              <span>💬</span> Share on WhatsApp
            </button>
            <button
              onClick={copyLink}
              className="flex items-center justify-center gap-2 rounded-xl border border-[#E5E7EB] px-4 py-2.5 text-[12px] font-bold text-[#374151] hover:border-[#111] transition"
            >
              🔗 Copy link
            </button>
          </div>
        </div>

        {/* Code */}
        <div className="flex items-center gap-3 bg-[#FAFAF8] border border-[#F3F4F6] rounded-xl px-4 py-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-[#9CA3AF]">Your code</p>
            <p className="text-[20px] font-black text-[#111] tracking-widest">{data.referral_code}</p>
          </div>
          <button
            onClick={() => navigator.clipboard.writeText(data.referral_code)}
            className="ml-auto text-[11px] font-bold text-[#9CA3AF] hover:text-[#111] transition"
          >
            Copy code
          </button>
        </div>

        {/* How it works */}
        <div className="space-y-2">
          <p className="text-[11px] font-black uppercase tracking-widest text-[#9CA3AF]">How it works</p>
          {[
            { step: "1", text: "Share your link or code with a friend" },
            { step: "2", text: "They sign up and enter your code" },
            { step: "3", text: "You both get bonus sessions instantly" },
          ].map(({ step, text }) => (
            <div key={step} className="flex items-center gap-3">
              <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-[11px] font-black text-white"
                style={{ background: "#111" }}>
                {step}
              </span>
              <p className="text-[13px] text-[#374151]">{text}</p>
            </div>
          ))}
        </div>

        {/* Referred users */}
        {data.referred_users.length > 0 && (
          <div>
            <p className="text-[11px] font-black uppercase tracking-widest text-[#9CA3AF] mb-2">
              Friends who joined
            </p>
            <div className="space-y-1.5">
              {data.referred_users.map((u, i) => (
                <div key={i}
                  className="flex items-center justify-between rounded-xl bg-[#FAFAF8] border border-[#F3F4F6] px-3 py-2">
                  <div className="flex items-center gap-2">
                    <div className="h-7 w-7 rounded-full bg-[#F3F4F6] flex items-center justify-center text-[11px] font-black text-[#374151]">
                      {u.name[0].toUpperCase()}
                    </div>
                    <p className="text-[12px] font-medium text-[#374151]">{u.name}</p>
                  </div>
                  {u.reward_given ? (
                    <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                      +3 sessions earned
                    </span>
                  ) : (
                    <span className="text-[10px] text-[#9CA3AF]">Pending</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Claim a code */}
        <div className="border-t border-[#F3F4F6] pt-4">
          <p className="text-[11px] font-black uppercase tracking-widest text-[#9CA3AF] mb-2">
            Have a referral code?
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              value={claimCode}
              onChange={(e) => setClaimCode(e.target.value.toUpperCase())}
              placeholder="Enter code e.g. RAHUL7X2"
              maxLength={12}
              className="flex-1 rounded-xl border border-[#E5E7EB] px-4 py-2.5 text-[13px] font-mono text-[#374151] outline-none focus:border-[#111] transition"
            />
            <button
              onClick={claimReferral}
              disabled={claiming || !claimCode.trim()}
              className="rounded-xl px-4 py-2.5 text-[12px] font-black text-white transition disabled:opacity-50"
              style={{ background: "#111" }}
            >
              {claiming ? "..." : "Apply"}
            </button>
          </div>
          {claimMsg && <p className="mt-2 text-[12px] font-bold text-emerald-600">✓ {claimMsg}</p>}
          {claimError && <p className="mt-2 text-[12px] text-red-500">{claimError}</p>}
        </div>

      </div>
    </div>
  );
}