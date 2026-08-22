// ═══════════════════════════════════════════════════
// frontend/src/app/admin/analytics/page.tsx
// ═══════════════════════════════════════════════════
"use client";
import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
 
const API = (process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:8000").replace(/\/$/, "");
 
function useAdminFetch(path: string) {
  const { authHeader, user, loading: authLoading } = useAuth();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading || !user) return;
    fetch(`${API}${path}`, { headers: authHeader() })
      .then(r => {
        if (!r.ok) throw new Error(`${r.status}`);
        return r.json();
      })
      .then(setData)
      .catch(err => console.error("Admin fetch error:", path, err))
      .finally(() => setLoading(false));
  }, [path, user, authLoading]);

  return { data, loading };
}
 
export function AdminAnalyticsPage() {
  const { data: retention } = useAdminFetch("/api/admin/analytics/retention");
  const { data: funnel } = useAdminFetch("/api/admin/analytics/funnel");
  const { data: qAnalytics } = useAdminFetch("/api/admin/analytics/questions");
  const { data: referrals } = useAdminFetch("/api/admin/analytics/referrals");
 
  const funnelData = funnel?.funnel || [];
  const funnelMax = funnelData[0]?.count || 1;
 
  return (
    <div className="space-y-6">
      <div>
        <p className="text-[11px] font-black uppercase tracking-widest text-[#9CA3AF] mb-1">Admin</p>
        <h1 className="text-[28px] font-black text-[#111]" style={{ letterSpacing: "-0.5px" }}>Analytics</h1>
      </div>
 
      {/* Funnel */}
      <div className="rounded-2xl border border-[#E5E7EB] bg-white p-6">
        <p className="text-[11px] font-black uppercase tracking-widest text-[#9CA3AF] mb-5">Conversion Funnel</p>
        <div className="space-y-4">
          {funnelData.map((f: any, i: number) => (
            <div key={f.stage} className="flex items-center gap-4">
              <span className="text-[11px] text-[#9CA3AF] w-6">{i + 1}</span>
              <div className="w-44 text-[13px] text-[#374151] font-medium">{f.stage}</div>
              <div className="flex-1 h-2 rounded-full bg-[#F3F4F6] overflow-hidden">
                <div className="h-full rounded-full bg-[#111] transition-all duration-700"
                  style={{ width: `${(f.count / funnelMax) * 100}%` }} />
              </div>
              <div className="w-24 text-right">
                <span className="text-[14px] font-black text-[#111]">{f.count}</span>
                <span className="text-[11px] text-[#9CA3AF] ml-1.5">{f.pct}%</span>
              </div>
            </div>
          ))}
        </div>
      </div>
 
      {/* Retention cohort */}
      <div className="rounded-2xl border border-[#E5E7EB] bg-white p-6 overflow-x-auto">
        <p className="text-[11px] font-black uppercase tracking-widest text-[#9CA3AF] mb-5">Weekly Retention Cohorts</p>
        {retention?.cohorts?.length > 0 ? (
          <table className="w-full text-[12px]">
            <thead>
              <tr>
                <th className="text-left text-[10px] font-black uppercase tracking-widest text-[#9CA3AF] pb-3 pr-4">Cohort</th>
                <th className="text-center text-[10px] font-black uppercase tracking-widest text-[#9CA3AF] pb-3 px-2">Size</th>
                {["W0", "W1", "W2", "W3", "W4"].map(w => (
                  <th key={w} className="text-center text-[10px] font-black uppercase tracking-widest text-[#9CA3AF] pb-3 px-2">{w}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {retention.cohorts.map((c: any) => (
                <tr key={c.cohort} className="border-t border-[#F3F4F6]">
                  <td className="py-2.5 pr-4 text-[#374151] font-medium">{c.cohort}</td>
                  <td className="py-2.5 px-2 text-center font-black text-[#111]">{c.cohort_size}</td>
                  {[c.week_0, c.week_1, c.week_2, c.week_3, c.week_4].map((w: number, i: number) => {
                    const pct = c.cohort_size > 0 ? Math.round((w / c.cohort_size) * 100) : 0;
                    const opacity = pct > 0 ? 0.15 + (pct / 100) * 0.85 : 0;
                    return (
                      <td key={i} className="py-2.5 px-2 text-center rounded">
                        <div className="rounded-lg py-1" style={{ background: `rgba(17,17,17,${opacity})` }}>
                          <span className={`text-[11px] font-bold ${pct > 50 ? "text-white" : "text-[#374151]"}`}>
                            {pct > 0 ? `${pct}%` : "—"}
                          </span>
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-[13px] text-[#9CA3AF]">Not enough data yet. Cohort analysis requires users across multiple weeks.</p>
        )}
      </div>
 
      {/* Question analytics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Lowest scoring */}
        <div className="rounded-2xl border border-[#E5E7EB] bg-white p-5">
          <p className="text-[11px] font-black uppercase tracking-widest text-[#9CA3AF] mb-4">Lowest Scoring Questions</p>
          {qAnalytics?.lowest_scoring_questions?.length > 0 ? (
            <div className="space-y-2">
              {qAnalytics.lowest_scoring_questions.slice(0, 6).map((q: any) => (
                <div key={q.id} className="flex items-start gap-2">
                  <span className="text-[12px] text-rose-500 font-black flex-shrink-0">{q.avg_score}</span>
                  <p className="text-[12px] text-[#374151] line-clamp-1">{q.question_text}</p>
                </div>
              ))}
            </div>
          ) : <p className="text-[13px] text-[#9CA3AF]">No scored answers yet</p>}
        </div>
 
        {/* Never served */}
        <div className="rounded-2xl border border-[#E5E7EB] bg-white p-5">
          <p className="text-[11px] font-black uppercase tracking-widest text-[#9CA3AF] mb-1">
            Never Asked Questions
          </p>
          <p className="text-[12px] text-[#9CA3AF] mb-4">
            {qAnalytics?.never_served_questions?.length || 0} questions never used in any session
          </p>
          {qAnalytics?.never_served_questions?.length > 0 ? (
            <div className="space-y-1.5">
              {qAnalytics.never_served_questions.slice(0, 6).map((q: any) => (
                <p key={q.id} className="text-[12px] text-[#374151] line-clamp-1">· {q.question_text}</p>
              ))}
            </div>
          ) : <p className="text-[13px] text-[#9CA3AF]">All questions have been used</p>}
        </div>
 
        {/* Topic coverage */}
        <div className="rounded-2xl border border-[#E5E7EB] bg-white p-5 lg:col-span-2">
          <p className="text-[11px] font-black uppercase tracking-widest text-[#9CA3AF] mb-4">Topic Coverage</p>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {(qAnalytics?.topic_coverage || []).map((t: any) => (
              <div key={t.topic} className="rounded-xl border border-[#F3F4F6] p-3">
                <p className="text-[12px] font-bold text-[#111] truncate">{t.topic || "Unknown"}</p>
                <div className="flex gap-2 mt-1">
                  <span className="text-[11px] text-emerald-600">{t.active} active</span>
                  <span className="text-[11px] text-[#9CA3AF]">/{t.total}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        
        <div className="rounded-2xl border border-[#E5E7EB] bg-white p-6 lg:col-span-2">
          <p className="text-[11px] font-black uppercase tracking-widest text-[#9CA3AF] mb-5">
            Referral Program
          </p>
 
          
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            {[
              { label: "Signups via referral", value: referrals?.referred_signups ?? 0,
                sub: `${referrals?.referral_signup_pct ?? 0}% of all signups` },
              { label: "Rewarded referrals", value: referrals?.rewarded_referrals ?? 0,
                sub: "bonus sessions given" },
              { label: "Referred user activation", value: `${referrals?.referred_activation_pct ?? 0}%`,
                sub: "started a session" },
              { label: "Total users", value: referrals?.total_users ?? 0,
                sub: "for reference" },
            ].map((s) => (
              <div key={s.label} className="rounded-xl border border-[#F3F4F6] bg-[#FAFAF8] px-4 py-3">
                <p className="text-[20px] font-black text-[#111]">{s.value}</p>
                <p className="text-[11px] font-bold text-[#374151] mt-0.5">{s.label}</p>
                <p className="text-[10px] text-[#9CA3AF] mt-0.5">{s.sub}</p>
              </div>
            ))}
          </div>
 
          
          {referrals?.top_referrers?.length > 0 ? (
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-[#9CA3AF] mb-3">
                Top Referrers
              </p>
              <div className="space-y-1.5">
                {referrals.top_referrers.slice(0, 5).map((r: any, i: number) => (
                  <div key={i} className="flex items-center justify-between rounded-lg bg-[#FAFAF8] px-3 py-2">
                    <span className="text-[12px] font-medium text-[#374151]">{r.name}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-[11px] text-[#9CA3AF]">
                        {r.rewarded_count}/{r.referral_count} rewarded
                      </span>
                      <span className="text-[13px] font-black text-[#111]">{r.referral_count}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-[13px] text-[#9CA3AF]">No referrals yet</p>
          )}
        </div>

      </div>
    </div>
  );
}
 
export default AdminAnalyticsPage;