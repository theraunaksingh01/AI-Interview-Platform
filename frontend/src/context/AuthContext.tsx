"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { useRouter, usePathname } from "next/navigation";

const API_BASE = (
  process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000"
).replace(/\/$/, "");

type User = {
  id: number;
  email: string;
  full_name: string | null;
  is_active: boolean;
  is_superuser: boolean;
  roles: string[];
};

type AuthContextValue = {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  /** Get auth header object for fetch calls */
  authHeader: () => Record<string, string>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

/** Public routes that don't require authentication */
const PUBLIC_ROUTES = ["/", "/login", "/signup", "/forgot-password", "/candidate/submit", "/candidate/interview"];

function isPublicRoute(path: string): boolean {
  return PUBLIC_ROUTES.some((r) => path === r || path.startsWith(r + "/"));
}

/** Candidate-facing interview routes that are publicly accessible */
function isCandidateRoute(path: string): boolean {
  return /^\/interview\/[^/]+\/(join|prepare|live)$/.test(path);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Read token from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem("access_token") || localStorage.getItem("API_TOKEN") || null;
    if (stored) {
      setToken(stored);
    } else {
      setLoading(false);
    }
  }, []);

  // Fetch user profile when token changes
  useEffect(() => {
    if (!token) {
      setUser(null);
      return;
    }

    let cancelled = false;

    async function fetchMe() {
      try {
        const res = await fetch(`${API_BASE}/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) {
          // Token expired or invalid
          localStorage.removeItem("access_token");
          localStorage.removeItem("API_TOKEN");
          setToken(null);
          setUser(null);
          return;
        }
        const data = await res.json();
        if (!cancelled) setUser(data);
      } catch {
        // Network error — keep token but clear user
        if (!cancelled) setUser(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchMe();
    return () => { cancelled = true; };
  }, [token]);

  // Redirect logic: if not loading, no token, and on a protected route → redirect to /login
  useEffect(() => {
    if (loading) return;
    if (!token && !isPublicRoute(pathname) && !isCandidateRoute(pathname)) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    }
  }, [loading, token, pathname, router]);

  // Sync token to cookie so Next.js middleware can read it
  useEffect(() => {
    if (token) {
      document.cookie = `access_token=${token};path=/;max-age=${60 * 60 * 24 * 7};SameSite=Lax`;
    } else {
      document.cookie = "access_token=;path=/;max-age=0";
    }
  }, [token]);

  const login = useCallback(async (email: string, password: string) => {
    const res = await fetch(`${API_BASE}/auth/login_json`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const json = await res.json();
    if (!res.ok) {
      throw new Error(json?.detail || "Invalid credentials");
    }
    localStorage.setItem("access_token", json.access_token);
    localStorage.setItem("API_TOKEN", json.access_token);
    setToken(json.access_token);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("API_TOKEN");
    document.cookie = "access_token=;path=/;max-age=0";
    setToken(null);
    setUser(null);
    router.replace("/login");
  }, [router]);

  const authHeader = useCallback((): Record<string, string> => {
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, [token]);

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout, authHeader }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}
