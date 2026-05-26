import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { callOpenAIJSON } from "@/lib/openai";
import { cleanOutbreakBlurb, plainTextFromHtml } from "@/lib/plainText";
import { sortByPubDateDesc, sortByPublishedAtDesc } from "@/lib/sortByPubDate";

export const OUTBREAK_CACHE_TTL_MS = 3_600_000;
/** Bump when pipeline changes so stale JSON blobs are ignored. */
export const OUTBREAK_CACHE_VERSION = 12;
const OUTBREAK_LOCAL_NEWS_MAX = 40;
const OUTBREAK_LOCAL_NEWS_PER_COUNTRY = 8;
const OUTBREAK_LOCAL_NEWS_COUNTRY_MAX = 6;
const OUTBREAK_FEED_NEWS_MAX = 12;
/** Max fresh (non-curated) RSS/feed candidates to GPT-analyse per run. */
const OUTBREAK_FRESH_MAX = 5;
const FEED_OUTBREAK_LOOKBACK_DAYS = 21;

/**
 * RSS sources — ordered by timeliness:
 *  1. ProMED-mail: gold standard early-warning, often days before WHO
 *  2. WHO Africa: Ebola / Marburg / Mpox ground zero
 *  3. ECDC: European Centre for Disease Prevention (EN)
 *  4. CDC health updates
 */
const OUTBREAK_RSS_FEEDS = [
  "https://promedmail.org/feed/",
  "https://www.afro.who.int/rss/emergencies.xml",
  "https://www.ecdc.europa.eu/en/rss.xml",
  "https://tools.cdc.gov/api/v2/resources/media/316422.rss",
];

const OUTBREAK_KEYWORD_RE =
  /\b(outbreak|epidemic|pandemic|ebola|mpox|cholera|plague|dengue|marburg|hantavirus|hanta|polio|measles|pathogen|bioweapon|lassa|nipah|zika|coronavirus|covid|mers|sudan virus|bird flu|avian influenza|h5n1)\b|disease outbreak|virus outbreak|infectious disease|case[s]? (?:of|reported|confirmed|rise|surge)|outbreak of/i;

/** Explicit epidemiology phrasing required for feed items without a known pathogen. */
const OUTBREAK_STRONG_RE =
  /outbreak|epidemic|pandemic|cases reported|case[s]? (?:rise|surge|spike|confirmed)|cluster of|who declares|public health emergency|disease outbreak|confirmed cases|human-to-human|transmission|quarantine|isolation ward|vaccination campaign|contact tracing/i;

/** Non-health stories that often false-trigger generic keywords. */
const OUTBREAK_NEGATIVE_RE =
  /influencer|hedge fund|film festival|cannes|\bf1\b|formula one|formula 1|election|philanthropist|open society|criminal court|press conference|retired from|zapatero|soros|stock market|earnings report|nba|nfl|premier league|rugby player|motorsport|box office|congress hearing|indicted for|pleaded guilty|motor neurone disease|als diagnosis.*retir/i;

const INVALID_DISEASE_RE =
  /^(unknown|n\/a|na|not applicable|none|unspecified|general|other|various|illness|sickness|pathogen signal|disease)$/i;

export const DISEASE_SIGNATURES = [
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
  "diphtheria",
  "monkeypox",
  "rift valley",
  "crimean-congo",
] as const;

const COORDS: Record<string, [number, number]> = {
  // Africa
  drc: [-4.03, 21.75],
  congo: [-4.03, 21.75],
  nigeria: [9.08, 8.67],
  kenya: [-0.02, 37.9],
  ethiopia: [9.14, 40.48],
  egypt: [26.82, 30.8],
  "south africa": [-30.55, 22.93],
  sudan: [12.86, 30.21],
  somalia: [5.15, 46.19],
  chad: [15.45, 18.73],
  guinea: [11.8, -15.18],
  "sierra leone": [8.46, -11.78],
  liberia: [6.43, -9.43],
  ghana: [7.95, -1.02],
  tanzania: [-6.36, 34.89],
  rwanda: [-1.94, 29.87],
  uganda: [1.37, 32.29],
  madagascar: [-18.77, 46.87],
  burundi: [-3.37, 29.92],
  zambia: [-13.13, 27.85],
  mozambique: [-18.67, 35.53],
  angola: [-11.2, 17.87],
  cameroon: [3.86, 11.52],
  // Asia
  china: [35.86, 104.19],
  india: [20.59, 78.96],
  pakistan: [30.37, 69.34],
  indonesia: [-0.78, 113.92],
  philippines: [12.87, 121.77],
  cambodia: [12.56, 104.99],
  myanmar: [21.91, 95.95],
  bangladesh: [23.68, 90.35],
  vietnam: [14.05, 108.28],
  thailand: [15.87, 100.99],
  japan: [36.2, 138.25],
  "south korea": [35.91, 127.77],
  singapore: [1.35, 103.82],
  iran: [32.42, 53.68],
  // Europe
  ukraine: [48.37, 31.16],
  russia: [61.52, 105.31],
  "united kingdom": [55.38, -3.44],
  netherlands: [52.13, 5.29],
  germany: [51.16, 10.45],
  france: [46.23, 2.21],
  spain: [40.46, -3.74],
  switzerland: [46.82, 8.23],
  turkey: [38.96, 35.24],
  portugal: [39.4, -8.22],
  italy: [41.87, 12.57],
  sweden: [60.13, 18.64],
  norway: [60.47, 8.47],
  denmark: [56.26, 9.5],
  finland: [61.92, 25.75],
  belgium: [50.5, 4.47],
  austria: [47.52, 14.55],
  poland: [51.92, 19.14],
  greece: [39.07, 21.82],
  romania: [45.94, 24.97],
  "czech republic": [49.82, 15.47],
  slovakia: [48.67, 19.7],
  hungary: [47.16, 19.5],
  // Americas
  "united states": [37.09, -95.71],
  usa: [37.09, -95.71],
  canada: [56.13, -106.35],
  brazil: [-14.23, -51.92],
  colombia: [4.57, -74.29],
  peru: [-9.19, -75.01],
  mexico: [23.63, -102.55],
  argentina: [-38.41, -63.61],
  chile: [-35.67, -71.54],
  bolivia: [-16.29, -63.58],
  venezuela: [6.42, -66.58],
  ecuador: [-1.83, -78.18],
  panama: [8.53, -80.78],
  "costa rica": [9.74, -83.75],
  nicaragua: [12.86, -85.2],
  kazakhstan: [48.01, 66.92],
  // Oceania / other
  australia: [-25.27, 133.78],
  "new zealand": [-40.9, 174.89],
  global: [20, 0],
};

type OutbreakStatsRow = {
  confirmed_cases: number | null;
  deaths: number | null;
  case_fatality_rate: string | null;
  as_of?: string;
};

type CuratedItem = {
  id: string;          // stable dedup key
  title: string;
  description: string;
  link: string;
  pubDate: string;
  disease: string;     // pre-known disease name (skip GPT rejection)
  location: string;
  origin_country: string;
  affected_countries: string[];
  lat: number;
  lng: number;
  risk_level: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  stats: OutbreakStatsRow;
};

type FreshItem = { title: string; description: string; link: string; pubDate: string };
type LocalNewsAlert = "death_update" | "case_surge";
type LocalNewsRow = {
  title: string;
  url: string;
  source: string;
  pubDate: string;
  country?: string;
  alert?: LocalNewsAlert | null;
};

const DEATH_NEWS_RE =
  /\b(death|deaths|dead|died|dies|dying|fatal|fatality|fatalities|killed|killings|mortality|mortuaries|body count|lethal)\b/i;
const CASE_SURGE_NEWS_RE =
  /\b(cases\s+(rise|surge|spike|soar|jump|climb)|confirmed cases|new cases|case count|infections rise|outbreak grows|patients rise)\b/i;

function classifyNewsAlert(title: string): LocalNewsAlert | null {
  if (DEATH_NEWS_RE.test(title)) return "death_update";
  if (CASE_SURGE_NEWS_RE.test(title)) return "case_surge";
  return null;
}

function tagLocalNewsRow(row: Omit<LocalNewsRow, "alert">): LocalNewsRow {
  return { ...row, alert: classifyNewsAlert(row.title) };
}

function statsHasValues(stats?: OutbreakStatsRow | null): boolean {
  if (!stats) return false;
  return stats.confirmed_cases != null || stats.deaths != null || stats.case_fatality_rate != null;
}

/**
 * Permanently-tracked WHO/CDC-level disease watchlist.
 * These are always shown regardless of feed availability.
 */
const CURATED_DISEASES: CuratedItem[] = [
  {
    id: "ebola",
    title: "Ebola — Bundibugyo Virus · DRC & Uganda · PHEIC",
    description:
      "WHO declared a Public Health Emergency of International Concern on 16 May 2026 for a Bundibugyo ebolavirus outbreak in DRC and Uganda. DRC reports 906 suspected cases, 105 confirmed, and 223 suspected deaths. No approved vaccine or treatment for this strain. Transmission concentrated in Ituri, Nord-Kivu, and Sud-Kivu provinces amid active conflict. A confirmed case was evacuated to Germany for treatment.",
    link: "https://www.who.int/emergencies/disease-outbreak-news/item/2026-DON603",
    pubDate: "2026-05-15",
    disease: "Ebola",
    location: "drc",
    origin_country: "drc",
    affected_countries: ["drc", "uganda", "germany"],
    lat: COORDS.drc![0],
    lng: COORDS.drc![1],
    risk_level: "CRITICAL",
    stats: {
      confirmed_cases: 112,
      deaths: 11,
      case_fatality_rate: "25–50%",
      as_of: "WHO/CDC · 25 May 2026 · PHEIC declared",
    },
  },
  {
    id: "h5n1",
    title: "H5N1 Avian Influenza — Global Human Cases",
    description:
      "H5N1 bird flu has infected 997 people globally since 2003, with 478 deaths (CFR 47.9%). In 2026, 5 new human cases and 2 deaths confirmed globally. Ongoing spillover to dairy farm workers in the US (71 A(H5) cases since Feb 2024). Recent cases in Cambodia, Bangladesh, and Mexico. WHO monitoring closely for any sign of sustained human-to-human transmission.",
    link: "https://www.who.int/news-room/fact-sheets/detail/influenza-(avian-and-other-zoonotic)",
    pubDate: "",
    disease: "H5N1 avian influenza",
    location: "united states",
    origin_country: "united states",
    affected_countries: ["united states", "cambodia", "bangladesh", "mexico", "china", "india", "vietnam"],
    lat: COORDS["united states"]![0],
    lng: COORDS["united states"]![1],
    risk_level: "HIGH",
    stats: {
      confirmed_cases: 997,
      deaths: 478,
      case_fatality_rate: "47.9%",
      as_of: "WHO · cumulative 2003–Mar 2026 · 5 new cases in 2026",
    },
  },
  {
    id: "mpox",
    title: "Mpox — Clade Ib · Africa & International Spread",
    description:
      "Mpox clade Ib remains a WHO PHEIC. Africa leads with 1,235 confirmed cases in March 2026. Madagascar (656 cases/6 wks) and DRC drive African spread. Pakistan reported a hospital cluster with 29 confirmed cases and 8 deaths among neonates. Community transmission of clade Ib confirmed in Colombia, Denmark, Ecuador, Portugal, Singapore, Spain, and the United Kingdom.",
    link: "https://www.who.int/news-room/fact-sheets/detail/monkeypox",
    pubDate: "2026-04-30",
    disease: "Mpox",
    location: "drc",
    origin_country: "drc",
    affected_countries: ["drc", "madagascar", "uganda", "burundi", "kenya", "nigeria", "pakistan", "colombia", "spain", "united kingdom", "singapore", "denmark"],
    lat: COORDS.drc![0],
    lng: COORDS.drc![1],
    risk_level: "HIGH",
    stats: {
      confirmed_cases: 44_542,
      deaths: 198,
      case_fatality_rate: "0.4%",
      as_of: "WHO Sitrep #65 · 30 Apr 2026 · 48-country spread",
    },
  },
  {
    id: "marburg",
    title: "Marburg Virus — Watchlist · Ethiopia Outbreak Ended",
    description:
      "The 2025–2026 Ethiopia Marburg outbreak (14 confirmed cases, 9 deaths) was declared over on 26 January 2026. No active outbreak as of May 2026. WHO maintains heightened vigilance given repeated spillovers from fruit bat reservoirs across East Africa. Previous outbreaks: Tanzania (Mar 2025), Rwanda (Dec 2024). Next spillover risk remains elevated.",
    link: "https://www.who.int/emergencies/disease-outbreak-news/item/2026-DON592",
    pubDate: "2026-01-26",
    disease: "Marburg virus",
    location: "ethiopia",
    origin_country: "ethiopia",
    affected_countries: ["ethiopia", "tanzania", "kenya", "rwanda", "uganda"],
    lat: COORDS.ethiopia![0],
    lng: COORDS.ethiopia![1],
    risk_level: "MEDIUM",
    stats: {
      confirmed_cases: 14,
      deaths: 9,
      case_fatality_rate: "64%",
      as_of: "WHO · Ethiopia outbreak ended 26 Jan 2026",
    },
  },
  {
    id: "dengue",
    title: "Dengue Fever — Record Global Transmission",
    description:
      "Record-breaking dengue transmission continues globally. Brazil exceeded 7 million cases in 2024; trend continues in 2025–2026. Aedes aegypti range expanding due to climate change across Americas, Southeast Asia, and now Southern Europe. Severe dengue mortality rising. Over 100 countries affected.",
    link: "https://www.who.int/news-room/fact-sheets/detail/dengue-and-severe-dengue",
    pubDate: "",
    disease: "Dengue fever",
    location: "brazil",
    origin_country: "brazil",
    affected_countries: ["brazil", "colombia", "peru", "ecuador", "india", "indonesia", "philippines", "vietnam", "thailand", "bangladesh"],
    lat: COORDS.brazil![0],
    lng: COORDS.brazil![1],
    risk_level: "MEDIUM",
    stats: {
      confirmed_cases: 7_500_000,
      deaths: 6_200,
      case_fatality_rate: "0.08%",
      as_of: "WHO · global dengue 2024–2026",
    },
  },
  {
    id: "cholera",
    title: "Cholera — Sub-Saharan Africa & Middle East",
    description:
      "Cholera 7th pandemic continues across Africa and the Middle East. WHO reported 700,000+ cases in 44 countries in 2024, with ongoing spread in 2025–2026. Sub-Saharan Africa, the Horn of Africa, and conflict zones remain most affected. Vaccine shortages and displacement crises driving sustained transmission.",
    link: "https://www.who.int/news-room/fact-sheets/detail/cholera",
    pubDate: "",
    disease: "Cholera",
    location: "nigeria",
    origin_country: "nigeria",
    affected_countries: ["nigeria", "somalia", "ethiopia", "drc", "sudan", "kenya", "mozambique", "zambia", "cameroon"],
    lat: COORDS.nigeria![0],
    lng: COORDS.nigeria![1],
    risk_level: "MEDIUM",
    stats: {
      confirmed_cases: 700_000,
      deaths: 4_000,
      case_fatality_rate: "0.6%",
      as_of: "WHO · 44-country cholera wave 2024–25",
    },
  },
  {
    id: "hantavirus",
    title: "Andes Hantavirus — MV Hondius · International Outbreak",
    description:
      "Active international Andes hantavirus outbreak linked to the Dutch cruise ship MV Hondius (departed Ushuaia, Argentina, 1 April 2026). As of 26 May 2026: 13 cases (11 confirmed + 2 probable), 3 deaths. Cases confirmed in Canada (BC), Netherlands, Germany, France, Spain, USA, Switzerland, UK, and Australia. Unlike other hantaviruses, Andes virus is capable of person-to-person transmission. Canadian health authorities confirmed Canada's first-ever Andes hantavirus case on 16 May 2026.",
    link: "https://www.ecdc.europa.eu/en/infectious-disease-topics/hantavirus-infection/surveillance-and-updates/andes-hantavirus-outbreak",
    pubDate: "2026-05-02",
    disease: "Hantavirus",
    location: "argentina",
    origin_country: "argentina",
    affected_countries: ["argentina", "canada", "netherlands", "germany", "france", "spain", "united states", "switzerland", "united kingdom", "australia"],
    lat: COORDS.argentina![0],
    lng: COORDS.argentina![1],
    risk_level: "HIGH",
    stats: {
      confirmed_cases: 13,
      deaths: 3,
      case_fatality_rate: "23%",
      as_of: "ECDC/PHAC · 26 May 2026 · MV Hondius outbreak",
    },
  },
];

function stripHtml(s: string): string {
  return plainTextFromHtml(s);
}

type OutbreakRow = Record<string, unknown>;

function resolveCountryCoords(country: string): [number, number] | null {
  const c = country.toLowerCase().trim();
  if (!c) return null;
  let bestKey: string | null = null;
  for (const k of Object.keys(COORDS)) {
    if (c.includes(k) && (!bestKey || k.length > bestKey.length)) {
      bestKey = k;
    }
  }
  return bestKey ? COORDS[bestKey]! : null;
}

function mergeAffectedCountries(row: {
  disease?: unknown;
  origin_country?: unknown;
  location?: unknown;
  affected_countries?: unknown;
}): string[] {
  const origin = String(row.origin_country ?? row.location ?? "")
    .toLowerCase()
    .trim();
  const location = String(row.location ?? "")
    .toLowerCase()
    .trim();
  const fromRow = Array.isArray(row.affected_countries)
    ? row.affected_countries.map((c) => String(c).toLowerCase().trim())
    : [];
  const token = diseaseSearchToken(String(row.disease ?? ""));
  const curated = CURATED_DISEASES.find((c) => diseaseSearchToken(c.disease) === token);
  return [...new Set([origin, location, ...fromRow, ...(curated?.affected_countries ?? [])].filter(Boolean))];
}

function buildAffectedCoords(countries: string[]): Array<{ country: string; lat: number; lng: number }> {
  const seen = new Set<string>();
  const out: Array<{ country: string; lat: number; lng: number }> = [];
  for (const country of countries) {
    const coords = resolveCountryCoords(country);
    if (!coords) continue;
    const key = `${coords[0].toFixed(2)},${coords[1].toFixed(2)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ country, lat: coords[0], lng: coords[1] });
  }
  return out;
}

function ensureOutbreakGeo(row: OutbreakRow): OutbreakRow {
  const affected_countries = mergeAffectedCountries(row);
  const origin = String(row.origin_country ?? row.location ?? "")
    .toLowerCase()
    .trim();

  let lat = Number(row.lat);
  let lng = Number(row.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || (lat === 0 && lng === 0)) {
    const oc = resolveCountryCoords(origin);
    if (oc) {
      lat = oc[0];
      lng = oc[1];
    }
  }

  return {
    ...row,
    origin_country: origin || row.origin_country,
    affected_countries,
    lat,
    lng,
    affectedCoords: buildAffectedCoords(affected_countries),
  };
}

function sanitizeOutbreakRow(row: OutbreakRow): OutbreakRow {
  const keyFacts = Array.isArray(row.key_facts)
    ? row.key_facts.map((f) => cleanOutbreakBlurb(String(f))).filter(Boolean)
    : [];
  const description =
    cleanOutbreakBlurb(String(row.description ?? "")) ||
    (keyFacts.length ? String(keyFacts[0]) : "") ||
    cleanOutbreakBlurb(String(row.title ?? ""));
  return scrubConspiracyIntel(
    ensureOutbreakGeo({
      ...row,
      description: description.slice(0, 300),
      key_facts: keyFacts,
    }),
  );
}

type TheoryRow = { name: string; summary: string; probability: number; sources: string[] };
type PatentRow = { number: string; title: string; assignee: string; url: string };

const BLOCKED_SOURCE_HOST =
  /^(example\.(com|org|net|edu)|localhost|127\.0\.0\.1|0\.0\.0\.0|placeholder|test|fake|sample|domain\.(com|org))$/i;

function isVerifiableSourceUrl(url: string): boolean {
  try {
    const trimmed = url.trim();
    if (!trimmed || trimmed === "https://" || trimmed === "http://") return false;
    const u = new URL(trimmed);
    if (u.protocol !== "http:" && u.protocol !== "https:") return false;
    const host = u.hostname.toLowerCase().replace(/^www\./, "");
    if (!host.includes(".") || host.length < 4) return false;
    if (BLOCKED_SOURCE_HOST.test(host)) return false;
    if (/example/i.test(host)) return false;
    return true;
  } catch {
    return false;
  }
}

function sanitizeTheoryRow(raw: {
  name?: unknown;
  summary?: unknown;
  probability?: unknown;
  sources?: unknown;
}): TheoryRow | null {
  const sources = (Array.isArray(raw.sources) ? raw.sources : [])
    .map((s) => String(s).trim())
    .filter(isVerifiableSourceUrl);
  if (sources.length === 0) return null;
  const name = String(raw.name ?? "").trim();
  const summary = cleanOutbreakBlurb(String(raw.summary ?? ""));
  if (!name || !summary) return null;
  return {
    name,
    summary,
    probability: Math.min(100, Math.max(0, Number(raw.probability ?? 0) || 0)),
    sources,
  };
}

function sanitizePatentRow(raw: {
  number?: unknown;
  title?: unknown;
  assignee?: unknown;
  url?: unknown;
}): PatentRow | null {
  const number = String(raw.number ?? "").trim();
  const title = String(raw.title ?? "").trim();
  if (!number || !title || number.length < 4) return null;
  let url = String(raw.url ?? "").trim();
  if (!isVerifiableSourceUrl(url)) {
    const normalized = number.replace(/[^A-Z0-9]/gi, "");
    if (/^US\d+/i.test(normalized)) {
      url = `https://patents.google.com/patent/${normalized}`;
    } else {
      return null;
    }
  }
  if (!url.includes("patents.google.com") && !isVerifiableSourceUrl(url)) return null;
  return {
    number,
    title,
    assignee: String(raw.assignee ?? "").trim(),
    url,
  };
}

/** Drop GPT-hallucinated theories/patents; conspiracy flags only when verifiable sources remain. */
function scrubConspiracyIntel(row: OutbreakRow): OutbreakRow {
  const theories = (Array.isArray(row.theories) ? row.theories : [])
    .map((t) => sanitizeTheoryRow(t as TheoryRow))
    .filter((t): t is TheoryRow => t != null);

  const patents = (Array.isArray(row.patents) ? row.patents : [])
    .map((p) => sanitizePatentRow(p as PatentRow))
    .filter((p): p is PatentRow => p != null);

  const has_conspiracy = theories.length > 0;
  const conspiracy_score = has_conspiracy
    ? Math.min(100, Math.max(0, Number(row.conspiracy_score ?? 0) || 0))
    : 0;

  return {
    ...row,
    theories,
    patents,
    has_conspiracy,
    conspiracy_score,
  };
}

function sanitizeOutbreakPayload(data: OutbreakPayload): OutbreakPayload {
  if (!Array.isArray(data.outbreaks)) return data;
  return {
    ...data,
    outbreaks: data.outbreaks.map((row) => sanitizeOutbreakRow(row as OutbreakRow)),
  };
}

const RISK_ORDER: Record<string, number> = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };

/**
 * Collapse duplicate disease entries into one canonical row.
 * Fresh GPT rows (richer data) take precedence; curated baseline fills in gaps.
 */
function mergeOutbreaksByDisease(outbreaks: OutbreakRow[]): OutbreakRow[] {
  const byToken = new Map<string, OutbreakRow[]>();

  for (const o of outbreaks) {
    const token =
      diseaseSearchToken(String(o.disease ?? "")) ??
      String(o.disease ?? "").toLowerCase().replace(/\s+/g, "_").slice(0, 14);
    if (!token) continue;
    const arr = byToken.get(token) ?? [];
    arr.push(o);
    byToken.set(token, arr);
  }

  const merged: OutbreakRow[] = [];
  for (const [, group] of byToken) {
    if (group.length === 1) {
      merged.push(group[0]);
      continue;
    }

    // Fresh (GPT-analysed) rows beat curated-only stubs
    const fresh = group.filter((o) => String(o.id ?? "").startsWith("ob-fresh"));
    const base = fresh.length > 0 ? fresh[0] : group[0];

    // Union of all affected countries
    const allCountries = [
      ...new Set(
        group.flatMap((o) =>
          Array.isArray(o.affected_countries)
            ? (o.affected_countries as string[])
            : [],
        ),
      ),
    ];

    // Best risk_level
    const bestRisk = group.reduce<string>((best, o) => {
      const level = String(o.risk_level ?? "LOW");
      return (RISK_ORDER[level] ?? 0) > (RISK_ORDER[best] ?? 0) ? level : best;
    }, "LOW");

    // Highest conspiracy_score
    const bestScore = Math.max(...group.map((o) => Number(o.conspiracy_score ?? 0)));

    // Merge theories dedup by name — only keep rows with verifiable source URLs
    const seenTheories = new Set<string>();
    const allTheories: TheoryRow[] = [];
    for (const o of group) {
      for (const t of Array.isArray(o.theories) ? o.theories : []) {
        const clean = sanitizeTheoryRow(t as TheoryRow);
        if (!clean) continue;
        const k = clean.name.toLowerCase().slice(0, 40);
        if (seenTheories.has(k)) continue;
        seenTheories.add(k);
        allTheories.push(clean);
      }
    }

    // Merge patents dedup by number
    const seenPatents = new Set<string>();
    const allPatents: PatentRow[] = [];
    for (const o of group) {
      for (const p of Array.isArray(o.patents) ? o.patents : []) {
        const clean = sanitizePatentRow(p as PatentRow);
        if (!clean) continue;
        const k = clean.number.toLowerCase().slice(0, 20);
        if (seenPatents.has(k)) continue;
        seenPatents.add(k);
        allPatents.push(clean);
      }
    }

    // Most recent published_at
    const dates = group.map((o) => String(o.published_at ?? "")).filter(Boolean);
    const latestDate = [...dates].sort().reverse()[0] ?? "";

    merged.push({
      ...base,
      affected_countries: allCountries,
      affectedCoords: buildAffectedCoords(allCountries),
      localNews: [] as LocalNewsRow[],
      risk_level: bestRisk,
      conspiracy_score: allTheories.length > 0 ? bestScore : 0,
      has_conspiracy: allTheories.length > 0,
      theories: allTheories,
      patents: allPatents,
      published_at: latestDate || base.published_at,
      merged_count: group.length,
      stats: mergeOutbreakStats(group),
    });
  }

  return merged;
}

function hasKnownDiseaseSignature(text: string): boolean {
  const t = text.toLowerCase();
  return DISEASE_SIGNATURES.some((d) => t.includes(d));
}

function isOutbreakExcluded(text: string): boolean {
  return OUTBREAK_NEGATIVE_RE.test(text);
}

/** Feed/RSS: known pathogen OR explicit outbreak phrasing; never politics/sports/finance. */
function isStrictOutbreakCandidate(title: string, description = ""): boolean {
  const blob = `${title} ${description}`.trim();
  if (!blob || isOutbreakExcluded(blob)) return false;
  if (hasKnownDiseaseSignature(blob)) return true;
  if (!OUTBREAK_KEYWORD_RE.test(blob)) return false;
  return OUTBREAK_STRONG_RE.test(blob);
}

function isValidDiseaseName(disease: string): boolean {
  const d = disease.trim().toLowerCase();
  if (!d || d.length < 3 || INVALID_DISEASE_RE.test(d)) return false;
  if (isOutbreakExcluded(d)) return false;
  if (hasKnownDiseaseSignature(d)) return true;
  return d.split(/\s+/).length >= 2 && OUTBREAK_KEYWORD_RE.test(d);
}

function diseaseSearchToken(disease: string): string | null {
  const t = disease.toLowerCase();
  for (const sig of DISEASE_SIGNATURES) {
    if (t.includes(sig)) return sig;
  }
  const word = disease.split(/\s+/).find((w) => w.length >= 5);
  if (!word || INVALID_DISEASE_RE.test(word)) return null;
  return word.toLowerCase();
}

function resolveOutbreakStats(
  analysisStats: OutbreakStatsRow | undefined,
  disease: string,
): OutbreakStatsRow {
  if (statsHasValues(analysisStats)) {
    return {
      confirmed_cases: analysisStats!.confirmed_cases ?? null,
      deaths: analysisStats!.deaths ?? null,
      case_fatality_rate: analysisStats!.case_fatality_rate ?? null,
    };
  }
  const token = diseaseSearchToken(disease);
  const curated = CURATED_DISEASES.find((c) => diseaseSearchToken(c.disease) === token);
  return curated?.stats ?? { confirmed_cases: null, deaths: null, case_fatality_rate: null };
}

function mergeOutbreakStats(group: OutbreakRow[]): OutbreakStatsRow | undefined {
  const withStats = group
    .map((o, i) => ({ stats: o.stats as OutbreakStatsRow | undefined, id: String(o.id ?? ""), i }))
    .filter((entry) => statsHasValues(entry.stats));
  if (!withStats.length) return undefined;
  const fresh = withStats.find((entry) => entry.id.startsWith("ob-fresh"));
  if (fresh?.stats) return fresh.stats;
  return withStats.reduce<OutbreakStatsRow>(
    (best, entry) => ({
      confirmed_cases: entry.stats!.confirmed_cases ?? best.confirmed_cases,
      deaths: entry.stats!.deaths ?? best.deaths,
      case_fatality_rate: entry.stats!.case_fatality_rate ?? best.case_fatality_rate,
      as_of: entry.stats!.as_of ?? best.as_of,
    }),
    { confirmed_cases: null, deaths: null, case_fatality_rate: null },
  );
}

function isWeakRssTitle(title: string): boolean {
  const t = title.toLowerCase();
  return (
    t === "weekly bulletin" ||
    t.startsWith("weekly bulletin ") ||
    /^\d+\s*(new)?\s*case/i.test(t) ||
    t.length < 10
  );
}

/** RSS/feed dedup by known disease signature OR full title prefix. */
function freshItemSignature(title: string): string {
  const t = title.toLowerCase();
  for (const d of DISEASE_SIGNATURES) {
    if (t.includes(d)) return d;
  }
  return `title:${t.slice(0, 56)}`;
}

async function parseRssItems(feedUrl: string): Promise<FreshItem[]> {
  try {
    const res = await fetch(feedUrl, {
      headers: { "User-Agent": "TheTheorist/1.0" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return [];
    const xml = await res.text();
    const items: FreshItem[] = [];
    for (const m of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
      const x = m[1];
      const title = x.match(/<title>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/title>/)?.[1]?.trim() ?? "";
      const descRaw =
        x.match(/<description>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/)?.[1]?.trim() ?? "";
      const desc = stripHtml(descRaw);
      const link = x.match(/<link>(.*?)<\/link>/)?.[1]?.trim() ?? "";
      const pub = x.match(/<pubDate>(.*?)<\/pubDate>/)?.[1]?.trim() ?? "";
      if (title && link && !isWeakRssTitle(title) && isStrictOutbreakCandidate(title, desc)) {
        items.push({ title, description: stripHtml(desc).slice(0, 300), link, pubDate: pub });
      }
    }
    return items;
  } catch {
    return [];
  }
}

async function fetchFreshRssItems(): Promise<FreshItem[]> {
  const batches = await Promise.allSettled(OUTBREAK_RSS_FEEDS.map((url) => parseRssItems(url)));
  const merged: FreshItem[] = [];
  const seen = new Set<string>();
  for (const b of batches) {
    if (b.status !== "fulfilled") continue;
    for (const item of b.value) {
      const sig = freshItemSignature(item.title);
      if (seen.has(sig)) continue;
      seen.add(sig);
      merged.push(item);
    }
  }
  return sortByPubDateDesc(merged);
}

async function fetchFeedOutbreakCandidates(admin: SupabaseClient): Promise<FreshItem[]> {
  const cutoff = new Date(Date.now() - FEED_OUTBREAK_LOOKBACK_DAYS * 24 * 3600_000).toISOString();
  const { data, error } = await admin
    .from("news_items")
    .select("title, summary, url, published_at, angle")
    .gte("published_at", cutoff)
    .gte("score", 60)
    .order("published_at", { ascending: false })
    .limit(120);

  if (error || !data?.length) return [];

  const items: FreshItem[] = [];
  for (const row of data) {
    const title = String(row.title ?? "").trim();
    const desc = stripHtml(String(row.summary ?? row.angle ?? ""));
    if (!title || !isStrictOutbreakCandidate(title, desc)) continue;
    items.push({
      title,
      description: desc.slice(0, 300) || title,
      link: String(row.url ?? "/"),
      pubDate: row.published_at ? new Date(row.published_at).toUTCString() : "",
    });
  }
  return sortByPubDateDesc(items);
}

async function fetchFeedLocalNews(admin: SupabaseClient, disease: string): Promise<LocalNewsRow[]> {
  if (!isValidDiseaseName(disease)) return [];
  const token = diseaseSearchToken(disease);
  if (!token || token.length < 4) return [];

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
    if (!title || !re.test(title) || isOutbreakExcluded(title)) continue;
    rows.push(
      tagLocalNewsRow({
        title,
        url: String(row.url ?? "/"),
        source: String(row.source ?? "ConspiracyHub feed"),
        pubDate: row.published_at ? new Date(row.published_at).toUTCString() : "",
      }),
    );
  }
  return sortByPubDateDesc(rows).slice(0, OUTBREAK_FEED_NEWS_MAX);
}

async function fetchLocalNews(
  disease: string,
  country: string,
): Promise<LocalNewsRow[]> {
  if (!isValidDiseaseName(disease)) return [];
  try {
    const searchTerm = diseaseSearchToken(disease) ?? disease.split(/\s+/).slice(0, 2).join(" ");
    const query = encodeURIComponent(`${searchTerm} outbreak ${country}`);
    const url = `https://news.google.com/rss/search?q=${query}&hl=en-US&gl=US&ceid=US:en&num=${OUTBREAK_LOCAL_NEWS_PER_COUNTRY}`;
    const res = await fetch(url, {
      headers: { "User-Agent": "TheTheorist/1.0" },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return [];
    const xml = await res.text();
    const items: LocalNewsRow[] = [];
    for (const m of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
      const x = m[1];
      const title = x.match(/<title>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/title>/)?.[1]?.trim() ?? "";
      const link = x.match(/<link>(.*?)<\/link>/)?.[1]?.trim() ?? "";
      const pub = x.match(/<pubDate>(.*?)<\/pubDate>/)?.[1]?.trim() ?? "";
      const source = x.match(/<source[^>]*>(.*?)<\/source>/)?.[1]?.trim() ?? "";
      if (title && link && !isOutbreakExcluded(title)) {
        items.push(
          tagLocalNewsRow({
            title,
            url: link,
            source,
            pubDate: pub,
            country: country.toLowerCase().trim(),
          }),
        );
      }
    }
    return sortByPubDateDesc(items).slice(0, OUTBREAK_LOCAL_NEWS_PER_COUNTRY);
  } catch {
    return [];
  }
}

/** Google News per affected country + site feed — tagged by country for UI grouping. */
async function buildLocalNewsMultiCountry(
  admin: SupabaseClient,
  disease: string,
  originCountry: string,
  affectedCountries: string[],
): Promise<LocalNewsRow[]> {
  if (!isValidDiseaseName(disease)) return [];

  const origin = originCountry.toLowerCase().trim();
  const countries = [
    ...new Set([origin, ...affectedCountries.map((c) => c.toLowerCase().trim())].filter(Boolean)),
  ].slice(0, OUTBREAK_LOCAL_NEWS_COUNTRY_MAX);

  const seenUrls = new Set<string>();
  const out: LocalNewsRow[] = [];

  const feedNews = await fetchFeedLocalNews(admin, disease);
  for (const row of feedNews) {
    if (seenUrls.has(row.url)) continue;
    seenUrls.add(row.url);
    out.push({ ...row, country: origin || "feed" });
    if (out.length >= OUTBREAK_LOCAL_NEWS_MAX) return sortByPubDateDesc(out);
  }

  const ordered = [origin, ...countries.filter((c) => c !== origin)];
  const batches = await Promise.allSettled(ordered.map((country) => fetchLocalNews(disease, country)));

  for (let ci = 0; ci < batches.length; ci++) {
    const country = ordered[ci];
    const batch = batches[ci];
    if (batch.status !== "fulfilled") continue;
    for (const row of batch.value) {
      if (seenUrls.has(row.url)) continue;
      seenUrls.add(row.url);
      out.push(row.country ? row : { ...row, country });
      if (out.length >= OUTBREAK_LOCAL_NEWS_MAX) return sortByPubDateDesc(out);
    }
  }

  return sortByPubDateDesc(out);
}

async function enrichOutbreakLocalNews(admin: SupabaseClient, row: OutbreakRow): Promise<OutbreakRow> {
  const disease = String(row.disease ?? "");
  const origin = String(row.origin_country ?? row.location ?? "").toLowerCase();
  const affected = Array.isArray(row.affected_countries)
    ? (row.affected_countries as string[])
    : [];
  const localNews = await buildLocalNewsMultiCountry(admin, disease, origin, affected);
  return { ...row, localNews };
}

const SYS = `You are a disease outbreak intelligence analyst. Analyze the outbreak for conspiracy relevance, patents, and geopolitical context.
LANGUAGE: All JSON string values MUST be English only.

If the story is NOT about an infectious disease outbreak (politics, sports, finance, entertainment, crime, philanthropy, etc.), return ONLY: {"reject":true}

Otherwise return ONLY valid JSON:
{
  "reject":false,
  "disease":"specific pathogen or syndrome name (e.g. Ebola, Dengue, H5N1 — NEVER use unknown, n/a, or illness)",
  "location":"primary affected country (lowercase, single country or 'multiple countries')",
  "affected_countries":["country1","country2"],
  "lat":0.0,"lng":0.0,
  "conspiracy_score":0,
  "has_conspiracy":false,
  "theories":[],
  "patents":[],
  "key_facts":["fact1","fact2","fact3"],
  "verdict":"NATURAL",
  "risk_level":"MEDIUM",
  "origin_country":"lowercase country name where outbreak originated",
  "stats":{
    "confirmed_cases":null,
    "deaths":null,
    "case_fatality_rate":null
  }
}
affected_countries: array of ALL currently affected countries (lowercase), up to 8.
verdict: NATURAL|SUSPICIOUS|HIGHLY_SUSPICIOUS|UNKNOWN
risk_level: LOW|MEDIUM|HIGH|CRITICAL
stats: Extract from the article ONLY if explicitly stated. confirmed_cases = integer or null. deaths = integer or null. case_fatality_rate = string like "38%" or null. Do NOT invent numbers. If not mentioned, use null.
theories: ONLY include entries when you can cite at least one real, verifiable https URL from the source article or a known news/research domain. Each theory MUST have sources with working URLs. If no documented conspiracy narrative exists in the input, return "theories":[] and set has_conspiracy:false and conspiracy_score:0.
patents: ONLY include real USPTO/Google Patents entries with valid patent numbers. If none found, return "patents":[].
NEVER invent URLs, NEVER use example.com, placeholder.com, or generic https:// links.
conspiracy_score must be 0 when theories is empty. conspiracy_score reflects documented theories only.
disease MUST name a real infectious agent or WHO-tracked syndrome.`;

type AnalysisRow = {
  reject?: boolean;
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
  stats?: {
    confirmed_cases: number | null;
    deaths: number | null;
    case_fatality_rate: string | null;
  };
};

function isAnalysisAcceptable(analysis: AnalysisRow, item: FreshItem): boolean {
  if (analysis.reject === true) return false;
  if (!isValidDiseaseName(analysis.disease)) return false;
  const blob = `${item.title} ${item.description}`;
  if (isOutbreakExcluded(blob)) return false;
  const verdict = (analysis.verdict ?? "").toUpperCase();
  if (verdict === "UNKNOWN" && !hasKnownDiseaseSignature(`${analysis.disease} ${blob}`)) return false;
  return true;
}

/**
 * Fresh items: picked from RSS (ProMED/WHO/ECDC/CDC) + feed DB.
 * Deduplicated against curated disease IDs so we don't double-show known diseases.
 */
async function fetchFreshCandidates(
  admin: SupabaseClient,
  curatedIds: Set<string>,
): Promise<FreshItem[]> {
  const [rss, feed] = await Promise.all([
    fetchFreshRssItems(),
    fetchFeedOutbreakCandidates(admin),
  ]);

  const merged: FreshItem[] = [];
  const seen = new Set<string>(curatedIds);

  for (const item of sortByPubDateDesc([...rss, ...feed])) {
    const sig = freshItemSignature(item.title);
    if (seen.has(sig)) continue;
    seen.add(sig);
    merged.push(item);
    if (merged.length >= OUTBREAK_FRESH_MAX) break;
  }
  return merged;
}

export function buildOutbreakPreviewPayload() {
  const ebola = CURATED_DISEASES.find((c) => c.id === "ebola")!;
  const h5n1 = CURATED_DISEASES.find((c) => c.id === "h5n1")!;
  const rows = [ebola, h5n1].map((item, i) => ({
    id: `preview-${i}-${Date.now()}`,
    title: item.title,
    description: item.description,
    source_url: item.link,
    published_at: item.pubDate,
    disease: item.disease,
    location: item.location,
    origin_country: item.origin_country,
    affected_countries: item.affected_countries,
    lat: item.lat,
    lng: item.lng,
    affectedCoords: buildAffectedCoords(item.affected_countries),
    conspiracy_score: 12,
    has_conspiracy: false,
    theories: [
      {
        name: "Preview mode",
        summary:
          "Static WHO-style watchlist entry only — no live AI enrichment in this preview. Reload for the full pipeline when the server responds.",
        probability: 10,
        sources: [item.link],
      },
    ],
    patents: [] as Array<{ number: string; title: string; assignee: string; url: string }>,
    key_facts: [
      "Preview: sample signals from curated disease watchlist.",
      "Full tracker adds ProMED, ECDC, Google News, and GPT analysis.",
    ],
    verdict: "UNKNOWN",
    risk_level: item.risk_level,
    stats: item.stats,
    localNews: [] as LocalNewsRow[],
  }));
  return {
    outbreaks: rows.map((row) => sanitizeOutbreakRow(row as OutbreakRow)),
    generated_at: new Date().toISOString(),
    preview: true as const,
  };
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
          return {
            ok: true,
            status: 200,
            payload: { ...sanitizeOutbreakPayload(data), cached: true },
          };
        }
      }
    } catch {
      /* table may not exist until migration */
    }
  }

  try {
    const apiKey = process.env.OPENAI_API_KEY!;

    const curatedIds = new Set(CURATED_DISEASES.map((c) => c.id));

    // ── 1. GPT-analyse fresh RSS/feed items (parallel, up to OUTBREAK_FRESH_MAX) ──
    const freshItems = await fetchFreshCandidates(admin, curatedIds);

    const freshSettled = await Promise.allSettled(
      freshItems.map(async (item) => {
        const analysis = await callOpenAIJSON<AnalysisRow>({
          apiKey,
          system: SYS,
          user: `"${item.title}"\n\n${item.description}\n\nSource: ${item.link}`,
          maxTokens: 900,
          model: "gpt-4o-mini",
          maxAttempts: 2,
        });
        if (!isAnalysisAcceptable(analysis, item)) return null;
        const affected_countries = mergeAffectedCountries(analysis);
        const origin = String(analysis.origin_country ?? analysis.location ?? "").toLowerCase();
        const resolved = resolveCountryCoords(origin);
        const [lat, lng] = resolved ?? [analysis.lat ?? 0, analysis.lng ?? 0];
        return {
          id: `ob-fresh-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          title: item.title,
          description: cleanOutbreakBlurb(
            analysis.key_facts?.slice(0, 2).join(" ") || item.description,
          ).slice(0, 300),
          source_url: item.link,
          published_at: item.pubDate,
          ...analysis,
          key_facts: analysis.key_facts.map((f) => cleanOutbreakBlurb(f)),
          affected_countries,
          lat,
          lng,
          affectedCoords: buildAffectedCoords(affected_countries),
          localNews: [] as LocalNewsRow[],
          stats: resolveOutbreakStats(analysis.stats, analysis.disease),
        };
      }),
    );

    const freshOutbreaks = freshSettled
      .map((r) => (r.status === "fulfilled" ? r.value : null))
      .filter((r): r is NonNullable<typeof r> => r != null);

    // Track which diseases are already covered by fresh items
    const freshDiseasesSeen = new Set(
      freshOutbreaks.map((o) => diseaseSearchToken(o.disease) ?? o.disease.toLowerCase().slice(0, 12)),
    );

    // ── 2. Always include all curated diseases with fresh local news ──
    const curatedOutbreaks = await Promise.all(
      CURATED_DISEASES.map(async (c) => {
        const diseaseToken = diseaseSearchToken(c.disease) ?? c.disease.toLowerCase().slice(0, 12);
        // Skip if fresh items already have this disease covered from RSS
        if (freshDiseasesSeen.has(diseaseToken)) return null;

        return {
          id: `ob-curated-${c.id}-${Date.now()}`,
          title: c.title,
          description: c.description,
          source_url: c.link,
          published_at: c.pubDate,
          disease: c.disease,
          location: c.location,
          origin_country: c.origin_country,
          affected_countries: c.affected_countries,
          lat: c.lat,
          lng: c.lng,
          affectedCoords: buildAffectedCoords(c.affected_countries),
          conspiracy_score: 0,
          has_conspiracy: false,
          theories: [] as AnalysisRow["theories"],
          patents: [] as AnalysisRow["patents"],
          key_facts: [c.description.slice(0, 200)],
          verdict: "NATURAL",
          risk_level: c.risk_level,
          stats: c.stats,
          localNews: [] as LocalNewsRow[],
        };
      }),
    );

    const allOutbreaks = [
      ...freshOutbreaks,
      ...curatedOutbreaks.filter((o): o is NonNullable<typeof o> => o != null),
    ];

    const mergedOutbreaks = mergeOutbreaksByDisease(allOutbreaks as OutbreakRow[]);

    const outbreaksWithNews = await Promise.all(
      mergedOutbreaks.map((row) => enrichOutbreakLocalNews(admin, row)),
    );

    const outbreaksSorted = sortByPublishedAtDesc(outbreaksWithNews);

    const payload: OutbreakPayload = sanitizeOutbreakPayload({
      outbreaks: outbreaksSorted.map((row) => sanitizeOutbreakRow(row)),
      generated_at: new Date().toISOString(),
      cache_version: OUTBREAK_CACHE_VERSION,
      cached: false,
    });

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
