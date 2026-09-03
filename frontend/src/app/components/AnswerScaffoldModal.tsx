// frontend/src/app/components/AnswerScaffoldModal.tsx
//
// "Build Your Answer" — fill-in-the-blank voice scaffold, one small piece
// at a time, then assembled into a complete answer with light feedback.

"use client";

import { useState, useRef } from "react";
import { useAuth } from "@/context/AuthContext";

const API_BASE = (process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:8000").replace(/\/$/, "");

type Blank = { id: string; prompt: string };
type Scaffold = { frame_template: string; blanks: Blank[] };

type Props = {
    questionId: number;
    questionText: string;
    onClose: () => void;
};

export function AnswerScaffoldModal({ questionId, questionText, onClose }: Props) {
    const { authHeader } = useAuth();
    const [loading, setLoading] = useState(true);
    const [scaffold, setScaffold] = useState<Scaffold | null>(null);
    const [currentBlankIdx, setCurrentBlankIdx] = useState(0);
    const [filledBlanks, setFilledBlanks] = useState<Record<string, string>>({});
    const [recording, setRecording] = useState(false);
    const [transcribing, setTranscribing] = useState(false);
    const [assembled, setAssembled] = useState<{ text: string; feedback: string } | null>(null);
    const [error, setError] = useState<string | null>(null);

    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<Blob[]>([]);

    // ── Load scaffold on mount ──────────────────────────────────────────
    useState(() => {
        fetch(`${API_BASE}/api/answer-scaffold/get-scaffold`, {
            method: "POST",
            headers: { "Content-Type": "application/json", ...authHeader() },
            body: JSON.stringify({ question_id: questionId, question_text: questionText }),
        })
            .then((r) => {
                if (r.status === 403) throw new Error("max_required");
                if (!r.ok) throw new Error("failed");
                return r.json();
            })
            .then((data) => {
                setScaffold(data);
                setLoading(false);
            })
            .catch((e) => {
                setError(e.message === "max_required" ? "This feature is available on the Max plan." : "Couldn't load this exercise. Please try again.");
                setLoading(false);
            });
    });

    const currentBlank = scaffold?.blanks[currentBlankIdx];
    const isLastBlank = scaffold ? currentBlankIdx === scaffold.blanks.length - 1 : false;

    // ── Recording ────────────────────────────────────────────────────────
    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const recorder = new MediaRecorder(stream);
            chunksRef.current = [];
            recorder.ondataavailable = (e) => chunksRef.current.push(e.data);
            recorder.onstop = () => {
                stream.getTracks().forEach((t) => t.stop());
                handleClipReady();
            };
            recorder.start();
            mediaRecorderRef.current = recorder;
            setRecording(true);
        } catch {
            setError("Couldn't access your microphone. Check permissions and try again.");
        }
    };

    const stopRecording = () => {
        mediaRecorderRef.current?.stop();
        setRecording(false);
    };

    const handleClipReady = async () => {
        if (!currentBlank) return;
        setTranscribing(true);
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        const formData = new FormData();
        formData.append("file", blob, "clip.webm");

        try {
            const res = await fetch(`${API_BASE}/api/answer-scaffold/transcribe-blank`, {
                method: "POST",
                headers: { ...authHeader() },
                body: formData,
            });
            const data = await res.json();
            setFilledBlanks((prev) => ({ ...prev, [currentBlank.id]: data.transcript || "" }));
        } catch {
            setError("Transcription failed. Try recording that piece again.");
        } finally {
            setTranscribing(false);
        }
    };

    const handleNext = () => {
        if (isLastBlank) {
            handleAssemble();
        } else {
            setCurrentBlankIdx((i) => i + 1);
        }
    };

    const handleAssemble = async () => {
        if (!scaffold) return;
        setLoading(true);
        try {
            const res = await fetch(`${API_BASE}/api/answer-scaffold/assemble`, {
                method: "POST",
                headers: { "Content-Type": "application/json", ...authHeader() },
                body: JSON.stringify({
                    frame_template: scaffold.frame_template,
                    filled_blanks: filledBlanks,
                }),
            });
            const data = await res.json();
            setAssembled({ text: data.assembled_answer, feedback: data.feedback });
        } catch {
            setError("Couldn't put your answer together. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    // ── Render ──────────────────────────────────────────────────────────
    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.75)" }}>
            <div className="w-full max-w-[520px] rounded-2xl bg-white p-7 max-h-[85vh] overflow-y-auto">
                <div className="flex items-center justify-between mb-1">
                    <p className="text-[11px] font-black uppercase tracking-widest text-amber-600">Build Your Answer</p>
                    <button onClick={onClose} className="text-[20px] text-[#9CA3AF] hover:text-[#111]">×</button>
                </div>
                <p className="text-[13px] text-[#6B7280] mb-6">{questionText}</p>

                {error && (
                    <div className="rounded-xl bg-rose-50 border border-rose-200 px-4 py-3 mb-4">
                        <p className="text-[13px] text-rose-700">{error}</p>
                    </div>
                )}

                {loading && !error && (
                    <div className="py-10 text-center">
                        <div className="mx-auto mb-3 h-6 w-6 animate-spin rounded-full border-2 border-gray-200 border-t-[#111]" />
                        <p className="text-[13px] text-[#9CA3AF]">Preparing your answer scaffold…</p>
                    </div>
                )}

                {!loading && !error && scaffold && !assembled && currentBlank && (
                    <div>
                        <div className="mb-5 flex items-center gap-1.5">
                            {scaffold.blanks.map((_, i) => (
                                <div
                                    key={i}
                                    className="h-1.5 flex-1 rounded-full"
                                    style={{ background: i < currentBlankIdx ? "#10B981" : i === currentBlankIdx ? "#F59E0B" : "#F3F4F6" }}
                                />
                            ))}
                        </div>

                        <p className="text-[11px] font-bold text-[#9CA3AF] mb-2">
                            Piece {currentBlankIdx + 1} of {scaffold.blanks.length}
                        </p>
                        <p className="text-[17px] font-black text-[#111] mb-6">{currentBlank.prompt}</p>

                        {filledBlanks[currentBlank.id] ? (
                            <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 mb-4 flex items-center justify-between gap-3">
                                <p className="text-[14px] text-emerald-900 flex-1">{filledBlanks[currentBlank.id]}</p>
                                <button
                                    onClick={() => setFilledBlanks((prev) => {
                                        const next = { ...prev };
                                        delete next[currentBlank.id];
                                        return next;
                                    })}
                                    className="text-[12px] font-bold text-emerald-700 hover:text-emerald-900 whitespace-nowrap"
                                >
                                    Retry
                                </button>
                            </div>
                        ) : (
                            <div className="rounded-xl bg-[#F9FAFB] border border-[#E5E7EB] px-4 py-6 mb-4 text-center">
                                {transcribing ? (
                                    <p className="text-[13px] text-[#9CA3AF]">Transcribing…</p>
                                ) : (
                                    <button
                                        onClick={recording ? stopRecording : startRecording}
                                        className="inline-flex h-14 w-14 items-center justify-center rounded-full transition"
                                        style={{ background: recording ? "#EF4444" : "#111" }}
                                    >
                                        <span className="text-[22px]">{recording ? "⏹" : "🎤"}</span>
                                    </button>
                                )}
                                <p className="text-[12px] text-[#9CA3AF] mt-3">
                                    {recording ? "Recording… tap to stop" : "Tap to speak a short phrase"}
                                </p>
                            </div>
                        )}

                        <button
                            onClick={handleNext}
                            disabled={!filledBlanks[currentBlank.id]}
                            className="w-full rounded-xl bg-[#111] py-3 text-[14px] font-black text-white disabled:opacity-30 disabled:cursor-not-allowed hover:bg-[#333] transition"
                        >
                            {isLastBlank ? "Put my answer together →" : "Next piece →"}
                        </button>
                    </div>
                )}

                {assembled && (
                    <div>
                        <p className="text-[11px] font-bold text-[#9CA3AF] mb-2">Your complete answer</p>
                        <div className="rounded-xl bg-[#111] px-5 py-4 mb-4">
                            <p className="text-[15px] text-white leading-relaxed">{assembled.text}</p>
                        </div>
                        <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 mb-6">
                            <p className="text-[13px] text-amber-800">{assembled.feedback}</p>
                        </div>
                        <button
                            onClick={onClose}
                            className="w-full rounded-xl bg-[#111] py-3 text-[14px] font-black text-white hover:bg-[#333] transition"
                        >
                            Done — I'll say it out loud now
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}