import { useEffect, useRef, useState } from "react";

interface BrowserASROptions {
  enabled: boolean;
  lang?: string;
}

export function useBrowserASR({
  enabled,
  lang = "en-US",
}: BrowserASROptions) {
  const [transcript, setTranscript] = useState("");
  const [listening, setListening] = useState(false);

  const recognitionRef = useRef<any>(null);
  const finalTranscriptRef = useRef(""); // ✅ committed stable text

  useEffect(() => {
    if (!enabled) {
      stop();
      return;
    }

    start();
    return stop;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  function start() {
    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      console.warn("Browser ASR not supported");
      return;
    }

    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;

    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = lang;

    recognition.onstart = () => setListening(true);

    recognition.onresult = (event: any) => {
      let interim = "";
      let finalChunk = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const res = event.results[i];
        if (res.isFinal) {
          finalChunk += res[0].transcript;
        } else {
          interim += res[0].transcript;
        }
      }

      // ✅ Commit final chunks only once
      if (finalChunk) {
        finalTranscriptRef.current =
          (finalTranscriptRef.current + " " + finalChunk).trim();
      }

      // ✅ Show stable + live delta
      setTranscript(
        (finalTranscriptRef.current + " " + interim).trim()
      );
    };

    recognition.onerror = () => {
      setListening(false);
    };

    recognition.onend = () => {
      // 🔁 auto-restart while enabled
      if (enabled) {
        try {
          recognition.start();
        } catch {}
      }
    };

    recognition.start();
  }

  function stop() {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setListening(false);
  }

  function resetTranscript() {
    finalTranscriptRef.current = "";
    setTranscript("");
  }

  return {
    transcript,
    listening,
    resetTranscript,
  };
}
