"use client";

import { useState } from "react";
import Link from "next/link";

const FONT = "var(--font-share-tech-mono), monospace";
const RAJ = "var(--font-raj), sans-serif";

// ── Mini mockup helpers ──────────────────────────────────────────
function MockCard() {
  return (
    <div style={{ border: "1px solid #1a3320", borderRadius: 4, background: "#090f0b", overflow: "hidden", fontSize: 10, fontFamily: FONT, maxWidth: 340 }}>
      <div style={{ padding: "8px 12px", borderBottom: "1px solid #1a3320", display: "flex", gap: 8, alignItems: "center" }}>
        <span style={{ fontSize: 9, color: "#ff3333", border: "1px solid #ff3333", padding: "1px 6px", borderRadius: 2, fontFamily: RAJ, fontWeight: 700 }}>THREAT: 82</span>
        <span style={{ fontSize: 9, color: "#ffaa00", border: "1px solid #ffaa00", padding: "1px 6px", borderRadius: 2, fontFamily: RAJ, fontWeight: 700 }}>TIER A</span>
        <span style={{ fontSize: 9, color: "#5a8068", letterSpacing: 1, marginLeft: "auto" }}>guardian</span>
      </div>
      <div style={{ padding: "10px 12px" }}>
        <div style={{ fontFamily: RAJ, fontSize: 12, fontWeight: 700, color: "#e8ffe8", marginBottom: 4 }}>Pentagon Confirms New UAP Program</div>
        <div style={{ color: "#5a8068", fontSize: 10, lineHeight: 1.6, marginBottom: 8 }}>Classified documents reveal a previously unknown research initiative...</div>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <span style={{ fontSize: 8, color: "#3a5040", border: "1px solid #0d1a10", padding: "1px 5px", borderRadius: 2 }}>uap</span>
          <span style={{ fontSize: 8, color: "#3a5040", border: "1px solid #0d1a10", padding: "1px 5px", borderRadius: 2 }}>pentagon</span>
          <button style={{ marginLeft: "auto", background: "rgba(0,255,136,0.07)", border: "1px solid #00bb66", color: "#00ff88", fontFamily: RAJ, fontSize: 10, fontWeight: 700, padding: "4px 10px", borderRadius: 2, cursor: "default", letterSpacing: 1 }}>◈ ANALYZE</button>
        </div>
      </div>
    </div>
  );
}

function MockBoardMini() {
  const cx = 200, cy = 100;
  const nodes = [
    { id: "c", x: cx, y: cy, r: 22, color: "#00ff88", label: "CENTER", sub: "ARTICLE" },
    { id: "n1", x: cx - 120, y: cy - 50, r: 14, color: "#ff3333", label: "FOIA", sub: "DOC" },
    { id: "n2", x: cx + 120, y: cy - 50, r: 14, color: "#00bb66", label: "PERSON", sub: "WITNESS" },
    { id: "n3", x: cx, y: cy + 90, r: 14, color: "#ffaa00", label: "CORP", sub: "COMPANY" },
    { id: "n4", x: cx - 110, y: cy + 70, r: 14, color: "#c94dff", label: "PATENT", sub: "USPTO" },
  ];
  return (
    <div style={{ border: "1px solid #1a3320", borderRadius: 4, background: "#090f0b", overflow: "hidden", maxWidth: 420 }}>
      <div style={{ padding: "6px 12px", borderBottom: "1px solid #1a3320", fontSize: 9, color: "#5a8068", fontFamily: FONT, letterSpacing: 2 }}>◈ INVESTIGATION BOARD PREVIEW</div>
      <svg viewBox="0 0 400 230" style={{ width: "100%", height: 180 }}>
        <rect width="400" height="230" fill="#090f0b" />
        <defs>
          <radialGradient id="gGrad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#00ff88" stopOpacity="0.08" />
            <stop offset="100%" stopColor="#00ff88" stopOpacity="0" />
          </radialGradient>
        </defs>
        <circle cx={cx} cy={cy} r={55} fill="url(#gGrad)" />
        {nodes.slice(1).map(n => (
          <line key={n.id} x1={cx} y1={cy} x2={n.x} y2={n.y} stroke={n.color} strokeWidth="1.2" strokeOpacity="0.35" strokeDasharray="4 5" />
        ))}
        {nodes.map((n, i) => (
          <g key={n.id}>
            <circle cx={n.x} cy={n.y} r={n.r + 5} fill={n.color} opacity="0.05" />
            <circle cx={n.x} cy={n.y} r={n.r} fill="#090f0b" stroke={n.color} strokeWidth={i === 0 ? 2 : 1.5} style={{ filter: `drop-shadow(0 0 ${i === 0 ? 6 : 3}px ${n.color})` }} />
            <text x={n.x} y={n.y + 3} textAnchor="middle" fill={n.color} style={{ fontFamily: FONT, fontSize: i === 0 ? 7 : 6, letterSpacing: 0.5 }}>{n.label}</text>
            <text x={n.x} y={n.y + n.r + 12} textAnchor="middle" fill={n.color} opacity="0.5" style={{ fontFamily: FONT, fontSize: 5.5, letterSpacing: 0.5 }}>{n.sub}</text>
          </g>
        ))}
        <text x={cx} y={cy - 28} textAnchor="middle" fill="#00ff88" opacity="0.4" style={{ fontFamily: FONT, fontSize: 5, letterSpacing: 2 }}>PAN · ZOOM · CLICK NODE</text>
      </svg>
    </div>
  );
}

function MockOracle() {
  return (
    <div style={{ border: "1px solid #1a3320", borderRadius: 4, background: "#090f0b", padding: "12px 14px", maxWidth: 380, fontFamily: FONT }}>
      <div style={{ fontSize: 9, color: "#00ff88", letterSpacing: 2, marginBottom: 10 }}>◈ ORACLE ANALYSIS</div>
      <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 10 }}>
        <div>
          <div style={{ fontSize: 8, color: "#5a8068", letterSpacing: 2, marginBottom: 3 }}>THREAT SCORE</div>
          <div style={{ fontFamily: RAJ, fontSize: 38, fontWeight: 700, color: "#ff3333", lineHeight: 1 }}>82</div>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ height: 4, background: "#1a3320", borderRadius: 2, overflow: "hidden", marginBottom: 5 }}>
            <div style={{ height: "100%", width: "82%", background: "#ff3333", borderRadius: 2 }} />
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <span style={{ fontSize: 8, color: "#ff3333", border: "1px solid #ff3333", padding: "1px 6px", borderRadius: 2, fontFamily: RAJ }}>QUESTIONABLE</span>
          </div>
        </div>
      </div>
      <div style={{ fontSize: 10, color: "#7aaa8a", lineHeight: 1.7, marginBottom: 8 }}>Cross-referencing with CIA FOIA index suggests deliberate information suppression. Patent filings by contractors align with the timeline...</div>
      <div style={{ padding: "8px 10px", background: "rgba(201,77,255,0.06)", border: "1px solid rgba(201,77,255,0.2)", borderRadius: 3 }}>
        <div style={{ fontSize: 8, color: "#c94dff", letterSpacing: 2, marginBottom: 3 }}>CONSPIRACY ANGLE</div>
        <div style={{ fontSize: 10, color: "#e9b3ff", lineHeight: 1.5 }}>Classified reverse-engineering program concealed under contractor shell companies</div>
      </div>
    </div>
  );
}

function MockUAPMap() {
  const incidents = [
    { x: 90, y: 80, col: "#00ff88", sel: true, label: "ROSWELL" },
    { x: 60, y: 100, col: "#00bb66", sel: false, label: "NIMITZ" },
    { x: 240, y: 70, col: "#ffaa00", sel: false, label: "RENDLESHAM" },
    { x: 300, y: 95, col: "#5a8068", sel: false, label: "YAZD" },
    { x: 170, y: 90, col: "#ff3333", sel: false, label: "AVEBURY" },
  ];
  return (
    <div style={{ border: "1px solid #1a3320", borderRadius: 4, background: "#090f0b", overflow: "hidden", maxWidth: 380 }}>
      <div style={{ padding: "6px 12px", borderBottom: "1px solid #1a3320", fontSize: 9, color: "#5a8068", fontFamily: FONT, letterSpacing: 2 }}>◈ GLOBAL INCIDENT MAP</div>
      <svg viewBox="0 0 380 140" style={{ width: "100%", height: 120 }}>
        <rect width="380" height="140" fill="#030806" />
        {/* Simplified continent outlines */}
        <ellipse cx="90" cy="95" rx="55" ry="28" fill="#0a160c" stroke="#1a3320" strokeWidth="0.5" />
        <ellipse cx="200" cy="85" rx="70" ry="35" fill="#0a160c" stroke="#1a3320" strokeWidth="0.5" />
        <ellipse cx="310" cy="90" rx="45" ry="25" fill="#0a160c" stroke="#1a3320" strokeWidth="0.5" />
        <ellipse cx="95" cy="55" rx="30" ry="18" fill="#0a160c" stroke="#1a3320" strokeWidth="0.5" />
        {incidents.map((inc, i) => (
          <g key={i}>
            <circle cx={inc.x} cy={inc.y} r={inc.sel ? 10 : 6} fill={inc.col} fillOpacity={inc.sel ? 0.95 : 0.7} stroke={inc.col} strokeWidth={inc.sel ? 2 : 1} style={{ filter: `drop-shadow(0 0 ${inc.sel ? 7 : 3}px ${inc.col})` }} />
            <circle cx={inc.x} cy={inc.y} r={(inc.sel ? 10 : 6) + 6} fill="none" stroke={inc.col} strokeWidth="0.7" strokeOpacity="0.2" />
            {inc.sel && <text x={inc.x + 13} y={inc.y + 3} fill={inc.col} style={{ fontFamily: FONT, fontSize: 6, letterSpacing: 1 }}>{inc.label}</text>}
          </g>
        ))}
      </svg>
    </div>
  );
}

// ── Section component ────────────────────────────────────────────

interface Section {
  id: string;
  icon: string;
  title: string;
  color: string;
  content: React.ReactNode;
}

function GuideSection({ section, open, onToggle }: { section: Section; open: boolean; onToggle: () => void }) {
  return (
    <div style={{ border: `1px solid ${open ? section.color : "#1a3320"}`, borderRadius: 4, overflow: "hidden", transition: "border-color 0.2s" }}>
      <button
        type="button"
        onClick={onToggle}
        style={{
          width: "100%",
          padding: "14px 18px",
          background: open ? `${section.color}0a` : "#090f0b",
          border: "none",
          display: "flex",
          alignItems: "center",
          gap: 12,
          cursor: "pointer",
          transition: "background 0.2s",
        }}
      >
        <span style={{ fontSize: 16 }}>{section.icon}</span>
        <span style={{ fontFamily: RAJ, fontSize: 14, fontWeight: 700, color: open ? section.color : "#c8e8d0", letterSpacing: 2, textTransform: "uppercase", flex: 1, textAlign: "left" }}>
          {section.title}
        </span>
        <span style={{ fontFamily: FONT, fontSize: 10, color: open ? section.color : "#3a5040", letterSpacing: 1 }}>{open ? "[ − CLOSE ]" : "[ + OPEN ]"}</span>
      </button>

      {open && (
        <div style={{ padding: "18px 20px 24px", borderTop: `1px solid ${section.color}22`, background: "#080e0a" }}>
          {section.content}
        </div>
      )}
    </div>
  );
}

// ── Explanation row ──────────────────────────────────────────────

function Row({ label, color, children }: { label: string; color?: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", gap: 12, marginBottom: 10, alignItems: "flex-start" }}>
      <span style={{ fontFamily: RAJ, fontSize: 10, fontWeight: 700, color: color ?? "#00ff88", border: `1px solid ${color ?? "#00ff88"}`, padding: "2px 8px", borderRadius: 2, letterSpacing: 1, flexShrink: 0, whiteSpace: "nowrap", alignSelf: "flex-start", marginTop: 1 }}>
        {label}
      </span>
      <span style={{ fontFamily: FONT, fontSize: 11, color: "#7aaa8a", lineHeight: 1.75 }}>{children}</span>
    </div>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return <p style={{ fontFamily: FONT, fontSize: 11, color: "#7aaa8a", lineHeight: 1.8, margin: "0 0 10px" }}>{children}</p>;
}

function H({ children }: { children: React.ReactNode }) {
  return <div style={{ fontFamily: RAJ, fontSize: 11, fontWeight: 700, color: "#c8e8d0", letterSpacing: 2, marginBottom: 8, marginTop: 16, textTransform: "uppercase" }}>{children}</div>;
}

function InlineCode({ children }: { children: React.ReactNode }) {
  return <span style={{ fontFamily: FONT, fontSize: 10, color: "#00ff88", background: "rgba(0,255,136,0.07)", padding: "1px 5px", borderRadius: 2 }}>{children}</span>;
}

// ── Sections content ─────────────────────────────────────────────

const SECTIONS: Section[] = [
  {
    id: "feed",
    icon: "◈",
    title: "Main Feed — News & Threat Score",
    color: "#00ff88",
    content: (
      <div>
        <P>The homepage automatically collects articles from the Guardian API, Google News, Reddit and FOIA databases. Every article is passed through an AI filter (GPT-4o) that computes a <InlineCode>threat score</InlineCode> from 0 to 100. Only articles scoring <b style={{color:"#e8ffe8"}}>55 or above</b> are shown.</P>
        <H>News card anatomy</H>
        <div style={{ display: "flex", gap: 24, flexWrap: "wrap", alignItems: "flex-start", marginBottom: 16 }}>
          <MockCard />
          <div style={{ flex: 1, minWidth: 200 }}>
            <Row label="THREAT: 82" color="#ff3333">AI-assigned risk score. 80+ = red (high), 60–79 = yellow (medium), 55–59 = green (low). Reflects the likelihood that the article conceals hidden connections or suppressed information.</Row>
            <Row label="TIER A" color="#ffaa00">Source tier: A = primary official source (Guardian, Pentagon, FOIA), B = established media, C = community / unverified.</Row>
            <Row label="SECTION" color="#5a8068">The Guardian section (e.g. world, us-news, science). Use the filter buttons at the top of the feed to filter by section.</Row>
            <Row label="◈ ANALYZE" color="#00ff88">Opens the Investigation Board and Oracle analysis for this article. GPT-4o maps out connections, key actors, documents and conspiracy theories.</Row>
          </div>
        </div>
        <H>Header status bar</H>
        <P>Green pulsing dots indicate an active data source. <InlineCode>DARPA: ████</InlineCode> is intentionally redacted — it symbolises partially classified defence programme data.</P>
        <H>Live ticker</H>
        <P>The scrolling strip below the header lists all active data sources and AI systems in real time.</P>
      </div>
    ),
  },
  {
    id: "board",
    icon: "⬡",
    title: "Investigation Board — Connection Map",
    color: "#00bb66",
    content: (
      <div>
        <P>Every analysed article gets an interactive graph. The <b style={{color:"#e8ffe8"}}>centre node</b> is the article itself; surrounding nodes are connected actors, documents, companies and patents discovered by the AI.</P>
        <div style={{ display: "flex", gap: 24, flexWrap: "wrap", alignItems: "flex-start", marginBottom: 16 }}>
          <MockBoardMini />
          <div style={{ flex: 1, minWidth: 200 }}>
            <H>Node types</H>
            <Row label="ARTICLE" color="#00ff88">The starting point — the analysed article. Green.</Row>
            <Row label="FOIA / CIA" color="#ff3333">Declassified document obtained via FOIA request. Red.</Row>
            <Row label="PERSON" color="#00bb66">Key figure, witness or official linked to the story. Dark green.</Row>
            <Row label="COMPANY" color="#ffaa00">Involved corporation or government agency. Yellow.</Row>
            <Row label="PATENT" color="#ff3333">Relevant USPTO patent linked to the topic. Red.</Row>
            <Row label="THEORY" color="#c94dff">Conspiracy hypothesis identified by GPT-4o. Purple.</Row>
            <H>Navigation</H>
            <Row label="PAN" color="#5a8068">Click and drag the background to pan the graph.</Row>
            <Row label="ZOOM" color="#5a8068">Mouse wheel or touchpad pinch to zoom in/out.</Row>
            <Row label="CLICK NODE" color="#5a8068">Click any node to open its detail panel on the right — source tier, URL, threat score, key claims, counter-evidence, timeline and actors.</Row>
          </div>
        </div>
        <H>Right detail panel</H>
        <P>Shows full details of the selected node: description, source tier (A/B/C), source link, threat score, key claims, uncertainties, counter-evidence, timeline and related actors.</P>
      </div>
    ),
  },
  {
    id: "oracle",
    icon: "◎",
    title: "Oracle Analysis — AI Investigator",
    color: "#00ff88",
    content: (
      <div>
        <P>Oracle is the analysis module powered by <b style={{color:"#e8ffe8"}}>GPT-4o</b>. Clicking <InlineCode>◈ ORACLE ANALYSIS ▶</InlineCode> triggers a real-time investigation: the AI cross-references the article with the CIA FOIA index, USPTO database and known actors, then returns a structured report.</P>
        <div style={{ display: "flex", gap: 24, flexWrap: "wrap", alignItems: "flex-start", marginBottom: 16 }}>
          <MockOracle />
          <div style={{ flex: 1, minWidth: 200 }}>
            <H>Verdict</H>
            <Row label="TRUE" color="#00ff88">The claim is well-supported by primary sources and cross-referenced evidence.</Row>
            <Row label="PARTIALLY TRUE" color="#00bb66">Partially accurate — some details are disputed or incomplete.</Row>
            <Row label="QUESTIONABLE" color="#ffaa00">The claim is doubtful; indirect evidence exists but no definitive proof.</Row>
            <Row label="DISINFORMATION" color="#ff3333">Oracle assesses the information as deliberately misleading or fabricated.</Row>
            <H>Other fields</H>
            <Row label="CONSPIRACY ANGLE" color="#c94dff">The specific cover-up, hidden programme or suppression narrative suggested by the data.</Row>
            <Row label="KEY CONNECTIONS" color="#5a8068">Short list of the most important links found (person ↔ organisation ↔ event).</Row>
            <Row label="THEORIES" color="#c94dff">Separate probability-weighted hypotheses, each with a source list and timeline.</Row>
          </div>
        </div>
      </div>
    ),
  },
  {
    id: "sources",
    icon: "▸",
    title: "Source Tiers & Data Sources",
    color: "#ffaa00",
    content: (
      <div>
        <H>Source tiers</H>
        <Row label="TIER A" color="#ffaa00">Primary source: Government.gov, Pentagon, CIA FOIA, Guardian, Reuters. Highest reliability.</Row>
        <Row label="TIER B" color="#5a8068">Secondary source: established media outlets, research institutions, verified NGOs.</Row>
        <Row label="TIER C" color="#3a5040">Tertiary source: social media, blogs, unverified whistleblowers. Treat with caution.</Row>
        <H>Active data sources</H>
        <Row label="GUARDIAN API" color="#00ff88">Live news stream from The Guardian — 6 sections monitored continuously (world, us-news, science, politics, technology, environment).</Row>
        <Row label="GPT-4o" color="#00ff88">OpenAI model handling all AI analysis, threat scoring and verdict generation.</Row>
        <Row label="CIA FOIA INDEX" color="#00ff88">Index of declassified documents obtained via FOIA — Oracle cross-references these against current articles.</Row>
        <Row label="USPTO LIVE" color="#00ff88">United States Patent and Trademark Office live database. Relevant patents are linked to analysed topics.</Row>
        <Row label="DARPA ████" color="#5a8068">Partially classified source — a symbolic indicator that some defence programme data is not publicly available.</Row>
      </div>
    ),
  },
  {
    id: "uap",
    icon: "◉",
    title: "UAP Intelligence — Incident Database",
    color: "#00bb66",
    content: (
      <div>
        <P>The <InlineCode>/uap</InlineCode> page is a dedicated UAP (Unidentified Aerial Phenomena) database built from FOIA documents, Pentagon statements, congressional testimony and eyewitness reports.</P>
        <div style={{ display: "flex", gap: 24, flexWrap: "wrap", alignItems: "flex-start", marginBottom: 16 }}>
          <MockUAPMap />
          <div style={{ flex: 1, minWidth: 200 }}>
            <H>Classification</H>
            <Row label="DECLASSIFIED" color="#00ff88">Officially declassified case with publicly available documents.</Row>
            <Row label="CONFIRMED" color="#00bb66">Confirmed case based on Pentagon / AARO statement or congressional testimony.</Row>
            <Row label="REPORTED" color="#ffaa00">Reported case not yet fully confirmed. Limited documentation.</Row>
            <Row label="ALLEGED" color="#5a8068">Alleged case from primarily unverified sources.</Row>
            <H>Evidence Level</H>
            <Row label="HIGH" color="#ff3333">Radar data, multiple independent witnesses, government corroboration.</Row>
            <Row label="MEDIUM" color="#ffaa00">Partial documentation, some verified witnesses.</Row>
            <Row label="LOW" color="#00bb66">Primarily eyewitness accounts, limited physical evidence.</Row>
          </div>
        </div>
        <H>Incident Investigation Board</H>
        <P>Each incident can be opened as a full <InlineCode>◈ OPEN INVESTIGATION BOARD ▶</InlineCode> — a UAP-specific version of the Investigation Board. The graph shows witnesses, involved organisations (AARO, CIA, DoD etc.) and linked documents.</P>
        <H>Polymarket widget</H>
        <P>Each incident shows a linked Polymarket prediction market where real-money bets reflect the crowd probability of official government acknowledgement. This is external market consensus — not the platform&apos;s own assessment.</P>
      </div>
    ),
  },
  {
    id: "outbreaks",
    icon: "⬤",
    title: "Outbreaks — Disease Tracker",
    color: "#ff3333",
    content: (
      <div>
        <P>The <InlineCode>/outbreaks</InlineCode> page shows real-time outbreak and epidemic alerts from WHO, CDC and ProMED sources. The nav button blinks red in the main header as an attention signal.</P>
        <H>Alert levels</H>
        <Row label="CRITICAL" color="#ff3333">Active, fast-spreading outbreak with WHO emergency warning or confirmed fatalities.</Row>
        <Row label="HIGH" color="#ff6600">High-risk case; multiple countries affected or unusual pathogen involved.</Row>
        <Row label="MODERATE" color="#ffaa00">Monitored case, currently under control.</Row>
        <Row label="LOW" color="#00bb66">Low-risk, localised case with no spread detected.</Row>
        <H>Data sources</H>
        <P>WHO Disease Outbreak News, CDC Health Alerts, ProMED mailings, ECDC Rapid Risk Assessments — all automatically scraped and categorised by the AI.</P>
      </div>
    ),
  },
  {
    id: "search",
    icon: "⌕",
    title: "Search",
    color: "#5a8068",
    content: (
      <div>
        <P>The <InlineCode>/search</InlineCode> page uses Supabase full-text search across all stored articles, Oracle analyses and FOIA documents. Search by name, keyword, organisation or person.</P>
        <H>Tips</H>
        <Row label="KEYWORD" color="#5a8068">Any word — searches article summaries and Oracle analysis text.</Row>
        <Row label="ORGANISATION" color="#5a8068">e.g. CIA, DARPA, Lockheed — returns related articles and investigation boards.</Row>
        <Row label="EVENT" color="#5a8068">e.g. Roswell, Nimitz — returns UAP incidents and articles referencing them.</Row>
        <H>URL analysis (Pro)</H>
        <P>On the same page, the <InlineCode>ANALYZE URL</InlineCode> tab accepts any <InlineCode>https://</InlineCode> link. The server picks the best extractor: X/Twitter and Meta Threads via oEmbed, Reddit via the public <InlineCode>.json</InlineCode> API (title, body, a few top comments), Bluesky via the public ATProto <InlineCode>getPosts</InlineCode> endpoint, YouTube via oEmbed (title and channel only), and standard HTML scraping for news sites. <InlineCode>t.co</InlineCode> and <InlineCode>redd.it</InlineCode> short links are followed first. Login-only or bot-blocked pages (many Facebook/Instagram posts) may still return little or no text.</P>
        <H>Reference index (A–Z)</H>
        <P>The <InlineCode>REFERENCE INDEX</InlineCode> tab lists a curated set of official portals and landmark declassified collections (CIA Reading Room, FBI Vault, NARA, NSA FOIA, DARPA, etc.). Entries are sorted alphabetically by title; you can filter by agency and first letter. Each row links out to the primary government or archive URL — PDFs are not hosted on The Theorist.</P>
      </div>
    ),
  },
  {
    id: "community",
    icon: "◈",
    title: "Community Intelligence — Threads & Voting",
    color: "#00bb66",
    content: (
      <div>
        <P>The <InlineCode>/community</InlineCode> page is an open-source intelligence board where anyone can report sightings, share documents and invoke the Oracle AI on any topic. No account required.</P>
        <H>Thread categories</H>
        <Row label="👁 SIGHTING" color="#00ff88">Report a direct observation — aerial, terrestrial or unexplained.</Row>
        <Row label="📄 DOCUMENT" color="#ff3333">Share a FOIA file, leaked document or official record.</Row>
        <Row label="🔮 THEORY" color="#c94dff">Propose a hypothesis or conspiracy theory for community evaluation.</Row>
        <Row label="❓ QUESTION" color="#ffaa00">Ask the community or Oracle for analysis of a specific claim.</Row>
        <Row label="💡 TIP" color="#00bb66">Pass on a tip or link that others should investigate.</Row>
        <H>Post interactions</H>
        <Row label="↑ LIKE" color="#00ff88">Up-vote a post you find credible or well-reasoned. Stored per browser — one vote per post.</Row>
        <Row label="↓ DISLIKE" color="#ff3333">Down-vote misleading or low-quality content.</Row>
        <Row label="↩ REPLY" color="#5a8068">Reply directly to a specific post. Replies are indented under their parent, creating a threaded discussion.</Row>
        <Row label="🎞 GIF" color="#00bb66">Insert a Tenor GIF into any post or reply using the built-in GIF search picker.</Row>
        <H>Oracle AI in threads</H>
        <P>Type <InlineCode>@oracle</InlineCode> anywhere in a post to trigger Oracle AI analysis of the thread. The Oracle reads all posts, cross-references known data, evaluates credibility and posts a structured report including related theories, sources, open questions and next steps.</P>
        <H>Credibility score</H>
        <P>When Oracle AI analyses a thread, it assigns a <InlineCode>credibility_score</InlineCode> (0–100%). This score is displayed on thread cards and used for <InlineCode>TOP CRED</InlineCode> sorting.</P>
      </div>
    ),
  },
  {
    id: "share",
    icon: "↗",
    title: "Share — Investigation Board Export",
    color: "#5a8068",
    content: (
      <div>
        <P>Every Investigation Board has a <InlineCode>◈ SHARE ▼</InlineCode> button in the top-right corner. Clicking it opens a dropdown with multiple export and sharing options.</P>
        <H>Share options</H>
        <Row label="𝕏 X / TWITTER" color="#c8e8d0">Opens the X (Twitter) compose window pre-filled with the Oracle conclusion, site URL and hashtags.</Row>
        <Row label="f FACEBOOK" color="#4080ff">Opens Facebook Sharer with the board URL. Facebook automatically pulls the article title and metadata.</Row>
        <Row label="r/ REDDIT" color="#ff6600">Opens Reddit Submit with the URL and title pre-filled.</Row>
        <Row label="📱 WHATSAPP" color="#00ff88">Opens WhatsApp web/app with a pre-composed message containing the Oracle conclusion and link.</Row>
        <Row label="✉ EMAIL" color="#5a8068">Opens your mail client with a pre-written subject and body containing the conclusion and link.</Row>
        <Row label="🔗 COPY LINK" color="#5a8068">Copies the current board URL to clipboard instantly.</Row>
        <Row label="💾 DOWNLOAD PNG" color="#ffaa00">Captures the entire Investigation Board as a high-resolution PNG file (1.5× scale) and saves it to your device.</Row>
      </div>
    ),
  },
  {
    id: "voting",
    icon: "⬆",
    title: "Community Voting — Threat & Theory Consensus",
    color: "#ffaa00",
    content: (
      <div>
        <P>Every Investigation Board shows a <b style={{color:"#e8ffe8"}}>Community Intelligence panel</b> below the graph. This panel lets you compare the AI threat assessment against the crowd consensus and vote on which theory is most credible.</P>
        <H>Threat score comparison</H>
        <Row label="AI SCORE" color="#5a8068">The GPT-4o assigned threat score (0–100%). Fixed at analysis time.</Row>
        <Row label="COMMUNITY" color="#ffaa00">The average score submitted by all visitors who voted. Updates in real time.</Row>
        <P>If no community vote exists yet, you will see a row of quick-vote buttons (10 / 25 / 40 / 55 / 70 / 85 / 95) — click one to register your threat assessment.</P>
        <H>Theory voting</H>
        <P>If the Oracle produced multiple conspiracy theories, they are listed as vote options. Click the theory you consider most credible. Vote counts are displayed in real time.</P>
        <H>Witnessed</H>
        <Row label="👁 WITNESSED" color="#ffaa00">Click if you or someone you know witnessed something related to the story. The panel shows a count of confirmed witness reports.</Row>
        <P>All votes are anonymous and deduplicated per browser fingerprint — one vote per article per type.</P>
      </div>
    ),
  },
  {
    id: "pro",
    icon: "◐",
    title: "PRO Account",
    color: "#c94dff",
    content: (
      <div>
        <H>Free vs. PRO</H>
        <Row label="FREE" color="#5a8068">Browse the feed and view news cards. Oracle analysis and Investigation Board access is limited.</Row>
        <Row label="PRO ▶" color="#c94dff">Unlimited Oracle analysis, full Investigation Board access, Polymarket integration, archiving and export. Payment via Stripe.</Row>
        <P>Use the <InlineCode>SIGN IN</InlineCode> button to log in via Supabase Auth (email/password or OAuth). The <InlineCode>PRO ▶</InlineCode> button opens Stripe Checkout.</P>
      </div>
    ),
  },
];

// ── Main page ────────────────────────────────────────────────────

export default function GuidePage() {
  const [openSection, setOpenSection] = useState<string>("feed");

  function toggle(id: string) {
    setOpenSection(prev => (prev === id ? "" : id));
  }

  return (
    <div style={{ minHeight: "100vh", background: "#050c07", color: "#c8e8d0", fontFamily: FONT }}>
      <div className="scanline" />
      <style>{`
        @keyframes guide-pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
      `}</style>

      <div style={{ position: "relative", zIndex: 1 }}>
        {/* NAV */}
        <div style={{ height: 44, background: "#050c07", borderBottom: "1px solid #1a3320", display: "flex", alignItems: "center", padding: "0 16px", gap: 12 }}>
          <Link href="/" style={{ fontSize: 10, color: "#5a8068", textDecoration: "none", letterSpacing: 2, border: "1px solid #1a3320", padding: "4px 10px", borderRadius: 3 }}>← FEED</Link>
          <div style={{ width: 1, height: 20, background: "#1a3320" }} />
          <div style={{ fontFamily: RAJ, fontSize: 14, fontWeight: 700, color: "#00ff88", letterSpacing: 2 }}>THE THEORIST</div>
          <div style={{ width: 1, height: 20, background: "#1a3320" }} />
          <div style={{ fontFamily: RAJ, fontSize: 11, color: "#5a8068", letterSpacing: 2 }}>PLATFORM GUIDE</div>
        </div>

        <div style={{ maxWidth: 900, margin: "0 auto", padding: "2rem 1.25rem 5rem" }}>

          {/* HEADER */}
          <div style={{ marginBottom: "2rem", paddingBottom: "1.25rem", borderBottom: "1px solid #1a3320" }}>
            <div style={{ fontFamily: RAJ, fontSize: 9, letterSpacing: 5, color: "#3a5040", marginBottom: 6, textTransform: "uppercase" }}>■ INTELLIGENCE PLATFORM DOCUMENTATION ■</div>
            <h1 style={{ fontFamily: RAJ, fontSize: 28, fontWeight: 700, color: "#00ff88", letterSpacing: 2, margin: "0 0 8px", textShadow: "0 0 20px rgba(0,255,136,0.2)" }}>
              Platform Guide
            </h1>
            <div style={{ fontSize: 11, color: "#5a8068", lineHeight: 1.8, maxWidth: 620 }}>
              Click a section header to expand the full explanation and visual illustration.
            </div>

            {/* Quick links */}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 16 }}>
              {SECTIONS.map(s => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => toggle(s.id)}
                  style={{
                    background: openSection === s.id ? `${s.color}10` : "transparent",
                    border: `1px solid ${openSection === s.id ? s.color : "#1a3320"}`,
                    color: openSection === s.id ? s.color : "#5a8068",
                    fontFamily: RAJ,
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: 1,
                    padding: "5px 12px",
                    borderRadius: 2,
                    cursor: "pointer",
                    transition: "all 0.15s",
                  }}
                >
                  {s.icon} {s.title.split("—")[0].trim()}
                </button>
              ))}
            </div>
          </div>

          {/* SECTIONS */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {SECTIONS.map(s => (
              <GuideSection
                key={s.id}
                section={s}
                open={openSection === s.id}
                onToggle={() => toggle(s.id)}
              />
            ))}
          </div>

          {/* FOOTER NOTE */}
          <div style={{ marginTop: 32, padding: "14px 18px", border: "1px solid #1a3320", borderRadius: 4, background: "#090f0b", fontSize: 10, color: "#3a5040", lineHeight: 1.8 }}>
            <span style={{ color: "#5a8068" }}>◈ PLATFORM VERSION</span>{" "}
            <span style={{ color: "#00ff88" }}>1.1</span>
            {"  ·  "}
            <span style={{ color: "#5a8068" }}>DATA SOURCES</span>{" "}
            <span style={{ color: "#c8e8d0" }}>Guardian · CIA FOIA · USPTO · AARO · WHO</span>
            {"  ·  "}
            <span style={{ color: "#5a8068" }}>AI</span>{" "}
            <span style={{ color: "#c8e8d0" }}>GPT-4o</span>
            {"  ·  "}
            Data is provided for informational purposes only and does not constitute professional advice.
          </div>
        </div>
      </div>
    </div>
  );
}
