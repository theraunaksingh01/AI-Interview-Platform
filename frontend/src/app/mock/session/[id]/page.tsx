"use client";

import Link from "next/link";
import { useParams } from "next/navigation";

export default function MockSessionPage() {
  const { id } = useParams() as { id: string };

  return (
    <main className="mx-auto max-w-4xl p-8">
      <h1 className="text-3xl font-semibold">Mock Session</h1>
      <p className="mt-2 text-gray-600">Session ID: {id}</p>

      <div className="mt-6 rounded-xl border bg-white p-6">
        <p className="text-gray-700">
          Phase 2a scaffold is ready. Next step will reuse the existing live interview engine
          and attach coaching overlay in mock mode.
        </p>

        <div className="mt-5 flex gap-3">
          <Link href={`/mock/report/${id}`} className="rounded bg-black px-4 py-2 text-white">
            View Mock Report
          </Link>
          <Link href="/mock" className="rounded border px-4 py-2">
            Back
          </Link>
        </div>
      </div>
    </main>
  );
}
