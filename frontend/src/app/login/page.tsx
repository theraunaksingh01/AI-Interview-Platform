"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

const API_BASE =
  (process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000").replace(/\/$/, "");

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("test@example.com");
  const [password, setPassword] = useState("password");
  const [show, setShow] = useState(false);
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // If already logged in, bounce to uploads
  useEffect(() => {
    const tok = localStorage.getItem("access_token");
    if (tok) router.replace("/uploads");
  }, [router]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    try {
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
      if (remember) {
        // optional: persist also in a secondary key some pages read
        localStorage.setItem("API_TOKEN", json.access_token);
      }

      router.replace("/uploads");
    } catch (e: any) {
      setErr(e?.message || "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="full-bleed min-h-screen bg-gradient-to-br from-slate-900 via-indigo-900 to-slate-800 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Card */}
        <div className="bg-white/90 backdrop-blur rounded-2xl shadow-2xl p-8 border border-white/30">
          {/* Brand */}
          <div className="flex items-center gap-3 mb-6">
            <div className="h-10 w-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-bold">
              AI
            </div>
            <div>
              <h1 className="text-xl font-semibold text-slate-900">AI Interview Platform</h1>
              <p className="text-xs text-slate-500">Sign in to continue</p>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="you@company.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Password
              </label>
              <div className="relative">
                <input
                  type={show ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 pr-10 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShow((s) => !s)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 text-sm"
                  aria-label="Toggle password visibility"
                >
                  {show ? "Hide" : "Show"}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-sm text-slate-600">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  className="rounded border-slate-300"
                />
                Remember me
              </label>
              <a
                href="/forgot-password"
                className="text-sm text-indigo-600 hover:underline"
              >
                Forgot password?
              </a>
            </div>

            {err && (
              <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {err}
              </div>
            )}

            <button
              disabled={loading}
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 text-white px-4 py-2 font-medium hover:bg-indigo-700 transition disabled:opacity-60"
            >
              {loading && (
                <span className="h-4 w-4 border-2 border-white/60 border-t-transparent rounded-full animate-spin" />
              )}
              {loading ? "Signing in…" : "Sign in"}
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-4 my-6">
            <div className="h-px bg-slate-200 flex-1" />
            <span className="text-xs uppercase tracking-wider text-slate-400">
              or
            </span>
            <div className="h-px bg-slate-200 flex-1" />
          </div>

          <p className="text-sm text-slate-600">
            New here?{" "}
            <a href="/signup" className="text-indigo-600 hover:underline font-medium">
              Create an account
            </a>
          </p>
        </div>

        {/* Small footer */}
        <p className="text-center text-xs text-white/70 mt-6">
          By continuing you agree to our{" "}
          <a href="#" className="underline">Terms</a> &{" "}
          <a href="#" className="underline">Privacy</a>.
        </p>
      </div>
    </div>
  );
}
