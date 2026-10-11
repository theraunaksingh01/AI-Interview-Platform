"use client";

// frontend/src/app/founding/apply/page.tsx  ->  route: /founding/apply
// Founding 50 application form (public). Saves to your own database via /api/promo/apply.
// NOTE: match API_BASE to however your other pages define it.

import Link from "next/link";
import { useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const input: React.CSSProperties = {
  width: "100%", padding: "12px 14px", fontSize: 16, border: "1.5px solid #D1D5DB",
  borderRadius: 10, background: "#fff", color: "#111", outline: "none",
};
const label: React.CSSProperties = { display: "block", fontSize: 14, fontWeight: 700, margin: "18px 0 6px" };
const hint: React.CSSProperties = { fontSize: 12, color: "#777", margin: "4px 0 0" };

export default function ApplyPage() {
  const [f, setF] = useState({
    name: "", email: "", college: "", city: "", branch: "", year: "",
    next_test: "", current_prep: "", whatsapp: "", website: "",
  });
  const [fb, setFb] = useState(false);
  const [contact, setContact] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState(false);

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setF({ ...f, [k]: e.target.value });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    if (!fb || !contact) { setErr("Please tick both boxes at the bottom to apply."); return; }
    setBusy(true);
    try {
      const r = await fetch(`${API_BASE}/api/promo/apply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...f, agreed_feedback: fb, agreed_contact: contact }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        const msg = typeof d.detail === "string" ? d.detail : d.detail?.error === "rate_limit_exceeded" ? "Too many tries. Please wait a bit and retry." : "Something went wrong. Please try again.";
        setErr(msg);
      } else {
        setDone(true);
      }
    } catch {
      setErr("Could not reach the server. Check your internet and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main style={{ background: "#FFFDF0", color: "#111", minHeight: "100vh" }}>
      <div style={{ maxWidth: 600, margin: "0 auto", padding: "88px 20px 96px" }}>
        <Link href="/founding" style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", opacity: 0.5, textDecoration: "none", color: "#111" }}>
          &larr; Founding 50
        </Link>

        {done ? (
          <div style={{ marginTop: 40 }}>
            <div style={{ fontSize: 48 }}>&#127881;</div>
            <h1 style={{ fontSize: 34, fontWeight: 900, letterSpacing: "-1px", margin: "12px 0" }}>Application received</h1>
            <p style={{ fontSize: 17, lineHeight: 1.6, color: "#333" }}>
              Thanks, {f.name.split(" ")[0]}! We review applications every day and will contact you on WhatsApp or email within 1-2 days.
              If you are accepted, you will get a link to sign up with the same email ({f.email}) and Pro unlocks automatically.
            </p>
            <Link href="/" style={{ display: "inline-block", marginTop: 16, fontWeight: 800, textDecoration: "underline", color: "#111" }}>Back to Cractal</Link>
          </div>
        ) : (
          <form onSubmit={submit} noValidate>
            <h1 style={{ fontSize: "clamp(30px,6vw,42px)", fontWeight: 900, letterSpacing: "-1.2px", lineHeight: 1.1, margin: "24px 0 8px" }}>
              Apply for Founding 50
            </h1>
            <p style={{ fontSize: 15, color: "#555", lineHeight: 1.6, margin: 0 }}>
              Takes about 2 minutes. We pick students who have a placement test or interview coming up soon.
            </p>

            <label style={label}>Full name *</label>
            <input style={input} value={f.name} onChange={set("name")} autoComplete="name" required />

            <label style={label}>Email *</label>
            <input style={input} type="email" value={f.email} onChange={set("email")} autoComplete="email" required />
            <p style={hint}>Use the same email you will sign up with on Cractal.</p>

            <label style={label}>College *</label>
            <input style={input} value={f.college} onChange={set("college")} required />

            <label style={label}>City *</label>
            <input style={input} value={f.city} onChange={set("city")} required />

            <label style={label}>Branch *</label>
            <input style={input} value={f.branch} onChange={set("branch")} placeholder="e.g. CSE, ECE, IT" required />

            <label style={label}>Year *</label>
            <select style={input} value={f.year} onChange={set("year")} required>
              <option value="">Select</option>
              <option>Pre-final year</option>
              <option>Final year</option>
              <option>Passed out (job hunting)</option>
              <option>Other</option>
            </select>

            <label style={label}>Which company test or interview do you have next, and roughly when? *</label>
            <input style={input} value={f.next_test} onChange={set("next_test")} placeholder="e.g. TCS NQT in November" required />

            <label style={label}>How are you preparing right now?</label>
            <textarea style={{ ...input, minHeight: 80, resize: "vertical" }} value={f.current_prep} onChange={set("current_prep")} placeholder="YouTube, PrepInsta, coaching, friends... anything" />

            <label style={label}>WhatsApp number *</label>
            <input style={input} type="tel" value={f.whatsapp} onChange={set("whatsapp")} placeholder="+91 98765 43210" autoComplete="tel" required />

            {/* honeypot: hidden from real users */}
            <div style={{ position: "absolute", left: "-9999px" }} aria-hidden="true">
              <label>Website</label>
              <input tabIndex={-1} autoComplete="off" value={f.website} onChange={set("website")} />
            </div>

            <label style={{ display: "flex", gap: 10, alignItems: "flex-start", margin: "24px 0 10px", fontSize: 14, lineHeight: 1.5, fontWeight: 500 }}>
              <input type="checkbox" checked={fb} onChange={(e) => setFb(e.target.checked)} style={{ marginTop: 3, width: 18, height: 18 }} />
              I will use Cractal for a few days and give honest feedback (about 10 minutes).
            </label>
            <label style={{ display: "flex", gap: 10, alignItems: "flex-start", margin: "0 0 8px", fontSize: 14, lineHeight: 1.5, fontWeight: 500 }}>
              <input type="checkbox" checked={contact} onChange={(e) => setContact(e.target.checked)} style={{ marginTop: 3, width: 18, height: 18 }} />
              Cractal may contact me on WhatsApp or email about this.
            </label>
            <p style={hint}>We use your details only to contact you about Cractal. Ask us to delete them any time. See our <Link href="/privacy" style={{ textDecoration: "underline", color: "#555" }}>Privacy Policy</Link>.</p>

            {err && <p role="alert" style={{ color: "#B91C1C", fontWeight: 700, margin: "16px 0 0" }}>{err}</p>}

            <button
              type="submit" disabled={busy}
              style={{ marginTop: 22, width: "100%", background: "#FFD600", color: "#111", fontWeight: 800, fontSize: 18, padding: "14px 0", border: "none", borderRadius: 999, cursor: busy ? "default" : "pointer", opacity: busy ? 0.6 : 1 }}
            >
              {busy ? "Sending..." : "Submit application"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
