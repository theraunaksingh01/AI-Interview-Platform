"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { InterviewRoom } from "@/app/interview/[id]/live/page";
import CoachingOverlay from "@/components/CoachingOverlay";
import RetryOverlay from "@/components/RetryOverlay";
import type { CoachingState } from "@/hooks/useCoaching";

const API_BASE = (process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:8000").replace(/\/$/, "");

type MockSession = {
  id: string;
  role_target: string;
  seniority: string;
  status: string;
  interview_id?: string | null;
};

interface RetryState {
  show: boolean;
  questionId: number;
  questionText: string | null;
  previousAnswerId: number;
  previousScore: number;
  attemptNumber: number;
  specificFix: string | null;
  coachingNote: string | null;
  whatImproved: string | null;
  stillNeedsWork: string | null;
  idealAnswer: string | null;
}

export default function MockSessionPage() {
  const { id } = useParams() as { id: string };
  const sessionId = id;
  const [session, setSession] = useState<MockSession | null>(null);
  const [interviewId, setInterviewId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [coachingState, setCoachingState] = useState<CoachingState>({
    wpm: 0,
    wpmStatus: "good",
    fillerCounts: {} as Record<string, number>,
    currentSilenceSecs: 0,
    silenceGapCount: 0,
    showSilenceNudge: false,
    currentHint: null as string | null,
    hintLevel: 0,
    fullTranscript: "",
    totalWords: 0,
    isAnswerActive: false,
    audioAgeMs: 0,
  });
  const [retryState, setRetryState] = useState<RetryState | null>(null);
  const sessionActiveRef = useRef(true);

  useEffect(() => {
    let cancelled = false;

    const cachedInterviewId =
      typeof window !== "undefined" ? localStorage.getItem("mock_interview_id") : null;
    if (cachedInterviewId && !cancelled) {
      setInterviewId(cachedInterviewId);
    }

    async function loadSession() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`${API_BASE}/api/mock/session/${sessionId}`, { method: "GET" });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body?.detail || "Unable to load mock session");
        }
        const data = (await res.json()) as MockSession;
        if (!cancelled) {
          setSession(data);
          if (data.status === "completed") {
            sessionActiveRef.current = false;
          }
          if (data.interview_id) {
            setInterviewId(data.interview_id);
            if (typeof window !== "undefined") {
              localStorage.setItem("mock_session_id", sessionId);
              localStorage.setItem("mock_interview_id", data.interview_id);
            }
          }
        }
      } catch (e: any) {
        if (!cancelled) setError(e?.message || "Network error");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadSession();
    return () => {
      cancelled = true;
      sessionActiveRef.current = false;
    };
  }, [sessionId]);

  useEffect(() => {
    if (session?.status === "completed") {
      sessionActiveRef.current = false;
    }
  }, [session?.status]);

  async function pollForAnswerScore(
    questionId: number,
    answerId: number | null,
    maxAttempts: number = 20,
    intervalMs: number = 2000
  ) {
    await new Promise((resolve) => setTimeout(resolve, 8000));

    for (let i = 0; i < maxAttempts; i += 1) {
      if (!sessionActiveRef.current) return;

      await new Promise((resolve) => setTimeout(resolve, intervalMs));

      if (!sessionActiveRef.current) return;

      try {
        const res = await fetch(`${API_BASE}/api/mock/retry-context/${questionId}`);
        if (!res.ok) continue;

        const data = await res.json();

        if (data.latest_score !== null && data.latest_score !== undefined) {
          if (data.latest_score < 70) {
            setRetryState({
              show: true,
              questionId,
              questionText: data.question_text || null,
              previousAnswerId: data.answer_id || answerId || 0,
              previousScore: data.latest_score,
              attemptNumber: 1,
              specificFix: data.specific_fix || null,
              coachingNote: null,
              whatImproved: null,
              stillNeedsWork: null,
              idealAnswer: null,
              questionText: data.question_text || null,
            });
          }
          return;
        }
      } catch {
        // Network error, keep polling.
      }
    }
  }

  useEffect(() => {
    async function handleAnswerSubmitted(e: Event) {
      const customEvent = e as CustomEvent<{ questionId?: number; answerId?: number | null }>;
      const { questionId, answerId } = customEvent.detail || {};
      if (!questionId) return;

      void pollForAnswerScore(questionId, answerId ?? 0);
    }

    window.addEventListener("mock:answer:submitted", handleAnswerSubmitted as EventListener);
    return () => window.removeEventListener("mock:answer:submitted", handleAnswerSubmitted as EventListener);
  }, []);

  // ── Handle retry submission ──
  async function handleRetry(transcript: string) {
    if (!retryState) return;

    try {
      const resp = await fetch(`${API_BASE}/api/mock/retry`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: sessionId,
          question_id: retryState.questionId,
          previous_answer_id: retryState.previousAnswerId,
          transcript: transcript,
          attempt_number: retryState.attemptNumber + 1,
        }),
      });

      if (!resp.ok) {
        setRetryState(null);
        return;
      }

      const data = await resp.json();

      if (data.can_retry) {
        // Update retry state for another attempt
        setRetryState({
          show: true,
          questionId: retryState.questionId,
          questionText: data.question_text || retryState.questionText,
          previousAnswerId: data.answer_id,
          previousScore: data.scores.overall,
          attemptNumber: retryState.attemptNumber + 1,
          specificFix: data.specific_fix || null,
          coachingNote: data.coaching_note || null,
          whatImproved: data.what_improved || null,
          stillNeedsWork: data.still_needs_work || null,
          idealAnswer: data.ideal_answer_example || null,
        });
      } else {
        // Max attempts or score good enough — dismiss
        setRetryState(null);
      }
    } catch (err) {
      console.error("[Retry] Error submitting retry:", err);
      setRetryState(null);
    }
  }

  if (loading) {
    return <main className="mx-auto max-w-4xl p-8">Loading mock session...</main>;
  }

  if (!session) {
    return (
      <main className="mx-auto max-w-4xl p-8">
        <h1 className="text-2xl font-semibold">Unable to load mock session</h1>
        <p className="mt-2 text-red-700">{error || "Session not found"}</p>
      </main>
    );
  }

  if (!interviewId) {
    return (
      <main className="mx-auto max-w-4xl p-8">
        <h1 className="text-2xl font-semibold">Mock interview is not ready yet</h1>
        <p className="mt-2 text-red-700">Interview session ID is missing. Please restart the mock session.</p>
      </main>
    );
  }

  return (
    <>
      <InterviewRoom
        interviewId={interviewId}
        mockSessionId={sessionId}
        isMockMode={true}
        isCompanyMode={false}
        renderCoachingOverlay={false}
        onCoachingUpdate={setCoachingState}
        rightPane={
          <CoachingOverlay
            wpm={coachingState.wpm}
            wpmStatus={coachingState.wpmStatus}
            fillerCounts={coachingState.fillerCounts}
            currentSilenceSecs={coachingState.currentSilenceSecs}
            showSilenceNudge={coachingState.showSilenceNudge}
            currentHint={coachingState.currentHint}
            hintLevel={coachingState.hintLevel}
            isAnswerActive={coachingState.isAnswerActive}
            audioAgeMs={coachingState.audioAgeMs}
            debug={true}
          />
        }
      />

      {retryState?.show && (
        <RetryOverlay
          questionText={retryState.questionText || ""}
          questionId={retryState.questionId}
          previousAnswerId={retryState.previousAnswerId}
          previousScore={retryState.previousScore}
          attemptNumber={retryState.attemptNumber}
          specificFix={retryState.specificFix}
          coachingNote={retryState.coachingNote}
          whatImproved={retryState.whatImproved}
          stillNeedsWork={retryState.stillNeedsWork}
          idealAnswer={retryState.idealAnswer}
          onRetry={handleRetry}
          onNext={() => setRetryState(null)}
          sessionId={sessionId}
        />
      )}
    </>
  );
}
