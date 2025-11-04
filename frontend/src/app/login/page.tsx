"use client";

import { useState } from "react";

const API_BASE = (process.env.NEXT_PUBLIC_API_BASE ||
  process.env.NEXT_PUBLIC_API_URL ||
  "http://127.0.0.1:8000").replace(/\/$/, "");

export default function LoginPage() {
  const [email, setEmail] = useState("test@example.com");
  const [password, setPassword] = useState("changeme");
  const [msg, setMsg] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg("");
    try {
      const res = await fetch(`${API_BASE}/auth/login_json`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const text = await res.text();
      if (!res.ok) throw new Error(text || `HTTP ${res.status}`);
      const data = JSON.parse(text);
      localStorage.setItem("API_TOKEN", data.access_token);
      setMsg("Logged in!");
      window.location.href = "/uploads";
    } catch (e: any) {
      setMsg(e?.message || "Login failed");
    }
  }

  return (
    <div className="max-w-sm mx-auto p-6 space-y-4">
      <h1 className="text-xl font-bold">Login</h1>
      <form onSubmit={submit} className="space-y-3">
        <input
          className="w-full border rounded px-3 py-2"
          placeholder="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          className="w-full border rounded px-3 py-2"
          placeholder="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <button className="border rounded px-3 py-2 text-sm hover:bg-gray-50">Sign in</button>
      </form>
      {msg && <p className="text-sm text-gray-700">{msg}</p>}
    </div>
  );
}
