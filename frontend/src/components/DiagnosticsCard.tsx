// frontend/src/components/DiagnosticsCard.tsx
// Reusable card showing latest assessment + OA results
// Import into dashboard and passport page

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const API_BASE = (
  process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:8000"
).replace(/\/$/, "");

const SECTION_LABELS: Record<string, string> = {
  aptitude:        "Aptitude",
  cs_fundamentals: "CS Fundamentals",
  programming_dsa: "Programming & DSA",
  communication:   "Communication",
};

const SECTION_COLORS: Record<string, string> = {
  aptitude:        "#6366F1",
  cs_fundamentals: "#10B981",
  programming_dsa: "#F59E0B",
  communication:   "#EF4444",
};

const BAND_COLORS: Record<string, string> = {
  prime:         "#7A6000",
  digital:       "#4338CA",
  ninja:         "#065F46",
  not_qualified: "#991B1B",
};

interface DiagnosticsCardProps {
  authHeader: Record<string, string> | (() => Record<string, string>);
  compact?: boolean; // compact mode for passport sidebar
}

export default function DiagnosticsCard({
  authHeader: authHeaderProp,
  compact = false,
}: DiagnosticsCardProps) {
  const [assessment, setAssessment] = useState<any>(null);
  const [oaAttempts, setOaAttempts] = useState<any[]>([]);
  const [loading, setLoading]       = useState(true);

  useEffect(() => {
    // Accept both a plain object and a function
    const headers = typeof authHeaderProp === "function" ? authHeaderProp() : authHeaderProp;

    Promise.allSettled([
      fetch(`${API_BASE}/api/assessment/latest`, { headers })
        .then((r) => r.ok ? r.json() : null),
      fetch(`${API_BASE}/api/oa/history`, { headers })
        .then((r) => r.ok ? r.json() : null),
    ]).then(([assessResult, oaResult]) => {
      if (assessResult.status === "fulfilled" && assessResult.value?.attempt) {
        setAssessment(assessResult.value.attempt);
      }
      if (oaResult.status === "fulfilled" && oaResult.value?.attempts) {
        setOaAttempts(oaResult.value.attempts.slice(0, 3));
      }
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <div className="rounded-2xl border border-[#E5E7EB] bg-white p-5 animate-pulse">
        <div className="h-4 w-32 bg-[#F3F4F6] rounded mb-4" />
        <div className="h-20 bg-[#F9FAFB] rounded-xl" />
      </div>
    );
  }

  const hasData = assessment || oaAttempts.length > 0;
  const sectionScores = assessment?.section_scores
    ? typeof assessment.section_scores === "string"
      ? JSON.parse(assessment.section_scores)
      : assessment.section_scores
    : null;

  return (
    <div className="rounded-2xl border border-[#E5E7EB] bg-white overflow-hidden">

      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-[#F3F4F6]">
        <p className="text-[12px] font-black uppercase tracking-widest text-[#9CA3AF]">
          Diagnostics
        </p>
        <Link href="/assessment" className="text-[12px] font-bold text-[#374151] hover:text-[#111] transition">
          {assessment ? "Retake →" : "Take assessment →"}
        </Link>
      </div>

      {!hasData ? (
        // Empty state
        <div className="px-5 py-6 text-center">
          <span className="text-[32px] block mb-2">📊</span>
          <p className="text-[14px] font-black text-[#111] mb-1">No diagnostics yet</p>
          <p className="text-[12px] text-[#9CA3AF] mb-4 leading-relaxed">
            Take the free Placement Readiness Assessment to see where you stand.
          </p>
          <Link href="/assessment">
            <button className="rounded-xl bg-[#111] px-5 py-2 text-[12px] font-black text-white hover:bg-[#333] transition">
              Start free assessment →
            </button>
          </Link>
        </div>
      ) : (
        <div className="p-5 space-y-4">

          {/* Assessment block */}
          {assessment && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-[11px] font-black uppercase tracking-widest text-[#9CA3AF]">
                  Placement Readiness
                </p>
                <Link
                  href={`/assessment/results/${assessment.id}`}
                  className="text-[11px] font-bold text-[#374151] hover:text-[#111] transition"
                >
                  Full report →
                </Link>
              </div>

              {/* Score + biggest gap */}
              <div className="flex items-start gap-4 mb-3">
                <div>
                  <div className="text-[40px] font-black text-[#111] leading-none">
                    {Math.round(assessment.total_score ?? 0)}%
                  </div>
                  {assessment.biggest_gap && (
                    <p className="text-[11px] text-[#9CA3AF] mt-0.5">
                      Gap:{" "}
                      <span className="font-bold text-[#EF4444] capitalize">
                        {assessment.biggest_gap.replace(/_/g, " ")}
                      </span>
                    </p>
                  )}
                </div>

                {/* Section bars */}
                {sectionScores && !compact && (
                  <div className="flex-1 space-y-1.5">
                    {Object.entries(sectionScores).map(([key, score]) => (
                      <div key={key} className="flex items-center gap-2">
                        <span className="text-[10px] text-[#9CA3AF] w-20 flex-shrink-0 truncate">
                          {SECTION_LABELS[key] ?? key}
                        </span>
                        <div className="flex-1 h-1.5 rounded-full bg-[#E5E7EB] overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${score}%`,
                              background: SECTION_COLORS[key] ?? "#111",
                            }}
                          />
                        </div>
                        <span className="text-[10px] font-bold text-[#374151] w-6 text-right flex-shrink-0">
                          {score as number}%
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* OA block */}
          {oaAttempts.length > 0 && (
            <div className="border-t border-[#F3F4F6] pt-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[11px] font-black uppercase tracking-widest text-[#9CA3AF]">
                  OA Practice
                </p>
                <Link
                  href="/oa-practice"
                  className="text-[11px] font-bold text-[#374151] hover:text-[#111] transition"
                >
                  All attempts →
                </Link>
              </div>

              <div className="space-y-2">
                {oaAttempts.map((attempt) => (
                  <Link
                    key={attempt.id}
                    href={`/oa-practice/results/${attempt.id}`}
                  >
                    <div className="flex items-center justify-between rounded-xl bg-[#F9FAFB] border border-[#F3F4F6] px-3 py-2.5 hover:border-[#111] hover:bg-white transition cursor-pointer">
                      <div className="flex items-center gap-2.5">
                        <div
                          className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg text-white text-[10px] font-black"
                          style={{ background: "#111" }}
                        >
                          {attempt.company?.toUpperCase()?.slice(0, 2)}
                        </div>
                        <div>
                          <p className="text-[12px] font-bold text-[#111]">
                            {attempt.company?.toUpperCase()} OA
                          </p>
                          <p className="text-[10px] text-[#9CA3AF]">
                            {new Date(attempt.started_at).toLocaleDateString("en-IN", {
                              day: "numeric",
                              month: "short",
                            })}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-[14px] font-black text-[#111]">
                          {Math.round(attempt.total_score ?? 0)}%
                        </p>
                        {attempt.band_prediction && attempt.band_prediction !== "not_qualified" && (
                          <p
                            className="text-[10px] font-bold capitalize"
                            style={{ color: BAND_COLORS[attempt.band_prediction] ?? "#374151" }}
                          >
                            {attempt.band_prediction}
                          </p>
                        )}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>

              <Link href="/oa-practice/tcs">
                <button className="mt-3 w-full rounded-xl border border-[#E5E7EB] bg-white py-2 text-[12px] font-black text-[#374151] hover:bg-[#F9FAFB] hover:border-[#111] transition">
                  Practice TCS NQT →
                </button>
              </Link>
            </div>
          )}

          {/* No OA yet prompt */}
          {oaAttempts.length === 0 && (
            <div className="border-t border-[#F3F4F6] pt-4">
              <p className="text-[11px] font-black uppercase tracking-widest text-[#9CA3AF] mb-2">
                OA Practice
              </p>
              <Link href="/oa-practice">
                <div className="flex items-center gap-3 rounded-xl border border-dashed border-[#E5E7EB] px-3 py-3 hover:border-[#111] transition cursor-pointer">
                  <span className="text-[20px]">📝</span>
                  <div>
                    <p className="text-[12px] font-bold text-[#111]">Try OA practice</p>
                    <p className="text-[11px] text-[#9CA3AF]">Simulate TCS NQT with locked timers</p>
                  </div>
                </div>
              </Link>
            </div>
          )}

        </div>
      )}
    </div>
  );
}