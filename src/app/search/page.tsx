"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import SiteNav from "@/components/SiteNav";
import ReferenceDocumentIndex from "@/components/ReferenceDocumentIndex";
import { normalizeVerdict } from "@/lib/verdict";
import { getSupabaseBrowserClient } from "@/lib/supabase";
import { pageContentShellStyle } from "@/lib/pageShell";
import { searchTypo as T, searchColor as C } from "@/lib/searchTheme";

const FONT = "var(--font-share-tech-mono), monospace";
const RAJ = "var(--font-raj), sans-serif";

type SearchResult = {
  query: string;
  news: Array<{ id: string; title: string; summary: string; section: string; score: number; angle: string }>;
  theories: Array<{ name: string; summary: string; probability: number; sources: string[]; tags: string[] }>;
  patents: Array<{ number: string; title: string; assignee: string; year: number; relevance: string; url: string }>;
  people: Array<{ name: string; role: string; affiliation: string; significance: string }>;
  events: Array<{ date: string; title: string; description: string }>;
  requires_login?: boolean;
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

function SectionLabel({ children, color }: { children: React.ReactNode; color: string }) {
  return (
    <div style={{
      fontSize: T.sectionLabel, color, letterSpacing: 1.5, marginBottom: 14,
      textTransform: "uppercase", display: "flex", alignItems: "center", gap: 8,
      paddingBottom: 10, borderBottom: `1px solid ${color}22`,
    }}>
      {children}
    </div>
  );
}

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
  const [tab, setTab] = useState<"search" | "url" | "index">("search");
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [threatFilter, setThreatFilter] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<SearchResult | null>(null);
  const [sessionToken, setSessionToken] = useState<string | null>(null);

  const [urlInput, setUrlInput] = useState("");
  const [urlLoading, setUrlLoading] = useState(false);
  const [urlResult, setUrlResult] = useState<UrlResult | null>(null);
  const [urlError, setUrlError] = useState("");
  const [searchError, setSearchError] = useState("");

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    void supabase.auth.getSession().then(({ data }) => {
      setSessionToken(data.session?.access_token ?? null);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSessionToken(session?.access_token ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  async function doSearch(q = query) {
    if (!q.trim()) return;
    setSearching(true);
    setSearchError("");
    setResults(null);
    try {
      const params = new URLSearchParams({ q: q.trim(), type: typeFilter, threat: threatFilter });
      const headers: HeadersInit = sessionToken
        ? { Authorization: `Bearer ${sessionToken}` }
        : {};
      const res = await fetch(`/api/search?${params}`, { headers });
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
    padding: "0 16px",
    minHeight: T.controlMinH,
    lineHeight: 1.45,
    color: "#00ff88",
    fontFamily: FONT,
    fontSize: T.input,
    outline: "none",
    flex: 1,
    transition: "border-color 0.2s",
    boxSizing: "border-box",
  };

  const primaryBtn: React.CSSProperties = {
    fontFamily: RAJ,
    fontSize: T.btn,
    fontWeight: 700,
    letterSpacing: 2,
    textTransform: "uppercase",
    padding: "0 22px",
    minHeight: T.controlMinH,
    borderRadius: 3,
    cursor: "pointer",
    boxSizing: "border-box",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  };

  return (
    <div style={{ minHeight: "100vh", background: "#050c07", color: "#c8e8d0", fontFamily: FONT }}>
      <div className="scanline" />
      <div style={{ position: "relative", zIndex: 1 }}>

        {/* ── HEADER BAR — matches feed / article header ──────────── */}
        <header style={{
          height: 48,
          background: "#050c07",
          borderBottom: "1px solid #1a3320",
          display: "flex",
          alignItems: "center",
          padding: "0 20px",
          gap: 14,
          flexShrink: 0,
        }}>
          <Link href="/" style={{ fontSize: 10, color: "#5a8068", textDecoration: "none", letterSpacing: 2, border: "1px solid #1a3320", padding: "4px 10px", borderRadius: 3, whiteSpace: "nowrap" }}>
            ← FEED
          </Link>
          <div style={{ width: 1, height: 20, background: "#1a3320", flexShrink: 0 }} />
          <div style={{ fontFamily: RAJ, fontSize: 16, fontWeight: 700, color: "#00ff88", letterSpacing: 3, textTransform: "uppercase", textShadow: "0 0 14px rgba(0,255,136,0.3)", whiteSpace: "nowrap" }}>
            THE THEORIST
          </div>
          <div style={{ width: 1, height: 20, background: "#1a3320", flexShrink: 0 }} />
          <div style={{ fontSize: 9, color: "#5a8068", letterSpacing: 2, whiteSpace: "nowrap" }}>INTELLIGENCE SEARCH</div>
          <div style={{ marginLeft: "auto", flexShrink: 0 }}>
            <SiteNav />
          </div>
        </header>

        {/* ── PAGE CONTENT ─────────────────────────────────────────── */}
        <div style={pageContentShellStyle()}>

        {/* Section title */}
        <div style={{ marginBottom: "1.5rem", paddingBottom: "1rem", borderBottom: "1px solid #1a3320" }}>
          <div style={{ fontFamily: RAJ, fontSize: 22, fontWeight: 700, color: "#00ff88", letterSpacing: 2, textTransform: "uppercase", marginBottom: 6 }}>
            INTELLIGENCE SEARCH
          </div>
          <div style={{ fontSize: 12, color: C.faint, letterSpacing: 1.5 }}>
            CONSPIRACY THEORIES · PATENTS · PEOPLE · URL ANALYSIS · REFERENCE INDEX
          </div>
        </div>

        <div style={{ display: "flex", gap: 6, marginBottom: "1.5rem", flexWrap: "wrap" }}>
          {[
            { key: "search", label: "◈ SEARCH DATABASE" },
            { key: "url", label: "◈ ANALYZE URL" },
            { key: "index", label: "◈ REFERENCE INDEX" },
          ].map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key as "search" | "url" | "index")}
              style={{
                fontFamily: RAJ,
                fontSize: T.tab,
                fontWeight: 700,
                letterSpacing: 2,
                textTransform: "uppercase",
                padding: "10px 20px",
                borderRadius: 3,
                cursor: "pointer",
                border: `1px solid ${tab === t.key ? "#00bb66" : "#1a3320"}`,
                background: tab === t.key ? "rgba(0,255,136,0.08)" : "transparent",
                color: tab === t.key ? "#00ff88" : C.muted,
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
                  ...primaryBtn,
                  border: "1px solid #00bb66",
                  background: "transparent",
                  color: "#00ff88",
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
                      fontSize: T.filterPill,
                      fontWeight: 700,
                      letterSpacing: 1,
                      textTransform: "uppercase",
                      padding: "8px 14px",
                      borderRadius: 2,
                      cursor: "pointer",
                      border: `1px solid ${typeFilter === f.value ? "#00bb66" : "#1a3320"}`,
                      background: typeFilter === f.value ? "rgba(0,255,136,0.06)" : "transparent",
                      color: typeFilter === f.value ? "#00ff88" : C.muted,
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
                      fontSize: T.filterPill,
                      fontWeight: 700,
                      letterSpacing: 1,
                      textTransform: "uppercase",
                      padding: "8px 14px",
                      borderRadius: 2,
                      cursor: "pointer",
                      border: `1px solid ${threatFilter === f.value ? "#ffaa00" : "#1a3320"}`,
                      background: threatFilter === f.value ? "rgba(255,170,0,0.06)" : "transparent",
                      color: threatFilter === f.value ? "#ffaa00" : C.muted,
                    }}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {!results && !searching && (
              <div style={{ marginBottom: "2rem" }}>
                <div style={{ fontSize: T.sectionLabel, color: C.dim, letterSpacing: 1.5, marginBottom: 12, textTransform: "uppercase" }}>
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
                        fontSize: T.bodyTight,
                        padding: "8px 16px",
                        border: "1px solid #1a3320",
                        borderRadius: 20,
                        color: C.muted,
                        background: "transparent",
                        cursor: "pointer",
                        letterSpacing: 0.5,
                        transition: "all 0.15s",
                        fontFamily: FONT,
                      }}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLButtonElement).style.borderColor = "#00bb66";
                        (e.currentTarget as HTMLButtonElement).style.color = "#00ff88";
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLButtonElement).style.borderColor = "#1a3320";
                        (e.currentTarget as HTMLButtonElement).style.color = C.muted;
                      }}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {searching && (
              <div style={{ textAlign: "center", padding: "3rem 0", color: "#00bb66", fontSize: T.bodyTight, letterSpacing: 1.5 }}>
                <div style={{ marginBottom: 16 }}>[ SCANNING INTELLIGENCE DATABASES... ]</div>
                {[
                  "> Cross-referencing CIA FOIA archives...",
                  "> Searching USPTO patent corpus...",
                  "> Profiling associated individuals...",
                  "> Building conspiracy connection map...",
                ].map((l, i) => (
                  <div key={i} style={{ color: C.scanLine, marginBottom: 6, fontSize: T.caption, lineHeight: 1.6 }}>
                    {l}
                  </div>
                ))}
              </div>
            )}

            {searchError && (
              <div style={{ padding: 14, border: "1px solid rgba(255,51,51,0.3)", borderRadius: 3, color: "#ff3333", fontSize: T.bodyTight, marginBottom: "1rem", lineHeight: 1.6 }}>
                [ERROR] {searchError}
              </div>
            )}

            {results && (
              <div style={{ display: "flex", flexDirection: "column", gap: "2.5rem" }}>

                {/* ── GUEST GATE BANNER ─────────────────────────────── */}
                {results.requires_login && (
                  <div style={{
                    border: "1px solid rgba(255,170,0,0.4)",
                    borderRadius: 6,
                    padding: "18px 20px",
                    background: "linear-gradient(180deg, rgba(255,170,0,0.07) 0%, transparent 60%)",
                    display: "flex",
                    gap: 18,
                    alignItems: "flex-start",
                    flexWrap: "wrap",
                  }}>
                    <div style={{ flex: 1, minWidth: 220 }}>
                      <div style={{ fontFamily: RAJ, fontSize: 10, fontWeight: 700, letterSpacing: 4, color: "#ffaa33", marginBottom: 6 }}>
                        ⚠ REGISTER FOR FULL INTELLIGENCE ANALYSIS
                      </div>
                      <div style={{ fontFamily: RAJ, fontSize: 15, fontWeight: 700, color: "#ffcc88", marginBottom: 8 }}>
                        AI analysis locked — DB results only
                      </div>
                      <div style={{ fontFamily: FONT, fontSize: 11, color: "#8aaa96", lineHeight: 1.7 }}>
                        Free accounts unlock conspiracy theory matching, USPTO patent cross-reference, key figures, and related historical events for every query. No credit card required.
                      </div>
                    </div>
                    <a
                      href="/"
                      style={{
                        fontFamily: RAJ,
                        fontSize: 12,
                        fontWeight: 700,
                        letterSpacing: 2,
                        textTransform: "uppercase",
                        padding: "10px 18px",
                        border: "1px solid #00bb66",
                        background: "rgba(0,255,136,0.08)",
                        color: "#00ff88",
                        textDecoration: "none",
                        borderRadius: 4,
                        alignSelf: "center",
                        whiteSpace: "nowrap",
                      }}
                    >
                      SIGN UP FREE →
                    </a>
                  </div>
                )}

                {/* ── MATCHING ARTICLES ─────────────────────────────── */}
                {results.news.length > 0 && (
                  <section>
                    <SectionLabel color="#00bb66">◈ MATCHING ARTICLES IN FEED ({results.news.length})</SectionLabel>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(420px, 1fr))", gap: 10 }}>
                      {results.news.map((n) => (
                        <Link key={n.id} href={`/board/${n.id}`} style={{ textDecoration: "none" }}>
                          <div
                            className="result-card"
                            style={{ border: "1px solid #1a3320", borderRadius: 5, padding: "14px 16px", background: "#090f0b", height: "100%", cursor: "pointer", transition: "border-color 0.15s" }}
                            onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = "#00bb66"; }}
                            onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = "#1a3320"; }}
                          >
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8, gap: 12 }}>
                              <span style={{ fontSize: T.caption, color: C.muted, letterSpacing: 0.5, textTransform: "uppercase" }}>{n.section}</span>
                              <span style={{ fontSize: T.caption, color: scoreColor(n.score), border: `1px solid ${scoreColor(n.score)}`, padding: "2px 8px", borderRadius: 2, flexShrink: 0 }}>
                                {n.score}%
                              </span>
                            </div>
                            <div style={{ fontFamily: RAJ, fontSize: T.cardTitle, fontWeight: 700, color: C.textBright, lineHeight: 1.4, marginBottom: 8 }}>{n.title}</div>
                            {n.angle ? <div style={{ fontSize: T.meta, color: C.muted, lineHeight: 1.5 }}>▸ {n.angle}</div> : null}
                          </div>
                        </Link>
                      ))}
                    </div>
                  </section>
                )}

                {/* ── CONSPIRACY THEORIES ───────────────────────────── */}
                {results.theories.length > 0 && (
                  <section>
                    <SectionLabel color="#ff6666">◈ CONSPIRACY THEORIES ({results.theories.length})</SectionLabel>
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      {results.theories.map((t, i) => (
                        <div key={i} style={{ border: "1px solid #1f2a20", borderRadius: 5, padding: "18px 20px", background: "#090f0b" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10, gap: 16 }}>
                            <div style={{ fontFamily: RAJ, fontSize: T.cardTitleAccent, fontWeight: 700, color: C.textBright, lineHeight: 1.35, minWidth: 0 }}>{t.name}</div>
                            <div style={{ fontFamily: RAJ, fontSize: T.scoreMd, fontWeight: 700, color: scoreColor(t.probability), flexShrink: 0, letterSpacing: -0.5 }}>{t.probability}%</div>
                          </div>
                          <div style={{ fontSize: T.body, color: C.mutedStrong, lineHeight: 1.7, marginBottom: 14 }}>{t.summary}</div>
                          {t.tags?.length > 0 && (
                            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
                              {t.tags.map((tag, j) => (
                                <span key={j} style={{ fontSize: T.caption, padding: "4px 10px", border: "1px solid #1a3320", borderRadius: 10, color: C.muted }}>
                                  {tag}
                                </span>
                              ))}
                            </div>
                          )}
                          {t.sources
                            ?.filter((s) => /^https?:\/\//.test(s))
                            .slice(0, 3)
                            .map((s, j) => (
                              <a key={j} href={s} target="_blank" rel="noreferrer"
                                style={{ display: "block", fontSize: T.meta, color: "#00bb66", textDecoration: "none", marginBottom: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                ↗ {s}
                              </a>
                            ))}
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {/* ── PATENTS ───────────────────────────────────────── */}
                {results.patents.length > 0 && (
                  <section>
                    <SectionLabel color="#ff8888">◈ RELATED PATENTS ({results.patents.length})</SectionLabel>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(420px, 1fr))", gap: 10 }}>
                      {results.patents.map((p, i) => (
                        <a key={i} href={p.url} target="_blank" rel="noreferrer" style={{ textDecoration: "none" }}>
                          <div
                            style={{ border: "1px solid rgba(255,100,100,0.2)", borderRadius: 5, padding: "16px 18px", background: "rgba(20,8,8,0.9)", cursor: "pointer", transition: "border-color 0.15s", height: "100%" }}
                            onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = "#ff6666"; }}
                            onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(255,100,100,0.2)"; }}
                          >
                            <div style={{ fontSize: T.caption, color: "#ff9999", letterSpacing: 0.5, marginBottom: 8 }}>
                              {p.number} · {p.year}
                            </div>
                            <div style={{ fontFamily: RAJ, fontSize: T.cardTitle, fontWeight: 700, color: "#ffe8e8", lineHeight: 1.4, marginBottom: 8 }}>{p.title}</div>
                            <div style={{ fontSize: T.meta, color: C.patentMeta, marginBottom: 10 }}>{p.assignee}</div>
                            <div style={{ fontSize: T.body, color: C.patentBody, lineHeight: 1.65 }}>{p.relevance}</div>
                          </div>
                        </a>
                      ))}
                    </div>
                  </section>
                )}

                {/* ── KEY FIGURES ───────────────────────────────────── */}
                {results.people.length > 0 && (
                  <section>
                    <SectionLabel color="#00dd77">◈ KEY FIGURES ({results.people.length})</SectionLabel>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 10 }}>
                      {results.people.map((p, i) => (
                        <div key={i} style={{ border: "1px solid rgba(0,187,102,0.2)", borderRadius: 5, padding: "16px 18px", background: "rgba(5,18,12,0.9)" }}>
                          <div style={{ fontFamily: RAJ, fontSize: T.cardTitleAccent, fontWeight: 700, color: "#00ff88", marginBottom: 6 }}>{p.name}</div>
                          <div style={{ fontSize: T.meta, color: C.muted, marginBottom: 6 }}>{p.affiliation}</div>
                          <div style={{ fontSize: T.bodyTight, color: C.peopleRole, fontStyle: "italic", marginBottom: 10, paddingBottom: 10, borderBottom: "1px solid #0d1e14" }}>{p.role}</div>
                          <div style={{ fontSize: T.body, color: C.mutedStrong, lineHeight: 1.65 }}>{p.significance}</div>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {/* ── RELATED EVENTS ────────────────────────────────── */}
                {results.events.length > 0 && (
                  <section>
                    <SectionLabel color="#ffcc44">◈ RELATED EVENTS ({results.events.length})</SectionLabel>
                    <div style={{ borderLeft: "2px solid #1a3320", paddingLeft: 20, display: "flex", flexDirection: "column", gap: 0 }}>
                      {results.events.map((e, i) => (
                        <div key={i} style={{ display: "flex", gap: 24, padding: "12px 0", borderBottom: "1px solid #0d1a10" }}>
                          <div style={{ fontSize: T.meta, color: "#ffcc66", whiteSpace: "nowrap", letterSpacing: 0.3, minWidth: 110, paddingTop: 2 }}>{e.date}</div>
                          <div>
                            <div style={{ fontFamily: RAJ, fontSize: T.cardTitle, fontWeight: 700, color: "#f0f0d8", marginBottom: 5 }}>{e.title}</div>
                            <div style={{ fontSize: T.body, color: C.mutedStrong, lineHeight: 1.65 }}>{e.description}</div>
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

        {tab === "index" && (
          <div>
            <ReferenceDocumentIndex />
          </div>
        )}

        {tab === "url" && (
          <div>
            <div
              style={{
                marginBottom: "1rem",
                padding: "14px 16px",
                border: "1px solid rgba(255,170,0,0.2)",
                borderRadius: 3,
                background: "rgba(255,170,0,0.03)",
                fontSize: T.body,
                color: C.urlInfo,
                lineHeight: 1.65,
              }}
            >
              Paste a news article, blog post, or a public social link (X/Twitter, Reddit, Bluesky, Threads). Short links{" "}
              <span style={{ fontFamily: FONT, fontSize: T.caption, color: "#00ff88", background: "rgba(0,255,136,0.07)", padding: "2px 8px", borderRadius: 2 }}>t.co</span> /{" "}
              <span style={{ fontFamily: FONT, fontSize: T.caption, color: "#00ff88", background: "rgba(0,255,136,0.07)", padding: "2px 8px", borderRadius: 2 }}>redd.it</span> are expanded automatically. Reddit uses the JSON API; X and Threads use oEmbed; Bluesky uses the public ATProto API. YouTube gets title/channel via oEmbed only (no transcript). Facebook and private or login-gated posts may still fail. The Theorist then runs Oracle on the extracted text.{" "}
              <strong style={{ color: "#ffaa00" }}>Pro feature.</strong>
            </div>

            <div style={{ display: "flex", gap: 8, marginBottom: "1.5rem" }}>
              <input
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && analyzeUrl()}
                placeholder="https://… (Guardian, X, Reddit, Bluesky, Threads, YouTube…)"
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
                  ...primaryBtn,
                  border: "1px solid #ffaa00",
                  background: "transparent",
                  color: "#ffaa00",
                  opacity: urlLoading ? 0.5 : 1,
                }}
              >
                {urlLoading ? "ANALYZING..." : "ANALYZE ▶"}
              </button>
            </div>

            {urlLoading && (
              <div style={{ textAlign: "center", padding: "2rem 0", color: "#ffaa00", fontSize: T.bodyTight, letterSpacing: 1.5 }}>
                <div style={{ marginBottom: 12 }}>[ SCRAPING + ANALYZING URL... ]</div>
                {[
                  "> Fetching article content...",
                  "> Extracting entities and context...",
                  "> Running Oracle analysis...",
                  "> Building investigation graph...",
                ].map((l, i) => (
                  <div key={i} style={{ color: "#b8a060", marginBottom: 6, fontSize: T.caption, lineHeight: 1.6 }}>
                    {l}
                  </div>
                ))}
              </div>
            )}

            {urlError && (
              <div style={{ padding: 14, border: "1px solid rgba(255,51,51,0.3)", borderRadius: 3, color: "#ff3333", fontSize: T.bodyTight, marginBottom: "1rem", lineHeight: 1.6 }}>
                [ERROR] {urlError}
                {urlError.includes("Sign in") ? (
                  <div style={{ marginTop: 10, fontSize: T.meta, color: "#cc8888" }}>
                    URL analysis requires a Pro account. Sign in and upgrade from the feed page.
                  </div>
                ) : null}
              </div>
            )}

            {urlResult && (
              <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                <div style={{ border: "1px solid #1a3320", borderRadius: 3, padding: "14px 16px", background: "#090f0b" }}>
                  <div style={{ fontSize: T.sectionLabel, color: C.muted, letterSpacing: 1, marginBottom: 8 }}>ANALYZED ARTICLE</div>
                  <div style={{ fontFamily: RAJ, fontSize: T.cardTitleAccent, fontWeight: 700, color: C.textBright, marginBottom: 10, lineHeight: 1.35 }}>{urlResult.title}</div>
                  <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                    <span
                      style={{
                        fontSize: T.caption,
                        padding: "4px 12px",
                        border: `1px solid ${verdictColor(urlResult.verdict)}`,
                        color: verdictColor(urlResult.verdict),
                        borderRadius: 2,
                        letterSpacing: 0.5,
                      }}
                    >
                      {urlResult.verdict?.replace(/_/g, " ")}
                    </span>
                    <a href={urlResult.source_url} target="_blank" rel="noreferrer" style={{ fontSize: T.meta, color: "#00bb66", textDecoration: "none" }}>
                      ↗ Original article
                    </a>
                    {urlResult.id ? (
                      <Link href={`/board/url/${urlResult.id}`} style={{ fontSize: T.meta, color: "#00ff88", textDecoration: "none", border: "1px solid #00bb66", padding: "4px 10px", borderRadius: 2 }}>
                        ◈ OPEN INVESTIGATION BOARD ▶
                      </Link>
                    ) : null}
                  </div>
                </div>

                {urlResult.conclusion ? (
                  <div style={{ padding: "14px 16px", border: "1px solid #1a3320", borderRadius: 3, background: "rgba(0,255,136,0.02)", fontSize: T.body, color: C.mutedStrong, lineHeight: 1.65 }}>
                    <span style={{ color: "#00bb66" }}>◈ ANALYSIS: </span>
                    {urlResult.conclusion}
                  </div>
                ) : null}

                {urlResult.theories?.length ? (
                  <div>
                    <div style={{ fontSize: T.sectionLabel, color: "#d8a8ff", letterSpacing: 1.5, marginBottom: 12 }}>
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
                          <div style={{ fontFamily: RAJ, fontSize: T.scoreHero, fontWeight: 700, color: scoreColor(t.probability), flexShrink: 0, lineHeight: 1 }}>{t.probability}%</div>
                          <div>
                            <div style={{ fontFamily: RAJ, fontSize: T.cardTitle, fontWeight: 700, color: "#e9b3ff", marginBottom: 6 }}>{t.name}</div>
                            <div style={{ fontSize: T.body, color: C.urlTheorySummary, lineHeight: 1.65 }}>{t.summary}</div>
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
                <div style={{ fontSize: T.sectionLabel, color: C.muted, letterSpacing: 1.5, marginBottom: 12 }}>
                  EXAMPLE SOURCES TO ANALYZE
                </div>
                {["https://www.theguardian.com/technology/", "https://www.theguardian.com/science/", "https://www.theguardian.com/world/"].map((u, i) => (
                  <div
                    key={i}
                    role="button"
                    tabIndex={0}
                    onClick={() => setUrlInput(u)}
                    onKeyDown={(e) => e.key === "Enter" && setUrlInput(u)}
                    style={{ fontSize: T.meta, color: C.urlExample, padding: "8px 0", cursor: "pointer", letterSpacing: 0.3, borderBottom: "1px solid #0d1a10" }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLDivElement).style.color = C.urlExampleHover;
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLDivElement).style.color = C.urlExample;
                    }}
                  >
                    ↗ {u}
                  </div>
                ))}
                <div style={{ fontSize: T.bodyTight, color: C.muted, marginTop: 16, lineHeight: 1.65, letterSpacing: 0.2 }}>
                  Social: paste a direct post URL — e.g. <span style={{ color: C.mutedStrong }}>x.com/…/status/…</span>,{" "}
                  <span style={{ color: C.mutedStrong }}>reddit.com/…/comments/&lt;id&gt;/…</span>,{" "}
                  <span style={{ color: C.mutedStrong }}>bsky.app/profile/…/post/…</span>, or a Threads permalink.
                </div>
              </div>
            ) : null}
          </div>
        )}
        </div>{/* /pageContentShellStyle */}
      </div>{/* /position:relative */}
    </div>
  );
}
