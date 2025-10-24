"use client";
import * as React from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

type Source = { src: string; title?: string; poster?: string };

export function LightboxPlayer({
  open,
  onClose,
  source,
  className,
}: {
  open: boolean;
  onClose: () => void;
  source: Source | null;
  className?: string;
}) {
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    if (open) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || !source) return null;

  const isYouTube = /(youtube\.com|youtu\.be)/i.test(source.src);
  const youTubeId =
    isYouTube
      ? source.src.match(/[?&]v=([^&]+)/)?.[1] ||
        source.src.match(/shorts\/([a-zA-Z0-9_-]+)/)?.[1] ||
        source.src.match(/youtu\.be\/([a-zA-Z0-9_-]+)/)?.[1]
      : null;

  const embedUrl = youTubeId
    ? `https://www.youtube.com/embed/${youTubeId}?autoplay=1&mute=0&playsinline=1&rel=0&modestbranding=1`
    : null;

  const isMp4 = /\.mp4($|\?)/i.test(source.src);

  return (
    <div className={cn("fixed inset-0 z-[1000] bg-black/75 backdrop-blur-sm p-4 md:p-8", className)}>
      <div className="mx-auto max-w-5xl">
        <div className="flex items-center justify-between mb-3">
          <p className="text-white/90 text-sm line-clamp-1">{source.title ?? "Preview"}</p>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white inline-flex p-1 rounded"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="relative w-full overflow-hidden rounded-xl border bg-background">
          <div className="aspect-video">
            {isMp4 && (
              <video
                src={source.src}
                poster={source.poster}
                autoPlay
                controls
                playsInline
                className="h-full w-full object-cover"
              />
            )}
            {!isMp4 && embedUrl && (
              <iframe
                src={embedUrl}
                title={source.title ?? "Video"}
                allow="autoplay; encrypted-media; picture-in-picture"
                allowFullScreen
                className="h-full w-full"
              />
            )}
            {!isMp4 && !embedUrl && source.poster && (
              <img src={source.poster} alt={source.title ?? "Poster"} className="h-full w-full object-cover" />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
