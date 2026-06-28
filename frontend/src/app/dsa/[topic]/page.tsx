"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { motion } from "framer-motion";
import { useAuth } from "@/context/AuthContext";

const API_BASE = (process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:8000").replace(/\/$/, "");

type Problem = {
  id: number;
  problem_name: string;
  difficulty: string;
  topic: string;
  subtopic: string | null;
  tags: string[];
  companies: string[];
  solved: boolean;
};

const DIFF_STYLE: Record<string, { bg: string; color: string }> = {
  easy:   { bg: "#F0FDF4", color: "#15803D" },
  medium: { bg: "#FFFBEB", color: "#B45309" },
  hard:   { bg: "#FEF2F2", color: "#B91C1C" },
};

export default function DSAProblemsPage() {
  const { topic } = useParams() as { topic: string };
  const decodedTopic = decodeURIComponent(topic);
  const { user, authHeader } = useAuth();
  const [problems, setProblems] = useState<Problem[]>([]);
  const [loading, setLoading] = useState(true);
  const [difficulty, setDifficulty] = useState<string>("all");

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    const params = new URLSearchParams();
    if (difficulty !== "all") params.set("difficulty", difficulty);
    fetch(`${API_BASE}/api/dsa/problems/${encodeURIComponent(decodedTopic)}?${params}`, {
      headers: authHeader(),
    })
      .then(r => r.json())
      .then(d => setProblems(d.problems || []))
      .finally(() => setLoading(false));
  }, [user, decodedTopic, difficulty]);

  const solved = problems.filter(p => p.solved).length;

  return (
    <div className="min-h-screen bg-[#FAFAF8]">
      <main className="pt-[88px] pb-20 px-4 sm:px-6">
        <div className="mx-auto max-w-[860px]">

          {/* Back + header */}
          <div className="mb-6">
            <Link href="/dsa" className="text-[13px] text-[#9CA3AF] hover:text-[#111] transition">
              ← All topics
            </Link>
            <div className="flex items-center justify-between mt-3">
              <div>
                <h1 className="text-[28px] font-black text-[#111]" style={{ letterSpacing: "-0.5px" }}>
                  {decodedTopic}
                </h1>
                <p className="text-[14px] text-[#6B7280] mt-0.5">
                  {solved}/{problems.length} solved
                </p>
              </div>
              {/* Difficulty filter pills */}
              <div className="flex gap-2">
                {["all", "easy", "medium", "hard"].map(d => (
                  <button key={d} onClick={() => setDifficulty(d)}
                    className={`rounded-xl px-3 py-1.5 text-[12px] font-bold transition-all capitalize ${
                      difficulty === d ? "bg-[#111] text-white" : "bg-white border border-[#E5E7EB] text-[#374151] hover:border-[#111]"
                    }`}>
                    {d}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Problem list */}
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="h-16 rounded-2xl bg-white border border-[#E5E7EB] animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {problems.map((p, i) => {
                const diff = DIFF_STYLE[p.difficulty] || DIFF_STYLE.medium;
                return (
                  <motion.div
                    key={p.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.02 }}
                  >
                    <Link href={`/dsa/${encodeURIComponent(decodedTopic)}/${p.id}`}>
                      <div className={`flex items-center gap-4 rounded-2xl border bg-white px-5 py-4 hover:border-[#D1D5DB] transition-all cursor-pointer ${
                        p.solved ? "border-[#E5E7EB]" : "border-[#E5E7EB]"
                      }`}>
                        {/* Solved indicator */}
                        <div className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-[12px] font-black ${
                          p.solved ? "bg-emerald-100 text-emerald-700" : "bg-[#F3F4F6] text-[#9CA3AF]"
                        }`}>
                          {p.solved ? "✓" : i + 1}
                        </div>

                        {/* Problem name */}
                        <div className="flex-1 min-w-0">
                          <p className={`text-[14px] font-bold truncate ${p.solved ? "text-[#6B7280]" : "text-[#111]"}`}>
                            {p.problem_name}
                          </p>
                          {p.subtopic && (
                            <p className="text-[11px] text-[#9CA3AF] mt-0.5">{p.subtopic}</p>
                          )}
                        </div>

                        {/* Company tags */}
                        <div className="hidden sm:flex gap-1 flex-shrink-0">
                          {(p.companies || []).slice(0, 2).map(c => (
                            <span key={c} className="rounded-full bg-[#F3F4F6] px-2 py-0.5 text-[10px] font-medium text-[#6B7280]">
                              {c}
                            </span>
                          ))}
                          {(p.companies || []).length > 2 && (
                            <span className="text-[10px] text-[#9CA3AF]">+{p.companies.length - 2}</span>
                          )}
                        </div>

                        {/* Difficulty badge */}
                        <span className="flex-shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold capitalize"
                          style={{ background: diff.bg, color: diff.color }}>
                          {p.difficulty}
                        </span>
                      </div>
                    </Link>
                  </motion.div>
                );
              })}
              {problems.length === 0 && (
                <div className="text-center py-16 text-[#9CA3AF]">
                  <p className="text-[40px] mb-3">🔍</p>
                  <p className="text-[14px]">No problems found for this filter.</p>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}