import React from "react";
import { cn } from "@/lib/utils";

interface Logo {
  src: string;
  alt: string;
  gradient: {
    from: string;
    via: string;
    to: string;
  };
}

interface MarqueeLogoScrollerProps
  extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  description: string;
  logos: Logo[];
  speed?: "normal" | "slow" | "fast";
}

const MarqueeLogoScroller = React.forwardRef<
  HTMLDivElement,
  MarqueeLogoScrollerProps
>(({ title, description, logos, speed = "normal", className, ...props }, ref) => {
  const durationMap = {
    normal: "40s",
    slow: "80s",
    fast: "20s",
  };
  const animationDuration = durationMap[speed];

  return (
    <>
      <style>{`
        @keyframes marquee {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
      `}</style>

      {/* Full-bleed horizontal strip */}
      <section
          ref={ref}
          aria-label={title}
          className={cn(
            "full-bleed w-full bg-background text-foreground", // still breaks out of container
            "py-12 md:py-16"
          )}
          {...props}
        >
          <div className="mx-auto w-full max-w-7xl px-6">
            {/* Inner bordered container */}
            <div className="rounded-2xl border bg-background/60 backdrop-blur-sm overflow-hidden shadow-sm">
              {/* Header Section */}
              <div className="p-6 md:p-8 lg:p-10 border-b">
                <div className="grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-6 lg:gap-8">
                  <h2 className="text-3xl md:text-4xl font-semibold tracking-tight text-balance">
                    {title}
                  </h2>
                  <p className="text-muted-foreground self-start lg:justify-self-end text-balance">
                    {description}
                  </p>
                </div>
              </div>
      
              {/* Marquee Section */}
              <div
                className="w-full overflow-hidden"
                style={{
                  maskImage:
                    "linear-gradient(to right, transparent, black 6%, black 94%, transparent)",
                }}
              >
                <div
                  className="flex w-max items-center gap-8 py-6 hover:[animation-play-state:paused]"
                  style={{ animation: `marquee ${animationDuration} linear infinite` }}
                >
                  {[...logos, ...logos].map((logo, index) => (
                    <div
                      key={`${logo.alt}-${index}`}
                      className="group relative h-24 w-40 shrink-0 flex items-center justify-center rounded-lg bg-secondary/70 overflow-hidden"
                    >
                      {/* Gradient background revealed on hover */}
                      <div
                        style={{
                          "--from": logo.gradient.from,
                          "--via": logo.gradient.via,
                          "--to": logo.gradient.to,
                        } as React.CSSProperties}
                        className="absolute inset-0 scale-150 opacity-0 transition-all duration-700 ease-out group-hover:opacity-100 group-hover:scale-100 bg-gradient-to-br from-[var(--from)] via-[var(--via)] to-[var(--to)]"
                      />
                      {/* Logo Image */}
                      <img
                        src={logo.src}
                        alt={logo.alt}
                        className="relative h-3/4 w-auto object-contain"
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>
              
    </>
  );
});

MarqueeLogoScroller.displayName = "MarqueeLogoScroller";

export { MarqueeLogoScroller };
