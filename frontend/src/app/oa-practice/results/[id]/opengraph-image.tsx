// frontend/src/app/oa-practice/results/[id]/opengraph-image.tsx
// FIXED — every multi-child <div> now has explicit display: "flex"

import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "My OA Practice Result";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:8000";

export default async function Image({ params }: { params: { id: string } }) {
  let score = 0;
  let company = "";
  let bandLabel = "";

  try {
    const res = await fetch(`${API_BASE}/api/oa/results/${params.id}/public`, {
      cache: "no-store",
    });
    if (res.ok) {
      const data = await res.json();
      score = data.total_score ?? 0;
      company = (data.company ?? "").toUpperCase();
      bandLabel = data.band_info?.label ?? data.band_prediction ?? "";
    }
  } catch {
    // Fall back to generic
  }

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
            marginBottom: 16,
          }}
        >
          {company} NQT Practice Result
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
          <span style={{ display: "flex", fontSize: 60, color: "#555", marginLeft: 8 }}>%</span>
        </div>

        {bandLabel && (
          <div
            style={{
              display: "flex",
              marginTop: 32,
              background: "rgba(99,102,241,0.15)",
              border: "2px solid #6366F1",
              borderRadius: 999,
              padding: "14px 36px",
              fontSize: 32,
              fontWeight: 800,
              color: "#818CF8",
            }}
          >
            {bandLabel} Band
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
          Practice free at cractal.in/oa-practice
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}