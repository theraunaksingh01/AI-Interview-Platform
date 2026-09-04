// frontend/src/app/components/SQLPractice.tsx
// Redesigned SQL Practice — question-first, editor-second
// No schema selector clutter. Students see a question, write SQL, see results.

"use client";

import { useEffect, useRef, useState } from "react";

// ── Questions with embedded schema ───────────────────────────────────────────

const QUESTIONS = [
  {
    id: 1,
    difficulty: "Easy",
    topic: "SELECT + WHERE",
    question: "Find all students from the CSE branch with a CGPA above 8.0. Show their name and CGPA, sorted by CGPA descending.",
    hint: "Use WHERE with two conditions joined by AND. ORDER BY with DESC.",
    answer: "SELECT name, cgpa\nFROM students\nWHERE branch = 'CSE' AND cgpa > 8.0\nORDER BY cgpa DESC;",
    explanation: "Two conditions on the same row — AND combines them. DESC gives highest first.",
    schema: `
CREATE TABLE students (id INTEGER PRIMARY KEY, name TEXT, branch TEXT, cgpa REAL, year INTEGER);
INSERT INTO students VALUES
(1,'Rahul Kumar','CSE',8.5,3),(2,'Priya Singh','ECE',7.8,3),
(3,'Amit Sharma','IT',9.1,4),(4,'Sneha Patel','CSE',6.5,2),
(5,'Rohit Verma','MECH',7.2,4),(6,'Anita Joshi','CSE',8.9,3),
(7,'Karan Mehta','CSE',8.2,2),(8,'Divya Nair','CSE',7.5,3);`,
  },
  {
    id: 2,
    difficulty: "Easy",
    topic: "GROUP BY + COUNT",
    question: "How many students are there in each branch? Show the branch name and student count, ordered by count descending.",
    hint: "GROUP BY branch, use COUNT(*) to count rows per group.",
    answer: "SELECT branch, COUNT(*) AS student_count\nFROM students\nGROUP BY branch\nORDER BY student_count DESC;",
    explanation: "GROUP BY collapses rows with the same branch value. COUNT(*) counts rows in each group.",
    schema: `
CREATE TABLE students (id INTEGER PRIMARY KEY, name TEXT, branch TEXT, cgpa REAL, year INTEGER);
INSERT INTO students VALUES
(1,'Rahul Kumar','CSE',8.5,3),(2,'Priya Singh','ECE',7.8,3),
(3,'Amit Sharma','IT',9.1,4),(4,'Sneha Patel','CSE',6.5,2),
(5,'Rohit Verma','MECH',7.2,4),(6,'Anita Joshi','CSE',8.9,3),
(7,'Karan Mehta','CSE',8.2,2),(8,'Divya Nair','ECE',7.5,3);`,
  },
  {
    id: 3,
    difficulty: "Easy",
    topic: "INNER JOIN",
    question: "List each employee's name along with their department name. Only show employees who belong to a department.",
    hint: "INNER JOIN employees with departments on the foreign key.",
    answer: "SELECT e.name AS employee, d.name AS department\nFROM employees e\nINNER JOIN departments d ON e.dept_id = d.id\nORDER BY d.name, e.name;",
    explanation: "INNER JOIN returns only rows where the join condition matches in both tables. Employees without a department are excluded.",
    schema: `
CREATE TABLE departments (id INTEGER PRIMARY KEY, name TEXT, location TEXT);
CREATE TABLE employees (id INTEGER PRIMARY KEY, name TEXT, dept_id INTEGER, salary REAL, manager_id INTEGER);
INSERT INTO departments VALUES (1,'Engineering','Bangalore'),(2,'Marketing','Mumbai'),(3,'HR','Delhi'),(4,'Finance','Pune');
INSERT INTO employees VALUES
(1,'Sunita Rao',1,95000,NULL),(2,'Kiran Mehta',1,72000,1),(3,'Deepak Nair',1,68000,1),
(4,'Pooja Shah',2,55000,NULL),(5,'Amit Das',2,48000,4),(6,'Rekha Iyer',3,60000,NULL),
(7,'Vijay Kumar',1,82000,1),(8,'Meena Pillai',4,90000,NULL);`,
  },
  {
    id: 4,
    difficulty: "Easy",
    topic: "LEFT JOIN",
    question: "List all departments and the number of employees in each. Include departments with zero employees.",
    hint: "LEFT JOIN keeps all rows from the left table (departments) even when there's no match.",
    answer: "SELECT d.name AS department, COUNT(e.id) AS employee_count\nFROM departments d\nLEFT JOIN employees e ON d.id = e.dept_id\nGROUP BY d.id\nORDER BY employee_count DESC;",
    explanation: "LEFT JOIN includes all departments. COUNT(e.id) counts non-NULL employee IDs — returns 0 for departments with no employees.",
    schema: `
CREATE TABLE departments (id INTEGER PRIMARY KEY, name TEXT, location TEXT);
CREATE TABLE employees (id INTEGER PRIMARY KEY, name TEXT, dept_id INTEGER, salary REAL);
INSERT INTO departments VALUES (1,'Engineering','Bangalore'),(2,'Marketing','Mumbai'),(3,'HR','Delhi'),(4,'Finance','Pune'),(5,'Legal','Chennai');
INSERT INTO employees VALUES
(1,'Sunita Rao',1,95000),(2,'Kiran Mehta',1,72000),(3,'Deepak Nair',1,68000),
(4,'Pooja Shah',2,55000),(5,'Amit Das',2,48000),(6,'Rekha Iyer',3,60000);`,
  },
  {
    id: 5,
    difficulty: "Medium",
    topic: "Subquery",
    question: "Find all employees who earn more than the average salary across the entire company.",
    hint: "Use a subquery in WHERE: WHERE salary > (SELECT AVG(salary) FROM employees)",
    answer: "SELECT name, salary\nFROM employees\nWHERE salary > (SELECT AVG(salary) FROM employees)\nORDER BY salary DESC;",
    explanation: "The subquery runs first and returns a single value (the average). The outer query then compares each row's salary to that value.",
    schema: `
CREATE TABLE employees (id INTEGER PRIMARY KEY, name TEXT, dept_id INTEGER, salary REAL);
INSERT INTO employees VALUES
(1,'Sunita Rao',1,95000),(2,'Kiran Mehta',1,72000),(3,'Deepak Nair',1,68000),
(4,'Pooja Shah',2,55000),(5,'Amit Das',2,48000),(6,'Rekha Iyer',3,60000),
(7,'Vijay Kumar',1,82000),(8,'Meena Pillai',4,90000);`,
  },
  {
    id: 6,
    difficulty: "Medium",
    topic: "Self JOIN",
    question: "Find all employees who earn more than their direct manager.",
    hint: "JOIN the employees table to itself: employees e JOIN employees m ON e.manager_id = m.id",
    answer: "SELECT e.name AS employee, e.salary AS emp_salary,\n       m.name AS manager, m.salary AS mgr_salary\nFROM employees e\nJOIN employees m ON e.manager_id = m.id\nWHERE e.salary > m.salary;",
    explanation: "A self-join treats the same table as two separate tables — one for employees (e), one for managers (m). The WHERE filters to only cases where the employee earns more.",
    schema: `
CREATE TABLE employees (id INTEGER PRIMARY KEY, name TEXT, salary REAL, manager_id INTEGER);
INSERT INTO employees VALUES
(1,'Sunita Rao',95000,NULL),(2,'Kiran Mehta',72000,1),(3,'Deepak Nair',98000,1),
(4,'Pooja Shah',55000,NULL),(5,'Amit Das',60000,4),(6,'Rekha Iyer',60000,NULL),
(7,'Vijay Kumar',82000,1),(8,'Meena Pillai',50000,6);`,
  },
  {
    id: 7,
    difficulty: "Medium",
    topic: "HAVING",
    question: "Find departments where the average salary is above 65,000. Show the department ID and average salary.",
    hint: "HAVING filters groups after GROUP BY — you cannot use WHERE on aggregate functions.",
    answer: "SELECT dept_id, ROUND(AVG(salary), 2) AS avg_salary\nFROM employees\nGROUP BY dept_id\nHAVING AVG(salary) > 65000\nORDER BY avg_salary DESC;",
    explanation: "WHERE filters individual rows before grouping. HAVING filters groups after aggregation. AVG(salary) in HAVING refers to the average per group.",
    schema: `
CREATE TABLE employees (id INTEGER PRIMARY KEY, name TEXT, dept_id INTEGER, salary REAL);
INSERT INTO employees VALUES
(1,'Sunita Rao',1,95000),(2,'Kiran Mehta',1,72000),(3,'Deepak Nair',1,68000),
(4,'Pooja Shah',2,55000),(5,'Amit Das',2,48000),(6,'Rekha Iyer',3,60000),
(7,'Vijay Kumar',1,82000),(8,'Meena Pillai',4,90000),(9,'Ravi Sharma',3,58000);`,
  },
  {
    id: 8,
    difficulty: "Medium",
    topic: "NOT EXISTS",
    question: "Find all students who are not enrolled in any course.",
    hint: "Use NOT EXISTS with a correlated subquery, or LEFT JOIN with IS NULL check.",
    answer: "SELECT s.name\nFROM students s\nWHERE NOT EXISTS (\n  SELECT 1 FROM enrollments e\n  WHERE e.student_id = s.id\n);",
    explanation: "NOT EXISTS returns true when the subquery returns no rows. The subquery is correlated — it references the outer query's s.id for each student row.",
    schema: `
CREATE TABLE students (id INTEGER PRIMARY KEY, name TEXT, branch TEXT);
CREATE TABLE enrollments (student_id INTEGER, course_id INTEGER, PRIMARY KEY(student_id, course_id));
INSERT INTO students VALUES (1,'Rahul','CSE'),(2,'Priya','ECE'),(3,'Amit','IT'),(4,'Sneha','CSE'),(5,'Rohit','MECH');
INSERT INTO enrollments VALUES (1,101),(1,102),(2,101),(3,103);`,
  },
  {
    id: 9,
    difficulty: "Hard",
    topic: "Correlated Subquery",
    question: "For each department, find the employee with the highest salary. Show department name, employee name, and salary.",
    hint: "Correlated subquery: WHERE e.salary = (SELECT MAX(salary) FROM employees WHERE dept_id = e.dept_id)",
    answer: "SELECT d.name AS department, e.name AS top_earner, e.salary\nFROM employees e\nJOIN departments d ON e.dept_id = d.id\nWHERE e.salary = (\n  SELECT MAX(salary)\n  FROM employees e2\n  WHERE e2.dept_id = e.dept_id\n)\nORDER BY e.salary DESC;",
    explanation: "The correlated subquery runs once per row in the outer query, finding the max salary for that specific department. If two employees tie for max, both are returned.",
    schema: `
CREATE TABLE departments (id INTEGER PRIMARY KEY, name TEXT);
CREATE TABLE employees (id INTEGER PRIMARY KEY, name TEXT, dept_id INTEGER, salary REAL);
INSERT INTO departments VALUES (1,'Engineering'),(2,'Marketing'),(3,'HR'),(4,'Finance');
INSERT INTO employees VALUES
(1,'Sunita Rao',1,95000),(2,'Kiran Mehta',1,72000),(3,'Deepak Nair',1,68000),
(4,'Pooja Shah',2,55000),(5,'Amit Das',2,62000),(6,'Rekha Iyer',3,60000),
(7,'Vijay Kumar',1,82000),(8,'Meena Pillai',4,90000),(9,'Ravi Sharma',3,58000);`,
  },
  {
    id: 10,
    difficulty: "Hard",
    topic: "Multiple JOINs",
    question: "List each student's name, the courses they're enrolled in, and their grade. Only show students who have at least one grade of 'A'.",
    hint: "JOIN three tables, then filter using a subquery or HAVING to keep only students with at least one A.",
    answer: "SELECT s.name, c.name AS course, e.grade\nFROM students s\nJOIN enrollments e ON s.id = e.student_id\nJOIN courses c ON e.course_id = c.id\nWHERE s.id IN (\n  SELECT student_id FROM enrollments WHERE grade = 'A'\n)\nORDER BY s.name, c.name;",
    explanation: "The subquery finds all student_ids who have at least one A. The main query then shows all enrollments for those students — not just the A grades.",
    schema: `
CREATE TABLE students (id INTEGER PRIMARY KEY, name TEXT, branch TEXT);
CREATE TABLE courses (id INTEGER PRIMARY KEY, name TEXT);
CREATE TABLE enrollments (student_id INTEGER, course_id INTEGER, grade TEXT, PRIMARY KEY(student_id, course_id));
INSERT INTO students VALUES (1,'Rahul','CSE'),(2,'Priya','ECE'),(3,'Amit','IT'),(4,'Sneha','CSE');
INSERT INTO courses VALUES (101,'DBMS'),(102,'OS'),(103,'Networks'),(104,'OOP');
INSERT INTO enrollments VALUES
(1,101,'A'),(1,102,'B'),(1,103,'A'),(2,101,'B'),(2,104,'C'),
(3,101,'A'),(3,102,'A'),(4,102,'C'),(4,103,'B');`,
  },
];

const DIFF_STYLE: Record<string, { bg: string; color: string }> = {
  Easy: { bg: "#DCFCE7", color: "#166534" },
  Medium: { bg: "#FEF3C7", color: "#92400E" },
  Hard: { bg: "#FEE2E2", color: "#991B1B" },
};

type ResultRow = Record<string, string | number | null>;

// ── Component ─────────────────────────────────────────────────────────────────

export default function SQLPractice() {
  const [db, setDb] = useState<any>(null);
  const [loadError, setLoadError] = useState("");
  const [activeQ, setActiveQ] = useState(0);
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<{ columns: string[]; rows: ResultRow[] } | null>(null);
  const [error, setError] = useState("");
  const [running, setRunning] = useState(false);
  const [execTime, setExecTime] = useState<number | null>(null);
  const [showHint, setShowHint] = useState(false);
  const [showAnswer, setShowAnswer] = useState(false);
  const [showExp, setShowExp] = useState(false);
  const [solved, setSolved] = useState<Set<number>>(new Set());
  const dbRef = useRef<any>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // ── Load sql.js ─────────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    async function init() {
      try {
        const initSqlJs = (await import("sql.js")).default;
        const SQL = await initSqlJs({ locateFile: () => "/sql-wasm.wasm" });
        if (cancelled) return;
        const database = new SQL.Database();
        dbRef.current = database;
        setDb(database);
        loadQuestion(database, 0);
      } catch {
        if (!cancelled) setLoadError("Failed to load SQL engine. Run: npm install sql.js and copy sql-wasm.wasm to /public/");
      }
    }
    init();
    return () => { cancelled = true; };
  }, []);

  function loadQuestion(database: any, idx: number) {
    try {
      // Drop all tables
      const tables = database.exec("SELECT name FROM sqlite_master WHERE type='table'");
      if (tables.length > 0) {
        tables[0].values.forEach(([name]: [string]) => {
          try { database.run(`DROP TABLE IF EXISTS "${name}"`); } catch { }
        });
      }
      // Load schema for this question
      database.run(QUESTIONS[idx].schema);
      setResult(null);
      setError("");
      setQuery("");
      setShowHint(false);
      setShowAnswer(false);
      setShowExp(false);
      setExecTime(null);
    } catch (e: any) {
      setError(e.message);
    }
  }

  function switchQuestion(idx: number) {
    setActiveQ(idx);
    if (dbRef.current) loadQuestion(dbRef.current, idx);
    setTimeout(() => textareaRef.current?.focus(), 100);
  }

  function runQuery() {
    if (!dbRef.current || !query.trim()) return;
    setRunning(true);
    setError("");
    setResult(null);
    const t0 = performance.now();
    try {
      const results = dbRef.current.exec(query);
      const elapsed = Math.round(performance.now() - t0);
      setExecTime(elapsed);
      if (results.length === 0) {
        setResult({ columns: ["Result"], rows: [{ Result: "Query executed successfully (no rows returned)." }] });
      } else {
        const { columns, values } = results[0];
        const rows: ResultRow[] = values.map((row: any[]) => {
          const obj: ResultRow = {};
          columns.forEach((col: string, i: number) => { obj[col] = row[i]; });
          return obj;
        });
        setResult({ columns, rows });
        // Mark as solved if they ran something successfully
        setSolved(prev => new Set([...prev, activeQ]));
      }
    } catch (e: any) {
      setError(e.message);
    }
    setRunning(false);
  }

  const q = QUESTIONS[activeQ];
  const diffStyle = DIFF_STYLE[q.difficulty];

  if (loadError) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center max-w-sm px-4">
          <div className="text-[32px] mb-3">⚠️</div>
          <p className="text-[13px] font-bold text-[#EF4444] mb-2">SQL engine failed to load</p>
          <p className="text-[11px] text-[#9CA3AF] leading-relaxed">{loadError}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full" style={{ minHeight: "80vh" }}>

      {/* ── Left sidebar — question list ── */}
      <div
        className="flex-shrink-0 overflow-y-auto"
        style={{ width: 220, borderRight: "1px solid #F0EDE6", background: "#FAFAF8" }}
      >
        <div className="px-3 pt-4 pb-2">
          <p className="text-[10px] font-black uppercase tracking-widest text-[#9CA3AF]">
            {QUESTIONS.length} Questions
          </p>
        </div>
        <div className="pb-4">
          {QUESTIONS.map((question, i) => {
            const ds = DIFF_STYLE[question.difficulty];
            const isActive = activeQ === i;
            const isSolved = solved.has(i);
            return (
              <button
                key={question.id}
                onClick={() => switchQuestion(i)}
                className="w-full text-left px-3 py-3 transition-colors"
                style={{
                  background: isActive ? "white" : "transparent",
                  borderLeft: isActive ? "2px solid #111" : "2px solid transparent",
                }}
              >
                <div className="flex items-center justify-between mb-1">
                  <span
                    className="text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-full"
                    style={{ background: ds.bg, color: ds.color }}
                  >
                    {question.difficulty}
                  </span>
                  {isSolved && (
                    <span className="text-[10px] text-emerald-500 font-bold">✓</span>
                  )}
                </div>
                <p className="text-[11px] font-bold text-[#374151] leading-snug">{question.topic}</p>
                <p className="text-[10px] text-[#9CA3AF] mt-0.5 leading-snug line-clamp-2">
                  {question.question.slice(0, 60)}...
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Right: question + editor + results ── */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Question header */}
        <div style={{ borderBottom: "1px solid #F0EDE6", padding: "16px 20px" }}>
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <span
                  className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full"
                  style={{ background: diffStyle.bg, color: diffStyle.color }}
                >
                  {q.difficulty}
                </span>
                <span className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-widest">
                  {q.topic}
                </span>
                <span className="text-[10px] text-[#9CA3AF]">Q{q.id} of {QUESTIONS.length}</span>
              </div>
              <p className="text-[14px] font-bold text-[#111] leading-relaxed" style={{ maxWidth: 640 }}>
                {q.question}
              </p>
            </div>

            {/* Helper buttons */}
            <div className="flex gap-2 flex-shrink-0">
              <button
                onClick={() => { setShowHint(!showHint); setShowAnswer(false); }}
                className="text-[11px] font-bold px-3 py-1.5 rounded-lg border transition"
                style={{
                  borderColor: showHint ? "#F59E0B" : "#E5E7EB",
                  background: showHint ? "#FFFBEB" : "white",
                  color: showHint ? "#92400E" : "#6B7280",
                }}
              >
                💡 Hint
              </button>
              <button
                onClick={() => { setShowAnswer(!showAnswer); setShowHint(false); }}
                className="text-[11px] font-bold px-3 py-1.5 rounded-lg border transition"
                style={{
                  borderColor: showAnswer ? "#111" : "#E5E7EB",
                  background: showAnswer ? "#111" : "white",
                  color: showAnswer ? "white" : "#6B7280",
                }}
              >
                {showAnswer ? "Hide answer" : "Show answer"}
              </button>
            </div>
          </div>

          {/* Hint */}
          {showHint && (
            <div className="mt-3 rounded-xl px-4 py-2.5" style={{ background: "#FFFBEB", border: "1px solid #FDE68A" }}>
              <p className="text-[12px] text-[#92400E]"><span className="font-bold">Hint: </span>{q.hint}</p>
            </div>
          )}

          {/* Answer */}
          {showAnswer && (
            <div className="mt-3">
              <div className="rounded-xl overflow-hidden" style={{ border: "1px solid #E5E7EB" }}>
                <div className="flex items-center justify-between px-4 py-2" style={{ background: "#F9FAFB", borderBottom: "1px solid #E5E7EB" }}>
                  <p className="text-[10px] font-black uppercase tracking-widest text-[#9CA3AF]">Answer</p>
                  <button
                    onClick={() => { setQuery(q.answer); setShowAnswer(false); textareaRef.current?.focus(); }}
                    className="text-[10px] font-black text-[#6366F1] hover:underline"
                  >
                    Load into editor →
                  </button>
                </div>
                <pre className="px-4 py-3 text-[12px] font-mono text-[#374151] overflow-x-auto" style={{ background: "#F9FAFB" }}>
                  {q.answer}
                </pre>
              </div>
            </div>
          )}
          {/* Table schema — visible by default, this is what you're querying */}
          <div className="mt-3 rounded-xl overflow-hidden" style={{ border: "1px solid #E5E7EB" }}>
            <div className="px-4 py-2" style={{ background: "#F0F9FF", borderBottom: "1px solid #BAE6FD" }}>
              <p className="text-[10px] font-black uppercase tracking-widest text-[#0369A1]">📋 Table Schema</p>
            </div>
            <pre className="px-4 py-3 text-[11px] font-mono text-[#374151] overflow-x-auto whitespace-pre-wrap" style={{ background: "#FAFBFC", maxHeight: 140, overflowY: "auto" }}>
              {q.schema
                .split("\n")
                .filter((line) => line.trim().startsWith("CREATE TABLE"))
                .join("\n")}
            </pre>
          </div>
        </div>
        {/* SQL Editor */}
        <div className="flex-1 flex flex-col overflow-hidden" style={{ minHeight: 0 }}>
          <div className="relative flex-1" style={{ minHeight: 140 }}>
            <textarea
              ref={textareaRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
                  e.preventDefault();
                  runQuery();
                }
              }}
              spellCheck={false}
              placeholder={"-- Write your SQL query here\n-- Ctrl+Enter to run\n\nSELECT ..."}
              className="w-full h-full resize-none font-mono outline-none"
              style={{
                background: "#0D1117",
                color: "#E2E8F0",
                fontSize: 13,
                lineHeight: 1.8,
                padding: "16px 20px",
                minHeight: 140,
              }}
            />
          </div>

          {/* Toolbar */}
          <div
            className="flex items-center justify-between px-4 py-2.5"
            style={{ borderTop: "1px solid #1E2530", background: "#111" }}
          >
            <div className="flex items-center gap-4">
              <span className="text-[11px] text-[#555]">Ctrl+Enter to run</span>
              {execTime !== null && result && !error && (
                <span className="text-[11px] font-bold text-emerald-400">
                  ✓ {result.rows.length} row{result.rows.length !== 1 ? "s" : ""} · {execTime}ms
                </span>
              )}
              {error && <span className="text-[11px] font-bold text-red-400">✗ Error</span>}
            </div>
            <button
              onClick={runQuery}
              disabled={running || !query.trim() || !db}
              className="flex items-center gap-2 rounded-xl px-5 py-2 text-[12px] font-black transition disabled:opacity-40"
              style={{ background: "#FFD600", color: "#111" }}
            >
              {running ? "Running..." : "▶ Run Query"}
            </button>
          </div>

          {/* Error */}
          {error && (
            <div style={{ borderTop: "1px solid #FEE2E2", background: "#FEF2F2", padding: "10px 20px" }}>
              <p className="text-[11px] font-black text-[#DC2626] uppercase tracking-widest mb-1">SQL Error</p>
              <p className="text-[12px] font-mono text-[#B91C1C]">{error}</p>
            </div>
          )}

          {/* Results */}
          {result && !error && (
            <div style={{ borderTop: "1px solid #F0EDE6", overflow: "auto", maxHeight: 220 }}>
              <table className="w-full" style={{ fontSize: 12 }}>
                <thead>
                  <tr style={{ background: "#F9FAFB", borderBottom: "1px solid #F0EDE6", position: "sticky", top: 0 }}>
                    {result.columns.map(col => (
                      <th key={col} className="text-left font-black text-[#374151] px-4 py-2.5 whitespace-nowrap">
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.rows.map((row, i) => (
                    <tr key={i} style={{ borderBottom: "1px solid #F9FAFB" }} className="hover:bg-[#FAFAF8]">
                      {result.columns.map(col => (
                        <td key={col} className="px-4 py-2 text-[#374151] whitespace-nowrap">
                          {row[col] === null
                            ? <span className="text-[#9CA3AF] italic">NULL</span>
                            : String(row[col])}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Explanation after running */}
              <div style={{ borderTop: "1px solid #F0EDE6", padding: "10px 16px", background: "#FAFAF8" }}>
                <button
                  onClick={() => setShowExp(!showExp)}
                  className="text-[11px] font-bold text-[#6366F1] hover:underline"
                >
                  {showExp ? "Hide explanation" : "Why does this work? →"}
                </button>
                {showExp && (
                  <p className="text-[12px] text-[#555] mt-2 leading-relaxed">{q.explanation}</p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Nav between questions */}
        <div
          className="flex items-center justify-between px-5 py-3 flex-shrink-0"
          style={{ borderTop: "1px solid #F0EDE6", background: "#FAFAF8" }}
        >
          <button
            onClick={() => activeQ > 0 && switchQuestion(activeQ - 1)}
            disabled={activeQ === 0}
            className="text-[12px] font-bold text-[#374151] hover:text-[#111] disabled:text-[#D1D5DB] transition"
          >
            ← Previous
          </button>
          <div className="flex gap-1.5">
            {QUESTIONS.map((_, i) => (
              <button
                key={i}
                onClick={() => switchQuestion(i)}
                className="rounded-full transition"
                style={{
                  width: 8, height: 8,
                  background: solved.has(i) ? "#10B981" : i === activeQ ? "#111" : "#E5E7EB",
                }}
              />
            ))}
          </div>
          <button
            onClick={() => activeQ < QUESTIONS.length - 1 && switchQuestion(activeQ + 1)}
            disabled={activeQ === QUESTIONS.length - 1}
            className="text-[12px] font-bold text-[#374151] hover:text-[#111] disabled:text-[#D1D5DB] transition"
          >
            Next →
          </button>
        </div>
      </div>
    </div>
  );
}