"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

export function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const accepted = localStorage.getItem("cookie_consent");
    if (!accepted) setVisible(true);
  }, []);

  const accept = () => {
    localStorage.setItem("cookie_consent", "true");
    setVisible(false);
  };

  const decline = () => {
    localStorage.setItem("cookie_consent", "false");
    setVisible(false);
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 24 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className="fixed bottom-5 z-[9999] left-0 right-0 flex justify-center px-4"
        >
          <div
            className="w-full max-w-[860px] rounded-2xl px-6 py-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
            style={{
              background: "#111111",
              border: "1px solid #2A2A2A",
              boxShadow: "0 8px 40px rgba(0,0,0,0.35)",
            }}
          >
            {/* Text */}
            <div className="flex items-start gap-3 flex-1 min-w-0">
              <span className="text-[18px] flex-shrink-0 mt-0.5">🍪</span>
              <div>
                <p className="text-[14px] font-bold text-white mb-0.5">
                  We use cookies
                </p>
                <p className="text-[12px] leading-relaxed" style={{ color: "#888" }}>
                  We use cookies to keep you logged in, remember your preferences, and improve your experience. We don't sell your data or use third-party ad trackers.
                </p>
              </div>
            </div>

            {/* Buttons */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={decline}
                className="rounded-lg px-4 py-2 text-[12px] font-bold transition-colors"
                style={{ background: "#1A1A1A", color: "#666", border: "1px solid #2A2A2A" }}
                onMouseEnter={e => (e.currentTarget.style.color = "#999")}
                onMouseLeave={e => (e.currentTarget.style.color = "#666")}
              >
                Decline
              </button>
              <button
                onClick={accept}
                className="rounded-lg px-5 py-2 text-[12px] font-bold transition-all"
                style={{ background: "#FFD600", color: "#111" }}
                onMouseEnter={e => (e.currentTarget.style.opacity = "0.9")}
                onMouseLeave={e => (e.currentTarget.style.opacity = "1")}
              >
                Accept all
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}