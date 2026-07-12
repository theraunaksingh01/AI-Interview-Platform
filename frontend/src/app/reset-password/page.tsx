// frontend/src/app/reset-password/page.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

const API_BASE = (
  process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:8000"
).replace(/\/$/, "");

export default function ResetPasswordPage() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const token        = searchParams.get("token") ?? "";

  const [password,  setPassword]  = useState("");
  const [confirm,   setConfirm]   = useState("");
  const [loading,   setLoading]   = useState(false);
  const [validating, setValidating] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const [tokenError, setTokenError] = useState("");
  const [success,   setSuccess]   = useState(false);
  const [error,     setError]     = useState("");
  const [showPwd,   setShowPwd]   = useState(false);

  // Validate token on mount
  useEffect(() => {
    if (!token) {
      setTokenError("No reset token found. Please request a new reset link.");
      setValidating(false);
      return;
    }

    fetch(`${API_BASE}/api/auth/validate-reset-token?token=${encodeURIComponent(token)}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.valid) {
          setTokenValid(true);
        } else {
          setTokenError(
            d.reason === "expired"
              ? "This reset link has expired. Please request a new one."
              : "Invalid reset link. Please request a new one."
          );
        }
      })
      .catch(() => {
        setTokenError("Could not verify reset link. Please try again.");
      })
      .finally(() => setValidating(false));
  }, [token]);

  const handleReset = async () => {
    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match");
      return;
    }
    setError("");
    setLoading(true);

    try {
      const res = await fetch(`${API_BASE}/api/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, new_password: password }),
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok) {
        setSuccess(true);
        // Redirect to login after 3 seconds
        setTimeout(() => router.push("/login?reset=success"), 3000);
      } else {
        setError(data.detail || "Failed to reset password. Please try again.");
      }
    } catch {
      setError("Network error. Please check your connection.");
    } finally {
      setLoading(false);
    }
  };

  // ── Render states ─────────────────────────────────────────────────────────

  if (validating) {
    return (
      <main className="min-h-screen flex items-center justify-center" style={{ background: "#FFFDF0" }}>
        <div className="text-center">
          <div className="mx-auto mb-3 h-6 w-6 animate-spin rounded-full border-2 border-gray-200 border-t-[#111]" />
          <p className="text-[13px] text-[#9CA3AF]">Verifying reset link...</p>
        </div>
      </main>
    );
  }

  return (
    <main
      className="min-h-screen flex items-center justify-center px-4"
      style={{ background: "#FFFDF0" }}
    >
      <div className="w-full max-w-[400px]">

        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/">
            <span className="text-[22px] font-black text-[#111]">
              Qu<span style={{ background: "#FFD600", padding: "1px 6px", borderRadius: "4px" }}>ed</span>
            </span>
          </Link>
        </div>

        <div
          className="rounded-3xl border border-[#E5E7EB] bg-white overflow-hidden"
          style={{ boxShadow: "0 4px 40px rgba(0,0,0,0.06)" }}
        >
          {/* Invalid token */}
          {!tokenValid && (
            <div className="px-8 py-10 text-center">
              <div className="text-[48px] mb-4">⚠️</div>
              <h1 className="text-[20px] font-black text-[#111] mb-2">
                Link invalid or expired
              </h1>
              <p className="text-[14px] text-[#6B7280] leading-relaxed mb-6">
                {tokenError}
              </p>
              <Link href="/forgot-password">
                <button className="w-full rounded-xl bg-[#111] py-3 text-[14px] font-black text-white hover:bg-[#333] transition">
                  Request new reset link →
                </button>
              </Link>
              <div className="mt-4">
                <Link href="/login" className="text-[13px] font-medium text-[#6B7280] hover:text-[#111] transition">
                  ← Back to login
                </Link>
              </div>
            </div>
          )}

          {/* Success */}
          {tokenValid && success && (
            <div className="px-8 py-10 text-center">
              <div className="text-[48px] mb-4">✅</div>
              <h1 className="text-[20px] font-black text-[#111] mb-2">
                Password reset!
              </h1>
              <p className="text-[14px] text-[#6B7280] leading-relaxed mb-2">
                Your password has been updated successfully.
              </p>
              <p className="text-[13px] text-[#9CA3AF]">
                Redirecting you to login...
              </p>
            </div>
          )}

          {/* Form */}
          {tokenValid && !success && (
            <div className="px-8 py-8">
              <h1 className="text-[22px] font-black text-[#111] mb-1">
                Set new password
              </h1>
              <p className="text-[14px] text-[#6B7280] mb-6">
                Choose a strong password — at least 8 characters.
              </p>

              <div className="space-y-4">
                {/* New password */}
                <div>
                  <label className="block text-[12px] font-bold text-[#374151] mb-1.5">
                    New password
                  </label>
                  <div className="relative">
                    <input
                      type={showPwd ? "text" : "password"}
                      value={password}
                      onChange={(e) => { setPassword(e.target.value); setError(""); }}
                      placeholder="At least 8 characters"
                      className="w-full rounded-xl border border-[#E5E7EB] px-4 py-3 pr-10 text-[14px] text-[#111] outline-none focus:border-[#111] transition"
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => setShowPwd((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9CA3AF] hover:text-[#374151] transition text-[12px]"
                    >
                      {showPwd ? "Hide" : "Show"}
                    </button>
                  </div>
                  {/* Strength indicator */}
                  {password.length > 0 && (
                    <div className="mt-1.5 flex gap-1">
                      {[1, 2, 3].map((level) => (
                        <div
                          key={level}
                          className="h-1 flex-1 rounded-full transition-all"
                          style={{
                            background:
                              password.length >= level * 4
                                ? level === 1 ? "#EF4444"
                                : level === 2 ? "#F59E0B"
                                : "#10B981"
                                : "#E5E7EB",
                          }}
                        />
                      ))}
                    </div>
                  )}
                </div>

                {/* Confirm password */}
                <div>
                  <label className="block text-[12px] font-bold text-[#374151] mb-1.5">
                    Confirm new password
                  </label>
                  <input
                    type={showPwd ? "text" : "password"}
                    value={confirm}
                    onChange={(e) => { setConfirm(e.target.value); setError(""); }}
                    onKeyDown={(e) => e.key === "Enter" && handleReset()}
                    placeholder="Same password again"
                    className="w-full rounded-xl border border-[#E5E7EB] px-4 py-3 text-[14px] text-[#111] outline-none focus:border-[#111] transition"
                  />
                  {confirm.length > 0 && confirm !== password && (
                    <p className="mt-1 text-[11px] text-red-500">Passwords don&apos;t match</p>
                  )}
                  {confirm.length > 0 && confirm === password && (
                    <p className="mt-1 text-[11px] text-emerald-500">✓ Passwords match</p>
                  )}
                </div>

                {error && (
                  <p className="text-[13px] text-red-500 font-medium">{error}</p>
                )}

                <button
                  onClick={handleReset}
                  disabled={loading || password.length < 8 || password !== confirm}
                  className="w-full rounded-xl bg-[#111] py-3 text-[14px] font-black text-white hover:bg-[#333] transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? "Resetting..." : "Reset password →"}
                </button>
              </div>

              <div className="mt-6 text-center">
                <Link
                  href="/login"
                  className="text-[13px] font-medium text-[#6B7280] hover:text-[#111] transition"
                >
                  ← Back to login
                </Link>
              </div>
            </div>
          )}
        </div>

      </div>
    </main>
  );
}