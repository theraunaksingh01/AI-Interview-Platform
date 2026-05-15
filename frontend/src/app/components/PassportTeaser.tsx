import Image from "next/image";

export default function SkillPassport() {
  return (
    <section className="skill-passport-section">
      {/* Heading */}
      <div className="heading-wrapper">
        <h2 className="heading">
          Take a look at my{" "}
          <span className="heading-highlight">Skill Passport</span>
        </h2>
      </div>

      {/* Card */}
      <div className="card">
        {/* Left: Text content */}
        <div className="card-left">
          <div className="brand">
            {/* logo mark */}
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

          <span className="badge">Raunak Singh</span>

          <h3 className="card-title">Your Skill Verification</h3>

          <p className="card-desc">
            A comprehensive report detailing your performance across key skill dimensions, cheat risk analysis,
            and personalized coaching tips to help you improve and succeed in your interviews.  
          </p>

          <a href="#" className="card-link">
            Coming Soon <span className="arrow">→</span>
          </a>
        </div>

        {/* Right: Image placeholder */}
        <div className="card-right">
          <div className="image-placeholder">
            {/*
              Replace the content below with your <Image> once you have the asset:
              <Image src="/your-image.png" alt="Skill visual" fill style={{ objectFit: "cover" }} />
            */}
            <div className="placeholder-inner">
              <svg
                width="48"
                height="48"
                viewBox="0 0 48 48"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <rect
                  x="4"
                  y="8"
                  width="40"
                  height="32"
                  rx="3"
                  stroke="#aaa"
                  strokeWidth="2"
                />
                <circle cx="15" cy="19" r="4" stroke="#aaa" strokeWidth="2" />
                <path
                  d="M4 32 L14 22 L22 30 L30 22 L44 34"
                  stroke="#aaa"
                  strokeWidth="2"
                  strokeLinejoin="round"
                />
              </svg>
              <p className="placeholder-text">Your image goes here</p>
            </div>
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
          font-weight: 700;
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

        /* ── Right ── */
        .card-right {
          flex: 1;
          min-width: 0;
          position: relative;
          background: #f0eeec;
          border-left: 2px solid #111;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .image-placeholder {
          width: 100%;
          height: 100%;
          min-height: 260px;
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
        }

        .placeholder-inner {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
          opacity: 0.5;
        }

        .placeholder-text {
          font-size: 0.8rem;
          color: #777;
          font-family: "Arial", sans-serif;
          margin: 0;
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