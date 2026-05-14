import { createClient } from "@supabase/supabase-js";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import ReactMarkdown from "react-markdown";

export const revalidate = 86400;

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://the-theorist.com";

interface Article {
  id: string; title: string; slug: string; excerpt: string;
  content: string; category: string; tags: string[];
  focus_keyword: string; meta_description: string; secondary_keywords: string[];
  sources: Array<{title:string;url:string;description:string}>;
  published_at: string;
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

  const FONT = "'Share Tech Mono', monospace";
  const RAJ = "'Rajdhani', sans-serif";
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
        <div style={{ maxWidth: 720, margin: "0 auto", padding: "2rem 1.25rem 5rem" }}>

          {/* Breadcrumb */}
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: "2rem", fontSize: 10, color: "#3a5040" }}>
            <Link href="/" style={{ color: "#5a8068", textDecoration: "none" }}>FEED</Link>
            <span>/</span>
            <Link href="/blog" style={{ color: "#c94dff", textDecoration: "none" }}>ANALYSIS</Link>
            <span>/</span>
            <span style={{ color: col }}>{article.category.toUpperCase()}</span>
          </div>

          {/* Header */}
          <header style={{ marginBottom: "2.5rem", paddingBottom: "1.5rem", borderBottom: "1px solid #1a3320" }}>
            <div style={{ display: "flex", gap: 8, marginBottom: 12, alignItems: "center" }}>
              <span style={{ fontSize: 9, color: col, border: `1px solid ${col}`, padding: "2px 8px", borderRadius: 2, letterSpacing: 1 }}>{article.category.toUpperCase()}</span>
              <span style={{ fontSize: 9, color: "#3a5040" }}>{new Date(article.published_at).toLocaleDateString("en-US", { year:"numeric", month:"long", day:"numeric" })}</span>
              <span style={{ fontSize: 9, color: "#2a4030", marginLeft: "auto" }}>◈ AI INVESTIGATION</span>
            </div>
            <h1 style={{ fontFamily: RAJ, fontSize: 36, fontWeight: 700, color: "#e8ffe8", lineHeight: 1.15, margin: "0 0 14px" }}>{article.title}</h1>
            <p style={{ fontSize: 13, color: "#7aaa8a", lineHeight: 1.75, margin: "0 0 16px" }}>{article.excerpt}</p>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {article.tags?.map(t => <span key={t} style={{ fontSize: 9, color: "#3a5040", border: "1px solid #0d1a10", padding: "2px 7px", borderRadius: 2 }}>{t}</span>)}
            </div>
          </header>

          {/* Content */}
          <article>
            <style>{`
              .blog-content h2{font-family:'Rajdhani',sans-serif;font-size:22px;font-weight:700;color:#00ff88;letter-spacing:1px;margin:2rem 0 0.75rem;border-bottom:1px solid #1a3320;padding-bottom:8px;}
              .blog-content h3{font-family:'Rajdhani',sans-serif;font-size:17px;font-weight:700;color:#c8e8d0;letter-spacing:1px;margin:1.5rem 0 0.5rem;}
              .blog-content p{font-family:'Share Tech Mono',monospace;font-size:12px;color:#c8e8d0;line-height:1.9;margin:0 0 1.25rem;}
              .blog-content strong{color:#00ff88;font-weight:bold;}
              .blog-content a{color:#00bb66;text-decoration:underline;}
              .blog-content ul,ol{margin:0 0 1.25rem 0;padding-left:1.5rem;}
              .blog-content li{font-family:'Share Tech Mono',monospace;font-size:12px;color:#c8e8d0;line-height:1.8;margin-bottom:6px;}
              .blog-content blockquote{border-left:2px solid #00bb66;margin:1.5rem 0;padding:0 0 0 1rem;}
              .blog-content blockquote p{color:#7aaa8a;font-style:italic;}
              .blog-content hr{border:none;border-top:1px solid #1a3320;margin:2rem 0;}
            `}</style>
            <div className="blog-content">
              <ReactMarkdown>{article.content}</ReactMarkdown>
            </div>
          </article>

          {/* Sources */}
          {article.sources?.length > 0 && (
            <div style={{ marginTop: "2.5rem", paddingTop: "1.5rem", borderTop: "1px solid #1a3320" }}>
              <div style={{ fontFamily: RAJ, fontSize: 11, fontWeight: 700, color: "#5a8068", letterSpacing: 2, marginBottom: 12, textTransform: "uppercase" }}>◈ Sources & References</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {article.sources.map((s, i) => (
                  <a key={i} href={s.url} target="_blank" rel="noreferrer"
                    style={{ display: "flex", gap: 10, color: "#00bb66", fontSize: 11, textDecoration: "none", padding: "8px 10px", border: "1px solid rgba(0,187,102,0.2)", borderRadius: 3, background: "rgba(0,187,102,0.03)" }}>
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

          {/* CTA */}
          <div style={{ marginTop: "2.5rem", padding: "1.5rem", background: "rgba(0,255,136,0.03)", border: "1px solid #00bb66", borderRadius: 4, textAlign: "center" }}>
            <div style={{ fontFamily: RAJ, fontSize: 14, fontWeight: 700, color: "#00ff88", letterSpacing: 2, marginBottom: 6 }}>◈ INVESTIGATE DEEPER</div>
            <div style={{ fontSize: 11, color: "#5a8068", marginBottom: 14 }}>Use our AI Investigation Board to explore connected patents, FOIA documents, and conspiracy theories.</div>
            <Link href="/" style={{ display: "inline-block", padding: "8px 24px", background: "transparent", border: "1px solid #00bb66", color: "#00ff88", fontFamily: RAJ, fontSize: 12, fontWeight: 700, letterSpacing: 2, textDecoration: "none" }}>
              OPEN THE THEORIST →
            </Link>
          </div>

        </div>
      </div>
    </>
  );
}
