"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const API_BASE = (process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:8000").replace(/\/$/, "");

export default function MockLandingPage() {
  const router = useRouter();

  const [roleTarget, setRoleTarget] = useState("Software Engineer");
  const [seniority, setSeniority] = useState("mid");
  const [companyType, setCompanyType] = useState("product");
  const [focusArea, setFocusArea] = useState("mixed");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function startMock() {
    setLoading(true);
    setError(null);

    const existingGuestToken =
      typeof window !== "undefined" ? localStorage.getItem("mock_guest_token") : null;

    try {
      const res = await fetch(`${API_BASE}/api/mock/session/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role_target: roleTarget,
          seniority,
          company_type: companyType,
          focus_area: focusArea,
          guest_token: existingGuestToken,
          resume_uploaded: false,
          duration_mins: 45,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.detail || "Unable to start mock session");
      }

      const data = await res.json();
      if (data.guest_token && typeof window !== "undefined") {
        localStorage.setItem("mock_guest_token", data.guest_token);
      }
      if (data.session_id && typeof window !== "undefined") {
        localStorage.setItem("mock_session_id", data.session_id);
      }
      if (data.interview_id && typeof window !== "undefined") {
        localStorage.setItem("mock_interview_id", data.interview_id);
      }

      router.push(`/mock/session/${data.session_id}`);
    } catch (e: any) {
      setError(e?.message || "Network error while creating mock session");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-3xl p-8">
      <h1 className="text-3xl font-semibold">Start a Mock Interview</h1>
      <p className="mt-2 text-gray-600">Choose your target setup and begin a practice session.</p>

      <div className="mt-6 grid gap-4 rounded-xl border bg-white p-5">
        <label className="grid gap-1">
          <span className="text-sm font-medium">Role</span>
          <input
            value={roleTarget}
            onChange={(e) => setRoleTarget(e.target.value)}
            className="rounded border px-3 py-2"
          />
        </label>

        <label className="grid gap-1">
          <span className="text-sm font-medium">Seniority</span>
          <select
            value={seniority}
            onChange={(e) => setSeniority(e.target.value)}
            className="rounded border px-3 py-2"
          >
            <option value="junior">Junior</option>
            <option value="mid">Mid</option>
            <option value="senior">Senior</option>
            <option value="staff">Staff</option>
          </select>
        </label>

        <label className="grid gap-1">
          <span className="text-sm font-medium">Company Type</span>
          <select
            value={companyType}
            onChange={(e) => setCompanyType(e.target.value)}
            className="rounded border px-3 py-2"
          >
            <option value="startup">Startup</option>
            <option value="product">Product</option>
            <option value="mnc">MNC</option>
          </select>
        </label>

        <label className="grid gap-1">
          <span className="text-sm font-medium">Focus Area</span>
          <select
            value={focusArea}
            onChange={(e) => setFocusArea(e.target.value)}
            className="rounded border px-3 py-2"
          >
            <option value="dsa">DSA</option>
            <option value="system_design">System Design</option>
            <option value="behavioral">Behavioral</option>
            <option value="mixed">Mixed</option>
          </select>
        </label>

        {error ? <p className="text-sm text-red-700">{error}</p> : null}

        <button
          onClick={startMock}
          disabled={loading}
          className="mt-2 rounded bg-black px-5 py-3 text-white disabled:opacity-60"
        >
          {loading ? "Starting..." : "Start Mock"}
        </button>
      </div>
    </main>
  );
}
