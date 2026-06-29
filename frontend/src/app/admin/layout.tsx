"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

const NAV = [
  { label: "Overview",       href: "/admin",                  icon: "◈" },
  { label: "Users",          href: "/admin/users",            icon: "◉" },
  { label: "Mock Sessions",  href: "/admin/sessions",         icon: "◎" },
  { label: "DSA Practice",   href: "/admin/dsa",              icon: "⌘" },
  { label: "Question Bank",  href: "/admin/questions",        icon: "≡" },
  { label: "Quick Prep",     href: "/admin/quick-prep",       icon: "⚡" },
  { label: "Peer Practice",  href: "/admin/peer",             icon: "⇄" },
  { label: "Daily Challenge", href: "/admin/daily",           icon: "◷" },
  { label: "Cheat Sheet",    href: "/admin/cheat-sheet",      icon: "⊞" },
  { label: "Analytics",      href: "/admin/analytics",        icon: "∿" },
  { label: "System",         href: "/admin/system",           icon: "⊙" },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(
    typeof window !== "undefined" && window.innerWidth < 1024
  );

  useEffect(() => {
    if (!loading && user && !user.is_superuser) {
      router.replace("/");
    }
  }, [user, loading]);

  if (loading) return (
    <div className="min-h-screen bg-[#F5F5F3] flex items-center justify-center">
      <div className="text-[13px] text-[#9CA3AF]">Loading...</div>
    </div>
  );

  if (!user?.is_superuser) return null;

  return (
<div className="flex min-h-screen bg-[#F5F5F3] font-sans" style={{ position: "fixed", inset: 0, zIndex: 50, overflowY: "auto" }}>      {/* Sidebar */}
      <aside className={`flex flex-col bg-[#111] text-white flex-shrink-0 transition-all duration-200 ${collapsed ? "w-[56px]" : "w-[220px]"}`}
        style={{ position: "fixed", top: 0, left: 0, height: "100vh", zIndex: 40 }}>

        {/* Logo */}
        <div className="flex items-center justify-between px-4 py-5 border-b border-white/10">
          {!collapsed && (
            <span className="text-[15px] font-black tracking-tight">
              Qu<span className="bg-yellow-400 text-black px-1 rounded-sm">ed</span>
              <span className="text-[10px] font-normal text-white/40 ml-2">admin</span>
            </span>
          )}
          <button onClick={() => setCollapsed(v => !v)}
            className="text-white/40 hover:text-white transition text-[16px] ml-auto">
            {collapsed ? "→" : "←"}
          </button>
        </div>

        {/* Nav links */}
        <nav className="flex-1 py-4 overflow-y-auto">
          {NAV.map(item => {
            const active = item.href === "/admin"
              ? pathname === "/admin"
              : pathname.startsWith(item.href);
            return (
              <Link key={item.href} href={item.href}
                className={`flex items-center gap-3 px-4 py-2.5 text-[13px] font-medium transition-colors ${
                  active
                    ? "bg-white/10 text-white"
                    : "text-white/50 hover:text-white hover:bg-white/5"
                }`}>
                <span className="text-[16px] flex-shrink-0 w-5 text-center">{item.icon}</span>
                {!collapsed && <span className="truncate">{item.label}</span>}
                {active && !collapsed && (
                  <span className="ml-auto h-1.5 w-1.5 rounded-full bg-yellow-400 flex-shrink-0" />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Bottom — back to app */}
        <div className="border-t border-white/10 p-4">
          <Link href="/mock/dashboard"
            className={`flex items-center gap-3 text-[12px] text-white/40 hover:text-white transition ${collapsed ? "justify-center" : ""}`}>
            <span>↗</span>
            {!collapsed && <span>Back to app</span>}
          </Link>
        </div>
      </aside>

      {/* Main content */}
      <main className={`flex-1 min-h-screen transition-all duration-200 ${collapsed ? "ml-[56px]" : "ml-[220px]"}`}>
        <div className="p-6 max-w-[1400px]">
          {children}
        </div>
      </main>
    </div>
  );
}