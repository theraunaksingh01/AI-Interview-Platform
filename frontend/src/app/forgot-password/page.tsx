"use client";

import { useState } from "react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    // Wire to /auth/forgot_password later.
    setMsg(
      "If this email exists, a reset link would be sent. (Demo-only screen)"
    );
  }

  return (
    <div className="full-bleed min-h-screen bg-gradient-to-br from-slate-900 via-indigo-900 to-slate-800 flex items-center justify-center px-4">
      <div className="bg-white/90 backdrop-blur rounded-2xl shadow-2xl p-8 border border-white/30 w-full max-w-lg">
        <h1 className="text-2xl font-semibold text-slate-900 mb-1">Forgot password?</h1>
        <p className="text-sm text-slate-500 mb-6">
          Enter your email, and we’ll send a reset link.
        </p>

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="you@company.com"
            />
          </div>

          {msg && (
            <div className="text-sm text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg px-3 py-2">
              {msg}
            </div>
          )}

        <div className="flex gap-2">
          <button className="flex-1 rounded-xl bg-indigo-600 text-white px-4 py-2 font-medium hover:bg-indigo-700 transition">
            Send reset link
          </button>
          <a
            href="/login"
            className="flex-1 rounded-xl border border-slate-200 text-slate-700 px-4 py-2 text-center hover:bg-slate-50 transition"
          >
            Back to login
          </a>
        </div>
        </form>
      </div>
    </div>
  );
}
