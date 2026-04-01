'use client';

import { RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from 'recharts';

interface Props {
  scores: Record<string, number>;
}

export default function RubricRadarChart({ scores }: Props) {
  const data = Object.entries(scores).map(([label, value]) => ({
    name: label.toUpperCase(),
    score: Math.min(10, Math.max(0, typeof value === 'number' ? value : 0)),
  }));

  if (data.length === 0) {
    return <p className="text-gray-600">No rubric scores available</p>;
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <RadarChart data={data}>
        <PolarGrid />
        <PolarAngleAxis dataKey="name" />
        <PolarRadiusAxis angle={90} domain={[0, 10]} />
        <Radar name="Score" dataKey="score" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.6} />
      </RadarChart>
    </ResponsiveContainer>
  );
}
