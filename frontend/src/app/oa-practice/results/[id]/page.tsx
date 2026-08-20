// frontend/src/app/oa-practice/results/[id]/page.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { AIDisclaimer } from "@/app/components/AIDisclaimer";

const API_BASE = (
  process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:8000"
).replace(/\/$/, "");

const SECTION_LABELS: Record<string, string> = {
  numerical: "Numerical Ability",
  verbal: "Verbal Ability",
  reasoning: "Reasoning Ability",
};

const BAND_STYLES: Record<string, { bg: string; color: string; border: string }> = {
  prime: { bg: "#FFF9C4", color: "#7A6000", border: "#FFD600" },
  digital: { bg: "#EEF2FF", color: "#4338CA", border: "#6366F1" },
  ninja: { bg: "#F0FDF4", color: "#065F46", border: "#10B981" },
  not_qualified: { bg: "#FEF2F2", color: "#991B1B", border: "#EF4444" },
};

function ScoreBar({ score }: { score: number }) {
  const color = score >= 70 ? "#10B981" : score >= 50 ? "#F59E0B" : "#EF4444";
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-2 rounded-full bg-[#E5E7EB] overflow-hidden">
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${score}%`, background: color }} />
      </div>
      <span className="text-[13px] font-bold text-[#111] w-8 text-right">{score}%</span>
    </div>
  );
}

export default function OAResultsPage() {
  const { id } = useParams() as { id: string };
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [results, setResults] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.replace(`/login?next=/oa-practice/results/${id}`); return; }

    const token = localStorage.getItem("API_TOKEN") || localStorage.getItem("access_token") || "";
    fetch(`${API_BASE}/api/oa/results/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => { if (!r.ok) throw new Error("Results not found"); return r.json(); })
      .then(setResults)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [user, authLoading, id]);

  if (loading) {
    return (
      <main className="min-h-screen px-4 pb-16 pt-24" style={{ background: "#FAFAF8" }}>
        <div className="mx-auto max-w-[680px] space-y-4">

          <div className="rounded-3xl overflow-hidden" style={{ background: "#111" }}>
            <div className="px-8 py-8 text-center">
              <div className="h-3 w-32 mx-auto mb-4 rounded bg-white/10 animate-pulse" />
              <div className="h-16 w-28 mx-auto mb-4 rounded-xl bg-white/10 animate-pulse" />
              <div className="h-8 w-40 mx-auto rounded-full bg-white/10 animate-pulse" />
            </div>
            <div className="grid grid-cols-3 divide-x divide-[#222] border-t border-[#222]">
              {[1, 2, 3].map((i) => (
                <div key={i} className="py-4 text-center">
                  <div className="h-2 w-10 mx-auto mb-2 rounded bg-white/10 animate-pulse" />
                  <div className="h-5 w-8 mx-auto rounded bg-white/10 animate-pulse" />
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-[#E5E7EB] bg-white p-6 space-y-4">
            <div className="h-3 w-32 rounded bg-gray-100 animate-pulse mb-2" />
            {[1, 2, 3].map((i) => (
              <div key={i}>
                <div className="flex justify-between mb-2">
                  <div className="h-3 w-24 rounded bg-gray-100 animate-pulse" />
                  <div className="h-3 w-16 rounded bg-gray-100 animate-pulse" />
                </div>
                <div className="h-2 w-full rounded-full bg-gray-100 animate-pulse" />
              </div>
            ))}
          </div>

          <div className="rounded-2xl border border-[#E5E7EB] bg-white p-6 space-y-3">
            <div className="h-3 w-28 rounded bg-gray-100 animate-pulse mb-2" />
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-14 w-full rounded-xl bg-gray-50 animate-pulse" />
            ))}
          </div>

        </div>
      </main>
    );
  }

  if (error || !results) {
    return (
      <main className="min-h-screen flex items-center justify-center px-4" style={{ background: "#FAFAF8" }}>
        <div className="text-center">
          <p className="text-[16px] font-bold text-[#111] mb-2">Results not found</p>
          <Link href="/oa-practice"><button className="rounded-xl bg-[#111] px-6 py-2.5 text-[13px] font-black text-white">Back to OA Practice</button></Link>
        </div>
      </main>
    );
  }

  const band = results.band_prediction || "not_qualified";
  const bandStyle = BAND_STYLES[band] || BAND_STYLES.not_qualified;
  const bandInfo = results.band_info || results.all_bands?.[band];
  const sectionScores: Record<string, number> = results.section_scores || {};
  const timeTaken = results.time_taken_sec || 0;
  const allBands = results.all_bands || {};

  const shareOnWhatsApp = () => {
    const bandLabel = bandInfo?.label || band;
    const msg = encodeURIComponent(
      `Just completed a ${results.company?.toUpperCase()} NQT mock test on Qued!\n\n` +
      `Score: ${results.total_score}% — ${bandLabel} band prediction 🎯\n\n` +
      `Try it free: https://qued.in/oa-practice\n\n` +
      `#TCSPlacement #CampusPlacement #Qued`
    );
    window.open(`https://wa.me/?text=${msg}`, "_blank");
  };

  return (
    <main className="min-h-screen pt-24 pb-16 px-4" style={{ background: "#FAFAF8" }}>
      <div className="mx-auto max-w-[680px] space-y-5">

        <Link href="/oa-practice" className="inline-flex items-center gap-1 text-[12px] font-medium text-[#9CA3AF] hover:text-[#111] transition">
          ← All OA tests
        </Link>

        {/* ── Hero ── */}
        <div className="rounded-3xl overflow-hidden" style={{ background: "#111", boxShadow: "0 4px 40px rgba(0,0,0,0.15)" }}>
          <div className="px-8 py-8 text-center">
            <p className="text-[11px] font-black uppercase tracking-widest text-[#555] mb-3">
              {results.company?.toUpperCase()} NQT Practice Result
            </p>
            <div className="text-[72px] font-black text-white leading-none mb-3">
              {results.total_score}%
            </div>

            {/* Band prediction */}
            <div
              className="inline-flex items-center gap-2 rounded-2xl border px-5 py-2.5 mb-3"
              style={{ background: bandStyle.bg, borderColor: bandStyle.border }}
            >
              <span className="text-[15px] font-black" style={{ color: bandStyle.color }}>
                {bandInfo?.label || band.replace("_", " ").toUpperCase()} Band
              </span>
              {bandInfo?.ctc && (
                <span className="text-[12px] font-medium" style={{ color: bandStyle.color }}>
                  · {bandInfo.ctc}
                </span>
              )}
            </div>

            <p className="text-[13px] text-[#555]">
              Time taken: {Math.floor(timeTaken / 60)}m {timeTaken % 60}s
            </p>
          </div>

          {/* Section scores strip */}
          <div
            className="grid divide-x divide-[#222] border-t border-[#222]"
            style={{ gridTemplateColumns: `repeat(${Object.keys(sectionScores).length}, 1fr)` }}
          >
            {Object.entries(sectionScores).map(([key, score]) => (
              <div key={key} className="px-4 py-4 text-center">
                <p className="text-[10px] font-black uppercase tracking-widest text-[#555] mb-1">
                  {SECTION_LABELS[key] || key}
                </p>
                <p className="text-[20px] font-black text-white leading-none">{score}%</p>
              </div>
            ))}
          </div>
        </div>

        <AIDisclaimer variant="compact" />

        {/* ── Section breakdown ── */}
        <div className="rounded-2xl border border-[#E5E7EB] bg-white p-6">
          <h2 className="text-[16px] font-black text-[#111] mb-5">Section breakdown</h2>
          <div className="space-y-4">
            {Object.entries(sectionScores).map(([key, score]) => (
              <div key={key}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[13px] font-medium text-[#374151]">
                    {SECTION_LABELS[key] || key}
                  </span>
                  <span className="text-[12px] text-[#9CA3AF]">
                    {score >= 70 ? "Strong" : score >= 50 ? "Developing" : "Needs Work"}
                  </span>
                </div>
                <ScoreBar score={score as number} />
              </div>
            ))}
          </div>
        </div>

        {/* ── Band breakdown ── */}
        <div className="rounded-2xl border border-[#E5E7EB] bg-white p-6">
          <h2 className="text-[16px] font-black text-[#111] mb-4">Band thresholds</h2>
          <div className="space-y-3">
            {Object.entries(allBands).reverse().map(([bandKey, bandData]: [string, any]) => {
              const isYours = bandKey === band;
              const style = BAND_STYLES[bandKey] || BAND_STYLES.ninja;
              return (
                <div
                  key={bandKey}
                  className="flex items-center justify-between rounded-xl px-4 py-3 border"
                  style={{
                    borderColor: isYours ? style.border : "#F3F4F6",
                    background: isYours ? style.bg : "#F9FAFB",
                  }}
                >
                  <div>
                    <p className="text-[13px] font-black" style={{ color: isYours ? style.color : "#374151" }}>
                      {bandData.label}
                      {isYours && <span className="ml-2 text-[10px]">← Your band</span>}
                    </p>
                    <p className="text-[11px] text-[#9CA3AF]">{bandData.ctc}</p>
                  </div>
                  <p className="text-[13px] font-bold text-[#9CA3AF]">
                    {bandData.min_pct}%+
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── What to do next ── */}
        <div className="rounded-2xl border border-[#E5E7EB] bg-white p-6">
          <h2 className="text-[16px] font-black text-[#111] mb-4">What to do next</h2>
          <div className="space-y-3">
            {results.total_score < 65 && (
              <div className="flex items-start gap-3 rounded-xl bg-[#F9FAFB] border border-[#F3F4F6] p-4">
                <span className="text-[20px]">📈</span>
                <div>
                  <p className="text-[13px] font-black text-[#111] mb-0.5">Practice more aptitude questions</p>
                  <p className="text-[12px] text-[#6B7280]">Score 65%+ to be eligible for Digital band. Focus on the weakest section above.</p>
                </div>
              </div>
            )}
            <div className="flex items-start gap-3 rounded-xl bg-[#F9FAFB] border border-[#F3F4F6] p-4">
              <span className="text-[20px]">🎙️</span>
              <div>
                <p className="text-[13px] font-black text-[#111] mb-0.5">Practice the technical interview</p>
                <p className="text-[12px] text-[#6B7280]">OA is just the first round. The technical interview is where most students lose out — practice it now.</p>
                <Link href="/mock?prefill_company=tcs">
                  <button className="mt-2 rounded-lg bg-[#111] px-3 py-1.5 text-[11px] font-black text-white hover:bg-[#333] transition">
                    Start TCS mock interview →
                  </button>
                </Link>
              </div>
            </div>
            <div className="flex items-start gap-3 rounded-xl bg-[#F9FAFB] border border-[#F3F4F6] p-4">
              <span className="text-[20px]">🔁</span>
              <div>
                <p className="text-[13px] font-black text-[#111] mb-0.5">Retake to improve your score</p>
                <p className="text-[12px] text-[#6B7280]">Different questions each time. Most students improve 10-15% on their second attempt.</p>
                <Link href={`/oa-practice/${results.company}`}>
                  <button className="mt-2 rounded-lg border border-[#E5E7EB] px-3 py-1.5 text-[11px] font-black text-[#374151] hover:bg-[#F9FAFB] transition">
                    Retake {results.company?.toUpperCase()} OA →
                  </button>
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* ── Share + TCS prep guide ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            onClick={shareOnWhatsApp}
            className="flex items-center justify-center gap-2 rounded-2xl border-2 border-[#25D366] bg-[#25D366] py-3.5 text-[14px] font-black text-white hover:bg-[#1da851] transition"
          >
            📱 Share on WhatsApp
          </button>
          <Link href={`/companies/${results.company}`}>
            <button className="w-full flex items-center justify-center gap-2 rounded-2xl border border-[#E5E7EB] bg-white py-3.5 text-[14px] font-black text-[#374151] hover:bg-[#F9FAFB] transition">
              📋 View {results.company?.toUpperCase()} prep guide
            </button>
          </Link>
        </div>

      </div>
    </main>
  );
}