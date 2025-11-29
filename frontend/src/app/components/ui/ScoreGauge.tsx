"use client";
import React from "react";

export default function ScoreGauge({ value = 0, size = 88 }: { value?: number; size?: number }) {
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  const r = 36;
  const stroke = 8;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - pct / 100);
  // color gradient by ranges
  const color =
    pct >= 85 ? "text-green-600" : pct >= 65 ? "text-emerald-500" : pct >= 45 ? "text-yellow-500" : "text-red-500";

  return (
    <div className="flex flex-col items-center">
      <svg width={size} height={size} viewBox="0 0 88 88" className="block">
        <g transform="translate(44,44)">
          <circle r={r} stroke="#e6e6e6" strokeWidth={stroke} fill="none" />
          <circle
            r={r}
            strokeWidth={stroke}
            fill="none"
            stroke="currentColor"
            strokeDasharray={`${c} ${c}`}
            strokeDashoffset={offset}
            strokeLinecap="round"
            style={{ transition: "stroke-dashoffset .6s ease, color .3s ease" }}
            className={color}
          />
          <text x="0" y="6" textAnchor="middle" fontSize="18" fontWeight={700} fill="currentColor">
            {pct}
          </text>
        </g>
      </svg>
      <div className="text-xs text-muted-foreground mt-1">Overall</div>
    </div>
  );
}
