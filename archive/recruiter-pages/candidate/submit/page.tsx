// src/app/candidate/submit/page.tsx
"use client";
import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const API_BASE = (
  process.env.NEXT_PUBLIC_API_URL ||
  process.env.NEXT_PUBLIC_API_BASE ||
  "http://127.0.0.1:8000"
).replace(/\/$/, "");

type Role = { id: number; title: string; level: string };

export default function CandidateSubmitPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [roleId, setRoleId] = useState<string>("");
  const [roles, setRoles] = useState<Role[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ interview_id: string; candidate_url: string } | null>(null);

  // Fetch available roles on mount
  useEffect(() => {
    fetch(`${API_BASE}/roles`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setRoles(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return alert("Please attach your resume");
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append("name", name);
      fd.append("email", email);
      if (roleId) fd.append("role_id", roleId);
      fd.append("resume", file);

      const resp = await fetch(`${API_BASE}/public/interview/submit`, {
        method: "POST",
        body: fd,
      });
      if (!resp.ok) {
        const t = await resp.text();
        throw new Error(t || resp.statusText);
      }
      const j = await resp.json();
      setResult(j);

      // Auto-redirect to the join page after a short delay
      setTimeout(() => {
        router.push(j.candidate_url);
      }, 1500);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      alert(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-lg p-8">
        <h1 className="text-2xl font-semibold text-slate-900 mb-2">
          Start Your Interview
        </h1>
        <p className="text-sm text-slate-500 mb-6">
          Fill in your details, upload your resume, and get started.
        </p>

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Full Name <span className="text-red-500">*</span>
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              required
              placeholder="e.g. Jane Doe"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Email <span className="text-red-500">*</span>
            </label>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              required
              placeholder="e.g. jane@example.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Position
            </label>
            <select
              value={roleId}
              onChange={(e) => setRoleId(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="">Select a position (optional)</option>
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.title} {r.level ? `(${r.level})` : ""}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Resume <span className="text-red-500">*</span>
            </label>
            <input
              type="file"
              accept=".pdf,.doc,.docx,.txt"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
            />
          </div>

          <button
            type="submit"
            className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            disabled={loading}
          >
            {loading ? "Submitting..." : "Submit & Join Interview"}
          </button>
        </form>

        {result && (
          <div className="mt-6 p-4 border border-green-200 rounded-lg bg-green-50 text-center">
            <p className="text-sm font-medium text-green-800">
              Interview created! Redirecting you to the interview lobby...
            </p>
            <a
              href={result.candidate_url}
              className="mt-2 inline-block text-sm text-indigo-600 underline"
            >
              Click here if not redirected
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
