"use client";

const featuredPost = {
  category: "Interview Strategy",
  categoryColor: "#d1fae5",
  categoryText: "#065f46",
  title: "How to Answer 'Tell Me About Yourself' Without Sounding Scripted",
  excerpt:
    "Most candidates rehearse this answer until it sounds robotic. Here's a framework to structure it naturally — and why the first 30 seconds determine the interviewer's entire perception of you.",
  author: {
    name: "Aryan Mehta",
    role: "Ex-Google SDE · Interview Coach",
    avatar: "AM",
    avatarBg: "#4f46e5",
  },
  readTime: "6 min read",
  image: "/blog/featured.jpg", // replace with your image
  imageAlt: "Interview preparation",
};

const posts = [
  {
    id: 1,
    slug: "system-design-failures",
    category: "System Design",
    categoryColor: "#ede9fe",
    categoryText: "#5b21b6",
    title: "Why Candidates Fail System Design — Even When They Know the Answer",
    image: "/blog/system-design.jpg",
    readTime: "8 min",
  },
  {
    id: 2,
    slug: "star-method-overrated",
    category: "Behavioural",
    categoryColor: "#fef3c7",
    categoryText: "#92400e",
    title: "The STAR Method Is Overrated. Here's What Actually Works.",
    image: "/blog/behavioural.jpg",
    readTime: "5 min",
  },
  {
    id: 3,
    slug: "mock-interview-not-working",
    category: "Mock Tips",
    categoryColor: "#fee2e2",
    categoryText: "#991b1b",
    title: "5 Signs Your Mock Interview Practice Isn't Translating to Real Results",
    image: "/blog/mock-tips.jpg",
    readTime: "4 min",
  },
];

function Avatar({ initials, bg }: { initials: string; bg: string }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 36,
        height: 36,
        borderRadius: "50%",
        background: bg,
        color: "#fff",
        fontSize: "0.75rem",
        fontWeight: 700,
        flexShrink: 0,
        fontFamily: "inherit",
      }}
    >
      {initials}
    </span>
  );
}

function CategoryBadge({
  label,
  bg,
  color,
}: {
  label: string;
  bg: string;
  color: string;
}) {
  return (
    <span
      style={{
        display: "inline-block",
        background: bg,
        color,
        fontSize: "0.68rem",
        fontWeight: 700,
        letterSpacing: "0.5px",
        padding: "4px 10px",
        borderRadius: 999,
        fontFamily: "inherit",
      }}
    >
      {label}
    </span>
  );
}

export default function BlogSection() {
  return (
    <section className="blog-root">
      <div className="blog-inner">
        {/* Heading */}
        <div className="blog-heading">
          <p className="blog-eyebrow">From the Prep Room</p>
          <h2 className="blog-title">
            Insights & Strategies for<br />
            <span className="blog-title-accent">Cracking Your Next Interview</span>
          </h2>
          <p className="blog-subtitle">
            Real tactics, honest breakdowns, and AI-backed research — so every
            mock session you do becomes smarter than the last.
          </p>
        </div>

        {/* Featured */}
        <div className="featured-card">
          <div className="featured-image-wrap">
            {/* Replace with <Image> when you have assets */}
            <div className="featured-image-placeholder">
              <span className="placeholder-icon">📝</span>
            </div>
          </div>
          <div className="featured-content">
            <CategoryBadge
              label={featuredPost.category}
              bg={featuredPost.categoryColor}
              color={featuredPost.categoryText}
            />
            <h3 className="featured-title">{featuredPost.title}</h3>
            <p className="featured-excerpt">{featuredPost.excerpt}</p>

            <div className="featured-footer">
              <div className="author-row">
                <Avatar
                  initials={featuredPost.author.avatar}
                  bg={featuredPost.author.avatarBg}
                />
                <div className="author-info">
                  <span className="author-name">{featuredPost.author.name}</span>
                  <span className="author-role">{featuredPost.author.role}</span>
                </div>
              </div>
              <a href="/blog/tell-me-about-yourself" className="read-link">
                Read article →
              </a>
            </div>
          </div>
        </div>

        {/* Three cards */}
        <div className="posts-grid">
          {posts.map((p) => (
            <a href={`/blog/${p.slug}`} className="post-card" key={p.id}>
              <div className="post-image-wrap">
                {/* Replace with <Image> when you have assets */}
                <div className="post-image-placeholder">
                  <span className="post-placeholder-icon">
                    {p.id === 1 ? "🏗️" : p.id === 2 ? "🎭" : "📊"}
                  </span>
                </div>
                <span
                  className="post-category-badge"
                  style={{ background: p.categoryColor, color: p.categoryText }}
                >
                  {p.category}
                </span>
              </div>
              <div className="post-meta">
                <span className="post-readtime">{p.readTime} read</span>
              </div>
              <h4 className="post-title">{p.title}</h4>
              <span className="post-arrow">→</span>
            </a>
          ))}
        </div>

        {/* View all */}
        <div className="blog-footer">
          <a href="/blog" className="view-all-btn">
            View all articles
          </a>
        </div>
      </div>

      <style jsx>{`
        @import url('https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,600;0,700;1,600&family=DM+Sans:wght@400;500;600&display=swap');

        .blog-root {
          background: #fafaf8;
          padding: 88px 24px 80px;
          font-family: 'DM Sans', sans-serif;
        }

        .blog-inner {
          max-width: 980px;
          margin: 0 auto;
        }

        /* Heading */
        .blog-heading {
          text-align: center;
          margin-bottom: 56px;
        }

        .blog-eyebrow {
          font-size: 0.72rem;
          font-weight: 600;
          letter-spacing: 2.5px;
          text-transform: uppercase;
          color: #6b7280;
          margin: 0 0 14px;
        }

        .blog-title {
          font-family: 'Lora', serif;
          font-size: clamp(1.9rem, 4.5vw, 2.75rem);
          font-weight: 700;
          color: #111;
          line-height: 1.2;
          margin: 0 0 16px;
        }

        .blog-title-accent {
          color: #1d4ed8;
        }

        .blog-subtitle {
          font-size: 0.95rem;
          color: #6b7280;
          max-width: 520px;
          margin: 0 auto;
          line-height: 1.7;
        }

        /* Featured card */
        .featured-card {
          display: flex;
          border-radius: 16px;
          overflow: hidden;
          border: 1.5px solid #e5e7eb;
          margin-bottom: 28px;
          background: #fff;
          box-shadow: 0 2px 24px rgba(0,0,0,0.06);
          transition: box-shadow 0.25s;
        }

        .featured-card:hover {
          box-shadow: 0 8px 40px rgba(0,0,0,0.1);
        }

        .featured-image-wrap {
          flex: 0 0 44%;
          min-height: 340px;
          position: relative;
          background: #e0e7ff;
          overflow: hidden;
        }

        .featured-image-placeholder {
          width: 100%;
          height: 100%;
          min-height: 340px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, #dbeafe 0%, #ede9fe 100%);
        }

        .placeholder-icon {
          font-size: 3.5rem;
          opacity: 0.5;
        }

        .featured-content {
          flex: 1;
          padding: 40px 40px 36px;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .featured-title {
          font-family: 'Lora', serif;
          font-size: 1.45rem;
          font-weight: 700;
          color: #111;
          margin: 0;
          line-height: 1.35;
        }

        .featured-excerpt {
          font-size: 0.9rem;
          color: #6b7280;
          line-height: 1.7;
          margin: 0;
          flex: 1;
        }

        .featured-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-top: auto;
          padding-top: 20px;
          border-top: 1px solid #f3f4f6;
        }

        .author-row {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .author-info {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .author-name {
          font-size: 0.85rem;
          font-weight: 600;
          color: #111;
        }

        .author-role {
          font-size: 0.75rem;
          color: #9ca3af;
        }

        .read-link {
          font-size: 0.85rem;
          font-weight: 600;
          color: #1d4ed8;
          text-decoration: none;
          border-bottom: 1.5px solid #1d4ed8;
          padding-bottom: 1px;
          transition: opacity 0.2s;
        }

        .read-link:hover {
          opacity: 0.7;
        }

        /* 3-post grid */
        .posts-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 20px;
          margin-bottom: 48px;
        }

        .post-card {
          display: flex;
          flex-direction: column;
          border-radius: 12px;
          overflow: hidden;
          border: 1.5px solid #e5e7eb;
          background: #fff;
          text-decoration: none;
          transition: transform 0.22s ease, box-shadow 0.22s ease;
          padding-bottom: 20px;
        }

        .post-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 8px 32px rgba(0,0,0,0.09);
        }

        .post-image-wrap {
          position: relative;
          height: 180px;
          overflow: hidden;
        }

        .post-image-placeholder {
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #f3f4f6;
        }

        .post-placeholder-icon {
          font-size: 2.5rem;
          opacity: 0.45;
        }

        .post-category-badge {
          position: absolute;
          bottom: 12px;
          left: 14px;
          font-size: 0.66rem;
          font-weight: 700;
          letter-spacing: 0.3px;
          padding: 3px 10px;
          border-radius: 999px;
          font-family: 'DM Sans', sans-serif;
        }

        .post-meta {
          padding: 14px 18px 0;
        }

        .post-readtime {
          font-size: 0.72rem;
          color: #9ca3af;
          font-weight: 500;
        }

        .post-title {
          font-family: 'Lora', serif;
          font-size: 1rem;
          font-weight: 600;
          color: #111;
          line-height: 1.4;
          margin: 8px 18px 0;
          flex: 1;
        }

        .post-arrow {
          display: block;
          font-size: 1rem;
          color: #1d4ed8;
          margin: 12px 18px 0;
          font-weight: 600;
          transition: transform 0.2s;
        }

        .post-card:hover .post-arrow {
          transform: translateX(4px);
        }

        /* Footer */
        .blog-footer {
          text-align: center;
        }

        .view-all-btn {
          display: inline-block;
          padding: 13px 32px;
          border: 2px solid #111;
          border-radius: 8px;
          font-size: 0.9rem;
          font-weight: 600;
          color: #111;
          text-decoration: none;
          transition: background 0.2s, color 0.2s;
          letter-spacing: 0.2px;
        }

        .view-all-btn:hover {
          background: #111;
          color: #fff;
        }

        /* Responsive */
        @media (max-width: 768px) {
          .featured-card {
            flex-direction: column;
          }
          .featured-image-wrap {
            flex: none;
            min-height: 200px;
          }
          .featured-content {
            padding: 28px 24px;
          }
          .posts-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </section>
  );
}