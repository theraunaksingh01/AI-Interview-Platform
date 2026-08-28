// frontend/src/app/assessment/results/[id]/page.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { AIDisclaimer } from "@/app/components/AIDisclaimer";

const API_BASE = (
  process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:8000"
).replace(/\/$/, "");

// ─── Types ────────────────────────────────────────────────────────────────────

type SectionScore = { score: number; label: string };

type CompanyMatch = {
  company: string;
  status: "on_track" | "borderline" | "needs_work";
  note: string;
};

type Recommendation = {
  title: string;
  desc: string;
  cta: string;
  href: string;
};

type Results = {
  attempt_id: number;
  total_score: number;
  label: string;
  section_scores: Record<string, SectionScore>;
  biggest_gap: string;
  voice_evaluation: any;
  target_companies: string[];
  placement_months_away: number | null;
  company_match: CompanyMatch[];
  recommendations: Recommendation[];
  created_at: string;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

const SECTION_LABELS: Record<string, string> = {
  aptitude: "Aptitude",
  cs_fundamentals: "CS Fundamentals",
  programming_dsa: "Programming & DSA",
  communication: "Communication",
};

const SECTION_ICONS: Record<string, string> = {
  aptitude: "🧮",
  cs_fundamentals: "💻",
  programming_dsa: "⚡",
  communication: "🎙️",
};

const STATUS_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  on_track: { bg: "#F0FDF4", color: "#065F46", label: "On track" },
  borderline: { bg: "#FFFBEB", color: "#92400E", label: "Borderline" },
  needs_work: { bg: "#FEF2F2", color: "#991B1B", label: "Needs work" },
};

function ScoreBar({ score, color = "#111" }: { score: number; color?: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-2 rounded-full bg-[#E5E7EB] overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${score}%`, background: color }}
        />
      </div>
      <span className="text-[13px] font-bold text-[#111] w-8 text-right">
        {score}%
      </span>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AssessmentResultsPage() {
  const { id } = useParams() as { id: string };
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [results, setResults] = useState<Results | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [claimed, setClaimed] = useState(false);

  // ── Claim guest attempt after login ──────────────────────────────────────

  useEffect(() => {
    if (!user || claimed) return;
    const storedToken = localStorage.getItem("qued_assessment_guest_token")
      || sessionStorage.getItem("qued_assessment_guest_token");
    const storedAttempt = localStorage.getItem("qued_assessment_attempt_id")
      || sessionStorage.getItem("qued_assessment_attempt_id");
    if (!storedToken || !storedAttempt) return;

    const token = localStorage.getItem("API_TOKEN") || localStorage.getItem("access_token") || localStorage.getItem("auth_token") || "";
    fetch(`${API_BASE}/api/assessment/claim`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        guest_token: storedToken,
        attempt_id: parseInt(storedAttempt),
      }),
    })
      .then(() => {
        localStorage.removeItem("qued_assessment_guest_token");
        localStorage.removeItem("qued_assessment_attempt_id");
        sessionStorage.removeItem("qued_assessment_guest_token");
        sessionStorage.removeItem("qued_assessment_attempt_id");
        setClaimed(true);
      })
      .catch(() => setClaimed(true));
  }, [user, claimed]);

  // ── Fetch results ─────────────────────────────────────────────────────────

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace(`/login?next=/assessment/results/${id}`);
      return;
    }
    if (!claimed && localStorage.getItem("qued_assessment_guest_token")) return;

    const token = localStorage.getItem("API_TOKEN") || localStorage.getItem("access_token") || localStorage.getItem("auth_token") || "";
    const gt = localStorage.getItem("qued_assessment_guest_token")
      || sessionStorage.getItem("qued_assessment_guest_token") || "";
    const gtParam = gt ? `?guest_token=${encodeURIComponent(gt)}` : "";
    fetch(`${API_BASE}/api/assessment/results/${id}${gtParam}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => {
        if (!r.ok) throw new Error("Results not found");
        return r.json();
      })
      .then(setResults)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [user, authLoading, id, claimed]);

  // ── WhatsApp share ────────────────────────────────────────────────────────

  const shareOnWhatsApp = () => {
    if (!results) return;
    const gap = results.biggest_gap?.replace("_", " ") ?? "unknown";
    const msg = encodeURIComponent(
      `I just took Cractal's Placement Readiness Assessment.\n\n` +
      `My score: ${results.total_score}% — ${results.label} 📊\n` +
      `Biggest gap: ${gap}\n\n` +
      `Take the free test and see where you stand:\n` +
      `https://cractal.in/assessment\n\n` +
      `#PlacementPrep #CampusPlacements`
    );
    window.open(`https://wa.me/?text=${msg}`, "_blank");
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  if (authLoading || loading) {
    return (
      <main className="min-h-screen px-4 pb-16 pt-24" style={{ background: "#FAFAF8" }}>
        <div className="mx-auto max-w-[680px] space-y-4">

          <div className="rounded-3xl overflow-hidden" style={{ background: "#111" }}>
            <div className="px-8 py-8 text-center">
              <div className="h-3 w-40 mx-auto mb-4 rounded bg-white/10 animate-pulse" />
              <div className="h-16 w-24 mx-auto mb-3 rounded-xl bg-white/10 animate-pulse" />
              <div className="h-3 w-56 mx-auto rounded bg-white/10 animate-pulse" />
            </div>
            <div className="grid grid-cols-4 divide-x divide-[#222] border-t border-[#222]">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="py-3 text-center">
                  <div className="h-2 w-8 mx-auto mb-2 rounded bg-white/10 animate-pulse" />
                  <div className="h-5 w-6 mx-auto rounded bg-white/10 animate-pulse" />
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-[#E5E7EB] bg-white p-6 space-y-4">
            <div className="h-3 w-32 rounded bg-gray-100 animate-pulse mb-2" />
            {[1, 2, 3, 4].map((i) => (
              <div key={i}>
                <div className="flex justify-between mb-2">
                  <div className="h-3 w-24 rounded bg-gray-100 animate-pulse" />
                  <div className="h-3 w-8 rounded bg-gray-100 animate-pulse" />
                </div>
                <div className="h-2 w-full rounded-full bg-gray-100 animate-pulse" />
              </div>
            ))}
          </div>

          <div className="rounded-2xl border border-[#E5E7EB] bg-white p-6 space-y-3">
            <div className="h-3 w-28 rounded bg-gray-100 animate-pulse mb-2" />
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 w-full rounded-xl bg-gray-50 animate-pulse" />
            ))}
          </div>

        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen flex items-center justify-center px-4" style={{ background: "#FAFAF8" }}>
        <div className="text-center max-w-sm">
          <p className="text-[16px] font-bold text-[#111] mb-2">Results not found</p>
          <p className="text-[13px] text-[#6B7280] mb-4">{error}</p>
          <Link href="/assessment">
            <button className="rounded-xl bg-[#111] px-6 py-2.5 text-[13px] font-black text-white hover:bg-[#333] transition">
              Take the assessment
            </button>
          </Link>
        </div>
      </main>
    );
  }

  if (!results) return null;

  const sectionOrder = ["aptitude", "cs_fundamentals", "programming_dsa", "communication"];
  const biggestGapLabel = results.biggest_gap?.replace(/_/g, " ");

  return (
    <main className="min-h-screen pt-24 pb-16 px-4" style={{ background: "#FAFAF8" }}>
      <div className="mx-auto max-w-[720px] space-y-5">

        {/* ── Overall score ── */}
        <div
          className="rounded-3xl overflow-hidden"
          style={{ background: "#111", boxShadow: "0 4px 40px rgba(0,0,0,0.15)" }}
        >
          <div className="px-8 py-8 text-center">
            <p className="text-[11px] font-black uppercase tracking-widest text-[#555] mb-3">
              Your Placement Diagnostic
            </p>
            <div className="text-[72px] font-black text-white leading-none mb-2">
              {results.total_score}%
            </div>
            <div className="inline-block rounded-full bg-yellow-400 px-4 py-1 text-[13px] font-black text-[#111] mb-4">
              {results.label}
            </div>
            {results.biggest_gap && (
              <p className="text-[14px] text-[#555]">
                Biggest gap:{" "}
                <span className="text-white font-bold capitalize">{biggestGapLabel}</span>
              </p>
            )}
          </div>

          {/* Section scores strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-[#222] border-t border-[#222]">
            {sectionOrder.map((key) => {
              const s = results.section_scores[key];
              return (
                <div key={key} className="px-4 py-4 text-center">
                  <p className="text-[18px] mb-1">{SECTION_ICONS[key]}</p>
                  <p className="text-[10px] font-black uppercase tracking-widest text-[#555] mb-1">
                    {SECTION_LABELS[key]}
                  </p>
                  {s ? (
                    <>
                      <p className="text-[20px] font-black text-white leading-none">{s.score}%</p>
                      <p className="text-[11px] text-[#555] mt-0.5">{s.label}</p>
                    </>
                  ) : (
                    <>
                      <p className="text-[20px] font-black text-[#555] leading-none">—</p>
                      <p className="text-[11px] text-[#555] mt-0.5">Not attempted</p>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <AIDisclaimer variant="compact" />

        {/* ── Detailed score breakdown ── */}
        <div className="rounded-2xl border border-[#E5E7EB] bg-white p-6">
          <h2 className="text-[16px] font-black text-[#111] mb-5">Score breakdown</h2>
          <div className="space-y-4">
            {sectionOrder.map((key) => {
              const s = results.section_scores[key];
              const isGap = key === results.biggest_gap;
              if (!s) {
                return (
                  <div key={key}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[13px] font-bold text-[#9CA3AF]">{SECTION_LABELS[key]}</span>
                      <span className="text-[12px] text-[#9CA3AF]">Not attempted</span>
                    </div>
                    <div className="h-2 rounded-full bg-[#F3F4F6]" />
                  </div>
                );
              }
              return (
                <div key={key}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[13px] font-medium text-[#374151]">
                      {SECTION_ICONS[key]} {SECTION_LABELS[key]}
                      {isGap && (
                        <span className="ml-2 rounded-full bg-red-50 border border-red-200 px-2 py-0.5 text-[10px] font-bold text-red-600">
                          Biggest gap
                        </span>
                      )}
                    </span>
                    <span className="text-[12px] text-[#9CA3AF]">{s.label}</span>
                  </div>
                  <ScoreBar
                    score={s.score}
                    color={isGap ? "#EF4444" : s.score >= 70 ? "#10B981" : s.score >= 45 ? "#F59E0B" : "#6B7280"}
                  />
                </div>
              );
            })}
          </div>

          {/* Voice evaluation */}
          {results.voice_evaluation && (
            <div className="mt-5 pt-5 border-t border-[#F3F4F6]">
              <p className="text-[12px] font-black uppercase tracking-widest text-[#9CA3AF] mb-3">
                Communication breakdown
              </p>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: "Structure", value: results.voice_evaluation.structure },
                  { label: "Clarity", value: results.voice_evaluation.clarity },
                ].map(({ label, value }) => (
                  <div key={label} className="rounded-xl bg-[#F9FAFB] border border-[#F3F4F6] px-4 py-3">
                    <p className="text-[11px] text-[#9CA3AF] mb-1">{label}</p>
                    <p className="text-[20px] font-black text-[#111]">{value}<span className="text-[13px] font-medium text-[#9CA3AF]">/10</span></p>
                  </div>
                ))}
              </div>
              {results.voice_evaluation.feedback && (
                <div className="mt-3 rounded-xl bg-yellow-50 border border-yellow-200 px-4 py-3">
                  <p className="text-[11px] font-black uppercase tracking-widest text-[#92400E] mb-1">
                    💡 Feedback
                  </p>
                  <p className="text-[13px] text-[#92400E] leading-relaxed">
                    {results.voice_evaluation.feedback}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── What to do next ── */}
        {results.recommendations?.length > 0 && (
          <div className="rounded-2xl border border-[#E5E7EB] bg-white p-6">
            <h2 className="text-[16px] font-black text-[#111] mb-4">What to do next</h2>
            <div className="space-y-3">
              {results.recommendations.map((rec, i) => (
                <div key={i}
                  className="flex items-start gap-4 rounded-xl bg-[#F9FAFB] border border-[#F3F4F6] p-4">
                  <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-[#111] text-[11px] font-black text-white mt-0.5">
                    {i + 1}
                  </div>
                  <div className="flex-1">
                    <p className="text-[14px] font-black text-[#111] mb-0.5">{rec.title}</p>
                    <p className="text-[12px] text-[#6B7280] leading-relaxed mb-2">{rec.desc}</p>
                    <Link href={rec.href}>
                      <button className="rounded-lg bg-[#111] px-3 py-1.5 text-[11px] font-black text-white hover:bg-[#333] transition">
                        {rec.cta} →
                      </button>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Company match ── */}
        {results.company_match?.length > 0 && (
          <div className="rounded-2xl border border-[#E5E7EB] bg-white p-6">
            <h2 className="text-[16px] font-black text-[#111] mb-4">
              Company match
            </h2>
            <div className="space-y-3">
              {results.company_match.map((match) => {
                const style = STATUS_STYLE[match.status];
                return (
                  <div key={match.company}
                    className="flex items-start gap-3 rounded-xl border border-[#F3F4F6] p-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-[14px] font-black text-[#111]">{match.company}</p>
                        <span
                          className="rounded-full px-2 py-0.5 text-[10px] font-bold"
                          style={{ background: style.bg, color: style.color }}
                        >
                          {style.label}
                        </span>
                      </div>
                      <p className="text-[12px] text-[#6B7280] leading-relaxed">{match.note}</p>
                    </div>
                    <Link href={`/companies/${match.company.toLowerCase().replace(" ", "-")}`}>
                      <button className="flex-shrink-0 rounded-lg border border-[#E5E7EB] px-3 py-1.5 text-[11px] font-bold text-[#374151] hover:bg-[#F9FAFB] transition">
                        Prep guide →
                      </button>
                    </Link>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Share + Retake ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            onClick={shareOnWhatsApp}
            className="flex items-center justify-center gap-2 rounded-2xl border-2 border-[#25D366] bg-[#25D366] py-3.5 text-[14px] font-black text-white hover:bg-[#1da851] transition"
          >
            <span>📱</span> Share on WhatsApp
          </button>
          <Link href="/assessment">
            <button className="w-full flex items-center justify-center gap-2 rounded-2xl border border-[#E5E7EB] bg-white py-3.5 text-[14px] font-black text-[#374151] hover:bg-[#F9FAFB] transition">
              🔁 Retake assessment
            </button>
          </Link>
        </div>

        {/* ── Start mock interview CTA ── */}
        <div className="rounded-2xl bg-[#111] p-6 text-center">
          <p className="text-[16px] font-black text-white mb-2">
            Now practice for real.
          </p>
          <p className="text-[13px] text-[#555] mb-4">
            The assessment shows you where you stand. Mock interviews build the skills.
          </p>
          <Link href="/mock">
            <button className="rounded-xl bg-yellow-400 px-8 py-3 text-[14px] font-black text-[#111] hover:bg-yellow-300 transition">
              Start mock interview →
            </button>
          </Link>
        </div>

      </div>
    </main>
  );
}