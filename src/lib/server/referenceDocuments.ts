import { createClient } from "@supabase/supabase-js";

export const DOCUMENTS_PER_PAGE = 40;

export type ReferenceDocument = {
  id: string;
  agency: string;
  title: string;
  canonical_url: string;
  excerpt: string | null;
  year: number | null;
  collection: string | null;
  pdf_url: string | null;
};

export type DocumentIndexFilters = { q: string; agency: string; page: number };

export type DocumentIndex = {
  documents: ReferenceDocument[];
  agencies: { agency: string; count: number }[];
  total: number;
  page: number;
  pageCount: number;
  unavailable: boolean;
};

export function documentIndexFilters(params: Record<string, string | string[] | undefined>): DocumentIndexFilters {
  const one = (key: string) => {
    const value = params[key];
    return (Array.isArray(value) ? value[0] : value ?? "").trim();
  };
  const page = Number.parseInt(one("page"), 10);
  return {
    q: one("q").slice(0, 160),
    agency: one("agency").slice(0, 40).toUpperCase(),
    page: Number.isFinite(page) && page > 1 ? Math.min(page, 500) : 1,
  };
}

export function documentIndexParams(filters: Partial<DocumentIndexFilters>): string {
  const search = new URLSearchParams();
  if (filters.q) search.set("q", filters.q);
  if (filters.agency) search.set("agency", filters.agency);
  if (filters.page && filters.page > 1) search.set("page", String(filters.page));
  return search.toString();
}

function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  return url && key ? createClient(url, key) : null;
}

/**
 * Search runs in Postgres, not in Node. The index used to be a few hundred curated
 * links, small enough to pull whole and filter in memory; it is now tens of thousands
 * of individual declassified records, where that approach silently truncated at
 * PostgREST's 1000-row ceiling — a search for "remote viewing" could only ever find
 * what happened to be in the first page of rows.
 */
export async function loadDocumentIndex(filters: DocumentIndexFilters): Promise<DocumentIndex> {
  const empty: DocumentIndex = {
    documents: [], agencies: [], total: 0, page: 1, pageCount: 0, unavailable: true,
  };
  const client = admin();
  if (!client) return empty;

  try {
    const [documents, agencies] = await Promise.all([
      client.rpc("search_reference_documents", {
        p_query: filters.q,
        p_agency: filters.agency,
        p_limit: DOCUMENTS_PER_PAGE,
        p_offset: (filters.page - 1) * DOCUMENTS_PER_PAGE,
      }),
      client.rpc("reference_document_agencies"),
    ]);
    if (documents.error) return empty;

    const rows = (documents.data ?? []) as (ReferenceDocument & { total: number })[];
    const total = rows.length ? Number(rows[0].total) : 0;
    return {
      documents: rows.map(({ total: _total, ...doc }) => doc),
      agencies: ((agencies.data ?? []) as { agency: string; document_count: number }[])
        .map((row) => ({ agency: row.agency, count: Number(row.document_count) })),
      total,
      page: filters.page,
      pageCount: Math.ceil(total / DOCUMENTS_PER_PAGE),
      unavailable: false,
    };
  } catch {
    return empty;
  }
}

export type ReferenceDocumentHit = Omit<ReferenceDocument, "id">;

/**
 * Keyword lookup over the declassified index, for the Oracle's evidence stage.
 *
 * `search_reference_documents` runs `websearch_to_tsquery`, which ANDs every term, so a
 * sentence-shaped query matches nothing: measured against the live index, "MKULTRA"
 * returns 468 rows and "COINTELPRO" 131, while "CIA MKULTRA mind control subprojects"
 * returns 0. Callers must therefore pass short entity keywords, one subject each, and
 * each is searched separately rather than joined into one query.
 */
export async function searchReferenceDocumentsByKeywords(
  keywords: string[],
  perKeyword = 4,
  cap = 12,
): Promise<ReferenceDocumentHit[]> {
  const client = admin();
  const terms = keywords
    .map((k) => k.replace(/\s+/g, " ").trim().slice(0, 60))
    .filter((k) => k.length >= 3)
    .slice(0, 8);
  if (!client || !terms.length) return [];

  const perTerm = await Promise.all(
    terms.map(async (term) => {
      try {
        const { data, error } = await client.rpc("search_reference_documents", {
          p_query: term,
          p_agency: "",
          p_limit: perKeyword,
          p_offset: 0,
        });
        return error ? [] : ((data ?? []) as (ReferenceDocumentHit & { id: string; total: number })[]);
      } catch {
        return [];
      }
    }),
  );

  // Round-robin across the terms so one prolific keyword cannot crowd the others out of
  // the cap — a graph needs evidence on several entities, not ten documents on one.
  const out: ReferenceDocumentHit[] = [];
  const seen = new Set<string>();
  for (let rank = 0; rank < perKeyword && out.length < cap; rank += 1) {
    for (const rows of perTerm) {
      const row = rows[rank];
      if (!row?.canonical_url || seen.has(row.canonical_url)) continue;
      seen.add(row.canonical_url);
      out.push({
        agency: row.agency,
        title: row.title,
        canonical_url: row.canonical_url,
        excerpt: row.excerpt,
        year: row.year,
        collection: row.collection,
        pdf_url: row.pdf_url,
      });
      if (out.length >= cap) break;
    }
  }
  return out;
}
