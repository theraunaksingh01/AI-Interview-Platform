"use client";
import React from "react";

const STYLES: Record<string, { bg: string; text: string; label: string }> = {
  strong_hire: { bg: "bg-green-100", text: "text-green-800", label: "Strong Hire" },
  hire: { bg: "bg-emerald-100", text: "text-emerald-700", label: "Hire" },
  maybe: { bg: "bg-yellow-100", text: "text-yellow-700", label: "Maybe" },
  no_hire: { bg: "bg-red-100", text: "text-red-800", label: "No Hire" },
  pending: { bg: "bg-gray-100", text: "text-gray-600", label: "Pending" },
};

export default function HiringBadge({ recommendation }: { recommendation: string }) {
  const s = STYLES[recommendation] || STYLES.pending;
  return (
    <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold ${s.bg} ${s.text}`}>
      {s.label}
    </span>
  );
}
