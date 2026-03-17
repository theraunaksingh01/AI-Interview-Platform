"use client";

import { useEffect, useRef, useState, useCallback } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000";

/**
 * Comprehensive anti-cheat hook for interview pages.
 *
 * Detects: tab-switch, window blur, paste, copy, right-click,
 * devtools open (heuristic), and fullscreen exit.
 *
 * Returns { flags, addFlag } — the component can also manually
 * push flags (e.g. Monaco editor paste).
 */
export function useAntiCheat(opts: {
  /** If true, block paste events on the document (default: false) */
  blockPaste?: boolean;
  /** If true, block copy events on the document (default: false) */
  blockCopy?: boolean;
  /** If true, block right-click context menu (default: true) */
  blockContextMenu?: boolean;
  /** If true, detect DevTools open via heuristic (default: true) */
  detectDevTools?: boolean;
} = {}) {
  const {
    blockPaste = false,
    blockCopy = false,
    blockContextMenu = true,
    detectDevTools = true,
  } = opts;

  const flagsRef = useRef<string[]>([]);
  const [flags, setFlags] = useState<string[]>([]);
  const devToolsFired = useRef(false);

  const addFlag = useCallback((f: string) => {
    flagsRef.current = [...flagsRef.current, f];
    setFlags(flagsRef.current.slice(-8));
  }, []);

  // ── Tab switch / window blur ───────────────────────────────────
  useEffect(() => {
    const onVis = () => {
      if (document.hidden) addFlag("tab-switch");
    };
    const onBlur = () => addFlag("window-blur");

    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("blur", onBlur);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("blur", onBlur);
    };
  }, [addFlag]);

  // ── Paste detection ────────────────────────────────────────────
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      addFlag("paste");
      if (blockPaste) {
        e.preventDefault();
      }
    };
    document.addEventListener("paste", onPaste, true); // capture phase
    return () => document.removeEventListener("paste", onPaste, true);
  }, [addFlag, blockPaste]);

  // ── Copy detection ─────────────────────────────────────────────
  useEffect(() => {
    const onCopy = (e: ClipboardEvent) => {
      addFlag("copy");
      if (blockCopy) {
        e.preventDefault();
      }
    };
    document.addEventListener("copy", onCopy, true);
    return () => document.removeEventListener("copy", onCopy, true);
  }, [addFlag, blockCopy]);

  // ── Right-click / context menu ─────────────────────────────────
  useEffect(() => {
    if (!blockContextMenu) return;
    const onCtx = (e: MouseEvent) => {
      addFlag("right-click");
      e.preventDefault();
    };
    document.addEventListener("contextmenu", onCtx);
    return () => document.removeEventListener("contextmenu", onCtx);
  }, [addFlag, blockContextMenu]);

  // ── DevTools heuristic (debugger timing) ───────────────────────
  useEffect(() => {
    if (!detectDevTools) return;
    const interval = setInterval(() => {
      const t0 = performance.now();
      // eslint-disable-next-line no-debugger
      debugger;
      const dt = performance.now() - t0;
      if (dt > 100 && !devToolsFired.current) {
        devToolsFired.current = true;
        addFlag("devtools-open");
      }
    }, 4000);
    return () => clearInterval(interval);
  }, [addFlag, detectDevTools]);

  // ── Keyboard shortcut detection (F12, Ctrl+Shift+I/J/C) ───────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "F12") {
        addFlag("devtools-shortcut");
        e.preventDefault();
      }
      if (e.ctrlKey && e.shiftKey && ["I", "J", "C"].includes(e.key.toUpperCase())) {
        addFlag("devtools-shortcut");
        e.preventDefault();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [addFlag]);

  // ── Fullscreen exit detection ──────────────────────────────────
  useEffect(() => {
    let wasFullscreen = !!document.fullscreenElement;
    const onFsChange = () => {
      const isFullscreen = !!document.fullscreenElement;
      if (wasFullscreen && !isFullscreen) {
        addFlag("fullscreen-exit");
      }
      wasFullscreen = isFullscreen;
    };
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, [addFlag]);

  // ── Persist flags to backend ───────────────────────────────────
  const submitFlags = useCallback(
    async (questionId: number, token?: string | null) => {
      if (!flagsRef.current.length) return;
      const unique = Array.from(new Set(flagsRef.current));
      try {
        await fetch(`${API_BASE}/interview/flags`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ question_id: questionId, flags: unique }),
        });
      } catch {
        // silently fail — don't disrupt interview
      }
    },
    [],
  );

  /** Reset flags (e.g. on new question) */
  const resetFlags = useCallback(() => {
    flagsRef.current = [];
    setFlags([]);
    devToolsFired.current = false;
  }, []);

  return { flags, flagsRef, addFlag, submitFlags, resetFlags };
}
