// frontend/src/app/layout.tsx
import "./style/globals.css";
import { ReactNode } from "react";
import { Providers } from "./providers";
import { NavbarWrapper } from "@/app/components/NavbarWrapper";
import { DailyPopup } from "@/app/components/DailyPopup";
import { CookieBanner } from "@/app/components/CookieBanner";

export const metadata = {
  title: "AI Interview Platform",
  description: "Manage interview roles",
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