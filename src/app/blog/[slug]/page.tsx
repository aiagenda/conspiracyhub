import { createClient } from "@supabase/supabase-js";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import ReactMarkdown from "react-markdown";
import { pageContentShellStyle } from "@/lib/pageShell";

export const revalidate = 86400;

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://the-theorist.com";

interface Article {
  id: string; title: string; slug: string; excerpt: string;
  content: string; category: string; tags: string[];
  focus_keyword: string; meta_description: string; secondary_keywords: string[];
  sources: Array<{title:string;url:string;description:string}>;
  published_at: string;
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const h = Math.floor(diff / 3600000);
  if (h < 1) return "just now";
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) return {};

  const admin = createClient(url, key);
  const { data } = await admin.from("generated_articles").select("title, meta_description, focus_keyword, secondary_keywords, tags, published_at, category").eq("slug", slug).eq("status","published").single();
  if (!data) return {};

  const canonicalUrl = `${SITE_URL}/blog/${slug}`;
  return {
    title: `${data.title} | The Theorist`,
    description: data.meta_description,
    keywords: [data.focus_keyword, ...(data.secondary_keywords ?? []), ...(data.tags ?? [])].join(", "),
    alternates: { canonical: canonicalUrl },
    openGraph: {
      type: "article",
      url: canonicalUrl,
      title: data.title,
      description: data.meta_description,
      publishedTime: data.published_at,
      section: data.category,
      siteName: "The Theorist",
    },
    twitter: {
      card: "summary",
      title: data.title,
      description: data.meta_description,
    },
  };
}

export default async function BlogArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) return notFound();

  const admin = createClient(url, key);
  const { data } = await admin.from("generated_articles").select("*").eq("slug", slug).eq("status","published").single();
  if (!data) return notFound();
  const article = data as Article;

  const FONT = "var(--font-share-tech-mono), monospace";
  const RAJ = "var(--font-raj), sans-serif";
  const CAT_COL: Record<string,string> = {
    uap:"#00ff88", surveillance:"#ff3333", biotech:"#c94dff",
    finance:"#ffaa00", politics:"#ff6633", technology:"#00bb66",
  };
  const col = CAT_COL[article.category] ?? "#5a8068";

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: article.title,
    description: article.meta_description,
    keywords: [article.focus_keyword, ...(article.secondary_keywords ?? [])].join(", "),
    datePublished: article.published_at,
    dateModified: article.published_at,
    url: `${SITE_URL}/blog/${slug}`,
    publisher: { "@type": "Organization", name: "The Theorist", url: SITE_URL },
    mainEntityOfPage: { "@type": "WebPage", "@id": `${SITE_URL}/blog/${slug}` },
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <div style={{ minHeight: "100vh", background: "#050c07", color: "#c8e8d0", fontFamily: FONT }}>
        <div className="scanline" />

        <div
          style={{
            position: "fixed",
            bottom: 20,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 50,
            display: "flex",
            alignItems: "center",
            gap: 0,
            background: "#090f0b",
            border: "1px solid #00bb66",
            borderRadius: 4,
            overflow: "hidden",
            boxShadow: "0 0 24px rgba(0,255,136,0.15)",
            animation: "blogBannerGlow 2.5s ease-in-out infinite",
          }}
        >
          <style>{`
            @keyframes blogBannerGlow { 0%,100%{box-shadow:0 0 16px rgba(0,255,136,0.12)} 50%{box-shadow:0 0 28px rgba(0,255,136,0.28)} }
          `}</style>
          <div style={{ background: "rgba(0,255,136,0.08)", padding: "10px 14px", display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#00ff88", display: "inline-block" }} />
            <span style={{ fontFamily: FONT, fontSize: 10, color: "#00bb66", letterSpacing: 2 }}>DEEP-DIVE ANALYSIS</span>
          </div>
          <Link
            href="/blog"
            style={{
              display: "block",
              padding: "10px 16px",
              background: "rgba(0,255,136,0.12)",
              borderLeft: "1px solid #00bb66",
              fontFamily: RAJ,
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: 2,
              color: "#00ff88",
              textDecoration: "none",
              textTransform: "uppercase",
            }}
          >
            ◈ MORE REPORTS ▶
          </Link>
          <Link
            href="/"
            style={{
              display: "block",
              padding: "10px 16px",
              background: "rgba(0,187,102,0.06)",
              borderLeft: "1px solid #1a3320",
              fontFamily: RAJ,
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: 2,
              color: "#00bb66",
              textDecoration: "none",
              textTransform: "uppercase",
            }}
          >
            ◈ OPEN FEED
          </Link>
        </div>

        <div style={{ position: "relative", zIndex: 1 }}>
          <div
            style={{
              height: 44,
              background: "#050c07",
              borderBottom: "1px solid #1a3320",
              display: "flex",
              alignItems: "center",
              padding: "0 16px",
              gap: 12,
            }}
          >
            <Link
              href="/"
              style={{
                fontSize: 10,
                color: "#5a8068",
                textDecoration: "none",
                letterSpacing: 2,
                border: "1px solid #1a3320",
                padding: "4px 10px",
                borderRadius: 3,
              }}
            >
              ← FEED
            </Link>
            <div style={{ width: 1, height: 20, background: "#1a3320" }} />
            <div style={{ fontFamily: RAJ, fontSize: 14, fontWeight: 700, color: "#00ff88", letterSpacing: 2 }}>THE THEORIST</div>
            <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
              <Link
                href="/blog"
                style={{
                  fontFamily: RAJ,
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: 2,
                  textTransform: "uppercase",
                  padding: "6px 14px",
                  borderRadius: 3,
                  border: "1px solid #00bb66",
                  color: "#00ff88",
                  textDecoration: "none",
                }}
              >
                ◈ ANALYSIS INDEX
              </Link>
            </div>
          </div>

          <div
            style={{
              ...pageContentShellStyle({
                padding: "1.75rem clamp(1rem, 3vw, 2rem) 6rem",
              }),
            }}
          >
            <header style={{ marginBottom: "1.5rem" }}>
              <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 10, flexWrap: "wrap" }}>
                <Link
                  href="/blog"
                  style={{
                    fontSize: 10,
                    color: "#c94dff",
                    letterSpacing: 2,
                    textTransform: "uppercase",
                    textDecoration: "none",
                    borderBottom: "1px solid transparent",
                  }}
                >
                  ANALYSIS
                </Link>
                <span style={{ fontSize: 10, color: "#3a5040" }}>/</span>
                <span style={{ fontSize: 10, color: "#5a8068", letterSpacing: 2, textTransform: "uppercase" }}>{article.category}</span>
                <span style={{ fontSize: 10, color: "#3a5040", letterSpacing: 1 }}>{timeAgo(article.published_at)}</span>
                <span
                  style={{
                    fontSize: 11,
                    color: col,
                    border: `1px solid ${col}`,
                    padding: "1px 7px",
                    borderRadius: 2,
                    fontFamily: RAJ,
                    fontWeight: 700,
                    letterSpacing: 1,
                  }}
                >
                  ◈ AI INVESTIGATION
                </span>
              </div>
              <h1 style={{ fontFamily: RAJ, fontSize: 30, fontWeight: 700, color: "#e8ffe8", lineHeight: 1.28, margin: "0 0 12px" }}>{article.title}</h1>
              {article.excerpt ? (
                <div style={{ padding: "8px 12px", borderLeft: "2px solid #1a3320", fontSize: 14, color: "#5a8068", lineHeight: 1.65 }}>
                  <span style={{ color: "#00bb66" }}>▸ </span>
                  {article.excerpt}
                </div>
              ) : null}
              {article.tags?.length ? (
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 12 }}>
                  {article.tags.map((t) => (
                    <span
                      key={t}
                      style={{
                        fontSize: 10,
                        color: "#3a5040",
                        border: "1px solid #0d1a10",
                        padding: "2px 7px",
                        borderRadius: 2,
                      }}
                    >
                      {t}
                    </span>
                  ))}
                </div>
              ) : null}
            </header>

            <article>
              <style>{`
              .blog-content h2{font-family:var(--font-raj),sans-serif;font-size:20px;font-weight:700;color:#00ff88;letter-spacing:1px;margin:2rem 0 0.75rem;border-bottom:1px solid #1a3320;padding-bottom:8px;}
              .blog-content h3{font-family:var(--font-raj),sans-serif;font-size:16px;font-weight:700;color:#c8e8d0;letter-spacing:1px;margin:1.5rem 0 0.5rem;}
              .blog-content p{font-family:var(--font-share-tech-mono),monospace;font-size:15px;color:#c8e8d0;line-height:1.85;margin:0 0 1.1rem;}
              .blog-content strong{color:#00ff88;font-weight:bold;}
              .blog-content a{color:#00bb66;text-decoration:underline;}
              .blog-content ul,.blog-content ol{margin:0 0 1.1rem 0;padding-left:1.5rem;}
              .blog-content li{font-family:var(--font-share-tech-mono),monospace;font-size:15px;color:#c8e8d0;line-height:1.8;margin-bottom:6px;}
              .blog-content blockquote{border-left:2px solid #00bb66;margin:1.5rem 0;padding:0 0 0 1rem;}
              .blog-content blockquote p{color:#7aaa8a;font-style:italic;}
              .blog-content hr{border:none;border-top:1px solid #1a3320;margin:2rem 0;}
            `}</style>
              <div className="blog-content" style={{ marginBottom: "1.5rem" }}>
                <ReactMarkdown>{article.content}</ReactMarkdown>
              </div>
            </article>

            {article.sources?.length > 0 && (
              <div style={{ marginTop: "1.5rem", paddingTop: "1.5rem", borderTop: "1px solid #1a3320" }}>
                <div
                  style={{
                    fontFamily: RAJ,
                    fontSize: 11,
                    fontWeight: 700,
                    color: "#5a8068",
                    letterSpacing: 2,
                    marginBottom: 12,
                    textTransform: "uppercase",
                  }}
                >
                  ◈ Sources & References
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {article.sources.map((s, i) => (
                    <a
                      key={i}
                      href={s.url}
                      target="_blank"
                      rel="noreferrer"
                      style={{
                        display: "flex",
                        gap: 10,
                        color: "#00bb66",
                        fontSize: 11,
                        textDecoration: "none",
                        padding: "8px 10px",
                        border: "1px solid #1a3320",
                        borderRadius: 3,
                        background: "#090f0b",
                      }}
                    >
                      <span style={{ flexShrink: 0 }}>↗</span>
                      <div>
                        <div style={{ fontFamily: RAJ, fontWeight: 700, marginBottom: 2 }}>{s.title}</div>
                        <div style={{ fontSize: 10, color: "#5a8068" }}>{s.description}</div>
                      </div>
                    </a>
                  ))}
                </div>
              </div>
            )}

            <div style={{ marginTop: "1.5rem", display: "flex", flexDirection: "column", gap: 10 }}>
              <Link
                href="/"
                style={{
                  display: "block",
                  padding: "14px",
                  border: "1px solid #00bb66",
                  borderRadius: 4,
                  textAlign: "center",
                  textDecoration: "none",
                  background: "rgba(0,255,136,0.04)",
                }}
              >
                <div style={{ fontFamily: RAJ, fontSize: 14, fontWeight: 700, color: "#00ff88", letterSpacing: 3, marginBottom: 4 }}>
                  ◈ OPEN INVESTIGATION FEED ▶
                </div>
                <div style={{ fontSize: 10, color: "#5a8068", letterSpacing: 1 }}>
                  AI-scored articles · threat levels · live signals
                </div>
              </Link>
              <Link
                href="/blog"
                style={{
                  display: "block",
                  padding: "12px 14px",
                  border: "1px solid #1a3320",
                  borderRadius: 4,
                  textAlign: "center",
                  textDecoration: "none",
                  background: "#090f0b",
                }}
              >
                <div style={{ fontFamily: RAJ, fontSize: 13, fontWeight: 700, color: "#c94dff", letterSpacing: 2, marginBottom: 3 }}>
                  ▸ BACK TO ANALYSIS INDEX
                </div>
                <div style={{ fontSize: 10, color: "#5a8068", letterSpacing: 1 }}>More deep-dive reports</div>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
