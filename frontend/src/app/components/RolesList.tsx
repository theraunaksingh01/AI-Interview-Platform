// frontend/src/components/RolesList.tsx
"use client";

import { useEffect, useState } from "react";

export type Role = {
  id?: number | string;
  title: string;
  description?: string | null;
};

export default function RolesList({ refreshFlag }: { refreshFlag: number }) {
  const [roles, setRoles] = useState<Role[] | null>(null);
  const [loading, setLoading] = useState(true);
  const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

  useEffect(() => {
    let canceled = false;
    setLoading(true);
    fetch(`${API}/roles`)
      .then(async (res) => {
        if (!res.ok) {
          const text = await res.text().catch(() => "");
          throw new Error(`GET /roles failed: ${res.status} ${text}`);
        }
        return res.json();
      })
      .then((data) => {
        if (!canceled) {
          // If your API wraps with { data: [...] } adjust accordingly
          setRoles(Array.isArray(data) ? data : (data?.data ?? []));
        }
      })
      .catch((err) => {
        console.error("Fetch roles error:", err);
        if (!canceled) setRoles([]);
      })
      .finally(() => {
        if (!canceled) setLoading(false);
      });

    return () => {
      canceled = true;
    };
  }, [API, refreshFlag]);

  if (loading) return <div>Loading roles…</div>;
  if (!roles || roles.length === 0)
    return <div className="p-4 bg-white rounded shadow">No roles found.</div>;

  return (
    <div className="space-y-3">
      {roles.map((r, idx) => (
        <div key={r.id ?? idx} className="p-4 bg-white rounded shadow">
          <div className="flex justify-between items-start">
            <h3 className="text-lg font-semibold">{r.title}</h3>
            {r.id !== undefined ? <span className="text-sm text-gray-500">#{r.id}</span> : null}
          </div>
          {r.description ? <p className="mt-2 text-sm text-gray-700">{r.description}</p> : null}
        </div>
      ))}
    </div>
  );
}
