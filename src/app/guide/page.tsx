"use client";

import Link from "next/link";
import { pageContentShellStyle } from "@/lib/pageShell";

const FONT = "var(--font-share-tech-mono), monospace";
const RAJ = "var(--font-raj), sans-serif";

function Badge({ label, color }: { label: string; color: string }) {
  return (
    <span style={{ fontFamily: RAJ, fontSize: 10, fontWeight: 700, color, border: `1px solid ${color}`, padding: "2px 8px", borderRadius: 2, letterSpacing: 1, flexShrink: 0, whiteSpace: "nowrap" }}>
      {label}
    </span>
  );
}

function Row({ label, color = "#00ff88", children }: { label: string; color?: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", gap: 10, marginBottom: 9, alignItems: "flex-start" }}>
      <Badge label={label} color={color} />
      <span style={{ fontFamily: FONT, fontSize: 12, color: "#7aaa8a", lineHeight: 1.75 }}>{children}</span>
    </div>
  );
}

function Section({ icon, title, color = "#00ff88", children }: { icon: string; title: string; color?: string; children: React.ReactNode }) {
  return (
    <div style={{ borderBottom: "1px solid #1a3320", paddingBottom: 24, marginBottom: 24 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <span style={{ fontSize: 14, color }}>{icon}</span>
        <span style={{ fontFamily: RAJ, fontSize: 14, fontWeight: 700, color, letterSpacing: 2, textTransform: "uppercase" }}>{title}</span>
      </div>
      {children}
    </div>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return <p style={{ fontFamily: FONT, fontSize: 12, color: "#5a8068", lineHeight: 1.8, margin: "0 0 10px" }}>{children}</p>;
}

function Sub({ children }: { children: React.ReactNode }) {
  return <div style={{ fontFamily: RAJ, fontSize: 11, fontWeight: 700, color: "#c8e8d0", letterSpacing: 2, marginBottom: 8, marginTop: 14, textTransform: "uppercase" }}>{children}</div>;
}

export default function GuidePage() {
  return (
    <div style={{ minHeight: "100vh", background: "#050c07", color: "#c8e8d0", fontFamily: FONT }}>
      <div className="scanline" />
      <div style={{ position: "relative", zIndex: 1 }}>

        {/* NAV — doc page: one exit to feed (article readers keep ← ANALYSIS + ← FEED) */}
        <div style={{ height: 44, background: "#050c07", borderBottom: "1px solid #1a3320", display: "flex", alignItems: "center", padding: "0 16px", gap: 12, flexWrap: "wrap" }}>
          <Link href="/" style={{ fontSize: 10, color: "#5a8068", textDecoration: "none", letterSpacing: 2, border: "1px solid #1a3320", padding: "4px 10px", borderRadius: 3, fontFamily: RAJ, fontWeight: 700 }}>← FEED</Link>
          <div style={{ width: 1, height: 20, background: "#1a3320", flexShrink: 0 }} />
          <div style={{ fontFamily: RAJ, fontSize: 14, fontWeight: 700, color: "#00ff88", letterSpacing: 2 }}>THE THEORIST</div>
          <div style={{ width: 1, height: 20, background: "#1a3320", flexShrink: 0 }} />
          <div style={{ fontFamily: RAJ, fontSize: 11, color: "#5a8068", letterSpacing: 2 }}>PLATFORM GUIDE</div>
        </div>

        <div style={pageContentShellStyle({ paddingBottom: "5rem" })}>

          {/* HEADER */}
          <div style={{ marginBottom: "2rem", paddingBottom: "1.25rem", borderBottom: "1px solid #1a3320" }}>
            <div style={{ fontFamily: RAJ, fontSize: 9, letterSpacing: 5, color: "#3a5040", marginBottom: 6, textTransform: "uppercase" }}>■ INTELLIGENCE PLATFORM DOCUMENTATION ■</div>
            <h1 style={{ fontFamily: RAJ, fontSize: 28, fontWeight: 700, color: "#00ff88", letterSpacing: 2, margin: "0 0 8px", textShadow: "0 0 20px rgba(0,255,136,0.2)" }}>
              Platform Guide
            </h1>
            <p style={{ fontSize: 12, color: "#5a8068", margin: 0 }}>Quick reference for every feature on The Theorist — aligned with the live UI (nav, article headers, board).</p>
          </div>

          {/* SITE MAP */}
          <Section icon="☰" title={"Site map & naming"} color="#5a8068">
            <Note>The top nav (desktop and mobile menu) is the source of truth for labels and URLs.</Note>
            <Sub>Main navigation</Sub>
            <Row label="FEED" color="#00ff88">Home <code style={{ color: "#3a5040" }}>/</code> — priority-scored news stream.</Row>
            <Row label="UAP FILES" color="#8aa6ff">Dedicated UAP database <code style={{ color: "#3a5040" }}>/uap</code>.</Row>
            <Row label="OUTBREAKS" color="#ff3333">Health alerts <code style={{ color: "#3a5040" }}>/outbreaks</code>.</Row>
            <Row label="INSIDER RADAR" color="#ffaa00">Live insider feed <code style={{ color: "#3a5040" }}>/insider-radar</code> — UAP researchers, whistleblowers, journalists, Congress (see section below).</Row>
            <Row label="COMMUNITY" color="#00bb66">OSINT board <code style={{ color: "#3a5040" }}>/community</code>.</Row>
            <Row label="ANALYSIS" color="#c94dff">Investigation <strong style={{ color: "#c8e8d0" }}>Reports</strong> index <code style={{ color: "#3a5040" }}>/blog</code> — long-form published reports (not the Oracle engine).</Row>
            <Row label="SEARCH" color="#5a8068">Full-text + URL tools <code style={{ color: "#3a5040" }}>/search</code>.</Row>
            <Row label="GUIDE" color="#5a8068">This page <code style={{ color: "#3a5040" }}>/guide</code>.</Row>
            <Sub>Do not confuse</Sub>
            <Row label="ANALYSIS" color="#c94dff">Product area: the <code style={{ color: "#3a5040" }}>/blog</code> report list and each report at <code style={{ color: "#3a5040" }}>/blog/[slug]</code>.</Row>
            <Row label="ORACLE" color="#00ff88">The GPT-4o investigation engine: graph + verdicts + cached analysis. Invoked from the Investigation Board (and explicitly on UAP with ◈ RUN ORACLE ANALYSIS ▶).</Row>
            <Row label="BOARD" color="#00bb66">Investigation Board at <code style={{ color: "#3a5040" }}>/board/[id]</code> — same <code style={{ color: "#3a5040" }}>id</code> as the feed article or generated report.</Row>
            <Sub>Feed and report readers</Sub>
            <Note>This <code style={{ color: "#3a5040" }}>/guide</code> page keeps a minimal header: only <strong style={{ color: "#c8e8d0" }}>← FEED</strong> (home). Feed article reader <code style={{ color: "#3a5040" }}>/article/[id]</code> and report reader <code style={{ color: "#3a5040" }}>/blog/[slug]</code> use both <strong style={{ color: "#c8e8d0" }}>← ANALYSIS</strong> (to <code style={{ color: "#3a5040" }}>/blog</code>) and <strong style={{ color: "#c8e8d0" }}>← FEED</strong>, plus <strong style={{ color: "#c8e8d0" }}>◈ BOARD ▶</strong> on the right for <code style={{ color: "#3a5040" }}>/board/[id]</code>. The floating dock uses ◈ OPEN INVESTIGATION BOARD ▶.</Note>
          </Section>

          {/* FEED */}
          <Section icon="◈" title="Main Feed" color="#00ff88">
            <Note>Homepage collects articles from Guardian API, Google News, Reddit and FOIA databases. GPT-4o assigns a priority / threat score (0–100). Only articles scoring 70+ are shown.</Note>
            <Sub>News card</Sub>
            <Row label="THREAT: 82" color="#ff3333">AI risk score. 80+ = high (red), 70–79 = elevated (red). Below 70 is hidden from the feed.</Row>
            <Row label="TIER A" color="#ffaa00">Source tier — A = official/primary (Guardian, FOIA), B = established media, C = community/unverified.</Row>
            <Row label={"◈ READ & INVESTIGATE ▶"} color="#00ff88">Opens the article reader (<code style={{ color: "#3a5040" }}>/article/[id]</code>). From there, open the Board; optional per-article live chat appears in the dock only when <code style={{ color: "#3a5040" }}>NEXT_PUBLIC_LIVE_CHAT_ENABLED=true</code> is set on deploy. Oracle runs in the board context when needed.</Row>
            <Sub>Status bar</Sub>
            <Note>Green dots = active data source. Yellow = degraded/idle. Red = error. DARPA: ████ is intentionally redacted — symbolises partially classified defence data.</Note>
          </Section>

          {/* ANALYSIS / BLOG */}
          <Section icon="▤" title={"Analysis — Investigation Reports"} color="#c94dff">
            <Note><code style={{ color: "#3a5040" }}>/blog</code> lists published deep-dive reports (stored as generated articles). Each row links to <code style={{ color: "#3a5040" }}>/blog/[slug]</code> for the full read experience.</Note>
            <Sub>Board link</Sub>
            <Row label="SAME ID" color="#00bb66">A report&apos;s Investigation Board uses the same id in <code style={{ color: "#3a5040" }}>/board/[id]</code> as the underlying generated article — consistent with the ◈ BOARD ▶ control on the report page.</Row>
            <Sub>Top bar</Sub>
            <Note>Report pages mirror feed readers: ← ANALYSIS → list, ← FEED → home, BOARD on the right; ↗ REPORT may point to the current slug where the layout provides it.</Note>
          </Section>

          {/* INVESTIGATION BOARD */}
          <Section icon="⬡" title="Investigation Board" color="#00bb66">
            <Note>Interactive graph generated per article or report. The centre node is the story; surrounding nodes are AI-discovered actors, documents, companies and patents.</Note>
            <Sub>Getting here</Sub>
            <Row label="FROM FEED" color="#5a8068">Article reader → ◈ BOARD ▶ or dock ◈ OPEN INVESTIGATION BOARD ▶ → <code style={{ color: "#3a5040" }}>/board/[newsId]</code>.</Row>
            <Row label="FROM REPORT" color="#5a8068">Report reader → same BOARD controls → <code style={{ color: "#3a5040" }}>/board/[id]</code>. Back link on the board shows ← REPORT to return to the blog slug.</Row>
            <Sub>Oracle on the board</Sub>
            <Note>For feed-sourced news, if no cached Oracle JSON exists, the board requests a new analysis after you sign in (subject to plan limits). If a cache hit exists, it loads immediately — free users can read cached runs; triggering fresh runs may require PRO where enforced.</Note>
            <Sub>Node colours</Sub>
            <Row label="GREEN" color="#00ff88">Article (centre), confirmed sources.</Row>
            <Row label="RED" color="#ff3333">FOIA document or high-threat connection.</Row>
            <Row label="YELLOW" color="#ffaa00">Company / government agency.</Row>
            <Row label="PURPLE" color="#c94dff">Conspiracy theory or hypothesis identified by Oracle.</Row>
            <Sub>Navigation</Sub>
            <Row label="PAN" color="#5a8068">Click + drag background to pan.</Row>
            <Row label="ZOOM" color="#5a8068">Mouse wheel / touchpad pinch.</Row>
            <Row label="CLICK NODE" color="#5a8068">Opens the right detail panel — source tier, URL, threat score, key claims, counter-evidence, timeline and actors.</Row>
            <Sub>Back</Sub>
            <Row label="← ARTICLE" color="#5a8068">Shown when the board was opened from a feed item — returns to the article reader.</Row>
            <Row label="← REPORT" color="#5a8068">Shown for generated reports — returns to the matching <code style={{ color: "#3a5040" }}>/blog/[slug]</code> page.</Row>
          </Section>

          {/* ORACLE */}
          <Section icon="◎" title="Oracle — AI Investigator" color="#00ff88">
            <Note>GPT-4o cross-references the story with the CIA FOIA index, USPTO database and known actors. On the <strong style={{ color: "#c8e8d0" }}>Investigation Board</strong>, analysis is loaded automatically when missing (after sign-in). On <strong style={{ color: "#c8e8d0" }}>UAP incident</strong> pages, use ◈ RUN ORACLE ANALYSIS ▶ to run explicitly. Results are cached — free users can view existing analyses where access allows; PRO unlocks fresh triggers where gated.</Note>
            <Sub>Verdicts</Sub>
            <Row label="TRUE" color="#00ff88">Well-supported by primary sources.</Row>
            <Row label="PARTIALLY TRUE" color="#00bb66">Some details disputed or incomplete.</Row>
            <Row label="QUESTIONABLE" color="#ffaa00">Indirect evidence only — no definitive proof.</Row>
            <Row label="DISINFORMATION" color="#ff3333">Oracle assesses as deliberately misleading.</Row>
            <Sub>Output fields</Sub>
            <Row label="CONSPIRACY ANGLE" color="#c94dff">The specific cover-up or suppression narrative suggested.</Row>
            <Row label="KEY CONNECTIONS" color="#5a8068">Most important people / org / event links.</Row>
            <Row label="THEORIES" color="#c94dff">Probability-weighted hypotheses with source lists and timelines.</Row>
          </Section>

          {/* UAP */}
          <Section icon="◉" title="UAP Intelligence" color="#8aa6ff">
            <Note>/uap is a dedicated database built from FOIA documents, Pentagon statements and congressional testimony.</Note>
            <Sub>Classification</Sub>
            <Row label="DECLASSIFIED" color="#00ff88">Official documents publicly available.</Row>
            <Row label="CONFIRMED" color="#00bb66">Pentagon/AARO statement or congressional testimony.</Row>
            <Row label="REPORTED" color="#ffaa00">Not yet confirmed. Limited documentation.</Row>
            <Row label="ALLEGED" color="#5a8068">Primarily unverified sources.</Row>
            <Sub>Evidence level</Sub>
            <Row label="HIGH" color="#ff3333">Radar data + multiple independent witnesses + government corroboration.</Row>
            <Row label="MEDIUM" color="#ffaa00">Partial documentation, some verified witnesses.</Row>
            <Row label="LOW" color="#00bb66">Primarily eyewitness accounts.</Row>
          </Section>

          {/* INSIDER RADAR */}
          <Section icon="📡" title="Insider Radar" color="#ffaa00">
            <Note>
              <code style={{ color: "#3a5040" }}>/insider-radar</code> reads a cached feed (YouTube RSS + X API) refreshed twice daily via cron (09:00 & 21:00 UTC) or Admin → Feed scrapers → <strong style={{ color: "var(--foreground)" }}>Insider Radar feed refresh</strong>. Page loads never call X directly.
            </Note>
            <Sub>Sources</Sub>
            <Row label="YOUTUBE" color="#ff3333">Direct channel RSS — e.g. The Why Files, Ross Coulthart, SecureTeam10. Cards show thumbnails and ↗ WATCH links.</Row>
            <Row label="INSIDERS" color="#00ff88">UAP: Grusch, Graves, Mellon, Coulthart, Burchett. Media/commentary: Tucker Carlson, Dan Bilzerian, Ian Carroll, Candace Owens, Anastasia Loupis, Nick Fuentes. Geopolitics: Greta Thunberg, Bassem Youssef, Abdel Bari Atwan, Omar Suleiman. Live X via <code style={{ color: "#3a5040" }}>X_BEARER_TOKEN</code> on Vercel.</Row>
            <Sub>Filters</Sub>
            <Row label="ALL" color="#5a8068">Every signal in one grid, newest first.</Row>
            <Row label="▶ YOUTUBE" color="#ff3333">Video uploads only.</Row>
            <Row label="✕ X" color="#5a8068">X/Twitter trackers only (official API).</Row>
            <Row label="CATEGORIES" color="#8aa6ff"><strong style={{ color: "#c8e8d0" }}>uap</strong> · <strong style={{ color: "#c8e8d0" }}>media</strong> · <strong style={{ color: "#c8e8d0" }}>geopolitics</strong> · <strong style={{ color: "#c8e8d0" }}>commentary</strong></Row>
            <Sub>Tracker badges</Sub>
            <Note>Coloured chips under the header show which channels returned data and how many items each contributed. If the grid is empty, feeds may be rate-limited — refresh after a few minutes.</Note>
            <Sub>Navigation</Sub>
            <Note>Minimal header: ← FEED, same as other tracker pages. Listed in the top nav as <strong style={{ color: "#ffaa00" }}>INSIDER RADAR</strong> (amber).</Note>
            <Sub>Admin (GSC pipeline)</Sub>
            <Note>On <code style={{ color: "#3a5040" }}>/admin</code>, sidebar <strong style={{ color: "#ffaa00" }}>SEO / GSC</strong>: run <strong style={{ color: "#c8e8d0" }}>Search Console sync</strong> first, then <strong style={{ color: "#c8e8d0" }}>Search Console SEO Article</strong>. Or call <code style={{ color: "#3a5040" }}>GET /api/search-console</code> with <code style={{ color: "#3a5040" }}>CRON_SECRET</code>.</Note>
          </Section>

          {/* OUTBREAKS */}
          <Section icon="⬤" title="Outbreaks Tracker" color="#ff3333">
            <Note>/outbreaks shows real-time alerts from WHO, CDC and ProMED. The nav button blinks red as a live attention signal.</Note>
            <Row label="CRITICAL" color="#ff3333">Fast-spreading outbreak with WHO emergency warning or confirmed fatalities.</Row>
            <Row label="HIGH" color="#ff6600">Multiple countries affected or unusual pathogen.</Row>
            <Row label="MODERATE" color="#ffaa00">Monitored, currently under control.</Row>
            <Row label="LOW" color="#00bb66">Localised, no spread detected.</Row>
          </Section>

          {/* SEARCH */}
          <Section icon="⌕" title={"Search & URL Analyzer"} color="#5a8068">
            <Note>/search uses full-text search across all articles, Oracle analyses and FOIA documents.</Note>
            <Sub>Search tips</Sub>
            <Row label="KEYWORD" color="#5a8068">Searches article summaries and Oracle text.</Row>
            <Row label="ORGANISATION" color="#5a8068">CIA, DARPA, Lockheed — returns related articles and boards.</Row>
            <Row label="EVENT" color="#5a8068">Roswell, Nimitz — returns UAP incidents and linked articles.</Row>
            <Sub>URL Analyzer (PRO)</Sub>
            <Note>Paste any https:// link into the ◈ ANALYZE URL tab (second tab on /search). Supports: X/Twitter, Reddit, Bluesky, YouTube (oEmbed), and standard news sites. Short links (t.co, redd.it) are resolved first. Login-only pages may return limited content.</Note>
            <Sub>Reference Index</Sub>
            <Note>Curated A–Z list of official declassified portals: CIA Reading Room, FBI Vault, NARA, NSA FOIA, DARPA, etc. Filter by agency or letter. Links open the primary government source — PDFs are not hosted here.</Note>
          </Section>

          {/* COMMUNITY */}
          <Section icon="◈" title="Community Intelligence" color="#00bb66">
            <Note>/community lists and threads are public to read. Posting, replies, reactions, and @oracle require signing in from the feed.</Note>
            <Sub>Thread categories</Sub>
            <Row label="👁 SIGHTING" color="#00ff88">Direct observation — aerial, terrestrial or unexplained.</Row>
            <Row label="📄 DOCUMENT" color="#ff3333">FOIA file, leaked document or official record.</Row>
            <Row label="🔮 THEORY" color="#c94dff">Hypothesis for community evaluation.</Row>
            <Row label="❓ QUESTION" color="#ffaa00">Ask the community or Oracle for analysis.</Row>
            <Row label="💡 TIP" color="#00bb66">Link or lead others should investigate.</Row>
            <Sub>Oracle in threads</Sub>
            <Note>Type @oracle in any post to trigger AI analysis. Oracle reads all posts, cross-references known data, evaluates credibility and posts a structured report with theories, sources and next steps.</Note>
            <Note>Free users: 3 @oracle triggers/day per device. PRO: unlimited.</Note>
            <Sub>Voting and reactions</Sub>
            <Row label="↑ / ↓" color="#5a8068">Up/down vote any post. One vote per browser.</Row>
            <Row label="↩ REPLY" color="#5a8068">Threaded replies, indented under parent.</Row>
          </Section>

          {/* SHARING */}
          <Section icon="↗" title={"Share & Export"} color="#5a8068">
            <Note>Every Investigation Board has a ◈ SHARE ▼ button top-right with these options:</Note>
            <Row label="𝕏 X" color="#c8e8d0">Pre-filled post with Oracle conclusion and hashtags.</Row>
            <Row label="f FACEBOOK" color="#4080ff">Facebook Sharer with board URL.</Row>
            <Row label="r/ REDDIT" color="#ff6600">Reddit Submit with URL and title.</Row>
            <Row label="📱 WHATSAPP" color="#00ff88">Pre-composed message with Oracle conclusion and link.</Row>
            <Row label="🔗 COPY" color="#5a8068">Copies current board URL to clipboard.</Row>
            <Row label="💾 PNG" color="#ffaa00">Saves the full board as a high-res PNG (1.5× scale).</Row>
          </Section>

          {/* PRO */}
          <Section icon="◐" title="Free vs. PRO" color="#c94dff">
            <Row label="FREE" color="#5a8068">Browse feed, Insider Radar, outbreaks, UAP files, view cached Oracle analyses, 3 @oracle triggers/day, top-3 article highlights, community access.</Row>
            <Row label="TRIAL" color="#ffaa00">New accounts may receive a <strong style={{ color: "#c8e8d0" }}>30-day Analyst Pass</strong> (full PRO, no card). Legacy users can claim once from Account if eligible. Trial status and days left appear on <code style={{ color: "#3a5040" }}>/account</code>.</Row>
            <Row label="PRO ▶" color="#c94dff">Unlimited Oracle triggers, full article highlights, Polymarket real-time odds, URL analyzer, email alerts at 75%+ threat, board PNG export, unlimited Investigation Boards.</Row>
            <Note>Sign in via the SIGN IN button. Upgrade via PRO ▶ — payment handled by Stripe. Manage subscription from your Account page.</Note>
          </Section>

          {/* FOOTER */}
          <div style={{ padding: "14px 18px", border: "1px solid #1a3320", borderRadius: 4, background: "#090f0b", fontSize: 10, color: "#3a5040", lineHeight: 1.8 }}>
            <span style={{ color: "#5a8068" }}>◈ VERSION</span>{" "}<span style={{ color: "#00ff88" }}>1.3</span>
            {"  ·  "}
            <span style={{ color: "#5a8068" }}>SOURCES</span>{" "}<span style={{ color: "#c8e8d0" }}>Guardian · CIA FOIA · USPTO · AARO · WHO · YouTube RSS</span>
            {"  ·  "}
            <span style={{ color: "#5a8068" }}>AI</span>{" "}<span style={{ color: "#c8e8d0" }}>GPT-4o</span>
            {"  ·  "}
            For informational purposes only.
          </div>
        </div>
      </div>
    </div>
  );
}
