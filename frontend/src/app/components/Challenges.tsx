"use client";

const challenges = [
  {
    id: "01",
    color: "#FDE68A",
    icon: "🎯",
    title: "No Real Pressure Practice",
    desc: "Students practice in comfort zones. Real interviews have time pressure, silence, and follow-up probing. Most tools never simulate this — leaving candidates blindsided on the day.",
    tag: "Confidence Gap",
  },
  {
    id: "02",
    color: "#BAE6FD",
    icon: "🔁",
    title: "Generic Feedback Loops",
    desc: "You get a score. Maybe a rubric. But nobody tells you *why* your answer fell flat — or what pattern keeps repeating across your mocks. Feedback without diagnosis is noise.",
    tag: "Feedback Quality",
  },
  {
    id: "03",
    color: "#BBF7D0",
    icon: "📉",
    title: "Follow-up Collapse",
    desc: "Students memorise answers, not concepts. The moment an interviewer digs deeper — 'Why not X? What's your tradeoff?' — the answer crumbles. Nobody trains for depth.",
    tag: "Depth Problem",
  },
  {
    id: "04",
    color: "#FECACA",
    icon: "🧩",
    title: "No Personalised Weak-spot Tracking",
    desc: "Every session starts from scratch. Students don't know their recurring failure patterns — hedging on trade-offs, weak closing, poor structure — because no tool remembers them.",
    tag: "Progress Blindness",
  },
];

export default function ChallengesSection() {
  return (
    <section className="challenges-root">
      {/* Decorative dashed lines */}
      <div className="deco-line deco-line--h1" />
      <div className="deco-line deco-line--h2" />
      <div className="deco-line deco-line--v1" />
      <div className="deco-line deco-line--v2" />

      {/* Corner dots */}
      <span className="dot dot--tl" />
      <span className="dot dot--tr" />
      <span className="dot dot--bl" />
      <span className="dot dot--br" />

      <div className="challenges-inner">
        {/* Heading */}
        <div className="challenges-heading">
          <p className="challenges-eyebrow">Why Most Students Struggle</p>
          <h2 className="challenges-title">
            Common Challenges in<br />
            <em>Interview Preparation</em>
          </h2>
          <div className="title-underline" />
        </div>

        {/* Grid */}
        <div className="challenges-grid">
          {challenges.map((c, i) => (
            <div
              key={c.id}
              className="challenge-card"
              style={{
                "--card-bg": c.color,
                animationDelay: `${i * 0.1}s`,
              } as React.CSSProperties}
            >
              {/* Tape effect */}
              <span className="tape" />

              <div className="card-number">{c.id}</div>
              <div className="card-icon">{c.icon}</div>
              <span className="card-tag">{c.tag}</span>
              <h3 className="card-title">{c.title}</h3>
              <p className="card-desc">{c.desc}</p>
            </div>
          ))}
        </div>

        {/* Footer CTA */}
        <p className="challenges-cta">
          Transform your interview prep with AI that remembers, adapts, and
          coaches — not just scores.
        </p>
      </div>

      <style jsx>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;0,900;1,700&family=DM+Sans:wght@400;500;600&display=swap');

        .challenges-root {
          position: relative;
          background-color: #c0522a;
          background-image:
            radial-gradient(circle at 20% 50%, #b84a22 0%, transparent 50%),
            radial-gradient(circle at 80% 20%, #d4652f 0%, transparent 40%);
          padding: 80px 24px 72px;
          overflow: hidden;
          font-family: 'DM Sans', sans-serif;
        }

        /* Decorative dashed grid lines */
        .deco-line {
          position: absolute;
          background: rgba(255, 255, 255, 0.08);
          pointer-events: none;
        }
        .deco-line--h1 { top: 30%; left: 0; right: 0; height: 1px; }
        .deco-line--h2 { top: 70%; left: 0; right: 0; height: 1px; }
        .deco-line--v1 { left: 30%; top: 0; bottom: 0; width: 1px; }
        .deco-line--v2 { left: 70%; top: 0; bottom: 0; width: 1px; }

        .dot {
          position: absolute;
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: rgba(255,255,255,0.25);
        }
        .dot--tl { top: 24px; left: 24px; }
        .dot--tr { top: 24px; right: 24px; }
        .dot--bl { bottom: 24px; left: 24px; }
        .dot--br { bottom: 24px; right: 24px; }

        .challenges-inner {
          max-width: 960px;
          margin: 0 auto;
          position: relative;
          z-index: 1;
        }

        /* Heading */
        .challenges-heading {
          text-align: center;
          margin-bottom: 52px;
        }

        .challenges-eyebrow {
          font-size: 0.75rem;
          font-weight: 600;
          letter-spacing: 2.5px;
          text-transform: uppercase;
          color: rgba(255,255,255,0.6);
          margin: 0 0 12px;
        }

        .challenges-title {
          font-family: 'Playfair Display', serif;
          font-size: clamp(2rem, 5vw, 3rem);
          font-weight: 900;
          color: #fff;
          line-height: 1.2;
          margin: 0 0 16px;
        }

        .challenges-title em {
          font-style: italic;
          color: #fde68a;
        }

        .title-underline {
          width: 64px;
          height: 3px;
          background: #fde68a;
          margin: 0 auto;
          border-radius: 2px;
        }

        /* Grid */
        .challenges-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 24px;
        }

        /* Card */
        .challenge-card {
          background: var(--card-bg, #fde68a);
          border-radius: 12px;
          padding: 28px 28px 32px;
          position: relative;
          box-shadow:
            4px 4px 0px rgba(0,0,0,0.15),
            0 8px 32px rgba(0,0,0,0.12);
          transform: rotate(0deg);
          transition: transform 0.25s ease, box-shadow 0.25s ease;
          animation: cardIn 0.5s ease both;
        }

        .challenge-card:nth-child(1) { transform: rotate(-1.2deg); }
        .challenge-card:nth-child(2) { transform: rotate(0.8deg); }
        .challenge-card:nth-child(3) { transform: rotate(1deg); }
        .challenge-card:nth-child(4) { transform: rotate(-0.6deg); }

        .challenge-card:hover {
          transform: rotate(0deg) translateY(-4px) !important;
          box-shadow: 6px 10px 40px rgba(0,0,0,0.2);
        }

        @keyframes cardIn {
          from { opacity: 0; transform: translateY(20px) rotate(0deg); }
          to { opacity: 1; }
        }

        /* Tape */
        .tape {
          position: absolute;
          top: -10px;
          left: 50%;
          transform: translateX(-50%);
          width: 48px;
          height: 20px;
          background: rgba(255,255,255,0.55);
          border-radius: 2px;
          box-shadow: 0 1px 4px rgba(0,0,0,0.1);
        }

        .card-number {
          font-size: 0.7rem;
          font-weight: 700;
          letter-spacing: 1.5px;
          color: rgba(0,0,0,0.35);
          margin-bottom: 12px;
          font-family: 'DM Sans', sans-serif;
        }

        .card-icon {
          font-size: 2rem;
          margin-bottom: 10px;
          line-height: 1;
        }

        .card-tag {
          display: inline-block;
          font-size: 0.68rem;
          font-weight: 700;
          letter-spacing: 1px;
          text-transform: uppercase;
          background: rgba(0,0,0,0.1);
          color: rgba(0,0,0,0.65);
          padding: 3px 10px;
          border-radius: 999px;
          margin-bottom: 10px;
        }

        .card-title {
          font-family: 'Playfair Display', serif;
          font-size: 1.15rem;
          font-weight: 700;
          color: #111;
          margin: 0 0 10px;
          line-height: 1.3;
        }

        .card-desc {
          font-size: 0.85rem;
          color: rgba(0,0,0,0.65);
          line-height: 1.65;
          margin: 0;
        }

        /* CTA */
        .challenges-cta {
          text-align: center;
          margin-top: 52px;
          font-size: 0.92rem;
          color: rgba(255,255,255,0.75);
          max-width: 520px;
          margin-left: auto;
          margin-right: auto;
          line-height: 1.7;
        }

        /* Responsive */
        @media (max-width: 600px) {
          .challenges-grid {
            grid-template-columns: 1fr;
          }
          .challenge-card:nth-child(n) {
            transform: rotate(0deg);
          }
        }
      `}</style>
    </section>
  );
}