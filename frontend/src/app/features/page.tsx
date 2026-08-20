"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { FooterHero } from "@/app/components/Footer";

// ── Updated feature set — full platform ──────────────────────────────────────

const FEATURE_SECTIONS = [
  {
    label: "Practice",
    color: "#6366F1",
    bg: "#EEF2FF",
    features: [
      {
        tag: "Mock Interview",
        headline: "A coach in your ear, every answer.",
        body: "While you speak, Cractal tracks WPM, detects filler words, and nudges you when you've been silent too long. Role-specific questions, voice transcription, AI scoring — full interview simulation.",
        stat: "Real-time pace and filler tracking",
        icon: "🎤",
        color: "#FFF9C4",
        accent: "#7A6000",
        visual: (
          <div className="flex items-end gap-1 mt-4 h-9">
            {[6, 14, 22, 12, 18, 26, 10, 16, 20, 8, 14, 22].map((h, i) => (
              <div key={i} style={{ width: "5px", height: `${h}px`, background: "#FFD600", borderRadius: "3px", opacity: 0.5 + (i % 3) * 0.2 }} />
            ))}
          </div>
        ),
      },
      {
        tag: "AI Scoring",
        headline: "Scored on what matters, not just a number.",
        body: "Technical accuracy, communication clarity, completeness — each answer gets a breakdown. You know exactly what to improve, not just that you scored 62.",
        stat: "Calibrated for Indian campus and off-campus placement level",
        icon: "✦",
        color: "#EEF2FF",
        accent: "#4338CA",
        visual: (
          <div className="mt-4 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#111] text-[14px] font-black text-white">62</div>
            <div className="flex-1 space-y-1.5">
              {[70, 55, 80].map((v, i) => (
                <div key={i} className="h-1.5 rounded-full bg-[#E0E7FF] overflow-hidden">
                  <div className="h-full rounded-full bg-[#6366F1]" style={{ width: `${v}%` }} />
                </div>
              ))}
            </div>
          </div>
        ),
      },
      {
        tag: "Quick Prep",
        headline: "3 questions. 2 minutes. Before you walk in.",
        body: "No setup, no scoring pressure. Just 3 rapid-fire questions in voice revision mode. Perfect when you have 5 minutes before an interview and need to warm up your brain.",
        stat: "Voice-first, instant start",
        icon: "☕",
        color: "#FFFBEB",
        accent: "#92400E",
        visual: (
          <div className="mt-4 space-y-1.5">
            {["What is polymorphism?", "Explain REST vs GraphQL", "Quicksort complexity?"].map((q, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 10px", background: i === 0 ? "#FEF3C7" : "white", border: "1px solid #F3F4F6", borderRadius: 7 }}>
                <span style={{ width: 16, height: 16, background: i === 0 ? "#F59E0B" : "#F3F4F6", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 8, fontWeight: 800, color: i === 0 ? "white" : "#9CA3AF", flexShrink: 0 }}>{i + 1}</span>
                <span style={{ fontSize: 10, color: i === 0 ? "#92400E" : "#9CA3AF", fontWeight: i === 0 ? 600 : 400 }}>{q}</span>
              </div>
            ))}
          </div>
        ),
      },
      {
        tag: "Topic Practice",
        headline: "Pick one subject. Drill it until you own it.",
        body: "DBMS, OS, OOP, Computer Networks, DSA — go deep on one topic with progressively harder questions. Track your coverage per topic so you know what you've actually covered.",
        stat: "Progress tracked per topic",
        icon: "📊",
        color: "#F0F9FF",
        accent: "#0369A1",
        visual: (
          <div className="mt-4 space-y-1.5">
            {[{ t: "DBMS", v: 67, c: "#6366F1" }, { t: "OS", v: 40, c: "#10B981" }, { t: "OOP", v: 100, c: "#F59E0B" }].map(s => (
              <div key={s.t}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, fontWeight: 700, color: "#374151", marginBottom: 3 }}>
                  <span>{s.t}</span><span style={{ color: s.c }}>{s.v}%</span>
                </div>
                <div style={{ height: 4, background: "#E0F2FE", borderRadius: 99, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${s.v}%`, background: s.c, borderRadius: 99 }} />
                </div>
              </div>
            ))}
          </div>
        ),
      },
      {
        tag: "Resume Prep",
        headline: "AI reads your resume and asks about YOUR projects.",
        body: "Upload your resume. Cractal asks specific questions about your projects, tech stack choices, and experience — exactly what real interviewers do. No generic questions.",
        stat: "Stack-specific, project-aware follow-ups",
        icon: "📄",
        color: "#F0FDF4",
        accent: "#166534",
        visual: (
          <div className="mt-4 rounded-lg bg-white border border-[#DCFCE7] px-3 py-2.5">
            <p className="text-[10px] font-black text-emerald-700 mb-1">🔍 FROM YOUR RESUME</p>
            <p className="text-[11px] text-[#6B7280] leading-snug">"Why did you choose MongoDB over SQL for ExpenseTracker?"</p>
          </div>
        ),
      },
      {
        tag: "Peer Practice",
        headline: "Challenge a friend. Same question, same time.",
        body: "Send a challenge link. Both of you answer the same question simultaneously. Compare scores side by side. The competitive pressure makes you think faster — it's the closest thing to a real interview.",
        stat: "Real-time head-to-head via WhatsApp link",
        icon: "⚔️",
        color: "#FDF4FF",
        accent: "#7E22CE",
        visual: (
          <div className="mt-4 flex gap-2">
            {[{ name: "You", score: 84, color: "#6366F1", w: "84%" }, { name: "Aryan", score: 71, color: "#F59E0B", w: "71%" }].map(p => (
              <div key={p.name} style={{ flex: 1, background: "white", border: "1px solid #F3E8FF", borderRadius: 9, padding: "8px 10px" }}>
                <div style={{ fontSize: 10, color: "#9CA3AF", marginBottom: 3 }}>{p.name}</div>
                <div style={{ fontSize: 20, fontWeight: 900, color: p.color, lineHeight: 1 }}>{p.score}</div>
                <div style={{ marginTop: 5, height: 3, background: "#F3F4F6", borderRadius: 99 }}>
                  <div style={{ height: "100%", width: p.w, background: p.color, borderRadius: 99 }} />
                </div>
              </div>
            ))}
          </div>
        ),
      },
      {
        tag: "DSA Practice",
        headline: "185 problems. Real IDE. Company-focused.",
        body: "Solve DSA problems in Python, Java, or C++. Real test cases validate your solution. See the optimal approach, time complexity, and why it works — not just if it passes.",
        stat: "185 problems · Python, Java, C++",
        icon: "💻",
        color: "#F9FAFB",
        accent: "#111111",
        visual: (
          <div className="mt-4 rounded-lg px-3 py-2.5 font-mono" style={{ background: "#0F0F17", border: "1px solid #2A2A3A", fontSize: "10px", lineHeight: 1.8 }}>
            <div style={{ color: "#6B7280" }}><span style={{ color: "#C084FC" }}>def</span> <span style={{ color: "#60A5FA" }}>max_profit</span><span style={{ color: "#E5E7EB" }}>(prices):</span></div>
            <div style={{ paddingLeft: 14, color: "#E5E7EB" }}>min_price = prices[0]</div>
            <div className="flex items-center gap-2 mt-1.5">
              <span className="rounded-full px-2 py-0.5 text-[9px] font-bold" style={{ background: "#065F46", color: "#6EE7B7" }}>✓ 12/12 passed</span>
              <span style={{ color: "#6B7280", fontSize: 10 }}>O(n) time</span>
            </div>
          </div>
        ),
      },
      {
        tag: "Follow-up Questions",
        headline: "Real interviews don't stop at the first answer.",
        body: "After your answer, Cractal asks follow-ups based on what you actually said — 'Can you give a project example?' or 'What's the trade-off?' Training you to handle pressure and think on your feet.",
        stat: "Contextual, based on your actual answer",
        icon: "💬",
        color: "#FFF7ED",
        accent: "#9A3412",
        visual: (
          <div className="mt-4 space-y-1.5">
            <div className="rounded-lg bg-white border border-[#FED7AA] px-3 py-1.5 text-[10px] text-[#6B7280]">"Can you give a project example?"</div>
            <div className="rounded-lg bg-[#FFF7ED] border border-[#FED7AA] px-3 py-1.5 text-[10px] text-[#9A3412] font-bold ml-4">↳ Follow-up #2 loading...</div>
          </div>
        ),
      },
    ],
  },
  {
    label: "Assess & Prepare",
    color: "#10B981",
    bg: "#ECFDF5",
    features: [
      {
        tag: "Assessment — Free",
        headline: "Know where you stand before your first interview.",
        body: "30-minute diagnostic across aptitude, CS fundamentals, DSA, and communication. No login needed to take it. Get a score, gap analysis, company match for TCS/Infosys/Wipro, and 3 personalised next steps.",
        stat: "193 questions · No login needed to take the test",
        icon: "📊",
        color: "#ECFDF5",
        accent: "#065F46",
        visual: (
          <div className="mt-4 flex items-center gap-3">
            <div style={{ background: "#111", borderRadius: 10, padding: "10px 14px", textAlign: "center", flexShrink: 0 }}>
              <div style={{ fontSize: 28, fontWeight: 900, color: "white", lineHeight: 1, letterSpacing: "-1px" }}>64</div>
              <div style={{ fontSize: 9, color: "#555", marginTop: 2 }}>/100</div>
              <div style={{ marginTop: 4, background: "#FFD600", color: "#111", borderRadius: 4, padding: "2px 6px", fontSize: 8, fontWeight: 800 }}>Good Progress</div>
            </div>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 5 }}>
              {[{ l: "Aptitude", s: 72, c: "#6366F1" }, { l: "CS", s: 85, c: "#10B981" }, { l: "DSA", s: 41, c: "#F59E0B" }].map(s => (
                <div key={s.l}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: "#9CA3AF", marginBottom: 2 }}><span>{s.l}</span><span style={{ color: s.c, fontWeight: 800 }}>{s.s}%</span></div>
                  <div style={{ height: 3, background: "#F3F4F6", borderRadius: 99 }}>
                    <div style={{ height: "100%", width: `${s.s}%`, background: s.c, borderRadius: 99 }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ),
      },
      {
        tag: "OA Practice — Pro & Max",
        headline: "Simulate the real OA. Locked timers. No going back.",
        body: "TCS NQT, Infosys SE, Wipro NLTH, Cognizant GenC — each test mirrors the exact format with locked section timers. You cannot go back to previous questions. Band prediction after every attempt.",
        stat: "734 questions across 4 companies · 50+ per section",
        icon: "📝",
        color: "#EEF2FF",
        accent: "#4338CA",
        visual: (
          <div className="mt-4 rounded-lg overflow-hidden" style={{ border: "1px solid #E5E7EB" }}>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 10px", background: "#FAFAF8", borderBottom: "1px solid #F3F4F6" }}>
              <span style={{ fontSize: 11, fontWeight: 800, color: "#111" }}>🔷 TCS NQT</span>
              <span style={{ fontFamily: "monospace", fontSize: 12, fontWeight: 900, color: "#111", background: "#F3F4F6", padding: "1px 6px", borderRadius: 5 }}>09:42</span>
            </div>
            <div style={{ display: "flex", gap: 4, padding: "6px 10px", borderBottom: "1px solid #F3F4F6" }}>
              {["Numerical", "Verbal 🔒", "Reasoning 🔒"].map((s, i) => (
                <span key={s} style={{ fontSize: 9, fontWeight: 700, padding: "3px 8px", borderRadius: 5, background: i === 0 ? "#111" : "#F3F4F6", color: i === 0 ? "white" : "#9CA3AF" }}>{s}</span>
              ))}
            </div>
            <div style={{ padding: "6px 10px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 10, color: "#9CA3AF" }}>Band prediction</span>
              <div style={{ display: "flex", gap: 4 }}>
                {["Ninja", "Digital", "Prime"].map((b, i) => (
                  <span key={b} style={{ fontSize: 9, fontWeight: 800, padding: "1px 7px", borderRadius: 99, background: i === 1 ? "#EEF2FF" : "transparent", color: i === 1 ? "#6366F1" : "#D1D5DB", border: i === 1 ? "1px solid #C7D2FE" : "1px solid transparent" }}>{b}</span>
                ))}
              </div>
            </div>
          </div>
        ),
      },
      {
        tag: "Company Guides",
        headline: "TCS is not Amazon. Know before you walk in.",
        body: "Round-by-round breakdowns, most-asked questions, interview patterns for TCS, Infosys, Wipro, Amazon, Microsoft and more. What each company specifically looks for — campus and off-campus.",
        stat: "10 companies covered at launch",
        icon: "🏢",
        color: "#FFF7ED",
        accent: "#9A3412",
        visual: (
          <div className="flex flex-wrap gap-1.5 mt-4">
            {[
              { name: "TCS", bg: "#DBEAFE", color: "#1D4ED8" },
              { name: "Amazon", bg: "#FEF3C7", color: "#92400E" },
              { name: "Microsoft", bg: "#CFFAFE", color: "#0E7490" },
              { name: "Infosys", bg: "#D1FAE5", color: "#065F46" },
              { name: "Off-campus", bg: "#F3E8FF", color: "#7E22CE" },
            ].map(c => (
              <span key={c.name} style={{ background: c.bg, color: c.color, fontSize: 10, fontWeight: 700, padding: "3px 10px", borderRadius: 99 }}>{c.name}</span>
            ))}
          </div>
        ),
      },
      {
        tag: "Cheat Sheet — Max",
        headline: "Everything you need to remember, the night before.",
        body: "Distilled DBMS, OS, Computer Networks, and OOP — structured for 30-minute last-minute review. ACID properties, scheduling algorithms, OSI model, 4 pillars. Nothing you don't need.",
        stat: "Printable · Structured for quick review",
        icon: "⚡",
        color: "#F9FAFB",
        accent: "#111111",
        visual: (
          <div className="mt-4 rounded-lg px-3 py-2.5 font-mono" style={{ background: "white", border: "1px solid #E8E5DC", fontSize: "10px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 6 }}>
              {["#EF4444", "#F59E0B", "#10B981"].map((c, i) => <span key={i} style={{ width: 5, height: 5, background: c, borderRadius: "50%", display: "inline-block" }} />)}
              <span style={{ fontSize: 9, color: "#9CA3AF", marginLeft: 4 }}>ACID Properties</span>
            </div>
            {[["Atomicity", "All or nothing"], ["Consistency", "Valid → valid state"], ["Isolation", "No interference"], ["Durability", "Committed = permanent"]].map(([k, v]) => (
              <div key={k} style={{ display: "flex", gap: 8, lineHeight: 1.8 }}>
                <span style={{ color: "#6366F1", fontWeight: 700, width: 80, flexShrink: 0 }}>{k}</span>
                <span style={{ color: "#555" }}>{v}</span>
              </div>
            ))}
          </div>
        ),
      },
    ],
  },
  {
    label: "Track & Stay Consistent",
    color: "#F59E0B",
    bg: "#FFFBEB",
    features: [
      {
        tag: "Per-Question Report",
        headline: "See what you said. See what you should have said.",
        body: "Full transcript of your answer, what was missing, and a model answer — what a strong candidate would have said. The fastest way to close the gap between where you are and where you need to be.",
        stat: "Model answers included on Pro and Max",
        icon: "📋",
        color: "#F0FDF4",
        accent: "#166534",
        visual: (
          <div className="mt-4 rounded-lg bg-white border border-[#DCFCE7] px-3 py-2.5">
            <p className="text-[10px] font-black text-emerald-700 mb-1">💡 MODEL ANSWER</p>
            <p className="text-[11px] text-[#6B7280] leading-snug">"First, I'd clarify the constraints, then walk through a brute force before optimising..."</p>
          </div>
        ),
      },
      {
        tag: "Progress Tracking",
        headline: "Numbers that tell the truth.",
        body: "Score trends over time, best session, average, and improvement from first to latest. No vanity metrics — just honest data on whether you're actually getting better.",
        stat: "Streak tracking keeps you consistent",
        icon: "📈",
        color: "#F9FAFB",
        accent: "#111111",
        visual: (
          <svg viewBox="0 0 120 32" className="mt-4 w-full h-8">
            <polyline points="0,28 20,22 40,24 60,14 80,16 100,6 120,4" fill="none" stroke="#111" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ),
      },
      {
        tag: "Skill Passport",
        headline: "Your verified readiness card — shareable on LinkedIn.",
        body: "Every session feeds one score. Skill Passport shows your readiness across DSA, CS fundamentals, system design, and communication — updated live. Share it when you're ready.",
        stat: "Shareable on LinkedIn and WhatsApp",
        icon: "🎖️",
        color: "#EEF2FF",
        accent: "#4338CA",
        visual: (
          <div className="mt-4 flex items-center gap-3">
            <div style={{ background: "#111", borderRadius: 10, padding: "10px 12px", textAlign: "center", flexShrink: 0 }}>
              <div style={{ fontSize: 24, fontWeight: 900, color: "white", lineHeight: 1 }}>74</div>
              <div style={{ fontSize: 9, color: "#F59E0B", fontWeight: 800, marginTop: 3 }}>STRONG</div>
            </div>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
              {[{ l: "DSA", s: 80, c: "#6366F1" }, { l: "CS", s: 72, c: "#10B981" }, { l: "Comms", s: 65, c: "#EC4899" }].map(s => (
                <div key={s.l} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 9, color: "#9CA3AF", width: 36 }}>{s.l}</span>
                  <div style={{ flex: 1, height: 4, background: "#F3F4F6", borderRadius: 99 }}>
                    <div style={{ height: "100%", width: `${s.s}%`, background: s.c, borderRadius: 99 }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ),
      },
      {
        tag: "Interview Calendar",
        headline: "Add your interview date. Get a day-by-day plan.",
        body: "Tell Cractal when your interview is. Get a personalised daily prep plan built around your timeline — different focus areas per day based on how much time you have left.",
        stat: "Works for campus and off-campus timelines",
        icon: "📅",
        color: "#ECFDF5",
        accent: "#065F46",
        visual: (
          <div className="mt-4 rounded-lg bg-white border border-[#BBF7D0] px-3 py-2.5">
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ fontSize: 10, fontWeight: 800, color: "#111" }}>July 2026</span>
              <span style={{ fontSize: 9, background: "#DCFCE7", color: "#166534", borderRadius: 99, padding: "1px 7px", fontWeight: 700 }}>TCS in 5 days</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2 }}>
              {[...Array(2)].map((_, i) => <div key={"e" + i} />)}
              {[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17].map(d => (
                <div key={d} style={{ height: 18, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: d === 17 ? 900 : 400, background: d === 17 ? "#10B981" : "transparent", color: d === 17 ? "white" : "#374151", borderRadius: 4 }}>{d}</div>
              ))}
            </div>
          </div>
        ),
      },
      {
        tag: "Daily Challenge",
        headline: "One question a day. Builds your streak.",
        body: "A fresh question every day — alternates between aptitude, CS, and DSA. Takes 2 minutes. Answer consistently and your streak grows. Small habit, big difference over a semester.",
        stat: "2 minutes per day · Streak tracking",
        icon: "🔥",
        color: "#FFFBEB",
        accent: "#92400E",
        visual: (
          <div className="mt-4">
            <div style={{ display: "flex", gap: 3 }}>
              {[...Array(7)].map((_, i) => (
                <div key={i} style={{ flex: 1, height: 24, borderRadius: 5, background: i < 5 ? "#F59E0B" : "#F3F4F6", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 8, fontWeight: 700, color: i < 5 ? "white" : "#D1D5DB" }}>
                  {["M","T","W","T","F","S","S"][i]}
                </div>
              ))}
            </div>
            <div style={{ marginTop: 8, fontSize: 10, color: "#9CA3AF" }}>
              🔥 23-day streak · Today: OS question
            </div>
          </div>
        ),
      },
    ],
  },
];

const COMPARISON = [
  { feature: "Live coaching while you speak",        Cractal: true,  paper: false, generic: false },
  { feature: "Per-question model answers",           Cractal: true,  paper: false, generic: false },
  { feature: "Company-specific questions",           Cractal: true,  paper: true,  generic: false },
  { feature: "WPM + filler word tracking",           Cractal: true,  paper: false, generic: false },
  { feature: "Instant AI feedback",                  Cractal: true,  paper: false, generic: true  },
  { feature: "Campus + off-campus placement focus",  Cractal: true,  paper: true,  generic: false },
  { feature: "OA practice with locked timers",       Cractal: true,  paper: false, generic: false },
  { feature: "Placement readiness diagnostic",       Cractal: true,  paper: false, generic: false },
  { feature: "Progress tracking over time",          Cractal: true,  paper: false, generic: false },
  { feature: "Available 24/7, no scheduling",        Cractal: true,  paper: true,  generic: true  },
];

const FAQS = [
  { q: "How is Cractal different from just practising with ChatGPT?", a: "ChatGPT gives you generic feedback on what you typed. Cractal listens to your actual voice, tracks your speaking patterns in real time, scores your answers across multiple dimensions, and shows you a model answer for every question. It's the difference between a text editor and a flight simulator." },
  { q: "Is this useful for TCS/Infosys campus placements?", a: "Yes — this is exactly who we built it for. The question bank includes TCS NQT and Infosys InfyTQ-style questions. The OA practice tests simulate the exact format with locked timers and band prediction. Difficulty is calibrated for campus placement level, not senior engineer level." },
  { q: "Does it work for off-campus applications too?", a: "Yes. If your placement cell doesn't get companies like Razorpay, Zerodha, or Freshworks on campus, you can still prep for those interviews here. The question bank, scoring, and coaching are the same regardless of how you're applying. Your college tier doesn't matter to us." },
  { q: "How many sessions do I need before I see improvement?", a: "It varies, but students who read the per-question coaching report carefully and act on the one specific fix tend to improve fastest. Most see measurable improvement within 3–5 sessions." },
  { q: "Does it work for non-CS branches?", a: "Yes. ECE and IT students use it too. The behavioral and communication questions are relevant for any engineering branch, and technical questions can be filtered by role." },
  { q: "What languages can I use for DSA practice?", a: "Python, Java, and C++. Pick whichever you're most comfortable with — the scoring and test cases work the same across all three." },
  { q: "Do I need to pay to see my score?", a: "No. Score, transcript, and what was missing are free forever. Paid plans unlock model answers, unlimited sessions, OA practice tests, company-specific prep, and the Skill Passport." },
];

function Check({ filled }: { filled: boolean }) {
  return filled ? (
    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[#111] text-[11px] font-bold text-white">✓</span>
  ) : (
    <span className="text-[#D1D5DB] text-lg">—</span>
  );
}

export default function FeaturesPage() {
  return (
    <div className="min-h-screen overflow-x-hidden" style={{ background: "#FFFDF0" }}>
      <main className="pt-24">

        {/* ── Hero ── */}
        <section className="px-6 pb-20 pt-16 text-center">
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-1.5 shadow-sm mb-8"
          >
            <span className="flex h-4 w-4 items-center justify-center rounded-sm bg-yellow-400 text-[10px] font-black text-yellow-900">✦</span>
            <span className="text-sm font-semibold text-gray-600">
              Built for India's engineering students — campus and off-campus
            </span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="mx-auto max-w-3xl"
            style={{ fontSize: "clamp(36px, 5vw, 62px)", fontWeight: 900, letterSpacing: "-2px", lineHeight: 1.4, color: "#111" }}
          >
            Everything you need to{" "}
            <span style={{ background: "#FFD600", padding: "2px 10px", borderRadius: "6px", fontStyle: "italic" }}>
              crack placements.
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.25 }}
            className="mx-auto mt-6 max-w-xl text-[17px] leading-relaxed"
            style={{ color: "#666" }}
          >
            Mock interviews with live coaching, OA practice with locked timers, placement readiness assessment, company guides, DSA practice, peer challenges — one platform, built for how Indian placements actually work.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="mt-8 flex items-center justify-center gap-3 flex-wrap"
          >
            <Link href="/signup">
              <button style={{ background: "#111", color: "white", fontWeight: 700, fontSize: "14px", padding: "12px 28px", borderRadius: "10px", border: "none", cursor: "pointer" }}>
                Start for free →
              </button>
            </Link>
            <Link href="/assessment">
              <button style={{ background: "white", color: "#111", fontWeight: 600, fontSize: "14px", padding: "11px 24px", borderRadius: "10px", border: "1.5px solid #ddd", cursor: "pointer" }}>
                Take free assessment
              </button>
            </Link>
          </motion.div>
        </section>

        {/* ── Feature sections ── */}
        <section className="mx-auto max-w-6xl px-6 pb-24 space-y-20">
          {FEATURE_SECTIONS.map((section) => (
            <div key={section.label}>
              {/* Section label */}
              <div className="flex items-center gap-3 mb-8">
                <span className="inline-block rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-widest" style={{ background: section.bg, color: section.color }}>
                  {section.label}
                </span>
                <div className="flex-1 h-px bg-[#E5E7EB]" />
              </div>

              {/* Feature cards */}
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
                {section.features.map((f, i) => (
                  <motion.div
                    key={f.tag}
                    initial={{ opacity: 0, y: 24 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5, delay: i * 0.07 }}
                    whileHover={{ y: -5, transition: { duration: 0.18 } }}
                    className="relative flex flex-col overflow-hidden rounded-2xl bg-white"
                    style={{ border: "1px solid #ECECE4", boxShadow: "0 1px 2px rgba(0,0,0,0.03)" }}
                  >
                    <div style={{ height: "4px", width: "100%", background: f.accent, opacity: 0.85 }} />
                    <div className="p-6 flex flex-col flex-1">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex h-11 w-11 items-center justify-center rounded-xl text-xl" style={{ background: f.color }}>
                          {f.icon}
                        </div>
                        <span className="inline-block rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-widest" style={{ background: f.color, color: f.accent }}>
                          {f.tag}
                        </span>
                      </div>
                      <h3 className="text-[18px] font-black leading-snug text-[#111]">{f.headline}</h3>
                      <p className="mt-2 text-[13px] leading-relaxed text-[#6B7280] flex-1">{f.body}</p>
                      {f.visual}
                      <div className="mt-4 pt-3 border-t border-[#F0F0EB]">
                        <p className="text-[11px] font-bold text-[#9CA3AF]">{f.stat}</p>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          ))}
        </section>

        {/* ── What the AI checks — KEEP ORIGINAL ── */}
        <section className="border-t border-gray-200 bg-white px-6 py-24">
          <div className="mx-auto max-w-5xl">
            <div className="mb-14 text-center">
              <p className="text-[11px] font-black uppercase tracking-widest text-[#9CA3AF] mb-3">Under the hood</p>
              <h2 style={{ fontSize: "clamp(28px, 4vw, 44px)", fontWeight: 900, letterSpacing: "-1.5px", color: "#111" }}>
                What the AI is actually{" "}
                <span style={{ background: "#FFD600", padding: "1px 8px", borderRadius: "5px", fontStyle: "italic" }}>listening for.</span>
              </h2>
              <p className="mt-3 text-[15px] text-[#6B7280] mx-auto max-w-lg">
                Not a black box. Here's exactly what gets evaluated every time you answer.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              {[
                { icon: "🗣️", title: "Did you actually answer the question?", body: "Cractal checks if your response addresses what was asked, not just whether you said something fluent-sounding. Rambling around the topic without answering it gets flagged." },
                { icon: "🔍", title: "Did you go deep, or stay surface-level?", body: "Naming the right concept isn't enough. Cractal checks whether you explained the why and how — the part interviewers actually probe on follow-up." },
                { icon: "⏱️", title: "How you said it, not just what you said", body: "Speaking pace, filler word frequency, and long silences are tracked live. These are the habits you can't see in yourself until someone points them out." },
                { icon: "🎯", title: "Does it match what this company actually asks?", body: "Your answer is evaluated against the pattern of that specific company's interview style — a TCS campus drive answer and an off-campus product company answer aren't scored the same way." },
              ].map((item, i) => (
                <motion.div
                  key={item.title}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: i * 0.1 }}
                  className="rounded-2xl border border-gray-100 bg-[#F9FAFB] p-6"
                >
                  <span className="text-[26px] block mb-3">{item.icon}</span>
                  <h3 className="text-[15px] font-black text-[#111] mb-2 leading-snug">{item.title}</h3>
                  <p className="text-[13px] text-[#6B7280] leading-relaxed">{item.body}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Comparison table — KEEP ORIGINAL STRUCTURE, updated rows ── */}
        <section className="px-6 py-24" style={{ background: "#FFFDF0" }}>
          <div className="mx-auto max-w-4xl">
            <div className="mb-12 text-center">
              <p className="text-[11px] font-black uppercase tracking-widest text-[#9CA3AF] mb-3">Comparison</p>
              <h2 style={{ fontSize: "clamp(26px, 4vw, 42px)", fontWeight: 900, letterSpacing: "-1.5px", color: "#111" }}>
                Why not just practise on paper?
              </h2>
              <p className="mt-3 text-[15px] text-[#6B7280] mx-auto max-w-lg">Here's what Cractal does that other approaches can't.</p>
            </div>
            <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr>
                    <th className="border-b border-gray-100 bg-[#F9FAFB] px-5 py-4 text-left text-[12px] font-bold text-[#374151]">Feature</th>
                    <th className="border-b border-gray-100 bg-[#111] px-4 py-4 text-center text-[12px] font-black text-white">Cractal</th>
                    <th className="border-b border-gray-100 px-4 py-4 text-center text-[11px] font-bold text-[#9CA3AF]">On paper</th>
                    <th className="border-b border-gray-100 px-4 py-4 text-center text-[11px] font-bold text-[#9CA3AF]">Generic prep tools</th>
                  </tr>
                </thead>
                <tbody>
                  {COMPARISON.map((row, i) => (
                    <tr key={row.feature} className={`border-t border-gray-50 ${i % 2 === 0 ? "" : "bg-[#FAFAFA]"}`}>
                      <td className="px-5 py-3.5 text-[13px] text-[#374151]">{row.feature}</td>
                      <td className="px-4 py-3.5 text-center bg-[#111]/[0.02]"><Check filled={row.Cractal} /></td>
                      <td className="px-4 py-3.5 text-center"><Check filled={row.paper} /></td>
                      <td className="px-4 py-3.5 text-center"><Check filled={row.generic} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* ── FAQ — KEEP ORIGINAL ── */}
        <section className="border-t border-gray-200 bg-white px-6 py-24">
          <div className="mx-auto max-w-3xl">
            <div className="mb-12 text-center">
              <p className="text-[11px] font-black uppercase tracking-widest text-[#9CA3AF] mb-3">FAQ</p>
              <h2 style={{ fontSize: "clamp(26px, 4vw, 40px)", fontWeight: 900, letterSpacing: "-1.5px", color: "#111" }}>Questions students ask us.</h2>
            </div>
            <div className="space-y-4">
              {FAQS.map((faq, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 12 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: i * 0.08 }}
                  className="rounded-2xl border border-gray-100 bg-[#F9FAFB] p-6"
                >
                  <h3 className="text-[15px] font-bold text-[#111] mb-2">{faq.q}</h3>
                  <p className="text-[13px] text-[#6B7280] leading-relaxed">{faq.a}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ── CTA — KEEP ORIGINAL ── */}
        <section className="px-6 py-24" style={{ background: "#111" }}>
          <div className="mx-auto max-w-2xl text-center">
            <h2 style={{ fontSize: "clamp(30px, 5vw, 52px)", fontWeight: 900, letterSpacing: "-2px", color: "white", lineHeight: 1.4 }}>
              Your next interview is{" "}
              <span style={{ background: "#FFD600", color: "#111", padding: "2px 10px", borderRadius: "6px", fontStyle: "italic" }}>
                closer than you think.
              </span>
            </h2>
            <p className="mt-5 text-[15px] text-[#666] mx-auto max-w-md">
              3 free sessions. Campus drive or off-campus. No card required.
            </p>
            <Link href="/signup">
              <button className="mt-8 rounded-xl bg-white px-8 py-3.5 text-[15px] font-black text-[#111] hover:bg-gray-100 transition">
                Start practising free →
              </button>
            </Link>
          </div>
        </section>

      </main>
      <FooterHero />
    </div>
  );
}