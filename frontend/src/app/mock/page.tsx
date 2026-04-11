"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const API_BASE = (process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:8000").replace(/\/$/, "");

export default function MockLandingPage() {
  const router = useRouter();

  const [roleTarget, setRoleTarget] = useState("");
  const [seniority, setSeniority] = useState("");
  const [companyType, setCompanyType] = useState("");
  const [focusArea, setFocusArea] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const roleOptions = [
    {
      icon: "⚙",
      label: "Backend Engineer",
      value: "Backend Engineer",
      tagline: "APIs, databases, infrastructure",
      iconBg: "#EEF2FF",
      iconFg: "#6366F1",
    },
    {
      icon: "◈",
      label: "Frontend Engineer",
      value: "Frontend Engineer",
      tagline: "UI, performance, frameworks",
      iconBg: "#FFF7ED",
      iconFg: "#F97316",
    },
    {
      icon: "⬡",
      label: "Full Stack",
      value: "Full Stack",
      tagline: "End-to-end product development",
      iconBg: "#F0FDF4",
      iconFg: "#22C55E",
    },
    {
      icon: "◉",
      label: "Data Scientist",
      value: "Data Scientist",
      tagline: "ML, analytics, pipelines",
      iconBg: "#FFF1F2",
      iconFg: "#F43F5E",
    },
    {
      icon: "□",
      label: "Product Manager",
      value: "Product Manager",
      tagline: "Strategy, roadmap, stakeholders",
      iconBg: "#FFFBEB",
      iconFg: "#EAB308",
    },
    {
      icon: "▲",
      label: "DevOps Engineer",
      value: "DevOps Engineer",
      tagline: "CI/CD, cloud, reliability",
      iconBg: "#F0F9FF",
      iconFg: "#0EA5E9",
    },
  ];

  const seniorityOptions = ["intern", "junior", "mid", "senior", "staff", "principal"];

  const focusOptions = [
    {
      title: "DSA & Coding",
      value: "dsa",
      description: "Arrays, trees, dynamic programming",
      softBg: "#EEF2FF",
      icon: "◍",
    },
    {
      title: "System Design",
      value: "system_design",
      description: "Scalability and architecture",
      softBg: "#F0FDF4",
      icon: "◈",
    },
    {
      title: "Behavioral",
      value: "behavioral",
      description: "STAR method and leadership",
      softBg: "#FFFBEB",
      icon: "◉",
    },
    {
      title: "Mixed (Full Sim)",
      value: "mixed",
      description: "Full interview simulation",
      softBg: "#FFF1F2",
      icon: "◎",
    },
  ];

  const companyOptions = [
    { title: "Startup", value: "startup", description: "Fast-paced, wear many hats" },
    { title: "Product Company", value: "product", description: "FAANG-style depth" },
    { title: "Service/MNC", value: "mnc", description: "Process and communication" },
  ];

  const allSelected = Boolean(roleTarget && seniority && focusArea && companyType);

  const stepState = [Boolean(roleTarget), Boolean(seniority), Boolean(focusArea), Boolean(companyType)];
  const currentStep = !roleTarget ? 1 : !seniority ? 2 : !focusArea ? 3 : !companyType ? 4 : 4;

  const breakdownRows =
    focusArea === "mixed"
      ? [
          { color: "#6366F1", text: "2 DSA problems" },
          { color: "#22C55E", text: "2 System design" },
          { color: "#F59E0B", text: "2 Behavioral" },
        ]
      : focusArea === "dsa"
      ? [{ color: "#6366F1", text: "4 DSA problems" }]
      : focusArea === "system_design"
      ? [{ color: "#22C55E", text: "4 System design questions" }]
      : focusArea === "behavioral"
      ? [{ color: "#F59E0B", text: "6 Behavioral prompts" }]
      : [{ color: "#9CA3AF", text: "Select focus area to preview" }];

  const tipText = (() => {
    if (!focusArea || !seniority) {
      return "Pick your level and focus to get a personalized strategy tip before you begin.";
    }
    if (focusArea === "system_design" && (seniority === "senior" || seniority === "staff" || seniority === "principal")) {
      return "Senior system design questions focus on trade-offs, not just architecture. Be prepared to justify every decision.";
    }
    if (focusArea === "dsa") {
      return "State brute-force first, then optimize with a clean complexity argument. Interviewers reward structured thinking.";
    }
    if (focusArea === "behavioral") {
      return "Use STAR with outcomes and metrics. Keep each story tight, relevant, and reflective.";
    }
    return "In mixed rounds, announce your approach out loud before each answer so communication stays sharp across formats.";
  })();

  async function startMock() {
    if (!allSelected) return;
    setLoading(true);
    setError(null);

    const existingGuestToken =
      typeof window !== "undefined" ? localStorage.getItem("mock_guest_token") : null;
    const token =
      typeof window !== "undefined"
        ? localStorage.getItem("access_token") || localStorage.getItem("API_TOKEN")
        : null;

    try {
      const res = await fetch(`${API_BASE}/api/mock/session/start`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          role_target: roleTarget,
          seniority,
          company_type: companyType,
          focus_area: focusArea,
          guest_token: existingGuestToken,
          resume_uploaded: false,
          duration_mins: 45,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        if (body?.detail === "signup_required") {
          router.push("/signup?reason=mock_limit");
          return;
        }
        if (body?.detail === "limit_reached") {
          setError("limit_reached");
          return;
        }
        throw new Error(body?.detail || "Unable to start mock session");
      }

      const data = await res.json();
      if (data.guest_token && typeof window !== "undefined") {
        localStorage.setItem("mock_guest_token", data.guest_token);
      }
      if (data.session_id && typeof window !== "undefined") {
        localStorage.setItem("mock_session_id", data.session_id);
      }
      if (data.interview_id && typeof window !== "undefined") {
        localStorage.setItem("mock_interview_id", data.interview_id);
      }

      router.push(`/mock/session/${data.session_id}`);
    } catch (e: any) {
      setError(e?.message || "Network error while creating mock session");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#F9FAFB] text-[#111]">
      <div className="mx-auto grid max-w-[1200px] grid-cols-1 gap-8 px-8 py-12 lg:grid-cols-12 lg:gap-12">
        <section className="lg:col-span-7">
          <p className="text-xs text-[#9CA3AF]">Home &gt; Mock Interview</p>
          <h1 className="mt-3 text-[30px] font-bold text-[#111]">Start a Mock Interview</h1>
          <p className="mt-2 text-[15px] text-[#6B7280]">Personalized to your role, level, and goals.</p>

          <div className="mt-7 rounded-xl border border-[#E5E7EB] bg-white px-4 py-4">
            <div className="flex items-center gap-2 sm:gap-3">
              {[
                { n: 1, label: "Role" },
                { n: 2, label: "Level" },
                { n: 3, label: "Focus" },
                { n: 4, label: "Company" },
              ].map((item, idx) => {
                const completed = idx > 0 ? stepState[idx - 1] : false;
                const active = currentStep === item.n;
                return (
                  <div key={item.n} className="flex min-w-0 flex-1 items-center gap-2">
                    <div
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                        completed
                          ? "bg-[#6366F1] text-white"
                          : active
                          ? "bg-[#EEF2FF] text-[#6366F1]"
                          : "bg-[#F3F4F6] text-[#9CA3AF]"
                      }`}
                    >
                      {completed ? "✓" : item.n}
                    </div>
                    <span className={`text-xs sm:text-sm ${active ? "text-[#6366F1]" : "text-[#9CA3AF]"}`}>{item.label}</span>
                    {idx < 3 && <div className="h-px flex-1 bg-[#E5E7EB]" />}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-7 space-y-7">
            <div>
              <h2 className="mb-3 text-[13px] font-medium text-[#374151]">Target Role</h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {roleOptions.map((role) => {
                  const selected = roleTarget === role.value;
                  return (
                    <button
                      key={role.value}
                      type="button"
                      onClick={() => setRoleTarget(role.value)}
                      className={`rounded-[10px] border p-4 text-left transition-all ${
                        selected
                          ? "border-[1.5px] border-[#6366F1] bg-[#F5F3FF]"
                          : "border-[#E5E7EB] bg-white hover:border-[#C7D2FE]"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className="flex h-9 w-9 items-center justify-center rounded-full text-sm"
                          style={{ backgroundColor: role.iconBg, color: role.iconFg }}
                        >
                          {role.icon}
                        </span>
                        <div>
                          <p className="text-sm font-medium text-[#111]">{role.label}</p>
                          <p className="text-xs text-[#9CA3AF]">{role.tagline}</p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {roleTarget && (
              <div style={{ animation: "slideIn 280ms ease-out" }}>
                <h2 className="mb-3 text-[13px] font-medium text-[#374151]">Experience Level</h2>
                <div className="flex flex-wrap gap-2.5">
                  {seniorityOptions.map((level) => {
                    const selected = seniority === level;
                    return (
                      <button
                        key={level}
                        type="button"
                        onClick={() => setSeniority(level)}
                        className={`rounded-full border px-4 py-2 text-sm capitalize transition-all ${
                          selected
                            ? "border-[#6366F1] bg-[#6366F1] text-white"
                            : "border-[#E5E7EB] bg-white text-[#374151]"
                        }`}
                      >
                        {level}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {seniority && (
              <div style={{ animation: "fadeInUp 260ms ease-out" }}>
                <h2 className="mb-3 text-[13px] font-medium text-[#374151]">Practice Focus</h2>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {focusOptions.map((focus) => {
                    const selected = focusArea === focus.value;
                    return (
                      <button
                        key={focus.value}
                        type="button"
                        onClick={() => setFocusArea(focus.value)}
                        className={`rounded-[10px] border p-5 text-left transition-all ${selected ? "border-[#6366F1] ring-2 ring-[#6366F1]" : "border-transparent"}`}
                        style={{ backgroundColor: focus.softBg }}
                      >
                        <p className="text-sm font-semibold text-[#111]">{focus.icon} {focus.title}</p>
                        <p className="mt-1 text-xs text-[#6B7280]">{focus.description}</p>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {focusArea && (
              <div style={{ animation: "fadeInUp 260ms ease-out" }}>
                <h2 className="mb-3 text-[13px] font-medium text-[#374151]">Interview Style</h2>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  {companyOptions.map((company) => {
                    const selected = companyType === company.value;
                    return (
                      <button
                        key={company.value}
                        type="button"
                        onClick={() => setCompanyType(company.value)}
                        className={`rounded-[10px] border p-4 text-left transition-all ${
                          selected
                            ? "border-[1.5px] border-[#6366F1] bg-[#F5F3FF]"
                            : "border-[#E5E7EB] bg-white"
                        }`}
                      >
                        <p className="text-sm font-semibold text-[#111]">{company.title}</p>
                        <p className="mt-1 text-xs text-[#9CA3AF]">{company.description}</p>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {allSelected && (
              <div style={{ animation: "fadeInUp 260ms ease-out" }}>
                <button
                  type="button"
                  onClick={startMock}
                  disabled={loading}
                  className="h-[52px] w-full rounded-[10px] bg-gradient-to-r from-[#6366F1] to-[#4F46E5] text-base font-semibold text-white disabled:opacity-60"
                >
                  {loading ? "Starting..." : "Start Interview →"}
                </button>
                <p className="mt-3 text-center text-sm text-[#6B7280]">
                  ~45 minutes · 6 questions · Results in 2 minutes
                </p>
                {error && error !== "limit_reached" ? <p className="mt-2 text-center text-sm text-red-600">{error}</p> : null}
              </div>
            )}
          </div>
        </section>

        <aside className="lg:col-span-5">
          <div className="sticky top-6 rounded-2xl border border-[#E5E7EB] bg-white p-7">
            <p className="text-[15px] font-semibold text-[#111]">Interview Preview</p>

            <div className="mt-5 space-y-3">
              {[
                { icon: "⚙", key: "Role", value: roleTarget || "Not selected" },
                { icon: "◍", key: "Level", value: seniority || "Not selected" },
                { icon: "◈", key: "Focus", value: focusArea || "Not selected" },
                { icon: "◎", key: "Style", value: companyType || "Not selected" },
              ].map((row) => {
                const selected = row.value !== "Not selected";
                return (
                  <div key={row.key} className="flex items-center justify-between gap-3">
                    <p className="text-sm text-[#374151]">{row.icon} {row.key}</p>
                    <span
                      className={`rounded-full px-3 py-1 text-xs ${
                        selected ? "bg-[#EEF2FF] text-[#6366F1]" : "bg-[#F3F4F6] text-[#374151]"
                      }`}
                    >
                      {row.value}
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="my-5 h-px bg-[#E5E7EB]" />

            <p className="text-[13px] font-medium text-[#374151]">Question breakdown</p>
            <div className="mt-3 space-y-2">
              {breakdownRows.map((row, i) => (
                <div key={`${row.text}-${i}`} className="flex items-center gap-2 text-sm text-[#374151]">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: row.color }} />
                  <span>{row.text}</span>
                </div>
              ))}
            </div>

            <div className="my-5 h-px bg-[#E5E7EB]" />

            <div className="rounded-r-lg border-l-[3px] border-[#F59E0B] bg-[#FFFBEB] px-4 py-3">
              <p className="text-xs font-semibold text-[#92400E]">💡 Pro tip</p>
              <p className="mt-1 text-[13px] text-[#92400E]">{tipText}</p>
            </div>

            <div className="mt-6 grid grid-cols-3 gap-2">
              <div className="rounded-lg bg-[#F9FAFB] p-3 text-center">
                <p className="text-base font-bold text-[#111]">47,832</p>
                <p className="text-xs text-[#6B7280]">Interviews</p>
              </div>
              <div className="rounded-lg bg-[#F9FAFB] p-3 text-center">
                <p className="text-base font-bold text-[#111]">94%</p>
                <p className="text-xs text-[#6B7280]">Satisfaction</p>
              </div>
              <div className="rounded-lg bg-[#F9FAFB] p-3 text-center">
                <p className="text-base font-bold text-[#111]">4.8★</p>
                <p className="text-xs text-[#6B7280]">Rating</p>
              </div>
            </div>
          </div>
        </aside>
      </div>

      <style jsx global>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateX(-8px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
      `}</style>

      {error === "limit_reached" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-[90%] max-w-[440px] rounded-2xl bg-white p-10 text-center">
            <div className="mb-4 text-[40px]">🎯</div>
            <h2 className="mb-2 text-[22px] font-bold text-[#111]">You've used your free interview</h2>
            <p className="mb-6 text-sm text-[#6B7280]">
              Free plan includes 1 mock interview per month. Upgrade to Pro for unlimited interviews, full reports, and live coaching.
            </p>
            <div className="flex justify-center gap-3">
              <button
                onClick={() => router.push("/pricing")}
                className="rounded-lg bg-[#6366F1] px-6 py-3 text-[15px] font-semibold text-white"
              >
                View Plans
              </button>
              <button
                onClick={() => setError(null)}
                className="rounded-lg border border-[#E5E7EB] bg-white px-6 py-3 text-[15px] text-[#6B7280]"
              >
                Maybe later
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
