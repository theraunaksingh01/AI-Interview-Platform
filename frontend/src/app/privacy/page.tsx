"use client";

import Link from "next/link";

const LAST_UPDATED = "July 1, 2025";
const CONTACT_EMAIL = "legal@qued.in";
const COMPANY_NAME = "Qued";
const WEBSITE = "qued.in";

const sections = [
  {
    id: "information-we-collect",
    title: "1. Information We Collect",
    content: [
      {
        subtitle: "Account Information",
        text: "When you register, we collect your name, email address, college, branch, and year of study. This is required to create your account and personalise your experience.",
      },
      {
        subtitle: "Voice Recordings & Transcripts",
        text: "Mock interview sessions capture your voice via your device microphone. Audio is processed in real-time by our speech recognition system (Faster-Whisper) and converted to text transcripts. Raw audio is not stored permanently — only the transcript and AI-generated feedback are retained against your session record.",
      },
      {
        subtitle: "Session & Practice Data",
        text: "We record your mock interview answers, scores, DSA submissions, code written in the practice IDE, hints revealed, and coaching feedback. This data powers your Skill Passport, session history, and Personal Coach Agent.",
      },
      {
        subtitle: "Usage Data",
        text: "We collect standard server logs: IP address, browser type, pages visited, timestamps. This is used for security monitoring and platform analytics — never for targeted advertising.",
      },
      {
        subtitle: "Payment Information",
        text: "Payments are handled by Razorpay. We do not store your card number, CVV, or bank details on our servers. We only retain the transaction ID and plan status returned by Razorpay after a successful payment.",
      },
    ],
  },
  {
    id: "how-we-use",
    title: "2. How We Use Your Information",
    bullets: [
      "Deliver the core platform — mock interviews, DSA practice, coaching reports, Skill Passport",
      "Generate AI scoring and feedback using Claude (Anthropic) — your transcript is sent to Anthropic's API for this purpose",
      "Track your progress over sessions and surface your Skill Passport readiness scores",
      "Send transactional emails (session complete, plan confirmation, password reset) — no marketing emails without your opt-in",
      "Detect and prevent abuse, rate-limit brute-force attempts, and enforce plan gates",
      "Improve the question bank and coaching models — only in aggregate, never tied to your identity",
    ],
  },
  {
    id: "data-sharing",
    title: "3. Data Sharing",
    content: [
      {
        subtitle: "Anthropic (Claude API)",
        text: "Your interview transcripts and code submissions are sent to Anthropic's API to generate scores, feedback, and coaching reports. Anthropic processes this data subject to their API usage policy and does not use API inputs to train their models by default.",
      },
      {
        subtitle: "Razorpay",
        text: "Payment processing is handled by Razorpay. Your payment data is governed by Razorpay's privacy policy.",
      },
      {
        subtitle: "No Sale of Data",
        text: "We do not sell, rent, or trade your personal data to any third party for advertising or marketing purposes. Full stop.",
      },
      {
        subtitle: "Legal Requirements",
        text: "We may disclose data if required by Indian law, court order, or a lawful government request. We will notify you when legally permitted to do so.",
      },
    ],
  },
  {
    id: "data-retention",
    title: "4. Data Retention",
    bullets: [
      "Account data: retained while your account is active. Deleted within 30 days of account deletion request.",
      "Session transcripts and scores: retained for 12 months from session date, then permanently deleted.",
      "Voice audio: processed in-session only. Not stored after transcription.",
      "DSA code submissions: retained for 6 months.",
      "Payment records: retained for 7 years as required under Indian accounting law.",
    ],
  },
  {
    id: "your-rights",
    title: "5. Your Rights",
    content: [
      {
        subtitle: "Access",
        text: "You can view all your session history, scores, and profile data from your dashboard at any time.",
      },
      {
        subtitle: "Correction",
        text: "You can update your name, college, branch, and target companies from your profile settings.",
      },
      {
        subtitle: "Deletion",
        text: `Email us at ${CONTACT_EMAIL} with the subject "Delete my account" and we will permanently delete your account and all associated data within 30 days, except where retention is required by law.`,
      },
      {
        subtitle: "Data Export",
        text: `Email us at ${CONTACT_EMAIL} to request a copy of your data in JSON format. We will respond within 15 business days.`,
      },
    ],
  },
  {
    id: "grievance",
    title: "6. Grievance Officer (DPDP Act 2023)",
    text: `In accordance with India's Digital Personal Data Protection Act 2023, you may direct grievances related to your personal data to our Grievance Officer at ${CONTACT_EMAIL}. We will acknowledge your complaint within 48 hours and resolve it within 30 days.`,
  },
  {
    id: "security",
    title: "7. Security",
    bullets: [
      "Passwords are hashed using bcrypt — we never store plaintext passwords",
      "All data in transit is encrypted via HTTPS/TLS",
      "Code execution runs in isolated subprocesses with input validation and a command blacklist",
      "Login attempts are rate-limited to 5 per minute per IP",
      "We conduct periodic SQL injection and security audits",
    ],
  },
  {
    id: "cookies",
    title: "8. Cookies & Local Storage",
    text: `We use a single session cookie to keep you logged in. This is a strictly-necessary cookie — it cannot be turned off if you want to use the platform. We do not use advertising or tracking cookies. We also use your browser's localStorage to save your DSA code drafts locally — this data never leaves your device and is not transmitted to our servers.`,
  },
  {
    id: "children",
    title: "9. Minimum Age",
    text: `${COMPANY_NAME} is intended for college students aged 17 and above. We do not knowingly collect data from users under 17. If you believe a minor has registered, contact us at ${CONTACT_EMAIL} and we will remove the account.`,
  },
  {
    id: "changes",
    title: "10. Changes to This Policy",
    text: `We may update this policy as the platform evolves. Material changes will be communicated via email to registered users at least 7 days before taking effect. The "Last updated" date at the top of this page always reflects the current version.`,
  },
  {
    id: "contact",
    title: "11. Contact",
    text: `For any privacy-related questions, requests, or concerns, email us at ${CONTACT_EMAIL}. We respond within 5 business days.`,
  },
];

export default function PrivacyPage() {
  return (
    <main className="min-h-screen" style={{ background: "#FFFDF0", color: "#111111" }}>

      <style>{`
        .legal-header { padding: 48px 24px 40px; }
        .legal-container { max-width: 760px; margin: 0 auto; padding: 0 16px; }
        .legal-toc { padding: 20px; margin-bottom: 40px; }
        .legal-section { margin-bottom: 44px; }
        .legal-h1 { font-size: clamp(28px, 6vw, 52px); font-weight: 900; letter-spacing: -1.5px; line-height: 1.05; margin: 0 0 14px; }
        .legal-h2 { font-size: 20px; font-weight: 800; letter-spacing: -0.4px; margin: 0 0 16px; padding-bottom: 10px; border-bottom: 2px solid #FFD600; display: inline-block; }
        .legal-body { font-size: 15px; line-height: 1.75; color: #333; margin: 12px 0 0; }
        .legal-sub { margin-top: 14px; padding-left: 14px; border-left: 3px solid #E5E7EB; }
        .legal-sub-label { font-size: 12px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; color: #111; margin: 0 0 5px; }
        .legal-bullet { display: flex; gap: 10px; align-items: flex-start; margin-bottom: 10px; font-size: 15px; line-height: 1.65; color: #333; }
        .legal-dot { flex-shrink: 0; margin-top: 8px; width: 6px; height: 6px; border-radius: 50%; background: #FFD600; display: inline-block; }
        .legal-cta { background: #111111; color: white; border-radius: 14px; padding: 28px 28px; margin-top: 12px; }
        .legal-pill { display: inline-block; background: #FFD600; color: #111111; font-size: 10px; font-weight: 800; letter-spacing: 0.1em; text-transform: uppercase; padding: 3px 9px; border-radius: 4px; margin-bottom: 14px; }

        @media (max-width: 600px) {
          .legal-header { padding: 36px 16px 28px; }
          .legal-container { padding: 0 16px; }
          .legal-toc { padding: 16px; }
          .legal-h2 { font-size: 18px; }
          .legal-body { font-size: 14px; }
          .legal-bullet { font-size: 14px; }
          .legal-cta { padding: 22px 20px; border-radius: 12px; }
        }
      `}</style>

      {/* Header */}
      <div style={{ borderBottom: "1px solid #E5E7EB" }}>
        <div className="legal-container">
          <div className="legal-header">
            <Link
              href="/"
              style={{
                display: "inline-block",
                marginBottom: 24,
                fontSize: 12,
                fontWeight: 600,
                color: "#111",
                textDecoration: "none",
                letterSpacing: "0.05em",
                textTransform: "uppercase",
                opacity: 0.45,
              }}
            >
              ← Qued
            </Link>

            <div className="legal-pill">Legal</div>

            <h1 className="legal-h1">Privacy Policy</h1>

            <p style={{ fontSize: 14, color: "#777", margin: "0 0 10px" }}>
              Last updated: {LAST_UPDATED}
            </p>
            <p className="legal-body" style={{ margin: 0, maxWidth: 580 }}>
              This policy explains what data {COMPANY_NAME} collects when you
              use {WEBSITE}, why we collect it, and what control you have over
              it. Written to be readable, not to bury things in legalese.
            </p>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="legal-container" style={{ paddingTop: 36, paddingBottom: 80 }}>

        {/* TOC */}
        <nav
          className="legal-toc"
          style={{ background: "white", border: "1px solid #E5E7EB", borderRadius: 12, marginBottom: 44 }}
        >
          <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#aaa", margin: "0 0 12px" }}>
            Contents
          </p>
          {sections.map((s) => (
            <div key={s.id} style={{ marginBottom: 5 }}>
              <a
                href={`#${s.id}`}
                style={{ fontSize: 14, color: "#111", textDecoration: "none", fontWeight: 500 }}
                onMouseEnter={(e) => (e.currentTarget.style.textDecoration = "underline")}
                onMouseLeave={(e) => (e.currentTarget.style.textDecoration = "none")}
              >
                {s.title}
              </a>
            </div>
          ))}
        </nav>

        {/* Sections */}
        {sections.map((section) => (
          <section key={section.id} id={section.id} className="legal-section">
            <h2 className="legal-h2">{section.title}</h2>

            {"text" in section && section.text && (
              <p className="legal-body">{section.text}</p>
            )}

            {"bullets" in section && section.bullets && (
              <ul style={{ margin: "12px 0 0", padding: 0, listStyle: "none" }}>
                {section.bullets.map((b, i) => (
                  <li key={i} className="legal-bullet">
                    <span className="legal-dot" />
                    {b}
                  </li>
                ))}
              </ul>
            )}

            {"content" in section &&
              section.content &&
              section.content.map((item, i) => (
                <div key={i} className="legal-sub" style={{ marginTop: i === 0 ? 12 : 20 }}>
                  <p className="legal-sub-label">{item.subtitle}</p>
                  <p className="legal-body" style={{ margin: 0 }}>{item.text}</p>
                </div>
              ))}
          </section>
        ))}

        {/* CTA */}
        <div className="legal-cta">
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#FFD600", margin: "0 0 8px" }}>
            Questions?
          </p>
          <p style={{ fontSize: 14, lineHeight: 1.7, margin: "0 0 18px", color: "#bbb" }}>
            If anything here is unclear or you want to exercise your rights, email us directly.
          </p>
          <a
            href={`mailto:${CONTACT_EMAIL}`}
            style={{
              display: "inline-block",
              background: "#FFD600",
              color: "#111",
              fontWeight: 800,
              fontSize: 14,
              padding: "9px 18px",
              borderRadius: 8,
              textDecoration: "none",
            }}
          >
            {CONTACT_EMAIL}
          </a>
        </div>
      </div>
    </main>
  );
}