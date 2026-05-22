import { createClient } from "@supabase/supabase-js";
import type { Metadata } from "next";
import Link from "next/link";
import BlogListRow from "@/components/BlogListRow";
import { loadReaderReactionsForGeneratedIds } from "@/lib/readerReactionVote";
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
  published_at: string; meta_description: string; mode: string;
}

const CAT_COL: Record<string,string> = {
  uap:"#00ff88", surveillance:"#ff3333", biotech:"#c94dff",
  finance:"#ffaa00", politics:"#ff6633", technology:"#00bb66",
};

export default async function BlogPage() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;

  let articles: Article[] = [];
  let reactionById: Awaited<ReturnType<typeof loadReaderReactionsForGeneratedIds>> = {};
  if (url && key) {
    try {
      const admin = createClient(url, key);
      const { data, error } = await admin
        .from("generated_articles")
        .select("id, title, slug, excerpt, category, tags, focus_keyword, published_at, meta_description, mode")
        .eq("status", "published")
        .order("published_at", { ascending: false })
        .limit(50);
      if (!error && data) {
        articles = data as Article[];
        if (articles.length > 0) {
          reactionById = await loadReaderReactionsForGeneratedIds(
            admin,
            articles.map((a) => a.id),
          );
        }
      }
    } catch {
      articles = [];
      reactionById = {};
    }
  }

  const FONT = "var(--font-share-tech-mono), monospace";
  const RAJ = "var(--font-raj), sans-serif";

  return (
    <div style={{ minHeight: "100vh", background: "#050c07", color: "#c8e8d0", fontFamily: FONT }}>
      <div className="scanline" />
      <style>{`
        .blog-list-row:hover {
          border-color: rgba(0, 255, 136, 0.45);
          background: rgba(0, 255, 136, 0.06);
        }
      `}</style>
      <div style={{ position: "relative", zIndex: 1 }}>
        <header
          className="ob-tracker-nav intel-page-nav"
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
          <div className="intel-page-nav-start" style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
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
          </div>
          <div className="intel-page-nav-divider" style={{ width: 1, height: 20, background: "#1a3320", flexShrink: 0 }} />
          <div className="intel-page-nav-brand" style={{ fontFamily: RAJ, fontSize: 14, fontWeight: 700, color: "#00ff88", letterSpacing: 2, flexShrink: 0 }}>THE THEORIST</div>
          <div className="intel-page-nav-divider" style={{ width: 1, height: 20, background: "#1a3320", flexShrink: 0 }} />
          <div className="intel-page-nav-section" style={{ fontFamily: FONT, fontSize: 10, color: "#5a8068", letterSpacing: 2 }}>ANALYSIS INDEX</div>
          <div className="ob-nav-time intel-page-nav-meta" style={{ marginLeft: "auto", fontSize: 9, color: "#3a5040", letterSpacing: 1 }}>
            {articles.length} REPORTS
          </div>
        </header>

        <div
          style={{
            ...pageContentShellStyle({
              padding: "1.75rem clamp(1rem, 3vw, 2rem) 5rem",
            }),
          }}
        >
          <div style={{ marginBottom: "1.5rem", paddingBottom: "1rem", borderBottom: "1px solid #1a3320" }}>
            <div className="page-hero-kicker" style={{ fontFamily: RAJ, fontSize: 10, letterSpacing: 5, color: "#5a8068", marginBottom: 8, textTransform: "uppercase" }}>■ INVESTIGATION REPORTS ■</div>
            <h1 className="page-hero-title" style={{ fontFamily: RAJ, fontSize: 28, fontWeight: 700, color: "#00ff88", letterSpacing: 2, margin: "0 0 8px", lineHeight: 1.28 }}>Deep-Dive Analysis</h1>
            <p className="page-hero-tagline" style={{ fontFamily: FONT, fontSize: 12, color: "#5a8068", letterSpacing: 0.5, margin: 0, lineHeight: 1.65 }}>AI-generated investigation reports on conspiracy theories, declassified programs, and hidden agendas.</p>
          </div>

          {articles.length === 0 && (
            <div style={{ textAlign: "center", padding: "4rem 0", color: "#3a5040", fontSize: 11, letterSpacing: 2 }}>
              NO ARTICLES YET — FIRST GENERATION PENDING
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {articles.map((a) => {
              const col = CAT_COL[a.category] ?? "#5a8068";
              return (
                <BlogListRow
                  key={a.id}
                  slug={a.slug}
                  generatedArticleId={a.id}
                  initialReaction={reactionById[a.id]}
                  category={a.category}
                  categoryColor={col}
                  publishedAt={a.published_at}
                  title={a.title}
                  excerpt={a.excerpt}
                  tags={a.tags ?? []}
                  mode={a.mode}
                />
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
