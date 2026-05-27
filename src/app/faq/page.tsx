"use client";

import { useState } from "react";
import Link from "next/link";
import { pageContentShellStyle } from "@/lib/pageShell";

const FONT = "var(--font-share-tech-mono), monospace";
const RAJ = "var(--font-raj), sans-serif";

const FAQS: { q: string; a: string }[] = [
  {
    q: "What is The Theorist?",
    a: "The Theorist is an AI-powered investigative intelligence platform that collects and analyses publicly available news, declassified documents, UAP reports, outbreak alerts and related data. The Oracle AI (GPT-4o) assigns threat scores, maps connections and generates structured investigation reports.",
  },
  {
    q: "Where does the content come from?",
    a: "Articles are sourced from Guardian API, Google News, Reddit, and official government transparency portals (FOIA.gov, CIA Reading Room). The scraper runs automatically every few hours and only surfaces articles scoring 70+ on the AI threat scale.",
  },
  {
    q: "What is the Oracle?",
    a: "Oracle is the AI analysis layer powered by GPT-4o. It reads an article and generates a threat score (0–100), a credibility verdict (True / Partially True / Questionable / Disinformation), a conspiracy angle and a connection map. Cached analyses are free to view — triggering a new one requires a PRO account.",
  },
  {
    q: "What is the threat score?",
    a: "An AI estimate (0–100) of how significant the event could be if the claims are accurate. It is a triage signal — not a safety warning. 80+ = high (red), 70–79 = elevated (red), below 70 is hidden from the feed. Only 70+ articles are shown.",
  },
  {
    q: "What is the Investigation Board?",
    a: "An interactive graph per article that maps connections between people, organisations, documents and events found by the AI. Nodes are draggable; you can pan, zoom, click for detail, and export the whole board as a PNG.",
  },
  {
    q: "What are Polymarket predictions?",
    a: "When a relevant Polymarket prediction market exists for an article topic, it is shown as a live card strip on the board. This gives a crowd-sourced probability estimate from real-money markets. Requires PRO.",
  },
  {
    q: "Can I submit a tip or article?",
    a: "Paste any public URL into Search → Analyze URL and Oracle will analyse it on demand.",
  },
  {
    q: "How does reader voting work?",
    a: "On each article and investigation report page you can vote on the AI threat score, pick the most credible Oracle theory (after an analysis exists), and mark if you witnessed something similar. Votes are anonymous, deduplicated per browser fingerprint, and shown as a live reader consensus alongside the AI score. The Investigation Board is for exploring the graph and sources.",
  },
  {
    q: "What do I get with PRO?",
    a: "Unlimited Oracle triggers, full article highlights (free = top 3), Polymarket real-time odds, URL analyzer, email alerts at 75%+ threat, unlimited Investigation Boards and PNG board export. $7/month via Stripe.",
  },
  {
    q: "How do I use the Reference Index?",
    a: "Go to Search → Reference Index. Browse or filter by agency (CIA, FBI, NARA, etc.) or first letter. Each entry links to the primary government or archive URL — documents are not hosted on The Theorist.",
  },
  {
    q: "Is my data private?",
    a: "Yes. We collect only anonymised usage data and optional contact messages. Full details are in the Privacy Policy.",
  },
  {
    q: "Is The Theorist affiliated with any government?",
    a: "No. Independent project. We aggregate publicly available information from government and non-government sources and have no official relationship with any agency.",
  },
  {
    q: "Is there a mobile app?",
    a: "Not yet. The web platform is fully responsive on mobile browsers. A native app may come later.",
  },
  {
    q: "How do I contact you?",
    a: "Use the Contact page — select Support, Business, Press or Other and fill in the form. We read all messages and respond to serious enquiries.",
  },
];

function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ borderBottom: "1px solid #1a3320" }}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        style={{ width: "100%", textAlign: "left", background: "none", border: "none", padding: "16px 0", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}
      >
        <span style={{ fontFamily: RAJ, fontSize: 13, fontWeight: 700, color: open ? "#00ff88" : "#c8e8d0", letterSpacing: 1, lineHeight: 1.4 }}>{q}</span>
        <span style={{ fontFamily: FONT, fontSize: 16, color: open ? "#00ff88" : "#3a5040", flexShrink: 0, transform: open ? "rotate(45deg)" : "none", transition: "transform 0.2s, color 0.15s" }}>+</span>
      </button>
      {open && (
        <div style={{ paddingBottom: 16, paddingRight: 24, fontFamily: FONT, fontSize: 12, color: "#7aaa8a", lineHeight: 1.8 }}>
          {a}
        </div>
      )}
    </div>
  );
}

export default function FAQPage() {
  return (
    <div style={{ minHeight: "100vh", background: "#050c07", color: "#c8e8d0", fontFamily: FONT }}>
      <div className="scanline" />
      <div style={{ position: "relative", zIndex: 1 }}>

        {/* NAV */}
        <div style={{ height: 44, background: "#050c07", borderBottom: "1px solid #1a3320", display: "flex", alignItems: "center", padding: "0 16px", gap: 12 }}>
          <Link href="/" style={{ fontFamily: RAJ, fontSize: 10, fontWeight: 700, color: "#5a8068", textDecoration: "none", letterSpacing: 2, border: "1px solid #1a3320", padding: "4px 10px", borderRadius: 3 }}>← FEED</Link>
          <div style={{ width: 1, height: 20, background: "#1a3320" }} />
          <div style={{ fontFamily: RAJ, fontSize: 14, fontWeight: 700, color: "#00ff88", letterSpacing: 2 }}>THE THEORIST</div>
          <div style={{ width: 1, height: 20, background: "#1a3320" }} />
          <div style={{ fontFamily: RAJ, fontSize: 11, color: "#5a8068", letterSpacing: 2 }}>FAQ</div>
          <div style={{ marginLeft: "auto" }}>
            <Link href="/guide" style={{ fontFamily: RAJ, fontSize: 10, fontWeight: 700, color: "#5a8068", textDecoration: "none", letterSpacing: 2, border: "1px solid #1a3320", padding: "4px 10px", borderRadius: 3 }}>GUIDE ▸</Link>
          </div>
        </div>

        <div style={pageContentShellStyle({ paddingBottom: "5rem", maxWidth: 780 })}>

          {/* HEADER */}
          <div style={{ marginBottom: "2rem", paddingBottom: "1.25rem", borderBottom: "1px solid #1a3320" }}>
            <div style={{ fontFamily: RAJ, fontSize: 9, letterSpacing: 5, color: "#3a5040", marginBottom: 6, textTransform: "uppercase" }}>■ HELP CENTRE ■</div>
            <h1 style={{ fontFamily: RAJ, fontSize: 28, fontWeight: 700, color: "#00ff88", letterSpacing: 2, margin: "0 0 8px", textShadow: "0 0 20px rgba(0,255,136,0.2)" }}>
              Frequently Asked Questions
            </h1>
            <p style={{ fontFamily: FONT, fontSize: 12, color: "#5a8068", margin: 0 }}>
              Still have questions?{" "}
              <Link href="/contact" style={{ color: "#00bb66", textDecoration: "none" }}>Contact us ▸</Link>
              {" "}or read the full{" "}
              <Link href="/guide" style={{ color: "#00bb66", textDecoration: "none" }}>Platform Guide ▸</Link>
            </p>
          </div>

          <div style={{ borderTop: "1px solid #1a3320" }}>
            {FAQS.map((item, i) => (
              <FAQItem key={i} q={item.q} a={item.a} />
            ))}
          </div>

          <div style={{ marginTop: 32, padding: "14px 18px", border: "1px solid #1a3320", borderRadius: 4, background: "#090f0b", fontSize: 10, color: "#3a5040", lineHeight: 1.8 }}>
            <span style={{ color: "#5a8068" }}>◈ THE THEORIST</span>
            {"  ·  "}
            For informational purposes only. Not professional advice.
            {"  ·  "}
            <Link href="/contact" style={{ color: "#5a8068" }}>Contact</Link>
            {" · "}
            <Link href="/guide" style={{ color: "#5a8068" }}>Guide</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
