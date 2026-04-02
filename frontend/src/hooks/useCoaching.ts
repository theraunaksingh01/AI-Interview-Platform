import { useCallback, useRef, useState } from "react";

export type WpmStatus = "good" | "fast" | "too_fast";

export interface CoachingState {
  wpm: number;
  wpmStatus: WpmStatus;
  fillerCounts: Record<string, number>;
  fullTranscript: string;
  totalWords: number;
}

const FILLER_WORDS = [
  "um",
  "uh",
  "like",
  "basically",
  "you know",
  "sort of",
  "kind of",
  "right",
  "so",
  "actually",
  "literally",
  "honestly",
];

const EMPTY_COUNTS: Record<string, number> = Object.fromEntries(
  FILLER_WORDS.map((f) => [f, 0])
);

function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function countWords(text: string): number {
  const cleaned = normalizeWhitespace(text);
  if (!cleaned) return 0;
  return cleaned.split(" ").length;
}

function nextWpmStatus(wpm: number): WpmStatus {
  if (wpm > 200) return "too_fast";
  if (wpm >= 160) return "fast";
  return "good";
}

function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function computeFillerCounts(text: string): Record<string, number> {
  const lower = text.toLowerCase();
  const out: Record<string, number> = { ...EMPTY_COUNTS };

  for (const filler of FILLER_WORDS) {
    const pattern = new RegExp(`\\b${escapeRegex(filler)}\\b`, "g");
    out[filler] = (lower.match(pattern) || []).length;
  }

  return out;
}

function appendDelta(prev: string, incoming: string): string {
  if (!incoming) return prev;
  if (!prev) return incoming;

  if (incoming.startsWith(prev)) {
    const delta = incoming.slice(prev.length).trim();
    return delta ? `${prev} ${delta}` : prev;
  }

  return `${prev} ${incoming}`;
}

export function useCoaching() {
  const answerStartMsRef = useRef<number | null>(null);
  const transcriptRef = useRef<string>("");

  const [state, setState] = useState<CoachingState>({
    wpm: 0,
    wpmStatus: "good",
    fillerCounts: { ...EMPTY_COUNTS },
    fullTranscript: "",
    totalWords: 0,
  });

  const resetAnswer = useCallback(() => {
    answerStartMsRef.current = null;
    transcriptRef.current = "";
    setState({
      wpm: 0,
      wpmStatus: "good",
      fillerCounts: { ...EMPTY_COUNTS },
      fullTranscript: "",
      totalWords: 0,
    });
  }, []);

  const startAnswer = useCallback(() => {
    answerStartMsRef.current = Date.now();
    transcriptRef.current = "";
    setState({
      wpm: 0,
      wpmStatus: "good",
      fillerCounts: { ...EMPTY_COUNTS },
      fullTranscript: "",
      totalWords: 0,
    });
  }, []);

  const ingestTranscriptChunk = useCallback((chunk: string) => {
    const incoming = normalizeWhitespace(chunk || "");
    if (!incoming) return;

    if (!answerStartMsRef.current) {
      answerStartMsRef.current = Date.now();
    }

    transcriptRef.current = normalizeWhitespace(
      appendDelta(transcriptRef.current, incoming)
    );

    const totalWords = countWords(transcriptRef.current);
    const elapsedMinutes = Math.max((Date.now() - answerStartMsRef.current) / 60000, 1 / 60000);
    const wpm = Math.round(totalWords / elapsedMinutes);

    setState({
      wpm,
      wpmStatus: nextWpmStatus(wpm),
      fillerCounts: computeFillerCounts(transcriptRef.current),
      fullTranscript: transcriptRef.current,
      totalWords,
    });
  }, []);

  return {
    coaching: state,
    transcriptRef,
    startAnswer,
    resetAnswer,
    ingestTranscriptChunk,
  };
}
