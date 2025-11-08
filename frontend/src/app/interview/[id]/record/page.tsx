"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";

type Device = { deviceId: string; label: string };
type InterviewQuestion = {
  id: number;
  question_text: string;
  type: "voice" | "code";
  time_limit_seconds: number;
  description?: string | null;
};

export default function RecordAnswerPage() {
  const { id: interviewId } = useParams() as { id: string };
  const qs = useSearchParams();
  const questionId = qs.get("question");

  const API = process.env.NEXT_PUBLIC_API_URL!;
  const token =
    typeof window !== "undefined" ? localStorage.getItem("access_token") || "" : "";

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number | null>(null);

  const [cams, setCams] = useState<Device[]>([]);
  const [mics, setMics] = useState<Device[]>([]);
  const [camId, setCamId] = useState<string>("");
  const [micId, setMicId] = useState<string>("");
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [level, setLevel] = useState<number>(0); // 0..100
  const [busy, setBusy] = useState(false);
  const [uploadResult, setUploadResult] = useState<{ id: number; key: string } | null>(null);

  // NEW: show the question on this page
  const [question, setQuestion] = useState<InterviewQuestion | null>(null);

  // ---- enumerate devices once
  useEffect(() => {
    (async () => {
      try {
        await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
        const all = await navigator.mediaDevices.enumerateDevices();
        const cams_ = all
          .filter((d) => d.kind === "videoinput")
          .map((d) => ({ deviceId: d.deviceId, label: d.label || "Camera" }));
        const mics_ = all
          .filter((d) => d.kind === "audioinput")
          .map((d) => ({ deviceId: d.deviceId, label: d.label || "Microphone" }));
        setCams(cams_);
        setMics(mics_);
        setCamId((s) => s || cams_[0]?.deviceId || "");
        setMicId((s) => s || mics_[0]?.deviceId || "");
      } catch (e) {
        console.error(e);
        alert("Could not access camera/microphone.");
      }
    })();
  }, []);

  // ---- fetch the question text for banner
  useEffect(() => {
    (async () => {
      if (!questionId) return;
      try {
        const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
        const r = await fetch(`${API}/interview/questions/${interviewId}`, { headers });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const arr: InterviewQuestion[] = await r.json();
        const q = arr.find((x) => String(x.id) === String(questionId)) || null;
        setQuestion(q);
      } catch (e) {
        console.error(e);
      }
    })();
  }, [API, interviewId, questionId, token]);

  // ---- start preview when device changes (not recording)
  useEffect(() => {
    if (recording) return;
    (async () => {
      if (!camId && !micId) return;
      await startPreview();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [camId, micId]);

  async function startPreview() {
    cleanupStream();
    const constraints: MediaStreamConstraints = {
      video: camId ? { deviceId: { exact: camId }, width: { ideal: 1280 }, height: { ideal: 720 } } : false,
      audio: micId
        ? {
            deviceId: { exact: micId },
            echoCancellation: true,
            noiseSuppression: true,
            channelCount: 1,
            sampleRate: 48000,
          }
        : false,
    };
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    streamRef.current = stream;

    if (videoRef.current) {
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
    }

    // mic level meter
    if (micId && stream.getAudioTracks().length) {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      const data = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        analyser.getByteTimeDomainData(data);
        let max = 0;
        for (let i = 0; i < data.length; i++) max = Math.max(max, Math.abs(data[i] - 128));
        setLevel(Math.min(100, Math.round((max / 128) * 100)));
        rafRef.current = requestAnimationFrame(tick);
      };
      tick();
    }
  }

  function cleanupStream() {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    if (analyserRef.current) {
      try {
        (analyserRef.current as any).disconnect?.();
      } catch {}
      analyserRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }

  async function startRecording() {
    if (!streamRef.current) await startPreview();
    if (!streamRef.current) return;

    setBlob(null);
    setUploadResult(null);
    chunksRef.current = [];

    const mimeCandidates = [
      "video/webm;codecs=vp9,opus",
      "video/webm;codecs=vp8,opus",
      "video/webm",
    ];
    const mt = mimeCandidates.find((m) => MediaRecorder.isTypeSupported(m)) || "";
    const rec = new MediaRecorder(streamRef.current!, mt ? { mimeType: mt } : undefined);
    rec.ondataavailable = (e) => e.data && e.data.size && chunksRef.current.push(e.data);
    rec.onstop = () => {
      const b = new Blob(chunksRef.current, { type: mt || "video/webm" });
      setBlob(b);
      setRecording(false);
      cleanupStream(); // turn off camera after stop
    };
    rec.start();
    mediaRecorderRef.current = rec;
    setRecording(true);
    setElapsed(0);
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop();
  }

  // elapsed timer
  useEffect(() => {
    if (!recording) return;
    const t = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [recording]);

  const sizeLabel = useMemo(() => {
    if (!blob) return "";
    const mb = blob.size / (1024 * 1024);
    return `${mb.toFixed(1)} MB`;
  }, [blob]);

  async function uploadAndSave() {
    if (!blob) return;
    if (!token) return alert("Not logged in.");
    if (!API) return alert("NEXT_PUBLIC_API_URL not set.");

    setBusy(true);
    try {
      // 1) upload to /upload/proxy
      const file = new File([blob], `answer-${Date.now()}.webm`, { type: blob.type || "video/webm" });
      const fd = new FormData();
      fd.append("file", file);
      fd.append("folder", `interview/${interviewId}`);

      const up = await fetch(`${API}/upload/proxy`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      const upJson = await up.json();
      if (!up.ok) throw new Error(upJson?.detail || "Upload failed");
      setUploadResult({ id: upJson.id, key: upJson.key });

      // 2) save answer row
      if (questionId) {
        const save = await fetch(`${API}/interview/answer`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            question_id: Number(questionId),
            upload_id: upJson.id,
          }),
        });
        if (!save.ok) throw new Error(await save.text());
      }

      alert(`✅ Saved! Upload #${upJson.id}`);
    } catch (e: any) {
      console.error(e);
      alert(e?.message || "Failed to upload/save");
    } finally {
      setBusy(false);
    }
  }

  async function transcribeNow() {
    if (!uploadResult) return;
    try {
      const r = await fetch(`${API}/transcribe/upload/${uploadResult.id}`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || `HTTP ${r.status}`);
      alert("📝 Transcription complete.");
    } catch (e: any) {
      alert(e?.message || "Transcription failed");
    }
  }

  return (
    <div className="full-bleed max-w-5xl mx-auto p-6">
      <div className="flex items-center justify-between mb-4">
        <a href={`/interview/${interviewId}`} className="text-sm text-gray-600 underline">
          ← Back to Questions
        </a>
        <div className="text-2xl font-semibold">Interview Recording</div>
        <div />
      </div>

      {/*  question banner */}
      {question && (
        <div className="mb-4 rounded-xl border border-indigo-200 bg-indigo-50 p-8 ">
          <div className="text-2l text-indigo-900">
            <span className="font-semibold">Question:</span> {question.question_text}
          </div>
          {question.description && (
            <div className="text-2l text-indigo-900/80 mt-1 whitespace-pre-wrap">
              {question.description}
            </div>
          )}
        </div>
      )}

      {/* Top status bar */}
      <div className="flex gap-3 mb-4">
        <span className="px-2.5 py-1 rounded-full text-xs bg-gray-100 border border-gray-200">
          ⏱️ {Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, "0")}
        </span>
        <span className="px-2.5 py-1 rounded-full text-xs bg-gray-100 border border-gray-200">
          🎙️ Mic level
          <span className="inline-block ml-2 h-2 w-24 rounded bg-gray-200 align-middle">
            <span className="block h-2 rounded bg-emerald-500" style={{ width: `${level}%` }} />
          </span>
        </span>
        {blob && (
          <span className="px-2.5 py-1 rounded-full text-xs bg-gray-100 border border-gray-200">
            📦 {sizeLabel}
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Video card */}
        <div className="lg:col-span-2 rounded-2xl border border-gray-200 overflow-hidden bg-white">
          <div className="px-4 py-3 border-b text-sm text-gray-600">
            {recording ? "Recording…" : blob ? "Preview" : "Preview (camera off until Start)"}
          </div>
          <div className="p-4">
            <div className="aspect-video w-full bg-black/80 rounded-xl overflow-hidden">
              <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              {!recording ? (
                <button
                  onClick={startRecording}
                  className="px-4 py-2 rounded-xl text-white bg-emerald-600 hover:bg-emerald-700"
                >
                  ▶️ Start Recording
                </button>
              ) : (
                <button
                  onClick={stopRecording}
                  className="px-4 py-2 rounded-xl text-white bg-rose-600 hover:bg-rose-700"
                >
                  ⏹ Stop
                </button>
              )}

              <button
                onClick={() => {
                  setBlob(null);
                  setUploadResult(null);
                  startPreview();
                }}
                disabled={recording}
                className="px-3 py-2 rounded-xl border border-gray-200 hover:bg-gray-50 disabled:opacity-50"
              >
                🔁 Retake
              </button>

              <button
                onClick={uploadAndSave}
                disabled={!blob || busy}
                className="px-3 py-2 rounded-xl border border-indigo-200 text-indigo-700 bg-indigo-50 hover:bg-indigo-100 disabled:opacity-50"
              >
                ⬆ Upload & Save
              </button>

              <button
                onClick={transcribeNow}
                disabled={!uploadResult}
                className="px-3 py-2 rounded-xl border border-amber-200 text-amber-800 bg-amber-50 hover:bg-amber-100 disabled:opacity-50"
              >
                📝 Transcribe Now
              </button>

              <a
                href={`/interview/${interviewId}`}
                className="ml-auto px-3 py-2 rounded-xl border border-gray-200 hover:bg-gray-50"
              >
                Done → Back to Questions
              </a>
            </div>
          </div>
        </div>

        {/* Right: settings */}
        <div className="rounded-2xl border border-gray-200 bg-white">
          <div className="px-4 py-3 border-b text-sm font-semibold">Device & Quality</div>
          <div className="p-4 space-y-4 text-sm">
            <div>
              <div className="mb-1 text-gray-600">Camera</div>
              <select
                value={camId}
                onChange={(e) => setCamId(e.target.value)}
                className="w-full border rounded-lg px-3 py-2"
              >
                {cams.map((c) => (
                  <option key={c.deviceId} value={c.deviceId}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <div className="mb-1 text-gray-600">Microphone</div>
              <select
                value={micId}
                onChange={(e) => setMicId(e.target.value)}
                className="w-full border rounded-lg px-3 py-2"
              >
                {mics.map((m) => (
                  <option key={m.deviceId} value={m.deviceId}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <div className="mb-1 text-gray-600">Tips</div>
              <ul className="list-disc pl-5 text-gray-600 space-y-1">
                <li>Keep your face centered and well-lit.</li>
                <li>Speak clearly; avoid background noise.</li>
                <li>Stop and review before you upload.</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
