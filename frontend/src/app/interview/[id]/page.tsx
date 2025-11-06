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
    const stream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true,
    });

    if (videoRef.current) {
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
    }

    const chunks: BlobPart[] = [];
    const recorder = new MediaRecorder(stream, { mimeType: "video/webm" });

    recorder.ondataavailable = (e) => chunks.push(e.data);
    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: "video/webm" });
      setRecordedBlob(blob);
      stream.getTracks().forEach((t) => t.stop());
    };

    recorder.start();
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

    const API = process.env.NEXT_PUBLIC_API_URL;
    const token = localStorage.getItem("access_token");

    if (!API) {
      alert("❌ NEXT_PUBLIC_API_URL not set");
      return;
    }
    if (!token) {
      alert("❌ Not logged in. Token missing.");
      return;
    }

    try {
      const file = new File(
        [recordedBlob],
        `interview-${Date.now()}.webm`,
        { type: "video/webm" }
      );

      const formData = new FormData();
      formData.append("file", file);
      formData.append("folder", `interview/${interviewId}`);

      const uploadRes = await fetch(`${API}/upload/proxy`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          // ❗ DO NOT SET "Content-Type" manually when using FormData
        },
        body: formData,
      });

      const json = await uploadRes.json();
      if (!uploadRes.ok) {
        console.error("Upload failed:", json);
        alert(`❌ Upload failed: ${json.detail}`);
        return;
      }

      console.log("✅ Proxy upload success:", json);
      alert(`✅ Uploaded!\nUpload ID: ${json.id}\nKey: ${json.key}`);
    } catch (err) {
      console.error("Upload error:", err);
      alert("❌ Error uploading. Check console.");
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
