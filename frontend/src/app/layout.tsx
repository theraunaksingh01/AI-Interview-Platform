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
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-background text-foreground antialiased">
        {/* Global Hero/Header */}
        <HeroSection />

        <main className="max-w-4xl mx-auto p-6 pt-6">
          {/* Because HeroHeader is fixed, give some top padding for spacing */}
          <div style={{ paddingTop: "24px" }}>{children}</div>
        </main>
      </body>
    </html>
  );
}
