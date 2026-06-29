"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { BarChart, Bar, ResponsiveContainer, Tooltip, Cell } from "recharts";


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

function StatCard({ label, value, sub, accent = false }: {
    label: string; value: string | number; sub?: string; accent?: boolean;
}) {
    return (
        <div className={`rounded-2xl p-5 ${accent ? "bg-[#111] text-white" : "bg-white border border-[#E5E7EB]"}`}>
            <p className={`text-[28px] font-black tracking-tight ${accent ? "text-white" : "text-[#111]"}`}>{value}</p>
            <p className={`text-[13px] font-bold mt-0.5 ${accent ? "text-white/80" : "text-[#374151]"}`}>{label}</p>
            {sub && <p className={`text-[11px] mt-0.5 ${accent ? "text-white/40" : "text-[#9CA3AF]"}`}>{sub}</p>}
        </div>
    );
}


function MiniBar({ data, color = "#111" }: { data: { day: string; count: number }[]; color?: string }) {
    const today = new Date();
    const filled = Array.from({ length: 14 }, (_, i) => {
        const d = new Date(today);
        d.setDate(d.getDate() - (13 - i));
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        const found = (data || []).find(r => (r.day || "").slice(0, 10) === key);
        return {
            day: key.slice(5), // "06-15" format for tooltip
            count: found?.count || 0,
        };
    });

    const hasData = filled.some(d => d.count > 0);

    if (!hasData) return (
        <div className="h-12 flex items-center">
            <p className="text-[11px] text-[#9CA3AF]">No data yet</p>
        </div>
    );

    return (
        <ResponsiveContainer width="100%" height={48}>
            <BarChart data={filled} barSize={12} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                <Tooltip
                    cursor={false}
                    contentStyle={{
                        background: "#111",
                        border: "none",
                        borderRadius: "8px",
                        padding: "4px 8px",
                        fontSize: "11px",
                        color: "white",
                    }}
                    formatter={(val: any) => [val, "count"]}
                    labelFormatter={(label) => label}
                />
                <Bar dataKey="count" radius={[3, 3, 0, 0]} minPointSize={3}>
                    {filled.map((entry, i) => (
                        <Cell
                            key={i}
                            fill={entry.count > 0 ? color : "#F3F4F6"}
                            fillOpacity={entry.count > 0 ? 0.4 + (i / 14) * 0.6 : 0.5}
                        />
                    ))}
                </Bar>
            </BarChart>
        </ResponsiveContainer>
    );
}

function FunnelBar({ stage, count, pct, max }: { stage: string; count: number; pct: number; max: number }) {
    return (
        <div className="flex items-center gap-3">
            <div className="w-36 text-[12px] text-[#374151] font-medium truncate">{stage}</div>
            <div className="flex-1 h-2 rounded-full bg-[#F3F4F6] overflow-hidden">
                <div className="h-full rounded-full bg-[#111] transition-all duration-700"
                    style={{ width: `${(count / max) * 100}%` }} />
            </div>
            <div className="w-16 text-right">
                <span className="text-[13px] font-black text-[#111]">{count}</span>
                <span className="text-[11px] text-[#9CA3AF] ml-1">{pct}%</span>
            </div>
        </div>
    );
}

export default function AdminOverview() {
    const { data, loading } = useAdminFetch("/api/admin/overview");
    const { data: funnel } = useAdminFetch("/api/admin/analytics/funnel");
    const [period, setPeriod] = useState<"today" | "week" | "month">("today");

    if (loading) return (
        <div className="space-y-4">
            {[...Array(4)].map((_, i) => (
                <div key={i} className="h-24 rounded-2xl bg-white border border-[#E5E7EB] animate-pulse" />
            ))}
        </div>
    );

    const p = data?.[period] || {};
    const activeUsers = period === "today" ? (p.active_users ?? 0) : "—";
    const t = data?.totals || {};
    const funnelData = funnel?.funnel || [];
    const funnelMax = funnelData[0]?.count || 1;

    const planColors: Record<string, string> = {
        free: "#9CA3AF",
        pro: "#1D4ED8",
        max: "#111",
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-start justify-between">
                <div>
                    <p className="text-[11px] font-black uppercase tracking-widest text-[#9CA3AF] mb-1">Admin Panel</p>
                    <h1 className="text-[28px] font-black text-[#111]" style={{ letterSpacing: "-0.5px" }}>Overview</h1>
                    <p className="text-[13px] text-[#6B7280] mt-0.5">
                        {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}
                    </p>
                </div>
                {/* Period switcher */}
                <div className="flex rounded-xl border border-[#E5E7EB] bg-white overflow-hidden">
                    {(["today", "week", "month"] as const).map(tab => (
                        <button key={tab} onClick={() => setPeriod(tab)}
                            className={`px-3 py-1.5 text-[12px] font-bold capitalize transition-colors ${period === tab ? "bg-[#111] text-white" : "text-[#6B7280] hover:bg-[#F9FAFB]"
                                }`}>
                            {tab}
                        </button>
                    ))}
                </div>
            </div>

            {/* Period stat cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <StatCard label="New Users" value={p.new_users ?? 0} sub={`${t.users} total`} accent />
                <StatCard label="Mock Sessions" value={p.sessions ?? 0} sub={`${t.sessions} total`} />
                <StatCard label="DSA Attempts" value={p.dsa_attempts ?? 0} sub={`${t.dsa_attempts} total`} />
                <StatCard label="Active Users" value={activeUsers} sub="used any feature" />      </div>

            {/* Totals row */}
            <div className="grid grid-cols-3 lg:grid-cols-6 gap-3">
                {[
                    { label: "Questions", value: t.interview_questions },
                    { label: "DSA Problems", value: t.dsa_questions },
                    { label: "Peer Rooms", value: t.peer_rooms },
                    { label: "Rooms Done", value: t.peer_rooms_completed },
                    { label: "Avg Score", value: t.avg_session_score ? `${t.avg_session_score}/100` : "—" },
                    { label: "Users Total", value: t.users },
                ].map(s => (
                    <div key={s.label} className="rounded-xl border border-[#E5E7EB] bg-white px-4 py-3">
                        <p className="text-[18px] font-black text-[#111]">{s.value ?? 0}</p>
                        <p className="text-[10px] text-[#9CA3AF] mt-0.5 uppercase tracking-wide">{s.label}</p>
                    </div>
                ))}
            </div>

            {/* Charts row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Signup trend */}
                <div className="rounded-2xl border border-[#E5E7EB] bg-white p-5">
                    <p className="text-[11px] font-black uppercase tracking-widest text-[#9CA3AF] mb-1">Signups</p>
                    <p className="text-[22px] font-black text-[#111] mb-3">{data?.month?.new_users ?? 0} this month</p>
                    <MiniBar data={data?.signup_trend || []} color="#111" />
                </div>

                {/* Session trend */}
                <div className="rounded-2xl border border-[#E5E7EB] bg-white p-5">
                    <p className="text-[11px] font-black uppercase tracking-widest text-[#9CA3AF] mb-1">Sessions</p>
                    <p className="text-[22px] font-black text-[#111] mb-3">{data?.month?.sessions ?? 0} this month</p>
                    <MiniBar data={data?.session_trend || []} color="#1D4ED8" />
                </div>

                {/* DSA trend */}
                <div className="rounded-2xl border border-[#E5E7EB] bg-white p-5">
                    <p className="text-[11px] font-black uppercase tracking-widest text-[#9CA3AF] mb-1">DSA Attempts</p>
                    <p className="text-[22px] font-black text-[#111] mb-3">{data?.month?.dsa_attempts ?? 0} this month</p>
                    <MiniBar data={data?.dsa_trend || []} color="#5B21B6" />
                </div>
            </div>

            {/* Bottom row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Plan distribution */}
                <div className="rounded-2xl border border-[#E5E7EB] bg-white p-5">
                    <p className="text-[11px] font-black uppercase tracking-widest text-[#9CA3AF] mb-4">Plan Distribution</p>
                    <div className="space-y-3">
                        {(data?.plan_distribution || []).map((p: any) => (
                            <div key={p.plan} className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <div className="h-2 w-2 rounded-full" style={{ background: planColors[p.plan] || "#9CA3AF" }} />
                                    <span className="text-[13px] font-bold text-[#111] capitalize">{p.plan}</span>
                                </div>
                                <span className="text-[13px] font-black text-[#111]">{p.count}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Top companies */}
                <div className="rounded-2xl border border-[#E5E7EB] bg-white p-5">
                    <p className="text-[11px] font-black uppercase tracking-widest text-[#9CA3AF] mb-4">Top Target Companies</p>
                    <div className="space-y-2">
                        {(data?.top_companies || []).slice(0, 6).map((c: any, i: number) => (
                            <div key={c.target_company} className="flex items-center justify-between">
                                <span className="text-[12px] text-[#374151]">{c.target_company}</span>
                                <span className="text-[12px] font-black text-[#111]">{c.count}</span>
                            </div>
                        ))}
                        {!(data?.top_companies?.length) && (
                            <p className="text-[12px] text-[#9CA3AF]">No sessions yet</p>
                        )}
                    </div>
                </div>

                {/* Drop-off funnel */}
                <div className="rounded-2xl border border-[#E5E7EB] bg-white p-5">
                    <p className="text-[11px] font-black uppercase tracking-widest text-[#9CA3AF] mb-4">Conversion Funnel</p>
                    <div className="space-y-3">
                        {funnelData.map((f: any) => (
                            <FunnelBar key={f.stage} stage={f.stage} count={f.count} pct={f.pct} max={funnelMax} />
                        ))}
                    </div>
                </div>
            </div>

            {/* Quick links */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {[
                    { label: "Manage Users", href: "/admin/users", desc: `${t.users} total` },
                    { label: "Review Sessions", href: "/admin/sessions", desc: `${t.sessions} total` },
                    { label: "DSA Problems", href: "/admin/dsa", desc: `${t.dsa_questions} problems` },
                    { label: "Question Bank", href: "/admin/questions", desc: `${t.interview_questions} questions` },
                ].map(l => (
                    <Link key={l.href} href={l.href}
                        className="rounded-xl border border-[#E5E7EB] bg-white p-4 hover:border-[#D1D5DB] hover:shadow-sm transition-all group">
                        <p className="text-[13px] font-black text-[#111] group-hover:underline">{l.label} →</p>
                        <p className="text-[11px] text-[#9CA3AF] mt-0.5">{l.desc}</p>
                    </Link>
                ))}
            </div>
        </div>
    );
}