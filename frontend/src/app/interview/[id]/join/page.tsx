// join/page.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";

export const dynamic = "force-dynamic";

export default function JoinInterviewPage() {
  const { id } = useParams();
  const interviewId = id as string;
  const router = useRouter();

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [cameraOn, setCameraOn] = useState(false);
  const [micOn, setMicOn] = useState(false);
  const [permissionsReady, setPermissionsReady] = useState(false);

  /* ---------------- Interview Metadata (mock for now) ---------------- */
  const interviewTitle = "Software Engineer – Technical Interview";

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

  //  HARD audio unlock via user gesture
  const a = new Audio();
  a.muted = true;
  a.play().catch(() => {});

  // persist unlock for live page
  sessionStorage.setItem("audioUnlocked", "true");

  router.push(`/interview/${interviewId}/live`);
}


  /* ---------------- UI ---------------- */

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center px-4">
      <div className="bg-white w-full max-w-5xl rounded-2xl shadow-lg grid grid-cols-[1.4fr_1fr] overflow-hidden">
        {/* LEFT: Video Preview */}
        <div className="bg-black relative">
          {cameraOn ? (
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-400 text-sm">
              Camera preview will appear here
            </div>
          )}

          {/* Bottom Controls */}
          <div className="absolute bottom-5 left-1/2 -translate-x-1/2 flex gap-4">
            <button
              onClick={cameraOn ? disableCamera : enableCamera}
              className={`px-5 py-2 rounded-full text-sm font-medium transition ${
                cameraOn
                  ? "bg-gray-800 text-white"
                  : "bg-gray-200 text-gray-800 hover:bg-gray-300"
              }`}
            >
              {cameraOn ? "Camera On" : "Turn Camera On"}
            </button>

            <button
              onClick={micOn ? disableMic : enableMic}
              className={`px-5 py-2 rounded-full text-sm font-medium transition ${
                micOn
                  ? "bg-gray-800 text-white"
                  : "bg-gray-200 text-gray-800 hover:bg-gray-300"
              }`}
            >
              {micOn ? "Mic On" : "Turn Mic On"}
            </button>
          </div>
        </div>

        {/* RIGHT: Info + Instructions */}
        <div className="p-8 flex flex-col justify-between">
          <div>
            <h1 className="text-2xl font-semibold mb-1">Join Interview</h1>
            <p className="text-gray-600 mb-6">{interviewTitle}</p>

            <div className="mb-6">
              <h3 className="text-sm font-semibold mb-3">
                Interview Guidelines
              </h3>
              <ul className="text-sm text-gray-600 space-y-2">
                <li>• Sit in a quiet, well-lit place</li>
                <li>• Look at the screen while answering</li>
                <li>• Speak clearly at a normal pace</li>
                <li>• No other person should be present</li>
                <li>• Do not refresh during interview</li>
              </ul>
            </div>

            <div className="space-y-2 text-sm pb-8">
              <div className="flex items-center gap-2">
                <span
                  className={`w-2.5 h-2.5 rounded-full ${
                    cameraOn ? "bg-blue-500" : "bg-gray-300"
                  }`}
                />
                <span>Camera {cameraOn ? "enabled" : "disabled"}</span>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`w-2.5 h-2.5 rounded-full ${
                    micOn ? "bg-blue-500" : "bg-gray-300"
                  }`}
                />
                <span>Microphone {micOn ? "enabled" : "disabled"}</span>
              </div>
            </div>
          </div>

          <div>
            <button
              disabled={!permissionsReady}
              onClick={startInterview}
              className={`w-full py-3 rounded-lg text-white font-semibold transition ${
                permissionsReady
                  ? "bg-blue-600 hover:bg-blue-700"
                  : "bg-gray-300 cursor-not-allowed"
              }`}
            >
              Start Interview
            </button>

            <p className="text-xs text-gray-500 mt-3 text-center">
              Camera and microphone must be enabled to proceed.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
