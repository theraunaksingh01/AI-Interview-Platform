"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { useState } from "react";
import { FooterHero } from "@/app/components/Footer";

const REASONS = [
  { icon: "🐛", label: "Found a bug" },
  { icon: "💡", label: "Feature request" },
  { icon: "🎓", label: "Student discount" },
  { icon: "🏢", label: "Placement cell / college" },
  { icon: "🤝", label: "Want to join the team" },
  { icon: "❓", label: "Something else" },
];

export default function ContactPage() {
  const [selected, setSelected] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", message: "" });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Wire to your backend contact endpoint when ready.
    // For now this just shows a confirmation state.
    setSubmitted(true);
  };

  return (
    <div className="min-h-screen overflow-x-hidden" style={{ background: "#FFFDF0" }}>
      <main className="pt-24">

        {/* ── Hero ── */}
        <section className="px-6 pb-16 pt-16 text-center">
          <motion.p
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="text-[11px] font-black uppercase tracking-widest text-[#9CA3AF] mb-4"
          >
            Contact us
          </motion.p>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="mx-auto max-w-2xl"
            style={{ fontSize: "clamp(32px, 5vw, 56px)", fontWeight: 900, letterSpacing: "-2px", lineHeight: 1.3, color: "#111" }}
          >
            Talk to a{" "}
            <span style={{ background: "#FFD600", padding: "2px 10px", borderRadius: "6px", fontStyle: "italic" }}>
              real person.
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.25 }}
            className="mx-auto mt-5 max-w-md text-[16px] leading-relaxed"
            style={{ color: "#666" }}
          >
            No support ticket maze. We're a small team — your message reaches an actual founder.
          </motion.p>
        </section>

        <section className="mx-auto max-w-4xl px-6 pb-24">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">

            {/* Left — direct contact + reasons */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              className="lg:col-span-2 space-y-4"
            >
              <div className="rounded-2xl border border-gray-200 bg-white p-6">
                <p className="text-[11px] font-black uppercase tracking-widest text-[#9CA3AF] mb-3">Email us directly</p>
                <a
                  href="mailto:hello@qued.in"
                  className="text-[18px] font-black text-[#111] hover:underline"
                >
                  hello@qued.in
                </a>
                <p className="mt-2 text-[13px] text-[#6B7280]">Usually reply within 24 hours.</p>
              </div>

              <div className="rounded-2xl border border-gray-200 bg-white p-6">
                <p className="text-[11px] font-black uppercase tracking-widest text-[#9CA3AF] mb-3">What's this about?</p>
                <div className="grid grid-cols-2 gap-2">
                  {REASONS.map((r) => (
                    <button
                      key={r.label}
                      type="button"
                      onClick={() => setSelected(r.label)}
                      className={`flex flex-col items-start gap-1.5 rounded-xl border p-3 text-left transition-all ${
                        selected === r.label
                          ? "border-[#111] bg-[#FFFDF0]"
                          : "border-gray-200 bg-white hover:border-gray-300"
                      }`}
                    >
                      <span className="text-[18px]">{r.icon}</span>
                      <span className="text-[11px] font-bold text-[#374151] leading-tight">{r.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-gray-200 bg-white p-6">
                <p className="text-[11px] font-black uppercase tracking-widest text-[#9CA3AF] mb-3">For placement cells</p>
                <p className="text-[13px] text-[#6B7280] leading-relaxed mb-3">
                  Looking to set up Qued for your batch? We're building batch tools — tell us about your college and we'll prioritize you.
                </p>
                <Link href="/pricing" className="text-[13px] font-bold text-[#111] hover:underline">
                  See pricing →
                </Link>
              </div>
            </motion.div>

            {/* Right — form */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="lg:col-span-3"
            >
              <div className="rounded-2xl border border-gray-200 bg-white p-7 sm:p-8">
                {submitted ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <span className="text-[40px] mb-4">✓</span>
                    <h3 className="text-[20px] font-black text-[#111] mb-2">Message sent</h3>
                    <p className="text-[14px] text-[#6B7280] max-w-xs">
                      Thanks for reaching out — we'll get back to you at {form.email || "your email"} soon.
                    </p>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} className="space-y-4">
                    {selected && (
                      <div className="flex items-center gap-2 rounded-lg bg-[#FFFDF0] px-3 py-2 border border-yellow-200">
                        <span className="text-[12px] font-bold text-[#92400E]">Re: {selected}</span>
                        <button
                          type="button"
                          onClick={() => setSelected(null)}
                          className="ml-auto text-[12px] text-[#9CA3AF] hover:text-[#111]"
                        >
                          ✕
                        </button>
                      </div>
                    )}

                    <div>
                      <label className="block text-[12px] font-bold text-[#374151] mb-1.5">Name</label>
                      <input
                        required
                        type="text"
                        value={form.name}
                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                        className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-[14px] outline-none focus:border-[#111] transition"
                        placeholder="Your name"
                      />
                    </div>

                    <div>
                      <label className="block text-[12px] font-bold text-[#374151] mb-1.5">Email</label>
                      <input
                        required
                        type="email"
                        value={form.email}
                        onChange={(e) => setForm({ ...form, email: e.target.value })}
                        className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-[14px] outline-none focus:border-[#111] transition"
                        placeholder="you@college.edu"
                      />
                    </div>

                    <div>
                      <label className="block text-[12px] font-bold text-[#374151] mb-1.5">Message</label>
                      <textarea
                        required
                        rows={5}
                        value={form.message}
                        onChange={(e) => setForm({ ...form, message: e.target.value })}
                        className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-[14px] outline-none focus:border-[#111] transition resize-none"
                        placeholder="What's on your mind?"
                      />
                    </div>

                    <button
                      type="submit"
                      className="w-full rounded-xl bg-[#111] py-3 text-[14px] font-bold text-white hover:bg-[#333] transition"
                    >
                      Send message →
                    </button>

                    <p className="text-[11px] text-center text-[#9CA3AF]">
                      We'll never share your email. No spam, ever.
                    </p>
                  </form>
                )}
              </div>
            </motion.div>
          </div>
        </section>

      </main>
      <FooterHero />
    </div>
  );
}