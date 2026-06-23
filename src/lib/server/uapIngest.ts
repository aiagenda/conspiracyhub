import { createHash } from "crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { runUapScrape } from "@/app/api/uap-sightings/route";
import { sortByPubDateDesc } from "@/lib/sortByPubDate";
import {
  UAP_DOCUMENTS,
  UAP_INCIDENTS,
  UAP_ORGANIZATIONS,
  UAP_PEOPLE,
  type UapDocument,
  type UapIncident,
  type UapOrganization,
  type UapPerson,
} from "@/lib/uapSeedData";
import {
  fetchAllUapDocumentFeeds,
  fetchAllUapNewsSources,
  fetchPursueFeed,
  type UapNewsItem,
} from "@/lib/server/uapFetchers";
import { isPursueDocument } from "@/lib/pursueDocument";

export function getUapAdmin(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) throw new Error("Missing Supabase env");
  return createClient(url, key);
}

function parsePubDate(raw: string): string | null {
  if (!raw) return null;
  const t = Date.parse(raw);
  return Number.isFinite(t) ? new Date(t).toISOString() : null;
}

function feedDocId(url: string, externalId?: string): string {
  if (externalId) return `pursue-${externalId}`;
  return `feed-${createHash("sha256").update(url).digest("hex").slice(0, 16)}`;
}

function yearFromPubDate(pubDate: string): number {
  const y = new Date(pubDate).getFullYear();
  return Number.isFinite(y) && y > 1950 ? y : new Date().getFullYear();
}

function documentTypeLabel(item: UapNewsItem): string {
  switch (item.type) {
    case "foia":
      return "FOIA Release";
    case "video":
      return "Sensor Video";
    case "audio":
      return "Audio Recording";
    case "photo":
      return "Photograph";
    default:
      return "Archive";
  }
}

function feedItemToDocument(item: UapNewsItem): UapDocument {
  const pub = item.pubDate || new Date().toISOString();
  return {
    id: feedDocId(item.url, item.externalId),
    name: item.title.slice(0, 200),
    year: yearFromPubDate(pub),
    type: documentTypeLabel(item),
    classification: "PUBLIC",
    url: item.url,
    description: `Auto-ingested from ${item.source}. Published ${pub.slice(0, 10)}.`,
  };
}

async function seedCuratedReference(admin: SupabaseClient): Promise<{ seeded: number }> {
  const rows: Array<{
    id: string;
    entity_type: string;
    payload: unknown;
    is_curated: boolean;
    source_label: string;
    source_url: string | null;
  }> = [];

  for (const i of UAP_INCIDENTS) {
    rows.push({
      id: i.id,
      entity_type: "incident",
      payload: i,
      is_curated: true,
      source_label: "curated",
      source_url: null,
    });
  }
  for (const p of UAP_PEOPLE) {
    rows.push({
      id: p.id,
      entity_type: "person",
      payload: p,
      is_curated: true,
      source_label: "curated",
      source_url: null,
    });
  }
  for (const o of UAP_ORGANIZATIONS) {
    rows.push({
      id: o.id,
      entity_type: "organization",
      payload: o,
      is_curated: true,
      source_label: "curated",
      source_url: o.url ?? null,
    });
  }
  for (const d of UAP_DOCUMENTS) {
    rows.push({
      id: d.id,
      entity_type: "document",
      payload: d,
      is_curated: true,
      source_label: "curated",
      source_url: d.url,
    });
  }

  const { error } = await admin.from("uap_intel_reference").upsert(rows, {
    onConflict: "id,entity_type",
    ignoreDuplicates: false,
  });
  if (error) throw new Error(`seed reference: ${error.message}`);
  return { seeded: rows.length };
}

async function ingestUapNews(admin: SupabaseClient): Promise<{ upserted: number; pruned: number }> {
  const items = await fetchAllUapNewsSources();
  const seen = new Set<string>();
  const rows = items
    .filter((item) => {
      if (!item.title || !item.url || seen.has(item.url)) return false;
      seen.add(item.url);
      return true;
    })
    .map((item) => ({
      title: item.title,
      url: item.url,
      source: item.source,
      pub_date: parsePubDate(item.pubDate),
      item_type: item.type,
      scraped_at: new Date().toISOString(),
    }));

  if (rows.length === 0) return { upserted: 0, pruned: 0 };

  const { error } = await admin.from("uap_news").upsert(rows, { onConflict: "url" });
  if (error) throw new Error(`uap_news upsert: ${error.message}`);

  const cutoff = new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString();
  const { data: prunedRows, error: pruneErr } = await admin
    .from("uap_news")
    .delete()
    .lt("scraped_at", cutoff)
    .select("id");
  if (pruneErr) console.warn("[uap ingest] prune news:", pruneErr.message);

  return { upserted: rows.length, pruned: prunedRows?.length ?? 0 };
}

async function ingestUapDocuments(admin: SupabaseClient): Promise<{ upserted: number }> {
  const items = await fetchAllUapDocumentFeeds();
  return upsertDocumentFeedItems(admin, items);
}

async function upsertDocumentFeedItems(admin: SupabaseClient, items: UapNewsItem[]): Promise<{ upserted: number }> {
  const seen = new Set<string>();
  let upserted = 0;

  for (const item of items) {
    if (!item.url || !item.title || seen.has(item.url)) continue;
    seen.add(item.url);
    const doc = feedItemToDocument(item);
    const { error } = await admin.from("uap_intel_reference").upsert(
      {
        id: doc.id,
        entity_type: "document",
        payload: doc,
        is_curated: false,
        source_label: item.source,
        source_url: item.url,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id,entity_type" },
    );
    if (!error) upserted++;
  }

  return { upserted };
}

/** Fetch PURSUE releases and upsert into uap_intel_reference. */
export async function runPursueDocumentIngest(): Promise<{
  fetched: number;
  upserted: number;
  warGovBlocked: boolean;
  warGovCount: number;
  newsFallbackCount: number;
  pursueDocumentsInDb: number;
  catalogSource: string;
  catalogTotal: number;
  manifestFetchedAt?: string;
}> {
  const admin = getUapAdmin();
  const feed = await fetchPursueFeed();
  const { upserted } = await upsertDocumentFeedItems(admin, feed.items);

  const payload = await loadUapPayload({ liveFallback: false });
  const pursueDocumentsInDb = payload.documents.filter(isPursueDocument).length;

  return {
    fetched: feed.items.length,
    upserted,
    warGovBlocked: feed.warGovBlocked,
    warGovCount: feed.warGovCount,
    newsFallbackCount: feed.newsFallbackCount,
    pursueDocumentsInDb,
    catalogSource: feed.catalogSource,
    catalogTotal: feed.catalogTotal,
    manifestFetchedAt: feed.manifestFetchedAt,
  };
}

/** Full UAP refresh: reference seed, news, documents, NUFORC sightings. */
export async function runUapFullScrape(maxNew = 70): Promise<{
  success: boolean;
  reference: { seeded: number };
  news: { upserted: number; pruned: number };
  documents: { upserted: number };
  sightings: Awaited<ReturnType<typeof runUapScrape>>;
  refreshed_at: string;
}> {
  const admin = getUapAdmin();
  const reference = await seedCuratedReference(admin);
  const [news, documents, sightings] = await Promise.all([
    ingestUapNews(admin),
    ingestUapDocuments(admin),
    runUapScrape(maxNew),
  ]);

  const refreshed_at = new Date().toISOString();
  await admin.from("uap_intel_meta").upsert({
    key: "last_full_refresh",
    value: { at: refreshed_at, news: news.upserted, documents: documents.upserted, sightings: sightings.inserted },
    updated_at: refreshed_at,
  });

  return {
    success: true,
    reference,
    news,
    documents,
    sightings,
    refreshed_at,
  };
}

async function loadReference<T>(
  admin: SupabaseClient,
  entityType: "incident" | "person" | "organization" | "document",
  fallback: readonly T[],
): Promise<T[]> {
  const { data } = await admin
    .from("uap_intel_reference")
    .select("payload, is_curated, updated_at")
    .eq("entity_type", entityType);

  // Merge curated fallback so newly-added reference data appears immediately, before the
  // next full scrape re-seeds the DB. DB rows take precedence over fallback for the same id.
  const merged = new Map<string, { payload: T; is_curated: boolean }>();
  for (const f of fallback) {
    const id = (f as { id?: string }).id;
    if (id) merged.set(id, { payload: f, is_curated: true });
  }
  for (const r of data ?? []) {
    const id = (r.payload as { id?: string })?.id;
    if (id) merged.set(id, { payload: r.payload as T, is_curated: Boolean(r.is_curated) });
  }
  const rows = [...merged.values()];
  if (rows.length === 0) return [...fallback] as T[];

  if (entityType === "document") {
    const curated = rows
      .filter((r) => r.is_curated)
      .map((r) => r.payload as UapDocument)
      .sort((a, b) => (b.year ?? 0) - (a.year ?? 0));
    const scraped = rows.filter((r) => !r.is_curated).map((r) => r.payload);
    return [...(curated as T[]), ...(scraped as T[])];
  }

  if (entityType === "incident") {
    return rows
      .map((r) => r.payload as UapIncident)
      .sort((a, b) => String(b.date).localeCompare(String(a.date))) as T[];
  }

  return rows.map((r) => r.payload) as T[];
}

async function loadNewsFromDb(admin: SupabaseClient): Promise<UapNewsItem[] | null> {
  const { data, error } = await admin
    .from("uap_news")
    .select("title, url, source, pub_date, item_type")
    .order("pub_date", { ascending: false, nullsFirst: false })
    .limit(80);

  if (error || !data?.length) return null;

  return data.map((row) => ({
    title: row.title as string,
    url: row.url as string,
    source: (row.source as string) ?? "Unknown",
    pubDate: (row.pub_date as string) ?? new Date().toISOString(),
    type: (row.item_type as string) ?? "news",
  }));
}

export type UapPayload = {
  incidents: UapIncident[];
  people: UapPerson[];
  organizations: UapOrganization[];
  documents: UapDocument[];
  news: UapNewsItem[];
  stats: Record<string, number>;
  generated_at: string;
  data_source: "database" | "live_fallback";
  last_full_refresh: string | null;
};

/** Load UAP page payload from DB; optional live fallback for news if DB empty. */
export async function loadUapPayload(options?: { liveFallback?: boolean }): Promise<UapPayload> {
  const admin = getUapAdmin();
  const liveFallback = options?.liveFallback !== false;

  const [incidents, people, organizations, documents, dbNews, metaRow] = await Promise.all([
    loadReference(admin, "incident", UAP_INCIDENTS),
    loadReference(admin, "person", UAP_PEOPLE),
    loadReference(admin, "organization", UAP_ORGANIZATIONS),
    loadReference(admin, "document", UAP_DOCUMENTS),
    loadNewsFromDb(admin),
    admin.from("uap_intel_meta").select("value").eq("key", "last_full_refresh").maybeSingle(),
  ]);

  let news: UapNewsItem[];
  let data_source: UapPayload["data_source"] = "database";

  if (dbNews?.length) {
    const seen = new Set<string>();
    news = sortByPubDateDesc(
      dbNews.filter((n) => {
        if (seen.has(n.title)) return false;
        seen.add(n.title);
        return true;
      }),
    );
  } else if (liveFallback) {
    const live = await fetchAllUapNewsSources();
    const seen = new Set<string>();
    news = sortByPubDateDesc(
      live.filter((n) => {
        if (seen.has(n.title)) return false;
        seen.add(n.title);
        return true;
      }),
    );
    data_source = "live_fallback";
  } else {
    news = [];
  }

  const last_full_refresh =
    metaRow.data?.value && typeof metaRow.data.value === "object" && metaRow.data.value !== null
      ? String((metaRow.data.value as { at?: string }).at ?? "")
      : null;

  return {
    incidents,
    people,
    organizations,
    documents,
    news,
    stats: {
      incidents: incidents.length,
      people: people.length,
      organizations: organizations.length,
      documents: documents.length,
      live_items: news.length,
    },
    generated_at: new Date().toISOString(),
    data_source,
    last_full_refresh: last_full_refresh || null,
  };
}

export async function findIncidentById(id: string): Promise<UapIncident | undefined> {
  const admin = getUapAdmin();
  const { data } = await admin
    .from("uap_intel_reference")
    .select("payload")
    .eq("entity_type", "incident")
    .eq("id", id)
    .maybeSingle();

  if (data?.payload) return data.payload as UapIncident;
  return UAP_INCIDENTS.find((i) => i.id === id);
}
