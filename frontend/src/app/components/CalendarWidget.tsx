"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { useAuth } from "@/context/AuthContext";

const API_BASE = (
  process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:8000"
).replace(/\/$/, "");

type TodayTask = {
  title: string;
  topic: string;
  task: string;
  session_type: string;
  is_interview_day: boolean;
};

type CalendarData = {
  exists: boolean;
  company?: string;
  role_target?: string;
  interview_date?: string;
  days_remaining?: number;
  today_task?: TodayTask | null;
  is_past?: boolean;
};

const TOPIC_ICONS: Record<string, string> = {
  dsa: "💻", "system-design": "🏗️", behavioral: "🎭",
  networking: "🌐", general: "📝",
};

const URGENCY = (days: number) => {
  if (days === 0) return { text: "Interview today!", color: "#EF4444", bg: "#FFF1F2", border: "#FCA5A5" };
  if (days === 1) return { text: "Tomorrow!", color: "#F59E0B", bg: "#FFFBEB", border: "#FCD34D" };
  if (days <= 3)  return { text: `${days} days left`, color: "#F59E0B", bg: "#FFFBEB", border: "#FCD34D" };
  if (days <= 7)  return { text: `${days} days left`, color: "#10B981", bg: "#F0FDF4", border: "#6EE7B7" };
  return              { text: `${days} days left`, color: "#111",    bg: "#F9FAFB", border: "#E5E7EB" };
};

export function CalendarWidget() {
  const { user, authHeader } = useAuth();
  const [data, setData] = useState<CalendarData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    async function load() {
      try {
        const res = await fetch(`${API_BASE}/api/calendar/my`, { headers: authHeader() });
        if (res.ok) setData(await res.json());
      } catch { /* silent */ }
      finally { setLoading(false); }
    }
    load();
  }, [user, authHeader]);

  // Not logged in
  if (!user) return null;

  // Loading skeleton
  if (loading) {
    return (
      <div className="rounded-2xl border border-[#E5E7EB] bg-white p-5 animate-pulse">
        <div className="h-3 w-24 bg-[#F3F4F6] rounded mb-3" />
        <div className="h-5 w-full bg-[#F3F4F6] rounded mb-2" />
        <div className="h-5 w-3/4 bg-[#F3F4F6] rounded" />
      </div>
    );
  }

  // No calendar set
  if (!data?.exists) {
    return (
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border-2 border-dashed border-[#E5E7EB] bg-white p-5">
        <div className="flex items-start gap-3">
          <span className="text-[28px]">📅</span>
          <div className="flex-1">
            <p className="text-[14px] font-black text-[#111] mb-1">No interview scheduled</p>
            <p className="text-[12px] text-[#9CA3AF] mb-3">
              Add your interview date and get a personalised day-by-day prep plan.
            </p>
            <Link href="/calendar">
              <button className="rounded-xl bg-[#111] px-4 py-2 text-[12px] font-black text-white hover:bg-[#333] transition">
                Set interview date →
              </button>
            </Link>
          </div>
        </div>
      </motion.div>
    );
  }

  const days = data.days_remaining ?? 0;
  const cfg = URGENCY(days);

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border overflow-hidden"
      style={{ borderColor: cfg.border, background: cfg.bg }}>

      {/* Header */}
      <div className="px-5 pt-4 pb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full animate-pulse" style={{ background: cfg.color }} />
          <p className="text-[11px] font-black uppercase tracking-widest" style={{ color: cfg.color }}>
            {cfg.text}
          </p>
        </div>
        <Link href="/calendar" className="text-[11px] font-bold text-[#9CA3AF] hover:text-[#111] transition">
          View plan →
        </Link>
      </div>

      {/* Company + role */}
      <div className="px-5 pb-4 border-b" style={{ borderColor: cfg.border }}>
        <p className="text-[16px] font-black text-[#111] leading-tight">
          {data.company}
        </p>
        <p className="text-[12px] text-[#6B7280] mt-0.5">
          {data.role_target} ·{" "}
          {data.interview_date && new Date(data.interview_date + "T00:00:00").toLocaleDateString("en-IN", {
            day: "numeric", month: "short", year: "numeric"
          })}
        </p>
      </div>

      {/* Today's task */}
      {data.today_task && !data.today_task.is_interview_day ? (
        <div className="px-5 py-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-[#9CA3AF] mb-2">Today's task</p>
          <div className="flex items-start gap-2 mb-3">
            <span className="text-[18px]">{TOPIC_ICONS[data.today_task.topic] || "📝"}</span>
            <div>
              <p className="text-[13px] font-bold text-[#111]">{data.today_task.title}</p>
              <p className="text-[11px] text-[#6B7280] mt-0.5 leading-snug">{data.today_task.task}</p>
            </div>
          </div>
          <Link href={`/mock?prefill_role=${encodeURIComponent(data.role_target || "")}&prefill_difficulty=intermediate`}>
            <button className="w-full rounded-xl bg-[#111] py-2.5 text-[12px] font-black text-white hover:bg-[#333] transition">
              Start today&apos;s session →
            </button>
          </Link>
        </div>
      ) : data.today_task?.is_interview_day ? (
        <div className="px-5 py-4 text-center">
          <p className="text-[32px] mb-2">🎯</p>
          <p className="text-[15px] font-black text-[#111] mb-1">Today&apos;s the day!</p>
          <p className="text-[12px] text-[#6B7280]">You&apos;ve prepared well. Trust your practice.</p>
        </div>
      ) : (
        <div className="px-5 py-4">
          <Link href="/calendar">
            <button className="w-full rounded-xl bg-[#111] py-2.5 text-[12px] font-black text-white hover:bg-[#333] transition">
              View full prep plan →
            </button>
          </Link>
        </div>
      )}
    </motion.div>
  );
}