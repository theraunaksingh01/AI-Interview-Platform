// join/page.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Video,
  VideoOff,
  Mic,
  MicOff,
  Monitor,
  User,
  Volume2,
  Eye,
  UserX,
  RefreshCcw,
  ArrowRight,
  CheckCircle2,
  Circle,
  Shield,
} from "lucide-react";

export const dynamic = "force-dynamic";

const API_BASE = (
  process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000"
).replace(/\/$/, "");

export default function JoinInterviewPage() {
  const { id } = useParams();
  const interviewId = id as string;
  const router = useRouter();

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [cameraOn, setCameraOn] = useState(false);
  const [micOn, setMicOn] = useState(false);
  const [permissionsReady, setPermissionsReady] = useState(false);

  /* ------------ Interview Metadata (fetched from backend) ------------ */
  const [interviewTitle, setInterviewTitle] = useState("Loading interview...");
  const [questionsReady, setQuestionsReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function fetchStatus() {
      try {
        const res = await fetch(`${API_BASE}/public/interview/${interviewId}/status`);
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;

        if (data.questions_ready) setQuestionsReady(true);

        const title = data.role_title
          ? `${data.role_title} – Technical Interview`
          : "Technical Interview";
        setInterviewTitle(title);
      } catch {
        if (!cancelled) setInterviewTitle("Technical Interview");
      }
    }

    fetchStatus();
    return () => { cancelled = true; };
  }, [interviewId]);

  /* ---------------- Camera / Mic Lifecycle ---------------- */

  async function enableCamera() {
    try {
      // Always request a NEW stream (important)
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: micOn,
      });

      streamRef.current = stream;
      setCameraOn(true);
    } catch {
      alert("Camera permission denied");
    }
  }

  async function enableMic() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: cameraOn,
      });

      streamRef.current = stream;
      setMicOn(true);
    } catch {
      alert("Microphone permission denied");
    }
  }

  function disableCamera() {
    if (streamRef.current) {
      streamRef.current.getVideoTracks().forEach((t) => t.stop());
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraOn(false);
  }

  function disableMic() {
    streamRef.current?.getAudioTracks().forEach((t) => t.stop());
    setMicOn(false);
  }

  /* ---------------- Bind video safely ---------------- */

  useEffect(() => {
    if (!cameraOn) return;
    if (!videoRef.current) return;
    if (!streamRef.current) return;

    videoRef.current.srcObject = streamRef.current;
    videoRef.current
      .play()
      .catch((err) => console.warn("Video play failed:", err));
  }, [cameraOn]);

  /* ---------------- Permissions Ready ---------------- */

  useEffect(() => {
    setPermissionsReady(cameraOn && micOn);
  }, [cameraOn, micOn]);

  function startInterview() {
    if (!permissionsReady) return;

    // If questions aren't ready yet, go to prepare page to wait
    if (!questionsReady) {
      router.push(`/interview/${interviewId}/prepare`);
      return;
    }

    //  HARD audio unlock via user gesture
    const a = new Audio();
    a.muted = true;
    a.play().catch(() => {});

    // persist unlock for live page
    sessionStorage.setItem("audioUnlocked", "true");

    router.push(`/interview/${interviewId}/live`);
  }

  /* ---------------- Guidelines Data ---------------- */
  const guidelines = [
    { icon: Monitor, text: "Sit in a quiet, well-lit place" },
    { icon: Eye, text: "Look at the screen while answering" },
    { icon: Volume2, text: "Speak clearly at a normal pace" },
    { icon: UserX, text: "No other person should be present" },
    { icon: RefreshCcw, text: "Do not refresh during interview" },
  ];

  /* ---------------- UI ---------------- */

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50/50 to-white flex items-center justify-center px-4 py-8 relative overflow-hidden">
      {/* Decorative background glows */}
      <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-indigo-200/30 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-cyan-200/20 rounded-full blur-[100px] pointer-events-none" />

      <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-[1.3fr_1fr] gap-6 items-center">
        {/* LEFT: Video Preview */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="relative"
        >
          <div className="bg-white backdrop-blur-xl border border-gray-200 rounded-3xl overflow-hidden shadow-2xl shadow-black/5">
            {/* Video area */}
            <div className="relative aspect-[4/3] bg-gray-100">
              {cameraOn ? (
                <video
                  ref={videoRef}
                  autoPlay
                  muted
                  playsInline
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center gap-3">
                  <div className="w-20 h-20 rounded-full bg-gray-200 border border-gray-300 flex items-center justify-center">
                    <User className="w-10 h-10 text-gray-400" />
                  </div>
                  <span className="text-gray-400 text-sm">Camera is off</span>
                </div>
              )}

              {/* Name label */}
              <div className="absolute bottom-3 left-3 bg-black/50 backdrop-blur-sm rounded-lg px-3 py-1.5 flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-white text-xs font-medium">You</span>
              </div>
            </div>

            {/* Controls bar */}
            <div className="flex items-center justify-center gap-3 p-4 bg-gray-50/80">
              <button
                onClick={cameraOn ? disableCamera : enableCamera}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-medium transition-all ${
                  cameraOn
                    ? "bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-200"
                    : "bg-red-50 text-red-600 hover:bg-red-100 border border-red-200"
                }`}
              >
                {cameraOn ? <Video className="w-4 h-4" /> : <VideoOff className="w-4 h-4" />}
                {cameraOn ? "Camera On" : "Camera Off"}
              </button>

              <button
                onClick={micOn ? disableMic : enableMic}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-medium transition-all ${
                  micOn
                    ? "bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-200"
                    : "bg-red-50 text-red-600 hover:bg-red-100 border border-red-200"
                }`}
              >
                {micOn ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
                {micOn ? "Mic On" : "Mic Off"}
              </button>
            </div>
          </div>
        </motion.div>

        {/* RIGHT: Info + Instructions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut", delay: 0.15 }}
          className="bg-white backdrop-blur-xl border border-gray-200 rounded-3xl p-8 flex flex-col justify-between shadow-2xl shadow-black/5"
        >
          <div>
            {/* Header */}
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-cyan-400 flex items-center justify-center">
                  <Shield className="w-4 h-4 text-white" />
                </div>
                <span className="text-gray-400 text-xs font-medium uppercase tracking-wider">AI Interview</span>
              </div>
              <h1 className="text-2xl font-bold text-gray-900 mb-1">Ready to join?</h1>
              <p className="text-gray-500 text-sm">{interviewTitle}</p>
            </div>

            {/* Guidelines */}
            <div className="mb-6">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                Guidelines
              </h3>
              <div className="space-y-2.5">
                {guidelines.map((g, i) => (
                  <div key={i} className="flex items-center gap-3 text-sm text-gray-600">
                    <g.icon className="w-4 h-4 text-indigo-500 shrink-0" />
                    <span>{g.text}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Device Readiness */}
            <div className="mb-8 bg-gray-50 border border-gray-100 rounded-2xl p-4">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                Device Check
              </h3>
              <div className="space-y-2.5">
                <div className="flex items-center gap-3">
                  {cameraOn ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  ) : (
                    <Circle className="w-4 h-4 text-gray-300" />
                  )}
                  <span className={`text-sm ${cameraOn ? "text-gray-700" : "text-gray-400"}`}>
                    Camera {cameraOn ? "ready" : "not connected"}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  {micOn ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  ) : (
                    <Circle className="w-4 h-4 text-gray-300" />
                  )}
                  <span className={`text-sm ${micOn ? "text-gray-700" : "text-gray-400"}`}>
                    Microphone {micOn ? "ready" : "not connected"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* CTA */}
          <div>
            <button
              disabled={!permissionsReady}
              onClick={startInterview}
              className={`w-full py-3.5 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2 ${
                permissionsReady
                  ? "bg-gradient-to-r from-indigo-600 to-cyan-500 text-white hover:shadow-lg hover:shadow-indigo-500/25 hover:-translate-y-0.5"
                  : "bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200"
              }`}
            >
              {questionsReady ? "Start Interview" : "Start Interview"}
              {permissionsReady && <ArrowRight className="w-4 h-4" />}
            </button>

            {!questionsReady && permissionsReady && (
              <p className="text-xs text-amber-600 mt-2 text-center">
                Questions are being prepared...
              </p>
            )}

            <p className="text-xs text-gray-400 mt-3 text-center">
              Camera and microphone must be enabled to proceed
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
