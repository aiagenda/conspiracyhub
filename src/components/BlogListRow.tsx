"use client";

import Link from "next/link";
import ReaderReactionVote from "@/components/ReaderReactionVote";
import type { ReaderReactionStats } from "@/lib/readerReactionVote";

const FONT = "var(--font-share-tech-mono), monospace";
const RAJ = "var(--font-raj), sans-serif";

function timeAgo(d: string) {
  const diff = Date.now() - new Date(d).getTime();
  const h = Math.floor(diff / 3600000);
  if (h < 1) return "just now";
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function BlogListRow({
  slug,
  generatedArticleId,
  initialReaction,
  category,
  categoryColor,
  publishedAt,
  title,
  excerpt,
  tags,
  mode,
}: {
  slug: string;
  generatedArticleId: string;
  initialReaction?: ReaderReactionStats;
  category: string;
  categoryColor: string;
  publishedAt: string;
  title: string;
  excerpt: string;
  tags: string[];
  mode?: string;
}) {
  const isLore = mode === "lore_dossier";
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "row",
        alignItems: "stretch",
        border: "1px solid #1a3320",
        borderRadius: 4,
        background: "#090f0b",
        overflow: "hidden",
        transition: "border-color 0.15s, background 0.15s",
      }}
      className="blog-list-row"
    >
      <ReaderReactionVote generatedArticleId={generatedArticleId} initial={initialReaction} relevanceScore={60} />
      <Link href={`/blog/${slug}`} style={{ flex: 1, minWidth: 0, textDecoration: "none", color: "inherit" }}>
        <div
          style={{
            padding: "16px 18px",
            height: "100%",
            cursor: "pointer",
          }}
          className="blog-card-inner"
        >
          <div style={{ display: "flex", gap: 8, marginBottom: 8, alignItems: "center", flexWrap: "wrap" }}>
            <span
              style={{
                fontSize: 9,
                color: isLore ? "#c94dff" : categoryColor,
                border: `1px solid ${isLore ? "#c94dff" : categoryColor}`,
                padding: "1px 7px",
                borderRadius: 2,
                letterSpacing: 1,
                textTransform: "uppercase",
              }}
            >
              {isLore ? "hypothesis" : category}
            </span>
            {isLore && (
              <span style={{ fontSize: 9, color: "#7a3a9a", border: "1px solid #3a1a4a", padding: "1px 7px", borderRadius: 2, letterSpacing: 1, textTransform: "uppercase" }}>
                speculative
              </span>
            )}
            <span style={{ fontSize: 9, color: "#3a5040", letterSpacing: 1 }}>{timeAgo(publishedAt)}</span>
            <span style={{ fontSize: 9, color: isLore ? "#3a1a4a" : "#2a4030", letterSpacing: 1, marginLeft: "auto" }}>
              {isLore ? "◈ DOSSIER" : "◈ AI ANALYSIS"}
            </span>
          </div>
          <h2 style={{ fontFamily: RAJ, fontSize: 18, fontWeight: 700, color: "#e8ffe8", lineHeight: 1.28, margin: "0 0 8px" }}>
            {title}
          </h2>
          <p style={{ fontFamily: FONT, fontSize: 12, color: "#5a8068", lineHeight: 1.65, margin: "0 0 10px" }}>{excerpt}</p>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {tags.slice(0, 4).map((t) => (
              <span key={t} style={{ fontSize: 8, color: "#2a4030", border: "1px solid #0d1a10", padding: "1px 6px", borderRadius: 2 }}>
                {t}
              </span>
            ))}
          </div>
        </div>
      </Link>
    </div>
  );
}
