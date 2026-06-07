// frontend/src/hooks/useInterruption.ts
/**
 * Smart Interruption Hook
 *
 * Detects when a student's answer needs a nudge using the
 * same live data as useCoaching (WPM, fillers, silence, transcript).
 *
 * Calls the backend to generate a contextual Claude directive,
 * falls back to predefined directives if the call fails.
 *
 * Rules:
 * - Never fire in first 15 seconds of an answer
 * - Max 1 interruption per question
 * - Max 3 interruptions per session
 * - Min 20s gap between interruptions
 * - Suppress if delivery nudge fired in last 15s
 */

import { useCallback, useEffect, useRef, useState } from "react";

const API_BASE = (
  process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:8000"
).replace(/\/$/, "");

// ─── Types ────────────────────────────────────────────────────────────────────

export type TriggerType =
  | "VAGUE"
  | "BREADTH_DUMP"
  | "STALLING"
  | "SILENCE"
  | "RAMBLING"
  | "DELIVERY";

export interface Interruption {
  text: string;
  trigger: TriggerType;
  isFallback: boolean;
  timestamp: number;
}

interface UseInterruptionOptions {
  questionText: string;
  role?: string;
  company?: string;
  enabled?: boolean;           // false for free tier
  questionId?: number | null;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const TECH_KEYWORDS = new Set([
  "array", "hashmap", "hash map", "hashtable", "tree", "graph", "queue",
  "stack", "heap", "linked list", "trie", "binary search", "sql", "nosql",
  "postgres", "mysql", "mongodb", "redis", "api", "rest", "grpc", "kafka",
  "docker", "kubernetes", "microservices", "cache", "caching", "sharding",
  "replication", "o(n)", "o(log", "complexity", "latency", "throughput",
  "neural", "embedding", "transformer", "inference", "gradient", "model",
  "index", "query", "transaction", "acid", "load balancer", "cdn",
]);

const FILLER_SET = new Set([
  "basically", "you know", "like", "actually", "sort of", "kind of",
  "um", "uh", "er", "hmm", "i mean", "so yeah",
]);

const FALLBACKS: Record<TriggerType, string[]> = {
  VAGUE:        ["Be specific about that last part.", "Give me a concrete example.", "Walk me through the actual steps."],
  BREADTH_DUMP: ["Pick one and go deeper on it.", "Focus on the most important one.", "Which of those matters most?"],
  STALLING:     ["Take a moment, then give me your core idea.", "What's the first concrete step?", "Start with what you're sure about."],
  SILENCE:      ["It's okay to think out loud.", "Start with what comes to mind first.", "Even a partial answer is fine."],
  RAMBLING:     ["Try to wrap up your main point.", "Summarize that in one sentence.", "What's the key takeaway?"],
  DELIVERY:     ["Try to slow down a bit.", "Watch the filler words — try pausing instead."],
};

function randomFrom(arr: string[]): string {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useInterruption({
  questionText,
  role = "Software Engineer",
  company = "the company",
  enabled = true,
  questionId,
}: UseInterruptionOptions) {
  const [activeInterruption, setActiveInterruption] = useState<Interruption | null>(null);

  // Session-level counters
  const sessionCountRef    = useRef(0);   // max 3
  const questionCountRef   = useRef(0);   // max 1 per question
  const lastInterruptTs    = useRef(0);   // last content interruption
  const lastDeliveryTs     = useRef(0);   // last delivery nudge
  const answerStartTs      = useRef(0);   // when current answer started
  const firedTriggersRef   = useRef(new Set<TriggerType>());
  const isGeneratingRef    = useRef(false);

  // Reset per-question state when question changes
  useEffect(() => {
    questionCountRef.current = 0;
    firedTriggersRef.current = new Set();
    answerStartTs.current = 0;
    setActiveInterruption(null);
  }, [questionId]);

  const markAnswerStart = useCallback(() => {
    if (!answerStartTs.current) {
      answerStartTs.current = Date.now();
    }
  }, []);

  const canInterrupt = useCallback((): boolean => {
    if (!enabled) return false;
    if (sessionCountRef.current >= 3) return false;
    if (questionCountRef.current >= 1) return false;
    const now = Date.now();
    if (now - lastInterruptTs.current < 20_000) return false;
    if (now - lastDeliveryTs.current < 15_000) return false;
    return true;
  }, [enabled]);

  const detectTrigger = useCallback((
    transcript: string,
    speakingSecs: number,
    silenceSecs: number,
    wpm: number,
    fillerCount: number,
  ): TriggerType | null => {
    // Never fire in first 15 seconds
    if (speakingSecs < 15) return null;

    const words = transcript.toLowerCase().split(/\s+/);
    const candidates: TriggerType[] = [];

    // SILENCE
    if (
      silenceSecs >= 6 &&
      words.length > 5 &&
      !firedTriggersRef.current.has("SILENCE")
    ) {
      candidates.push("SILENCE");
    }

    // STALLING — count filler words in recent ~30 words
    const recent30 = words.slice(-30).join(" ");
    const fillerHits = [...FILLER_SET].filter(f => recent30.includes(f)).length;
    if (
      fillerHits >= 3 &&
      speakingSecs >= 15 &&
      !firedTriggersRef.current.has("STALLING")
    ) {
      candidates.push("STALLING");
    }

    // VAGUE — 30+ seconds with no tech keyword or number
    if (
      speakingSecs >= 30 &&
      !firedTriggersRef.current.has("VAGUE")
    ) {
      const last60 = new Set(words.slice(-60));
      const hasTech = [...TECH_KEYWORDS].some(kw =>
        kw.split(" ").every(w => last60.has(w)) ||
        [...last60].some(w => w.includes(kw.split(" ")[0]))
      );
      const hasNumber = [...last60].some(w => /\d/.test(w));
      if (!hasTech && !hasNumber) {
        candidates.push("VAGUE");
      }
    }

    // BREADTH_DUMP — many items listed without depth
    if (
      speakingSecs >= 20 &&
      !firedTriggersRef.current.has("BREADTH_DUMP")
    ) {
      const recent40 = words.slice(-40);
      const andCount = recent40.filter(w => w === "and").length;
      const commaCount = transcript.slice(-200).split(",").length - 1;
      if (andCount >= 4 || commaCount >= 3) {
        candidates.push("BREADTH_DUMP");
      }
    }

    // RAMBLING — 90+ seconds
    if (
      speakingSecs >= 90 &&
      !firedTriggersRef.current.has("RAMBLING")
    ) {
      candidates.push("RAMBLING");
    }

    if (candidates.length === 0) return null;

    // Priority: SILENCE > STALLING > VAGUE > BREADTH_DUMP > RAMBLING
    const priority: TriggerType[] = ["SILENCE", "STALLING", "VAGUE", "BREADTH_DUMP", "RAMBLING"];
    return priority.find(p => candidates.includes(p)) || null;
  }, []);

  const generateAndShow = useCallback(async (
    trigger: TriggerType,
    transcript: string,
  ) => {
    if (isGeneratingRef.current) return;
    isGeneratingRef.current = true;

    try {
      let text = randomFrom(FALLBACKS[trigger] || FALLBACKS.VAGUE);
      let isFallback = true;

      try {
        const res = await fetch(`${API_BASE}/api/interview/interruption`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            question: questionText,
            transcript_so_far: transcript.slice(-600),
            trigger_type: trigger,
            role,
            company,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data?.directive && typeof data.directive === "string") {
            text = data.directive;
            isFallback = data.is_fallback ?? false;
          }
        }
      } catch {
        // Use fallback
      }

      const interruption: Interruption = {
        text,
        trigger,
        isFallback,
        timestamp: Date.now(),
      };

      // Update counters
      sessionCountRef.current += 1;
      questionCountRef.current += 1;
      lastInterruptTs.current = Date.now();
      firedTriggersRef.current.add(trigger);

      setActiveInterruption(interruption);

      // Auto-dismiss after 5 seconds
      setTimeout(() => {
        setActiveInterruption(prev =>
          prev?.timestamp === interruption.timestamp ? null : prev
        );
      }, 5000);

    } finally {
      isGeneratingRef.current = false;
    }
  }, [questionText, role, company]);

  const checkDelivery = useCallback((wpm: number, fillerCount: number): boolean => {
    const now = Date.now();
    if (now - lastInterruptTs.current < 15_000) return false;

    let text: string | null = null;
    if (wpm > 170) text = "You're speaking a bit fast — try to slow down.";
    else if (wpm < 90 && wpm > 0) text = "You can pick up the pace a little.";
    else if (fillerCount >= 5) text = "Watch the filler words — try pausing instead.";

    if (!text) return false;

    lastDeliveryTs.current = now;
    setActiveInterruption({
      text,
      trigger: "DELIVERY",
      isFallback: true,
      timestamp: now,
    });
    setTimeout(() => setActiveInterruption(null), 4000);
    return true;
  }, []);

  /**
   * Main function — call this on every coaching state update.
   * Pass the live values from useCoaching.
   */
  const evaluate = useCallback((params: {
    transcript: string;
    speakingSecs: number;
    silenceSecs: number;
    wpm: number;
    fillerCount: number;
  }) => {
    if (!enabled) return;
    if (!answerStartTs.current) return; // answer hasn't started

    const { transcript, speakingSecs, silenceSecs, wpm, fillerCount } = params;

    // Check delivery first (no Claude call, instant)
    if (checkDelivery(wpm, fillerCount)) return;

    // Check content triggers
    if (!canInterrupt()) return;

    const trigger = detectTrigger(transcript, speakingSecs, silenceSecs, wpm, fillerCount);
    if (!trigger) return;

    // Fire async — don't await
    generateAndShow(trigger, transcript);
  }, [enabled, canInterrupt, detectTrigger, checkDelivery, generateAndShow]);

  const dismiss = useCallback(() => {
    setActiveInterruption(null);
  }, []);

  const resetSession = useCallback(() => {
    sessionCountRef.current = 0;
    questionCountRef.current = 0;
    lastInterruptTs.current = 0;
    lastDeliveryTs.current = 0;
    answerStartTs.current = 0;
    firedTriggersRef.current = new Set();
    setActiveInterruption(null);
  }, []);

  return {
    activeInterruption,
    markAnswerStart,
    evaluate,
    dismiss,
    resetSession,
  };
}