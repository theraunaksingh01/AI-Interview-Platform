// src/app/candidate/submit/page.tsx
"use client";
import React, { useState } from "react";

export default function CandidateSubmitPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [roleId, setRoleId] = useState<string>("");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:8000";

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return alert("Please attach resume");
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
    } catch (err: any) {
      alert(String(err?.message || err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-2xl font-semibold mb-4">Start Interview (Candidate)</h1>

      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className="block text-sm">Name</label>
          <input value={name} onChange={e => setName(e.target.value)} className="w-full border p-2 rounded" required />
        </div>

        <div>
          <label className="block text-sm">Email</label>
          <input value={email} onChange={e => setEmail(e.target.value)} type="email" className="w-full border p-2 rounded" required />
        </div>

        <div>
          <label className="block text-sm">Role ID (optional)</label>
          <input value={roleId} onChange={e => setRoleId(e.target.value)} className="w-full border p-2 rounded" />
        </div>

        <div>
          <label className="block text-sm">Resume (PDF / docx)</label>
          <input type="file" accept=".pdf,.doc,.docx,.txt" onChange={e => setFile(e.target.files?.[0] || null)} />
        </div>

        <div>
          <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded" disabled={loading}>
            {loading ? "Submitting..." : "Submit & Get Link"}
          </button>
        </div>
      </form>

      {result && (
        <div className="mt-6 p-4 border rounded bg-gray-50">
          <div className="mb-2">Interview created: <strong>{result.interview_id}</strong></div>
          <div className="mb-2">Candidate link:</div>
          <a href={result.candidate_url} target="_blank" className="underline text-blue-600">{result.candidate_url}</a>
          <div className="mt-3 text-sm text-muted-foreground">Open the link in a private browser to simulate a candidate session.</div>
        </div>
      )}
    </div>
  );
}
