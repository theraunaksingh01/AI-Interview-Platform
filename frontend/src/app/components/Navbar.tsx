"use client";

import React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Menu, X, LayoutDashboard, Settings, LogOut, User, Calendar, Zap, BookOpen, Award } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";

// ── Dropdown configs ──────────────────────────────────────────────────────────

const PRACTICE_ITEMS = [
  { name: "Mock Interview",  href: "/mock",          icon: "🎤", desc: "Full interview simulation, scored" },
  { name: "Topic Practice",  href: "/topic-practice", icon: "📊", desc: "Drill one subject deep" },
  { name: "Quick Prep",      href: "/quick-prep",     icon: "☕", desc: "Rapid revision before interview" },
  { name: "Resume Prep",     href: "/resume-prep",    icon: "📄", desc: "Questions from YOUR resume" },
  { name: "DSA Practice",    href: "/dsa",            icon: "💻", desc: "185 problems, company-focused" },
  { name: "Peer Practice",   href: "/peer",           icon: "⚔️", desc: "Challenge a friend, compare scores" },
];

const DIAGNOSTICS_ITEMS = [
  {
    name: "Readiness Assessment",
    href: "/assessment",
    icon: "📊",
    desc: "30-min diagnostic across aptitude, CS, DSA & communication",
    badge: null,
    badgeColor: "#FFD600",
    badgeText: "#7A6000",
  },
  {
    name: "OA Practice Tests",
    href: "/oa-practice",
    icon: "📝",
    desc: "Practice real online assessments",
    badge: null,
    badgeColor: "#6366F1",
    badgeText: "white",
  },
  {
    name: "Company Guides",
    href: "/companies",
    icon: "🏢",
    desc: "Interview patterns, round breakdowns for top companies",
    badge: null,
    badgeColor: "",
    badgeText: "",
  },
  {
    name: "Cheat Sheet",
    href: "/cheat-sheet",
    icon: "⚡",
    desc: "Quick reference for CS fundamentals before your interview",
    badge: null,
    badgeColor: "",
    badgeText: "",
  },
];

// Top-level nav for logged-in users
const APP_NAV = [
  { name: "Dashboard", href: "/mock/dashboard" },
  { name: "Pricing",   href: "/pricing" },
  { name: "Contact",   href: "/contact" },
];

// Public nav
const PUBLIC_NAV = [
  { name: "Features", href: "/features" },
  { name: "Pricing",  href: "/pricing" },
  { name: "About",    href: "/about" },
  { name: "Contact",  href: "/contact" },
];

// Items moved to avatar dropdown
const USER_MENU_EXTRAS = [
  { name: "Daily Challenge", href: "/daily",     icon: Zap },
  { name: "Calendar",        href: "/calendar",  icon: Calendar },
  { name: "Skill Passport",  href: "/passport",  icon: Award },
];

const ALL_PRACTICE_HREFS = PRACTICE_ITEMS.map(p => p.href);
const ALL_PREPARE_HREFS = DIAGNOSTICS_ITEMS.map(p => p.href);

// ── Dropdown panel ────────────────────────────────────────────────────────────

function DropdownPanel({
  items,
  onClose,
  footer,
}: {
  items: typeof PRACTICE_ITEMS | typeof DIAGNOSTICS_ITEMS;
  onClose: () => void;
  footer?: React.ReactNode;
}) {
  const pathname = usePathname();
  return (
    <div
      className="absolute left-0 top-9 z-50 rounded-2xl border border-[#E5E7EB] bg-white overflow-hidden"
      style={{
        width: 480,
        boxShadow: "0 8px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)",
      }}
    >
      <div className="grid grid-cols-2 p-2 gap-0.5">
        {items.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          const badge = (item as any).badge;
          const badgeColor = (item as any).badgeColor;
          const badgeText = (item as any).badgeText;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onClose}
              className={cn(
                "flex items-start gap-3 rounded-xl px-3.5 py-3 transition-colors group",
                active ? "bg-[#FFFDF0]" : "hover:bg-[#F9FAFB]"
              )}
            >
              <div className={cn(
                "flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl text-[17px] mt-0.5",
                active ? "bg-yellow-400" : "bg-[#F3F4F6] group-hover:bg-[#EEEEF0]"
              )}>
                {item.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <p className={cn(
                    "text-[13px] font-bold leading-tight",
                    active ? "text-[#111]" : "text-[#1C1C1E]"
                  )}>
                    {item.name}
                  </p>
                  {badge && (
                    <span style={{
                      background: badgeColor, color: badgeText,
                      fontSize: 9, fontWeight: 800, letterSpacing: "0.05em",
                      padding: "1px 6px", borderRadius: 99,
                    }}>
                      {badge}
                    </span>
                  )}
                  {active && <div className="h-1.5 w-1.5 rounded-full bg-yellow-400 flex-shrink-0" />}
                </div>
                <p className="text-[11px] text-[#9CA3AF] mt-0.5 leading-snug">{item.desc}</p>
              </div>
            </Link>
          );
        })}
      </div>
      {footer && (
        <div className="border-t border-[#F3F4F6] px-5 py-3 bg-[#FAFAF8]">
          {footer}
        </div>
      )}
    </div>
  );
}

// ── Chevron icon ──────────────────────────────────────────────────────────────

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      width="12" height="12" viewBox="0 0 12 12" fill="none"
      className={cn("transition-transform duration-200 mt-px", open ? "rotate-180" : "")}
    >
      <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5"
        strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ── Main Navbar ───────────────────────────────────────────────────────────────

export function Navbar() {
  const [menuState,      setMenuState]      = React.useState(false);
  const [isScrolled,     setIsScrolled]     = React.useState(false);
  const [userMenuOpen,   setUserMenuOpen]   = React.useState(false);
  const [practiceOpen,   setPracticeOpen]   = React.useState(false);
  const [prepareOpen,       setPrepareOpen]       = React.useState(false);

  const userMenuRef  = React.useRef<HTMLDivElement>(null);
  const practiceRef  = React.useRef<HTMLLIElement>(null);
  const prepareRef      = React.useRef<HTMLLIElement>(null);
  const pathname     = usePathname();
  const router       = useRouter();
  const { user, logout, loading } = useAuth();

  const isLoggedIn = !!user;
  const userPlan   = user?.plan ?? "free";
  const userInitial = user ? (user.full_name || user.email || "U")[0].toUpperCase() : "U";

  const practiceActive     = ALL_PRACTICE_HREFS.some(h => pathname === h || pathname.startsWith(h + "/"));
  const prepareActive  = ALL_PREPARE_HREFS.some(h => pathname === h || pathname.startsWith(h + "/"));

  // Close both dropdowns when other opens
  const openPractice = () => { setPracticeOpen(true); setPrepareOpen(false); };
  const openPrepare     = () => { setPrepareOpen(true); setPracticeOpen(false); };

  React.useEffect(() => {
    const onScroll = () => setIsScrolled(window.scrollY > 50);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const orig = document.body.style.overflow;
    document.body.style.overflow = menuState ? "hidden" : orig || "";
    return () => { document.body.style.overflow = orig || ""; };
  }, [menuState]);

  // Click outside handlers
  React.useEffect(() => {
    const fn = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) setUserMenuOpen(false);
    };
    document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, []);

  React.useEffect(() => {
    const fn = (e: MouseEvent) => {
      if (practiceRef.current && !practiceRef.current.contains(e.target as Node)) setPracticeOpen(false);
      if (prepareRef.current && !prepareRef.current.contains(e.target as Node)) setPrepareOpen(false);
    };
    document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, []);

  function handleLogout() {
    setUserMenuOpen(false);
    setMenuState(false);
    logout();
    router.push("/");
  }

  const navItems = isLoggedIn ? APP_NAV : PUBLIC_NAV;

  return (
    <header>
      <nav
        data-state={menuState ? "active" : undefined}
        className="fixed z-30 w-full px-2 top-0 left-0"
      >
        <div className={cn(
          "mx-auto mt-2 max-w-6xl px-6 transition-all duration-300 lg:px-12",
          isScrolled && "bg-background/50 max-w-4xl rounded-2xl border backdrop-blur-lg lg:px-5"
        )}>
          <div className="relative flex flex-wrap items-center justify-between gap-6 py-3 lg:gap-0 lg:py-4">

            {/* Logo + mobile toggle */}
            <div className="flex w-full justify-between lg:w-auto">
              <Link href="/" aria-label="home" className="flex items-center">
                <span className="text-xl font-black tracking-tight">
                  Qu<span className="bg-yellow-400 text-black px-1 rounded-sm">ed</span>
                </span>
              </Link>
              <button
                onClick={() => setMenuState(s => !s)}
                aria-expanded={menuState}
                className="relative z-20 -m-2.5 -mr-4 block cursor-pointer p-2.5 lg:hidden"
              >
                {menuState ? <X className="size-6" /> : <Menu className="size-6" />}
              </button>
            </div>

            {/* ── Desktop nav (centred) ── */}
            <div className="absolute inset-0 m-auto hidden size-fit lg:block">
              <ul className="flex gap-8 text-sm items-center">

                {/* Practice dropdown */}
                {isLoggedIn && (
                  <li className="relative" ref={practiceRef}>
                    <button
                      onClick={() => setPracticeOpen(v => !v)}
                      onMouseEnter={openPractice}
                      className={cn(
                        "flex items-center gap-1 text-sm font-medium select-none transition-colors",
                        practiceActive ? "text-foreground" : "text-muted-foreground hover:text-accent-foreground"
                      )}
                    >
                      Practice <Chevron open={practiceOpen} />
                    </button>
                    {practiceOpen && (
                      <div onMouseLeave={() => setPracticeOpen(false)}>
                        <DropdownPanel
                          items={PRACTICE_ITEMS}
                          onClose={() => setPracticeOpen(false)}
                          footer={
                            <div className="flex items-center justify-between">
                              <p className="text-[11px] text-[#9CA3AF]">Not sure where to start?</p>
                              <Link href="/mock" onClick={() => setPracticeOpen(false)}
                                className="text-[11px] font-black text-[#111] hover:underline">
                                Start a mock interview →
                              </Link>
                            </div>
                          }
                        />
                      </div>
                    )}
                  </li>
                )}

                {/* Prepare dropdown */}
                {isLoggedIn && (
                  <li className="relative" ref={prepareRef}>
                    <button
                      onClick={() => setPrepareOpen(v => !v)}
                      onMouseEnter={openPrepare}
                      className={cn(
                        "flex items-center gap-1 text-sm font-medium select-none transition-colors",
                        prepareActive ? "text-foreground" : "text-muted-foreground hover:text-accent-foreground"
                      )}
                    >
                      Prepare <Chevron open={prepareOpen} />
                    </button>
                    {prepareOpen && (
                      <div onMouseLeave={() => setPrepareOpen(false)}>
                        <DropdownPanel
                          items={DIAGNOSTICS_ITEMS}
                          onClose={() => setPrepareOpen(false)}
                          footer={
                            <div className="flex items-center justify-between">
                              <p className="text-[11px] text-[#9CA3AF]">Plan your placement preparation</p>
                              <Link href="/assessment" onClick={() => setPrepareOpen(false)}
                                className="text-[11px] font-black text-[#111] hover:underline">
                                Take free assessment →
                              </Link>
                            </div>
                          }
                        />
                      </div>
                    )}
                  </li>
                )}

                {/* Regular nav items */}
                {navItems.map((item, i) => {
                  const active = pathname === item.href || pathname.startsWith(item.href + "/");
                  return (
                    <li key={i}>
                      <Link
                        href={item.href}
                        className={cn(
                          "block text-sm font-medium transition-colors",
                          active ? "text-foreground" : "text-muted-foreground hover:text-accent-foreground"
                        )}
                      >
                        {item.name}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>

            {/* ── Right: auth ── */}
            <div className="hidden lg:flex lg:items-center lg:gap-3">
              {loading ? (
                <div className="h-8 w-8 animate-pulse rounded-full bg-gray-200" />
              ) : isLoggedIn ? (
                <>
                  {userPlan !== "free" && (
                    <span className={cn(
                      "rounded-full px-2.5 py-0.5 text-[11px] font-black",
                      userPlan === "max"
                        ? "bg-[#111] text-white"
                        : "bg-[#F3F4F6] text-[#374151] border border-[#E5E7EB]"
                    )}>
                      {userPlan.toUpperCase()}
                    </span>
                  )}

                  <div className="relative" ref={userMenuRef}>
                    <button
                      onClick={() => setUserMenuOpen(v => !v)}
                      className="flex h-8 w-8 items-center justify-center rounded-full bg-[#F3F4F6] text-[13px] font-bold text-[#374151] hover:bg-[#E5E7EB] transition select-none"
                    >
                      {userInitial}
                    </button>

                    {userMenuOpen && (
                      <div className="absolute right-0 top-10 w-56 rounded-xl border border-[#E5E7EB] bg-white py-1.5 shadow-lg animate-slide-in">
                        {/* User info */}
                        <div className="border-b border-[#F3F4F6] px-4 py-2.5 mb-1">
                          <p className="text-[13px] font-semibold text-[#111] truncate">
                            {user.full_name || user.email}
                          </p>
                          <p className="text-[11px] text-[#9CA3AF] truncate">{user.email}</p>
                        </div>

                        {/* Main links */}
                        <Link href="/mock/dashboard" onClick={() => setUserMenuOpen(false)}
                          className="flex items-center gap-2.5 px-4 py-2 text-[13px] text-[#374151] hover:bg-[#F9FAFB] transition">
                          <LayoutDashboard className="h-4 w-4 text-[#9CA3AF]" />
                          Dashboard
                        </Link>

                        {/* Secondary features moved here from top nav */}
                        <div className="border-t border-[#F3F4F6] my-1" />
                        <p className="px-4 py-1 text-[10px] font-black uppercase tracking-widest text-[#C4C4C4]">
                          More
                        </p>
                        {USER_MENU_EXTRAS.map(({ name, href, icon: Icon }) => (
                          <Link key={href} href={href} onClick={() => setUserMenuOpen(false)}
                            className="flex items-center gap-2.5 px-4 py-2 text-[13px] text-[#374151] hover:bg-[#F9FAFB] transition">
                            <Icon className="h-4 w-4 text-[#9CA3AF]" />
                            {name}
                          </Link>
                        ))}

                        {/* Bottom */}
                        <div className="border-t border-[#F3F4F6] mt-1 pt-1">
                          <Link href="/settings" onClick={() => setUserMenuOpen(false)}
                            className="flex items-center gap-2.5 px-4 py-2 text-[13px] text-[#374151] hover:bg-[#F9FAFB] transition">
                            <Settings className="h-4 w-4 text-[#9CA3AF]" />
                            Settings
                          </Link>
                          <button onClick={handleLogout}
                            className="flex w-full items-center gap-2.5 px-4 py-2 text-[13px] text-rose-600 hover:bg-rose-50 transition">
                            <LogOut className="h-4 w-4" />
                            Sign out
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </>
              ) : !isScrolled ? (
                <>
                  <Button asChild variant="outline" size="sm">
                    <Link href="/login"><span>Login</span></Link>
                  </Button>
                  <Button asChild size="sm">
                    <Link href="/signup"><span>Sign Up</span></Link>
                  </Button>
                </>
              ) : (
                <Button asChild size="sm">
                  <Link href="/login"><span>Get Started</span></Link>
                </Button>
              )}
            </div>

          </div>
        </div>

        {/* ── Mobile menu ── */}
        {menuState && (
          <div className="lg:hidden">
            <div
              onClick={() => setMenuState(false)}
              className="fixed inset-0 z-20 bg-black/30 backdrop-blur-sm"
            />
            <div className="fixed inset-x-4 top-20 z-30 rounded-2xl border bg-background p-6 shadow-xl animate-slide-in overflow-y-auto max-h-[80vh]">
              <div className="space-y-5">
                <ul className="space-y-1">

                  {/* Practice section */}
                  {isLoggedIn && (
                    <li>
                      <p className="text-[10px] font-black uppercase tracking-widest text-[#9CA3AF] mb-2 px-1">
                        Practice
                      </p>
                      <div className="space-y-0.5">
                        {PRACTICE_ITEMS.map(item => {
                          const active = pathname === item.href || pathname.startsWith(item.href + "/");
                          return (
                            <Link key={item.href} href={item.href} onClick={() => setMenuState(false)}
                              className={cn(
                                "flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors",
                                active ? "bg-[#FFFDF0]" : "hover:bg-[#F9FAFB]"
                              )}
                            >
                              <div className={cn(
                                "flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-[15px]",
                                active ? "bg-yellow-400" : "bg-[#F3F4F6]"
                              )}>
                                {item.icon}
                              </div>
                              <div>
                                <p className="text-[13px] font-bold text-[#111]">{item.name}</p>
                                <p className="text-[11px] text-[#9CA3AF]">{item.desc}</p>
                              </div>
                            </Link>
                          );
                        })}
                      </div>
                    </li>
                  )}

                  {/* Prepare section */}
                  {isLoggedIn && (
                    <li>
                      <p className="text-[10px] font-black uppercase tracking-widest text-[#9CA3AF] mb-2 px-1 mt-3">
                        Prepare
                      </p>
                      <div className="space-y-0.5">
                        {DIAGNOSTICS_ITEMS.map(item => {
                          const active = pathname === item.href || pathname.startsWith(item.href + "/");
                          const badge = (item as any).badge;
                          const badgeColor = (item as any).badgeColor;
                          const badgeText = (item as any).badgeText;
                          return (
                            <Link key={item.href} href={item.href} onClick={() => setMenuState(false)}
                              className={cn(
                                "flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors",
                                active ? "bg-[#FFFDF0]" : "hover:bg-[#F9FAFB]"
                              )}
                            >
                              <div className={cn(
                                "flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-[15px]",
                                active ? "bg-yellow-400" : "bg-[#F3F4F6]"
                              )}>
                                {item.icon}
                              </div>
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <p className="text-[13px] font-bold text-[#111]">{item.name}</p>
                                  {badge && (
                                    <span style={{
                                      background: badgeColor, color: badgeText,
                                      fontSize: 9, fontWeight: 800,
                                      padding: "1px 6px", borderRadius: 99,
                                    }}>
                                      {badge}
                                    </span>
                                  )}
                                </div>
                                <p className="text-[11px] text-[#9CA3AF]">{item.desc}</p>
                              </div>
                            </Link>
                          );
                        })}
                      </div>
                    </li>
                  )}

                  {isLoggedIn && <li className="border-t border-[#F3F4F6] my-2" />}

                  {/* Top-level links */}
                  {navItems.map((item, i) => (
                    <li key={i}>
                      <Link
                        href={item.href}
                        onClick={() => setMenuState(false)}
                        className={cn(
                          "block rounded-xl px-3 py-2 text-[14px] font-medium transition-colors",
                          pathname === item.href ? "bg-[#F9FAFB] text-[#111]" : "text-[#374151] hover:bg-[#F9FAFB]"
                        )}
                      >
                        {item.name}
                      </Link>
                    </li>
                  ))}
                </ul>

                {/* Auth section */}
                {isLoggedIn ? (
                  <div className="space-y-1 border-t border-[#F3F4F6] pt-4">
                    <div className="flex items-center gap-3 px-3 mb-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#F3F4F6] text-[14px] font-bold text-[#374151]">
                        {userInitial}
                      </div>
                      <div>
                        <p className="text-[13px] font-semibold text-[#111]">{user.full_name || user.email}</p>
                        {userPlan !== "free" && (
                          <span className={cn(
                            "rounded-full px-2 py-0.5 text-[10px] font-black",
                            userPlan === "max" ? "bg-[#111] text-white" : "bg-[#F3F4F6] text-[#374151]"
                          )}>
                            {userPlan.toUpperCase()}
                          </span>
                        )}
                      </div>
                    </div>

                    {USER_MENU_EXTRAS.map(({ name, href, icon: Icon }) => (
                      <Link key={href} href={href} onClick={() => setMenuState(false)}
                        className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-[14px] text-[#374151] hover:bg-[#F9FAFB] transition">
                        <Icon className="h-4 w-4 text-[#9CA3AF]" />
                        {name}
                      </Link>
                    ))}

                    <Link href="/settings" onClick={() => setMenuState(false)}
                      className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-[14px] text-[#374151] hover:bg-[#F9FAFB] transition">
                      <Settings className="h-4 w-4 text-[#9CA3AF]" />
                      Settings
                    </Link>
                    <button onClick={handleLogout}
                      className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-[14px] text-rose-600 hover:bg-rose-50 transition">
                      <LogOut className="h-4 w-4" />
                      Sign out
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3 border-t border-[#F3F4F6] pt-4">
                    <Button asChild variant="outline" size="sm" onClick={() => setMenuState(false)}>
                      <Link href="/login"><span>Login</span></Link>
                    </Button>
                    <Button asChild size="sm" onClick={() => setMenuState(false)}>
                      <Link href="/signup"><span>Sign Up</span></Link>
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </nav>

      <style jsx>{`
        @keyframes slideIn {
          from { transform: translateY(-8px); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
        }
        .animate-slide-in {
          animation: slideIn 220ms cubic-bezier(0.2, 0.9, 0.2, 1);
        }
      `}</style>
    </header>
  );
}