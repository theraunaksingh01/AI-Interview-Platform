"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
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
  const router = useRouter();
  const sessionId = id;
  const [session, setSession] = useState<MockSession | null>(null);
  const [interviewId, setInterviewId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCompletion, setShowCompletion] = useState(false);
  const [reportReady, setReportReady] = useState(false);
  const [completionStats, setCompletionStats] = useState<{ answeredCount: number; elapsedMs: number }>({
    answeredCount: 0,
    elapsedMs: 0,
  });
  const silenceBannerShown = useRef(false);
  const [showSilenceBanner, setShowSilenceBanner] = useState(false);

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
      } catch (e: unknown) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Network error");
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
      if (
        coachingState.currentSilenceSecs >= 12 &&
        coachingState.isAnswerActive &&
        !silenceBannerShown.current
      ) {
        silenceBannerShown.current = true;
        setShowSilenceBanner(true);
        setTimeout(() => {
          setShowSilenceBanner(false);
          silenceBannerShown.current = false;
        }, 4000);
      }
    }, [coachingState.currentSilenceSecs, coachingState.isAnswerActive]);


  useEffect(() => {
    if (session?.status === "completed") {
      sessionActiveRef.current = false;
    }
  }, [session?.status]);

  useEffect(() => {
    if (!showCompletion) return;

    let cancelled = false;

    const checkReport = async () => {
      try {
        const res = await fetch(`/api/mock/report/${sessionId}`);
        if (!res.ok) return;
        const data = await res.json().catch(() => ({}));
        if (!cancelled && data?.coaching_pending === false) {
          setReportReady(true);
          window.clearInterval(intervalId);
        }
      } catch {
        // keep polling until ready
      }
    };

    void checkReport();
    const intervalId = window.setInterval(checkReport, 5000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [sessionId, showCompletion]);

  function handleMockComplete(stats: { answeredCount: number; elapsedMs: number }) {
    setCompletionStats(stats);
    setShowCompletion(true);
    setReportReady(false);
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
            debug={false}
          />

        }
        onMockSessionComplete={handleMockComplete}
      />

      {/* Silence notification banner */}
      {showSilenceBanner && (
        <div
          className="fixed top-16 left-1/2 -translate-x-1/2 z-50 w-[90%] max-w-sm"
          style={{ animation: "slideDown 300ms ease" }}
        >
          <div className="flex items-center gap-3 rounded-2xl bg-[#111] px-4 py-3 shadow-xl">
            <span className="text-[18px]">🤫</span>
            <div className="flex-1">
              <p className="text-[13px] font-bold text-white leading-tight">
                Still thinking? That's okay.
              </p>
              <p className="text-[11px] text-[#666] mt-0.5">
                Start with what you know — even partial is fine.
              </p>
            </div>
          </div>
          <style>{`
      @keyframes slideDown {
        from { opacity: 0; transform: translate(-50%, -8px); }
        to { opacity: 1; transform: translate(-50%, 0); }
      }
    `}</style>
        </div>
      )}

      {showCompletion && (
        <div className="fixed inset-0 bg-[#FFFDF0] z-50 flex items-center justify-center p-6">
          <div className="max-w-sm w-full text-center">
            <div className="w-24 h-24 mx-auto mb-8 rounded-full bg-[#FFD600] flex items-center justify-center">
              <svg className="w-12 h-12 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
            </div>

            <h1 className="text-4xl font-black text-gray-900 mb-3 tracking-tight">Session complete</h1>

            <p className="text-gray-500 mb-2 text-base">Your coaching report is being generated.</p>
            <p className="text-gray-400 text-sm mb-10">This takes about 30 seconds — your report will have per-question feedback and model answers.</p>

            <div className="flex justify-center gap-8 mb-10">
              <div className="text-center">
                <p className="text-3xl font-black text-gray-900">{completionStats.answeredCount}</p>
                <p className="text-xs text-gray-400 mt-1">Questions</p>
              </div>
              <div className="w-px bg-gray-200" />
              <div className="text-center">
                <p className="text-3xl font-black text-gray-900">{Math.max(1, Math.round(completionStats.elapsedMs / 60000))}m</p>
                <p className="text-xs text-gray-400 mt-1">Time taken</p>
              </div>
            </div>

            <button
              onClick={() => router.push(`/mock/report/${sessionId}`)}
              className="w-full py-4 bg-black text-white rounded-2xl font-bold text-base hover:bg-gray-800 transition-colors"
            >
              {reportReady ? (
                <span className="inline-flex items-center justify-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 animate-pulse" />
                  Report ready → View now
                </span>
              ) : (
                "View my report →"
              )}
            </button>

            <p className="mt-4 text-xs text-gray-400">You can also wait here — we'll tell you when it's ready</p>
          </div>
        </div>
      )}
    </>
  );
}