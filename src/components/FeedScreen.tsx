"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import PublicationHeader from "@/components/PublicationHeader";
import NewsCard from "@/components/NewsCard";
import HeadlineTicker from "@/components/HeadlineTicker";
import IntelligenceStatus from "@/components/IntelligenceStatus";
import SeismicFeedStrip from "@/components/SeismicFeedStrip";
import type { NewsItem } from "@/types";
import { getReadIds, READ_ARTICLES_EVENT } from "@/lib/readArticles";
import { TOPICS } from "@/lib/topics";
export type FeedNotice = "missing_supabase_env" | "empty_database" | "load_error";
export type FeedPagination = { page: number; pageSize: number; totalCount: number; totalPages: number };
export default function FeedScreen({ initialItems, feedNotice, feedPagination, sort = "latest", topic = "", range = "week" }: {
  initialItems: NewsItem[]; feedNotice?: FeedNotice; feedPagination?: FeedPagination;
  sort?: "latest" | "priority"; topic?: string; range?: "week" | "all";
}) {
  const [readIds, setReadIds] = useState<Set<string>>(() => new Set());
  useEffect(() => {
    function sync() { setReadIds(new Set(getReadIds())); }
    sync(); window.addEventListener("storage", sync); window.addEventListener(READ_ARTICLES_EVENT, sync);
    return () => { window.removeEventListener("storage", sync); window.removeEventListener(READ_ARTICLES_EVENT, sync); };
  }, []);
  function pageLink(page: number, nextSort = sort) {
    const next = new URLSearchParams();
    if (nextSort !== "latest") next.set("sort", nextSort);
    if (topic) next.set("topic", topic);
    if (range === "all") next.set("range", "all");
    if (page > 1) next.set("page", String(page));
    return next.size ? `/?${next}` : "/";
  }
  const firstPage = !feedPagination || feedPagination.page === 1;
  return <div className="publication-page intelligence-feed intelligence-desk">
    <PublicationHeader />
    <IntelligenceStatus />
    <HeadlineTicker items={initialItems} />
    <div className="publication-shell">
      <section className="desk-heading">
        <div><p className="desk-overline"><span aria-hidden="true">■</span> INDEPENDENT MINDS. CONNECTED EVIDENCE.</p><h1>Investigation feed<span aria-hidden="true">_</span></h1></div>
        <Link href="/search#research" className="desk-investigate" aria-label="Investigate a source"><span aria-hidden="true">＋</span> Investigate a source <span aria-hidden="true">↗</span></Link>
      </section>
      {firstPage ? <div className="desk-activity"><SeismicFeedStrip compact /></div> : null}
      <section aria-label="Browse reporting">
        <div className="desk-feed-toolbar">
          <div className="desk-feed-label"><span className="desk-live-dot" aria-hidden="true" /><h2>{topic ? TOPICS.find(t => t.slug === topic)?.title : "The latest signals"}</h2><span>{feedPagination?.totalCount ?? initialItems.length}</span></div>
          <form action="/" method="get" className="desk-feed-filters">
            <input type="hidden" name="sort" value={sort} />
            <label><span className="desk-sr-only">Topic</span><select name="topic" defaultValue={topic} key={`topic-${topic}`} onChange={e => e.currentTarget.form?.requestSubmit()}><option value="">All topics</option>{TOPICS.map(value => <option key={value.slug} value={value.slug}>{value.title}</option>)}</select></label>
            <label><span className="desk-sr-only">Period</span><select name="range" defaultValue={range} key={`range-${range}`} onChange={e => e.currentTarget.form?.requestSubmit()}><option value="week">Past week</option><option value="all">All dates</option></select></label>
            <noscript><button type="submit">Filter</button></noscript>
          </form>
          <nav className="desk-sort" aria-label="Sort news"><Link href={pageLink(1, "latest")} aria-current={sort === "latest" ? "true" : undefined}>Latest</Link><Link href={pageLink(1, "priority")} aria-current={sort === "priority" ? "true" : undefined}>Priority</Link></nav>
        </div>
        {sort === "priority" ? <p className="publication-filter-note">AI priority ranks topic relevance. It does not measure truth, risk, or probability.</p> : null}
        {initialItems.length === 0 ? <div className="publication-empty" role="status"><h2>{feedNotice === "missing_supabase_env" || feedNotice === "load_error" ? "Reporting is temporarily unavailable" : "No stories in this selection"}</h2><p>{feedNotice === "missing_supabase_env" || feedNotice === "load_error" ? "Please try again later. You can still explore our investigations and research resources." : "Try a different topic or expand the period to all reporting."}</p><div className="publication-actions"><Link className="publication-text-link" href="/?range=all">Browse all reporting →</Link><Link className="publication-text-link" href="/blog">Read investigations →</Link></div></div> : null}
        {initialItems.length > 0 ? <div className="intelligence-grid">{initialItems.map((item, index) => <NewsCard key={item.id} item={item} read={readIds.has(item.id)} priority={index < 3} />)}</div> : null}
        {feedPagination && feedPagination.totalPages > 1 ? <nav className="publication-pagination" aria-label="Reporting pages">{feedPagination.page > 1 ? <Link href={pageLink(feedPagination.page - 1)} className="publication-button publication-button-quiet">← Previous</Link> : <span />}<span>Page {feedPagination.page} of {feedPagination.totalPages}</span>{feedPagination.page < feedPagination.totalPages ? <Link href={pageLink(feedPagination.page + 1)} className="publication-button publication-button-quiet">Next →</Link> : <span />}</nav> : null}
      </section>
      <aside className="intelligence-next"><div><span className="publication-eyebrow">Keep digging</span><h2>Go beyond the feed.</h2></div><Link href="/blog">◈ In-depth analysis <span>→</span></Link><Link href="/toolkit">◈ Research toolkit <span>→</span></Link><Link href="/data">◈ All monitors <span>→</span></Link></aside>
    </div>
  </div>;
}
