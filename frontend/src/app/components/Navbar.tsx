"use client";

import React from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { cn } from "@/lib/utils";

const menuItems = [
  { name: "Features", href: "#link" },
  { name: "Solution", href: "#link" },
  { name: "Pricing", href: "#link" },
  { name: "About", href: "#link" },
];

export function Navbar() {
  const [menuState, setMenuState] = React.useState(false);
  const [isScrolled, setIsScrolled] = React.useState(false);

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
    return () => {
      document.body.style.overflow = original || "";
    };
  }, [menuState]);

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
            <div className="flex w-full justify-between lg:w-auto">
              <Link
                href="/"
                aria-label="home"
                className="flex items-center space-x-2"
              >
                <span className="text-xl font-black tracking-tight">
                  Qu
                  <span className="bg-yellow-400 text-black px-1 rounded-sm">
                    ed
                  </span>
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
                <span
                  className={cn(
                    "absolute inset-0 m-auto size-6",
                    menuState ? "block" : "hidden"
                  )}
                >
                  <X className="m-auto size-6" />
                </span>
              </button>
            </div>

            {/* Center nav links — desktop */}
            <div className="absolute inset-0 m-auto hidden size-fit lg:block">
              <ul className="flex gap-8 text-sm">
                {menuItems.map((item, index) => (
                  <li key={index}>
                    <Link
                      href={item.href}
                      className="text-muted-foreground hover:text-accent-foreground block duration-150"
                    >
                      <span>{item.name}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Right buttons — desktop */}
            <div className="bg-background mb-6 hidden w-full flex-wrap items-center justify-end rounded-3xl border p-6 shadow-2xl shadow-zinc-300/20 md:flex-nowrap lg:m-0 lg:flex lg:w-fit lg:gap-6 lg:space-y-0 lg:border-transparent lg:bg-transparent lg:p-0 lg:shadow-none dark:shadow-none dark:lg:bg-transparent">
              <div className="hidden lg:flex lg:items-center lg:gap-4">
                {!isScrolled ? (
                  <>
                    <Button asChild variant="outline" size="sm">
                      <Link href="/login">
                        <span>Login</span>
                      </Link>
                    </Button>
                    <Button asChild size="sm">
                      <Link href="/signup">
                        <span>Sign Up</span>
                      </Link>
                    </Button>
                  </>
                ) : (
                  <Button asChild size="sm">
                    <Link href="/login">
                      <span>Get Started</span>
                    </Link>
                  </Button>
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
                <div className="flex flex-col gap-3">
                  <Button
                    asChild
                    variant="outline"
                    size="sm"
                    onClick={() => setMenuState(false)}
                  >
                    <Link href="/login">
                      <span>Login</span>
                    </Link>
                  </Button>
                  <Button
                    asChild
                    size="sm"
                    onClick={() => setMenuState(false)}
                  >
                    <Link href="/signup">
                      <span>Sign Up</span>
                    </Link>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </nav>

      <style jsx>{`
        @keyframes slideIn {
          from {
            transform: translateY(-8px);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
        .animate-slide-in {
          animation: slideIn 220ms cubic-bezier(0.2, 0.9, 0.2, 1);
        }
      `}</style>
    </header>
  );
}