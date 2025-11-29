"use client";

import React, { useRef, useState } from "react";
import Editor, { OnMount } from "@monaco-editor/react";

type Props = {
  value: string | null | undefined;
  questionId?: number | string;
  lang?: string; // e.g. "python", "javascript"
  height?: number | string; // px or CSS size
  filename?: string | null; // optional filename for download
};

export default function CodeViewer({ value, questionId, lang = "text", height = 240, filename }: Props) {
  const editorRef = useRef<any>(null);
  const [copied, setCopied] = useState(false);

  const onMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    editor.updateOptions({
      readOnly: true,
      minimap: { enabled: false },
      glyphMargin: false,
      folding: false,
      lineNumbers: "on",
      overviewRulerLanes: 0,
      renderLineHighlight: "none",
      scrollbar: { alwaysConsumeMouseWheel: false }
    } as any); // cast to any to be safe with different monaco versions
  };

  const doCopy = async () => {
    try {
      await navigator.clipboard.writeText(value || "");
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (e) {
      // fallback
      const el = document.createElement("textarea");
      el.value = value || "";
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      el.remove();
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  const doDownload = () => {
    const blob = new Blob([value || ""], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const ext = getExtForLang(lang);
    const fname = filename || `answer-Q${questionId ?? "unknown"}.${ext}`;
    a.href = url;
    a.download = fname;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const getExtForLang = (l: string) => {
    const m = String(l || "").toLowerCase();
    if (m.includes("python")) return "py";
    if (m.includes("js") || m.includes("javascript")) return "js";
    if (m.includes("ts") || m === "typescript") return "ts";
    if (m.includes("java")) return "java";
    if (m.includes("csharp") || m === "c#") return "cs";
    if (m.includes("cpp") || m.includes("c++")) return "cpp";
    if (m.includes("go")) return "go";
    if (m.includes("ruby")) return "rb";
    return "txt";
  };

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-2 gap-2">
        <div className="text-sm text-muted-foreground">
          {questionId ? <>Code answer — Q{questionId}</> : <>Code answer</>}
        </div>

        <div className="flex gap-2 items-center">
          <button
            aria-label="Copy code"
            onClick={doCopy}
            className="px-3 py-1 text-sm border rounded"
            title="Copy code to clipboard"
          >
            {copied ? "Copied" : "Copy"}
          </button>

          <button
            aria-label="Download code"
            onClick={doDownload}
            className="px-3 py-1 text-sm border rounded bg-blue-600 text-white"
            title="Download code file"
          >
            Download
          </button>
        </div>
      </div>

      <div style={{ height: typeof height === "number" ? `${height}px` : height }} className="rounded border overflow-hidden">
        <Editor
          height="100%"
          defaultLanguage={lang || "text"}
          value={value ?? ""}
          onMount={onMount}
          theme="vs-light"
          options={{
            readOnly: true,
            lineNumbersMinChars: 3,
            fontSize: 13,
            wordWrap: "on",
            minimap: { enabled: false },
            folding: false,
            overviewRulerLanes: 0,
            scrollbar: {
              vertical: "auto",
              horizontal: "auto"
            },
            scrollBeyondLastLine: false,
            contextmenu: true
          }}
        />
      </div>
    </div>
  );
}
