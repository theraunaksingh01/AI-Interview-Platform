import { useEffect, useRef, useCallback } from 'react';

export interface CheatSignalEvent {
  signal_type: string;
  signal_category: 'A' | 'B' | 'C' | 'D';
  weight: 'low' | 'medium' | 'high';
  details: Record<string, any>;
  fired_at: number;
}

export interface SignalMetrics {
  answerStartTime: number;
  firstKeystrokeTime: number;
  totalAnswerTime: number;
  wordCount: number;
  keystrokeEvents: Array<{ timestamp: number; char?: string }>;
  pauseSegments: Array<{ start: number; duration: number }>;
  pasteEvents: Array<{ timestamp: number; length: number; target: string }>;
  tabFocusLosses: Array<{ timestamp: number; duration: number }>;
}

interface UseCheatSignalsProps {
  interviewId: string;
  isCompanyMode: boolean;
  isMockMode?: boolean;
  questionId?: string;
}

export function useCheatSignals({
  interviewId,
  isCompanyMode,
  isMockMode = false,
  questionId,
}: UseCheatSignalsProps) {
  const signalsRef = useRef<CheatSignalEvent[]>([]);
  const metricsRef = useRef<Map<number, SignalMetrics>>(new Map());
  const currentQuestionIdRef = useRef<number | null>(null);
  const tabLossStartRef = useRef<number | null>(null);
  const lastKeystrokeRef = useRef<number | null>(null);
  const interviewStartRef = useRef<number>(Date.now());

  // ===== CATEGORY C: Browser/Environment Signals =====

  /**
   * Track tab focus loss (window/tab switch)
   */
  const handleVisibilityChange = useCallback(() => {
    if (!isCompanyMode) return; // Only in company mode

    if (document.hidden) {
      tabLossStartRef.current = Date.now();
      addSignal({
        signal_type: 'TAB_FOCUS_LOST',
        signal_category: 'C',
        weight: 'high',
        details: {
          timestamp: Date.now(),
          questionId: currentQuestionIdRef.current,
          answerElapsed: getAnswerElapsedMs(),
        },
      });
    } else if (tabLossStartRef.current) {
      const duration = Date.now() - tabLossStartRef.current;
      if (duration > 2000) {
        // Flag if gone for more than 2 seconds
        addSignal({
          signal_type: 'TAB_FOCUS_RETURNED',
          signal_category: 'C',
          weight: duration > 5000 ? 'high' : 'medium',
          details: {
            timestamp: Date.now(),
            duration,
            questionId: currentQuestionIdRef.current,
          },
        });
      }
      tabLossStartRef.current = null;
    }
  }, [isCompanyMode]);

  /**
   * Detect paste events in input fields and code editors
   */
  const handlePaste = useCallback((e: ClipboardEvent) => {
    if (!isCompanyMode) return;

    const pastedText = e.clipboardData?.getData('text') || '';
    addSignal({
      signal_type: 'PASTE_EVENT',
      signal_category: 'C',
      weight: 'high',
      details: {
        timestamp: Date.now(),
        questionId: currentQuestionIdRef.current,
        target: (e.target as HTMLElement)?.tagName,
        pasteLength: pastedText.length,
      },
    });

    trackMetric('pasteEvents', {
      timestamp: Date.now(),
      length: pastedText.length,
      target: (e.target as HTMLElement)?.tagName,
    });
  }, [isCompanyMode]);

  /**
   * Detect keyboard inactivity followed by burst (copy-paste signature)
   */
  const handleKeystroke = useCallback(() => {
    if (!isCompanyMode) return;

    const now = Date.now();
    if (lastKeystrokeRef.current) {
      const gap = now - lastKeystrokeRef.current;

      // Long gap (>3s) followed by keystroke = potential paste
      if (gap > 3000) {
        addSignal({
          signal_type: 'KEYSTROKE_GAP',
          signal_category: 'C',
          weight: 'medium',
          details: {
            timestamp: now,
            gap_ms: gap,
            questionId: currentQuestionIdRef.current,
          },
        });
      }
    }

    lastKeystrokeRef.current = now;
    trackMetric('keystrokeEvents', {
      timestamp: now,
    });
  }, [isCompanyMode]);

  /**
   * Detect unusual IDE input pattern (code without keystroke history)
   * Call this from IDE component when code is submitted
   */
  const detectPasteInIDE = useCallback((code: string, keystrokeCount: number) => {
    if (!isCompanyMode) return;

    const codeLength = code.length;
    const expectedMinKeystrokes = Math.max(codeLength * 0.3, 10); // 30% of char count

    if (keystrokeCount < expectedMinKeystrokes) {
      addSignal({
        signal_type: 'UNUSUAL_IDE_INPUT',
        signal_category: 'C',
        weight: 'high',
        details: {
          timestamp: Date.now(),
          codeLength,
          keystrokeCount,
          expectedMinKeystrokes,
          ratio: keystrokeCount / codeLength,
          questionId: currentQuestionIdRef.current,
        },
      });
    }
  }, [isCompanyMode]);

  // ===== CATEGORY A: Behavioral Timing Signals =====

  /**
   * Track time to first word in voice response
   * Call from voice recorder when first audio detected
   */
  const trackAnswerStart = useCallback((questionId: number) => {
    currentQuestionIdRef.current = questionId;
    const metric: SignalMetrics = {
      answerStartTime: Date.now(),
      firstKeystrokeTime: 0,
      totalAnswerTime: 0,
      wordCount: 0,
      keystrokeEvents: [],
      pauseSegments: [],
      pasteEvents: [],
      tabFocusLosses: [],
    };
    metricsRef.current.set(questionId, metric);
  }, []);

  /**
   * Call when first word is detected in transcript
   */
  const trackFirstWord = useCallback((questionId: number) => {
    const metrics = metricsRef.current.get(questionId);
    if (metrics) {
      const timeToFirstWord = Date.now() - metrics.answerStartTime;

      // Category A: Time-to-first-word
      if (timeToFirstWord < 1500) {
        // <1.5s for complex questions
        addSignal({
          signal_type: 'TIME_TO_FIRST_WORD',
          signal_category: 'A',
          weight: 'high',
          details: {
            timestamp: Date.now(),
            timeToFirstWordMs: timeToFirstWord,
            questionId,
          },
        });
      }
      metrics.firstKeystrokeTime = Date.now();
    }
  }, []);

  /**
   * Analyze answer transcript for speech patterns
   * Call when answer is completed
   */
  const analyzeAnswerTiming = useCallback(
    (questionId: number, transcript: string, durationSeconds: number, wpm: number) => {
      const metrics = metricsRef.current.get(questionId);
      if (!metrics) return;

      metrics.totalAnswerTime = durationSeconds;
      metrics.wordCount = transcript.split(/\s+/).length;

      // Category A: Answer delivery speed
      if (wpm > 220) {
        // Consistent high WPM = AI reads faster
        addSignal({
          signal_type: 'HIGH_DELIVERY_SPEED',
          signal_category: 'A',
          weight: 'high',
          details: {
            timestamp: Date.now(),
            wpm,
            questionId,
            transcript: transcript.substring(0, 100), // First 100 chars for context
          },
        });
      }

      // Category B: Filler word analysis
      const fillerWords = ['um', 'uh', 'like', 'you know', 'basically', 'actually', 'actually'];
      const fillerCount = fillerWords.reduce((count, filler) => {
        return count + (transcript.toLowerCase().match(new RegExp(filler, 'g')) || []).length;
      }, 0);

      if (fillerCount === 0 && durationSeconds > 30) {
        // Zero filler words in long answer = suspicious
        addSignal({
          signal_type: 'FILLER_WORD_ABSENCE',
          signal_category: 'B',
          weight: 'medium',
          details: {
            timestamp: Date.now(),
            durationSeconds,
            questionId,
          },
        });
      }
    },
    []
  );

  /**
   * Detect hesitation patterns (micro-pauses)
   * Analyze transcript silence segments
   */
  const detectHesitationPattern = useCallback(
    (questionId: number, silenceSegments: Array<{ start: number; duration: number }>) => {
      const metrics = metricsRef.current.get(questionId);
      if (!metrics) return;

      const microPauses = silenceSegments.filter(
        (seg) => seg.duration >= 200 && seg.duration <= 500
      );

      if (microPauses.length === 0 && metrics.totalAnswerTime > 30) {
        // No hesitation in long answer
        addSignal({
          signal_type: 'NO_HESITATION_PATTERN',
          signal_category: 'A',
          weight: 'high',
          details: {
            timestamp: Date.now(),
            durationSeconds: metrics.totalAnswerTime,
            pauseCount: silenceSegments.length,
            questionId,
          },
        });
      }

      metrics.pauseSegments = silenceSegments;
    },
    []
  );

  // ===== CATEGORY B: Content Entropy (requires server-side NLP) =====

  /**
   * Submit transcript for server-side perplexity analysis
   * Server will compute: perplexity score, lexical diversity, sentence structure uniformity
   */
  const submitTranscriptForAnalysis = useCallback((questionId: number, transcript: string) => {
    // This will be called server-side during scoring
    // Store transcript for later ML analysis
    const metrics = metricsRef.current.get(questionId);
    if (metrics) {
      // Will be analyzed during scoring phase
      addSignal({
        signal_type: 'CONTENT_SUBMITTED_FOR_ANALYSIS',
        signal_category: 'B',
        weight: 'low',
        details: {
          timestamp: Date.now(),
          questionId,
          transcriptLength: transcript.length,
        },
      });
    }
  }, []);

  // ===== Utility Functions =====

  const getAnswerElapsedMs = useCallback(() => {
    const metrics = metricsRef.current.get(currentQuestionIdRef.current!);
    if (metrics) {
      return Date.now() - metrics.answerStartTime;
    }
    return 0;
  }, []);

  const addSignal = useCallback((signal: Omit<CheatSignalEvent, 'fired_at'>) => {
    const event: CheatSignalEvent = {
      ...signal,
      fired_at: Date.now(),
    };
    signalsRef.current.push(event);
  }, []);

  const trackMetric = useCallback(
    (key: keyof SignalMetrics, value: any) => {
      const metrics = metricsRef.current.get(currentQuestionIdRef.current!);
      if (metrics && key in metrics) {
        const arr = metrics[key] as any[];
        if (Array.isArray(arr)) {
          arr.push(value);
        }
      }
    },
    []
  );

  /**
   * Get all collected signals for submission
   */
  const getSignals = useCallback(() => {
    return signalsRef.current;
  }, []);

  /**
   * Get metrics for a specific question
   */
  const getMetrics = useCallback((questionId: number) => {
    return metricsRef.current.get(questionId);
  }, []);

  /**
   * Submit signals to backend
   */
  const submitSignals = useCallback(
    async (sessionId: string) => {
      if (!isCompanyMode || signalsRef.current.length === 0) return;

      try {
        const response = await fetch(`/api/interview/${sessionId}/signals`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            signals: signalsRef.current,
            metrics: Array.from(metricsRef.current.values()),
          }),
        });

        if (!response.ok) {
          console.error('Failed to submit cheat signals');
        }
      } catch (error) {
        console.error('Error submitting cheat signals:', error);
      }
    },
    [isCompanyMode]
  );

  /**
   * Clear all collected signals (for new interview or testing)
   */
  const clearSignals = useCallback(() => {
    signalsRef.current = [];
    metricsRef.current.clear();
  }, []);

  // Setup global event listeners
  useEffect(() => {
    if (!isCompanyMode || isMockMode) return;

    document.addEventListener('visibilitychange', handleVisibilityChange);
    document.addEventListener('paste', handlePaste);
    document.addEventListener('keydown', handleKeystroke);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      document.removeEventListener('paste', handlePaste);
      document.removeEventListener('keydown', handleKeystroke);
    };
  }, [isCompanyMode, isMockMode, questionId, handleVisibilityChange, handlePaste, handleKeystroke]);

  return {
    // Category A - Timing
    trackAnswerStart,
    trackFirstWord,
    analyzeAnswerTiming,
    detectHesitationPattern,

    // Category B - Content
    submitTranscriptForAnalysis,

    // Category C - Browser
    detectPasteInIDE,

    // Management
    getSignals,
    getMetrics,
    submitSignals,
    clearSignals,
  };
}
