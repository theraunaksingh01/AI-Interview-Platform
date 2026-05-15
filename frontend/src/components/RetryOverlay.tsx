"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, AlertCircle, Lightbulb, ChevronDown, ChevronUp, Loader } from "lucide-react";

interface RetryOverlayProps {
  questionText: string;
  questionId: number;
  previousAnswerId: number;
  previousScore: number;
  attemptNumber: number;
  specificFix: string | null;
  coachingNote: string | null;
  whatImproved: string | null;
  stillNeedsWork: string | null;
  idealAnswer: string | null;
  onRetry: (transcript: string) => void;
  onNext: () => void;
  sessionId: string;
}

export default function RetryOverlay({
  questionText,
  questionId,
  previousAnswerId,
  previousScore,
  attemptNumber,
  specificFix,
  coachingNote,
  whatImproved,
  stillNeedsWork,
  idealAnswer,
  onRetry,
  onNext,
  sessionId,
}: RetryOverlayProps) {
  const [retryTranscript, setRetryTranscript] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showIdealAnswer, setShowIdealAnswer] = useState(false);
  const [flagged, setFlagged] = useState(false);
  const recognitionRef = useRef<any>(null);

  const canRetry = attemptNumber < 3 && previousScore < 70;
  const shouldShowIdealAnswer = idealAnswer && attemptNumber >= 3;

  // Initialize SpeechRecognition
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition && !recognitionRef.current) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = "en-US";
      recognitionRef.current = recognition;
    }
  }, []);

  const startRecording = () => {
    if (!recognitionRef.current) {
      console.warn("Speech recognition not available");
      return;
    }

    setRetryTranscript("");
    setIsRecording(true);
    let interimText = "";

    recognitionRef.current.onstart = () => {
      console.log("[Retry] Recording started");
    };

    recognitionRef.current.onresult = (event: any) => {
      interimText = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const text = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          setRetryTranscript((prev) => prev + text + " ");
        } else {
          interimText += text;
        }
      }
    };

    recognitionRef.current.onend = () => {
      setIsRecording(false);
      console.log("[Retry] Recording ended");
    };

    recognitionRef.current.onerror = (event: any) => {
      console.error("[Retry] Recognition error:", event.error);
      setIsRecording(false);
    };

    recognitionRef.current.start();
  };

  const stopRecording = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      setIsRecording(false);
    }
  };

  const handleRetrySubmit = async () => {
    if (!retryTranscript.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      onRetry(retryTranscript.trim());
    } catch (err) {
      console.error("[Retry] Error submitting retry:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFlagFeedback = async () => {
    if (flagged) return;

    try {
      const API_BASE = (process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:8000").replace(/\/$/, "");
      await fetch(`${API_BASE}/api/mock/flag-feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          answer_id: previousAnswerId,
          flag_reason: "feedback_unclear_or_wrong",
          flagged_text: coachingNote || specificFix || "",
        }),
      });
      setFlagged(true);
    } catch (err) {
      console.error("[Retry] Error flagging feedback:", err);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ type: "spring", damping: 20, stiffness: 300 }}
          className="bg-white rounded-2xl p-8 max-w-lg w-full shadow-xl"
        >
          <div className="mb-4 p-4 bg-gray-50 rounded-xl">
            <p className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-1">
              Question you answered
            </p>
            <p className="text-sm text-gray-700 leading-relaxed">{questionText}</p>
          </div>

          {/* ── TOP ROW: Attempt number & Score Circle ── */}
          <div className="flex justify-between items-start mb-6">
            <span className="text-xs text-gray-400 font-medium uppercase tracking-wide">
              Attempt {attemptNumber}
            </span>

            {/* Score Circle */}
            <div
              className={`w-16 h-16 rounded-full border-4 flex items-center justify-center flex-col ${
                previousScore >= 70
                  ? "border-green-400 bg-green-50"
                  : previousScore >= 50
                  ? "border-amber-400 bg-amber-50"
                  : "border-red-300 bg-red-50"
              }`}
            >
              <span
                className={`text-2xl font-black ${
                  previousScore >= 70
                    ? "text-green-600"
                    : previousScore >= 50
                    ? "text-amber-600"
                    : "text-red-500"
                }`}
              >
                {previousScore}
              </span>
              <span className="text-sm text-gray-300">/100</span>
            </div>
          </div>

          {/* ── COACHING FEEDBACK BOX ── */}
          {specificFix && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4">
              <div className="text-xs font-black text-amber-700 mb-1 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" />
                Fix this
              </div>
              <p className="text-sm text-amber-800 leading-relaxed">{specificFix}</p>
            </div>
          )}

          {/* ── IMPROVEMENT BOX ── */}
          {whatImproved && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-4">
              <div className="text-xs font-black text-green-700 mb-1 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                What improved
              </div>
              <p className="text-sm text-green-800 leading-relaxed">{whatImproved}</p>
            </div>
          )}

          {/* ── STILL NEEDS WORK ── */}
          {stillNeedsWork && attemptNumber < 3 && (
            <p className="text-sm text-gray-500 mb-4 leading-relaxed">
              Still needs work: {stillNeedsWork}
            </p>
          )}

          {/* ── COACHING NOTE ── */}
          {coachingNote && (
            <p className="text-sm text-gray-400 italic mb-6 leading-relaxed">{coachingNote}</p>
          )}

          {/* ── IDEAL ANSWER (Show/Hide toggle, only on attempt 3) ── */}
          {shouldShowIdealAnswer && (
            <div className="border border-indigo-200 rounded-xl mb-4 overflow-hidden">
              <button
                onClick={() => setShowIdealAnswer(!showIdealAnswer)}
                className="w-full bg-indigo-50 hover:bg-indigo-100 px-4 py-3 flex items-center justify-between transition-colors"
              >
                <div className="flex items-center gap-2 text-left">
                  <Lightbulb className="w-4 h-4 text-indigo-600 flex-shrink-0" />
                  <span className="text-xs font-bold text-indigo-600">Ideal answer example</span>
                </div>
                {showIdealAnswer ? (
                  <ChevronUp className="w-4 h-4 text-indigo-600" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-indigo-600" />
                )}
              </button>
              <AnimatePresence>
                {showIdealAnswer && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="bg-white px-4 py-3 text-sm text-indigo-800 leading-relaxed border-t border-indigo-200">
                      {idealAnswer}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {/* ── RETRY VOICE INPUT (shown when canRetry && score < 70) ── */}
          {canRetry && (
            <div className="bg-gray-50 rounded-xl p-4 mb-6 border border-gray-200">
              <div className="mb-3">
                {!isRecording && !retryTranscript && (
                  <button
                    onClick={startRecording}
                    className="w-full bg-gray-100 hover:bg-gray-200 rounded-xl py-3 text-sm text-gray-600 font-medium transition-colors flex items-center justify-center gap-2"
                  >
                    🎙 Record your retry
                  </button>
                )}

                {isRecording && (
                  <button
                    onClick={stopRecording}
                    className="w-full bg-red-100 hover:bg-red-200 rounded-xl py-3 text-sm text-red-600 font-medium transition-colors flex items-center justify-center gap-2 animate-pulse"
                  >
                    ⏹ Stop recording
                  </button>
                )}

                {retryTranscript && !isRecording && (
                  <textarea
                    value={retryTranscript}
                    onChange={(e) => setRetryTranscript(e.target.value)}
                    className="w-full text-sm text-gray-700 border border-gray-300 rounded-xl p-3 min-h-[80px] resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="Your retry answer..."
                  />
                )}
              </div>

              {retryTranscript && (
                <button
                  onClick={() => setRetryTranscript("")}
                  className="text-xs text-gray-400 hover:text-gray-600 underline transition-colors"
                >
                  Clear
                </button>
              )}

              {isRecording && (
                <div className="mt-2 text-xs text-gray-500">
                  Listening... ({retryTranscript.split(" ").filter((w) => w).length} words)
                </div>
              )}
            </div>
          )}

          {/* ── BUTTONS ── */}
          <div className="flex gap-3 mt-4">
            {canRetry && retryTranscript && (
              <button
                onClick={handleRetrySubmit}
                disabled={isSubmitting}
                className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl px-6 py-3 font-medium flex items-center justify-center gap-2 transition-colors"
              >
                {isSubmitting ? (
                  <>
                    <Loader className="w-4 h-4 animate-spin" />
                    Scoring...
                  </>
                ) : (
                  "Submit retry →"
                )}
              </button>
            )}

            <button
              onClick={onNext}
              className="flex-1 border border-gray-200 text-gray-600 hover:bg-gray-50 rounded-xl px-6 py-3 font-medium transition-colors"
            >
              Next question →
            </button>
          </div>

          {/* ── FLAG FEEDBACK LINK ── */}
          <div className="mt-4 flex justify-center">
            <button
              onClick={handleFlagFeedback}
              disabled={flagged}
              className={`text-xs ${
                flagged
                  ? "text-gray-300 cursor-default"
                  : "text-gray-400 hover:text-gray-600 underline cursor-pointer transition-colors"
              }`}
            >
              {flagged ? "Flagged — thanks" : "Something wrong with this feedback?"}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
