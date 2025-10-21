// frontend/src/app/layout.tsx
import "../app/style/globals.css";
import { ReactNode } from "react";
import { HeroSection } from "./components/HeroSection";

export const metadata = {
  title: "AI Interview Platform",
  description: "Manage interview roles",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-50 text-gray-900">
        <HeroSection />
        <main className="max-w-4xl mx-auto p-6 pt-6">
          {/* because HeroHeader is fixed, if you have other pages, add padding-top */}
          <div style={{ paddingTop: "24px" }}>{children}</div>
        </main>
      </body>
    </html>
  );
}
