// frontend/src/app/opengraph-image.tsx
// Next.js auto-generates this at /opengraph-image for the homepage
// No manual PNG file needed — this generates on build/request

import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Cractal — AI Mock Interviews & Placement Prep";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
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
          background: "#FFFDF0",
          padding: "80px",
        }}
      >
        {/* Logo */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            fontSize: 72,
            fontWeight: 900,
            letterSpacing: "-2px",
            marginBottom: 40,
          }}
        >
          <span
            style={{
              background: "#FFD600",
              color: "#111",
              padding: "4px 20px",
              borderRadius: 12,
            }}
          >
            Cr
          </span>
          <span style={{ color: "#111" }}>actal</span>
        </div>

        {/* Headline */}
        <div
          style={{
            fontSize: 44,
            fontWeight: 900,
            color: "#111",
            textAlign: "center",
            letterSpacing: "-1px",
            lineHeight: 1.2,
            maxWidth: 900,
            marginBottom: 24,
          }}
        >
          AI Mock Interviews & Placement Prep
        </div>

        {/* Subtext */}
        <div
          style={{
            fontSize: 26,
            color: "#6B7280",
            textAlign: "center",
            maxWidth: 800,
          }}
        >
          Free readiness assessment · OA practice · Live voice coaching
        </div>

        {/* Bottom bar */}
        <div
          style={{
            display: "flex",
            gap: 16,
            marginTop: 48,
          }}
        >
          {["Free Assessment", "OA Practice", "Mock Interviews"].map((tag) => (
            <div
              key={tag}
              style={{
                background: "white",
                border: "1.5px solid #E5E7EB",
                borderRadius: 999,
                padding: "10px 24px",
                fontSize: 20,
                fontWeight: 600,
                color: "#374151",
              }}
            >
              {tag}
            </div>
          ))}
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}