// frontend/src/app/assessment/results/[id]/opengraph-image.tsx
// V2 — centered layout matching the OA card's proven design

import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "My Placement Readiness Score";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:8000";

export default async function Image({ params }: { params: { id: string } }) {
  let score = 0;
  let label = "Assessment Complete";
  let biggestGap = "";

  try {
    const res = await fetch(`${API_BASE}/api/assessment/results/${params.id}/public`, {
      cache: "no-store",
    });
    if (res.ok) {
      const data = await res.json();
      score = data.total_score ?? 0;
      label = data.label ?? label;
      biggestGap = (data.biggest_gap ?? "").replace(/_/g, " ");
    }
  } catch {
    // Fall back to generic image on fetch failure
  }

  const scoreColor = score >= 70 ? "#10B981" : score >= 45 ? "#F59E0B" : "#EF4444";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#111",
          padding: "80px",
        }}
      >
        <div
          style={{
            display: "flex",
            fontSize: 22,
            fontWeight: 700,
            color: "#FFD600",
            textTransform: "uppercase",
            letterSpacing: "2px",
            marginBottom: 20,
          }}
        >
          Placement Readiness Score
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            fontSize: 150,
            fontWeight: 900,
            color: "white",
            letterSpacing: "-4px",
            lineHeight: 1,
          }}
        >
          <span style={{ display: "flex" }}>{score}</span>
          <span style={{ display: "flex", fontSize: 56, color: "#555", marginLeft: 10 }}>/100</span>
        </div>

                <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginTop: 32,
            background: "rgba(255,255,255,0.06)",
            border: "2px solid rgba(255,255,255,0.15)",
            borderRadius: 999,
            padding: "12px 32px",
            fontSize: 30,
            fontWeight: 800,
            color: "white",
            lineHeight: 1,
          }}
        >
          {label}
        </div>

        {biggestGap && (
          <div
            style={{
              display: "flex",
              fontSize: 24,
              color: "#888",
              marginTop: 28,
            }}
          >
            <span style={{ display: "flex" }}>Biggest gap:&nbsp;</span>
            <span style={{ display: "flex", color: "white", fontWeight: 700 }}>{biggestGap}</span>
          </div>
        )}

        <div
          style={{
            display: "flex",
            fontSize: 36,
            fontWeight: 900,
            letterSpacing: "-1px",
            marginTop: 56,
          }}
        >
          <span
            style={{
              display: "flex",
              background: "#FFD600",
              color: "#111",
              padding: "2px 10px",
              borderRadius: 8,
            }}
          >
            Cr
          </span>
          <span style={{ display: "flex", color: "white" }}>actal</span>
        </div>
        <div style={{ display: "flex", fontSize: 18, color: "#555", marginTop: 8 }}>
          Take the free assessment at cractal.in
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}