"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";

const Monaco = dynamic(() => import("@monaco-editor/react"), { ssr: false });

type Lang = "javascript" | "python" | "java" | "cpp";
type SampleCase = { input: string; expected?: string };
type InterviewQuestion = {
  id: number;
  question_text: string;
  type: "voice" | "code";
  time_limit_seconds: number;
  description?: string | null;
  sample_cases?: SampleCase[] | null;
};

const SNIPPETS: Record<Lang, string> = {
  javascript: `// Read n and print Hanoi moves from A to C using B
function hanoi(n, a, c, b, out) {
  if (n === 0) return;
  hanoi(n-1, a, b, c, out);
  out.push(a + " -> " + c);
  hanoi(n-1, b, c, a, out);
}

const fs = require("fs");
const n = parseInt(fs.readFileSync(0, "utf8").trim(), 10);
const out = [];
hanoi(n, "A", "C", "B", out);
console.log(out.join("\\n"));
`,
  python: `# Read n and print Hanoi moves from A to C using B
import sys
sys.setrecursionlimit(1000000)

def hanoi(n, a, c, b, out):
    if n == 0: return
    hanoi(n-1, a, b, c, out)
    out.append(f"{a} -> {c}")
    hanoi(n-1, b, c, a, out)

data = sys.stdin.read().strip()
n = int(data or "0")
out = []
hanoi(n, "A", "C", "B", out)
print("\\n".join(out))
`,
  java: `import java.io.*;
import java.util.*;
public class Main {
  static void hanoi(int n, String a, String c, String b, List<String> out) {
    if (n == 0) return;
    hanoi(n-1, a, b, c, out);
    out.add(a + " -> " + c);
    hanoi(n-1, b, c, a, out);
  }
  public static void main(String[] args) throws Exception {
    BufferedReader br = new BufferedReader(new InputStreamReader(System.in));
    String s = br.readLine(); int n = Integer.parseInt(s.trim());
    List<String> out = new ArrayList<>();
    hanoi(n, "A", "C", "B", out);
    System.out.print(String.join("\\n", out));
  }
}
`,
  cpp: `#include <bits/stdc++.h>
using namespace std;
void hanoi(int n, string a, string c, string b, vector<string>& out){
  if(n==0) return;
  hanoi(n-1,a,b,c,out);
  out.push_back(a + " -> " + c);
  hanoi(n-1,b,c,a,out);
}
int main(){
  ios::sync_with_stdio(false); cin.tie(nullptr);
  int n; if(!(cin>>n)) return 0;
  vector<string> out; hanoi(n,"A","C","B",out);
  for(size_t i=0;i<out.size();++i){ if(i) cout << "\\n"; cout << out[i]; }
  return 0;
}
`,
};

type GradeResult = {
  ok: boolean;
  exit_code?: number;
  stdout?: string;
  stderr?: string;
  correctness?: number;
  total?: number;
  passed?: number;
  error?: string;
};

export default function CodePage() {
  const { id: interviewId } = useParams() as { id: string };
  const sp = useSearchParams();
  const questionId = sp.get("question");

  const API = process.env.NEXT_PUBLIC_API_URL!;
  const token = typeof window !== "undefined" ? localStorage.getItem("access_token") || "" : "";

  // state
  const [lang, setLang] = useState<Lang>("javascript");
  const [code, setCode] = useState(SNIPPETS.javascript);
  const [question, setQuestion] = useState<InterviewQuestion | null>(null);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);

  // sample cases (read-only) like LeetCode
  const [cases, setCases] = useState<SampleCase[]>([{ input: "3\n", expected: "" }]);
  const [active, setActive] = useState(0);

  const [runOut, setRunOut] = useState("");
  const [runVerdict, setRunVerdict] = useState<"pass" | "fail" | null>(null);
  const [running, setRunning] = useState(false);
  const [busy, setBusy] = useState(false);

  const flagsRef = useRef<string[]>([]);
  const [flags, setFlags] = useState<string[]>([]);
  function addFlag(f: string) {
    flagsRef.current = [...flagsRef.current, f];
    setFlags(flagsRef.current.slice(-6));
  }

  // anti-cheat
  useEffect(() => {
    const onVis = () => document.hidden && addFlag("tab-switch/blur");
    window.addEventListener("visibilitychange", onVis);
    window.addEventListener("blur", onVis);
    return () => {
      window.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("blur", onVis);
    };
  }, []);

  // load question (with description + sample cases)
  useEffect(() => {
    (async () => {
      if (!questionId) return;
      const r = await fetch(`${API}/interview/questions/${interviewId}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      const arr: InterviewQuestion[] = await r.json();
      const q = arr.find((x) => String(x.id) === String(questionId)) || null;
      setQuestion(q || null);
      setSecondsLeft(q?.time_limit_seconds ?? 300);
      const sc = (q?.sample_cases || []) as SampleCase[];
      if (sc.length) {
        setCases(sc.map(c => ({ input: c.input ?? "", expected: c.expected ?? "" })));
        setActive(0);
      }
    })();
  }, [API, interviewId, questionId, token]);

  // timer
  useEffect(() => {
    if (secondsLeft === null) return;
    if (secondsLeft <= 0) { saveGradeContinue(true); return; }
    const t = setTimeout(() => setSecondsLeft(s => (s === null ? s : s - 1)), 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secondsLeft]);

  const header = useMemo(() => {
    const chip = "px-2.5 py-1 rounded-full text-xs bg-gray-100 text-gray-700 border border-gray-200";
    return (
      <div className=" flex flex-wrap items-center gap-3">
        <a href={`/interview/${interviewId}`} className="underline text-gray-600">← Back to Questions</a>
        <span className={chip}>
          Language:
          <select
            value={lang}
            onChange={(e) => {
              const v = e.target.value as Lang;
              setLang(v);
              setCode(SNIPPETS[v]);
              setRunOut(""); setRunVerdict(null);
            }}
            className="ml-2 bg-transparent outline-none"
          >
            <option value="javascript">JavaScript</option>
            <option value="python">Python</option>
            <option value="java">Java</option>
            <option value="cpp">C++</option>
          </select>
        </span>
        <span className={chip}>
          ⏳ Time left:
          <b className="ml-1">
            {secondsLeft !== null ? `${Math.floor(secondsLeft/60)}:${String(secondsLeft%60).padStart(2,"0")}` : "--:--"}
          </b>
        </span>
        <div className="ml-auto flex gap-2">
          <button
            onClick={runOnce}
            disabled={running}
            className="px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50"
          >
            {running ? "Running…" : "Run"}
          </button>
          <button
            onClick={() => saveGradeContinue(false)}
            disabled={busy}
            className="px-4 py-1.5 rounded-lg text-white bg-indigo-600 hover:bg-indigo-700"
          >
            {busy ? "Saving…" : "Save, Grade & Continue →"}
          </button>
        </div>
      </div>
    );
  }, [busy, interviewId, lang, running, secondsLeft]);

  async function runOnce() {
    if (!token) return alert("Not logged in");
    setRunning(true);
    setRunVerdict(null);
    setRunOut("");
    try {
      const stdin = cases[active]?.input ?? "";
      const r = await fetch(`${API}/code/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ lang, code, stdin }),
      });
      const j = await r.json();
      if (!r.ok || !j.ok) throw new Error(j?.error || j?.stderr || `Run failed (${r.status})`);
      const out = (j.stdout || "").trim();
      setRunOut(out || "(no output)");

      const exp = (cases[active]?.expected ?? "").trim();
      if (exp) {
        setRunVerdict(out === exp ? "pass" : "fail");
      }
    } catch (e: any) {
      setRunOut("ERROR: " + (e?.message || String(e)));
      setRunVerdict("fail");
    } finally {
      setRunning(false);
    }
  }

  async function saveGradeContinue(auto = false) {
    if (!questionId) return alert("Missing question id");
    if (!token) return alert("Not logged in");

    try {
      setBusy(true);
      const g = await fetch(`${API}/code/grade`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ lang, code, question_id: Number(questionId) }),
      });
      const grade: GradeResult = await g.json();
      if (!g.ok || !grade.ok) throw new Error(grade?.error || `Grade failed (${g.status})`);

      const s = await fetch(`${API}/interview/answer`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({
          question_id: Number(questionId),
          code_answer: code,
          code_output: (grade.stdout || "").slice(0, 2000),
          test_results: {
            ok: grade.ok, exit_code: grade.exit_code, stdout: grade.stdout, stderr: grade.stderr,
            correctness: grade.correctness, total: grade.total, passed: grade.passed,
          },
        }),
      });
      if (!s.ok) throw new Error(await s.text());

      if (flagsRef.current.length) {
        await fetch(`${API}/interview/flags`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
          body: JSON.stringify({ question_id: Number(questionId), flags: Array.from(new Set(flagsRef.current)) }),
        }).catch(() => {});
      }

      if (!auto) alert("✅ Saved & graded. Returning to questions…");
      window.location.href = `/interview/${interviewId}`;
    } catch (e: any) {
      alert(e?.message || "Save failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="full-bleed max-w-[1200px] mx-auto p-6">
      {header}

      {flags.length > 0 && (
        <div className="mt-3 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          Anti-cheat: {flags.join(" · ")}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
        {/* LEFT: Problem panel (read-only) */}
        <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
          <div className="px-4 py-3 border-b text-sm font-semibold">Question</div>
          <div className="px-4 py-3 text-sm text-gray-800">
            <div className="font-medium mb-2">{question?.question_text}</div>
            {question?.description && (
              <div className="text-gray-700 whitespace-pre-wrap">{question.description}</div>
            )}

            {/* Sample cases (read-only) */}
            {!!cases.length && (
              <>
                <div className="mt-4 font-semibold">Examples</div>
                <div className="mt-2 space-y-3">
                  {cases.map((c, i) => (
                    <div key={i} className="border rounded-lg p-3 bg-gray-50">
                      <div className="text-xs uppercase tracking-wide text-gray-500">Input</div>
                      <pre className="text-sm whitespace-pre-wrap">{c.input || "(empty)"}</pre>
                      {typeof c.expected === "string" && c.expected.length > 0 && (
                        <>
                          <div className="text-xs uppercase tracking-wide text-gray-500 mt-2">Expected</div>
                          <pre className="text-sm whitespace-pre-wrap">{c.expected}</pre>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* RIGHT: Editor + Run + Verdict */}
        <div className="flex flex-col gap-4">
          <div className="rounded-2xl border border-gray-200 overflow-hidden bg-white">
            {/* Tabs for sample selection */}
            <div className="px-4 py-2 border-b flex gap-2">
              {cases.map((_, i) => (
                <button
                  key={i}
                  onClick={() => { setActive(i); setRunOut(""); setRunVerdict(null); }}
                  className={`text-xs px-2 py-1 rounded border ${
                    i === active ? "bg-indigo-600 text-white border-indigo-600" : "border-gray-200"
                  }`}
                >
                  Case {i + 1}
                </button>
              ))}
            </div>

            <Monaco
              height="54vh"
              language={lang}
              value={code}
              options={{ minimap: { enabled: false }, fontSize: 14, wordWrap: "on", automaticLayout: true }}
              onChange={(v) => { setCode(v ?? ""); }}
            />
          </div>

          {/* Run output + verdict */}
          <div className="rounded-2xl border border-gray-200 bg-gray-50 p-3 font-mono text-sm whitespace-pre-wrap min-h-[140px]">
            <div className="flex items-center justify-between mb-1">
              <div className="font-semibold">Run Output</div>
              {runVerdict && (
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  runVerdict === "pass" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                }`}>
                  {runVerdict === "pass" ? "Pass" : "Fail"}
                </span>
              )}
            </div>
            {runOut || "—"}
          </div>
        </div>
      </div>
    </div>
  );
}
