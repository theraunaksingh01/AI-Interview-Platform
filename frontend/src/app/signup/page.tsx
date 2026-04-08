"use client";

import { useEffect, useState } from "react";

export default function SignUpPage() {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [testimonialIdx, setTestimonialIdx] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setTestimonialIdx((v) => (v + 1) % 3);
    }, 3000);
    return () => clearInterval(id);
  }, []);

  const testimonials = [
    "Improved my system design score from 4.2 to 8.6 in 6 sessions",
    "The real-time coaching caught 14 filler words I didn't know I was using",
    "Got my first FAANG offer after 3 weeks of mock practice",
  ];

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (pw !== confirm) {
      setMsg("Passwords do not match.");
      return;
    }
    // Hook up to /auth/register when ready.
    setMsg("Sign up is disabled in this demo. Use the seeded account to login.");
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="mx-auto grid min-h-screen grid-cols-1 lg:grid-cols-20">
        <section className="flex items-center bg-white px-6 py-12 sm:px-10 lg:col-span-9 lg:px-14 lg:py-16">
          <div className="mx-auto w-full max-w-[460px]">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#6366F1] text-[18px] font-bold text-white">
              A
            </div>
            <h1 className="mt-6 text-[32px] font-bold leading-tight text-[#111]">Create account</h1>
            <p className="mt-2 text-sm text-[#888]">Set up your interview coach profile</p>

            <form onSubmit={onSubmit} className="mt-8 space-y-4">
              <div>
                <label className="mb-1.5 block text-[13px] font-medium text-[#374151]">Full name</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="h-11 w-full rounded-lg border border-[#E5E7EB] px-3.5 text-sm text-[#111] placeholder:text-[#9CA3AF] focus:border-[#6366F1] focus:outline-none focus:ring-2 focus:ring-[#EEF2FF]"
                  placeholder="Ada Lovelace"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-[13px] font-medium text-[#374151]">Email</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-11 w-full rounded-lg border border-[#E5E7EB] px-3.5 text-sm text-[#111] placeholder:text-[#9CA3AF] focus:border-[#6366F1] focus:outline-none focus:ring-2 focus:ring-[#EEF2FF]"
                  placeholder="you@company.com"
                />
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-[13px] font-medium text-[#374151]">Password</label>
                  <input
                    type="password"
                    required
                    value={pw}
                    onChange={(e) => setPw(e.target.value)}
                    className="h-11 w-full rounded-lg border border-[#E5E7EB] px-3.5 text-sm text-[#111] placeholder:text-[#9CA3AF] focus:border-[#6366F1] focus:outline-none focus:ring-2 focus:ring-[#EEF2FF]"
                    placeholder="••••••••"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-[13px] font-medium text-[#374151]">Confirm</label>
                  <input
                    type="password"
                    required
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    className="h-11 w-full rounded-lg border border-[#E5E7EB] px-3.5 text-sm text-[#111] placeholder:text-[#9CA3AF] focus:border-[#6366F1] focus:outline-none focus:ring-2 focus:ring-[#EEF2FF]"
                    placeholder="••••••••"
                  />
                </div>
              </div>

              {msg && <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">{msg}</div>}

              <button className="h-11 w-full rounded-lg bg-[#6366F1] text-[15px] font-medium text-white transition hover:bg-[#4F46E5]">
                Create account
              </button>
            </form>

            <div className="my-6 flex items-center gap-3">
              <div className="h-px flex-1 bg-[#E5E7EB]" />
              <span className="text-[13px] text-[#9CA3AF]">or continue with</span>
              <div className="h-px flex-1 bg-[#E5E7EB]" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                className="flex h-10 items-center justify-center gap-2 rounded-lg border border-[#E5E7EB] bg-white text-sm text-[#374151]"
              >
                <span>G</span>
                Google
              </button>
              <button
                type="button"
                className="flex h-10 items-center justify-center gap-2 rounded-lg border border-[#E5E7EB] bg-white text-sm text-[#374151]"
              >
                <span>GH</span>
                GitHub
              </button>
            </div>

            <p className="mt-6 text-[13px] text-[#888]">
              Already have an account? <a href="/login" className="font-medium text-[#6366F1]">Sign in</a>
            </p>
          </div>
        </section>

        <section className="hidden bg-[#F5F3FF] px-12 py-16 lg:col-span-11 lg:flex lg:flex-col lg:items-center lg:justify-center">
          <div className="w-full max-w-[560px] text-center">
            <svg width="320" height="280" viewBox="0 0 320 280" className="mx-auto">
              <rect x="46" y="160" width="230" height="18" rx="9" fill="#E0E7FF" />
              <rect x="86" y="128" width="150" height="40" rx="8" fill="#A5B4FC" />
              <rect x="110" y="136" width="102" height="24" rx="4" fill="#312E81" />
              <circle cx="80" cy="108" r="24" fill="#6366F1" />
              <rect x="62" y="130" width="38" height="40" rx="10" fill="#6366F1" />
              <rect x="128" y="98" width="46" height="30" rx="8" fill="#E0E7FF" />
              <rect x="136" y="106" width="30" height="5" rx="2.5" fill="#6366F1" />
              <rect x="136" y="114" width="22" height="5" rx="2.5" fill="#A5B4FC" />
              <rect x="175" y="62" width="104" height="54" rx="12" fill="#FFFFFF" />
              <path d="M191 115 L202 115 L196 125 Z" fill="#FFFFFF" />
              <text x="187" y="90" fill="#312E81" fontSize="11" fontFamily="Arial, sans-serif">Tell me about</text>
              <text x="187" y="103" fill="#312E81" fontSize="11" fontFamily="Arial, sans-serif">yourself...</text>
              <rect x="208" y="126" width="20" height="34" rx="7" fill="#6366F1" />
              <rect x="204" y="152" width="28" height="9" rx="4.5" fill="#A5B4FC" />
            </svg>

            <div className="mx-auto mt-8 max-w-[480px] rounded-xl bg-white px-5 py-4 text-left shadow-[0_2px_12px_rgba(99,102,241,0.12)]">
              <p className="text-sm text-[#374151]">{testimonials[testimonialIdx]}</p>
            </div>
            <div className="mt-3 flex justify-center gap-2">
              {[0, 1, 2].map((dot) => (
                <span
                  key={dot}
                  className={`h-2.5 w-2.5 rounded-full ${dot === testimonialIdx ? "bg-[#6366F1]" : "bg-[#DDD]"}`}
                />
              ))}
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
              <span className="rounded-full bg-[#EEF2FF] px-3.5 py-1.5 text-[13px] text-[#6366F1]">47,832 interviews</span>
              <span className="rounded-full bg-[#EEF2FF] px-3.5 py-1.5 text-[13px] text-[#6366F1]">94% satisfaction</span>
              <span className="rounded-full bg-[#EEF2FF] px-3.5 py-1.5 text-[13px] text-[#6366F1]">4.8★ rating</span>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
