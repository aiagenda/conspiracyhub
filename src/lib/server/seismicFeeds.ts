import { revalidateTag, unstable_cache } from "next/cache";
import type { SeismicEvent, SeismicFeedStatus, SeismicPayload, SeismicSource } from "@/lib/seismic";

const UA = "TheTheorist/1.0 (+https://the-theorist.com; seismic tracker)";

const USGS_FEEDS = [
  {
    id: "usgs_2.5_day",
    label: "USGS M2.5+ 24h",
    url: "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson",
    significant: false,
  },
  {
    id: "usgs_4.5_week",
    label: "USGS M4.5+ 7d",
    url: "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_week.geojson",
    significant: false,
  },
  {
    id: "usgs_significant_month",
    label: "USGS significant 30d",
    url: "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/significant_month.geojson",
    significant: true,
  },
] as const;

const EMSC_URL =
  "https://www.seismicportal.eu/fdsnws/event/1/query?format=json&limit=200&minmag=2.5&orderby=time";

type GeoFeature = {
  id?: string;
  properties?: Record<string, unknown>;
  geometry?: { type?: string; coordinates?: number[] };
};

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

function num(v: unknown): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" ? parseFloat(v) : NaN;
  return Number.isFinite(n) ? n : null;
}

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : v == null ? "" : String(v);
}

function toIso(raw: unknown): string | null {
  if (typeof raw === "number" && Number.isFinite(raw)) {
    const ms = raw < 1e12 ? raw * 1000 : raw;
    return new Date(ms).toISOString();
  }
  if (typeof raw === "string" && raw.trim()) {
    const d = new Date(raw);
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }
  return null;
}

async function fetchJson(url: string): Promise<unknown> {
  const res = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": UA },
    next: { revalidate: 300 },
    signal: AbortSignal.timeout(12000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

function parseUsgsFeature(f: GeoFeature, significant: boolean): SeismicEvent | null {
  const coords = f.geometry?.coordinates;
  if (!Array.isArray(coords) || coords.length < 2) return null;
  const lng = num(coords[0]);
  const lat = num(coords[1]);
  const depthKm = num(coords[2]);
  const p = f.properties ?? {};
  const mag = num(p.mag);
  const time = toIso(p.time);
  if (lat == null || lng == null || mag == null || !time) return null;
  const place = str(p.place) || "Unknown location";
  const id = str(f.id) || `usgs-${time}-${lat.toFixed(3)}-${lng.toFixed(3)}`;
  return {
    id,
    title: str(p.title) || `M${mag.toFixed(1)} — ${place}`,
    place,
    mag,
    magType: str(p.magType) || "ml",
    time,
    lat,
    lng,
    depthKm,
    tsunami: Number(p.tsunami) === 1,
    felt: num(p.felt),
    pager: str(p.alert) || null,
    significance: num(p.sig) ?? 0,
    status: str(p.status) || "automatic",
    type: str(p.type) || "earthquake",
    url: str(p.url) || `https://earthquake.usgs.gov/earthquakes/eventpage/${id}`,
    sources: ["usgs"],
    significant,
  };
}

function parseEmscFeature(f: GeoFeature): SeismicEvent | null {
  const p = f.properties ?? {};
  const coords = f.geometry?.coordinates;
  const lng = (Array.isArray(coords) ? num(coords[0]) : null) ?? num(p.lon);
  const lat = (Array.isArray(coords) ? num(coords[1]) : null) ?? num(p.lat);
  const rawDepth = (Array.isArray(coords) ? num(coords[2]) : null) ?? num(p.depth);
  const depthKm = rawDepth == null ? null : Math.abs(rawDepth);
  const mag = num(p.mag) ?? num(p.magnitude);
  const time = toIso(p.time) ?? toIso(p.origin_time);
  if (lat == null || lng == null || mag == null || !time) return null;
  const place = str(p.flynn_region) || str(p.place) || str(p.region) || "Unknown location";
  const rawId = str(f.id) || str(p.unid) || str(p.source_id);
  const id = rawId ? (rawId.startsWith("emsc") ? rawId : `emsc-${rawId}`) : `emsc-${time}-${lat.toFixed(3)}`;
  const url =
    str(p.url) ||
    (rawId ? `https://www.emsc-csem.org/Earthquake_information/?id=${encodeURIComponent(rawId)}` : "");
  return {
    id,
    title: `M${mag.toFixed(1)} — ${place}`,
    place,
    mag,
    magType: str(p.magtype) || str(p.magType) || "ml",
    time,
    lat,
    lng,
    depthKm,
    tsunami: false,
    felt: null,
    pager: null,
    significance: Math.round(mag * 100),
    status: str(p.status) || "reviewed",
    type: "earthquake",
    url: url || "https://www.emsc-csem.org/",
    sources: ["emsc"],
    significant: mag >= 6,
  };
}

function featuresFrom(json: unknown): GeoFeature[] {
  if (!json || typeof json !== "object") return [];
  const rec = json as { features?: unknown };
  return Array.isArray(rec.features) ? (rec.features as GeoFeature[]) : [];
}

function preferUsgs(a: SeismicEvent, b: SeismicEvent): SeismicEvent {
  const usgsFirst = a.sources.includes("usgs") ? a : b.sources.includes("usgs") ? b : a;
  const other = usgsFirst === a ? b : a;
  return {
    ...usgsFirst,
    sources: [...new Set([...usgsFirst.sources, ...other.sources])] as SeismicSource[],
    tsunami: usgsFirst.tsunami || other.tsunami,
    significant: usgsFirst.significant || other.significant,
    felt: usgsFirst.felt ?? other.felt,
    pager: usgsFirst.pager ?? other.pager,
    url: usgsFirst.sources.includes("usgs") ? usgsFirst.url : other.url,
  };
}

function mergeEvents(incoming: SeismicEvent[]): SeismicEvent[] {
  const out: SeismicEvent[] = [];
  for (const ev of incoming) {
    const dup = out.find(
      (x) =>
        Math.abs(new Date(x.time).getTime() - new Date(ev.time).getTime()) < 180_000 &&
        haversineKm(x.lat, x.lng, ev.lat, ev.lng) < 80 &&
        Math.abs(x.mag - ev.mag) < 0.8,
    );
    if (dup) {
      const idx = out.indexOf(dup);
      out[idx] = preferUsgs(dup, ev);
    } else {
      out.push(ev);
    }
  }
  return out.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
}

function statsFrom(events: SeismicEvent[]): SeismicPayload["stats"] {
  const day = Date.now() - 24 * 3600_000;
  return {
    total: events.length,
    last24h: events.filter((e) => new Date(e.time).getTime() >= day).length,
    m45: events.filter((e) => e.mag >= 4.5).length,
    m5: events.filter((e) => e.mag >= 5).length,
    m6: events.filter((e) => e.mag >= 6).length,
    tsunami: events.filter((e) => e.tsunami).length,
    significant: events.filter((e) => e.significant).length,
  };
}

async function fetchAndMergeSeismic(): Promise<SeismicPayload> {
  const feeds: SeismicFeedStatus[] = [];
  const collected: SeismicEvent[] = [];

  const usgsResults = await Promise.allSettled(
    USGS_FEEDS.map(async (feed) => {
      const json = await fetchJson(feed.url);
      const events = featuresFrom(json)
        .map((f) => parseUsgsFeature(f, feed.significant))
        .filter((e): e is SeismicEvent => e !== null);
      return { feed, events };
    }),
  );

  for (let i = 0; i < USGS_FEEDS.length; i++) {
    const spec = USGS_FEEDS[i];
    const result = usgsResults[i];
    if (result.status === "fulfilled") {
      collected.push(...result.value.events);
      feeds.push({ id: spec.id, label: spec.label, ok: true, count: result.value.events.length });
    } else {
      feeds.push({
        id: spec.id,
        label: spec.label,
        ok: false,
        count: 0,
        error: result.reason instanceof Error ? result.reason.message : String(result.reason),
      });
    }
  }

  try {
    const json = await fetchJson(EMSC_URL);
    const events = featuresFrom(json)
      .map(parseEmscFeature)
      .filter((e): e is SeismicEvent => e !== null);
    collected.push(...events);
    feeds.push({ id: "emsc_fdsn", label: "EMSC FDSN M2.5+", ok: true, count: events.length });
  } catch (e) {
    feeds.push({
      id: "emsc_fdsn",
      label: "EMSC FDSN M2.5+",
      ok: false,
      count: 0,
      error: e instanceof Error ? e.message : String(e),
    });
  }

  const events = mergeEvents(collected);
  return {
    events,
    feeds,
    generated_at: new Date().toISOString(),
    stats: statsFrom(events),
  };
}

export const SEISMIC_CACHE_TAG = "seismic-payload";

export const loadSeismicPayload = unstable_cache(fetchAndMergeSeismic, ["seismic-payload-v1"], {
  revalidate: 300,
  tags: [SEISMIC_CACHE_TAG],
});

export async function runSeismicRefresh(): Promise<{
  ok: boolean;
  status: number;
  payload: SeismicPayload | { error: string };
}> {
  try {
    const payload = await fetchAndMergeSeismic();
    revalidateTag(SEISMIC_CACHE_TAG, { expire: 0 });
    return { ok: true, status: 200, payload };
  } catch (e) {
    return { ok: false, status: 500, payload: { error: e instanceof Error ? e.message : String(e) } };
  }
}

export function pickSeismicHighlight(payload: SeismicPayload): SeismicEvent | null {
  const week = Date.now() - 7 * 24 * 3600_000;
  const pool = payload.events.filter((e) => e.mag >= 5 && new Date(e.time).getTime() >= week);
  if (!pool.length) return null;
  return [...pool].sort((a, b) => b.mag - a.mag || new Date(b.time).getTime() - new Date(a.time).getTime())[0] ?? null;
}
