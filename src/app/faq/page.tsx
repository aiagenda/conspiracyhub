"use client";

import { useState } from "react";
import { pageContentShellStyle } from "@/lib/pageShell";

const FAQS = [
  {
    q: "What is ConspiracyHub?",
    a: "ConspiracyHub is an intelligence aggregation platform that collects and analyses publicly available news, declassified documents, UAP reports, outbreak data, and related information from multiple sources. AI analysis (the Oracle) provides threat scores, pattern detection, and source credibility ratings.",
  },
  {
    q: "Where does the content come from?",
    a: "Articles are sourced from RSS feeds of mainstream and independent news outlets, subreddit feeds, official government transparency portals (MuckRock, FOIA.gov), and investigative journalism outlets. The scraper runs automatically every few hours.",
  },
  {
    q: "What is the Oracle?",
    a: "The Oracle is our AI analysis layer powered by GPT-4o. It reads an article and generates a threat score (0–100), a credibility assessment, a theory classification, and a concise summary. Paste any URL into the Search → Analyze URL tab for a custom analysis.",
  },
  {
    q: "What is the threat score?",
    a: "The threat score (0–100) is an AI estimate of how significant the described event could be if the claims are accurate. It is not a prediction — it reflects how seriously the information should be tracked, based on historical precedent and corroborating signals.",
  },
  {
    q: "Can I submit an article or tip?",
    a: "Not directly yet. You can paste any public URL into the Search → Analyze URL feature and the Oracle will analyse it on demand. If it appears significant, you can share it in a community thread.",
  },
  {
    q: "What is the Investigation Board?",
    a: "The Investigation Board (/board/:id) is an interactive canvas generated per article that maps the relationships between people, organisations, events, and documents mentioned in the article. Nodes can be dragged, zoom in/out, and you can export it as a PNG.",
  },
  {
    q: "What are Polymarket predictions?",
    a: "When a relevant prediction market exists on Polymarket, it is automatically matched and shown on the article. This gives a crowd-sourced probability estimate. Polymarket data is fetched live from their public API.",
  },
  {
    q: "How does community voting work?",
    a: "Below each article you can vote 'Credible', 'Suspect', or 'Witnessed'. These are tallied separately from the AI score and shown as a community consensus. Votes are stored locally and in our database (no login required).",
  },
  {
    q: "How do I use the Reference Index?",
    a: "Go to Search → Reference Index. Browse or filter by agency (CIA, FBI, NARA, etc.) or first letter. Click any document title to open the official source on the agency's website. These are curated links to publicly available declassified records.",
  },
  {
    q: "Is my data private?",
    a: "Yes. We collect only anonymised page-view events and optional contact messages. Community posts are pseudonymous (no login required). Full details are in our Privacy Policy.",
  },
  {
    q: "How can I contact you?",
    a: "Use the Contact page — select the appropriate category (Support, Business, Press, or Other) and fill in the form. We read all messages and respond to serious inquiries.",
  },
  {
    q: "Is there a mobile app?",
    a: "Not yet. The web platform is fully responsive and works on mobile browsers. A native app may be considered in the future.",
  },
  {
    q: "Is ConspiracyHub affiliated with any government?",
    a: "No. ConspiracyHub is an independent project. We aggregate publicly available information from government and non-government sources alike and do not have any official relationship with any agency.",
  },
];

function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{
      borderBottom: "1px solid #1a1a1a",
      transition: "background 0.15s",
    }}>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          width: "100%", textAlign: "left", background: "none", border: "none",
          padding: "18px 0", cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16,
        }}
      >
        <span style={{ fontSize: 14, color: "#d0d0d0", fontWeight: 500, lineHeight: 1.4 }}>{q}</span>
        <span style={{
          fontSize: 18, color: open ? "#6bc46b" : "#444", flexShrink: 0,
          transform: open ? "rotate(45deg)" : "none", transition: "transform 0.2s",
        }}>+</span>
      </button>
      {open && (
        <div style={{
          paddingBottom: 18, paddingRight: 24,
          fontSize: 13, color: "#777", lineHeight: 1.75,
        }}>
          {a}
        </div>
      )}
    </div>
  );
}

export default function FAQPage() {
  return (
    <div style={pageContentShellStyle({ maxWidth: 780 })}>
      <p style={{ margin: "0 0 8px", fontSize: 11, letterSpacing: "0.12em", color: "#444", textTransform: "uppercase" }}>
        Help
      </p>
      <h1 style={{ margin: "0 0 10px", fontSize: 28, fontWeight: 700, letterSpacing: "-0.02em", color: "#e8e8e8" }}>
        Frequently Asked Questions
      </h1>
      <p style={{ margin: "0 0 40px", color: "#666", fontSize: 14, lineHeight: 1.6, maxWidth: 540 }}>
        Can&apos;t find your answer here? Use the{" "}
        <a href="/contact" style={{ color: "#6bc46b", textDecoration: "none" }}>contact form</a>.
      </p>

      <div style={{ borderTop: "1px solid #1a1a1a" }}>
        {FAQS.map((item, i) => (
          <FAQItem key={i} q={item.q} a={item.a} />
        ))}
      </div>
    </div>
  );
}
