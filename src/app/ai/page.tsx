import { createClient } from "@supabase/supabase-js";
import type { Metadata } from "next";
import Link from "next/link";
import BlogListRow from "@/components/BlogListRow";
import { loadReaderReactionsForGeneratedIds } from "@/lib/readerReactionVote";
import { pageContentShellStyle } from "@/lib/pageShell";

/** Fresh within a minute; publishing also triggers revalidatePath("/ai"). */
export const revalidate = 60;

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://the-theorist.com";

/** Cyan, not the feed's green — a visual signal that this desk is factual reporting. */
const ACCENT = "#00d4ff";

export const metadata: Metadata = {
  // Bare title: the root layout applies the "%s | The Theorist" template.
  title: "AI & Tech Analysis",
  description:
    "Original long-form analysis of artificial intelligence and technology: how the systems actually work, how they compare, and what changes next.",
  alternates: { canonical: `${SITE_URL}/ai` },
  openGraph: {
    title: "AI & Tech Analysis — The Theorist",
    description: "Original long-form AI and technology analysis.",
    url: `${SITE_URL}/ai`,
  },
};

interface Article {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  category: string;
  tags: string[];
  focus_keyword: string;
  published_at: string;
  meta_description: string;
  mode: string;
}

export default async function AiPage() {
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
        .eq("category", "ai")
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
          border-color: rgba(0, 212, 255, 0.45);
          background: rgba(0, 212, 255, 0.06);
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
          <div className="intel-page-nav-brand" style={{ fontFamily: RAJ, fontSize: 14, fontWeight: 700, color: ACCENT, letterSpacing: 2, flexShrink: 0 }}>
            THE THEORIST
          </div>
          <div className="intel-page-nav-divider" style={{ width: 1, height: 20, background: "#1a3320", flexShrink: 0 }} />
          <div className="intel-page-nav-section" style={{ fontFamily: FONT, fontSize: 10, color: "#5a8068", letterSpacing: 2 }}>AI &amp; TECH DESK</div>
          <div className="ob-nav-time intel-page-nav-meta" style={{ marginLeft: "auto", fontSize: 9, color: "#3a5040", letterSpacing: 1 }}>
            {articles.length} ARTICLES
          </div>
        </header>

        <div style={{ ...pageContentShellStyle({ padding: "1.75rem clamp(1rem, 3vw, 2rem) 5rem" }) }}>
          <div style={{ marginBottom: "1.5rem", paddingBottom: "1rem", borderBottom: "1px solid #1a3320" }}>
            <div className="page-hero-kicker" style={{ fontFamily: RAJ, fontSize: 10, letterSpacing: 5, color: "#5a8068", marginBottom: 8, textTransform: "uppercase" }}>
              ■ AI &amp; TECHNOLOGY ■
            </div>
            <h1 className="page-hero-title" style={{ fontFamily: RAJ, fontSize: 28, fontWeight: 700, color: ACCENT, letterSpacing: 2, margin: "0 0 8px", lineHeight: 1.28 }}>
              AI &amp; Tech Analysis
            </h1>
            <p className="page-hero-tagline" style={{ fontFamily: FONT, fontSize: 12, color: "#5a8068", letterSpacing: 0.5, margin: 0, lineHeight: 1.65 }}>
              Original long-form reporting on artificial intelligence and technology — how the systems
              actually work, how they compare, and what changes next. Sourced and cited, no speculation.
            </p>
          </div>

          {articles.length === 0 && (
            <div style={{ textAlign: "center", padding: "4rem 0", color: "#3a5040", fontSize: 11, letterSpacing: 2 }}>
              NO ARTICLES PUBLISHED YET
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {articles.map((a) => (
              <BlogListRow
                key={a.id}
                slug={a.slug}
                generatedArticleId={a.id}
                initialReaction={reactionById[a.id]}
                category={a.category}
                categoryColor={ACCENT}
                publishedAt={a.published_at}
                title={a.title}
                excerpt={a.excerpt}
                tags={a.tags ?? []}
                mode={a.mode}
              />
            ))}
          </div>

          <div
            style={{
              marginTop: "2.5rem",
              padding: "16px 18px",
              border: "1px solid #1a3320",
              borderRadius: 4,
              background: "rgba(0,212,255,0.04)",
            }}
          >
            <div style={{ fontFamily: RAJ, fontSize: 11, fontWeight: 700, color: ACCENT, letterSpacing: 2, marginBottom: 8 }}>
              ◈ BUILDER RESOURCES
            </div>
            <p style={{ fontFamily: FONT, fontSize: 12, color: "#7aaa8a", lineHeight: 1.75, margin: 0 }}>
              Curated GitHub repos, scrape stacks, OSINT pivots, and agent tooling —{" "}
              <Link href="/toolkit" style={{ color: ACCENT, textDecoration: "underline" }}>
                Investigator Toolkit →
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
