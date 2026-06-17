"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/context/AuthContext";

const API_BASE = (
  process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:8000"
).replace(/\/$/, "");

// ─── Types ────────────────────────────────────────────────────────────────────

type TopicScore = { topic: string; avg_score: number; session_count: number };
type Reminder = { topic: string; reminder: string };
type CompanyProfile = {
  company: string;
  interview_pattern: { rounds: string[] };
  most_asked_topics: { topic: string; weight: string }[];
  interview_style: string;
  difficulty_range: string;
  typical_duration: string;
  what_they_value: string[];
  common_questions: string[];
  tips: string[];
};
type Intro = { text: string; score: number };
type Stats = {
  session_count: number;
  company_session_count: number;
  score_trend: { start: number; latest: number } | null;
  concepts_revised: number;
};

type CheatSheetData = {
  company: string;
  user_name: string;
  generated_at: string;
  from_cache: boolean;
  strengths: { available: boolean; data: TopicScore[] | null; unlock_hint: string | null };
  reminders: { available: boolean; data: Reminder[]; unlock_hint: string | null };
  company_intel: { available: boolean; data: CompanyProfile | null };
  patterns: { available: boolean; data: string[] | null; unlock_hint: string | null };
  intro: { available: boolean; data: Intro | null; unlock_hint: string | null };
  stats: { available: boolean; data: Stats };
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const WEIGHT_COLOR: Record<string, string> = {
  high: "#EF4444",
  medium: "#F59E0B",
  low: "#9CA3AF",
};

function scoreColor(score: number) {
  if (score >= 7) return "#10B981";
  if (score >= 5) return "#F59E0B";
  return "#EF4444";
}

// ─── Section card wrapper ───────────────────────────────────────────────────

function SectionCard({
  icon,
  title,
  subtitle,
  accentColor,
  children,
}: {
  icon: string;
  title: string;
  subtitle?: string;
  accentColor?: string;
  children: React.ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-3xl border border-[#E5E7EB] bg-white overflow-hidden"
      style={{ boxShadow: "0 2px 16px rgba(0,0,0,0.04)" }}
    >
      <div className="flex items-center gap-3 px-6 py-4 border-b border-[#F3F4F6]">
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl text-[18px]"
          style={{ background: (accentColor || "#111") + "12" }}>
          {icon}
        </div>
        <div>
          <p className="text-[15px] font-black text-[#111]">{title}</p>
          {subtitle && <p className="text-[11px] text-[#9CA3AF] mt-0.5">{subtitle}</p>}
        </div>
      </div>
      <div className="px-6 py-5">{children}</div>
    </motion.div>
  );
}

function LockedState({ hint, ctaText, ctaHref }: { hint: string; ctaText: string; ctaHref: string }) {
  return (
    <div className="rounded-2xl border-2 border-dashed border-[#E5E7EB] bg-[#FAFAFA] p-5 text-center">
      <p className="text-[13px] text-[#9CA3AF] mb-3 leading-relaxed">{hint}</p>
      <Link href={ctaHref}>
        <button className="rounded-xl bg-[#111] px-4 py-2 text-[12px] font-bold text-white hover:bg-[#333] transition">
          {ctaText} →
        </button>
      </Link>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function CheatSheetPage() {
  const { user, authHeader } = useAuth();
  const [companies, setCompanies] = useState<string[]>([]);
  const [selectedCompany, setSelectedCompany] = useState<string | null>(null);
  const [data, setData] = useState<CheatSheetData | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAllManners, setShowAllManners] = useState(false);
  const [view, setView] = useState<"select" | "sheet" | "upgrade">("select");

  useEffect(() => {
    fetch(`${API_BASE}/api/cheat-sheet/companies`)
      .then(r => r.json())
      .then(d => setCompanies(d.companies || []))
      .catch(() => {});
  }, []);

  async function loadCompany(company: string, refresh = false) {
    setSelectedCompany(company);
    if (refresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const url = refresh
        ? `${API_BASE}/api/cheat-sheet/${company}/refresh`
        : `${API_BASE}/api/cheat-sheet/${company}`;
      const res = await fetch(url, {
        method: refresh ? "POST" : "GET",
        headers: authHeader(),
      });

      if (res.status === 403) { setView("upgrade"); return; }

      const json = await res.json();
      if (!res.ok) throw new Error(json?.detail || "Failed to load cheat sheet");

      setData(json);
      setView("sheet");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  function shareWhatsApp() {
    if (!data) return;
    const text = `My ${data.company} Cheat Sheet on Qued — covering strengths, weak spots, company tips, and my prep stats. Check it out!`;
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, "_blank");
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#FAFAF8] flex items-center justify-center px-6">
        <div className="text-center max-w-[400px]">
          <div className="text-[52px] mb-5">📋</div>
          <h1 className="text-[24px] font-black text-[#111] mb-2" style={{ letterSpacing: "-0.5px" }}>Cheat Sheet</h1>
          <p className="text-[14px] text-[#6B7280] mb-6">Sign in to get your personalized company prep page.</p>
          <div className="flex gap-3 justify-center">
            <Link href="/login" className="rounded-xl bg-[#111] px-6 py-3 text-[13px] font-black text-white hover:bg-[#333] transition">Sign in</Link>
            <Link href="/signup" className="rounded-xl border border-[#E5E7EB] bg-white px-6 py-3 text-[13px] font-medium text-[#374151] hover:bg-[#F9FAFB] transition">Create account</Link>
          </div>
        </div>
      </div>
    );
  }

  if (view === "upgrade") {
    return (
      <div className="min-h-screen bg-[#FAFAF8] flex items-center justify-center px-6">
        <div className="text-center max-w-[420px]">
          <div className="text-[52px] mb-5">📋</div>
          <h1 className="text-[24px] font-black text-[#111] mb-2" style={{ letterSpacing: "-0.5px" }}>
            Cheat Sheet is a Max feature
          </h1>
          <p className="text-[14px] text-[#6B7280] mb-8 leading-relaxed">
            Your strengths, weak spots, company intel, patterns, and intro — all synthesized into one page that gets richer as you practice. Available on Max.
          </p>
          <Link href="/pricing">
            <button className="w-full rounded-2xl bg-[#111] py-4 text-[15px] font-black text-white hover:bg-[#333] transition">
              View Max plan →
            </button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAFAF8]">
      <main className="pt-[88px] pb-20 px-4 sm:px-6">
        <div className="mx-auto max-w-[760px]">

          {/* Header */}
          <div className="mb-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#E5E7EB] bg-white px-3 py-1.5 mb-4">
              <span className="h-1.5 w-1.5 rounded-full bg-yellow-400 animate-pulse" />
              <span className="text-[11px] font-black uppercase tracking-widest text-[#374151]">Cheat Sheet · Max</span>
            </div>
            <h1 style={{ fontSize: "clamp(24px, 4vw, 34px)", fontWeight: 900, letterSpacing: "-1px", color: "#111" }}>
              {view === "sheet" && data ? `${data.company} Cheat Sheet` : "Your Company Cheat Sheet"}
            </h1>
            <p className="text-[14px] text-[#6B7280] mt-1">
              {view === "sheet" && data
                ? "Everything you need on one page — strengths, gaps, company intel, and your prep stats"
                : "Pick a company to see your personalized prep page"}
            </p>
          </div>

          {/* Company tabs */}
          <div className="mb-6 flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
            {companies.map(c => (
              <button key={c} onClick={() => loadCompany(c)}
                className={`flex-shrink-0 rounded-xl px-4 py-2 text-[13px] font-bold border transition-all whitespace-nowrap ${
                  selectedCompany === c
                    ? "border-[#111] bg-[#111] text-white"
                    : "border-[#E5E7EB] bg-white text-[#374151] hover:border-[#111]"
                }`}>
                {c}
              </button>
            ))}
          </div>

          {/* Loading */}
          {loading && (
            <div className="flex items-center justify-center py-20">
              <div className="text-center">
                <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-3 border-gray-200 border-t-[#111]" />
                <p className="text-[13px] text-[#9CA3AF]">Building your cheat sheet...</p>
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 mb-4">
              <p className="text-[13px] text-rose-700">{error}</p>
            </div>
          )}

          {/* Empty / select prompt */}
          {!loading && view === "select" && (
            <div className="rounded-3xl border-2 border-dashed border-[#E5E7EB] bg-white p-10 text-center">
              <p className="text-[40px] mb-3">👆</p>
              <p className="text-[15px] font-bold text-[#111] mb-1">Pick a company above</p>
              <p className="text-[13px] text-[#9CA3AF]">Your cheat sheet will appear here</p>
            </div>
          )}

          {/* Cheat sheet content */}
          {!loading && view === "sheet" && data && (
            <AnimatePresence mode="wait">
              <motion.div key={data.company} className="space-y-4">

                {/* Refresh bar */}
                <div className="flex items-center justify-between text-[11px] text-[#9CA3AF] px-1">
                  <span>Updated {data.from_cache ? "earlier today" : "just now"}</span>
                  <button onClick={() => loadCompany(data.company, true)} disabled={refreshing}
                    className="flex items-center gap-1 font-bold text-[#374151] hover:text-[#111] transition">
                    {refreshing ? (
                      <span className="h-3 w-3 animate-spin rounded-full border-2 border-gray-300 border-t-[#111]" />
                    ) : "↻"} Refresh
                  </button>
                </div>

                {/* Your Strengths */}
                <SectionCard icon="💪" title="Your Strengths" accentColor="#10B981">
                  {data.strengths.available && data.strengths.data ? (
                    <>
                      <div className="space-y-3">
                        {data.strengths.data.map(s => (
                          <div key={s.topic}>
                            <div className="flex items-center justify-between mb-1.5">
                              <p className="text-[13px] font-bold text-[#111]">{s.topic}</p>
                              <p className="text-[13px] font-black" style={{ color: scoreColor(s.avg_score) }}>
                                {s.avg_score}/10
                              </p>
                            </div>
                            <div className="h-2 w-full rounded-full bg-[#F3F4F6] overflow-hidden">
                              <motion.div initial={{ width: 0 }} animate={{ width: `${s.avg_score * 10}%` }}
                                transition={{ duration: 0.8 }} className="h-full rounded-full"
                                style={{ background: scoreColor(s.avg_score) }} />
                            </div>
                          </div>
                        ))}
                      </div>
                      <p className="text-[12px] text-[#9CA3AF] mt-4">If they give you a choice, steer toward these.</p>
                    </>
                  ) : (
                    <LockedState hint={data.strengths.unlock_hint || ""} ctaText="Start Mock Interview" ctaHref="/mock" />
                  )}
                </SectionCard>

                {/* Quick Reminders */}
                <SectionCard icon="⚡" title="Brush Up On" accentColor="#F59E0B">
                  {data.reminders.available && data.reminders.data.length > 0 ? (
                    <div className="space-y-3">
                      {data.reminders.data.map((r, i) => (
                        <div key={i} className="flex items-start gap-2.5">
                          <span className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-amber-100 text-[10px] font-black text-amber-700">
                            {i + 1}
                          </span>
                          <p className="text-[13px] text-[#374151] leading-relaxed">
                            <span className="font-bold">{r.topic}</span> — {r.reminder}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <LockedState hint={data.reminders.unlock_hint || ""} ctaText="Practice Topics" ctaHref="/topic-practice" />
                  )}
                </SectionCard>

                {/* Company Intel */}
                <SectionCard icon="🏢" title={`${data.company} Interview Pattern`} accentColor="#3B82F6">
                  {data.company_intel.available && data.company_intel.data ? (
                    <div className="space-y-4">
                      <div>
                        <p className="text-[11px] font-black uppercase tracking-widest text-[#9CA3AF] mb-2">Rounds</p>
                        <div className="flex flex-wrap gap-2">
                          {data.company_intel.data.interview_pattern.rounds.map((r, i) => (
                            <div key={i} className="flex items-center gap-1.5">
                              <span className="rounded-lg bg-[#EFF6FF] px-2.5 py-1 text-[12px] font-bold text-[#1E40AF]">{r}</span>
                              {i < data.company_intel.data!.interview_pattern.rounds.length - 1 && (
                                <span className="text-[#D1D5DB]">→</span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>

                      <div>
                        <p className="text-[11px] font-black uppercase tracking-widest text-[#9CA3AF] mb-2">Most asked topics</p>
                        <div className="flex flex-wrap gap-2">
                          {data.company_intel.data.most_asked_topics.map((t, i) => (
                            <span key={i} className="rounded-full px-3 py-1 text-[11px] font-bold border"
                              style={{ borderColor: WEIGHT_COLOR[t.weight] + "40", color: WEIGHT_COLOR[t.weight], background: WEIGHT_COLOR[t.weight] + "10" }}>
                              {t.topic}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="rounded-xl bg-[#F9FAFB] border border-[#F3F4F6] p-3.5">
                        <p className="text-[12px] text-[#374151] leading-relaxed">{data.company_intel.data.interview_style}</p>
                      </div>

                      <div className="grid grid-cols-2 gap-3 text-[12px]">
                        <div>
                          <p className="text-[#9CA3AF] mb-0.5">Difficulty</p>
                          <p className="font-bold text-[#111]">{data.company_intel.data.difficulty_range}</p>
                        </div>
                        <div>
                          <p className="text-[#9CA3AF] mb-0.5">Duration</p>
                          <p className="font-bold text-[#111]">{data.company_intel.data.typical_duration}</p>
                        </div>
                      </div>

                      <div>
                        <p className="text-[11px] font-black uppercase tracking-widest text-[#9CA3AF] mb-2">What they value</p>
                        <div className="space-y-1.5">
                          {data.company_intel.data.what_they_value.map((v, i) => (
                            <div key={i} className="flex items-start gap-2">
                              <span className="text-emerald-500 mt-0.5 text-[12px]">✓</span>
                              <p className="text-[12px] text-[#374151]">{v}</p>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div>
                        <p className="text-[11px] font-black uppercase tracking-widest text-[#9CA3AF] mb-2">Tips</p>
                        <div className="space-y-1.5">
                          {data.company_intel.data.tips.map((t, i) => (
                            <div key={i} className="flex items-start gap-2">
                              <span className="text-blue-500 mt-0.5 text-[12px]">💡</span>
                              <p className="text-[12px] text-[#374151]">{t}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <p className="text-[13px] text-[#9CA3AF]">No company intel available for {data.company} yet.</p>
                  )}
                </SectionCard>

                {/* Your Patterns */}
                <SectionCard icon="🔍" title="Watch For" accentColor="#8B5CF6">
                  {data.patterns.available && data.patterns.data ? (
                    <div className="space-y-2.5">
                      {data.patterns.data.map((p, i) => (
                        <div key={i} className="flex items-start gap-2.5">
                          <span className="mt-0.5 text-[14px]">🎯</span>
                          <p className="text-[13px] text-[#374151] leading-relaxed">{p}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <LockedState hint={data.patterns.unlock_hint || ""} ctaText="Continue Practicing" ctaHref="/mock" />
                  )}
                </SectionCard>

                {/* Interview Manners — static */}
                <SectionCard icon="🎓" title="Interview Manners" accentColor="#6B7280">
                  <div className="space-y-4">
                    <div>
                      <p className="text-[11px] font-black uppercase tracking-widest text-[#9CA3AF] mb-2">Before you walk in</p>
                      <ul className="space-y-1 text-[13px] text-[#374151]">
                        <li>• Phone on silent, not vibrate</li>
                        <li>• Carry two printed copies of your resume</li>
                      </ul>
                    </div>
                    <div>
                      <p className="text-[11px] font-black uppercase tracking-widest text-[#9CA3AF] mb-2">While answering</p>
                      <ul className="space-y-1 text-[13px] text-[#374151]">
                        <li>• Pause 2-3 seconds before answering — looks thoughtful, not slow</li>
                        <li>• Don&apos;t know? → &quot;I&apos;m not fully sure, but based on what I know about...&quot;</li>
                      </ul>
                    </div>

                    <button onClick={() => setShowAllManners(s => !s)}
                      className="text-[12px] font-bold text-[#111] hover:underline">
                      {showAllManners ? "Show less ▲" : "See all manners ▼"}
                    </button>

                    <AnimatePresence>
                      {showAllManners && (
                        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }} className="overflow-hidden space-y-4">
                          <div>
                            <p className="text-[11px] font-black uppercase tracking-widest text-[#9CA3AF] mb-2">When you enter</p>
                            <ul className="space-y-1 text-[13px] text-[#374151]">
                              <li>• Greet: &quot;Good afternoon, may I sit?&quot;</li>
                              <li>• Sit straight, hands visible, don&apos;t fidget</li>
                              <li>• Eye contact with the interviewer, not the floor</li>
                            </ul>
                          </div>
                          <div>
                            <p className="text-[11px] font-black uppercase tracking-widest text-[#9CA3AF] mb-2">Common mistakes</p>
                            <ul className="space-y-1 text-[13px] text-[#374151]">
                              <li>• Don&apos;t say &quot;I have no weaknesses&quot; — name a real one</li>
                              <li>• Don&apos;t badmouth college or professors</li>
                              <li>• Don&apos;t ask about salary in technical rounds</li>
                            </ul>
                          </div>
                          <div>
                            <p className="text-[11px] font-black uppercase tracking-widest text-[#9CA3AF] mb-2">At the end</p>
                            <ul className="space-y-1 text-[13px] text-[#374151]">
                              <li>• &quot;Any questions?&quot; → ask one genuine question about the role or team</li>
                              <li>• &quot;Thank you for your time&quot; — simple and enough</li>
                              <li>• Don&apos;t ask &quot;How did I do?&quot;</li>
                            </ul>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </SectionCard>

                {/* Your Intro */}
                <SectionCard icon="🎤" title="Your Intro" accentColor="#EC4899">
                  {data.intro.available && data.intro.data ? (
                    <div>
                      <div className="rounded-xl bg-[#F9FAFB] border border-[#F3F4F6] p-4 mb-3">
                        <p className="text-[13px] text-[#374151] leading-relaxed italic">&quot;{data.intro.data.text}&quot;</p>
                      </div>
                      <p className="text-[11px] text-[#9CA3AF]">Remember: 90 seconds max. Strength → project → why this company.</p>
                    </div>
                  ) : (
                    <LockedState hint={data.intro.unlock_hint || ""} ctaText="Practice Intro" ctaHref="/topic-practice" />
                  )}
                </SectionCard>

                {/* Prep Stats */}
                <SectionCard icon="📊" title="Your Prep" accentColor="#111">
                  {data.stats.available ? (
                    <div>
                      <div className="grid grid-cols-3 gap-3 mb-3">
                        <div className="text-center">
                          <p className="text-[22px] font-black text-[#111]">{data.stats.data.session_count}</p>
                          <p className="text-[10px] text-[#9CA3AF] uppercase tracking-wide">Sessions</p>
                        </div>
                        <div className="text-center">
                          <p className="text-[22px] font-black text-[#111]">{data.stats.data.concepts_revised}</p>
                          <p className="text-[10px] text-[#9CA3AF] uppercase tracking-wide">Concepts revised</p>
                        </div>
                        <div className="text-center">
                          {data.stats.data.score_trend ? (
                            <>
                              <p className="text-[22px] font-black text-emerald-600">
                                {data.stats.data.score_trend.start} → {data.stats.data.score_trend.latest}
                              </p>
                              <p className="text-[10px] text-[#9CA3AF] uppercase tracking-wide">Score trend</p>
                            </>
                          ) : (
                            <>
                              <p className="text-[22px] font-black text-[#D1D5DB]">—</p>
                              <p className="text-[10px] text-[#9CA3AF] uppercase tracking-wide">Score trend</p>
                            </>
                          )}
                        </div>
                      </div>
                      <p className="text-[13px] font-bold text-[#111] text-center mt-2">
                        {data.stats.data.session_count >= 8 ? "You're more prepared than you think." :
                         data.stats.data.session_count >= 3 ? "Solid progress. Keep going." :
                         "Students who do 10+ sessions have significantly better outcomes."}
                      </p>
                    </div>
                  ) : (
                    <LockedState hint="Start practicing to track your progress here." ctaText="Start Next Session" ctaHref="/mock" />
                  )}
                </SectionCard>

                {/* Share actions */}
                <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
                  <button onClick={shareWhatsApp}
                    className="flex-1 rounded-2xl bg-[#25D366] py-3.5 text-[14px] font-black text-white hover:opacity-90 transition flex items-center justify-center gap-2">
                    💬 Share on WhatsApp
                  </button>
                  <Link href="/mock/dashboard" className="flex-1 block rounded-2xl border-2 border-[#E5E7EB] bg-white py-3.5 text-center text-[14px] font-bold text-[#374151] hover:border-[#111] transition">
                    Back to dashboard
                  </Link>
                </div>
              </motion.div>
            </AnimatePresence>
          )}
        </div>
      </main>
    </div>
  );
}