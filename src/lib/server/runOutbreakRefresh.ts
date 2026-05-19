import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { callOpenAIJSON } from "@/lib/openai";
import { sortByPubDateDesc, sortByPublishedAtDesc } from "@/lib/sortByPubDate";

export const OUTBREAK_CACHE_TTL_MS = 3_600_000;
/** Bump when pipeline changes so stale JSON blobs are ignored. */
export const OUTBREAK_CACHE_VERSION = 2;
const OUTBREAK_LOCAL_NEWS_MAX = 10;
const OUTBREAK_CANDIDATE_MAX = 12;
const OUTBREAK_ANALYZE_MAX = 8;
const FEED_OUTBREAK_LOOKBACK_DAYS = 21;

/** WHO news-releases feed 404s; Africa emergencies RSS includes Ebola/Marburg/etc. */
const OUTBREAK_RSS_FEEDS = ["https://www.afro.who.int/rss/emergencies.xml"];

const OUTBREAK_KEYWORD_RE =
  /disease|outbreak|virus|infection|fever|flu|ebola|mpox|cholera|plague|epidemic|dengue|marburg|hanta|hantavirus|polio|measles|pandemic|pathogen|bioweapon|avian|influenza|lassa|nipah|zika|coronavirus|covid|mers|sudan virus/i;

const DISEASE_SIGNATURES = [
  "ebola",
  "marburg",
  "mpox",
  "h5n1",
  "hantavirus",
  "hanta",
  "cholera",
  "dengue",
  "measles",
  "polio",
  "plague",
  "influenza",
  "coronavirus",
  "covid",
  "mers",
  "lassa",
  "nipah",
  "zika",
  "sudan virus",
  "yellow fever",
  "bird flu",
  "avian",
] as const;

const COORDS: Record<string, [number, number]> = {
  china: [35.86, 104.19],
  india: [20.59, 78.96],
  brazil: [-14.23, -51.92],
  congo: [-4.03, 21.75],
  drc: [-4.03, 21.75],
  nigeria: [9.08, 8.67],
  "united states": [37.09, -95.71],
  usa: [37.09, -95.71],
  kenya: [-0.02, 37.9],
  ethiopia: [9.14, 40.48],
  pakistan: [30.37, 69.34],
  indonesia: [-0.78, 113.92],
  philippines: [12.87, 121.77],
  ukraine: [48.37, 31.16],
  russia: [61.52, 105.31],
  iran: [32.42, 53.68],
  egypt: [26.82, 30.8],
  "south africa": [-30.55, 22.93],
  cambodia: [12.56, 104.99],
  myanmar: [21.91, 95.95],
  bangladesh: [23.68, 90.35],
  sudan: [12.86, 30.21],
  somalia: [5.15, 46.19],
  chad: [15.45, 18.73],
  guinea: [11.8, -15.18],
  peru: [-9.19, -75.01],
  colombia: [4.57, -74.29],
  mexico: [23.63, -102.55],
  kazakhstan: [48.01, 66.92],
  argentina: [-38.41, -63.61],
  chile: [-35.67, -71.54],
  bolivia: [-16.29, -63.58],
  venezuela: [6.42, -66.58],
  panama: [8.53, -80.78],
  "costa rica": [9.74, -83.75],
  nicaragua: [12.86, -85.2],
  tanzania: [-6.36, 34.89],
  rwanda: [-1.94, 29.87],
  uganda: [1.37, 32.29],
  ghana: [7.95, -1.02],
  "sierra leone": [8.46, -11.78],
  liberia: [6.43, -9.43],
  global: [20, 0],
};

type CuratedItem = { title: string; description: string; link: string; pubDate: string };

const CURATED_DISEASES: CuratedItem[] = [
  {
    title: "Hantavirus — South America & Central Asia",
    description:
      "Hantavirus cases reported. Spread via rodent contact. No human-to-human transmission confirmed. Early warning clusters detected.",
    link: "https://www.who.int/emergencies/disease-outbreak-news",
    pubDate: "",
  },
  {
    title: "H5N1 Avian Influenza — Human Cases",
    description:
      "H5N1 bird flu human infections confirmed in multiple countries. WHO monitoring for sustained human-to-human transmission.",
    link: "https://www.who.int/emergencies/disease-outbreak-news",
    pubDate: "",
  },
  {
    title: "Mpox — Clade Ib Ongoing Outbreak",
    description:
      "Mpox clade Ib spreading across Central Africa. New variants show higher transmissibility. WHO declared public health emergency.",
    link: "https://www.who.int/emergencies/disease-outbreak-news",
    pubDate: "",
  },
  {
    title: "Marburg Virus Disease — East Africa",
    description:
      "Marburg virus outbreak confirmed. Contact tracing underway. High fatality rate disease with no approved vaccine.",
    link: "https://www.who.int/emergencies/disease-outbreak-news",
    pubDate: "",
  },
  {
    title: "Dengue Fever — Record Cases South America",
    description:
      "Brazil reports over 3 million dengue cases. Aedes aegypti mosquito range expanding due to climate change.",
    link: "https://www.who.int/emergencies/disease-outbreak-news",
    pubDate: "",
  },
  {
    title: "Cholera — Sub-Saharan Africa",
    description: "Cholera spreading across multiple African countries. WHO reports over 500,000 cases this year.",
    link: "https://www.who.int/emergencies/disease-outbreak-news",
    pubDate: "",
  },
  {
    title: "Ebola Virus Disease — Central Africa",
    description:
      "Ebola virus disease clusters under WHO monitoring in DRC and neighboring regions. Contact tracing and lab confirmation ongoing.",
    link: "https://www.who.int/emergencies/disease-outbreak-news",
    pubDate: "",
  },
];

type LocalNewsRow = { title: string; url: string; source: string; pubDate: string };

function stripHtml(s: string): string {
  return s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function isOutbreakRelevant(text: string): boolean {
  return OUTBREAK_KEYWORD_RE.test(text);
}

function isWeakRssTitle(title: string): boolean {
  const t = title.toLowerCase();
  return t === "weekly bulletin" || t.startsWith("weekly bulletin ");
}

function diseaseSignature(title: string): string {
  const t = title.toLowerCase();
  for (const d of DISEASE_SIGNATURES) {
    if (t.includes(d)) return d;
  }
  const first = t.split(/[^a-z0-9]+/).find((w) => w.length > 3);
  return first ?? t.slice(0, 24);
}

function mergeOutbreakCandidates(feed: CuratedItem[], rss: CuratedItem[], curated: CuratedItem[]): CuratedItem[] {
  const out: CuratedItem[] = [];
  const seen = new Set<string>();

  const add = (item: CuratedItem) => {
    if (!item.title?.trim() || isWeakRssTitle(item.title)) return;
    const sig = diseaseSignature(item.title);
    if (seen.has(sig)) return;
    seen.add(sig);
    out.push(item);
  };

  for (const item of sortByPubDateDesc(feed)) add(item);
  for (const item of sortByPubDateDesc(rss)) add(item);
  for (const item of curated) add(item);

  return out.slice(0, OUTBREAK_CANDIDATE_MAX);
}

async function parseRssItems(feedUrl: string): Promise<CuratedItem[]> {
  const res = await fetch(feedUrl, {
    headers: { "User-Agent": "TheTheorist/1.0" },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) return [];
  const xml = await res.text();
  const items: CuratedItem[] = [];
  for (const m of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const x = m[1];
    const title = x.match(/<title>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/title>/)?.[1]?.trim() ?? "";
    const desc =
      x
        .match(/<description>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/)?.[1]
        ?.replace(/<[^>]+>/g, " ")
        .trim() ?? "";
    const link = x.match(/<link>(.*?)<\/link>/)?.[1]?.trim() ?? "";
    const pub = x.match(/<pubDate>(.*?)<\/pubDate>/)?.[1]?.trim() ?? "";
    if (title && link && isOutbreakRelevant(title + " " + desc)) {
      items.push({ title, description: stripHtml(desc).slice(0, 300), link, pubDate: pub });
    }
  }
  return items;
}

async function fetchOutbreakRss(): Promise<CuratedItem[]> {
  const batches = await Promise.allSettled(OUTBREAK_RSS_FEEDS.map((url) => parseRssItems(url)));
  const merged: CuratedItem[] = [];
  for (const b of batches) {
    if (b.status === "fulfilled") merged.push(...b.value);
  }
  return sortByPubDateDesc(merged);
}

async function fetchFeedOutbreakCandidates(admin: SupabaseClient): Promise<CuratedItem[]> {
  const cutoff = new Date(Date.now() - FEED_OUTBREAK_LOOKBACK_DAYS * 24 * 3600_000).toISOString();
  const { data, error } = await admin
    .from("news_items")
    .select("title, summary, url, published_at, angle")
    .gte("published_at", cutoff)
    .gte("score", 55)
    .order("published_at", { ascending: false })
    .limit(120);

  if (error || !data?.length) return [];

  const items: CuratedItem[] = [];
  for (const row of data) {
    const title = String(row.title ?? "").trim();
    const blob = [title, row.summary, row.angle].filter(Boolean).join(" ");
    if (!title || !isOutbreakRelevant(blob)) continue;
    items.push({
      title,
      description: stripHtml(String(row.summary ?? row.angle ?? "")).slice(0, 300) || title,
      link: String(row.url ?? "/"),
      pubDate: row.published_at ? new Date(row.published_at).toUTCString() : "",
    });
  }
  return sortByPubDateDesc(items);
}

async function fetchFeedLocalNews(admin: SupabaseClient, disease: string): Promise<LocalNewsRow[]> {
  const token = disease.split(/\s+/)[0]?.toLowerCase();
  if (!token || token.length < 3) return [];

  const cutoff = new Date(Date.now() - FEED_OUTBREAK_LOOKBACK_DAYS * 24 * 3600_000).toISOString();
  const { data } = await admin
    .from("news_items")
    .select("title, url, published_at, source")
    .gte("published_at", cutoff)
    .order("published_at", { ascending: false })
    .limit(80);

  if (!data?.length) return [];

  const re = new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
  const rows: LocalNewsRow[] = [];
  for (const row of data) {
    const title = String(row.title ?? "").trim();
    if (!title || !re.test(title)) continue;
    rows.push({
      title,
      url: String(row.url ?? "/"),
      source: String(row.source ?? "ConspiracyHub feed"),
      pubDate: row.published_at ? new Date(row.published_at).toUTCString() : "",
    });
  }
  return sortByPubDateDesc(rows).slice(0, OUTBREAK_LOCAL_NEWS_MAX);
}

async function fetchLocalNews(
  disease: string,
  country: string,
): Promise<Array<{ title: string; url: string; source: string; pubDate: string }>> {
  try {
    const query = encodeURIComponent(`${disease} ${country}`);
    const url = `https://news.google.com/rss/search?q=${query}&hl=en-US&gl=US&ceid=US:en&num=${OUTBREAK_LOCAL_NEWS_MAX}`;
    const res = await fetch(url, {
      headers: { "User-Agent": "TheTheorist/1.0" },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return [];
    const xml = await res.text();
    const items: Array<{ title: string; url: string; source: string; pubDate: string }> = [];
    for (const m of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
      const x = m[1];
      const title = x.match(/<title>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/title>/)?.[1]?.trim() ?? "";
      const link = x.match(/<link>(.*?)<\/link>/)?.[1]?.trim() ?? "";
      const pub = x.match(/<pubDate>(.*?)<\/pubDate>/)?.[1]?.trim() ?? "";
      const source = x.match(/<source[^>]*>(.*?)<\/source>/)?.[1]?.trim() ?? "";
      if (title && link) items.push({ title, url: link, source, pubDate: pub });
    }
    return sortByPubDateDesc(items).slice(0, OUTBREAK_LOCAL_NEWS_MAX);
  } catch {
    return [];
  }
}

const SYS = `You are a disease outbreak intelligence analyst. Analyze the outbreak for conspiracy relevance, patents, and geopolitical context.
LANGUAGE: All JSON string values MUST be English only.

Return ONLY valid JSON:
{
  "disease":"short disease name (1-3 words)",
  "location":"primary affected country (lowercase, single country or 'multiple countries')",
  "affected_countries":["country1","country2"],
  "lat":0.0,"lng":0.0,
  "conspiracy_score":0,
  "has_conspiracy":false,
  "theories":[{"name":"","summary":"2-3 sentences","probability":20,"sources":["https://"]}],
  "patents":[{"number":"US...","title":"","assignee":"","url":"https://patents.google.com/patent/..."}],
  "key_facts":["fact1","fact2","fact3"],
  "verdict":"NATURAL",
  "risk_level":"MEDIUM",
  "origin_country":"lowercase country name where outbreak originated"
}
affected_countries: array of ALL countries currently affected (lowercase). If global or regional spread, list up to 8 specific countries.
verdict: NATURAL|SUSPICIOUS|HIGHLY_SUSPICIOUS|UNKNOWN
risk_level: LOW|MEDIUM|HIGH|CRITICAL
Only cite real patent numbers and real URLs. conspiracy_score based on documented theories only.`;

type AnalysisRow = {
  disease: string;
  location: string;
  affected_countries?: string[];
  lat: number;
  lng: number;
  conspiracy_score: number;
  has_conspiracy: boolean;
  theories: Array<{ name: string; summary: string; probability: number; sources: string[] }>;
  patents: Array<{ number: string; title: string; assignee: string; url: string }>;
  key_facts: string[];
  verdict: string;
  risk_level: string;
  origin_country: string;
};

async function fetchOutbreakCandidates(admin: SupabaseClient): Promise<CuratedItem[]> {
  const [feed, rss] = await Promise.all([
    fetchFeedOutbreakCandidates(admin),
    fetchOutbreakRss().catch(() => [] as CuratedItem[]),
  ]);
  const merged = mergeOutbreakCandidates(feed, rss, CURATED_DISEASES);
  return merged.length > 0 ? merged : CURATED_DISEASES;
}

export function buildOutbreakPreviewPayload() {
  const ebola =
    CURATED_DISEASES.find((c) => /ebola/i.test(c.title)) ?? CURATED_DISEASES[CURATED_DISEASES.length - 1]!;
  const h5n1 = CURATED_DISEASES.find((c) => /h5n1|avian/i.test(c.title)) ?? CURATED_DISEASES[1]!;
  const rows = [ebola, h5n1].map((item, i) => {
    const diseaseGuess = item.title.split(/[—\-–]/)[0]?.trim() ?? "Pathogen signal";
    const isEbola = /ebola/i.test(item.title);
    const latLng = isEbola ? COORDS.drc! : COORDS.brazil!;
    return {
      id: `preview-${i}-${Date.now()}`,
      title: item.title,
      description: item.description,
      source_url: item.link,
      published_at: item.pubDate,
      disease: diseaseGuess,
      location: isEbola ? "drc" : "brazil",
      origin_country: isEbola ? "drc" : "brazil",
      affected_countries: isEbola ? ["drc", "congo"] : ["brazil"],
      lat: latLng[0],
      lng: latLng[1],
      affectedCoords: isEbola
        ? [
            { country: "drc", lat: COORDS.drc![0], lng: COORDS.drc![1] },
            { country: "congo", lat: COORDS.congo![0], lng: COORDS.congo![1] },
          ]
        : [{ country: "brazil", lat: latLng[0], lng: latLng[1] }],
      conspiracy_score: 12,
      has_conspiracy: false,
      theories: [
        {
          name: "Preview mode",
          summary:
            "Static WHO-style watchlist entry only — no live AI enrichment in this preview. Reload for the full pipeline when the server responds in time.",
          probability: 10,
          sources: [item.link],
        },
      ],
      patents: [] as Array<{ number: string; title: string; assignee: string; url: string }>,
      key_facts: [
        "Preview: two sample signals from our curated disease watchlist.",
        "Full tracker adds Google News, USPTO cross-scan, and GPT analysis when available.",
      ],
      verdict: "UNKNOWN",
      risk_level: "MEDIUM",
      localNews: [] as Array<{ title: string; url: string; source: string; pubDate: string }>,
    };
  });
  return { outbreaks: rows, generated_at: new Date().toISOString(), preview: true as const };
}

export type OutbreakPayload = {
  outbreaks: unknown[];
  generated_at: string;
  cache_version?: number;
  cached?: boolean;
  preview?: boolean;
};

export async function runOutbreakRefresh(options?: { skipCache?: boolean }): Promise<{
  ok: boolean;
  status: number;
  payload: OutbreakPayload | { error: string };
}> {
  const skipCache = options?.skipCache ?? false;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) {
    return { ok: false, status: 500, payload: { error: "server_misconfigured" } };
  }
  if (!process.env.OPENAI_API_KEY) {
    return { ok: false, status: 500, payload: { error: "openai_missing" } };
  }

  const admin = createClient(url, key);

  if (!skipCache) {
    try {
      const { data: c } = await admin
        .from("outbreak_cache")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (c && Date.now() - new Date(c.created_at).getTime() < OUTBREAK_CACHE_TTL_MS) {
        const data = c.data as OutbreakPayload;
        if ((data.cache_version ?? 1) >= OUTBREAK_CACHE_VERSION) {
          return { ok: true, status: 200, payload: { ...data, cached: true } };
        }
      }
    } catch {
      /* table may not exist until migration */
    }
  }

  try {
    const items = await fetchOutbreakCandidates(admin);
    const apiKey = process.env.OPENAI_API_KEY!;

    const settled = await Promise.allSettled(
      items.slice(0, OUTBREAK_ANALYZE_MAX).map(async (item) => {
        const analysis = await callOpenAIJSON<AnalysisRow>({
          apiKey,
          system: SYS,
          user: `"${item.title}"\n\n${item.description}\n\nSource: ${item.link}`,
          maxTokens: 900,
          model: "gpt-4o-mini",
          maxAttempts: 2,
        });
        const country = analysis.origin_country || analysis.location;
        const [googleNews, feedNews] = await Promise.all([
          fetchLocalNews(analysis.disease, country),
          fetchFeedLocalNews(admin, analysis.disease),
        ]);
        const seenUrls = new Set<string>();
        const localNews: LocalNewsRow[] = [];
        for (const row of [...feedNews, ...googleNews]) {
          if (seenUrls.has(row.url)) continue;
          seenUrls.add(row.url);
          localNews.push(row);
          if (localNews.length >= OUTBREAK_LOCAL_NEWS_MAX) break;
        }
        return { ...analysis, localNews, rawItem: item };
      }),
    );

    const outbreaks = settled
      .map((r, i) => {
        if (r.status === "rejected") return null;
        const { rawItem, ...rest } = r.value;
        const loc = rest.location?.toLowerCase() ?? "";
        const origin = rest.origin_country?.toLowerCase() ?? "";
        const ck = Object.keys(COORDS).find((k) => loc.includes(k) || origin.includes(k));
        const [lat, lng] = ck ? COORDS[ck]! : [rest.lat ?? 0, rest.lng ?? 0];

        const affectedCoords = (rest.affected_countries ?? [])
          .map((country: string) => {
            const key = Object.keys(COORDS).find((k) => country.toLowerCase().includes(k));
            if (!key) return null;
            const coords = COORDS[key]!;
            return { country, lat: coords[0], lng: coords[1] };
          })
          .filter((ac): ac is { country: string; lat: number; lng: number } => ac !== null);

        return {
          id: `ob-${i}-${Date.now()}`,
          title: rawItem.title,
          description: rawItem.description,
          source_url: rawItem.link,
          published_at: rawItem.pubDate,
          ...rest,
          lat,
          lng,
          affectedCoords,
        };
      })
      .filter((row): row is NonNullable<typeof row> => row != null);

    const outbreaksSorted = sortByPublishedAtDesc(outbreaks);

    const payload: OutbreakPayload = {
      outbreaks: outbreaksSorted,
      generated_at: new Date().toISOString(),
      cache_version: OUTBREAK_CACHE_VERSION,
      cached: false,
    };

    try {
      await admin.from("outbreak_cache").insert({ data: payload });
    } catch {
      /* ignore cache insert failure */
    }

    return { ok: true, status: 200, payload };
  } catch (e) {
    return {
      ok: false,
      status: 500,
      payload: { error: e instanceof Error ? e.message : String(e) },
    };
  }
}
