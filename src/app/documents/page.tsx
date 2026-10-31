import Link from "next/link";
import type { Metadata } from "next";
import PublicationHeader from "@/components/PublicationHeader";
import {
  documentIndexFilters,
  documentIndexParams,
  loadDocumentIndex,
  type DocumentIndexFilters,
} from "@/lib/server/referenceDocuments";
import { getSiteUrl } from "@/lib/siteUrl";
import "@/app/publication-pages.css";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Public document index",
  description:
    "Search tens of thousands of official and declassified primary sources — CIA, FBI, NARA, DOD, Congress and more. Every entry links to the agency's own record.",
  alternates: { canonical: `${getSiteUrl()}/documents` },
};

export default async function DocumentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const filters = documentIndexFilters(await searchParams);
  const index = await loadDocumentIndex(filters);
  const cleared = "/documents";
  const href = (next: Partial<DocumentIndexFilters>) => {
    const params = documentIndexParams({ ...filters, ...next });
    return params ? `/documents?${params}` : cleared;
  };

  return (
    <div className="journal-page">
      <PublicationHeader section="Documents" />
      <div className="journal-shell">
        <header className="journal-hero">
          <span className="journal-kicker">Primary sources</span>
          <h1>Public document index</h1>
          <p>
            Official and declassified records held by the agencies themselves. Where the custodian
            publishes a scan, the title opens that document directly — nothing is mirrored or
            rehosted here, so what you read is the record as its custodian publishes it.
          </p>
        </header>

        <form action={cleared} method="get" className="journal-filters" role="search">
          <label className="journal-query">
            Search the index
            <input
              type="search"
              name="q"
              defaultValue={filters.q}
              maxLength={160}
              placeholder="MKULTRA, remote viewing, a programme or an agency"
            />
          </label>
          <label>
            Agency
            <select name="agency" defaultValue={filters.agency}>
              <option value="">All agencies</option>
              {index.agencies.map(({ agency, count }) => (
                <option key={agency} value={agency}>{`${agency} (${count})`}</option>
              ))}
            </select>
          </label>
          <button className="journal-button" type="submit">Search →</button>
        </form>

        <div className="journal-result-heading">
          <span>
            {index.unavailable
              ? "Index temporarily unavailable"
              : `${index.total.toLocaleString("en-GB")} ${index.total === 1 ? "document" : "documents"}${filters.agency ? ` from ${filters.agency}` : ""}${filters.q ? ` matching “${filters.q}”` : ""}`}
          </span>
          {index.pageCount > 1 ? <span>Page {index.page} of {index.pageCount}</span> : <span>Most relevant first</span>}
        </div>

        {index.unavailable ? (
          <div className="journal-empty" role="status">
            <h2>The index is taking a moment.</h2>
            <p>Please try again shortly. You can still explore our topics and analysis.</p>
            <Link href="/topics">Explore topics →</Link>
          </div>
        ) : index.documents.length === 0 ? (
          <div className="journal-empty">
            <h2>No matching documents.</h2>
            <p>Try a broader phrase, or browse every agency in the index.</p>
            <Link href={cleared}>Clear filters →</Link>
          </div>
        ) : (
          <>
            <div className="journal-results journal-results--records">
              {index.documents.map((doc) => (
                <article key={doc.id} className="journal-result">
                  <div className="journal-result-meta">
                    <span>{doc.agency}</span>
                    {doc.year ? <span>{doc.year}</span> : null}
                    {doc.collection ? <span>{doc.collection}</span> : null}
                    <span>{hostOf(doc.pdf_url ?? doc.canonical_url)}</span>
                    {doc.pdf_url ? <span className="journal-result-badge">PDF</span> : null}
                  </div>
                  <h2>
                    {/* The scan is what the reader came for; the record page is a step on the way. */}
                    <a href={doc.pdf_url ?? doc.canonical_url} target="_blank" rel="noopener noreferrer">
                      {doc.title}
                    </a>
                  </h2>
                  {doc.excerpt ? <p>{doc.excerpt}</p> : null}
                  <div className="journal-result-links">
                    {doc.pdf_url ? (
                      <a className="journal-read" href={doc.pdf_url} target="_blank" rel="noopener noreferrer">
                        Read the document <span aria-hidden="true">↗</span>
                      </a>
                    ) : null}
                    <a className="journal-read" href={doc.canonical_url} target="_blank" rel="noopener noreferrer">
                      {doc.pdf_url ? "Record page" : "Open the official record"} <span aria-hidden="true">↗</span>
                    </a>
                  </div>
                </article>
              ))}
            </div>

            {index.pageCount > 1 ? (
              <nav className="journal-pagination" aria-label="Document index pages">
                {index.page > 1 ? (
                  <Link href={href({ page: index.page - 1 })} rel="prev">← Previous</Link>
                ) : <span aria-hidden="true" />}
                <span>Page {index.page} of {index.pageCount}</span>
                {index.page < index.pageCount ? (
                  <Link href={href({ page: index.page + 1 })} rel="next">Next →</Link>
                ) : <span aria-hidden="true" />}
              </nav>
            ) : null}
          </>
        )}

        {filters.q ? (
          <p className="journal-muted">
            Not here?{" "}
            <a
              href={`https://www.cia.gov/readingroom/search/site/${encodeURIComponent(filters.q)}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              Search the CIA reading room for “{filters.q}” ↗
            </a>{" "}
            or{" "}
            <a
              href={`https://www.govinfo.gov/search?query=${encodeURIComponent(filters.q)}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              GovInfo ↗
            </a>
          </p>
        ) : null}

        <p className="journal-muted">
          Looking for a story rather than a record? <Link href="/blog">Read the investigations →</Link>
        </p>
      </div>
    </div>
  );
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}
