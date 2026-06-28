"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/context/AuthContext";
import Editor from "@monaco-editor/react";

const API_BASE = (process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:8000").replace(/\/$/, "");

// ─── Types ───────────────────────────────────────────────────────────────────

type SampleCase = {
    input: Record<string, any>;
    expected_output: any;
    explanation?: string;
};

type Problem = {
    id: number;
    problem_name: string;
    difficulty: string;
    topic: string;
    subtopic: string | null;
    companies: string[];
    time_limit_minutes: number;
    problem_statement: string;
    input_format: string | null;
    output_format: string | null;
    constraints: string | null;
    sample_cases: SampleCase[];
    time_complexity: string | null;
    space_complexity: string | null;
    approach_tags: string[];
    hints_progressive: string[] | null;
    common_mistakes: string[] | null;
    interview_followups: string[] | null;
    solution_code: Record<string, string> | null;
    solution_explanation: string | null;
    function_signature: string;
    can_see_hints: boolean;
    can_see_solution: boolean;
    plan: string;
    today_attempts: number;
    free_limit: number;
    best_attempt: any;
};

type TestResult = {
    case_number: number;
    input: Record<string, any>;
    expected: any;
    actual: any;
    passed: boolean;
    status: string;
    error: string;
};

type SubmitResult = {
    status: string;
    passed: number;
    total: number;
    is_first_solve: boolean;
    first_failure: any;
    message: string;
};

const DIFF_STYLE: Record<string, { color: string; bg: string }> = {
    easy: { color: "#15803D", bg: "#F0FDF4" },
    medium: { color: "#B45309", bg: "#FFFBEB" },
    hard: { color: "#B91C1C", bg: "#FEF2F2" },
};

const LANG_STARTERS: Record<string, (sig: string) => string> = {
    python: (sig) => `${sig}\n    # Write your solution here\n    pass\n`,
    java: (sig) => `public ${sig || "int solution(int[] nums)"} {\n    // Write your solution here\n    return 0;\n}`,
    cpp: (sig) => `${sig || "int solution(vector<int>& nums)"} {\n    // Write your solution here\n    return 0;\n}`,
};

const LANG_MONACO: Record<string, string> = {
    python: "python",
    java: "java",
    cpp: "cpp",
};

type PanelTab = "description" | "hints" | "solution" | "results";
type RightTab = "output" | "approach";

export default function DSAIdePage() {
    const { topic, id } = useParams() as { topic: string; id: string };
    const decodedTopic = decodeURIComponent(topic);
    const { user, authHeader } = useAuth();

    const [problem, setProblem] = useState<Problem | null>(null);
    const [loading, setLoading] = useState(true);
    const [language, setLanguage] = useState("python");
    const [code, setCode] = useState("");
    const [panelTab, setPanelTab] = useState<PanelTab>("description");
    const [rightTab, setRightTab] = useState<RightTab>("output");
    const [running, setRunning] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [runResults, setRunResults] = useState<TestResult[] | null>(null);
    const [submitResult, setSubmitResult] = useState<SubmitResult | null>(null);
    const [hintsRevealed, setHintsRevealed] = useState(0);
    const [elapsedSecs, setElapsedSecs] = useState(0);
    const startTimeRef = useRef(Date.now());
    const timerRef = useRef<NodeJS.Timeout | null>(null);

    // Load problem
    useEffect(() => {
        if (!user) return;
        fetch(`${API_BASE}/api/dsa/problem/${id}`, { headers: authHeader() })
            .then(r => r.json())
            .then(p => {
                setProblem(p);
                
            })
            .finally(() => setLoading(false));
    }, [user, id]);

    // Timer
    useEffect(() => {
        timerRef.current = setInterval(() => {
            setElapsedSecs(Math.floor((Date.now() - startTimeRef.current) / 1000));
        }, 1000);
        return () => { if (timerRef.current) clearInterval(timerRef.current); };
    }, []);

    // Load saved code when problem loads OR language changes
    useEffect(() => {
        if (!problem) return;
        const key = `dsa_code_${problem.id}_${language}`;
        const saved = localStorage.getItem(key);
        // Only set starter if no saved code exists
        setCode(saved || LANG_STARTERS[language](problem.function_signature || ""));
    }, [problem?.id, language]);

    // Save code whenever it changes — but only if it's not the starter template
    useEffect(() => {
        if (!problem || !code) return;
        const starter = LANG_STARTERS[language](problem.function_signature || "");
        if (code === starter) return; // don't save the blank template
        localStorage.setItem(`dsa_code_${problem.id}_${language}`, code);
    }, [code, problem?.id, language]);

    async function runCode() {
        if (!problem) return;
        setRunning(true);
        setRunResults(null);
        setRightTab("output");
        try {
            const res = await fetch(`${API_BASE}/api/dsa/run/${problem.id}`, {
                method: "POST",
                headers: { "Content-Type": "application/json", ...authHeader() },
                body: JSON.stringify({ code, language }),
            });
            const data = await res.json();
            setRunResults(data.results || []);
        } catch {
            setRunResults([]);
        } finally {
            setRunning(false);
        }
    }

    async function submitCode() {
        if (!problem) return;
        setSubmitting(true);
        setSubmitResult(null);
        setRightTab("output");
        try {
            const res = await fetch(`${API_BASE}/api/dsa/submit/${problem.id}`, {
                method: "POST",
                headers: { "Content-Type": "application/json", ...authHeader() },
                body: JSON.stringify({ code, language, hints_revealed: hintsRevealed }),
            });
            if (res.status === 403) {
                setSubmitResult({ status: "limit_reached", passed: 0, total: 0, is_first_solve: false, first_failure: null, message: "Daily submission limit reached. Upgrade to Pro for unlimited submissions." });
                return;
            }
            const data = await res.json();
            setSubmitResult(data);
            if (data.status === "passed") {
                setTimeTakenSecs(elapsedSecs);
                if (timerRef.current) clearInterval(timerRef.current);
                setPanelTab("results");
            } else if (data.status === "partial") {
                setPanelTab("results");
            }
        } catch {
            setSubmitResult({ status: "error", passed: 0, total: 0, is_first_solve: false, first_failure: null, message: "Submission failed. Try again." });
        } finally {
            setSubmitting(false);
        }
    }

    const [timeTakenSecs, setTimeTakenSecs] = useState<number | null>(null);

    const timerLabel = (() => {
        const m = Math.floor(elapsedSecs / 60);
        const s = elapsedSecs % 60;
        return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
    })();

    if (!user) {
        return (
            <div className="min-h-screen bg-[#FAFAF8] flex items-center justify-center px-6">
                <div className="text-center max-w-[400px]">
                    <div className="text-[52px] mb-5">💻</div>
                    <h1 className="text-[24px] font-black text-[#111] mb-2">DSA Practice</h1>
                    <p className="text-[14px] text-[#6B7280] mb-6">Sign in to access the problem.</p>
                    <Link href="/login" className="rounded-xl bg-[#111] px-6 py-3 text-[13px] font-black text-white hover:bg-[#333] transition">Sign in</Link>
                </div>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-[#1E1E2E] flex items-center justify-center">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-600 border-t-yellow-400" />
            </div>
        );
    }

    if (!problem) {
        return (
            <div className="min-h-screen bg-[#FAFAF8] flex items-center justify-center px-6">
                <div className="text-center">
                    <p className="text-[14px] text-[#9CA3AF]">Problem not found.</p>
                    <Link href="/dsa" className="text-[13px] font-bold text-[#111] hover:underline mt-2 block">← Back to topics</Link>
                </div>
            </div>
        );
    }

    const diff = DIFF_STYLE[problem.difficulty] || DIFF_STYLE.medium;

    return (
        <div className="flex flex-col bg-[#1E1E2E]" style={{ height: "calc(100vh - 64px)", marginTop: "64px" }}>

            {/* Top bar */}
            <div className="flex items-center justify-between px-4 py-2.5 bg-[#252537] border-b border-[#333352] flex-shrink-0">        <div className="flex items-center gap-3">
                <Link href={`/dsa/${encodeURIComponent(decodedTopic)}`}
                    className="text-[#9CA3AF] hover:text-white transition text-[12px]">
                    ← {decodedTopic}
                </Link>
                <span className="text-[#555]">·</span>
                <span className="text-[13px] font-bold text-white">{problem.problem_name}</span>
                <span className="rounded-full px-2 py-0.5 text-[10px] font-bold capitalize"
                    style={{ background: diff.bg + "20", color: diff.color }}>
                    {problem.difficulty}
                </span>
            </div>
                <div className="flex items-center gap-4">
                    <span className="text-[12px] font-mono text-[#6B7280]">{timerLabel}</span>
                    {problem.plan === "free" && (
                        <span className="text-[11px] text-[#6B7280]">
                            {problem.today_attempts}/{problem.free_limit} today
                        </span>
                    )}
                </div>
            </div>

            {/* Main IDE layout */}
            <div className="flex flex-1 overflow-hidden flex-col lg:flex-row">

                {/* LEFT: Problem panel */}
                <div className="w-full lg:w-[420px] lg:flex-shrink-0 flex flex-col border-r border-[#333352] bg-[#252537] overflow-y-auto">

                    {/* Tabs */}
                    <div className="flex border-b border-[#333352]">
                        {(["description", "hints", "solution", "results"] as PanelTab[]).map(t => {
                            const solutionLocked = t === "solution" && (
                                !problem.can_see_solution ||
                                (!submitResult && !problem.best_attempt)
                            );
                            const hintsLocked = t === "hints" && !problem.can_see_hints;
                            return (
                                <button key={t} onClick={() => !solutionLocked && !hintsLocked && setPanelTab(t)}
                                    className={`px-4 py-2.5 text-[12px] font-bold capitalize transition-colors ${panelTab === t ? "text-yellow-400 border-b-2 border-yellow-400" : "text-[#6B7280] hover:text-white"
                                        } ${solutionLocked || hintsLocked ? "opacity-40 cursor-not-allowed" : ""}`}>
                                    {t}
                                    {hintsLocked && " 🔒"}
                                    {solutionLocked && " 🔒"}
                                </button>
                            );
                        })}
                    </div>

                    <div className="flex-1 overflow-y-auto p-5 text-[13px] text-[#CDD6F4] leading-relaxed">

                        {panelTab === "description" && (
                            <div>
                                {/* Company tags */}
                                {problem.companies.length > 0 && (
                                    <div className="flex flex-wrap gap-1.5 mb-4">
                                        {problem.companies.slice(0, 5).map(c => (
                                            <span key={c} className="rounded-full bg-[#1E1E2E] border border-[#333352] px-2.5 py-0.5 text-[10px] font-bold text-[#9CA3AF]">
                                                {c}
                                            </span>
                                        ))}
                                    </div>
                                )}

                                {/* Problem statement */}
                                <p className="mb-4 leading-relaxed">{problem.problem_statement}</p>

                                {/* Sample cases */}
                                {problem.sample_cases?.length > 0 && (
                                    <div className="space-y-3 mb-4">
                                        {problem.sample_cases.map((sc, i) => (
                                            <div key={i} className="rounded-xl bg-[#1E1E2E] border border-[#333352] p-3">
                                                <p className="text-[10px] font-black text-[#6B7280] uppercase tracking-wider mb-2">Example {i + 1}</p>
                                                <div className="space-y-1 text-[12px] font-mono">
                                                    <p><span className="text-[#6B7280]">Input: </span>
                                                        <span className="text-[#CDD6F4]">{JSON.stringify(sc.input)}</span></p>
                                                    <p><span className="text-[#6B7280]">Output: </span>
                                                        <span className="text-emerald-400">{JSON.stringify(sc.expected_output)}</span></p>
                                                </div>
                                                {sc.explanation && (
                                                    <p className="mt-2 text-[11px] text-[#6B7280]">{sc.explanation}</p>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* Constraints */}
                                {problem.constraints && (
                                    <div className="rounded-xl bg-[#1E1E2E] border border-[#333352] p-3 mb-4">
                                        <p className="text-[10px] font-black text-[#6B7280] uppercase tracking-wider mb-2">Constraints</p>
                                        {typeof problem.constraints === "string" ? (
                                            <p className="text-[12px] text-[#9CA3AF]">{problem.constraints}</p>
                                        ) : typeof problem.constraints === "object" && problem.constraints !== null ? (
                                            <div className="space-y-1">
                                                {Object.entries(problem.constraints as Record<string, any>).map(([k, v]) => (
                                                    <p key={k} className="text-[12px] font-mono text-[#9CA3AF]">
                                                        <span className="text-[#6B7280]">{k}: </span>{String(v)}
                                                    </p>
                                                ))}
                                            </div>
                                        ) : null}
                                    </div>
                                )}

                                {/* Complexity */}
                                {(problem.time_complexity || problem.space_complexity) && (
                                    <div className="flex gap-3">
                                        {problem.time_complexity && (
                                            <div className="flex-1 rounded-xl bg-[#1E1E2E] p-3">
                                                <p className="text-[10px] text-[#6B7280] mb-1">Time</p>
                                                <p className="text-[12px] font-mono text-yellow-400">{problem.time_complexity}</p>
                                            </div>
                                        )}
                                        {problem.space_complexity && (
                                            <div className="flex-1 rounded-xl bg-[#1E1E2E] p-3">
                                                <p className="text-[10px] text-[#6B7280] mb-1">Space</p>
                                                <p className="text-[12px] font-mono text-blue-400">{problem.space_complexity}</p>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Follow-up questions */}
                                {problem.interview_followups && Array.isArray(problem.interview_followups) && problem.interview_followups.length > 0 && (
                                    <div className="mt-4 rounded-xl bg-[#1E1E2E] border border-yellow-400/20 p-3">
                                        <p className="text-[10px] font-black text-yellow-400 uppercase tracking-wider mb-2">💬 Interviewer Follow-ups</p>
                                        <div className="space-y-1">
                                            {problem.interview_followups.map((q, i) => (
                                                <p key={i} className="text-[11px] text-[#9CA3AF]">• {q}</p>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {panelTab === "hints" && problem.can_see_hints && (
                            <div>
                                <p className="text-[11px] text-[#6B7280] mb-4">Hints are progressive — unlock only what you need.</p>
                                {(problem.hints_progressive || []).map((hint, i) => (
                                    <div key={i} className="mb-3">
                                        {i < hintsRevealed ? (
                                            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                                                className="rounded-xl bg-[#1E1E2E] border border-[#333352] p-3">
                                                <p className="text-[11px] text-[#6B7280] mb-1">Hint {i + 1}</p>
                                                <p className="text-[13px] text-[#CDD6F4]">{hint}</p>
                                            </motion.div>
                                        ) : i === hintsRevealed ? (
                                            <button onClick={() => setHintsRevealed(h => h + 1)}
                                                className="w-full rounded-xl border border-dashed border-[#444] p-3 text-[12px] text-[#6B7280] hover:border-yellow-400 hover:text-yellow-400 transition text-center">
                                                + Reveal hint {i + 1}
                                            </button>
                                        ) : (
                                            <div className="rounded-xl border border-[#333352] p-3 opacity-30">
                                                <p className="text-[12px] text-[#6B7280]">Hint {i + 1} — unlock hint {i} first</p>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}

                        {panelTab === "solution" && problem.can_see_solution && (
                            <div>
                                {problem.solution_explanation && (
                                    <div className="rounded-xl bg-[#1E1E2E] border border-[#333352] p-4 mb-4">
                                        <p className="text-[10px] font-black text-[#6B7280] uppercase tracking-wider mb-2">Approach</p>
                                        <p className="text-[13px] leading-relaxed text-[#CDD6F4]">{problem.solution_explanation}</p>
                                    </div>
                                )}
                                {problem.solution_code?.python && (
                                    <div className="rounded-xl bg-[#1E1E2E] border border-[#333352] overflow-hidden">
                                        <p className="px-4 py-2 text-[10px] font-black text-[#6B7280] uppercase tracking-wider border-b border-[#333352]">
                                            Python Solution
                                        </p>
                                        <pre className="p-4 text-[12px] font-mono text-[#CDD6F4] overflow-x-auto whitespace-pre-wrap">
                                            {problem.solution_code.python}
                                        </pre>
                                    </div>
                                )}
                            </div>
                        )}

                        {panelTab === "results" && (
                            <div>
                                {submitResult ? (
                                    <div>
                                        <div className={`rounded-xl p-4 mb-4 ${submitResult.status === "passed" ? "bg-emerald-900/30 border border-emerald-500/30" :
                                            submitResult.status === "limit_reached" ? "bg-amber-900/30 border border-amber-500/30" :
                                                "bg-rose-900/30 border border-rose-500/30"
                                            }`}>
                                            <p className={`text-[16px] font-black mb-1 ${submitResult.status === "passed" ? "text-emerald-400" :
                                                submitResult.status === "limit_reached" ? "text-amber-400" : "text-rose-400"
                                                }`}>
                                                {submitResult.status === "passed" ? "✓ Accepted" :
                                                    submitResult.status === "limit_reached" ? "⚠ Daily Limit" :
                                                        submitResult.status === "partial" ? "◑ Partial" :
                                                            submitResult.status === "wrong_answer" ? "✗ Wrong Answer" :
                                                                submitResult.status === "tle" ? "⏱ Time Limit Exceeded" :
                                                                    submitResult.status === "runtime_error" ? "⚠ Runtime Error" :
                                                                        submitResult.status === "compilation_error" ? "⚠ Compilation Error" : "✗ Failed"}
                                            </p>
                                            <p className="text-[13px] text-[#9CA3AF]">{submitResult.message}</p>
                                            {submitResult.is_first_solve && (
                                                <p className="text-[12px] text-yellow-400 mt-2 font-bold">🎉 First solve! Great job.</p>
                                            )}
                                        </div>
                                        {submitResult.status === "passed" && (
                                            <div className="grid grid-cols-3 gap-2 mb-4">
                                                <div className="rounded-xl bg-[#1E1E2E] p-3 text-center">
                                                    <p className="text-[14px] font-black text-white">
                                                        {timeTakenSecs != null ? `${Math.floor(timeTakenSecs / 60)}m ${timeTakenSecs % 60}s` : "—"}
                                                    </p>
                                                    <p className="text-[10px] text-[#6B7280] mt-0.5">Time taken</p>
                                                </div>
                                                <div className="rounded-xl bg-[#1E1E2E] p-3 text-center">
                                                    <p className="text-[14px] font-black text-yellow-400">{problem.time_complexity || "—"}</p>
                                                    <p className="text-[10px] text-[#6B7280] mt-0.5">Optimal time</p>
                                                </div>
                                                <div className="rounded-xl bg-[#1E1E2E] p-3 text-center">
                                                    <p className="text-[14px] font-black text-blue-400">{problem.space_complexity || "—"}</p>
                                                    <p className="text-[10px] text-[#6B7280] mt-0.5">Optimal space</p>
                                                </div>
                                            </div>
                                        )}
                                        {submitResult.first_failure && (
                                            <div className="rounded-xl bg-[#1E1E2E] border border-[#333352] p-3">
                                                <p className="text-[10px] font-black text-rose-400 uppercase tracking-wider mb-2">First failing case</p>
                                                <div className="space-y-1 text-[12px] font-mono">
                                                    <p><span className="text-[#6B7280]">Input: </span>{JSON.stringify(submitResult.first_failure.input)}</p>
                                                    <p><span className="text-[#6B7280]">Expected: </span><span className="text-emerald-400">{JSON.stringify(submitResult.first_failure.expected)}</span></p>
                                                    <p><span className="text-[#6B7280]">Got: </span><span className="text-rose-400">{submitResult.first_failure.actual ?? "None"}</span></p>
                                                    {submitResult.first_failure.error && (
                                                        <p><span className="text-[#6B7280]">Error: </span><span className="text-amber-400">{submitResult.first_failure.error}</span></p>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ) : problem.best_attempt ? (
                                    <div>
                                        <div className={`rounded-xl p-4 mb-4 ${problem.best_attempt.status === "passed"
                                            ? "bg-emerald-900/30 border border-emerald-500/30"
                                            : "bg-rose-900/30 border border-rose-500/30"
                                            }`}>
                                            <p className={`text-[16px] font-black mb-1 ${problem.best_attempt.status === "passed" ? "text-emerald-400" : "text-rose-400"
                                                }`}>
                                                {problem.best_attempt.status === "passed" ? "✓ Accepted" : "✗ Not solved yet"}
                                            </p>
                                            <p className="text-[13px] text-[#9CA3AF]">
                                                {problem.best_attempt.test_cases_passed}/{problem.best_attempt.test_cases_total} test cases passed
                                                {" · "}{problem.best_attempt.language}
                                            </p>
                                        </div>
                                        {problem.best_attempt.status === "passed" && (
                                            <div className="grid grid-cols-2 gap-2">
                                                <div className="rounded-xl bg-[#1E1E2E] p-3 text-center">
                                                    <p className="text-[14px] font-black text-yellow-400">{problem.time_complexity || "—"}</p>
                                                    <p className="text-[10px] text-[#6B7280] mt-0.5">Optimal time</p>
                                                </div>
                                                <div className="rounded-xl bg-[#1E1E2E] p-3 text-center">
                                                    <p className="text-[14px] font-black text-blue-400">{problem.space_complexity || "—"}</p>
                                                    <p className="text-[10px] text-[#6B7280] mt-0.5">Optimal space</p>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <p className="text-[12px] text-[#555]">Submit your code to see results here.</p>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* RIGHT: Editor + output */}
                <div className="flex-1 flex flex-col min-h-0">

                    {/* Editor toolbar */}
                    <div className="flex items-center justify-between px-4 py-2 bg-[#252537] border-b border-[#333352]">
                        <div className="flex gap-2">
                            {["python", "java", "cpp"].map(lang => (
                                <button key={lang} onClick={() => setLanguage(lang)}
                                    className={`rounded-lg px-3 py-1.5 text-[11px] font-bold transition-all ${language === lang ? "bg-yellow-400 text-[#111]" : "text-[#6B7280] hover:text-white"
                                        }`}>
                                    {lang === "cpp" ? "C++" : lang.charAt(0).toUpperCase() + lang.slice(1)}
                                </button>
                            ))}
                        </div>
                        <div className="flex gap-2">
                            <button onClick={runCode} disabled={running || submitting}
                                className="rounded-lg border border-[#444] px-4 py-1.5 text-[12px] font-bold text-[#CDD6F4] hover:border-white transition disabled:opacity-40">
                                {running ? "Running..." : "▶ Run"}
                            </button>
                            <button onClick={submitCode} disabled={running || submitting}
                                className="rounded-lg bg-yellow-400 px-4 py-1.5 text-[12px] font-black text-[#111] hover:bg-yellow-300 transition disabled:opacity-40">
                                {submitting ? "Submitting..." : "Submit"}
                            </button>
                        </div>
                    </div>

                    {/* Monaco editor */}
                    <div className="flex-1 min-h-0" style={{ height: "60%" }}>
                        <Editor
                            height="100%"
                            language={LANG_MONACO[language]}
                            value={code}
                            onChange={val => setCode(val || "")}
                            theme="vs-dark"
                            options={{
                                fontSize: 14,
                                minimap: { enabled: false },
                                scrollBeyondLastLine: false,
                                padding: { top: 16 },
                                lineNumbers: "on",
                                wordWrap: "on",
                                tabSize: 4,
                                fontFamily: "'Cascadia Code', 'Fira Code', monospace",
                                fontLigatures: true,
                            }}
                        />
                    </div>

                    {/* Output panel */}
                    <div className="border-t border-[#333352] flex flex-col" style={{ height: "40%" }}>
                        <div className="flex items-center gap-4 px-4 py-2 border-b border-[#333352] bg-[#252537]">
                            {(["output", "approach"] as RightTab[]).map(t => (
                                <button key={t} onClick={() => setRightTab(t)}
                                    className={`text-[12px] font-bold capitalize transition-colors ${rightTab === t ? "text-yellow-400" : "text-[#6B7280] hover:text-white"
                                        }`}>
                                    {t}
                                </button>
                            ))}
                        </div>

                        <div className="flex-1 overflow-y-auto p-4">
                            {rightTab === "output" && (
                                <div>
                                    {!runResults && !submitResult && (
                                        <p className="text-[12px] text-[#555]">Run your code or submit to see results.</p>
                                    )}

                                    {runResults && (
                                        <div className="space-y-2">
                                            <p className="text-[11px] text-[#6B7280] mb-2">Sample Cases</p>
                                            {runResults.map((r, i) => (
                                                <div key={i} className={`rounded-xl border p-3 ${r.passed ? "border-emerald-500/30 bg-emerald-900/10" : "border-rose-500/30 bg-rose-900/10"
                                                    }`}>
                                                    <div className="flex items-center justify-between mb-1.5">
                                                        <span className={`text-[11px] font-bold ${r.passed ? "text-emerald-400" : "text-rose-400"}`}>
                                                            {r.passed ? "✓ Passed" : "✗ Failed"} — Case {r.case_number}
                                                        </span>
                                                    </div>
                                                    <div className="text-[11px] font-mono space-y-0.5">
                                                        <p><span className="text-[#6B7280]">Input: </span><span className="text-[#CDD6F4]">{JSON.stringify(r.input)}</span></p>
                                                        <p><span className="text-[#6B7280]">Expected: </span><span className="text-emerald-400">{JSON.stringify(r.expected)}</span></p>
                                                        {!r.passed && <p><span className="text-[#6B7280]">Got: </span><span className="text-rose-400">{r.actual ?? "None"}</span></p>}
                                                        {r.error && <p><span className="text-[#6B7280]">Error: </span><span className="text-amber-400">{r.error}</span></p>}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            {rightTab === "approach" && (
                                <div>
                                    {problem.approach_tags.length > 0 && (
                                        <div className="flex flex-wrap gap-1.5 mb-4">
                                            {problem.approach_tags.map(tag => (
                                                <span key={tag} className="rounded-full bg-blue-900/30 border border-blue-500/30 px-2.5 py-0.5 text-[11px] font-bold text-blue-400">
                                                    {tag.replace(/_/g, " ")}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                    {problem.common_mistakes && problem.common_mistakes.length > 0 && (
                                        <div className="rounded-xl bg-[#1E1E2E] border border-amber-500/20 p-3">
                                            <p className="text-[10px] font-black text-amber-400 uppercase tracking-wider mb-2">⚠ Common Mistakes</p>
                                            {problem.common_mistakes.map((m, i) => (
                                                <p key={i} className="text-[11px] text-[#9CA3AF] mb-1">• {m}</p>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}