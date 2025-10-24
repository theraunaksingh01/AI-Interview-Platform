"use client";

import * as React from "react";
import { BorderBeam } from "./ui/border-beam";
import { LightboxPlayer } from "./ui/lightbox-player";
import { ArrowRight, LineChart, Timer, Play } from "lucide-react";
import { cn } from "@/lib/utils";

type Clip = {
  src?: string;      // /videos/abc.mp4 (optional)
  poster: string;    // fallback image so tiles never look empty
  title: string;
};

export function VideoShowcase() {
  // LEFT: main demo
  const main = {
  src: "https://www.youtube.com/shorts/ZVYJa-3cmCE", // 
  poster: "https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?q=80&w=1600&auto=format&fit=crop",
  title: "Live AI scoring",
  consistency: "+28%",
  reviewTime: "-42%",
};


  // RIGHT: 6 tiles
  const clips: Clip[] = [
    {
      src: "/videos/create-role.mp4",
      poster:
        "https://images.unsplash.com/photo-1556157382-97eda2d62296?q=80&w=1200&auto=format&fit=crop",
      title: "Create a role",
    },
    {
      src: "/videos/question-banks.mp4",
      poster:
        "https://images.unsplash.com/photo-1531482615713-2afd69097998?q=80&w=1200&auto=format&fit=crop",
      title: "Question banks",
    },
    {
      src: "/videos/run-interview.mp4",
      poster:
        "https://images.unsplash.com/photo-1551836022-d5d88e9218df?q=80&w=1200&auto=format&fit=crop",
      title: "Run interview",
    },
    {
      src: "/videos/reviewer-notes.mp4",
      poster:
        "https://images.unsplash.com/photo-1515879218367-8466d910aaa4?q=80&w=1200&auto=format&fit=crop",
      title: "Reviewer notes",
    },
    {
      src: "/videos/analytics.mp4",
      poster:
        "https://images.unsplash.com/photo-1460925895917-afdab827c52f?q=80&w=1200&auto=format&fit=crop",
      title: "AI analytics",
    },
    {
      src: "/videos/final-scoring.mp4",
      poster:
        "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?q=80&w=1200&auto=format&fit=crop",
      title: "Final scoring",
    },
  ];

  // Lightbox state
  const [open, setOpen] = React.useState(false);
  const [current, setCurrent] = React.useState<{ src: string; title?: string; poster?: string } | null>(null);
  const openPlayer = (src: string, title?: string, poster?: string) => {
    setCurrent({ src, title, poster });
    setOpen(true);
  };

  return (
    <section className="container px-4 md:px-6 py-12 md:py-16">
      <header className="mb-8">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">
          See it in action
        </p>
        <h2 className="text-3xl md:text-4xl font-bold">
          Evidence of <span className="text-indigo-500">AI-assisted interviews</span>
        </h2>
        <p className="text-muted-foreground mt-2 max-w-prose">
          Short clips showing question banks, live scoring, analytics, and reviewer flow — so you can
          judge the experience in seconds.
        </p>
      </header>

      {/* equal-height columns, clean proportions */}
      <div
        className={cn(
          "grid gap-6 items-stretch",
          "grid-cols-1 xl:[grid-template-columns:1.35fr_1.65fr]"
        )}
      >
        {/* LEFT — dominant feature panel */}
        <FeaturePanel clip={main} onOpen={openPlayer} />

        {/* RIGHT — tidy 2x3 grid */}
        <div className="grid grid-cols-2 grid-rows-3 gap-4 min-h-[520px]">
            {clips.map((c, idx) => (
              <Tile key={idx} clip={c} onOpen={openPlayer} />
            ))}
        </div>
        <LightboxPlayer open={open} onClose={() => setOpen(false)} source={current} />
      </div>
    </section>
  );
}

/* ---------------- subcomponents ---------------- */

function FeaturePanel({
  clip,
  onOpen,
}: {
  clip: Clip & { consistency: string; reviewTime: string };
  onOpen: (src: string, title?: string, poster?: string) => void;
}) {
  const isYouTube = clip.src && /(youtube\.com|youtu\.be)/i.test(clip.src);
  const youTubeId = React.useMemo(() => {
    if (!clip.src) return null;
    const mWatch = clip.src.match(/[?&]v=([^&]+)/);
    if (mWatch?.[1]) return mWatch[1];
    const mShort = clip.src.match(/shorts\/([a-zA-Z0-9_-]+)/);
    if (mShort?.[1]) return mShort[1];
    const mShare = clip.src.match(/youtu\.be\/([a-zA-Z0-9_-]+)/);
    if (mShare?.[1]) return mShare[1];
    return null;
  }, [clip.src]);

  const embedUrl = youTubeId
    ? `https://www.youtube.com/embed/${youTubeId}?autoplay=1&mute=1&controls=0&playsinline=1&loop=1&rel=0&playlist=${youTubeId}`
    : null;

  const hasMp4 = clip.src ? /\.mp4($|\?)/i.test(clip.src) : false;
  const showPosterFallback = !hasMp4 && !embedUrl;

  return (
    <div className="relative min-h-[640px] rounded-2xl overflow-hidden border bg-background/60 backdrop-blur-md">
      <BorderBeam size={320} duration={14} borderWidth={1.2} className="rounded-2xl" />

      {/* MEDIA */}
      {hasMp4 && (
        <video
          src={clip.src}
          poster={clip.poster}
          autoPlay
          muted
          loop
          playsInline
          className="absolute inset-0 h-full w-full object-cover"
        />
      )}

      {!hasMp4 && embedUrl && (
        <iframe
          src={embedUrl}
          title={clip.title}
          className="absolute inset-0 h-full w-full"
          allow="autoplay; encrypted-media; picture-in-picture"
          allowFullScreen
        />
      )}

      {showPosterFallback && (
        <img
          src={clip.poster}
          alt={clip.title}
          className="absolute inset-0 h-full w-full object-cover"
        />
      )}

      {/* CLICK OVERLAY opens lightbox */}
      {clip.src && (
        <button
          type="button"
          aria-label={`Open ${clip.title}`}
          onClick={() => onOpen(clip.src!, clip.title, clip.poster)}
          className="absolute inset-0 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      )}

      {/* FOOTER (stacked label -> stats -> CTA) */}
      <div className="absolute inset-x-0 bottom-0 border-t bg-background/85 backdrop-blur-md">
        <div className="mx-auto max-w-[min(720px,100%)] px-4 py-4 flex flex-col items-center gap-2 sm:gap-3">
          <p className="text-sm sm:text-base font-medium tracking-tight">Live AI scoring</p>

          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs sm:text-sm text-muted-foreground">
            <span className="flex items-center gap-2">
              <svg width="16" height="16" viewBox="0 0 24 24" className="opacity-80">
                <path fill="currentColor" d="M3 13h4v8H3zm7-6h4v14h-4zm7-4h4v18h-4z" />
              </svg>
              Scoring consistency
              <strong className="text-foreground ml-1">{clip.consistency}</strong>
            </span>
            <span className="flex items-center gap-2">
              <svg width="16" height="16" viewBox="0 0 24 24" className="opacity-80">
                <path fill="currentColor" d="M12 8v5l4 2" />
                <path fill="none" stroke="currentColor" d="M12 22a10 10 0 1 1 10-10a10 10 0 0 1-10 10Z" />
              </svg>
              Review time
              <strong className="text-foreground ml-1">{clip.reviewTime}</strong>
            </span>
          </div>

          <a
            href="#roles"
            className="mt-1 inline-flex items-center gap-2 rounded-md border px-4 py-1.5 text-sm hover:bg-accent"
          >
            Create a role
            <svg width="14" height="14" viewBox="0 0 24 24">
              <path fill="currentColor" d="M5 12h12m-5-5l5 5l-5 5" />
            </svg>
          </a>
        </div>
      </div>
    </div>
  );
}



function Tile({
  clip,
  onOpen,
}: {
  clip: Clip;
  onOpen: (src: string, title?: string, poster?: string) => void;
}) {
  const hasVideo = Boolean(clip.src);
  const ref = React.useRef<HTMLVideoElement | null>(null);

  return (
    <div
      onClick={() => clip.src && onOpen(clip.src, clip.title, clip.poster)}
      className="relative rounded-xl overflow-hidden border bg-background group cursor-pointer"
      role="button"
      aria-label={`Open ${clip.title}`}
      tabIndex={0}
      onKeyDown={(e) => {
        if ((e.key === "Enter" || e.key === " ") && clip.src) {
          e.preventDefault();
          onOpen(clip.src, clip.title, clip.poster);
        }
      }}
    >
      {hasVideo ? (
        <video
          ref={ref}
          src={clip.src}
          poster={clip.poster}
          muted
          playsInline
          loop
          onMouseEnter={() => ref.current?.play().catch(() => {})}
          onMouseLeave={() => {
            ref.current?.pause();
            if (ref.current) ref.current.currentTime = 0;
          }}
          className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
        />
      ) : (
        <img
          src={clip.poster}
          alt={clip.title}
          className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
        />
      )}

      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/65 to-transparent p-2">
        <p className="text-xs text-white font-medium">{clip.title}</p>
      </div>
    </div>
  );
}


