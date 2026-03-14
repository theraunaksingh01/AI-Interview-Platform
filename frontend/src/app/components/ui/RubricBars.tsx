"use client";
import React from "react";

const COLOR_MAP: Record<string, string> = {
  high: "linear-gradient(90deg,#10b981,#059669)",
  mid: "linear-gradient(90deg,#f59e0b,#d97706)",
  low: "linear-gradient(90deg,#ef4444,#dc2626)",
};

function barColor(v: number) {
  if (v >= 70) return COLOR_MAP.high;
  if (v >= 45) return COLOR_MAP.mid;
  return COLOR_MAP.low;
}

export default function RubricBars({ rubrics }: { rubrics: { name: string; value: number }[] }) {
  return (
    <div className="space-y-3">
      {rubrics.map((r) => {
        const v = Math.round(r.value);
        return (
          <div key={r.name}>
            <div className="flex justify-between text-xs mb-1">
              <div className="font-medium">{r.name}</div>
              <div className="text-gray-500">{v}</div>
            </div>
            <div className="h-2.5 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-2.5 rounded-full transition-all"
                style={{
                  width: `${Math.max(0, Math.min(100, v))}%`,
                  background: barColor(v),
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
