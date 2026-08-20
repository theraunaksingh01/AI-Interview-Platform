// frontend/src/app/layout.tsx
// Updated with proper SEO metadata — replaces generic placeholder

import "./style/globals.css";
import { ReactNode } from "react";
import { Providers } from "./providers";
import { NavbarWrapper } from "@/app/components/NavbarWrapper";
import { DailyPopup } from "@/app/components/DailyPopup";
import { CookieBanner } from "@/app/components/CookieBanner";
import type { Metadata } from "next";

export const metadata: Metadata = {
  metadataBase: new URL("https://qued.in"),
  title: {
    default: "Qued — AI Mock Interviews & Placement Prep for Engineering Students",
    template: "%s | Qued",
  },
  description:
    "AI-powered mock interviews, OA practice tests, and placement readiness assessment for Indian engineering students. Prepare for TCS NQT, Infosys, Wipro, Amazon and more — campus or off-campus.",
  keywords: [
    "mock interview practice",
    "placement preparation India",
    "TCS NQT practice test",
    "Infosys mock interview",
    "campus placement preparation",
    "off campus interview prep",
    "AI interview coach",
    "DSA practice online",
    "engineering student placement",
    "OA practice test",
    "placement readiness assessment",
    "coding interview preparation India",
  ],
  authors: [{ name: "Qued" }],
  creator: "Qued",
  publisher: "Qued",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  openGraph: {
    type: "website",
    locale: "en_IN",
    url: "https://qued.in",
    siteName: "Qued",
    title: "Qued — AI Mock Interviews & Placement Prep for Engineering Students",
    description:
      "AI-powered placement prep for India's engineering students. Mock interviews with live coaching, OA practice tests, and a free readiness assessment.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Qued — AI Placement Prep Platform",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Qued — AI Mock Interviews & Placement Prep",
    description:
      "AI-powered placement prep for India's engineering students. Free readiness assessment, mock interviews, and OA practice.",
    images: ["/og-image.png"],
  },
  icons: {
    icon: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
  alternates: {
    canonical: "https://qued.in",
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-background text-foreground antialiased">
        <Providers>
          <NavbarWrapper />
          {children}
          <DailyPopup />
          <CookieBanner />
        </Providers>
      </body>
    </html>
  );
}