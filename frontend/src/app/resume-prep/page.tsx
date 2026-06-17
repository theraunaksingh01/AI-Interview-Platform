"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/context/AuthContext";

const API_BASE = (
  process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:8000"
).replace(/\/$/, "");

// ─── Types ────────────────────────────────────────────────────────────────────

type ExtractedProject = {
  name: string;
  tech_stack: string[];
  description: string;
};

type ExtractedResume = {
  projects: ExtractedProject[];
  skills: string[];
  experience: string[];
  education: string[];
  raw_text: string;
};

type ViewState = "upload" | "extracting" | "confirm" | "starting" | "upgrade";

const ROLES = [
  "Backend Engineer", "Frontend Engineer", "Full Stack Engineer",
  "AI Engineer", "Data Engineer", "Mobile Engineer",
];

// ─── Upload screen ──────────────────────────────────────────────────────────

function UploadScreen({
  onFileSelected,
  onTextSubmit,
  error,
}: {
  onFileSelected: (file: File) => void;
  onTextSubmit: (text: string) => void;
  error: string | null;
}) {
  const [dragActive, setDragActive] = useState(false);
  const [mode, setMode] = useState<"file" | "text">("file");
  const [pastedText, setPastedText] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file) onFileSelected(file);
  }

  return (
    <div className="grid min-h-[calc(100vh-72px)] grid-cols-1 lg:grid-cols-2">

      {/* LEFT: Upload */}
      <div className="flex flex-col justify-center px-6 py-10 lg:px-14 bg-[#FFFDF0] border-r border-[#F0F0EE]">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="max-w-[460px] mx-auto w-full">

          <div className="inline-flex items-center gap-2 rounded-full border border-[#E5E7EB] bg-white px-3 py-1.5 mb-5">
            <span className="h-1.5 w-1.5 rounded-full bg-yellow-400 animate-pulse" />
            <span className="text-[11px] font-black uppercase tracking-widest text-[#374151]">Resume Prep · Max</span>
          </div>

          <h1 style={{ fontSize: "clamp(26px, 4vw, 38px)", fontWeight: 900, letterSpacing: "-1px", color: "#111", lineHeight: 1.3 }}
            className="mb-2">
            They&apos;ll ask about<br />
            <span style={{ background: "#FFD600", padding: "1px 10px", borderRadius: "6px", fontStyle: "italic" }}>
              your projects.
            </span>
          </h1>
          <p className="mb-8 text-[14px] text-[#6B7280] leading-relaxed">
            Upload your resume. We&apos;ll generate questions specific to YOUR projects, your stack, your claims — exactly how a real interviewer would.
          </p>

          {/* Mode toggle */}
          <div className="flex gap-2 mb-5">
            <button onClick={() => setMode("file")}
              className={`flex-1 rounded-xl py-2.5 text-[13px] font-bold transition-all ${
                mode === "file" ? "bg-[#111] text-white" : "bg-white border border-[#E5E7EB] text-[#374151]"
              }`}>
              📄 Upload PDF
            </button>
            <button onClick={() => setMode("text")}
              className={`flex-1 rounded-xl py-2.5 text-[13px] font-bold transition-all ${
                mode === "text" ? "bg-[#111] text-white" : "bg-white border border-[#E5E7EB] text-[#374151]"
              }`}>
              ✏️ Paste text
            </button>
          </div>

          {mode === "file" ? (
            <div
              onDragOver={e => { e.preventDefault(); setDragActive(true); }}
              onDragLeave={() => setDragActive(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`rounded-2xl border-2 border-dashed p-10 text-center cursor-pointer transition-all ${
                dragActive ? "border-[#111] bg-white" : "border-[#D1D5DB] bg-white hover:border-[#9CA3AF]"
              }`}
            >
              <div className="text-[40px] mb-3">📄</div>
              <p className="text-[14px] font-bold text-[#111] mb-1">
                {dragActive ? "Drop your resume here" : "Drag & drop your resume"}
              </p>
              <p className="text-[12px] text-[#9CA3AF]">or click to browse · PDF, max 5MB</p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf"
                className="hidden"
                onChange={e => {
                  const file = e.target.files?.[0];
                  if (file) onFileSelected(file);
                }}
              />
            </div>
          ) : (
            <div>
              <textarea
                value={pastedText}
                onChange={e => setPastedText(e.target.value)}
                placeholder="Paste your resume text or project descriptions here..."
                className="w-full rounded-2xl border border-[#E5E7EB] bg-white p-4 min-h-[200px] text-[14px] text-[#374151] focus:border-[#111] focus:outline-none resize-none"
              />
              <button
                onClick={() => onTextSubmit(pastedText)}
                disabled={pastedText.trim().length < 50}
                className="w-full mt-3 rounded-2xl bg-[#111] py-4 text-[14px] font-black text-white hover:bg-[#333] transition disabled:opacity-40"
              >
                Generate my questions →
              </button>
            </div>
          )}

          {error && (
            <div className="mt-4 rounded-xl border border-rose-100 bg-rose-50 px-4 py-3">
              <p className="text-[13px] text-rose-700">{error}</p>
            </div>
          )}

          <p className="mt-4 text-[11px] text-[#9CA3AF] text-center">
            Your resume is used only to generate questions — never shared or stored beyond this session
          </p>
        </motion.div>
      </div>

      {/* RIGHT: Info panel */}
      <div className="hidden lg:flex flex-col bg-white overflow-y-auto">
        <div className="px-8 pt-10 pb-6 border-b border-[#F3F4F6]">
          <p className="text-[10px] font-black uppercase tracking-widest text-[#9CA3AF] mb-4">
            How this is different
          </p>
          <div className="space-y-4">
            {[
              { icon: "🎯", title: "Questions about YOUR projects", sub: "Not generic — \"Walk me through how you handled order tracking in your delivery app\"" },
              { icon: "🔍", title: "Probes your exact tech stack", sub: "\"You listed Redis — what did you actually use it for?\"" },
              { icon: "⚠️", title: "Tests for resume inflation", sub: "If you said \"led\" or \"architected\", expect to be asked what that specifically meant" },
              { icon: "📊", title: "Resume Consistency Score", sub: "Your report shows whether your spoken answers matched what's written" },
            ].map(({ icon, title, sub }) => (
              <div key={title} className="flex items-start gap-3">
                <span className="text-[20px] mt-0.5">{icon}</span>
                <div>
                  <p className="text-[13px] font-bold text-[#111]">{title}</p>
                  <p className="text-[11px] text-[#9CA3AF] mt-0.5 leading-relaxed">{sub}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="px-8 py-6">
          <p className="text-[10px] font-black uppercase tracking-widest text-[#9CA3AF] mb-4">
            Sample question
          </p>
          <div className="rounded-2xl bg-[#111] p-5">
            <p className="text-[10px] font-black uppercase tracking-widest text-[#555] mb-3">
              Based on your resume
            </p>
            <p className="text-[14px] text-white leading-relaxed">
              &quot;I see you built a food delivery API using Redis for caching. Walk me through what specifically you cached, and how you handled cache invalidation when order status changed.&quot;
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Extracting screen ──────────────────────────────────────────────────────

function ExtractingScreen() {
  return (
    <div className="flex min-h-[calc(100vh-72px)] items-center justify-center">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center">
        <div className="mx-auto mb-5 h-12 w-12 animate-spin rounded-full border-3 border-gray-200 border-t-[#111]" />
        <p className="text-[16px] font-bold text-[#111] mb-1">Reading your resume...</p>
        <p className="text-[13px] text-[#9CA3AF]">Extracting projects, skills, and experience</p>
      </motion.div>
    </div>
  );
}

// ─── Confirm screen ─────────────────────────────────────────────────────────

function ConfirmScreen({
  resumeData,
  onConfirm,
  onEdit,
  loading,
}: {
  resumeData: ExtractedResume;
  onConfirm: (role: string) => void;
  onEdit: () => void;
  loading: boolean;
}) {
  const [role, setRole] = useState(ROLES[0]);

  return (
    <div className="min-h-[calc(100vh-72px)] py-10 px-6" style={{ background: "#FAFAF7" }}>
      <div className="max-w-3xl mx-auto">

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <div className="text-center mb-8">
            <div className="text-[40px] mb-3">✅</div>
            <h1 className="text-[26px] font-black text-[#111]" style={{ letterSpacing: "-0.5px" }}>
              Here&apos;s what we found
            </h1>
            <p className="text-[14px] text-[#6B7280] mt-1">
              Review and confirm — your questions will be generated from this
            </p>
          </div>

          {/* Projects */}
          {resumeData.projects.length > 0 && (
            <div className="rounded-2xl border border-[#E5E7EB] bg-white p-5 mb-4">
              <p className="text-[11px] font-black uppercase tracking-widest text-[#9CA3AF] mb-4">
                Projects ({resumeData.projects.length})
              </p>
              <div className="space-y-3">
                {resumeData.projects.map((p, i) => (
                  <div key={i} className="rounded-xl bg-[#F9FAFB] border border-[#F3F4F6] p-4">
                    <div className="flex items-center justify-between mb-1.5">
                      <p className="text-[14px] font-bold text-[#111]">{p.name}</p>
                    </div>
                    {p.tech_stack.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        {p.tech_stack.map((t, ti) => (
                          <span key={ti} className="rounded-full bg-white border border-[#E5E7EB] px-2 py-0.5 text-[11px] font-medium text-[#374151]">
                            {t}
                          </span>
                        ))}
                      </div>
                    )}
                    <p className="text-[12px] text-[#6B7280] leading-relaxed">{p.description}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Skills + Experience grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            {resumeData.skills.length > 0 && (
              <div className="rounded-2xl border border-[#E5E7EB] bg-white p-5">
                <p className="text-[11px] font-black uppercase tracking-widest text-[#9CA3AF] mb-3">Skills</p>
                <div className="flex flex-wrap gap-1.5">
                  {resumeData.skills.map((s, i) => (
                    <span key={i} className="rounded-full bg-[#EDE9FE] px-2.5 py-1 text-[11px] font-bold text-[#5B21B6]">
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {resumeData.experience.length > 0 && (
              <div className="rounded-2xl border border-[#E5E7EB] bg-white p-5">
                <p className="text-[11px] font-black uppercase tracking-widest text-[#9CA3AF] mb-3">Experience</p>
                <div className="space-y-1.5">
                  {resumeData.experience.map((e, i) => (
                    <p key={i} className="text-[12px] text-[#374151]">{e}</p>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Role selector */}
          <div className="rounded-2xl border border-[#E5E7EB] bg-white p-5 mb-6">
            <p className="text-[11px] font-black uppercase tracking-widest text-[#9CA3AF] mb-3">
              What role are you targeting?
            </p>
            <div className="flex flex-wrap gap-2">
              {ROLES.map(r => (
                <button key={r} onClick={() => setRole(r)}
                  className={`rounded-xl px-3 py-1.5 text-[12px] font-bold border transition-all ${
                    role === r
                      ? "border-[#111] bg-[#111] text-white"
                      : "border-[#E5E7EB] bg-white text-[#374151] hover:border-[#111]"
                  }`}>
                  {r}
                </button>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button onClick={onEdit}
              className="rounded-2xl border-2 border-[#E5E7EB] bg-white px-6 py-4 text-[14px] font-bold text-[#374151] hover:border-[#111] transition">
              Re-upload
            </button>
            <button onClick={() => onConfirm(role)} disabled={loading}
              className="flex-1 rounded-2xl bg-[#111] py-4 text-[14px] font-black text-white hover:bg-[#333] transition disabled:opacity-50">
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  Generating questions...
                </span>
              ) : "Looks good — start interview →"}
            </button>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

// ─── Upgrade screen ─────────────────────────────────────────────────────────

function UpgradeScreen() {
  return (
    <div className="flex min-h-[calc(100vh-72px)] items-center justify-center">
      <div className="mx-auto max-w-[420px] px-5 text-center">
        <div className="text-[52px] mb-5">📄</div>
        <h1 className="text-[24px] font-black text-[#111] mb-2" style={{ letterSpacing: "-0.5px" }}>
          Resume Prep is a Max feature
        </h1>
        <p className="text-[14px] text-[#6B7280] mb-8 leading-relaxed">
          Get interview questions generated specifically from YOUR resume — your projects, your tech stack, your claims. The closest simulation to a real interview.
        </p>
        <Link href="/pricing">
          <button className="w-full rounded-2xl bg-[#111] py-4 text-[15px] font-black text-white hover:bg-[#333] transition">
            View Max plan →
          </button>
        </Link>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ResumePrepPage() {
  const { user, authHeader } = useAuth();
  const router = useRouter();
  const [view, setView] = useState<ViewState>("upload");
  const [error, setError] = useState<string | null>(null);
  const [resumeData, setResumeData] = useState<ExtractedResume | null>(null);

  const handleFile = useCallback(async (file: File) => {
    setError(null);
    setView("extracting");
    try {
      const formData = new FormData();
      formData.append("file", file);

      const headers = authHeader();
      const res = await fetch(`${API_BASE}/api/resume-prep/extract`, {
        method: "POST",
        headers, // no Content-Type — browser sets multipart boundary
        body: formData,
      });

      if (res.status === 403) { setView("upgrade"); return; }

      const data = await res.json();
      if (!res.ok) throw new Error(data?.detail || "Failed to extract resume");

      setResumeData(data);
      setView("confirm");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to read resume");
      setView("upload");
    }
  }, [authHeader]);

  const handleText = useCallback(async (text: string) => {
    setError(null);
    setView("extracting");
    try {
      const res = await fetch(`${API_BASE}/api/resume-prep/extract-text`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader() },
        body: JSON.stringify({ raw_text: text }),
      });

      if (res.status === 403) { setView("upgrade"); return; }

      const data = await res.json();
      if (!res.ok) throw new Error(data?.detail || "Failed to extract resume");

      setResumeData(data);
      setView("confirm");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to read resume");
      setView("upload");
    }
  }, [authHeader]);

  const handleConfirm = useCallback(async (role: string) => {
    if (!resumeData) return;
    setView("starting");
    try {
      const res = await fetch(`${API_BASE}/api/resume-prep/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader() },
        body: JSON.stringify({
          role_target: role,
          resume_data: resumeData,
          duration_mins: 30,
        }),
      });

      if (res.status === 403) { setView("upgrade"); return; }

      const data = await res.json();
      if (!res.ok) throw new Error(data?.detail || "Failed to start session");

      // Reuse existing mock session flow
      if (typeof window !== "undefined") {
        localStorage.setItem("mock_interview_id", data.interview_id);
        localStorage.setItem("mock_session_id", data.session_id);
      }
      router.push(`/mock/session/${data.session_id}`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to start session");
      setView("confirm");
    }
  }, [resumeData, authHeader, router]);

  if (!user) {
    return (
      <div className="min-h-screen bg-[#FAFAF8] flex items-center justify-center px-6">
        <div className="text-center max-w-[400px]">
          <div className="text-[52px] mb-5">📄</div>
          <h1 className="text-[24px] font-black text-[#111] mb-2" style={{ letterSpacing: "-0.5px" }}>Resume Prep</h1>
          <p className="text-[14px] text-[#6B7280] mb-6">Sign in to generate questions from your resume.</p>
          <div className="flex gap-3 justify-center">
            <Link href="/login" className="rounded-xl bg-[#111] px-6 py-3 text-[13px] font-black text-white hover:bg-[#333] transition">Sign in</Link>
            <Link href="/signup" className="rounded-xl border border-[#E5E7EB] bg-white px-6 py-3 text-[13px] font-medium text-[#374151] hover:bg-[#F9FAFB] transition">Create account</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAFAF8]">
      <main className="pt-[72px]">
        <AnimatePresence mode="wait">
          {view === "upload" && (
            <UploadScreen key="upload" onFileSelected={handleFile} onTextSubmit={handleText} error={error} />
          )}
          {view === "extracting" && <ExtractingScreen key="extracting" />}
          {view === "confirm" && resumeData && (
            <ConfirmScreen
              key="confirm"
              resumeData={resumeData}
              onConfirm={handleConfirm}
              onEdit={() => setView("upload")}
              loading={false}
            />
          )}
          {view === "starting" && (
            <div key="starting" className="flex min-h-[calc(100vh-72px)] items-center justify-center">
              <div className="text-center">
                <div className="mx-auto mb-5 h-12 w-12 animate-spin rounded-full border-3 border-gray-200 border-t-[#111]" />
                <p className="text-[16px] font-bold text-[#111] mb-1">Generating your questions...</p>
                <p className="text-[13px] text-[#9CA3AF]">Personalizing based on your projects</p>
              </div>
            </div>
          )}
          {view === "upgrade" && <UpgradeScreen key="upgrade" />}
        </AnimatePresence>
      </main>
    </div>
  );
}