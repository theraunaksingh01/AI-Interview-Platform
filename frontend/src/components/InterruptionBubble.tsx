"use client";
 
import { AnimatePresence, motion } from "framer-motion";
import type { Interruption } from "@/hooks/useInterruption";
 
interface InterruptionBubbleProps {
  interruption: Interruption | null;
  onDismiss: () => void;
}
 
const TRIGGER_LABELS: Record<string, string> = {
  VAGUE:        "Be more specific",
  BREADTH_DUMP: "Go deeper",
  STALLING:     "Keep going",
  SILENCE:      "Think out loud",
  RAMBLING:     "Wrap up",
  DELIVERY:     "Pacing",
};
 
export function InterruptionBubble({ interruption, onDismiss }: InterruptionBubbleProps) {
  return (
    <AnimatePresence>
      {interruption && (
        <motion.div
          key={interruption.timestamp}
          initial={{ opacity: 0, y: 16, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -8, scale: 0.95 }}
          transition={{ duration: 0.22, ease: "easeOut" }}
          className="fixed bottom-28 left-1/2 z-50 w-full max-w-sm -translate-x-1/2 px-4"
        >
          <div
            className="flex items-start gap-3 rounded-2xl px-5 py-4 shadow-2xl"
            style={{
              background: "#111",
              border: "1px solid rgba(255,255,255,0.10)",
              boxShadow: "0 8px 40px rgba(0,0,0,0.4)",
            }}
          >
            {/* Interviewer avatar */}
            <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-yellow-400 text-[12px] font-black text-[#111]">
              AI
            </div>
 
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <p className="text-[10px] font-black uppercase tracking-widest text-[#555]">
                  Interviewer
                </p>
                {TRIGGER_LABELS[interruption.trigger] && (
                  <span className="rounded-full bg-white/10 px-1.5 py-0.5 text-[9px] font-bold text-white/40 uppercase tracking-wide">
                    {TRIGGER_LABELS[interruption.trigger]}
                  </span>
                )}
              </div>
              <p className="text-[14px] font-bold text-white leading-snug">
                {interruption.text}
              </p>
            </div>
 
            {/* Dismiss */}
            <button
              onClick={onDismiss}
              className="flex-shrink-0 text-[#555] hover:text-white transition text-[18px] leading-none mt-0.5"
            >
              ×
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}