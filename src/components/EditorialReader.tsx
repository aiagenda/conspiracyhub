"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import ReactMarkdown from "react-markdown";
import PublicationHeader from "@/components/PublicationHeader";
import LiveChat from "@/components/LiveChat";
import PolymarketWidget from "@/components/PolymarketWidget";
import VotePanel from "@/components/VotePanel";
import SaveInvestigationButton from "@/components/SaveInvestigationButton";
import { canOptimizeImage } from "@/lib/imageHosts";
import { isLiveChatEnabled, SHOW_COMMUNITY } from "@/lib/featureFlags";
import { markArticleRead } from "@/lib/readArticles";
import { trackContinueReading } from "@/lib/continueReading";
import { getSupabaseBrowserClient, isSupabaseBrowserConfigured } from "@/lib/supabase";
import { publicationDate, readingMinutes, safeSourceUrl, sectionLabel, sourceDomain } from "@/lib/editorialPresentation";
import type { NewsItem } from "@/types";
import type { VoteTheoryChip } from "@/lib/oracleVoteTheories";

type Source = { title: string; url: string; description?: string };
type Annotation = { text: string; category: string; note: string; severity?: string };
type Props = {
  item: NewsItem; body?: string; markdown?: string; sources?: Source[];
  generatedSlug?: string; initialChatOpen?: boolean; voteTheories?: VoteTheoryChip[];
  boardHref?: string;
  hypothesis?: boolean; bodyKind?: "source" | "summary"; updatedAt?: string; sourcePublishedAt?: string; checkedAt?: string; reviewMethod?: string;
};

function AnnotatedParagraph({ text, notes }: { text: string; notes: Annotation[] }) {
  const matches: Array<{ start: number; end: number; index: number }> = [];
  notes.forEach((note, index) => {
    const start = text.indexOf(note.text);
    if (start < 0 || !note.text) return;
    const end = start + note.text.length;
    if (!matches.some(m => start < m.end && end > m.start)) matches.push({ start, end, index });
  });
  matches.sort((a, b) => a.start - b.start);
  let cursor = 0;
  const parts = matches.map(match => {
    const before = text.slice(cursor, match.start);
    cursor = match.end;
    return <span key={match.index}>{before}<a className="editorial-annotation" href={`#annotation-${match.index}`} aria-label={`${text.slice(match.start, match.end)} — read AI annotation`}>{text.slice(match.start, match.end)}</a></span>;
  });
  return <p>{parts}{text.slice(cursor)}</p>;
}

export default function EditorialReader({ item, body = "", markdown = "", sources = [], generatedSlug, initialChatOpen = false, voteTheories = [], hypothesis = false, bodyKind = "source", updatedAt, sourcePublishedAt, checkedAt, reviewMethod, boardHref }: Props) {
  const generated = Boolean(generatedSlug);
  const [chatOpen, setChatOpen] = useState(Boolean(initialChatOpen && isLiveChatEnabled()));
  const [marketsOpen, setMarketsOpen] = useState(false);
  const [notes, setNotes] = useState<Annotation[]>([]);
  const [annotationState, setAnnotationState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [limited, setLimited] = useState(false);
  const [annotationError, setAnnotationError] = useState("");
  const [filter, setFilter] = useState("");
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);
  const path = generatedSlug ? `/blog/${generatedSlug}` : `/article/${item.id}`;
  const investigationHref = boardHref ?? `/board/${item.id}`;
  const originalUrl = !generated ? safeSourceUrl(item.url) : undefined;
  const readingText = markdown || body || item.summary;
  const kind = hypothesis ? "Hypothesis dossier" : generated || markdown ? "AI-assisted analysis" : bodyKind === "summary" ? "AI-assisted brief" : "Source reading";
  const showHero = item.image && !markdown.includes(`](${item.image})`);
  const sourceRows = sources.filter((source, index) => source.title && sources.findIndex(s => s.url === source.url && s.title === source.title) === index);
  useEffect(() => {
    markArticleRead(item.id);
    trackContinueReading({ ...(generatedSlug ? { generatedArticleId: item.id } : { newsId: item.id }), title: item.title, path });
  }, [item.id, item.title, generatedSlug, path]);

  async function annotate() {
    if (!body || annotationState === "loading") return;
    setAnnotationState("loading"); setAnnotationError("");
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (isSupabaseBrowserConfigured()) {
        const { data } = await getSupabaseBrowserClient().auth.getSession();
        if (data.session?.access_token) headers.Authorization = `Bearer ${data.session.access_token}`;
      }
      const response = await fetch("/api/article-highlights", { method: "POST", headers, body: JSON.stringify({ text: body, title: item.title }) });
      const data = await response.json();
      if (!response.ok || !Array.isArray(data.highlights)) throw new Error("Annotations are unavailable. You can continue reading the article and its sources.");
      setNotes(data.highlights.filter((note: Annotation) => typeof note.text === "string" && typeof note.note === "string" && body.includes(note.text)));
      setLimited(Boolean(data.is_limited)); setAnnotationState("ready");
    } catch (error) { setAnnotationError(error instanceof Error ? error.message : "Could not load annotations."); setAnnotationState("error"); }
  }
  async function share() {
    try { await navigator.clipboard.writeText(window.location.href); setCopied(true); setCopyError(false); }
    catch { setCopyError(true); }
  }

  return <div className="publication-page editorial-reader">
    <PublicationHeader section={kind} />
    <div className="publication-shell editorial-shell">
      <nav className="editorial-breadcrumb" aria-label="Breadcrumb"><Link href="/">Feed</Link><span aria-hidden="true">/</span><Link href={generated ? "/blog" : "/topics"}>{generated ? "Analysis" : "Topics"}</Link><span aria-hidden="true">/</span><span>{sectionLabel(item.section || "Reporting")}</span></nav>
      <div className="intelligence-reader-toolbar">
        <div className="intelligence-reader-workspace"><span aria-hidden="true">◈</span> Investigation workspace</div>
        <nav className="intelligence-reader-modes" aria-label="Investigation views">
          <a href="#article-text" className="intelligence-reader-current" aria-current="page">Read article</a>
          <Link href={investigationHref} prefetch={false} className="intelligence-reader-board">Open investigation board <span aria-hidden="true">↗</span></Link>
        </nav>
      </div>
      <header className="editorial-article-header">
        <p className="publication-eyebrow intelligence-reader-classification"><span>{sectionLabel(item.section || "Reporting")}</span><span className="intelligence-reader-kind">{kind}</span></p>
        <h1>{item.title}</h1>
        {(item.summary || item.angle) ? <p className="editorial-deck">{item.summary || item.angle}</p> : null}
        <div className="editorial-byline"><span>{generated || markdown || bodyKind === "summary" ? "The Theorist · AI-assisted" : sourceRows[0]?.title || sourceDomain(item.url)}</span><time dateTime={item.date}>{publicationDate(item.date)}</time><span>{readingMinutes(readingText)} min read</span>{updatedAt && updatedAt !== item.date ? <span>Updated <time dateTime={updatedAt}>{publicationDate(updatedAt)}</time></span> : null}</div>
        {(sourcePublishedAt || checkedAt) && <div className="editorial-byline">{sourcePublishedAt && <span>Source published <time dateTime={sourcePublishedAt}>{publicationDate(sourcePublishedAt)}</time></span>}{checkedAt && <span>{reviewMethod === "human" ? "Editorial review" : "Automated evidence check"} <time dateTime={checkedAt}>{publicationDate(checkedAt)}</time></span>}</div>}
        <div className="editorial-trust-line"><span>{hypothesis ? "Speculative interpretation. Sources provide context, not proof of the hypothesis." : generated || markdown ? "AI-generated synthesis. Check the original sources for evidence, quotations, and context." : bodyKind === "summary" ? "A short summary of external reporting. Read the original for the complete account." : "External reporting presented with source attribution. Optional AI annotations are separate interpretations."}</span><Link href="/about">Editorial standards ↗</Link></div>
        <div className="editorial-actions"><a href="#article-sources" className="publication-button publication-button-quiet">Sources & context ↓</a><SaveInvestigationButton newsId={generated ? undefined : item.id} generatedArticleId={generated ? item.id : undefined} title={item.title} /><button type="button" className="publication-button publication-button-quiet" onClick={() => void share()}>{copied ? "Link copied" : "Copy link"}</button>{originalUrl ? <a href={originalUrl} target="_blank" rel="noopener noreferrer" className="publication-text-link">Original reporting ↗</a> : null}</div>
        <span className="editorial-action-status" role="status">{copyError ? "Copy the page address from your browser to share this article." : copied ? "Article link copied to the clipboard." : ""}</span>
      </header>
      {showHero ? <figure className="editorial-hero"><div><Image src={item.image!} alt="" fill priority unoptimized={!canOptimizeImage(item.image!)} sizes="(max-width: 1100px) 100vw, 1100px" /></div><figcaption>Image accompanying this story{!generated && originalUrl ? <> · <a href={originalUrl} target="_blank" rel="noopener noreferrer">View original context</a></> : null}</figcaption></figure> : null}
      <div className="editorial-reading-layout">
        <div className="editorial-article-column" id="article-text">
          {markdown ? <article className="editorial-prose"><ReactMarkdown>{markdown}</ReactMarkdown></article> : body ? <article className="editorial-prose">{body.split(/\n\n+/).filter(Boolean).map((paragraph, index) => <AnnotatedParagraph key={index} text={paragraph} notes={notes} />)}</article> : <div className="editorial-prose"><p>{item.summary || "The complete article is available from the original publisher."}</p>{originalUrl ? <a href={originalUrl} target="_blank" rel="noopener noreferrer">Read the original story ↗</a> : null}</div>}
          <section id="article-sources" className="editorial-sources" aria-labelledby="article-sources-heading"><p className="publication-eyebrow">Trace the reporting</p><h2 id="article-sources-heading">Sources & context</h2><p className="editorial-note">A source link is a starting point for checking a claim. Its inclusion does not independently verify every statement in this article.</p>{sourceRows.length ? <ol>{sourceRows.map((source, index) => { const url = safeSourceUrl(source.url); return <li key={`${source.url}-${index}`}><span className="editorial-source-number">{String(index + 1).padStart(2, "0")}</span><div>{url ? <a href={url} target="_blank" rel="noopener noreferrer">{source.title} ↗</a> : <span>{source.title}</span>}{source.description ? <p>{source.description}</p> : null}<span className="editorial-source-domain">{url ? sourceDomain(url) : "No source URL supplied"}</span></div></li>; })}</ol> : <p className="editorial-note">No source references were supplied with this article. Treat its claims as unverified and consult independent reporting.</p>}<Link className="publication-text-link" href="/contact">Suggest a source or request a correction →</Link></section>
          <section className="editorial-next-step"><p className="publication-eyebrow">Continue the investigation</p><h2>Trace the connections.</h2><p>Explore the article’s research graph, source records, and open questions. AI connections are research leads, not proof.</p><div className="publication-actions"><Link href={investigationHref} prefetch={false} className="publication-button">Open investigation board →</Link><Link href="/topics" className="publication-text-link">Explore related topics →</Link></div></section>
          {SHOW_COMMUNITY ? <Link className="publication-text-link" href={`/community?${generated ? "generated_article" : "article"}=${item.id}`}>Discuss this story →</Link> : null}
          {isLiveChatEnabled() ? <section className="editorial-chat-section"><button type="button" className="publication-button publication-button-quiet" onClick={() => setChatOpen(!chatOpen)} aria-expanded={chatOpen} aria-controls="editorial-live-chat">{chatOpen ? "Close discussion" : "Open live discussion"}</button>{chatOpen ? <div id="editorial-live-chat" className="editorial-chat"><LiveChat articleId={generated ? undefined : item.id} generatedArticleId={generated ? item.id : undefined} articleTitle={item.title} onClose={() => setChatOpen(false)} /></div> : null}</section> : null}
        </div>
        <aside className="editorial-sidebar" aria-label="Reading tools">
          <div className="editorial-sidebar-section"><p className="publication-eyebrow">Investigation tools</p><a href="#article-sources">Sources & context ↓</a><Link href={investigationHref} prefetch={false}>Investigation board ↗</Link><Link href="/about">Our editorial approach ↗</Link></div>
          {body && !markdown ? <section className="editorial-sidebar-section"><h2>Reading annotations</h2><p>Optional AI notes about people, organizations, and context. These notes may be incomplete or mistaken.</p><button type="button" className="publication-button publication-button-quiet" onClick={() => void annotate()} disabled={annotationState === "loading" || annotationState === "ready"}>{annotationState === "loading" ? "Preparing annotations…" : annotationState === "ready" ? "Annotations loaded" : "Show AI annotations"}</button><div aria-live="polite">{annotationError ? <p role="alert">{annotationError}</p> : null}{annotationState === "ready" && !notes.length ? <p>No annotations were returned for this text.</p> : null}{limited ? <p>Only a subset of annotations is available for this session.</p> : null}</div>{notes.length ? <><label className="editorial-annotation-filter">Filter notes<select value={filter} onChange={event => setFilter(event.target.value)}><option value="">All categories</option>{[...new Set(notes.map(note => note.category))].map(category => <option key={category} value={category}>{sectionLabel(category)}</option>)}</select></label><ol className="editorial-annotation-list">{notes.map((note, index) => <li key={index} id={`annotation-${index}`} hidden={Boolean(filter && note.category !== filter)}><h3>{note.text}</h3><span>{sectionLabel(note.category)}</span><p>{note.note}</p></li>)}</ol></> : null}</section> : null}
          <VotePanel articleId={generated ? undefined : item.id} generatedArticleId={generated ? item.id : undefined} theories={voteTheories} />
          <details className="editorial-market-context" onToggle={event => setMarketsOpen(event.currentTarget.open)}><summary>Market context</summary><p>Market prices reflect participants’ expectations; they are not evidence that a claim is true.</p>{marketsOpen ? <PolymarketWidget query={item.title} context={readingText.slice(0, 1600)} variant="board" /> : null}</details>
        </aside>
      </div>
    </div>
  </div>;
}
