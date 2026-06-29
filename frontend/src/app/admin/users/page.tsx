"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

const API = (process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:8000").replace(/\/$/, "");

const PLAN_STYLES: Record<string, string> = {
  free: "bg-[#F3F4F6] text-[#6B7280]",
  pro: "bg-[#DBEAFE] text-[#1D4ED8]",
  max: "bg-[#111] text-white",
};

export default function AdminUsersPage() {
  const { authHeader } = useAuth();
  const [users, setUsers] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [planFilter, setPlanFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [userDetail, setUserDetail] = useState<any>(null);
  const [updatingPlan, setUpdatingPlan] = useState(false);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({
      page: String(page),
      per_page: "20",
      ...(search && { search }),
      ...(planFilter && { plan: planFilter }),
    });
    const res = await fetch(`${API}/api/admin/users?${params}`, { headers: authHeader() });
    const data = await res.json();
    setUsers(data.users || []);
    setTotal(data.total || 0);
    setPages(data.pages || 1);
    setLoading(false);
  }, [page, search, planFilter]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const openUser = async (user: any) => {
    setSelectedUser(user);
    const res = await fetch(`${API}/api/admin/users/${user.id}`, { headers: authHeader() });
    const data = await res.json();
    setUserDetail(data);
  };

  const updatePlan = async (userId: number, plan: string) => {
    setUpdatingPlan(true);
    await fetch(`${API}/api/admin/users/${userId}`, {
      method: "PATCH",
      headers: { ...authHeader(), "Content-Type": "application/json" },
      body: JSON.stringify({ plan }),
    });
    setUpdatingPlan(false);
    fetchUsers();
    if (userDetail) {
      setUserDetail({ ...userDetail, user: { ...userDetail.user, plan } });
    }
  };

  const toggleActive = async (userId: number, is_active: boolean) => {
    await fetch(`${API}/api/admin/users/${userId}`, {
      method: "PATCH",
      headers: { ...authHeader(), "Content-Type": "application/json" },
      body: JSON.stringify({ is_active }),
    });
    fetchUsers();
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <p className="text-[11px] font-black uppercase tracking-widest text-[#9CA3AF] mb-1">Admin</p>
        <h1 className="text-[28px] font-black text-[#111]" style={{ letterSpacing: "-0.5px" }}>Users</h1>
        <p className="text-[13px] text-[#6B7280]">{total} total users</p>
      </div>

      <div className="flex gap-6">
        {/* Table panel */}
        <div className="flex-1 min-w-0">
          {/* Search + filter */}
          <div className="flex gap-2 mb-4">
            <input
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search by name, email, college..."
              className="flex-1 rounded-xl border border-[#E5E7EB] bg-white px-3 py-2 text-[13px] outline-none focus:border-[#111] transition"
            />
            <select value={planFilter} onChange={e => { setPlanFilter(e.target.value); setPage(1); }}
              className="rounded-xl border border-[#E5E7EB] bg-white px-3 py-2 text-[13px] outline-none focus:border-[#111] transition">
              <option value="">All plans</option>
              <option value="free">Free</option>
              <option value="pro">Pro</option>
              <option value="max">Max</option>
            </select>
          </div>

          {/* Table */}
          <div className="rounded-2xl border border-[#E5E7EB] bg-white overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#F3F4F6]">
                  {["User", "Plan", "College", "Sessions", "DSA Solved", "Joined", ""].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-[#9CA3AF]">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  [...Array(8)].map((_, i) => (
                    <tr key={i} className="border-b border-[#F9FAFB]">
                      {[...Array(7)].map((_, j) => (
                        <td key={j} className="px-4 py-3">
                          <div className="h-4 rounded bg-[#F3F4F6] animate-pulse" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : users.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-[13px] text-[#9CA3AF]">
                      No users found
                    </td>
                  </tr>
                ) : (
                  users.map(u => (
                    <tr key={u.id}
                      onClick={() => openUser(u)}
                      className={`border-b border-[#F9FAFB] cursor-pointer transition-colors ${
                        selectedUser?.id === u.id ? "bg-[#FFFDF0]" : "hover:bg-[#F9FAFB]"
                      }`}>
                      <td className="px-4 py-3">
                        <p className="text-[13px] font-bold text-[#111] truncate max-w-[160px]">
                          {u.full_name || "—"}
                        </p>
                        <p className="text-[11px] text-[#9CA3AF] truncate max-w-[160px]">{u.email}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase ${PLAN_STYLES[u.plan] || ""}`}>
                          {u.plan}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[12px] text-[#374151] max-w-[120px] truncate">
                        {u.college || "—"}
                      </td>
                      <td className="px-4 py-3 text-[13px] font-black text-[#111]">{u.session_count}</td>
                      <td className="px-4 py-3 text-[13px] font-black text-[#111]">{u.dsa_solved}</td>
                      <td className="px-4 py-3 text-[11px] text-[#9CA3AF]">
                        {u.created_at ? new Date(u.created_at).toLocaleDateString("en-IN") : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-[11px] text-[#9CA3AF]">→</span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>

            {/* Pagination */}
            {pages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-[#F3F4F6]">
                <p className="text-[12px] text-[#9CA3AF]">Page {page} of {pages}</p>
                <div className="flex gap-2">
                  <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                    className="rounded-lg border border-[#E5E7EB] px-3 py-1 text-[12px] font-medium disabled:opacity-40 hover:bg-[#F9FAFB] transition">
                    ← Prev
                  </button>
                  <button onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={page === pages}
                    className="rounded-lg border border-[#E5E7EB] px-3 py-1 text-[12px] font-medium disabled:opacity-40 hover:bg-[#F9FAFB] transition">
                    Next →
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* User detail side panel */}
        {selectedUser && (
          <div className="w-[320px] flex-shrink-0">
            <div className="rounded-2xl border border-[#E5E7EB] bg-white p-5 sticky top-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <p className="text-[15px] font-black text-[#111]">{selectedUser.full_name || "No name"}</p>
                  <p className="text-[12px] text-[#9CA3AF]">{selectedUser.email}</p>
                </div>
                <button onClick={() => { setSelectedUser(null); setUserDetail(null); }}
                  className="text-[#9CA3AF] hover:text-[#111] text-[16px] transition">✕</button>
              </div>

              {/* Plan changer */}
              <div className="mb-4">
                <p className="text-[10px] font-black uppercase tracking-widest text-[#9CA3AF] mb-2">Plan</p>
                <div className="flex gap-2">
                  {["free", "pro", "max"].map(plan => (
                    <button key={plan}
                      onClick={() => updatePlan(selectedUser.id, plan)}
                      disabled={updatingPlan}
                      className={`flex-1 rounded-lg py-1.5 text-[11px] font-black uppercase transition ${
                        (userDetail?.user?.plan || selectedUser.plan) === plan
                          ? plan === "max" ? "bg-[#111] text-white" : plan === "pro" ? "bg-[#DBEAFE] text-[#1D4ED8]" : "bg-[#F3F4F6] text-[#374151]"
                          : "border border-[#E5E7EB] text-[#9CA3AF] hover:border-[#111] hover:text-[#111]"
                      }`}>
                      {plan}
                    </button>
                  ))}
                </div>
              </div>

              {/* Stats */}
              {userDetail ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-xl bg-[#F9FAFB] p-3">
                      <p className="text-[18px] font-black text-[#111]">{userDetail.sessions?.length || 0}</p>
                      <p className="text-[10px] text-[#9CA3AF]">Sessions</p>
                    </div>
                    <div className="rounded-xl bg-[#F9FAFB] p-3">
                      <p className="text-[18px] font-black text-[#111]">{userDetail.dsa_stats?.unique_solved || 0}</p>
                      <p className="text-[10px] text-[#9CA3AF]">DSA Solved</p>
                    </div>
                    <div className="rounded-xl bg-[#F9FAFB] p-3">
                      <p className="text-[18px] font-black text-[#111]">{userDetail.quick_prep_count || 0}</p>
                      <p className="text-[10px] text-[#9CA3AF]">Quick Prep</p>
                    </div>
                    <div className="rounded-xl bg-[#F9FAFB] p-3">
                      <p className="text-[18px] font-black text-[#111]">{userDetail.daily_stats?.total_daily || 0}</p>
                      <p className="text-[10px] text-[#9CA3AF]">Daily Challenges</p>
                    </div>
                  </div>

                  {/* Profile info */}
                  <div className="border-t border-[#F3F4F6] pt-3 space-y-1.5">
                    {[
                      ["College", userDetail.user?.college],
                      ["Branch", userDetail.user?.branch],
                      ["Year", userDetail.user?.year_of_study],
                      ["Level", userDetail.user?.self_level],
                      ["Goal", userDetail.user?.placement_goal],
                    ].map(([label, val]) => val && (
                      <div key={label as string} className="flex gap-2">
                        <span className="text-[10px] text-[#9CA3AF] w-14 flex-shrink-0 pt-0.5">{label}</span>
                        <span className="text-[12px] text-[#374151]">{val}</span>
                      </div>
                    ))}
                  </div>

                  {/* Recent sessions */}
                  {userDetail.sessions?.length > 0 && (
                    <div className="border-t border-[#F3F4F6] pt-3">
                      <p className="text-[10px] font-black uppercase tracking-widest text-[#9CA3AF] mb-2">Recent Sessions</p>
                      <div className="space-y-1.5">
                        {userDetail.sessions.slice(0, 4).map((s: any) => (
                          <div key={s.id} className="flex items-center justify-between">
                            <span className="text-[12px] text-[#374151] truncate max-w-[160px]">
                              {s.target_company || s.session_type || "Mock"}
                            </span>
                            <span className="text-[12px] font-black text-[#111]">
                              {s.overall_score != null ? `${Math.round(s.overall_score)}/100` : "—"}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Deactivate */}
                  <div className="border-t border-[#F3F4F6] pt-3">
                    <button
                      onClick={() => toggleActive(selectedUser.id, !userDetail.user?.is_active)}
                      className={`w-full rounded-xl py-2 text-[12px] font-black transition ${
                        userDetail.user?.is_active
                          ? "bg-rose-50 text-rose-600 hover:bg-rose-100"
                          : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                      }`}>
                      {userDetail.user?.is_active ? "Deactivate Account" : "Reactivate Account"}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className="h-12 rounded-xl bg-[#F3F4F6] animate-pulse" />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}