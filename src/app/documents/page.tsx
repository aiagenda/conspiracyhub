import Link from "next/link";
import type { Metadata } from "next";
import PublicationHeader from "@/components/PublicationHeader";
import { documentIndexFilters, loadDocumentIndex } from "@/lib/server/referenceDocuments";
import { getSiteUrl } from "@/lib/siteUrl";
import "@/app/publication-pages.css";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Public document index",
  description:
    "A curated index of official and declassified primary sources — CIA, FBI, NARA, DOD, DARPA and more. Every entry links to the agency's own record.",
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

  return (
    <div className="journal-page">
      <PublicationHeader section="Documents" />
      <div className="journal-shell">
        <header className="journal-hero">
          <span className="journal-kicker">Primary sources</span>
          <h1>Public document index</h1>
          <p>
            Official and declassified records held by the agencies themselves. Every entry opens the
            agency&apos;s own page — nothing is mirrored or rehosted here, so what you read is the
            record as its custodian publishes it.
          </p>
        </header>

        <form action={cleared} method="get" className="journal-filters" role="search">
          <label className="journal-query">
            Search the index
            <input type="search" name="q" defaultValue={filters.q} maxLength={160} placeholder="A programme, agency or collection" />
          </label>
          <label>
            Agency
            <select name="agency" defaultValue={filters.agency}>
              <option value="">All agencies</option>
              {index.agencies.map((agency) => (
                <option key={agency} value={agency}>{agency}</option>
              ))}
            </select>
          </label>
          <button className="journal-button" type="submit">Search →</button>
        </form>

        <div className="journal-result-heading">
          <span>
            {index.unavailable
              ? "Index temporarily unavailable"
              : `${index.total} ${index.total === 1 ? "document" : "documents"}${filters.agency ? ` from ${filters.agency}` : ""}${filters.q ? ` matching “${filters.q}”` : ""}`}
          </span>
          <span>Grouped by agency</span>
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
          <div className="journal-results">
            {index.documents.map((doc) => (
              <article key={doc.id} className="journal-result">
                <div className="journal-result-meta">
                  <span>{doc.agency}</span>
                  {doc.year ? <span>{doc.year}</span> : null}
                  <span>{hostOf(doc.canonical_url)}</span>
                </div>
                <h2>
                  <a href={doc.canonical_url} target="_blank" rel="noopener noreferrer">{doc.title}</a>
                </h2>
                {doc.excerpt ? <p>{doc.excerpt}</p> : null}
                <a className="journal-read" href={doc.canonical_url} target="_blank" rel="noopener noreferrer">
                  Open the official record <span aria-hidden="true">↗</span>
                </a>
              </article>
            ))}
          </div>
        )}

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
