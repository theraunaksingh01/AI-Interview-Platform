"use client";
import React from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

export default function PerQuestionBar({ items = [] }: { items?: { name: string; technical: number }[] }) {
  const data = (items || []).map((it) => ({ name: it.name, technical: Math.round(it.technical || 0) }));
  return (
    <div className="w-full h-40">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 6, right: 6, left: 0, bottom: 6 }}>
          <XAxis dataKey="name" tick={{ fontSize: 11 }} />
          <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
          <Tooltip />
          <Bar dataKey="technical" fill="#2563eb" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
