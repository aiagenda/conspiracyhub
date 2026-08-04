"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { TOOLKIT_CATEGORIES, TOOLKIT_ITEM_COUNT } from "@/lib/toolkitCatalog";
import { pageContentShellStyle } from "@/lib/pageShell";

const FONT = "var(--font-share-tech-mono), monospace";
const RAJ = "var(--font-raj), sans-serif";

function normalize(s: string) {
  return s.toLowerCase().replace(/\s+/g, " ");
}

export default function ToolkitPageClient() {
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const needle = normalize(q.trim());
    if (!needle) return TOOLKIT_CATEGORIES;
    return TOOLKIT_CATEGORIES.map((cat) => ({
      ...cat,
      items: cat.items.filter(
        (item) =>
          normalize(item.name).includes(needle) ||
          normalize(item.blurb).includes(needle) ||
          normalize(item.url).includes(needle),
      ),
    })).filter((cat) => cat.items.length > 0);
  }, [q]);

  const visibleCount = filtered.reduce((n, c) => n + c.items.length, 0);

  return (
    <div style={{ minHeight: "100vh", background: "#050c07", color: "#c8e8d0", fontFamily: FONT }}>
      <div className="scanline" />
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
            flexWrap: "wrap",
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
              fontFamily: RAJ,
              fontWeight: 700,
            }}
          >
            ← FEED
          </Link>
          <div style={{ width: 1, height: 20, background: "#1a3320", flexShrink: 0 }} />
          <div style={{ fontFamily: RAJ, fontSize: 14, fontWeight: 700, color: "#00ff88", letterSpacing: 2 }}>
            THE THEORIST
          </div>
          <div style={{ width: 1, height: 20, background: "#1a3320", flexShrink: 0 }} />
          <div style={{ fontFamily: RAJ, fontSize: 11, color: "#5a8068", letterSpacing: 2 }}>INVESTIGATOR TOOLKIT</div>
        </div>

        <div style={pageContentShellStyle({ paddingBottom: "5rem" })}>
          <div style={{ marginBottom: "1.75rem", paddingBottom: "1.25rem", borderBottom: "1px solid #1a3320" }}>
            <div
              style={{
                fontFamily: RAJ,
                fontSize: 9,
                letterSpacing: 5,
                color: "#3a5040",
                marginBottom: 6,
                textTransform: "uppercase",
              }}
            >
              ◈ CURATED GITHUB & OSINT ARSENAL
            </div>
            <h1
              style={{
                fontFamily: RAJ,
                fontSize: 28,
                fontWeight: 700,
                color: "#00ff88",
                letterSpacing: 2,
                margin: "0 0 10px",
                textShadow: "0 0 20px rgba(0,255,136,0.15)",
              }}
            >
              Research Stack
            </h1>
            <p style={{ fontSize: 13, color: "#7aaa8a", lineHeight: 1.75, margin: "0 0 16px", maxWidth: 720 }}>
              {TOOLKIT_ITEM_COUNT} links we actually use or watch for scraping, OSINT pivots, AI agents, and launch
              media — annotated for hardcore builders running investigation platforms like this one.
            </p>
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Filter tools (sherlock, firecrawl, shodan…)"
              aria-label="Filter toolkit"
              style={{
                width: "100%",
                maxWidth: 480,
                padding: "10px 14px",
                background: "#090f0b",
                border: "1px solid #1a3320",
                borderRadius: 4,
                color: "#c8e8d0",
                fontFamily: FONT,
                fontSize: 13,
                outline: "none",
              }}
            />
            {q.trim() ? (
              <div style={{ fontSize: 11, color: "#5a8068", marginTop: 8 }}>
                Showing {visibleCount} match{visibleCount === 1 ? "" : "es"}
              </div>
            ) : null}
          </div>

          {!q.trim() && (
            <nav
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 8,
                marginBottom: "2rem",
                padding: "12px 14px",
                border: "1px solid #1a3320",
                borderRadius: 4,
                background: "#080c09",
              }}
              aria-label="Category jump links"
            >
              {TOOLKIT_CATEGORIES.map((cat) => (
                <a
                  key={cat.id}
                  href={`#${cat.id}`}
                  style={{
                    fontFamily: RAJ,
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: 1.5,
                    color: cat.accent,
                    textDecoration: "none",
                    border: `1px solid ${cat.accent}44`,
                    padding: "4px 10px",
                    borderRadius: 3,
                  }}
                >
                  {cat.title.toUpperCase()}
                </a>
              ))}
            </nav>
          )}

          {filtered.map((cat) => (
            <section
              key={cat.id}
              id={cat.id}
              style={{ borderBottom: "1px solid #1a3320", paddingBottom: 28, marginBottom: 28 }}
            >
              <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 8, flexWrap: "wrap" }}>
                <h2
                  style={{
                    fontFamily: RAJ,
                    fontSize: 16,
                    fontWeight: 700,
                    color: cat.accent,
                    letterSpacing: 2,
                    margin: 0,
                    textTransform: "uppercase",
                  }}
                >
                  {cat.title}
                </h2>
                <span style={{ fontSize: 11, color: "#3a5040" }}>{cat.items.length} links</span>
              </div>
              <p style={{ fontSize: 12, color: "#5a8068", lineHeight: 1.7, margin: "0 0 12px", maxWidth: 680 }}>
                {cat.subtitle}
              </p>
              {cat.disclaimer ? (
                <p
                  style={{
                    fontSize: 11,
                    color: "#aa6666",
                    lineHeight: 1.65,
                    margin: "0 0 14px",
                    padding: "10px 12px",
                    border: "1px solid rgba(255,51,51,0.25)",
                    borderRadius: 3,
                    background: "rgba(255,51,51,0.04)",
                  }}
                >
                  {cat.disclaimer}
                </p>
              ) : null}
              <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 10 }}>
                {cat.items.map((item) => (
                  <li
                    key={item.url}
                    style={{
                      padding: "12px 14px",
                      border: "1px solid #1a3320",
                      borderRadius: 4,
                      background: "#090f0b",
                      transition: "border-color 0.15s",
                    }}
                  >
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        fontFamily: RAJ,
                        fontSize: 14,
                        fontWeight: 700,
                        color: cat.accent,
                        textDecoration: "none",
                        letterSpacing: 0.5,
                      }}
                    >
                      {item.name} ↗
                    </a>
                    <p style={{ fontSize: 12, color: "#9ec8ae", lineHeight: 1.65, margin: "6px 0 0" }}>{item.blurb}</p>
                    <p
                      style={{
                        fontSize: 10,
                        color: "#3a5040",
                        margin: "6px 0 0",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {item.url.replace(/^https?:\/\//, "")}
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          ))}

          {filtered.length === 0 ? (
            <p style={{ color: "#5a8068", fontSize: 13 }}>No tools match &ldquo;{q}&rdquo;.</p>
          ) : null}

          <div
            style={{
              marginTop: "2rem",
              padding: "16px 18px",
              border: "1px solid #1a3320",
              borderRadius: 4,
              background: "rgba(0,255,136,0.03)",
            }}
          >
            <div style={{ fontFamily: RAJ, fontSize: 11, fontWeight: 700, color: "#5a8068", letterSpacing: 2, marginBottom: 8 }}>
              ◈ NOTE
            </div>
            <p style={{ fontSize: 12, color: "#7aaa8a", lineHeight: 1.75, margin: 0 }}>
              Personal collection — not endorsements. NSFW, pure trading bots, and unrelated side projects were left out.
              Send additions via{" "}
              <Link href="/contact" style={{ color: "#00bb66" }}>
                contact
              </Link>
              . Also see the{" "}
              <Link href="/guide" style={{ color: "#00bb66" }}>
                platform guide
              </Link>{" "}
              and{" "}
              <Link href="/ai" style={{ color: "#00bb66" }}>
                AI &amp; Tech desk
              </Link>
              .
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
