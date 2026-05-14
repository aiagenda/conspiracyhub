"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import LiveChat from "@/components/LiveChat";
import PolymarketWidget from "@/components/PolymarketWidget";
import { markArticleRead } from "@/lib/readArticles";
import { pageContentShellStyle } from "@/lib/pageShell";
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
}: {
  item: NewsItem;
  slug: string;
  markdown: string;
  sources?: SourceRow[];
  initialChatOpen?: boolean;
}) {
  const [chatOpen, setChatOpen] = useState(initialChatOpen);

  useEffect(() => {
    markArticleRead(item.id);
  }, [item.id]);

  return (
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
          animation: "genBannerGlow 2.5s ease-in-out infinite",
        }}
      >
        <style>{`
          @keyframes genBannerGlow { 0%,100%{box-shadow:0 0 16px rgba(0,255,136,0.12)} 50%{box-shadow:0 0 28px rgba(0,255,136,0.28)} }
          @keyframes genBannerDot { 0%,100%{opacity:1} 50%{opacity:0.2} }
        `}</style>
        <div style={{ background: "rgba(0,255,136,0.08)", padding: "10px 14px", display: "flex", alignItems: "center", gap: 8 }}>
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
        <a
          href={`/board/${item.id}`}
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
            transition: "background 0.15s",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLAnchorElement).style.background = "rgba(0,255,136,0.22)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLAnchorElement).style.background = "rgba(0,255,136,0.12)";
          }}
        >
          ◈ OPEN INVESTIGATION BOARD ▶
        </a>
        <button
          type="button"
          onClick={() => setChatOpen((o) => !o)}
          style={{
            display: "block",
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
          {chatOpen ? "✕ CLOSE" : "◈ LIVE CHAT"}
        </button>
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
              ◈ INVESTIGATION BOARD ▶
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
          style={{
            ...pageContentShellStyle({
              padding: "1.75rem clamp(1rem, 3vw, 2rem) 6rem",
              ...(chatOpen ? { maxWidth: 1680 } : {}),
            }),
            display: "grid",
            gridTemplateColumns: chatOpen
              ? "minmax(0, 1fr) minmax(240px, 300px) minmax(280px, 340px)"
              : "minmax(0, 1fr) minmax(280px, 340px)",
            gap: "clamp(1.25rem, 3vw, 2.5rem)",
          }}
        >
          <div>
            <div style={{ marginBottom: "1.5rem" }}>
              <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 10, flexWrap: "wrap" }}>
                <Link
                  href="/blog"
                  style={{
                    fontSize: 10,
                    color: "#c94dff",
                    letterSpacing: 2,
                    textTransform: "uppercase",
                    textDecoration: "none",
                  }}
                >
                  ANALYSIS
                </Link>
                <span style={{ fontSize: 10, color: "#3a5040" }}>/</span>
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
              <h1 style={{ fontFamily: RAJ, fontSize: 30, fontWeight: 700, color: "#e8ffe8", lineHeight: 1.28, margin: "0 0 12px" }}>
                {item.title}
              </h1>
              {item.angle ? (
                <div style={{ padding: "8px 12px", borderLeft: "2px solid #1a3320", fontSize: 14, color: "#5a8068", lineHeight: 1.65 }}>
                  <span style={{ color: "#00bb66" }}>▸ </span>
                  {item.angle}
                </div>
              ) : null}
            </div>

            {item.image ? (
              <div style={{ position: "relative", height: 320, marginBottom: "1.5rem", borderRadius: 4, overflow: "hidden" }}>
                <Image src={item.image} alt="" fill unoptimized style={{ objectFit: "cover", filter: "saturate(0.4) brightness(0.65)" }} />
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
                  {sources.map((s, i) => (
                    <a
                      key={`${s.url}-${i}`}
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
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ border: "1px solid #1a3320", borderRadius: 4, background: "#090f0b", padding: "10px 12px" }}>
              <div style={{ fontFamily: FONT, fontSize: 10, color: "#00bb66", letterSpacing: 2, marginBottom: 6 }}>◈ SIGNALS</div>
              <div style={{ fontSize: 10, color: "#5a8068", lineHeight: 1.55 }}>
                Open the Investigation Board to run Oracle graph analysis, vote on theories, and explore evidence nodes for this report.
              </div>
            </div>
            <PolymarketWidget query={item.title} context={buildPolymarketContext(item, markdown)} />
          </div>

          {chatOpen ? (
            <div
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
