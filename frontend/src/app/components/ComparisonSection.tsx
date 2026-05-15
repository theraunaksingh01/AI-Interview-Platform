"use client";

const ourTags = [
  { label: "AI Follow-up Probing", dark: true },
  { label: "Adaptive Difficulty", dark: false },
  { label: "Weakness Tracking", dark: true },
  { label: "Real-time Coaching", dark: false },
  { label: "Cheat Detection", dark: true },
  { label: "Answer Depth Analysis", dark: false },
  { label: "STAR Scoring", dark: true },
  { label: "Resume Mismatch Alert", dark: false },
  { label: "Progress Memory", dark: true },
  { label: "Role-specific Questions", dark: false },
];

const theirTags = [
  { label: "Generic Rubrics", faded: false },
  { label: "No Follow-ups", faded: true },
  { label: "Static Questions", faded: false },
  { label: "Peer-dependent", faded: true },
  { label: "No Memory", faded: false },
  { label: "Repetitive Prompts", faded: true },
  { label: "Surface Feedback", faded: false },
  { label: "No Depth Check", faded: true },
  { label: "Score Only", faded: false },
  { label: "Inconsistent Quality", faded: true },
];

export default function ComparisonSection() {
  return (
    <section className="comp-root">
      <div className="comp-grid-bg" aria-hidden />

      <div className="comp-inner">
        {/* Heading */}
        <div className="comp-heading">
          <h2 className="comp-title">
            Why settle for tools that just{" "}
            <span className="comp-highlight"><em>score you?</em></span>
          </h2>
          <p className="comp-sub">
            Other tools give you a number. We give you a diagnosis, a coach,
            and a memory that grows with you.
          </p>
        </div>

        {/* Two panels */}
        <div className="comp-panels">
          {/* LEFT — Ours */}
          <div className="panel panel--ours">
            <div className="panel-header">
              <span className="panel-badge panel-badge--ours">Qued</span>
              <p className="panel-label">Structured. Adaptive. Honest.</p>
            </div>
            <div className="tag-cloud">
              {ourTags.map((t) => (
                <span
                  key={t.label}
                  className={`our-tag ${t.dark ? "our-tag--dark" : "our-tag--light"}`}
                >
                  <span className="tag-dot" />
                  {t.label}
                </span>
              ))}
            </div>
            <svg className="scribble" viewBox="0 0 180 12" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M2 9 C 40 2, 80 11, 120 5 S 160 2, 178 7" stroke="#6366f1" strokeWidth="2.5" strokeLinecap="round" fill="none"/>
            </svg>
          </div>

          {/* VS Divider — absolutely centred */}
          <div className="comp-divider">
            <span className="divider-label">vs</span>
          </div>

          {/* RIGHT — Others */}
          <div className="panel panel--others">
            <div className="panel-header">
              <span className="panel-badge panel-badge--others">Others</span>
              <p className="panel-label">Pramp · ChatGPT · LeetCode Mock</p>
            </div>
            <div className="tag-cloud">
              {theirTags.map((t) => (
                <span
                  key={t.label}
                  className={`their-tag ${t.faded ? "their-tag--faded" : ""}`}
                >
                  <span className="x-icon">✕</span>
                  {t.label}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="comp-cta">
          <a href="#" className="cta-btn">Start your free mock →</a>
          <p className="cta-note">No credit card · First 3 mocks free</p>
        </div>
      </div>

      <style jsx>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;0,900;1,700&family=DM+Sans:wght@400;500;600&display=swap');

        .comp-root {
          position: relative;
          background: #f8fafc;
          padding: 96px 24px 88px;
          overflow: hidden;
          font-family: 'DM Sans', sans-serif;
        }

        .comp-grid-bg {
          position: absolute;
          inset: 0;
          background-image: radial-gradient(circle, #cbd5e1 1px, transparent 1px);
          background-size: 28px 28px;
          opacity: 0.35;
          pointer-events: none;
        }

        .comp-inner {
          position: relative;
          z-index: 1;
          max-width: 1000px;
          margin: 0 auto;
        }

        /* ── Heading ── */
        .comp-heading {
          text-align: center;
          margin-bottom: 64px;
        }

        .comp-eyebrow {
          font-size: 0.72rem;
          font-weight: 600;
          letter-spacing: 2.5px;
          text-transform: uppercase;
          color: #94a3b8;
          margin: 0 0 14px;
        }

        .comp-title {
          font-family: 'DM Sans', sans-serif;
          font-size: clamp(2.2rem, 5vw, 3.4rem);
          font-weight: 900;
          color: #111;
          margin: 0 0 16px;
          line-height: 1.15;
          letter-spacing: -1px;
        }

        .comp-highlight {
          background-color: #f5c518;
          padding: 2px 10px 4px;
          border-radius: 4px;
          display: inline-block;
          color: #111;
        }

        .comp-highlight em {
          font-style: italic;
        }

        .comp-sub {
          font-size: 0.95rem;
          color: #64748b;
          max-width: 440px;
          margin: 0 auto;
          line-height: 1.7;
        }

        /* ── Panels wrapper ── */
        .comp-panels {
          position: relative;
          display: flex;
          align-items: stretch;
          background: #fff;
          border-radius: 20px;
          border: 1.5px solid #e2e8f0;
          box-shadow: 0 4px 40px rgba(0,0,0,0.07);
          overflow: visible;
        }

        .panel {
          flex: 1;
          padding: 44px 40px 48px;
          min-width: 0;
        }

        .panel--ours {
          background: linear-gradient(145deg, #eef2ff 0%, #f8faff 100%);
          border-radius: 20px 0 0 20px;
          border-right: 1.5px solid #e2e8f0;
        }

        .panel--others {
          background: #fafafa;
          border-radius: 0 20px 20px 0;
        }

        /* ── VS pill — dead centre of the card ── */
        .comp-divider {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          z-index: 10;
          width: 44px;
          height: 44px;
          border-radius: 50%;
          background: #fff;
          border: 1.5px solid #e2e8f0;
          box-shadow: 0 2px 12px rgba(0,0,0,0.1);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .divider-label {
          font-family: 'Playfair Display', serif;
          font-size: 0.8rem;
          font-weight: 700;
          color: #94a3b8;
          font-style: italic;
          line-height: 1;
        }

        /* ── Panel headers ── */
        .panel-header {
          margin-bottom: 28px;
        }

        .panel-badge {
          display: inline-block;
          font-size: 0.78rem;
          font-weight: 700;
          padding: 5px 14px;
          border-radius: 999px;
          letter-spacing: 0.3px;
          margin-bottom: 8px;
          font-family: 'DM Sans', sans-serif;
        }

        .panel-badge--ours {
          background: #6366f1;
          color: #fff;
        }

        .panel-badge--others {
          background: #f1f5f9;
          color: #94a3b8;
          border: 1px solid #e2e8f0;
        }

        .panel-label {
          font-size: 0.8rem;
          color: #94a3b8;
          margin: 0;
          font-weight: 500;
          font-family: 'DM Sans', sans-serif;
        }

        /* ── Tag clouds ── */
        .tag-cloud {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
        }

        .our-tag {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 9px 18px;
          border-radius: 999px;
          font-size: 0.85rem;
          font-weight: 600;
          font-family: 'DM Sans', sans-serif;
          letter-spacing: 0.1px;
          transition: transform 0.2s ease;
        }

        .our-tag:hover { transform: translateY(-2px); }

        .our-tag--dark {
          background: #0f172a;
          color: #fff;
        }

        .our-tag--light {
          background: #fff;
          color: #0f172a;
          border: 1.5px solid #e2e8f0;
          box-shadow: 0 1px 6px rgba(0,0,0,0.06);
        }

        .tag-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #22c55e;
          flex-shrink: 0;
        }

        .their-tag {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 9px 18px;
          border-radius: 999px;
          font-size: 0.85rem;
          font-weight: 500;
          font-family: 'DM Sans', sans-serif;
          background: #f1f5f9;
          color: #94a3b8;
          border: 1.5px solid #e2e8f0;
        }

        .their-tag--faded { opacity: 0.5; }

        .x-icon {
          font-size: 0.6rem;
          color: #ef4444;
          font-weight: 700;
        }

        .scribble {
          width: 180px;
          margin-top: 28px;
          display: block;
        }

        /* ── CTA ── */
        .comp-cta {
          text-align: center;
          margin-top: 52px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 10px;
        }

        .cta-btn {
          display: inline-block;
          padding: 14px 36px;
          background: #0f172a;
          color: #fff;
          font-size: 0.95rem;
          font-weight: 600;
          font-family: 'DM Sans', sans-serif;
          border-radius: 10px;
          text-decoration: none;
          transition: background 0.2s, transform 0.2s;
          letter-spacing: 0.2px;
        }

        .cta-btn:hover {
          background: #6366f1;
          transform: translateY(-2px);
        }

        .cta-note {
          font-size: 0.78rem;
          color: #94a3b8;
          margin: 0;
          font-family: 'DM Sans', sans-serif;
        }

        /* ── Responsive ── */
        @media (max-width: 700px) {
          .comp-panels {
            flex-direction: column;
          }
          .panel--ours {
            border-radius: 20px 20px 0 0;
            border-right: none;
            border-bottom: 1.5px solid #e2e8f0;
          }
          .panel--others {
            border-radius: 0 0 20px 20px;
          }
          .panel {
            padding: 32px 24px;
          }
          /* On mobile, VS sits between the two panels */
          .comp-divider {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
          }
        }
      `}</style>
    </section>
  );
}