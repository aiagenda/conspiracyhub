/** Live UAP feed fetchers (Google News, AARO, FOIA RSS, Reddit). */

export type UapNewsItem = {
  title: string;
  url: string;
  source: string;
  pubDate: string;
  type: string;
  /** Stable PURSUE card id when sourced from manifest. */
  externalId?: string;
};

const UA_BROWSER =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36";

export async function fetchAARO(): Promise<UapNewsItem[]> {
  const results: UapNewsItem[] = [];
  try {
    const res = await fetch("https://www.aaro.mil/News-Releases", {
      headers: { "User-Agent": "TheTheorist/1.0" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return results;
    const html = await res.text();
    for (const m of html.matchAll(/href="([^"]*(?:report|release|news)[^"]*)"[^>]*>([^<]+)</gi)) {
      const url = m[1].startsWith("http") ? m[1] : `https://www.aaro.mil${m[1]}`;
      const title = m[2].trim();
      if (title.length > 10 && title.length < 200) {
        results.push({ title, url, source: "AARO (Pentagon)", pubDate: "", type: "report" });
      }
    }
  } catch {
    /* optional */
  }
  return results.slice(0, 8);
}

export async function fetchBlackVaultFeed(): Promise<UapNewsItem[]> {
  try {
    const res = await fetch("https://www.theblackvault.com/documentarchive/category/ufos-extraterrestrials/feed/", {
      headers: { "User-Agent": "TheTheorist/1.0" },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return [];
    const xml = await res.text();
    const results: UapNewsItem[] = [];
    for (const m of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
      const x = m[1];
      const title = x.match(/<title>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/title>/)?.[1]?.trim() ?? "";
      const link = x.match(/<link>(.*?)<\/link>/)?.[1]?.trim() ?? "";
      const pub = x.match(/<pubDate>(.*?)<\/pubDate>/)?.[1]?.trim() ?? "";
      if (title && link) {
        results.push({
          title,
          url: link,
          source: "The Black Vault (FOIA)",
          pubDate: pub || new Date().toISOString(),
          type: "foia",
        });
      }
    }
    return results.slice(0, 12);
  } catch {
    return [];
  }
}

export async function fetchMuckRockUAP(): Promise<UapNewsItem[]> {
  try {
    const res = await fetch("https://www.muckrock.com/news/rss/?tag=ufo", {
      headers: { "User-Agent": "TheTheorist/1.0" },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return [];
    const xml = await res.text();
    const results: UapNewsItem[] = [];
    for (const m of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
      const x = m[1];
      const title = x.match(/<title>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/title>/)?.[1]?.trim() ?? "";
      const link = x.match(/<link>(.*?)<\/link>/)?.[1]?.trim() ?? "";
      const pub = x.match(/<pubDate>(.*?)<\/pubDate>/)?.[1]?.trim() ?? "";
      if (title && link) {
        results.push({
          title,
          url: link,
          source: "MuckRock (FOIA)",
          pubDate: pub || new Date().toISOString(),
          type: "foia",
        });
      }
    }
    return results.slice(0, 8);
  } catch {
    return [];
  }
}

export async function fetchUAPNews(): Promise<UapNewsItem[]> {
  const queries = [
    "UAP UFO Pentagon",
    "UFO disclosure 2026",
    "PURSUE UAP files war.gov",
    "Pentagon UFO files batch release",
    "Ross Coulthart UAP UFO",
    "David Grusch UAP whistleblower",
    "Ryan Graves UAP pilot",
    "Chris Mellon UAP",
    "AARO UAP report",
    "UAP Congressional hearing",
    "FOIA UFO declassified",
    "Pentagon UFO file dump",
    "non-human intelligence craft",
    "UAP whistleblower secret program",
    "alien craft recovered government",
    "UFO sighting military pilot",
  ];
  const seen = new Set<string>();
  const results: UapNewsItem[] = [];
  await Promise.all(
    queries.map(async (q) => {
      try {
        const res = await fetch(
          `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=en-US&gl=US&ceid=US:en`,
          { headers: { "User-Agent": UA_BROWSER }, signal: AbortSignal.timeout(7000) },
        );
        if (!res.ok) return;
        const xml = await res.text();
        for (const m of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
          const x = m[1];
          const title = x.match(/<title>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/title>/)?.[1]?.trim() ?? "";
          const link = x.match(/<link>(.*?)<\/link>/)?.[1]?.trim() ?? "";
          const pub = x.match(/<pubDate>(.*?)<\/pubDate>/)?.[1]?.trim() ?? "";
          const src = x.match(/<source[^>]*>(.*?)<\/source>/)?.[1]?.trim() ?? "";
          if (title && link && !seen.has(title)) {
            seen.add(title);
            results.push({
              title,
              url: link,
              source: src || "Google News",
              pubDate: pub || new Date().toISOString(),
              type: "news",
            });
          }
        }
      } catch {
        /* skip */
      }
    }),
  );
  return results.slice(0, 50);
}

export async function fetchRedditUAP(): Promise<UapNewsItem[]> {
  const results: UapNewsItem[] = [];
  for (const sub of ["UFOs", "UAP", "conspiracy"]) {
    try {
      const res = await fetch(`https://www.reddit.com/r/${sub}/hot.rss?limit=8`, {
        headers: { "User-Agent": "TheTheorist/1.0" },
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) continue;
      const xml = await res.text();
      for (const m of xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)) {
        const x = m[1];
        const title = x.match(/<title[^>]*>(.*?)<\/title>/)?.[1]?.trim() ?? "";
        const link = x.match(/href="(https:\/\/www\.reddit\.com\/r\/[^"]+)"/)?.[1] ?? "";
        const pub = x.match(/<updated>(.*?)<\/updated>/)?.[1] ?? "";
        if (title && link && /uap|ufo|alien|craft|disclosure|pentagon|grusch|aaro/i.test(title)) {
          results.push({
            title,
            url: link,
            source: `r/${sub}`,
            pubDate: pub || new Date().toISOString(),
            type: "social",
          });
        }
      }
    } catch {
      /* skip */
    }
  }
  return results.slice(0, 10);
}

/** All sources merged for news ingest (excludes FOIA feeds — those go to documents). */
export async function fetchAllUapNewsSources(): Promise<UapNewsItem[]> {
  const [aaro, news, reddit] = await Promise.all([fetchAARO(), fetchUAPNews(), fetchRedditUAP()]);
  return [...aaro, ...news, ...reddit];
}

export type PursueFetchResult = {
  items: UapNewsItem[];
  warGovBlocked: boolean;
  warGovCount: number;
  newsFallbackCount: number;
  catalogSource: "war.gov_csv" | "pursue_index_manifest" | "war.gov_html" | "google_news" | "none";
  catalogTotal: number;
  manifestFetchedAt?: string;
};

const PURSUE_CSV_URL = "https://www.war.gov/Portals/1/Interactive/2026/UFO/uap-data.csv";
const PURSUE_MANIFEST_URL =
  "https://raw.githubusercontent.com/BPSAI/pursue-index/main/data/manifests/latest.json";

type PursueManifestCard = {
  card_id: string;
  title: string;
  asset_type?: string;
  agency?: string;
  release_date?: string;
  incident_date?: string;
  incident_location?: string;
  description?: string;
  asset_url?: string | null;
  dvids_video_id?: string | null;
};

type PursueManifest = {
  source_url?: string;
  fetched_at?: string;
  cards: PursueManifestCard[];
};

function parsePursueReleaseDate(raw?: string): string {
  if (!raw?.trim()) return new Date().toISOString();
  const m = raw.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (!m) return new Date().toISOString();
  let year = parseInt(m[3], 10);
  if (year < 100) year += 2000;
  const d = new Date(year, parseInt(m[1], 10) - 1, parseInt(m[2], 10));
  return Number.isFinite(d.getTime()) ? d.toISOString() : new Date().toISOString();
}

function pursueAssetTypeLabel(assetType?: string): string {
  switch ((assetType ?? "").toUpperCase()) {
    case "VID":
      return "video";
    case "AUD":
      return "audio";
    case "IMG":
      return "photo";
    default:
      return "foia";
  }
}

function pursueCardToItem(card: PursueManifestCard): UapNewsItem | null {
  const title = card.title?.trim();
  if (!title || !card.card_id) return null;

  const officialUrl = card.asset_url?.trim() || "";
  let url = officialUrl;
  if (!url && card.dvids_video_id) {
    url = `https://pursue.report/records/dvids-${card.dvids_video_id}`;
  }
  if (!url) {
    url = `https://pursueindex.com/card/${card.card_id}/`;
  }

  return {
    title,
    url,
    source: officialUrl ? "PURSUE (war.gov/UFO)" : "PURSUE Archive (pursue.report)",
    pubDate: parsePursueReleaseDate(card.release_date),
    type: pursueAssetTypeLabel(card.asset_type),
    externalId: card.card_id,
  };
}

async function fetchPursueFromManifest(): Promise<{
  items: UapNewsItem[];
  fetchedAt?: string;
  warGovCount: number;
} | null> {
  try {
    const res = await fetch(PURSUE_MANIFEST_URL, {
      headers: { "User-Agent": "TheTheorist/1.0", Accept: "application/json" },
      signal: AbortSignal.timeout(15000),
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;
    const manifest = (await res.json()) as PursueManifest;
    if (!Array.isArray(manifest.cards) || manifest.cards.length === 0) return null;

    const items: UapNewsItem[] = [];
    let warGovCount = 0;
    for (const card of manifest.cards) {
      const item = pursueCardToItem(card);
      if (!item) continue;
      if (card.asset_url?.includes("war.gov")) warGovCount++;
      items.push(item);
    }

    return { items, fetchedAt: manifest.fetched_at, warGovCount };
  } catch {
    return null;
  }
}

/** Minimal CSV row parse for war.gov uap-data.csv when reachable. */
async function fetchPursueFromCsv(): Promise<UapNewsItem[] | null> {
  try {
    const res = await fetch(PURSUE_CSV_URL, {
      headers: { "User-Agent": UA_BROWSER, Accept: "text/csv,text/plain,*/*" },
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) return null;
    const text = await res.text();
    if (/access denied/i.test(text) || text.length < 100) return null;

    const lines = text.split(/\r?\n/).filter((l) => l.trim());
    if (lines.length < 2) return null;

    const items: UapNewsItem[] = [];
    for (const line of lines.slice(1)) {
      const cols = line.split(",").map((c) => c.replace(/^"|"$/g, "").trim());
      const title = cols[0] ?? cols.find((c) => /DOW-UAP|UAP-/i.test(c));
      const url = cols.find((c) => /^https?:\/\//i.test(c));
      if (title && url) {
        items.push({
          title,
          url,
          source: "PURSUE (war.gov/UFO)",
          pubDate: new Date().toISOString(),
          type: "foia",
        });
      }
    }
    return items.length > 0 ? items : null;
  } catch {
    return null;
  }
}

async function fetchPursueGoogleNewsFallback(seen: Set<string>): Promise<{ items: UapNewsItem[]; count: number }> {
  const items: UapNewsItem[] = [];
  let count = 0;
  try {
    for (const q of [
      "PURSUE UAP files war.gov 2026",
      "Department of War UAP files WAR.GOV UFO",
    ]) {
      const res = await fetch(
        `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=en-US&gl=US&ceid=US:en`,
        { headers: { "User-Agent": UA_BROWSER }, signal: AbortSignal.timeout(6000) },
      );
      if (!res.ok) continue;
      const xml = await res.text();
      for (const m of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
        const x = m[1];
        const title = x.match(/<title>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/title>/)?.[1]?.trim() ?? "";
        const link = x.match(/<link>(.*?)<\/link>/)?.[1]?.trim() ?? "";
        const pub = x.match(/<pubDate>(.*?)<\/pubDate>/)?.[1]?.trim() ?? "";
        if (
          title &&
          link &&
          !seen.has(link) &&
          /pursue|war\.gov|ufo.*file|uap.*release|anomalous phenomena/i.test(title)
        ) {
          seen.add(link);
          items.push({
            title,
            url: link,
            source: "PURSUE News",
            pubDate: pub || new Date().toISOString(),
            type: "foia",
          });
          count++;
        }
      }
    }
  } catch {
    /* skip */
  }
  return { items, count };
}

/**
 * PURSUE — Pentagon UAP file portal (war.gov/UFO).
 * Primary catalog: pursue-index manifest (mirrors official uap-data.csv).
 * Falls back to Google News when manifest unavailable.
 */
export async function fetchPursueFeed(): Promise<PursueFetchResult> {
  let warGovBlocked = false;

  const csvItems = await fetchPursueFromCsv();
  if (csvItems?.length) {
    return {
      items: csvItems,
      warGovBlocked: false,
      warGovCount: csvItems.length,
      newsFallbackCount: 0,
      catalogSource: "war.gov_csv",
      catalogTotal: csvItems.length,
    };
  }
  warGovBlocked = true;

  const manifest = await fetchPursueFromManifest();
  if (manifest?.items.length) {
    return {
      items: manifest.items,
      warGovBlocked,
      warGovCount: manifest.warGovCount,
      newsFallbackCount: 0,
      catalogSource: "pursue_index_manifest",
      catalogTotal: manifest.items.length,
      manifestFetchedAt: manifest.fetchedAt,
    };
  }

  const htmlResults: UapNewsItem[] = [];
  let warGovCount = 0;
  try {
    const res = await fetch("https://www.war.gov/UFO/", {
      headers: { "User-Agent": UA_BROWSER, Accept: "text/html" },
      signal: AbortSignal.timeout(8000),
    });
    if (res.ok) {
      const html = await res.text();
      if (!/access denied/i.test(html)) {
        for (const m of html.matchAll(/href="([^"]*(?:DOW-UAP|dow-uap|PURSUE|pursue)[^"]*\.?(?:pdf|mp4|png|jpg)?)"/gi)) {
          const rawUrl = m[1];
          const url = rawUrl.startsWith("http") ? rawUrl : `https://www.war.gov${rawUrl}`;
          const filename = url.split("/").pop() ?? url;
          const title = filename
            .replace(/\.(pdf|mp4|png|jpg)$/i, "")
            .replace(/[-_]/g, " ")
            .trim();
          if (title.length > 4) {
            htmlResults.push({
              title: `[PURSUE] ${title}`,
              url,
              source: "PURSUE (war.gov/UFO)",
              pubDate: new Date().toISOString(),
              type: "foia",
            });
            warGovCount++;
          }
        }
      }
    }
  } catch {
    /* skip */
  }

  if (htmlResults.length >= 3) {
    return {
      items: htmlResults,
      warGovBlocked,
      warGovCount,
      newsFallbackCount: 0,
      catalogSource: "war.gov_html",
      catalogTotal: htmlResults.length,
    };
  }

  const seen = new Set(htmlResults.map((r) => r.url));
  const news = await fetchPursueGoogleNewsFallback(seen);

  return {
    items: [...htmlResults, ...news.items],
    warGovBlocked,
    warGovCount,
    newsFallbackCount: news.count,
    catalogSource: news.items.length ? "google_news" : "none",
    catalogTotal: htmlResults.length + news.items.length,
  };
}

export async function fetchPURSUE(): Promise<UapNewsItem[]> {
  return (await fetchPursueFeed()).items;
}

/** FOIA RSS feeds for document ingest. */
export async function fetchAllUapDocumentFeeds(): Promise<UapNewsItem[]> {
  const [blackvault, muckrock, pursue] = await Promise.all([fetchBlackVaultFeed(), fetchMuckRockUAP(), fetchPURSUE()]);
  return [...pursue, ...blackvault, ...muckrock];
}
