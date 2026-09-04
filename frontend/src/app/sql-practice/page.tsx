// frontend/src/app/sql-practice/page.tsx
// Standalone SQL practice page — also importable as a tab in DSA IDE

import SQLPractice from "@/app/components/SQLPractice";

export default function SQLPracticePage() {
  return (
    <main className="min-h-screen pt-20" style={{ background: "#FAFAF8" }}>
      <div className="mx-auto max-w-[1100px] px-4 pb-8">

        {/* Header */}
        <div className="py-8">
          <span className="text-[11px] font-black uppercase tracking-widest text-[#9CA3AF] mb-2 block">
            Practice
          </span>
          <h1
            className="font-black text-[#111] mb-2"
            style={{ fontSize: "clamp(24px, 3vw, 36px)", letterSpacing: "-1px" }}
          >
            SQL Practice
          </h1>
          <p className="text-[14px] text-[#6B7280] max-w-lg leading-relaxed">
            Write and run real SQL queries against pre-loaded schemas — joins, subqueries,
            aggregations, and the core patterns tested in placement DBMS rounds.
          </p>
        </div>

        {/* SQL IDE */}
        <div
          className="rounded-2xl border border-[#E5E7EB] bg-white overflow-hidden"
          style={{ boxShadow: "0 4px 24px rgba(0,0,0,0.05)", minHeight: "75vh" }}
        >
          <SQLPractice />
        </div>

        {/* Tips */}
        <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { icon: "⌨️", tip: "Ctrl+Enter to run query", sub: "Works in the editor" },
            { icon: "💡", tip: "Use Practice Questions tab", sub: "Curated questions with hints" },
            { icon: "🏢", tip: "SQLite syntax", sub: "Core SQL concepts — some MySQL/PostgreSQL syntax differs" },
          ].map(({ icon, tip, sub }) => (
            <div
              key={tip}
              className="flex items-center gap-3 rounded-xl border border-[#E5E7EB] bg-white px-4 py-3"
            >
              <span className="text-[18px]">{icon}</span>
              <div>
                <p className="text-[12px] font-bold text-[#111]">{tip}</p>
                <p className="text-[11px] text-[#9CA3AF]">{sub}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}