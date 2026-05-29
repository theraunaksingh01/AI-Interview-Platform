"use client";

import React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Menu, X, LayoutDashboard, Settings, LogOut, User } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";

const PUBLIC_NAV = [
  { name: "Features", href: "/features" },
  { name: "Pricing", href: "/pricing" },
  { name: "About", href: "/about" },
];

const APP_NAV = [
  { name: "Practice", href: "/mock" },
  { name: "Daily", href: "/daily" },
  { name: "Dashboard", href: "/mock/dashboard" },
  { name: "Pricing", href: "/pricing" },
];

export function Navbar() {
  const [menuState, setMenuState] = React.useState(false);
  const [isScrolled, setIsScrolled] = React.useState(false);
  const [userMenuOpen, setUserMenuOpen] = React.useState(false);
  const userMenuRef = React.useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout, loading } = useAuth();

  const isLoggedIn = !!user;
  const menuItems = isLoggedIn ? APP_NAV : PUBLIC_NAV;

  React.useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 50);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const original = document.body.style.overflow;
    if (menuState) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = original || "";
    }
    return () => { document.body.style.overflow = original || ""; };
  }, [menuState]);

  // Close user menu on outside click
  React.useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleLogout() {
    setUserMenuOpen(false);
    setMenuState(false);
    logout();
    router.push("/");
  }

  const userInitial = user
    ? (user.full_name || user.email || "U")[0].toUpperCase()
    : "U";

  const userPlan = user?.plan ?? "free";

  return (
    <header>
      <nav
        data-state={menuState ? "active" : undefined}
        className="fixed z-30 w-full px-2 top-0 left-0"
      >
        <div
          className={cn(
            "mx-auto mt-2 max-w-6xl px-6 transition-all duration-300 lg:px-12",
            isScrolled &&
              "bg-background/50 max-w-4xl rounded-2xl border backdrop-blur-lg lg:px-5"
          )}
        >
          <div className="relative flex flex-wrap items-center justify-between gap-6 py-3 lg:gap-0 lg:py-4">

            {/* Left — logo + mobile hamburger */}
            <div className="flex w-full justify-between lg:w-auto">
              <Link href="/" aria-label="home" className="flex items-center space-x-2">
                <span className="text-xl font-black tracking-tight">
                  Qu<span className="bg-yellow-400 text-black px-1 rounded-sm">ed</span>
                </span>
              </Link>

              <button
                onClick={() => setMenuState((s) => !s)}
                aria-expanded={menuState}
                aria-label={menuState ? "Close Menu" : "Open Menu"}
                className="relative z-20 -m-2.5 -mr-4 block cursor-pointer p-2.5 lg:hidden"
              >
                <span className={cn("block", menuState ? "hidden" : "block")}>
                  <Menu className="m-auto size-6" />
                </span>
                <span className={cn("absolute inset-0 m-auto size-6", menuState ? "block" : "hidden")}>
                  <X className="m-auto size-6" />
                </span>
              </button>
            </div>

            {/* Center — nav links desktop */}
            <div className="absolute inset-0 m-auto hidden size-fit lg:block">
              <ul className="flex gap-8 text-sm">
                {menuItems.map((item, index) => {
                  const active = pathname === item.href || pathname.startsWith(item.href + "/");
                  return (
                    <li key={index}>
                      <Link
                        href={item.href}
                        className={cn(
                          "block duration-150 text-sm font-medium",
                          active
                            ? "text-foreground"
                            : "text-muted-foreground hover:text-accent-foreground"
                        )}
                      >
                        {item.name}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>

            {/* Right — auth buttons or user menu */}
            <div className="bg-background mb-6 hidden w-full flex-wrap items-center justify-end rounded-3xl border p-6 shadow-2xl shadow-zinc-300/20 md:flex-nowrap lg:m-0 lg:flex lg:w-fit lg:gap-6 lg:space-y-0 lg:border-transparent lg:bg-transparent lg:p-0 lg:shadow-none dark:shadow-none dark:lg:bg-transparent">
              <div className="hidden lg:flex lg:items-center lg:gap-3">

                {loading ? (
                  <div className="h-8 w-8 animate-pulse rounded-full bg-gray-200" />
                ) : isLoggedIn ? (
                  <>
                    {/* Plan badge */}
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

                    {/* User avatar + dropdown */}
                    <div className="relative" ref={userMenuRef}>
                      <button
                        onClick={() => setUserMenuOpen((v) => !v)}
                        className="flex h-8 w-8 items-center justify-center rounded-full bg-[#F3F4F6] text-[13px] font-bold text-[#374151] hover:bg-[#E5E7EB] transition select-none"
                      >
                        {userInitial}
                      </button>

                      {userMenuOpen && (
                        <div className="absolute right-0 top-10 w-52 rounded-xl border border-[#E5E7EB] bg-white py-1.5 shadow-lg animate-slide-in">
                          {/* User info */}
                          <div className="border-b border-[#F3F4F6] px-4 py-2.5 mb-1">
                            <p className="text-[13px] font-semibold text-[#111] truncate">
                              {user.full_name || user.email}
                            </p>
                            <p className="text-[11px] text-[#9CA3AF] truncate">{user.email}</p>
                          </div>

                          <Link
                            href="/mock/dashboard"
                            onClick={() => setUserMenuOpen(false)}
                            className="flex items-center gap-2.5 px-4 py-2 text-[13px] text-[#374151] hover:bg-[#F9FAFB] transition"
                          >
                            <LayoutDashboard className="h-4 w-4 text-[#9CA3AF]" />
                            Dashboard
                          </Link>

                          <Link
                            href="/mock"
                            onClick={() => setUserMenuOpen(false)}
                            className="flex items-center gap-2.5 px-4 py-2 text-[13px] text-[#374151] hover:bg-[#F9FAFB] transition"
                          >
                            <User className="h-4 w-4 text-[#9CA3AF]" />
                            Practice
                          </Link>

                          <Link
                            href="/settings"
                            onClick={() => setUserMenuOpen(false)}
                            className="flex items-center gap-2.5 px-4 py-2 text-[13px] text-[#374151] hover:bg-[#F9FAFB] transition"
                          >
                            <Settings className="h-4 w-4 text-[#9CA3AF]" />
                            Settings
                          </Link>

                          <div className="border-t border-[#F3F4F6] mt-1 pt-1">
                            <button
                              onClick={handleLogout}
                              className="flex w-full items-center gap-2.5 px-4 py-2 text-[13px] text-rose-600 hover:bg-rose-50 transition"
                            >
                              <LogOut className="h-4 w-4" />
                              Sign out
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  // Not logged in
                  !isScrolled ? (
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
                  )
                )}
              </div>
            </div>

          </div>
        </div>

        {/* Mobile menu */}
        {menuState && (
          <div className="lg:hidden">
            <div
              onClick={() => setMenuState(false)}
              className="fixed inset-0 z-20 bg-black/30 backdrop-blur-sm transition-opacity"
            />
            <div className="fixed inset-x-4 top-20 z-30 rounded-2xl border bg-background p-6 shadow-xl animate-slide-in">
              <div className="space-y-6">
                <ul className="space-y-4 text-base">
                  {menuItems.map((item, index) => (
                    <li key={index}>
                      <Link
                        href={item.href}
                        onClick={() => setMenuState(false)}
                        className="block text-lg font-medium"
                      >
                        {item.name}
                      </Link>
                    </li>
                  ))}
                </ul>

                {isLoggedIn ? (
                  <div className="space-y-2 border-t border-[#F3F4F6] pt-4">
                    {/* User info */}
                    <div className="flex items-center gap-3 mb-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#F3F4F6] text-[14px] font-bold text-[#374151]">
                        {userInitial}
                      </div>
                      <div>
                        <p className="text-[13px] font-semibold text-[#111]">
                          {user.full_name || user.email}
                        </p>
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

                    <Link
                      href="/settings"
                      onClick={() => setMenuState(false)}
                      className="flex items-center gap-2 text-[14px] text-[#374151] py-1"
                    >
                      <Settings className="h-4 w-4 text-[#9CA3AF]" />
                      Settings
                    </Link>

                    <button
                      onClick={handleLogout}
                      className="flex items-center gap-2 text-[14px] text-rose-600 py-1 w-full"
                    >
                      <LogOut className="h-4 w-4" />
                      Sign out
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3">
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
          to { transform: translateY(0); opacity: 1; }
        }
        .animate-slide-in {
          animation: slideIn 220ms cubic-bezier(0.2, 0.9, 0.2, 1);
        }
      `}</style>
    </header>
  );
}