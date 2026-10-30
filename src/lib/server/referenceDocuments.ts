import { createClient } from "@supabase/supabase-js";

export type ReferenceDocument = {
  id: string;
  agency: string;
  title: string;
  canonical_url: string;
  excerpt: string | null;
  year: number | null;
};

export type DocumentIndexFilters = { q: string; agency: string };

export type DocumentIndex = {
  documents: ReferenceDocument[];
  agencies: string[];
  total: number;
  unavailable: boolean;
};

export function documentIndexFilters(params: Record<string, string | string[] | undefined>): DocumentIndexFilters {
  const one = (key: string) => {
    const value = params[key];
    return (Array.isArray(value) ? value[0] : value ?? "").trim();
  };
  return { q: one("q").slice(0, 160), agency: one("agency").slice(0, 40).toUpperCase() };
}

export function documentIndexParams(filters: DocumentIndexFilters): string {
  const search = new URLSearchParams();
  if (filters.q) search.set("q", filters.q);
  if (filters.agency) search.set("agency", filters.agency);
  return search.toString();
}

/**
 * Server-side so the index is in the HTML. It used to load from the browser after
 * hydration, which left search engines — and anyone reading without JS — an empty page
 * for the one part of the site made entirely of primary sources.
 */
export async function loadDocumentIndex(filters: DocumentIndexFilters): Promise<DocumentIndex> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) return { documents: [], agencies: [], total: 0, unavailable: true };

  try {
    const admin = createClient(url, key);
    const { data, error } = await admin
      .from("reference_documents")
      .select("id, agency, title, canonical_url, excerpt, year")
      .order("agency", { ascending: true })
      .order("title", { ascending: true });
    if (error) return { documents: [], agencies: [], total: 0, unavailable: true };

    const all = (data ?? []) as ReferenceDocument[];
    const agencies = [...new Set(all.map((d) => d.agency).filter(Boolean))].sort();

    const needle = filters.q.toLowerCase();
    const documents = all.filter((d) => {
      if (filters.agency && d.agency !== filters.agency) return false;
      if (!needle) return true;
      return `${d.title} ${d.excerpt ?? ""} ${d.agency}`.toLowerCase().includes(needle);
    });

    return { documents, agencies, total: documents.length, unavailable: false };
  } catch {
    return { documents: [], agencies: [], total: 0, unavailable: true };
  }
}
