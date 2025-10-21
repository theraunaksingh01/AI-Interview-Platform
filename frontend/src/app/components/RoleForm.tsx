// frontend/src/components/RoleForm.tsx
"use client";

import { useState } from "react";

type Props = { onCreated?: () => void };

export default function RoleForm({ onCreated }: Props) {
  const [title, setTitle] = useState("");
  const [jdText, setJdText] = useState(""); // maps to jd_text expected by backend
  const [level, setLevel] = useState("junior"); // example level default
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const API = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!title.trim()) {
      setError("Title is required.");
      return;
    }
    if (!jdText.trim()) {
      setError("Job description is required.");
      return;
    }

    setLoading(true);

    try {
      const payload = {
        title: title.trim(),
        jd_text: jdText.trim(), // IMPORTANT: backend expects jd_text
        level: level, // include level since sample role had it
      };

      const res = await fetch(`${API}/roles`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`POST /roles failed: ${res.status} ${text}`);
      }

      // success
      setTitle("");
      setJdText("");
      setLevel("junior");
      setSuccess("Role created successfully.");
      onCreated?.();
    } catch (err: any) {
      console.error(err);
      // show either the server message or a friendly fallback
      setError(err?.message ?? "Failed to create role.");
    } finally {
      setLoading(false);
      // clear success after a short delay
      setTimeout(() => setSuccess(null), 3000);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 bg-white p-4 rounded shadow">
      <h2 className="text-lg font-semibold">Create a new role</h2>

      {error ? <div className="p-2 bg-red-50 text-red-700 rounded">{error}</div> : null}
      {success ? <div className="p-2 bg-green-50 text-green-700 rounded">{success}</div> : null}

      <div>
        <label className="block text-sm font-medium">Title</label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="mt-1 w-full rounded border border-gray-200 p-2"
          placeholder="e.g. AI Engineer"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium">Level</label>
        <select
          value={level}
          onChange={(e) => setLevel(e.target.value)}
          className="mt-1 w-full rounded border border-gray-200 p-2"
        >
          <option value="intern">intern</option>
          <option value="junior">junior</option>
          <option value="mid">mid</option>
          <option value="senior">senior</option>
          <option value="lead">lead</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium">Job description</label>
        <textarea
          value={jdText}
          onChange={(e) => setJdText(e.target.value)}
          className="mt-1 w-full rounded border border-gray-200 p-2"
          rows={4}
          placeholder="Short job description, required by the API"
          required
        />
      </div>

      <div>
        <button
          type="submit"
          disabled={loading}
          className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-60"
        >
          {loading ? "Creating..." : "Create Role"}
        </button>
      </div>
    </form>
  );
}
