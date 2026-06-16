"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import LiveChat from "@/components/LiveChat";
import PolymarketWidget from "@/components/PolymarketWidget";
import VotePanel from "@/components/VotePanel";
import { markArticleRead } from "@/lib/readArticles";
import { trackContinueReading } from "@/lib/continueReading";
import { canOptimizeImage } from "@/lib/imageHosts";
import { pageContentShellStyle } from "@/lib/pageShell";
import { isLiveChatEnabled, SHOW_COMMUNITY } from "@/lib/featureFlags";
import type { VoteTheoryChip } from "@/lib/oracleVoteTheories";
import type { NewsItem } from "@/types";

const FONT = "var(--font-share-tech-mono), monospace";
const RAJ = "var(--font-raj), sans-serif";

type SourceRow = { title: string; url: string; description: string };

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const h = Math.floor(diff / 3600000);
  if (h < 1) return "just now";
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function buildPolymarketContext(item: NewsItem, markdown: string): string {
  const parts: string[] = [];
  if (item.summary?.trim()) parts.push(item.summary.trim());
  if (item.angle?.trim()) parts.push(item.angle.trim());
  const flat = markdown.replace(/\s+/g, " ").trim();
  if (flat) parts.push(flat.slice(0, 1200));
  return parts.join(" ").slice(0, 2200);
}

export default function GeneratedArticleReader({
  item,
  slug,
  markdown,
  sources = [],
  initialChatOpen = false,
  voteTheories = [],
  mode,
}: {
  item: NewsItem;
  slug: string;
  markdown: string;
  sources?: SourceRow[];
  initialChatOpen?: boolean;
  voteTheories?: VoteTheoryChip[];
  mode?: string;
}) {
  const isLore = mode === "lore_dossier";
  const liveChatEnabled = isLiveChatEnabled();
  const [chatOpen, setChatOpen] = useState(Boolean(initialChatOpen && liveChatEnabled));

  useEffect(() => {
    markArticleRead(item.id);
    trackContinueReading({
      generatedArticleId: item.id,
      title: item.title,
      path: `/blog/${slug}`,
      score: item.score,
    });
  }, [item.id, item.title, item.score, slug]);

  const chatActive = liveChatEnabled && chatOpen;
  const rootClass = `gar-root${chatActive ? " gar-chat-open" : ""}`;

  return (
    <div className={rootClass} style={{ minHeight: "100vh", background: "#050c07", color: "#c8e8d0", fontFamily: FONT }}>
      <div className="scanline" />

      <div
        className="gar-dock"
        style={{
          position: "fixed",
          bottom: 20,
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 50,
          display: "flex",
          alignItems: "stretch",
          gap: 0,
          background: "#090f0b",
          border: "1px solid #00bb66",
          borderRadius: 4,
          overflow: "hidden",
          boxShadow: "0 0 24px rgba(0,255,136,0.15)",
          animation: "genBannerGlow 2.5s ease-in-out infinite",
        }}
      >
        <div
          className="gar-dock-oracle"
          style={{ background: "rgba(0,255,136,0.08)", padding: "10px 14px", display: "flex", alignItems: "center", gap: 8 }}
        >
          <span
            style={{
              width: 7,
              height: 7,
              borderRadius: "50%",
              background: "#00ff88",
              display: "inline-block",
              animation: "genBannerDot 1.2s ease-in-out infinite",
            }}
          />
          <span style={{ fontFamily: FONT, fontSize: 10, color: "#00bb66", letterSpacing: 2 }}>ORACLE ANALYSIS READY</span>
        </div>
        <Link
          href={`/board/${item.id}`}
          prefetch={false}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
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
            transition: "background 0.15s",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLAnchorElement).style.background = "rgba(0,255,136,0.22)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLAnchorElement).style.background = "rgba(0,255,136,0.12)";
          }}
        >
          <span className="gar-dock-long">◈ OPEN INVESTIGATION BOARD ▶</span>
          <span className="gar-dock-short">◈ BOARD</span>
        </Link>
        {liveChatEnabled ? (
        <button
          type="button"
          onClick={() => setChatOpen((o) => !o)}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "10px 14px",
            background: chatOpen ? "rgba(0,187,102,0.2)" : "rgba(0,187,102,0.06)",
            borderLeft: "1px solid #1a3320",
            fontFamily: RAJ,
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: 2,
            color: "#00bb66",
            textTransform: "uppercase",
            transition: "background 0.15s",
            border: "none",
            cursor: "pointer",
          }}
        >
          {chatOpen ? (
            "✕ CLOSE"
          ) : (
            <>
              <span className="gar-dock-long">◈ LIVE CHAT</span>
              <span className="gar-dock-short">CHAT</span>
            </>
          )}
        </button>
        ) : null}
        <button
          type="button"
          onClick={() => window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" })}
          style={{
            padding: "10px 12px",
            background: "transparent",
            border: "none",
            borderLeft: "1px solid #1a3320",
            color: "#5a8068",
            fontFamily: FONT,
            fontSize: 10,
            cursor: "pointer",
            letterSpacing: 1,
            transition: "color 0.15s",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.color = "#00ff88";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.color = "#5a8068";
          }}
          title="Scroll to content"
        >
          ↓
        </button>
      </div>

      <div style={{ position: "relative", zIndex: 1 }}>
        <div
          className="gar-topbar"
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
          <div className="gar-topbar-start" style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <Link
              href="/blog"
              prefetch={false}
              style={{
                fontSize: 10,
                color: "#c94dff",
                textDecoration: "none",
                letterSpacing: 2,
                border: "1px solid rgba(201, 77, 255, 0.55)",
                padding: "4px 10px",
                borderRadius: 3,
                fontFamily: RAJ,
                fontWeight: 700,
              }}
            >
              ← ANALYSIS
            </Link>
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
          <div className="gar-divider" style={{ width: 1, height: 20, background: "#1a3320", flexShrink: 0 }} />
          <div className="gar-topbar-brand" style={{ fontFamily: RAJ, fontSize: 14, fontWeight: 700, color: "#00ff88", letterSpacing: 2 }}>
            THE THEORIST
          </div>
          <div className="gar-divider" style={{ width: 1, height: 20, background: "#1a3320", flexShrink: 0 }} />
          <div className="gar-topbar-actions" style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
            <Link
              href={`/board/${item.id}`}
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
              <span className="gar-nav-long">◈ BOARD ▶</span>
              <span className="gar-nav-short">BOARD</span>
            </Link>
            <Link
              href={`/blog/${slug}`}
              style={{
                fontFamily: RAJ,
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: 2,
                textTransform: "uppercase",
                padding: "6px 14px",
                borderRadius: 3,
                border: "1px solid #1a3320",
                color: "#5a8068",
                textDecoration: "none",
              }}
            >
              ↗ REPORT
            </Link>
          </div>
        </div>

        <div
          className="gar-main-grid"
          style={{
            ...pageContentShellStyle({
              padding: "1.75rem clamp(1rem, 3vw, 2rem) 6rem",
              ...(chatActive ? { maxWidth: 1680 } : {}),
            }),
            display: "grid",
            gridTemplateColumns: chatActive
              ? "minmax(0, 1fr) minmax(240px, 300px) minmax(280px, 340px)"
              : "minmax(0, 1fr) minmax(280px, 340px)",
            gap: "clamp(1.25rem, 3vw, 2.5rem)",
          }}
        >
          <div className="gar-col-article">
            <div style={{ marginBottom: "1.5rem" }}>
              <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 10, flexWrap: "wrap" }}>
                <span style={{ fontSize: 10, color: "#5a8068", letterSpacing: 2, textTransform: "uppercase" }}>
                  {item.section}
                </span>
                <span style={{ fontSize: 10, color: "#3a5040", letterSpacing: 1 }}>{timeAgo(item.date)}</span>
                <span
                  style={{
                    fontSize: 11,
                    color: "#00bb66",
                    border: "1px solid #00bb66",
                    padding: "1px 7px",
                    borderRadius: 2,
                    fontFamily: RAJ,
                    fontWeight: 700,
                    letterSpacing: 1,
                  }}
                >
                  {item.score}% THREAT
                </span>
              </div>
              <h1
                className="gar-article-title"
                style={{ fontFamily: RAJ, fontSize: 30, fontWeight: 700, color: "#e8ffe8", lineHeight: 1.28, margin: "0 0 12px" }}
              >
                {item.title}
              </h1>
              {item.angle ? (
                <div style={{ padding: "8px 12px", borderLeft: "2px solid #1a3320", fontSize: 14, color: "#5a8068", lineHeight: 1.65 }}>
                  <span style={{ color: "#00bb66" }}>▸ </span>
                  {item.angle}
                </div>
              ) : null}
            </div>

            {isLore && (
              <div
                style={{
                  margin: "0 0 1.75rem",
                  padding: "12px 16px",
                  borderRadius: 4,
                  background: "rgba(201,77,255,0.06)",
                  border: "1px solid rgba(201,77,255,0.25)",
                  display: "flex",
                  gap: 10,
                  alignItems: "flex-start",
                }}
              >
                <span style={{ color: "#c94dff", fontFamily: RAJ, fontWeight: 700, fontSize: 11, letterSpacing: 2, flexShrink: 0, paddingTop: 1 }}>
                  ◈ HYPOTHESIS DOSSIER
                </span>
                <span style={{ fontSize: 11, color: "#7a5090", lineHeight: 1.6 }}>
                  Speculative analysis — not verified reporting. Sources are provided for context and further reading, not as proof. All claims are allegations unless independently corroborated.
                </span>
              </div>
            )}

            {item.image ? (
              <div
                className="gar-hero-img"
                style={{ position: "relative", height: 320, marginBottom: "1.5rem", borderRadius: 4, overflow: "hidden" }}
              >
                <Image src={item.image} alt="" fill unoptimized={!canOptimizeImage(item.image)} style={{ objectFit: "cover", filter: "saturate(0.4) brightness(0.65)" }} />
                <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, transparent 50%, #050c07)" }} />
              </div>
            ) : null}

            <article style={{ marginBottom: "1.5rem" }}>
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
              <div className="blog-content">
                <ReactMarkdown>{markdown}</ReactMarkdown>
              </div>
            </article>

            {sources.length > 0 ? (
              <div style={{ marginBottom: "1.5rem", paddingTop: "1rem", borderTop: "1px solid #1a3320" }}>
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
                  {sources.map((s, i) => {
                    const hasUrl = typeof s.url === "string" && s.url.startsWith("http");
                    const cardStyle = {
                      display: "flex",
                      gap: 10,
                      fontSize: 11,
                      textDecoration: "none",
                      padding: "8px 10px",
                      border: `1px solid ${hasUrl ? "#1a3320" : "#0d1a10"}`,
                      borderRadius: 3,
                      background: "#090f0b",
                      color: hasUrl ? "#00bb66" : "#5a8068",
                      cursor: hasUrl ? "pointer" : "default",
                    } as React.CSSProperties;
                    const inner = (
                      <>
                        <span style={{ flexShrink: 0 }}>{hasUrl ? "↗" : "◈"}</span>
                        <div>
                          <div style={{ fontFamily: RAJ, fontWeight: 700, marginBottom: 2, color: hasUrl ? "#00bb66" : "#8aaa96" }}>{s.title}</div>
                          <div style={{ fontSize: 10, color: "#5a8068" }}>{s.description}</div>
                          {!hasUrl && (
                            <div style={{ fontSize: 9, color: "#3a5040", marginTop: 3, letterSpacing: 1 }}>
                              NO VERIFIED URL — search manually
                            </div>
                          )}
                        </div>
                      </>
                    );
                    return hasUrl ? (
                      <a key={`src-${i}`} href={s.url} target="_blank" rel="noreferrer" style={cardStyle}>
                        {inner}
                      </a>
                    ) : (
                      <div key={`src-${i}`} style={cardStyle}>
                        {inner}
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <Link
                href={`/board/${item.id}`}
                style={{
                  display: "block",
                  padding: "14px",
                  border: "1px solid #00bb66",
                  borderRadius: 4,
                  textAlign: "center",
                  textDecoration: "none",
                  background: "rgba(0,255,136,0.04)",
                  transition: "all 0.15s",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLAnchorElement).style.background = "rgba(0,255,136,0.08)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLAnchorElement).style.background = "rgba(0,255,136,0.04)";
                }}
              >
                <div style={{ fontFamily: RAJ, fontSize: 14, fontWeight: 700, color: "#00ff88", letterSpacing: 3, marginBottom: 4 }}>
                  ◈ OPEN INVESTIGATION BOARD ▶
                </div>
                <div style={{ fontSize: 10, color: "#5a8068", letterSpacing: 1 }}>AI graph · patents · FOIA · theories</div>
              </Link>
              {SHOW_COMMUNITY ? (
                <Link
                  href={`/community?generated_article=${item.id}`}
                  style={{
                    display: "block",
                    padding: "12px 14px",
                    border: "1px solid #1a3320",
                    borderRadius: 4,
                    textAlign: "center",
                    textDecoration: "none",
                    background: "#090f0b",
                    transition: "all 0.15s",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLAnchorElement).style.borderColor = "#c94dff";
                    (e.currentTarget as HTMLAnchorElement).style.background = "rgba(201,77,255,0.06)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLAnchorElement).style.borderColor = "#1a3320";
                    (e.currentTarget as HTMLAnchorElement).style.background = "#090f0b";
                  }}
                >
                  <div style={{ fontFamily: RAJ, fontSize: 13, fontWeight: 700, color: "#c94dff", letterSpacing: 2, marginBottom: 3 }}>
                    ▸ DISCUSS IN COMMUNITY
                  </div>
                  <div style={{ fontSize: 10, color: "#5a8068", letterSpacing: 1 }}>Thread linked to this report</div>
                </Link>
              ) : null}
              <Link
                href="/"
                style={{
                  display: "block",
                  padding: "10px 14px",
                  border: "1px solid #1a3320",
                  borderRadius: 4,
                  textAlign: "center",
                  textDecoration: "none",
                  background: "#050c07",
                  fontFamily: RAJ,
                  fontSize: 12,
                  fontWeight: 700,
                  letterSpacing: 2,
                  color: "#5a8068",
                }}
              >
                OPEN INVESTIGATION FEED →
              </Link>
            </div>
          </div>

          <div className="gar-col-side" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div
              style={{
                border: "1px solid rgba(0, 187, 102, 0.25)",
                borderRadius: 6,
                background: "linear-gradient(145deg, rgba(9,15,11,0.98) 0%, rgba(5,12,7,0.95) 100%)",
                padding: "12px 14px",
                boxShadow: "0 0 0 1px rgba(0,255,136,0.04)",
              }}
            >
              <div style={{ fontFamily: FONT, fontSize: 10, color: "#00bb66", letterSpacing: 2, marginBottom: 6 }}>◈ SIGNALS</div>
              <div style={{ fontSize: 10, color: "#5a8068", lineHeight: 1.55 }}>
                Reader votes and theory picks are in the panel below. Open the Investigation Board for the Oracle graph and evidence nodes.
              </div>
            </div>
            <VotePanel generatedArticleId={item.id} aiScore={item.score} theories={voteTheories} />
            <PolymarketWidget query={item.title} context={buildPolymarketContext(item, markdown)} />
          </div>

          {chatActive ? (
            <div
              className="gar-col-chat"
              style={{
                position: "sticky",
                top: 56,
                height: "calc(100vh - 100px)",
                minHeight: 360,
                border: "1px solid #1a3320",
                borderRadius: 4,
                overflow: "hidden",
              }}
            >
              <LiveChat generatedArticleId={item.id} articleTitle={item.title} onClose={() => setChatOpen(false)} />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
