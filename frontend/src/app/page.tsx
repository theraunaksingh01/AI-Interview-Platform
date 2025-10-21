// frontend/src/app/page.tsx
"use client";

import { useState } from "react";
import RoleForm from "@/app/components/RoleForm";
import RolesList from "@/app/components/RolesList";

export default function Page() {
  const [refreshFlag, setRefreshFlag] = useState(0);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold">AI Interview Platform</h1>
        <p className="text-gray-600 mt-1">Manage interview roles</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <RoleForm onCreated={() => setRefreshFlag((f) => f + 1)} />
        </div>

        <div>
          <h2 className="text-lg font-semibold mb-2">Existing roles</h2>
          <RolesList refreshFlag={refreshFlag} />
        </div>
      </div>
    </div>
  );
}
