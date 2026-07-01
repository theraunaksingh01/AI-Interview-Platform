import Link from "next/link";

export default function SkillPassport() {
  return (
    <section className="skill-passport-section">
      {/* Heading */}
      <div className="heading-wrapper">
        <h2 className="heading">
          Take a look at your{" "}
          <span className="heading-highlight">Skill Passport</span>
        </h2>
        <p className="subheading">
          Every session feeds one score. Know exactly where you stand before you walk in.
        </p>
      </div>

      {/* Card */}
      <div className="card">
        {/* Left: Text content */}
        <div className="card-left">
          <div className="brand">
            <svg
              width="22"
              height="22"
              viewBox="0 0 22 22"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <circle cx="11" cy="11" r="11" fill="#6C63FF" />
              <path
                d="M6 11 L11 6 L16 11 L11 16 Z"
                fill="white"
                opacity="0.9"
              />
            </svg>
            <span className="brand-name">QUED</span>
          </div>

          <span className="badge">Your Skill Passport</span>

          <h3 className="card-title">One score. Every session.</h3>

          <p className="card-desc">
            A live readiness report across DSA, system design, behavioral, and
            communication — built from every mock interview you've done.
            Shareable on LinkedIn when you're ready to show it off.
          </p>

          <Link href="/passport" className="card-link">
            View your Skill Passport <span className="arrow">→</span>
          </Link>
        </div>

        {/* Right: Real mini-preview */}
        <div className="card-right">
          <div className="preview-card">
            <div className="preview-header">
              <span className="preview-name">Skill Passport</span>
              <span className="preview-band">Developing</span>
            </div>

            <div className="preview-score-row">
              <span className="preview-score">62</span>
              <span className="preview-score-max">/100</span>
            </div>
            <p className="preview-score-label">Readiness Score</p>

            <div className="preview-bars">
              {[
                { label: "DSA", value: 71, color: "#5B21B6" },
                { label: "System Design", value: 48, color: "#92400E" },
                { label: "Behavioral", value: 65, color: "#065F46" },
                { label: "Communication", value: 58, color: "#1E40AF" },
              ].map((d) => (
                <div key={d.label} className="preview-bar-row">
                  <span className="preview-bar-label">{d.label}</span>
                  <div className="preview-bar-track">
                    <div
                      className="preview-bar-fill"
                      style={{ width: `${d.value}%`, background: d.color }}
                    />
                  </div>
                  <span className="preview-bar-value">{d.value}</span>
                </div>
              ))}
            </div>

            <p className="preview-footer">12 sessions · Updated live</p>
          </div>
        </div>
      </div>

      <style jsx>{`
        .skill-passport-section {
          font-family: "Georgia", serif;
          padding: 60px 24px;
          max-width: 960px;
          margin: 0 auto;
        }

        /* ── Heading ── */
        .heading-wrapper {
          text-align: center;
          margin-bottom: 40px;
        }

        .heading {
          font-size: clamp(1.8rem, 4vw, 2.6rem);
          font-weight: 800;
          color: #111;
          line-height: 1.25;
          font-family: "Arial Black", "Arial", sans-serif;
          letter-spacing: -0.5px;
        }

        .heading-highlight {
          background-color: #f5c518;
          padding: 2px 10px;
          border-radius: 3px;
          display: inline-block;
          color: #111;
        }

        .subheading {
          margin-top: 12px;
          font-size: 0.95rem;
          color: #666;
          font-family: "Arial", sans-serif;
          max-width: 420px;
          margin-left: auto;
          margin-right: auto;
          line-height: 1.6;
        }

        /* ── Card ── */
        .card {
          display: flex;
          border: 2px solid #111;
          border-radius: 16px;
          overflow: hidden;
          min-height: 320px;
        }

        /* ── Left ── */
        .card-left {
          flex: 1;
          padding: 40px 44px;
          display: flex;
          flex-direction: column;
          gap: 14px;
          background: #fff;
          min-width: 0;
        }

        .brand {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .brand-name {
          font-size: 1rem;
          font-weight: 600;
          color: #111;
          font-family: "Arial", sans-serif;
        }

        .badge {
          display: inline-block;
          background: #111;
          color: #fff;
          font-size: 0.72rem;
          font-weight: 600;
          padding: 4px 12px;
          border-radius: 999px;
          letter-spacing: 0.3px;
          width: fit-content;
          font-family: "Arial", sans-serif;
        }

        .card-title {
          font-size: 1.35rem;
          font-weight: 800;
          color: #111;
          line-height: 1.3;
          margin: 0;
          font-family: "Arial Black", "Arial", sans-serif;
        }

        .card-desc {
          font-size: 0.88rem;
          color: #555;
          line-height: 1.65;
          margin: 0;
          font-family: "Arial", sans-serif;
        }

        .card-link {
          font-size: 0.9rem;
          font-weight: 800;
          color: #111;
          text-decoration: none;
          display: inline-flex;
          align-items: center;
          gap: 4px;
          margin-top: auto;
          font-family: "Arial", sans-serif;
          border-bottom: 2px solid #111;
          padding-bottom: 1px;
          width: fit-content;
          transition: opacity 0.2s;
        }

        .card-link:hover {
          opacity: 0.6;
        }

        .arrow {
          font-size: 1rem;
        }

        /* ── Right — real preview ── */
        .card-right {
          flex: 1;
          min-width: 0;
          position: relative;
          background: #f0eeec;
          border-left: 2px solid #111;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 28px;
        }

        .preview-card {
          width: 100%;
          max-width: 280px;
          background: #fff;
          border: 1.5px solid #111;
          border-radius: 14px;
          padding: 20px;
          box-shadow: 4px 4px 0px rgba(17,17,17,0.08);
        }

        .preview-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 14px;
        }

        .preview-name {
          font-size: 0.78rem;
          font-weight: 700;
          color: #111;
          font-family: "Arial", sans-serif;
        }

        .preview-band {
          font-size: 0.65rem;
          font-weight: 700;
          color: #92400E;
          background: #FEF3C7;
          padding: 3px 9px;
          border-radius: 999px;
          font-family: "Arial", sans-serif;
        }

        .preview-score-row {
          display: flex;
          align-items: baseline;
          gap: 2px;
        }

        .preview-score {
          font-size: 2.4rem;
          font-weight: 900;
          color: #111;
          font-family: "Arial Black", "Arial", sans-serif;
          line-height: 1;
        }

        .preview-score-max {
          font-size: 1rem;
          color: #999;
          font-weight: 700;
          font-family: "Arial", sans-serif;
        }

        .preview-score-label {
          font-size: 0.7rem;
          color: #999;
          font-family: "Arial", sans-serif;
          margin: 2px 0 16px;
        }

        .preview-bars {
          display: flex;
          flex-direction: column;
          gap: 9px;
          margin-bottom: 14px;
        }

        .preview-bar-row {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .preview-bar-label {
          font-size: 0.65rem;
          color: #555;
          font-family: "Arial", sans-serif;
          width: 84px;
          flex-shrink: 0;
        }

        .preview-bar-track {
          flex: 1;
          height: 6px;
          background: #F0F0EB;
          border-radius: 999px;
          overflow: hidden;
        }

        .preview-bar-fill {
          height: 100%;
          border-radius: 999px;
        }

        .preview-bar-value {
          font-size: 0.68rem;
          font-weight: 700;
          color: #111;
          font-family: "Arial", sans-serif;
          width: 20px;
          text-align: right;
          flex-shrink: 0;
        }

        .preview-footer {
          font-size: 0.65rem;
          color: #999;
          font-family: "Arial", sans-serif;
          margin: 0;
          padding-top: 10px;
          border-top: 1px solid #F0F0EB;
        }

        /* ── Responsive ── */
        @media (max-width: 640px) {
          .card {
            flex-direction: column;
          }

          .card-right {
            border-left: none;
            border-top: 2px solid #111;
            min-height: 200px;
          }

          .card-left {
            padding: 28px 24px;
          }
        }
      `}</style>
    </section>
  );
}