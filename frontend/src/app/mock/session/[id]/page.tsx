"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { InterviewRoom } from "@/app/interview/[id]/live/page";
import CoachingOverlay from "@/components/CoachingOverlay";
import type { CoachingState } from "@/hooks/useCoaching";

const API_BASE = (process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:8000").replace(/\/$/, "");

type MockSession = {
  id: string;
  role_target: string;
  seniority: string;
  status: string;
  interview_id?: string | null;
};

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
    showSilenceNudge: false,
    currentHint: null as string | null,
    hintLevel: 0,
    fullTranscript: "",
    totalWords: 0,
    isAnswerActive: false,
    audioAgeMs: 0,
  });

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
    };
  }, [sessionId]);

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
    <InterviewRoom
      interviewId={interviewId}
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
  );
}
