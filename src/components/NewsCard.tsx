"use client";
import Image from "next/image";
import Link from "next/link";
import ReaderReactionVote from "@/components/ReaderReactionVote";
import { canOptimizeImage } from "@/lib/imageHosts";
import { publicationDate, sectionLabel, sourceDomain } from "@/lib/editorialPresentation";
import type { NewsItem } from "@/types";

export default function NewsCard({ item, priority = false, read = false }: { item: NewsItem; onAnalyze?: (item: NewsItem) => void; priority?: boolean; read?: boolean }) {
  const href = `/article/${item.id}`;
  return <article className={`signal-card${read ? " signal-card-read" : ""}`} data-priority={item.score >= 85 ? "high" : "standard"}>
    <div className="signal-media">
      <Link href={href} tabIndex={-1} aria-hidden="true" className="signal-image-link">
        {item.image ? <Image src={item.image} alt="" fill unoptimized={!canOptimizeImage(item.image)} priority={priority} loading={priority ? "eager" : "lazy"} sizes="(max-width: 650px) 100vw, (max-width: 1000px) 50vw, 33vw" className="signal-image" /> : <span className="signal-image-placeholder"><span>◈</span><small>THE THEORIST / {sectionLabel(item.section || "INTELLIGENCE")}</small></span>}
      </Link>
      <span className="signal-file">{read ? "✓ VIEWED" : `FILE / ${item.id.slice(0, 8).toUpperCase()}`}</span>
      {Number.isFinite(item.score) && item.score > 0 ? <span className="signal-priority" title="AI ranking of topic relevance. This is not a measure of truth, danger or probability."><span>PRIORITY</span> <strong>{Math.round(item.score)}<small>/100</small></strong></span> : null}
      <span className="signal-section">{sectionLabel(item.section || "News")}</span>
    </div>
    <div className="signal-content">
      <div className="signal-reactions"><ReaderReactionVote articleId={item.id} initial={item.reader_reaction} /></div>
      <div className="signal-copy">
        <div className="signal-meta"><span>{sourceDomain(item.url)}</span><time dateTime={item.date}>{publicationDate(item.date)}</time></div>
        <h2><Link href={href}>{item.title}</Link></h2>
        {!item.angle && item.summary ? <p className="signal-summary">{item.summary}</p> : null}
        {item.angle ? <div className="signal-angle"><span>INVESTIGATION LEAD · AI</span><p>{item.angle}</p></div> : null}
        <Link href={href} className="signal-investigate"><span><i aria-hidden="true">◈</i> READ & INVESTIGATE</span><span aria-hidden="true">→</span></Link>
      </div>
    </div>
  </article>;
}
