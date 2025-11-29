"use client";
import React from "react";

export default function ScoreBars({
  technical = 0,
  communication = 0,
  completeness = 0,
}: {
  technical?: number;
  communication?: number;
  completeness?: number;
}) {
  const rows = [
    { k: "Technical", v: Math.round(technical) },
    { k: "Communication", v: Math.round(communication) },
    { k: "Completeness", v: Math.round(completeness) },
  ];

  return (
    <div className="space-y-3">
      {rows.map((r) => (
        <div key={r.k}>
          <div className="flex justify-between text-xs mb-1">
            <div className="font-medium">{r.k}</div>
            <div className="text-muted-foreground">{r.v}</div>
          </div>
          <div className="h-2 bg-gray-200 rounded overflow-hidden">
            <div
              className="h-2 rounded"
              style={{
                width: `${Math.max(0, Math.min(100, r.v))}%`,
                background: r.v >= 85 ? "linear-gradient(90deg,#10b981,#059669)" : undefined,
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
