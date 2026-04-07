import { useCallback, useRef, useState } from "react";
import { useEffect } from "react";

export type WpmStatus = "good" | "fast" | "too_fast";

export interface CoachingState {
  wpm: number;
  wpmStatus: WpmStatus;
  fillerCounts: Record<string, number>;
  currentSilenceSecs: number;
  showSilenceNudge: boolean;
  currentHint: string | null;
  hintLevel: 0 | 1 | 2;
  fullTranscript: string;
  totalWords: number;
  isAnswerActive: boolean;
  audioAgeMs: number;
}

interface UseCoachingOptions {
  isCodingQuestion?: boolean;
  questionText?: string;
  sessionId?: string;
  currentQuestionId?: number | null;
  questionType?: string;
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

const API_BASE = (
  process.env.NEXT_PUBLIC_API_URL ||
  process.env.NEXT_PUBLIC_API_BASE ||
  "http://127.0.0.1:8000"
).replace(/\/$/, "");

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

export function useCoaching(options: UseCoachingOptions = {}) {
  const {
    isCodingQuestion = false,
    questionText = "",
    sessionId = "",
    currentQuestionId = null,
    questionType = "",
  } = options;
  const answerStartMsRef = useRef<number | null>(null);
  const transcriptRef = useRef<string>("");
  const audioActivityRef = useRef<number>(Date.now());
  const lastAudioActivityCall = useRef<number>(0);
  const ideLastActivityRef = useRef<number>(Date.now());
  const [isAnswerActive, setIsAnswerActive] = useState(false);

  const [state, setState] = useState<CoachingState>({
    wpm: 0,
    wpmStatus: "good",
    fillerCounts: { ...EMPTY_COUNTS },
    currentSilenceSecs: 0,
    showSilenceNudge: false,
    currentHint: null,
    hintLevel: 0,
    fullTranscript: "",
    totalWords: 0,
    isAnswerActive: false,
    audioAgeMs: 0,
  });

  const fetchHint = useCallback(async (hintLevel: 1 | 2): Promise<string | null> => {
    if (!sessionId || !questionText.trim()) return null;

    try {
      console.log("[coaching] API_BASE:", API_BASE);
      console.log("[coaching] hint request to:", `${API_BASE}/api/mock/hint`);
      const res = await fetch(`${API_BASE}/api/mock/hint`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question_text: questionText,
          hint_level: hintLevel,
          session_id: sessionId,
        }),
      });

      if (!res.ok) return null;
      const data = await res.json();
      const hint = typeof data?.hint === "string" ? data.hint.trim() : "";
      return hint || null;
    } catch {
      return null;
    }
  }, [questionText, sessionId]);

  const setHintState = useCallback((hint: string | null, level: 0 | 1 | 2) => {
    setState((prev) => ({
      ...prev,
      currentHint: hint,
      hintLevel: level,
    }));
  }, []);

  const resetAnswer = useCallback(() => {
    answerStartMsRef.current = null;
    transcriptRef.current = "";
    audioActivityRef.current = Date.now();
    ideLastActivityRef.current = Date.now();
    setIsAnswerActive(false);
    setState({
      wpm: 0,
      wpmStatus: "good",
      fillerCounts: { ...EMPTY_COUNTS },
      currentSilenceSecs: 0,
      showSilenceNudge: false,
      currentHint: null,
      hintLevel: 0,
      fullTranscript: "",
      totalWords: 0,
      isAnswerActive: false,
      audioAgeMs: 0,
    });
  }, []);

  const startAnswer = useCallback(() => {
    answerStartMsRef.current = Date.now();
    transcriptRef.current = "";
    audioActivityRef.current = Date.now();
    ideLastActivityRef.current = Date.now();
    setIsAnswerActive(true);
    setState({
      wpm: 0,
      wpmStatus: "good",
      fillerCounts: { ...EMPTY_COUNTS },
      currentSilenceSecs: 0,
      showSilenceNudge: false,
      currentHint: null,
      hintLevel: 0,
      fullTranscript: "",
      totalWords: 0,
      isAnswerActive: true,
      audioAgeMs: 0,
    });
  }, []);

  const onIdeActivity = useCallback(() => {
    ideLastActivityRef.current = Date.now();
  }, []);

  const onAudioActivity = useCallback(() => {
    const now = Date.now();
    if (now - lastAudioActivityCall.current < 500) return;
    console.log('[audio] activity fired, rms must be > threshold');
    lastAudioActivityCall.current = now;
    audioActivityRef.current = now;
    setState((prev) => ({
      ...prev,
      currentSilenceSecs: 0,
      showSilenceNudge: false,
      audioAgeMs: 0,
    }));
  }, []);

  const ingestTranscriptChunk = useCallback((fullTranscript: string) => {
    // Replace entire transcript — not append — because speech recognition
    // sends cumulative text, not deltas
    if (!answerStartMsRef.current) {
      answerStartMsRef.current = Date.now();
    }

    transcriptRef.current = normalizeWhitespace(fullTranscript || "");

    const totalWords = countWords(transcriptRef.current);
    const elapsedMinutes = (Date.now() - answerStartMsRef.current) / 60000;
    const wpm = elapsedMinutes > 0.1 ? Math.round(totalWords / elapsedMinutes) : 0;

    setState((prev) => ({
      ...prev,
      wpm,
      wpmStatus: nextWpmStatus(wpm),
      fillerCounts: computeFillerCounts(transcriptRef.current),
      totalWords,
      fullTranscript: transcriptRef.current,
    }));
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      if (!isAnswerActive) {
        console.log('[silence] interval tick — isAnswerActive=false, skipping');
        return;
      }

      const silence = Math.floor((Date.now() - audioActivityRef.current) / 1000);
      const audioAge = Date.now() - audioActivityRef.current;
      console.log('[silence] tick — silence=', silence, 'isAnswerActive=', isAnswerActive);

      setState((prev) => ({
        ...prev,
        currentSilenceSecs: silence,
        showSilenceNudge: silence >= 12,
        audioAgeMs: audioAge,
      }));
    }, 1000);

    return () => clearInterval(interval);
  }, [isAnswerActive]);

  useEffect(() => {
    setState((prev) => ({
      ...prev,
      isAnswerActive,
    }));
  }, [isAnswerActive]);

  useEffect(() => {
    if (!isAnswerActive) return;

    const check = setTimeout(() => {
      const secs = (Date.now() - audioActivityRef.current) / 1000;
      if (secs > 3) {
        console.warn("[coaching] No audio activity detected 3s after answer start - onAudioActivity may not be wired");
      }
    }, 3000);

    return () => clearTimeout(check);
  }, [isAnswerActive]);

  useEffect(() => {
    console.log("[coaching] isCodingQuestion:", isCodingQuestion, "questionType:", questionType);
  }, [isCodingQuestion, questionType]);

  useEffect(() => {
    ideLastActivityRef.current = Date.now();
    setHintState(null, 0);
  }, [currentQuestionId, setHintState]);

  useEffect(() => {
    if (!isCodingQuestion || !questionText.trim() || !sessionId) return;

    const interval = setInterval(async () => {
      const secsSinceActivity = (Date.now() - ideLastActivityRef.current) / 1000;

      if (secsSinceActivity >= 180 && state.hintLevel < 2) {
        const nextLevel = (state.hintLevel + 1) as 1 | 2;
        const hint = await fetchHint(nextLevel);
        if (hint) setHintState(hint, nextLevel);
        return;
      }

      if (secsSinceActivity >= 90 && state.hintLevel < 1) {
        const hint = await fetchHint(1);
        if (hint) setHintState(hint, 1);
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [fetchHint, isCodingQuestion, questionText, sessionId, setHintState, state.hintLevel]);

  return {
    coaching: state,
    transcriptRef,
    startAnswer,
    resetAnswer,
    ingestTranscriptChunk,
    onIdeActivity,
    onAudioActivity,
  };
}
