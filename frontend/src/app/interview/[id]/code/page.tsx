// frontend/src/app/interview/[id]/code/page.tsx
"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), { ssr: false });

type Lang = "python" | "javascript";
type InterviewQuestion = {
  id: number;
  question_text: string;
  type: "voice" | "code";
  time_limit_seconds: number;
};

type GradeResult = {
  ok: boolean;
  exit_code: number;
  stdout: string;
  stderr: string;
  correctness: number;
  total: number;
  passed: number;
};

const DEFAULT_SNIPPETS: Record<Lang, string> = {
  javascript: `// Tower of Hanoi in JavaScript
function hanoi(n, source, target, auxiliary, moves = []) {
  if (n === 0) return moves;
  hanoi(n - 1, source, auxiliary, target, moves);
  moves.push(\`\${source} -> \${target}\`);
  hanoi(n - 1, auxiliary, target, source, moves);
  return moves;
}

// Example:
console.log(hanoi(3, "A", "C", "B").join("\\n"));
`,
  python: `# Tower of Hanoi in Python
def hanoi(n, source, target, auxiliary, moves=None):
    if moves is None: moves = []
    if n == 0: return moves
    hanoi(n-1, source, auxiliary, target, moves)
    moves.append(f"{source} -> {target}")
    hanoi(n-1, auxiliary, target, source, moves)
    return moves

# Example:
print("\\n".join(hanoi(3, "A", "C", "B")))
`,
};

export default function CodingPage() {
  const { id: interviewId } = useParams() as { id: string };
  const qs = useSearchParams();
  const questionId = qs.get("question");

  const API = process.env.NEXT_PUBLIC_API_URL!;
  const token = typeof window !== "undefined" ? localStorage.getItem("access_token") || "" : "";

  const [lang, setLang] = useState<Lang>("javascript");
  const [code, setCode] = useState<string>(DEFAULT_SNIPPETS.javascript);
  const [busy, setBusy] = useState(false);
  const [flags, setFlags] = useState<string[]>([]);
  const flagsRef = useRef<string[]>([]);

  const [question, setQuestion] = useState<InterviewQuestion | null>(null);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);

  const [runOutput, setRunOutput] = useState<string>(""); // console output (local JS)
  const [running, setRunning] = useState(false);

  // -------- Helpers --------
  function addFlag(flag: string) {
    flagsRef.current = [...flagsRef.current, flag];
    setFlags(flagsRef.current.slice(-5));
  }

  // Tab switch / blur detection
  useEffect(() => {
    function onVis() {
      if (document.hidden) addFlag("tab-switch/blur");
    }
    window.addEventListener("visibilitychange", onVis);
    window.addEventListener("blur", onVis);
    return () => {
      window.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("blur", onVis);
    };
  }, []);

  // Load question to get time_limit_seconds
  useEffect(() => {
    (async () => {
      if (!questionId) return;
      try {
        const res = await fetch(`${API}/interview/questions/${interviewId}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const all: InterviewQuestion[] = await res.json();
        const q = all.find((x) => String(x.id) === String(questionId)) || null;
        setQuestion(q || null);
        setSecondsLeft(q?.time_limit_seconds ?? 300); // fallback 5 mins
      } catch (e) {
        console.error("Failed to load question:", e);
        setQuestion(null);
        setSecondsLeft(300);
      }
    })();
  }, [API, interviewId, questionId, token]);

  // Countdown timer
  useEffect(() => {
    if (secondsLeft === null) return;
    if (secondsLeft <= 0) {
      // Auto-grade + save when time is up
      if (!busy) saveAndContinue(true);
      return;
    }
    const t = setTimeout(() => setSecondsLeft((s) => (s === null ? s : s - 1)), 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secondsLeft, busy]);

  // Starter snippet on lang switch (only before user edits)
  const hasUserEdited = useRef(false);
  useEffect(() => {
    if (!hasUserEdited.current) setCode(DEFAULT_SNIPPETS[lang]);
  }, [lang]);

  // -------- Grade -> Save answer -> Persist flags -> Return --------
  async function saveAndContinue(auto = false) {
    if (!questionId) {
      alert("Missing question id in URL.");
      return;
    }
    if (!token) {
      alert("Not logged in.");
      return;
    }
    setBusy(true);
    try {
      // 1) Grade on server (Docker runner with hidden tests)
      const gradeRes = await fetch(`${API}/code/grade`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ lang, code, question_id: Number(questionId) }),
      });
      const grade: GradeResult = await gradeRes.json();
      if (!gradeRes.ok) {
        throw new Error(`Grading failed: HTTP ${gradeRes.status} ${JSON.stringify(grade)}`);
      }

      // 2) Save answer with code + output + test_results
      const ansRes = await fetch(`${API}/interview/answer`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          question_id: Number(questionId),
          code_answer: code,
          code_output: grade.stdout || "",
          test_results: grade, // JSONB on backend
        }),
      });
      if (!ansRes.ok) {
        const t = await ansRes.text();
        throw new Error(`Save answer failed: ${t}`);
      }

      // 3) Persist anti-cheat flags (if any)
      if (flagsRef.current.length) {
        await fetch(`${API}/interview/flags`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ question_id: Number(questionId), flags: flagsRef.current }),
        });
      }

      if (!auto) {
        alert(`✅ Saved & graded (Correctness ${grade.correctness}%). Returning to questions…`);
      }
      window.location.href = `/interview/${interviewId}`;
    } catch (e: any) {
      console.error(e);
      alert(e?.message || "Save/grade failed");
    } finally {
      setBusy(false);
    }
  }

  // -------- Local JS Runner (sandboxed iframe) --------
  function runJavaScript(codeToRun: string) {
    setRunning(true);
    setRunOutput("");
    const iframe = document.createElement("iframe");
    iframe.style.display = "none";
    iframe.setAttribute("sandbox", "allow-scripts");
    document.body.appendChild(iframe);

    function cleanup() {
      window.removeEventListener("message", onMsg);
      if (iframe && iframe.parentNode) iframe.parentNode.removeChild(iframe);
      setRunning(false);
    }

    const logs: string[] = [];
    const onMsg = (ev: MessageEvent) => {
      if (!ev || !ev.data) return;
      if (ev.data.__runner_done) {
        setRunOutput(logs.join("\n"));
        cleanup();
      } else if (ev.data.__runner_log) {
        logs.push(String(ev.data.__runner_log));
      } else if (ev.data.__runner_err) {
        logs.push("ERROR: " + String(ev.data.__runner_err));
      }
    };

    window.addEventListener("message", onMsg);

    const src = `
<!DOCTYPE html><html><body>
<script>
  (function(){
    function send(type, payload){
      parent.postMessage(type === "log" ? {__runner_log: payload} :
                         type === "err" ? {__runner_err: payload} :
                         {__runner_done: true}, "*");
    }
    var consoleLog = console.log;
    console.log = function(){
      try {
        var msg = Array.from(arguments).map(x => {
          try { return typeof x === 'string' ? x : JSON.stringify(x); }
          catch (e) { return String(x); }
        }).join(" ");
        send("log", msg);
      } catch(e) {}
      return consoleLog.apply(console, arguments);
    };
    try {
      ${codeToRun}
    } catch(e) {
      send("err", (e && e.message) ? e.message : String(e));
    }
    send("done");
  })();
</script>
</body></html>`;
    const blob = new Blob([src], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    iframe.src = url;
  }

  async function onRun() {
    if (lang === "javascript") {
      runJavaScript(code);
    } else {
      alert("Python run is disabled in browser.\n(Server runner handles it during grading.)");
    }
  }

  // -------- UI --------
  const header = useMemo(
    () => (
      <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 12 }}>
        <a href={`/interview/${interviewId}`} style={{ textDecoration: "underline" }}>
          ← Back to Questions
        </a>
        <span style={{ opacity: 0.5 }}>•</span>
        <label>
          Language:{" "}
          <select
            value={lang}
            onChange={(e) => setLang(e.target.value as Lang)}
            style={{ padding: "4px 8px" }}
          >
            <option value="javascript">JavaScript</option>
            <option value="python">Python</option>
          </select>
        </label>

        {/* Timer */}
        <span style={{ marginLeft: 8, padding: "4px 8px", background: "#f3f4f6", borderRadius: 6 }}>
          ⏳ Time left:{" "}
          <b>
            {secondsLeft !== null
              ? `${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, "0")}`
              : "--:--"}
          </b>
        </span>

        {/* Actions */}
        <button
          onClick={onRun}
          disabled={running || lang !== "javascript"}
          title={lang !== "javascript" ? "Python runner not available in browser" : ""}
          style={{
            marginLeft: "auto",
            padding: "8px 14px",
            borderRadius: 6,
            border: "1px solid #ddd",
            background: running ? "#f3f4f6" : "white",
          }}
        >
          {running ? "Running…" : `Run (${lang === "javascript" ? "JS" : "N/A"})`}
        </button>

        <button
          onClick={() => saveAndContinue(false)}
          disabled={busy}
          style={{
            padding: "8px 14px",
            borderRadius: 6,
            border: "1px solid #ddd",
            background: busy ? "#f3f4f6" : "white",
          }}
        >
          {busy ? "Saving…" : "Save, Grade & Continue →"}
        </button>
      </div>
    ),
    [busy, interviewId, lang, running, secondsLeft]
  );

  return (
    <div style={{ padding: 16 }}>
      {header}

      {/* Anti-cheat mini banner */}
      {flags.length > 0 && (
        <div
          style={{
            background: "#fff7ed",
            border: "1px solid #fed7aa",
            padding: 8,
            borderRadius: 6,
            fontSize: 12,
            marginBottom: 8,
          }}
        >
          Anti-cheat: {flags.join(" · ")}
        </div>
      )}

      {/* Question text */}
      {question && (
        <div style={{ marginBottom: 10, fontSize: 14, color: "#374151" }}>
          <b>Question:</b> {question.question_text}
        </div>
      )}

      {/* Editor */}
      <div style={{ border: "1px solid #e5e7eb", borderRadius: 8, overflow: "hidden" }}>
        <MonacoEditor
          height="60vh"
          language={lang}
          value={code}
          options={{ minimap: { enabled: false }, fontSize: 14, wordWrap: "on", automaticLayout: true }}
          onChange={(v) => {
            hasUserEdited.current = true;
            setCode(v ?? "");
          }}
          onMount={(editor) => {
            // Flag paste attempts (best-effort block)
            editor.onDidPaste(() => {
              addFlag("paste-detected");
              const model = editor.getModel();
              const sel = editor.getSelection();
              if (model && sel) model.applyEdits([{ range: sel, text: "" }]);
            });
            // Flag very large inserts (suspicious paste)
            editor.onDidChangeModelContent((e) => {
              const bigInsert = (e.changes || []).some((c) => (c?.text?.length || 0) > 500);
              if (bigInsert) addFlag("suspicious-large-insert");
            });
          }}
        />
      </div>

      {/* Output pane (local JS run) */}
      <div
        style={{
          marginTop: 10,
          border: "1px solid #e5e7eb",
          borderRadius: 8,
          padding: 8,
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
          whiteSpace: "pre-wrap",
          background: "#fafafa",
        }}
      >
        <div style={{ fontWeight: 600, marginBottom: 6 }}>Run Output</div>
        <div style={{ fontSize: 13, color: "#111827" }}>{runOutput || "—"}</div>
      </div>
    </div>
  );
}
