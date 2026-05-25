// frontend/src/app/page.tsx
"use client";

import { Inter } from "next/font/google";
import { useScrollAnimation } from "@/hooks/useScrollAnimation";

import { HeroSection } from "./components/HeroSection";
import ChallangesSection from "./components/Challenges";
import { CompanyPrep } from "./components/CompanyPrep";
import { FAQ } from "./components/FAQ";
import CtaVideoLeft from "./components/ui/cta-with-marquee";
import { ProcessBento } from "./components/ui/process-bento";
import StatsSection from "./components/ui/stats";
import { SocialProof } from "./components/ui/SocialProof";
import SkillPassport  from "./components/PassportTeaser";
import {Pricing} from "./components/Pricing";
import { Testimonials } from "./components/ui/testimonials";
import { FooterHero } from "./components/Footer";
import BlogSection from "./components/BlogSection";
import ComparisonSection from "./components/ComparisonSection";

const inter = Inter({ subsets: ["latin"], display: "swap" });

export default function Page() {
  useScrollAnimation();

  return (
    <div className={`${inter.className} min-h-screen overflow-x-hidden bg-white text-slate-900`}>
      
      <main className="pt-20">
        {/* Hero Section */}
        <HeroSection />  

          {/* Challenges Section */}
        <ChallangesSection />

        <SocialProof />
        
        <ProcessBento />

        <CompanyPrep />

        <ComparisonSection />

        <StatsSection />

        

        <SkillPassport />

        <Testimonials />
        <Pricing />
        <BlogSection />
        <FAQ />
        <CtaVideoLeft />

      </main>

      <FooterHero />
    </div>
  );
}
