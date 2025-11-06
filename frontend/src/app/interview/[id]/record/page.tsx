// frontend/src/app/interview/[id]/record/page.tsx
"use client";

import { useRef, useState } from "react";
import { useParams } from "next/navigation";

export default function InterviewPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const [recording, setRecording] = useState(false);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);

  const { id: interviewId } = useParams() as { id: string };

  async function startRecording() {
  // 1) Enumerate devices once
  const devices = await navigator.mediaDevices.enumerateDevices();
  const mics = devices.filter(d => d.kind === "audioinput");

  // Pick the first mic (or build a dropdown from `mics` to choose)
  const deviceId = mics[0]?.deviceId;

  const constraints: MediaStreamConstraints = {
    video: { width: { ideal: 1280 }, height: { ideal: 720 } },
    audio: {
      deviceId: deviceId ? { exact: deviceId } : undefined,
      echoCancellation: true,
      noiseSuppression: true,
      channelCount: 1,
      sampleRate: 48000,
    } as MediaTrackConstraints,
  };

  const stream = await navigator.mediaDevices.getUserMedia(constraints);

  if (videoRef.current) {
    videoRef.current.srcObject = stream;
    await videoRef.current.play();
  }

  // Prefer a mimeType that guarantees Opus audio
  const mimeCandidates = [
    "video/webm;codecs=vp8,opus",
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=opus",
    "video/webm"
  ];
  const mimeType = mimeCandidates.find(t => MediaRecorder.isTypeSupported(t)) || "";

  const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);

  const chunks: BlobPart[] = [];
  recorder.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };

  recorder.onstop = () => {
    const blob = new Blob(chunks, { type: mimeType || "video/webm" });
    setRecordedBlob(blob);
    // stop tracks so the camera/mic turn off
    stream.getTracks().forEach((t) => t.stop());
  };

  recorder.start(); // single blob; (later we can chunk)
  mediaRecorderRef.current = recorder;
  setRecording(true);
}


  function stopRecording() {
    mediaRecorderRef?.current?.stop();
    setRecording(false);
  }

  // NEW: Upload via multipart/form-data -> /upload/proxy (NO presign)
  async function uploadToBackend() {
  if (!recordedBlob) return;

  const API = process.env.NEXT_PUBLIC_API_URL!;
  const token = localStorage.getItem("access_token") || "";
  const questionId = new URLSearchParams(window.location.search).get("question");

  if (!token) { alert("Not logged in"); return; }
  if (!questionId) { alert("Missing question id"); return; }

  try {
    // 1) Upload video (proxy multipart)
    const file = new File([recordedBlob], `interview-${Date.now()}.webm`, { type: "video/webm" });
    const form = new FormData();
    form.append("file", file);
    form.append("folder", `interview/${interviewId}`);

    const uploadRes = await fetch(`${API}/upload/proxy`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    });
    const uploadJson = await uploadRes.json();
    if (!uploadRes.ok) {
      console.error("Upload failed:", uploadJson);
      alert(`Upload failed: ${uploadJson.detail || uploadRes.status}`);
      return;
    }
    const uploadId = uploadJson.id as number;

    // 2) Save answer row (link question_id -> upload_id)
    const ansRes = await fetch(`${API}/interview/answer`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        question_id: Number(questionId),
        upload_id: uploadId,
      }),
    });
    if (!ansRes.ok) {
      const t = await ansRes.text();
      console.error("Save answer failed:", t);
      alert(`Save answer failed: ${t}`);
      return;
    }

    // 3) Transcribe (sync) — or use enqueue endpoint if you prefer background
    const tr = await fetch(`${API}/transcribe/upload/${uploadId}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    const trJson = await tr.json();
    if (!tr.ok) {
      console.warn("Transcribe failed", trJson);
      // not fatal — continue to scoring if transcript may still exist
    }

    // 4) Score (works even for empty transcript)
    const sc = await fetch(`${API}/score/upload/${uploadId}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!sc.ok) {
      const txt = await sc.text();
      console.warn("Scoring failed:", txt);
    }

    alert("✅ Saved answer, transcribed & scored. Returning to questions…");
    // 5) Go back to interview flow
    window.location.href = `/interview/${interviewId}`;
  } catch (err) {
    console.error(err);
    alert("Error uploading/saving. See console.");
  }
}

  return (
    <div style={{ padding: 20 }}>
      <h1>Interview Recording</h1>

      <video ref={videoRef} style={{ width: "500px", borderRadius: "8px" }} />

      <br />

      {!recording && (
        <button onClick={startRecording} style={btnStyle}>
          🎤 Start Recording
        </button>
      )}

      {recording && (
        <button onClick={stopRecording} style={btnStopStyle}>
          ⏹ Stop Recording
        </button>
      )}

      {recordedBlob && (
        <>
          <h3>Recorded Preview</h3>
          <video
            src={URL.createObjectURL(recordedBlob)}
            controls
            style={{ width: "500px", marginTop: 10 }}
          />

          <button onClick={uploadToBackend} style={btnUploadStyle}>
            ⬆ Upload to Backend
          </button>
        </>
      )}
    </div>
  );
}

const btnStyle = {
  padding: "10px 20px",
  background: "green",
  color: "white",
  border: "none",
  borderRadius: "5px",
};

const btnStopStyle = {
  padding: "10px 20px",
  background: "red",
  color: "white",
  border: "none",
  borderRadius: "5px",
};

const btnUploadStyle = {
  padding: "10px 20px",
  background: "blue",
  color: "white",
  border: "none",
  borderRadius: "5px",
  marginTop: "10px",
};
