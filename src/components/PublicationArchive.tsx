import Link from "next/link";
import { redirect } from "next/navigation";
import PublicationHeader from "@/components/PublicationHeader";
import { TOPICS } from "@/lib/topics";
import { parsePublicationFilters, publicationSearchParams, type PublicationFilters } from "@/lib/publicationSearch";
import { searchPublication, type ArchiveResponse } from "@/lib/server/publicationArchive";
import "@/app/publication-pages.css";

type Params = Record<string, string | string[] | undefined>;
export default async function PublicationArchive({ title, description, path, params, defaults = {}, children }: {
  title: string; description: string; path: string; params: Params;
  defaults?: Partial<PublicationFilters>; children?: React.ReactNode;
}) {
  const raw = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => { if (typeof value === "string") raw.set(key, value); });
  const filters = { ...parsePublicationFilters(raw), ...defaults };
  let archive: ArchiveResponse;
  try { archive = await searchPublication(filters); }
  catch { archive = { results: [], total: 0, page: filters.page, pageSize: 18, unavailable: true }; }
  const totalPages = Math.min(50, Math.max(1, Math.ceil(archive.total / archive.pageSize)));
  if (!archive.unavailable && filters.page > totalPages) redirect(`${path}?${publicationSearchParams({ ...filters, page: totalPages })}`);
  const href = (page: number) => `${path}?${publicationSearchParams({ ...filters, page })}`;
  return (
    <div className="journal-page">
      <PublicationHeader />
      <div className="journal-shell">
        <header className="journal-hero">
          <span className="journal-kicker">Intelligence archive</span>
          <h1>{title}</h1><p>{description}</p>
        </header>
        <form action={path} method="get" className="journal-filters" role="search">
          <label className="journal-query">Search the archive<input type="search" name="q" defaultValue={filters.q} maxLength={160} placeholder="A story, subject or name" /></label>
          {defaults.type ? <input type="hidden" name="type" value={defaults.type} /> : <label>Content<select name="type" defaultValue={filters.type}><option value="all">All stories</option><option value="news">News briefings</option><option value="analysis">Analysis & hypotheses</option></select></label>}
          {defaults.topic ? <input type="hidden" name="topic" value={defaults.topic} /> : <label>Topic<select name="topic" defaultValue={filters.topic}><option value="">All topics</option>{TOPICS.map((topic) => <option value={topic.slug} key={topic.slug}>{topic.title}</option>)}</select></label>}
          <label>Published<select name="period" defaultValue={filters.period}><option value="all">Any time</option><option value="week">Past week</option><option value="month">Past month</option></select></label>
          <button className="journal-button" type="submit">Search →</button>
        </form>
        <div className="journal-result-heading"><span>{archive.unavailable ? "Archive temporarily unavailable" : `${archive.total} ${archive.total === 1 ? "story" : "stories"}${filters.q ? ` matching “${filters.q}”` : ""}`}</span><span>Newest published first</span></div>
        {archive.unavailable ? <div className="journal-empty" role="status"><h2>The archive is taking a moment.</h2><p>Please try again shortly. You can still explore our topics and research tools.</p><Link href="/topics">Explore topics →</Link></div> : archive.results.length === 0 ? <div className="journal-empty"><h2>No matching stories.</h2><p>Try a broader phrase, another topic or a longer date range.</p><Link href={path}>Clear filters →</Link></div> : <div className="journal-results">{archive.results.map((story) => <article key={story.href} className="journal-result"><div className="journal-result-meta"><span>{story.kind === "news" ? "News briefing" : story.kind === "hypothesis" ? "Hypothesis · speculative" : "Analysis"}</span><span>{story.category.replace(/-/g, " ")}</span><time dateTime={story.publishedAt}>{formatDate(story.publishedAt)}</time></div><h2><Link href={story.href}>{story.title}</Link></h2>{story.excerpt && <p>{story.excerpt}</p>}<Link className="journal-read" href={story.href}>Read {story.kind === "news" ? "briefing" : "analysis"} <span aria-hidden="true">↗</span></Link></article>)}</div>}
        {!archive.unavailable && totalPages > 1 && <nav className="journal-pagination" aria-label="Archive pagination">{filters.page > 1 ? <Link href={href(filters.page - 1)} rel="prev">← Previous</Link> : <span />}<span>Page {filters.page} of {totalPages}</span>{filters.page < totalPages ? <Link href={href(filters.page + 1)} rel="next">Next →</Link> : <span />}</nav>}
        {archive.total > 900 && <p className="journal-muted">Use a topic, date range or search phrase to narrow this archive beyond its first 900 results.</p>}
        {children}
      </div>
    </div>
  );
}
function formatDate(date: string): string {
  const value = new Date(date);
  return Number.isNaN(value.getTime()) ? "Date unavailable" : value.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}
