
"use client";
 
import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { usePathname } from "next/navigation";
 
const API_BASE = (
  process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:8000"
).replace(/\/$/, "");
 
const TOPIC_ICONS: Record<string, string> = {
  behavioral: "🎭",
  dsa: "💻",
  "system-design": "🏗️",
  networking: "🌐",
  general: "📝",
};
 
export function DailyPopup() {
  const { user, authHeader } = useAuth();
  const pathname = usePathname();
  const [show, setShow] = useState(false);
  const [question, setQuestion] = useState<{ question_text: string; topic: string } | null>(null);
  const [dismissed, setDismissed] = useState(false);
 
  // Don't show on daily page itself or interview pages
  const isExcluded = pathname === "/daily" || pathname.includes("/mock/session") || pathname.includes("/interview");
 
  useEffect(() => {
    if (!user || isExcluded || dismissed) return;
 
    // Only show once per browser session
    const shownKey = `daily_popup_shown_${new Date().toDateString()}`;
    if (sessionStorage.getItem(shownKey)) return;
 
    async function check() {
      try {
        const res = await fetch(`${API_BASE}/api/daily/today`, {
          headers: authHeader(),
          cache: "no-store",
        });
        if (!res.ok) return;
        const data = await res.json();
 
        // Only show if not answered today
        if (!data.answered) {
          setQuestion(data.question);
          // Delay popup by 3 seconds so page loads first
          setTimeout(() => {
            setShow(true);
            sessionStorage.setItem(shownKey, "1");
          }, 3000);
        }
      } catch {
        // silent fail
      }
    }
 
    check();
  }, [user, pathname, isExcluded, dismissed, authHeader]);
 
  function dismiss() {
    setShow(false);
    setDismissed(true);
  }
 
  if (!show || !question) return null;
 
  const icon = TOPIC_ICONS[question.topic] || "📝";
 
  return (
    <div
      className="fixed bottom-6 right-6 z-50 w-[320px] rounded-2xl border border-[#E5E7EB] bg-white shadow-2xl shadow-black/10"
      style={{ animation: "slideUp 300ms cubic-bezier(0.2, 0.9, 0.2, 1)" }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#F3F4F6]">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-yellow-400 text-[11px] font-black text-[#111]">!</span>
          <span className="text-[12px] font-black uppercase tracking-widest text-[#9CA3AF]">Today&apos;s Question</span>
        </div>
        <button onClick={dismiss} className="text-[#D1D5DB] hover:text-[#111] transition text-[18px] leading-none">×</button>
      </div>
 
      {/* Question */}
      <div className="px-4 py-4">
        <div className="flex items-start gap-2 mb-3">
          <span className="text-[18px]">{icon}</span>
          <p className="text-[14px] font-bold text-[#111] leading-snug flex-1">
            {question.question_text.length > 100
              ? question.question_text.slice(0, 100) + "..."
              : question.question_text}
          </p>
        </div>
 
        <div className="flex gap-2">
          <Link
            href="/daily"
            onClick={dismiss}
            className="flex-1 rounded-xl bg-[#111] py-2.5 text-center text-[12px] font-black text-white hover:bg-[#333] transition"
          >
            Answer now →
          </Link>
          <button
            onClick={dismiss}
            className="rounded-xl border border-[#E5E7EB] px-3 py-2.5 text-[12px] font-medium text-[#9CA3AF] hover:text-[#111] transition"
          >
            Later
          </button>
        </div>
      </div>
 
      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}