"use client";

import { useState } from "react";
import Link from "next/link";
import SiteNav from "@/components/SiteNav";
import { normalizeVerdict } from "@/lib/verdict";
import { getSupabaseBrowserClient } from "@/lib/supabase";

const FONT = "var(--font-share-tech-mono), monospace";
const RAJ = "var(--font-raj), sans-serif";

type SearchResult = {
  query: string;
  news: Array<{ id: string; title: string; summary: string; section: string; score: number; angle: string }>;
  theories: Array<{ name: string; summary: string; probability: number; sources: string[]; tags: string[] }>;
  patents: Array<{ number: string; title: string; assignee: string; year: number; relevance: string; url: string }>;
  people: Array<{ name: string; role: string; affiliation: string; significance: string }>;
  events: Array<{ date: string; title: string; description: string }>;
};

type UrlResult = {
  id: string | null;
  title: string;
  source_url: string;
  verdict: string;
  theories: Array<{ name: string; summary: string; probability: number }>;
  conclusion: string;
};

const BROWSE_TOPICS = [
  "5G surveillance network",
  "COVID vaccine microchip",
  "CIA mind control MKUltra",
  "NSA mass surveillance PRISM",
  "Neuralink brain data",
  "HAARP weather control",
  "Federal Reserve banking cartel",
  "Big Pharma suppressed cures",
  "Deep state shadow government",
  "Chemtrail geoengineering",
  "DARPA human enhancement",
  "WEF great reset agenda",
];

const TYPE_FILTERS = [
  { value: "all", label: "ALL" },
  { value: "theories", label: "THEORIES" },
  { value: "patents", label: "PATENTS" },
  { value: "people", label: "PEOPLE" },
];

const THREAT_FILTERS = [
  { value: "", label: "ANY THREAT" },
  { value: "high", label: "HIGH (60%+)" },
  { value: "medium", label: "MEDIUM" },
  { value: "low", label: "LOW" },
];

function scoreColor(s: number) {
  if (s >= 60) return "#ff3333";
  if (s >= 30) return "#ffaa00";
  return "#00bb66";
}

function verdictColor(v: string) {
  const n = normalizeVerdict(v);
  if (n === "TRUE") return "#ff3333";
  if (n === "PARTIALLY_TRUE") return "#ffaa00";
  if (n === "DISINFORMATION") return "#5a8068";
  return "#00bb66";
}

export default function SearchPage() {
  const [tab, setTab] = useState<"search" | "url">("search");
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [threatFilter, setThreatFilter] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<SearchResult | null>(null);

  const [urlInput, setUrlInput] = useState("");
  const [urlLoading, setUrlLoading] = useState(false);
  const [urlResult, setUrlResult] = useState<UrlResult | null>(null);
  const [urlError, setUrlError] = useState("");
  const [searchError, setSearchError] = useState("");

  async function doSearch(q = query) {
    if (!q.trim()) return;
    setSearching(true);
    setSearchError("");
    setResults(null);
    try {
      const params = new URLSearchParams({ q: q.trim(), type: typeFilter, threat: threatFilter });
      const res = await fetch(`/api/search?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? data.error ?? "Search failed");
      setResults(data);
    } catch (e) {
      setSearchError(e instanceof Error ? e.message : "Search failed");
    } finally {
      setSearching(false);
    }
  }

  async function analyzeUrl() {
    if (!urlInput.trim()) return;
    setUrlLoading(true);
    setUrlError("");
    setUrlResult(null);
    try {
      const supabase = getSupabaseBrowserClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Sign in required for URL analysis");

      const res = await fetch("/api/analyze-url", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ url: urlInput.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? data.error ?? "Analysis failed");
      setUrlResult(data);
    } catch (e) {
      setUrlError(e instanceof Error ? e.message : "Analysis failed");
    } finally {
      setUrlLoading(false);
    }
  }

  const inp: React.CSSProperties = {
    background: "#090f0b",
    border: "1px solid #1a3320",
    borderRadius: 3,
    padding: "10px 14px",
    color: "#00ff88",
    fontFamily: FONT,
    fontSize: 13,
    outline: "none",
    flex: 1,
    transition: "border-color 0.2s",
  };

  return (
    <div style={{ minHeight: "100vh", background: "#050c07", color: "#c8e8d0", fontFamily: FONT }}>
      <div className="scanline" />
      <div style={{ position: "relative", zIndex: 1, maxWidth: 1000, margin: "0 auto", padding: "1.5rem 1.25rem 4rem" }}>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            marginBottom: "1.5rem",
            paddingBottom: "1rem",
            borderBottom: "1px solid #1a3320",
            flexWrap: "wrap",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap", minWidth: 0 }}>
            <Link href="/" style={{ fontSize: 10, color: "#5a8068", textDecoration: "none", letterSpacing: 2, border: "1px solid #1a3320", padding: "5px 10px", borderRadius: 3 }}>
              ← FEED
            </Link>
            <div>
              <div style={{ fontFamily: RAJ, fontSize: 18, fontWeight: 700, color: "#00ff88", letterSpacing: 2, textTransform: "uppercase" }}>
                THE THEORIST — INTELLIGENCE SEARCH
              </div>
              <div style={{ fontSize: 10, color: "#5a8068", letterSpacing: 2, marginTop: 2 }}>
                CONSPIRACY THEORIES · PATENTS · PEOPLE · URL ANALYSIS
              </div>
            </div>
          </div>
          <SiteNav spacious />
        </div>

        <div style={{ display: "flex", gap: 6, marginBottom: "1.5rem", flexWrap: "wrap" }}>
          {[
            { key: "search", label: "◈ SEARCH DATABASE" },
            { key: "url", label: "◈ ANALYZE URL" },
          ].map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key as "search" | "url")}
              style={{
                fontFamily: RAJ,
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: 2,
                textTransform: "uppercase",
                padding: "8px 18px",
                borderRadius: 3,
                cursor: "pointer",
                border: `1px solid ${tab === t.key ? "#00bb66" : "#1a3320"}`,
                background: tab === t.key ? "rgba(0,255,136,0.08)" : "transparent",
                color: tab === t.key ? "#00ff88" : "#5a8068",
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === "search" && (
          <div>
            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && doSearch()}
                placeholder="Search conspiracy theories, patents, people..."
                style={inp}
                onFocus={(e) => {
                  (e.target as HTMLInputElement).style.borderColor = "#00bb66";
                }}
                onBlur={(e) => {
                  (e.target as HTMLInputElement).style.borderColor = "#1a3320";
                }}
              />
              <button
                type="button"
                onClick={() => doSearch()}
                disabled={searching}
                style={{
                  fontFamily: RAJ,
                  fontSize: 13,
                  fontWeight: 700,
                  letterSpacing: 2,
                  textTransform: "uppercase",
                  padding: "10px 20px",
                  borderRadius: 3,
                  border: "1px solid #00bb66",
                  background: "transparent",
                  color: "#00ff88",
                  cursor: "pointer",
                  opacity: searching ? 0.5 : 1,
                }}
              >
                {searching ? "SCANNING..." : "SEARCH ▶"}
              </button>
            </div>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: "1.5rem" }}>
              <div style={{ display: "flex", gap: 4 }}>
                {TYPE_FILTERS.map((f) => (
                  <button
                    key={f.value}
                    type="button"
                    onClick={() => setTypeFilter(f.value)}
                    style={{
                      fontFamily: RAJ,
                      fontSize: 10,
                      fontWeight: 700,
                      letterSpacing: 1,
                      textTransform: "uppercase",
                      padding: "4px 10px",
                      borderRadius: 2,
                      cursor: "pointer",
                      border: `1px solid ${typeFilter === f.value ? "#00bb66" : "#1a3320"}`,
                      background: typeFilter === f.value ? "rgba(0,255,136,0.06)" : "transparent",
                      color: typeFilter === f.value ? "#00ff88" : "#5a8068",
                    }}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
              <div style={{ width: 1, background: "#1a3320" }} />
              <div style={{ display: "flex", gap: 4 }}>
                {THREAT_FILTERS.map((f) => (
                  <button
                    key={f.value || "any"}
                    type="button"
                    onClick={() => setThreatFilter(f.value)}
                    style={{
                      fontFamily: RAJ,
                      fontSize: 10,
                      fontWeight: 700,
                      letterSpacing: 1,
                      textTransform: "uppercase",
                      padding: "4px 10px",
                      borderRadius: 2,
                      cursor: "pointer",
                      border: `1px solid ${threatFilter === f.value ? "#ffaa00" : "#1a3320"}`,
                      background: threatFilter === f.value ? "rgba(255,170,0,0.06)" : "transparent",
                      color: threatFilter === f.value ? "#ffaa00" : "#5a8068",
                    }}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {!results && !searching && (
              <div style={{ marginBottom: "2rem" }}>
                <div style={{ fontSize: 9, color: "#3a5040", letterSpacing: 3, marginBottom: 10, textTransform: "uppercase" }}>
                  ◈ BROWSE — POPULAR TOPICS
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {BROWSE_TOPICS.map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => {
                        setQuery(t);
                        doSearch(t);
                      }}
                      style={{
                        fontSize: 10,
                        padding: "5px 12px",
                        border: "1px solid #1a3320",
                        borderRadius: 20,
                        color: "#5a8068",
                        background: "transparent",
                        cursor: "pointer",
                        letterSpacing: 1,
                        transition: "all 0.15s",
                        fontFamily: FONT,
                      }}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLButtonElement).style.borderColor = "#00bb66";
                        (e.currentTarget as HTMLButtonElement).style.color = "#00ff88";
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLButtonElement).style.borderColor = "#1a3320";
                        (e.currentTarget as HTMLButtonElement).style.color = "#5a8068";
                      }}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {searching && (
              <div style={{ textAlign: "center", padding: "3rem 0", color: "#00bb66", fontSize: 11, letterSpacing: 2 }}>
                <div style={{ marginBottom: 16 }}>[ SCANNING INTELLIGENCE DATABASES... ]</div>
                {[
                  "> Cross-referencing CIA FOIA archives...",
                  "> Searching USPTO patent corpus...",
                  "> Profiling associated individuals...",
                  "> Building conspiracy connection map...",
                ].map((l, i) => (
                  <div key={i} style={{ color: "#3a6040", marginBottom: 4 }}>
                    {l}
                  </div>
                ))}
              </div>
            )}

            {searchError && (
              <div style={{ padding: 12, border: "1px solid rgba(255,51,51,0.3)", borderRadius: 3, color: "#ff3333", fontSize: 11, marginBottom: "1rem" }}>
                [ERROR] {searchError}
              </div>
            )}

            {results && (
              <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
                {results.news.length > 0 && (
                  <section>
                    <div style={{ fontSize: 9, color: "#00bb66", letterSpacing: 3, marginBottom: 10, textTransform: "uppercase" }}>
                      ◈ MATCHING ARTICLES IN FEED ({results.news.length})
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 8 }}>
                      {results.news.map((n) => (
                        <Link key={n.id} href={`/board/${n.id}`} style={{ textDecoration: "none" }}>
                          <div
                            style={{
                              border: "1px solid #1a3320",
                              borderRadius: 3,
                              padding: "10px 12px",
                              background: "#090f0b",
                              cursor: "pointer",
                              transition: "border-color 0.15s",
                            }}
                            onMouseEnter={(e) => {
                              (e.currentTarget as HTMLDivElement).style.borderColor = "#00bb66";
                            }}
                            onMouseLeave={(e) => {
                              (e.currentTarget as HTMLDivElement).style.borderColor = "#1a3320";
                            }}
                          >
                            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                              <span style={{ fontSize: 9, color: "#5a8068", letterSpacing: 1, textTransform: "uppercase" }}>{n.section}</span>
                              <span
                                style={{
                                  fontSize: 10,
                                  color: scoreColor(n.score),
                                  border: `1px solid ${scoreColor(n.score)}`,
                                  padding: "1px 6px",
                                  borderRadius: 2,
                                }}
                              >
                                {n.score}%
                              </span>
                            </div>
                            <div style={{ fontFamily: RAJ, fontSize: 13, fontWeight: 700, color: "#e8ffe8", lineHeight: 1.3, marginBottom: 5 }}>{n.title}</div>
                            {n.angle ? <div style={{ fontSize: 10, color: "#5a8068" }}>▸ {n.angle}</div> : null}
                          </div>
                        </Link>
                      ))}
                    </div>
                  </section>
                )}

                {results.theories.length > 0 && (
                  <section>
                    <div style={{ fontSize: 9, color: "#ff3333", letterSpacing: 3, marginBottom: 10, textTransform: "uppercase" }}>
                      ◈ CONSPIRACY THEORIES ({results.theories.length})
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {results.theories.map((t, i) => (
                        <div key={i} style={{ border: "1px solid #1a3320", borderRadius: 3, padding: "12px 14px", background: "#090f0b" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8, gap: 10 }}>
                            <div style={{ fontFamily: RAJ, fontSize: 14, fontWeight: 700, color: "#e8ffe8", lineHeight: 1.3 }}>{t.name}</div>
                            <div style={{ fontFamily: RAJ, fontSize: 22, fontWeight: 700, color: scoreColor(t.probability), flexShrink: 0 }}>{t.probability}%</div>
                          </div>
                          <div style={{ fontSize: 11, color: "#7aaa8a", lineHeight: 1.7, marginBottom: 10 }}>{t.summary}</div>
                          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
                            {t.tags?.map((tag, j) => (
                              <span key={j} style={{ fontSize: 9, padding: "2px 8px", border: "1px solid #1a3320", borderRadius: 10, color: "#5a8068", letterSpacing: 1 }}>
                                {tag}
                              </span>
                            ))}
                          </div>
                          {t.sources
                            ?.filter((s) => /^https?:\/\//.test(s))
                            .slice(0, 3)
                            .map((s, j) => (
                              <a
                                key={j}
                                href={s}
                                target="_blank"
                                rel="noreferrer"
                                style={{
                                  display: "block",
                                  fontSize: 10,
                                  color: "#00bb66",
                                  textDecoration: "none",
                                  marginBottom: 3,
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                ↗ {s}
                              </a>
                            ))}
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {results.patents.length > 0 && (
                  <section>
                    <div style={{ fontSize: 9, color: "#ff5555", letterSpacing: 3, marginBottom: 10, textTransform: "uppercase" }}>
                      ◈ RELATED PATENTS ({results.patents.length})
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 8 }}>
                      {results.patents.map((p, i) => (
                        <a key={i} href={p.url} target="_blank" rel="noreferrer" style={{ textDecoration: "none" }}>
                          <div
                            style={{
                              border: "1px solid rgba(255,85,85,0.2)",
                              borderRadius: 3,
                              padding: "11px 13px",
                              background: "rgba(26,10,10,0.8)",
                              cursor: "pointer",
                              transition: "border-color 0.15s",
                              height: "100%",
                            }}
                            onMouseEnter={(e) => {
                              (e.currentTarget as HTMLDivElement).style.borderColor = "#ff5555";
                            }}
                            onMouseLeave={(e) => {
                              (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(255,85,85,0.2)";
                            }}
                          >
                            <div style={{ fontSize: 9, color: "#ff5555", letterSpacing: 2, marginBottom: 5 }}>
                              {p.number} · {p.year}
                            </div>
                            <div style={{ fontFamily: RAJ, fontSize: 13, fontWeight: 700, color: "#ffe8e8", lineHeight: 1.3, marginBottom: 5 }}>{p.title}</div>
                            <div style={{ fontSize: 10, color: "#8a6060", marginBottom: 6 }}>{p.assignee}</div>
                            <div style={{ fontSize: 10, color: "#7a4a4a", lineHeight: 1.5 }}>{p.relevance}</div>
                          </div>
                        </a>
                      ))}
                    </div>
                  </section>
                )}

                {results.people.length > 0 && (
                  <section>
                    <div style={{ fontSize: 9, color: "#00bb66", letterSpacing: 3, marginBottom: 10, textTransform: "uppercase" }}>
                      ◈ KEY FIGURES ({results.people.length})
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 8 }}>
                      {results.people.map((p, i) => (
                        <div key={i} style={{ border: "1px solid rgba(0,187,102,0.2)", borderRadius: 3, padding: "11px 13px", background: "rgba(7,21,16,0.8)" }}>
                          <div style={{ fontFamily: RAJ, fontSize: 14, fontWeight: 700, color: "#00ff88", marginBottom: 3 }}>{p.name}</div>
                          <div style={{ fontSize: 9, color: "#5a8068", letterSpacing: 1, marginBottom: 6 }}>{p.affiliation}</div>
                          <div style={{ fontSize: 10, color: "#3a7050", fontStyle: "italic", marginBottom: 6 }}>{p.role}</div>
                          <div style={{ fontSize: 10, color: "#5a8068", lineHeight: 1.5 }}>{p.significance}</div>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {results.events.length > 0 && (
                  <section>
                    <div style={{ fontSize: 9, color: "#ffaa00", letterSpacing: 3, marginBottom: 10, textTransform: "uppercase" }}>
                      ◈ RELATED EVENTS ({results.events.length})
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 1, borderLeft: "1px solid #1a3320", paddingLeft: 16 }}>
                      {results.events.map((e, i) => (
                        <div key={i} style={{ display: "flex", gap: 16, padding: "8px 0", borderBottom: "1px solid #0d1a10" }}>
                          <div style={{ fontSize: 10, color: "#ffaa00", whiteSpace: "nowrap", letterSpacing: 1, minWidth: 90 }}>{e.date}</div>
                          <div>
                            <div style={{ fontFamily: RAJ, fontSize: 13, fontWeight: 700, color: "#e8e8c8", marginBottom: 3 }}>{e.title}</div>
                            <div style={{ fontSize: 10, color: "#5a8068", lineHeight: 1.5 }}>{e.description}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                )}
              </div>
            )}
          </div>
        )}

        {tab === "url" && (
          <div>
            <div
              style={{
                marginBottom: "1rem",
                padding: "12px 14px",
                border: "1px solid rgba(255,170,0,0.2)",
                borderRadius: 3,
                background: "rgba(255,170,0,0.03)",
                fontSize: 11,
                color: "#7a6a40",
                lineHeight: 1.7,
              }}
            >
              Paste any article URL — The Theorist will scrape the content, build a full investigation graph, identify conspiracy theories, patents, and key figures.{" "}
              <strong style={{ color: "#ffaa00" }}>Pro feature.</strong>
            </div>

            <div style={{ display: "flex", gap: 8, marginBottom: "1.5rem" }}>
              <input
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && analyzeUrl()}
                placeholder="https://www.theguardian.com/..."
                style={{ ...inp, color: "#ffaa00" }}
                onFocus={(e) => {
                  (e.target as HTMLInputElement).style.borderColor = "#ffaa00";
                }}
                onBlur={(e) => {
                  (e.target as HTMLInputElement).style.borderColor = "#1a3320";
                }}
              />
              <button
                type="button"
                onClick={() => analyzeUrl()}
                disabled={urlLoading}
                style={{
                  fontFamily: RAJ,
                  fontSize: 13,
                  fontWeight: 700,
                  letterSpacing: 2,
                  textTransform: "uppercase",
                  padding: "10px 20px",
                  borderRadius: 3,
                  border: "1px solid #ffaa00",
                  background: "transparent",
                  color: "#ffaa00",
                  cursor: "pointer",
                  opacity: urlLoading ? 0.5 : 1,
                }}
              >
                {urlLoading ? "ANALYZING..." : "ANALYZE ▶"}
              </button>
            </div>

            {urlLoading && (
              <div style={{ textAlign: "center", padding: "2rem 0", color: "#ffaa00", fontSize: 11, letterSpacing: 2 }}>
                <div style={{ marginBottom: 12 }}>[ SCRAPING + ANALYZING URL... ]</div>
                {[
                  "> Fetching article content...",
                  "> Extracting entities and context...",
                  "> Running Oracle analysis...",
                  "> Building investigation graph...",
                ].map((l, i) => (
                  <div key={i} style={{ color: "#7a6a20", marginBottom: 4 }}>
                    {l}
                  </div>
                ))}
              </div>
            )}

            {urlError && (
              <div style={{ padding: 12, border: "1px solid rgba(255,51,51,0.3)", borderRadius: 3, color: "#ff3333", fontSize: 11, marginBottom: "1rem" }}>
                [ERROR] {urlError}
                {urlError.includes("Sign in") ? (
                  <div style={{ marginTop: 8, fontSize: 10, color: "#5a2020" }}>
                    URL analysis requires a Pro account. Sign in and upgrade from the feed page.
                  </div>
                ) : null}
              </div>
            )}

            {urlResult && (
              <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                <div style={{ border: "1px solid #1a3320", borderRadius: 3, padding: "14px 16px", background: "#090f0b" }}>
                  <div style={{ fontSize: 9, color: "#5a8068", letterSpacing: 2, marginBottom: 6 }}>ANALYZED ARTICLE</div>
                  <div style={{ fontFamily: RAJ, fontSize: 16, fontWeight: 700, color: "#e8ffe8", marginBottom: 8, lineHeight: 1.3 }}>{urlResult.title}</div>
                  <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                    <span
                      style={{
                        fontSize: 10,
                        padding: "2px 10px",
                        border: `1px solid ${verdictColor(urlResult.verdict)}`,
                        color: verdictColor(urlResult.verdict),
                        borderRadius: 2,
                        letterSpacing: 1,
                      }}
                    >
                      {urlResult.verdict?.replace(/_/g, " ")}
                    </span>
                    <a href={urlResult.source_url} target="_blank" rel="noreferrer" style={{ fontSize: 10, color: "#00bb66", textDecoration: "none" }}>
                      ↗ Original article
                    </a>
                    {urlResult.id ? (
                      <Link href={`/board/url/${urlResult.id}`} style={{ fontSize: 10, color: "#00ff88", textDecoration: "none", border: "1px solid #00bb66", padding: "2px 8px", borderRadius: 2 }}>
                        ◈ OPEN INVESTIGATION BOARD ▶
                      </Link>
                    ) : null}
                  </div>
                </div>

                {urlResult.conclusion ? (
                  <div style={{ padding: "12px 14px", border: "1px solid #1a3320", borderRadius: 3, background: "rgba(0,255,136,0.02)", fontSize: 11, color: "#5a8068", lineHeight: 1.8 }}>
                    <span style={{ color: "#00bb66" }}>◈ ANALYSIS: </span>
                    {urlResult.conclusion}
                  </div>
                ) : null}

                {urlResult.theories?.length ? (
                  <div>
                    <div style={{ fontSize: 9, color: "#c94dff", letterSpacing: 3, marginBottom: 10 }}>
                      ◈ CONSPIRACY THEORIES IDENTIFIED ({urlResult.theories.length})
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {urlResult.theories.map((t, i) => (
                        <div
                          key={i}
                          style={{
                            border: "1px solid rgba(201,77,255,0.2)",
                            borderRadius: 3,
                            padding: "11px 13px",
                            background: "rgba(20,8,24,0.8)",
                            display: "flex",
                            gap: 14,
                            alignItems: "flex-start",
                          }}
                        >
                          <div style={{ fontFamily: RAJ, fontSize: 26, fontWeight: 700, color: scoreColor(t.probability), flexShrink: 0, lineHeight: 1 }}>{t.probability}%</div>
                          <div>
                            <div style={{ fontFamily: RAJ, fontSize: 13, fontWeight: 700, color: "#e9b3ff", marginBottom: 5 }}>{t.name}</div>
                            <div style={{ fontSize: 11, color: "#7a5a88", lineHeight: 1.6 }}>{t.summary}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            )}

            {!urlResult && !urlLoading ? (
              <div style={{ marginTop: "2rem" }}>
                <div style={{ fontSize: 9, color: "#2a4030", letterSpacing: 3, marginBottom: 10 }}>
                  EXAMPLE SOURCES TO ANALYZE
                </div>
                {["https://www.theguardian.com/technology/", "https://www.theguardian.com/science/", "https://www.theguardian.com/world/"].map((u, i) => (
                  <div
                    key={i}
                    role="button"
                    tabIndex={0}
                    onClick={() => setUrlInput(u)}
                    onKeyDown={(e) => e.key === "Enter" && setUrlInput(u)}
                    style={{ fontSize: 10, color: "#2a4030", padding: "6px 0", cursor: "pointer", letterSpacing: 1, borderBottom: "1px solid #0d1a10" }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLDivElement).style.color = "#00bb66";
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLDivElement).style.color = "#2a4030";
                    }}
                  >
                    ↗ {u}
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
