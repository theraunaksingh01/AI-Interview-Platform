"use client";
import React from "react";
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from "recharts";

export default function RadarChartComponent({ technical = 0, communication = 0, completeness = 0 } : { technical?: number; communication?: number; completeness?: number }) {
  const data = [
    { subject: "Technical", A: Math.round(technical) },
    { subject: "Communication", A: Math.round(communication) },
    { subject: "Completeness", A: Math.round(completeness) },
  ];

  return (
    <div className="w-full h-40">
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart data={data}>
          <PolarGrid />
          <PolarAngleAxis dataKey="subject" />
          <PolarRadiusAxis angle={30} domain={[0, 100]} />
          <Radar name="Scores" dataKey="A" stroke="#4f46e5" fill="#6366f1" fillOpacity={0.6} />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
