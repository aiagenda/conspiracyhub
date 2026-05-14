import { createClient } from "@supabase/supabase-js";
import type { Metadata } from "next";
import Link from "next/link";
import { pageContentShellStyle } from "@/lib/pageShell";

/** Fresh list within a minute; new posts also trigger revalidatePath from generateArticleCore. */
export const revalidate = 60;

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://the-theorist.com";

export const metadata: Metadata = {
  title: "Investigation Reports — The Theorist",
  description: "AI-generated deep-dive investigation reports on conspiracy theories, government cover-ups, UAP sightings, and declassified intelligence programs.",
  alternates: { canonical: `${SITE_URL}/blog` },
  openGraph: {
    title: "Investigation Reports — The Theorist",
    description: "Deep-dive conspiracy investigation reports powered by AI.",
    url: `${SITE_URL}/blog`,
  },
};

interface Article {
  id: string; title: string; slug: string; excerpt: string;
  category: string; tags: string[]; focus_keyword: string;
  published_at: string; meta_description: string;
}

const CAT_COL: Record<string,string> = {
  uap:"#00ff88", surveillance:"#ff3333", biotech:"#c94dff",
  finance:"#ffaa00", politics:"#ff6633", technology:"#00bb66",
};

function timeAgo(d: string) {
  const diff = Date.now() - new Date(d).getTime();
  const h = Math.floor(diff / 3600000);
  if (h < 1) return "just now";
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default async function BlogPage() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;

  let articles: Article[] = [];
  if (url && key) {
    try {
      const admin = createClient(url, key);
      const { data, error } = await admin
        .from("generated_articles")
        .select("id, title, slug, excerpt, category, tags, focus_keyword, published_at, meta_description")
        .eq("status", "published")
        .order("published_at", { ascending: false })
        .limit(50);
      if (!error && data) articles = data as Article[];
    } catch {
      articles = [];
    }
  }

  const FONT = "var(--font-share-tech-mono), monospace";
  const RAJ = "var(--font-raj), sans-serif";

  return (
    <div style={{ minHeight: "100vh", background: "#050c07", color: "#c8e8d0", fontFamily: FONT }}>
      <div className="scanline" />
      <style>{`
        .blog-card {
          border: 1px solid #1a3320;
          border-radius: 4px;
          padding: 16px 18px;
          background: #090f0b;
          transition: border-color 0.15s, background 0.15s;
          cursor: pointer;
        }
        .blog-card:hover {
          border-color: rgba(0, 255, 136, 0.45);
          background: rgba(0, 255, 136, 0.06);
        }
      `}</style>
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
          <div style={{ marginLeft: "auto", fontFamily: FONT, fontSize: 10, color: "#5a8068", letterSpacing: 2 }}>ANALYSIS INDEX</div>
        </div>

        <div
          style={{
            ...pageContentShellStyle({
              padding: "1.75rem clamp(1rem, 3vw, 2rem) 5rem",
            }),
          }}
        >
          <div style={{ marginBottom: "2rem", paddingBottom: "1rem", borderBottom: "1px solid #1a3320" }}>
            <div style={{ fontFamily: RAJ, fontSize: 10, letterSpacing: 5, color: "#5a8068", marginBottom: 10, textTransform: "uppercase" }}>■ INVESTIGATION REPORTS ■</div>
            <h1 style={{ fontFamily: RAJ, fontSize: 30, fontWeight: 700, color: "#00ff88", letterSpacing: 2, margin: "0 0 8px", lineHeight: 1.28 }}>Deep-Dive Analysis</h1>
            <p style={{ fontFamily: FONT, fontSize: 12, color: "#5a8068", letterSpacing: 0.5, margin: 0, lineHeight: 1.65 }}>AI-generated investigation reports on conspiracy theories, declassified programs, and hidden agendas.</p>
          </div>

          {articles.length === 0 && (
            <div style={{ textAlign: "center", padding: "4rem 0", color: "#3a5040", fontSize: 11, letterSpacing: 2 }}>
              NO ARTICLES YET — FIRST GENERATION PENDING
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {articles.map(a => {
              const col = CAT_COL[a.category] ?? "#5a8068";
              return (
                <Link key={a.id} href={`/blog/${a.slug}`} style={{ textDecoration: "none" }}>
                  <div className="blog-card">
                    <div style={{ display: "flex", gap: 8, marginBottom: 8, alignItems: "center" }}>
                      <span style={{ fontSize: 9, color: col, border: `1px solid ${col}`, padding: "1px 7px", borderRadius: 2, letterSpacing: 1, textTransform: "uppercase" }}>{a.category}</span>
                      <span style={{ fontSize: 9, color: "#3a5040", letterSpacing: 1 }}>{timeAgo(a.published_at)}</span>
                      <span style={{ fontSize: 9, color: "#2a4030", letterSpacing: 1, marginLeft: "auto" }}>◈ AI ANALYSIS</span>
                    </div>
                    <h2 style={{ fontFamily: RAJ, fontSize: 18, fontWeight: 700, color: "#e8ffe8", lineHeight: 1.28, margin: "0 0 8px" }}>{a.title}</h2>
                    <p style={{ fontFamily: FONT, fontSize: 12, color: "#5a8068", lineHeight: 1.65, margin: "0 0 10px" }}>{a.excerpt}</p>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {a.tags?.slice(0, 4).map(t => (
                        <span key={t} style={{ fontSize: 8, color: "#2a4030", border: "1px solid #0d1a10", padding: "1px 6px", borderRadius: 2 }}>{t}</span>
                      ))}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
