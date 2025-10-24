// frontend/src/components/Features.tsx
"use client";

import React, { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";

interface FeaturesProps {
  features: {
    id: number;
    icon: React.ElementType;
    title: string;
    description: string;
    image: string;
  }[];
  progressGradientLight?: string;
}

export default function Features({
  features,
  progressGradientLight = "bg-gradient-to-r from-indigo-400 to-cyan-400",
}: FeaturesProps) {
  const [currentFeature, setCurrentFeature] = useState(0);
  const [progress, setProgress] = useState(0);
  const featureRefs = useRef<(HTMLDivElement | null)[]>([]);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress((prev) => (prev >= 100 ? 100 : prev + 1));
    }, 100);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (progress >= 100) {
      const t = window.setTimeout(() => {
        setCurrentFeature((prev) => (prev + 1) % features.length);
        setProgress(0);
      }, 250);
      return () => clearTimeout(t);
    }
  }, [progress, features.length]);

  useEffect(() => {
    const activeFeatureElement = featureRefs.current[currentFeature];
    const container = containerRef.current;
    if (activeFeatureElement && container) {
      const containerRect = container.getBoundingClientRect();
      const elementRect = activeFeatureElement.getBoundingClientRect();
      container.scrollTo({
        left:
          activeFeatureElement.offsetLeft -
          (containerRect.width - elementRect.width) / 2,
        behavior: "smooth",
      });
    }
  }, [currentFeature]);

  const handleFeatureClick = (index: number) => {
    setCurrentFeature(index);
    setProgress(0);
  };

  if (!features || features.length === 0) return null;

  return (
    <section className="py-16 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <span className="inline-block text-sm font-semibold uppercase tracking-wider text-accent-600">
            AI Mentors. Real Results.
          </span>
          <h2 className="mt-4 text-3xl md:text-4xl lg:text-5xl font-extrabold text-foreground">
            AI That Actually Teaches
          </h2>
          <p className="mt-4 max-w-2xl mx-auto text-muted-foreground">
            Practical, hands-on guidance powered by AI — turn learning into measurable progress for every candidate.
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-10 items-start">
          {/* Left: feature list */}
          <div
            ref={containerRef}
            className="flex lg:flex-col flex-row gap-4 lg:gap-6 overflow-x-auto lg:overflow-visible pb-4 no-scrollbar scroll-smooth"
            role="list"
            aria-label="Features list"
          >
            {features.map((feature, index) => {
              const Icon = feature.icon;
              const isActive = currentFeature === index;

              return (
                <div
                  key={feature.id}
                  ref={(el) => {
                    featureRefs.current[index] = el;
                  }}
                  role="listitem"
                  onClick={() => handleFeatureClick(index)}
                  className="flex-shrink-0 w-[80%] md:w-[60%] lg:w-full cursor-pointer"
                >
                  <div
                    className={`flex items-start gap-4 p-4 transition-all duration-300 ${
                      isActive
                        ? "bg-background/80 dark:bg-background/80 rounded-2xl border border-gray-200 dark:border-zinc-700 shadow-sm"
                        : "rounded-xl"
                    }`}
                  >
                    {/* Icon (pass size + className explicitly) */}
                    {/* Icon container: wrapper sets color via text-* classes; nested SVGs get stroke/fill from currentColor */}
                    <div
                      className={`flex items-center justify-center rounded-full w-12 h-12 shrink-0 transition-colors duration-300 ${
                        isActive ? "bg-accent-600 text-white" : "bg-foreground/5 text-foreground"
                      } icon-wrapper`}
                      aria-hidden
                    >
                      {(() => {
                        if (!Icon) {
                          return (
                            <svg className={isActive ? "w-5 h-5" : "w-5 h-5"} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
                              <circle cx="12" cy="12" r="3.5" stroke="currentColor" strokeWidth="1.5" />
                            </svg>
                          );
                        }
                    
                        // Try to render the icon component; wrap it so we inherit color
                        try {
                          // Many icon libs accept className/size; pass both
                          const el = React.createElement(Icon as any, {
                            className: "w-5 h-5",
                            size: 20,
                            strokeWidth: 1.5,
                          });
                          return <span style={{ display: "inline-flex", color: "inherit" }}>{el}</span>;
                        } catch {
                          try {
                            // Last attempt: call as function component
                            // @ts-ignore
                            const Component = Icon as any;
                            return <span style={{ display: "inline-flex", color: "inherit" }}><Component className="w-5 h-5" size={20} /></span>;
                          } catch {
                            // fallback
                            return (
                              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
                                <circle cx="12" cy="12" r="3.5" stroke="currentColor" strokeWidth="1.5" />
                              </svg>
                            );
                          }
                        }
                      })()}
                    </div>           

                    <div className="flex-1 min-w-0">
                      <h3 className={`font-semibold text-lg truncate ${isActive ? "text-foreground" : "text-muted-foreground"}`}>
                        {feature.title}
                      </h3>
                      <p className={`mt-1 text-sm leading-relaxed ${isActive ? "text-foreground/70" : "text-muted-foreground"}`}>
                        {feature.description}
                      </p>

                      <div className="mt-3 h-1 bg-background/60 rounded overflow-hidden">
                        {isActive ? (
                          <motion.div
                            className={`${progressGradientLight} h-full`}
                            style={{ width: `${progress}%` }}
                            initial={{ width: 0 }}
                            animate={{ width: `${progress}%` }}
                            transition={{ duration: 0.15, ease: "linear" }}
                          />
                        ) : (
                          <div className="h-full w-0" />
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Right: visual */}
          <div className="relative mx-auto w-full max-w-3xl">
            <motion.div
              key={currentFeature}
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.45, ease: "easeOut" }}
              className="relative"
            >
              <div className="rounded-2xl overflow-hidden border border-gray-100 dark:border-zinc-800 shadow-lg">
                <img src={features[currentFeature].image} alt={features[currentFeature].title} className="w-full h-[420px] object-cover" />
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </section>

    
  );

}

