import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createHash } from "crypto";

function getAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) throw new Error("Missing Supabase env");
  return createClient(url, key);
}

function fp(req: NextRequest) {
  const ip =
    req.headers.get("x-forwarded-for") ??
    req.headers.get("x-real-ip") ??
    "unknown";
  const ua = req.headers.get("user-agent") ?? "";
  return createHash("sha256")
    .update(ip + ua)
    .digest("hex")
    .slice(0, 16);
}

function stripHtml(html: string): string {
  let s = html
    .replace(/<script[\s\S]*?<\/script>/gi, "\n")
    .replace(/<style[\s\S]*?<\/style>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(
      /<\/(p|div|h[1-6]|li|tr|th|td|blockquote|section|article|header|footer|pre)\b[^>]*>/gi,
      "\n"
    )
    .replace(
      /<(p|div|h[1-6]|li|tr|th|td|blockquote|section|article|header|footer|pre)\b[^>]*>/gi,
      "\n"
    )
    .replace(/<[^>]+>/g, " ");
  s = s
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#0*38;/g, "&")
    .replace(/&#(\d+);/g, (_, n) => {
      const code = parseInt(n, 10);
      return code > 0 && code < 0x110000 ? String.fromCharCode(code) : " ";
    })
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => {
      const code = parseInt(h, 16);
      return code > 0 && code < 0x110000 ? String.fromCharCode(code) : " ";
    });
  s = s.replace(/[ \t\f\v]+/g, " ");
  s = s.replace(/ *\n */g, "\n");
  s = s.replace(/\n{3,}/g, "\n\n");
  return s.trim();
}

const US_STATE_LIST = [
  "Alabama","Alaska","Arizona","Arkansas","California","Colorado","Connecticut",
  "Delaware","Florida","Georgia","Hawaii","Idaho","Illinois","Indiana","Iowa",
  "Kansas","Kentucky","Louisiana","Maine","Maryland","Massachusetts","Michigan",
  "Minnesota","Mississippi","Missouri","Montana","Nebraska","Nevada",
  "New Hampshire","New Jersey","New Mexico","New York","North Carolina",
  "North Dakota","Ohio","Oklahoma","Oregon","Pennsylvania","Rhode Island",
  "South Carolina","South Dakota","Tennessee","Texas","Utah","Vermont",
  "Virginia","Washington","West Virginia","Wisconsin","Wyoming",
];

const STATE_ABBR_RE =
  "AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY|DC";

/** Known non-US countries so we can geocode them without forcing ", USA" */
const KNOWN_COUNTRIES = [
  "Afghanistan","Albania","Algeria","Argentina","Armenia","Australia","Austria",
  "Azerbaijan","Bangladesh","Belarus","Belgium","Bolivia","Bosnia","Brazil","Bulgaria",
  "Cambodia","Canada","Chile","China","Colombia","Croatia","Cuba","Czech Republic",
  "Denmark","Egypt","Estonia","Ethiopia","Finland","France","Georgia","Germany",
  "Ghana","Greece","Guatemala","Hungary","India","Indonesia","Iran","Iraq","Ireland",
  "Israel","Italy","Jamaica","Japan","Jordan","Kazakhstan","Kenya","Kosovo","Kuwait",
  "Latvia","Lebanon","Libya","Lithuania","Luxembourg","Malaysia","Mexico","Moldova",
  "Morocco","Myanmar","Netherlands","New Zealand","Nigeria","North Korea","Norway",
  "Pakistan","Peru","Philippines","Poland","Portugal","Romania","Russia","Saudi Arabia",
  "Serbia","Slovakia","Slovenia","South Africa","South Korea","Spain","Sri Lanka",
  "Sudan","Sweden","Switzerland","Syria","Taiwan","Thailand","Turkey","Ukraine",
  "United Kingdom","UK","England","Scotland","Wales","Venezuela","Vietnam","Yemen",
];

/**
 * Extract a short, geocodable location string from a NUFORC post.
 * Returns null if nothing recognisable is found.
 */
function extractGeoQuery(title: string, plain: string): string | null {
  const text = `${title}\n${plain.slice(0, 1200)}`;

  // 1. "City, ST" or "City, State-name" (US)
  const csRe = new RegExp(
    `\\b([A-Z][a-z]+(?:[\\s-][A-Z][a-z]+){0,2}),\\s*(${STATE_ABBR_RE}|${US_STATE_LIST.map(s => s.replace(/\s/g, "\\s")).join("|")})\\b`
  );
  const m1 = text.match(csRe);
  if (m1) return `${m1[1].trim()}, ${m1[2].trim()}, USA`;

  // 2. Known non-US country name anywhere in the text → use as-is
  for (const country of KNOWN_COUNTRIES) {
    if (new RegExp(`\\b${country}\\b`, "i").test(text)) {
      // Try to find a city preceding the country name: "City, Country"
      const cityCountryRe = new RegExp(
        `\\b([A-Z][a-z]+(?:[\\s-][A-Z][a-z]+){0,2}),\\s*${country}\\b`,
        "i"
      );
      const mc = text.match(cityCountryRe);
      if (mc) return `${mc[1].trim()}, ${country}`;
      return country;
    }
  }

  // 3. "in / near / over / outside City" where City starts with capital (assume US)
  const inCityRe = /\b(?:in|near|over|above|outside|around)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2})\b/g;
  let m2: RegExpExecArray | null;
  const SKIP = new Set(["The","A","An","This","That","Our","His","Her","Their","Its","Every","Some","Many","Both","Each"]);
  while ((m2 = inCityRe.exec(text)) !== null) {
    const place = m2[1].trim();
    if (!SKIP.has(place.split(" ")[0]) && place.length > 2) return `${place}, USA`;
  }

  // 4. Any US state name (full) mentioned anywhere
  for (const state of US_STATE_LIST) {
    if (text.includes(state)) return `${state}, USA`;
  }

  return null;
}

// ── NUFORC scraper (WordPress REST — multiple pages for more than ~12 “classic” incidents) ──
// ── Per-case extraction ─────────────────────────────────────
const MONTH_NAMES = ["january","february","march","april","may","june","july","august","september","october","november","december"];
const MONTHS_RE_STR = MONTH_NAMES.join("|");

function parseFreeformDate(text: string): string | null {
  const m = text.match(new RegExp(`(${MONTHS_RE_STR})\\s+(\\d{1,2}),?\\s+(\\d{4})`, "i"));
  if (m) {
    const mo = String(MONTH_NAMES.indexOf(m[1].toLowerCase()) + 1).padStart(2, "0");
    return `${m[3]}-${mo}-${m[2].padStart(2, "0")}`;
  }
  const m2 = text.match(new RegExp(`(${MONTHS_RE_STR})\\s+(\\d{4})`, "i"));
  if (m2) {
    const mo = String(MONTH_NAMES.indexOf(m2[1].toLowerCase()) + 1).padStart(2, "0");
    return `${m2[2]}-${mo}-01`;
  }
  return null;
}

interface CaseHit {
  geoQuery: string;
  locationDisplay: string;
  eventDate: string | null;
  snippet: string;
}

/**
 * Extract individual sighting cases from a NUFORC blog post.
 * Looks for "City, STATE" or "City, Country" at the start of a short line
 * — the format NUFORC uses for highlighted case headers in summary posts.
 */
function extractCaseHits(plain: string): CaseHit[] {
  const hits: CaseHit[] = [];
  const seenKeys = new Set<string>();
  const lines = plain.split("\n").map((l) => l.trim()).filter(Boolean);

  for (let i = 0; i < lines.length && hits.length < 15; i++) {
    const line = lines[i];
    if (line.length > 140) continue;

    // "City, STATE ..."
    const usM = line.match(
      new RegExp(`^([A-Z][a-z]+(?:[\\s-][A-Z][a-z]+){0,2}),\\s*(${STATE_ABBR_RE})\\b`)
    );
    if (usM) {
      const city = usM[1].trim();
      const state = usM[2].trim();
      const key = `${city},${state}`.toLowerCase();
      if (!seenKeys.has(key)) {
        seenKeys.add(key);
        const ctx = lines.slice(i, Math.min(i + 6, lines.length)).join(" ");
        hits.push({
          geoQuery: `${city}, ${state}, USA`,
          locationDisplay: `${city}, ${state}`,
          eventDate: parseFreeformDate(ctx),
          snippet: ctx.slice(0, 400),
        });
      }
      continue;
    }

    // "City, Country ..."
    for (const country of KNOWN_COUNTRIES) {
      const re = new RegExp(
        `^([A-Z][a-z]+(?:[\\s-][A-Z][a-z]+){0,2}),\\s*${country}\\b`, "i"
      );
      const intlM = line.match(re);
      if (intlM) {
        const city = intlM[1].trim();
        const key = `${city},${country}`.toLowerCase();
        if (!seenKeys.has(key)) {
          seenKeys.add(key);
          const ctx = lines.slice(i, Math.min(i + 6, lines.length)).join(" ");
          hits.push({
            geoQuery: `${city}, ${country}`,
            locationDisplay: `${city}, ${country}`,
            eventDate: parseFreeformDate(ctx),
            snippet: ctx.slice(0, 400),
          });
        }
        break;
      }
    }
  }
  return hits;
}

async function scrapeNUFORC(): Promise<NuforcRow[]> {
  const byId = new Map<string, NuforcRow>();
  try {
    for (let page = 1; page <= 10; page++) {
      const res = await fetch(
        `https://nuforc.org/wp-json/wp/v2/posts?per_page=50&page=${page}&orderby=date&order=desc&_fields=id,date,link,title,content`,
        {
          headers: {
            Accept: "application/json",
            "User-Agent": "ConspiracyHub/1.0 (UAP sighting ingest; +https://nuforc.org)",
          },
          signal: AbortSignal.timeout(25000),
        }
      );
      if (!res.ok) break;
      const posts = (await res.json()) as Array<{
        id: number;
        date: string;
        link: string;
        title: { rendered: string };
        content: { rendered: string };
      }>;
      if (!Array.isArray(posts) || posts.length === 0) break;

      for (const p of posts) {
        const title = stripHtml(p.title?.rendered ?? "");
        const plain = stripHtml(p.content?.rendered ?? "");
        if (title.length < 4) continue;
        const summary = plain.slice(0, 2000) || null;
        const sid = `wp-${p.id}`;

        // Try to extract multiple individual cases from the post
        const cases = extractCaseHits(plain);
        if (cases.length > 0) {
          // One record per extracted case; source_id scoped to this post+case
          for (let ci = 0; ci < cases.length; ci++) {
            const c = cases[ci];
            const csid = `${sid}-c${ci}`;
            byId.set(csid, {
              source_id: csid,
              source_url: p.link,
              dateRaw: c.eventDate ?? p.date,
              location: c.geoQuery,
              locationDisplay: c.locationDisplay,
              displayTitle: `${title} — ${c.locationDisplay}`.slice(0, 190),
              shape: null,
              duration: null,
              summary: c.snippet || summary,
            });
          }
        } else {
          // Fallback: single record from the overall post
          byId.set(sid, {
            source_id: sid,
            source_url: p.link,
            dateRaw: p.date,
            location: extractGeoQuery(title, plain),
            locationDisplay: null,
            displayTitle: title,
            shape: null,
            duration: null,
            summary,
          });
        }
      }
      if (posts.length < 50) break;
      await new Promise((r) => setTimeout(r, 250));
    }
  } catch (e) {
    console.error("[nuforc scrape]", e);
  }
  return Array.from(byId.values()).slice(0, 250);
}

interface NuforcRow {
  source_id: string;
  source_url: string;
  dateRaw: string;
  location: string | null;       // geocoding query
  locationDisplay: string | null; // human-readable short location
  displayTitle: string;
  shape: string | null;
  duration: string | null;
  summary: string | null;
}

// ── Nominatim geocoder (OpenStreetMap, free, no key) ─────────
const geocodeCache = new Map<string, { lat: number; lng: number } | null>();

type GeoCoords = { lat: number; lng: number };

/** usedRemote = true when Nominatim was actually called (respect 1 req/s between those). */
async function geocode(
  location: string
): Promise<{ coords: GeoCoords | null; usedRemote: boolean }> {
  const key = location.toLowerCase();
  if (geocodeCache.has(key)) {
    return { coords: geocodeCache.get(key)!, usedRemote: false };
  }
  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(location)}&format=json&limit=1`;
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "ConspiracyHub/1.0 (UAP geocode; contact via site operator)",
        "Accept-Language": "en",
      },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
      geocodeCache.set(key, null);
      return { coords: null, usedRemote: true };
    }
    const data = (await res.json()) as Array<{ lat: string; lon: string }>;
    if (!data.length) {
      geocodeCache.set(key, null);
      return { coords: null, usedRemote: true };
    }
    const result: GeoCoords = {
      lat: parseFloat(data[0].lat),
      lng: parseFloat(data[0].lon),
    };
    geocodeCache.set(key, result);
    return { coords: result, usedRemote: true };
  } catch {
    geocodeCache.set(key, null);
    return { coords: null, usedRemote: true };
  }
}

function parseEventDate(raw: string): string | null {
  if (!raw) return null;
  // ISO: 2026-05-01T10:43:44
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) {
    const d = new Date(raw);
    if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  }
  // Legacy: "04/28/25 22:15"
  try {
    const [datePart] = raw.split(" ");
    const parts = datePart.split("/");
    if (parts.length !== 3) return null;
    const [mm, dd, yy] = parts;
    const year =
      yy.length === 2
        ? parseInt(yy, 10) > 50
          ? `19${yy}`
          : `20${yy}`
        : yy;
    return `${year}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
  } catch {
    return null;
  }
}

// ── Exported scrape function (called directly from scheduler to avoid HTTP self-call) ──

export async function runUapScrape(maxNew = 70): Promise<{
  success: boolean;
  inserted: number;
  skipped: number;
  geocoded: number;
  truncated: boolean;
  fetched_candidates: number;
}> {
  const admin = getAdmin();
  const rows = await scrapeNUFORC();
  let inserted = 0;
  let skipped = 0;
  let geocoded = 0;
  let truncated = false;

  for (const row of rows) {
    if (inserted >= maxNew) { truncated = true; break; }
    const { data: existing } = await admin
      .from("uap_sightings")
      .select("id")
      .eq("source", "nuforc")
      .eq("source_id", row.source_id)
      .maybeSingle();
    if (existing) { skipped++; continue; }

    const eventDate = parseEventDate(row.dateRaw);
    const geoQ = row.location;
    let coords: GeoCoords | null = null;
    let usedRemote = false;
    if (geoQ) {
      const res2 = await geocode(geoQ);
      coords = res2.coords;
      usedRemote = res2.usedRemote;
    }
    if (coords) geocoded++;

    await admin.from("uap_sightings").insert({
      source: "nuforc",
      source_id: row.source_id,
      source_url: row.source_url,
      title: row.displayTitle.slice(0, 200),
      description: row.summary ?? `${row.displayTitle} — sourced from NUFORC.org.`,
      location_name: (row.locationDisplay ?? geoQ) ?? null,
      lat: coords?.lat ?? null,
      lng: coords?.lng ?? null,
      geocoded: !!coords,
      event_date: eventDate,
      shape: row.shape?.toLowerCase() ?? null,
      duration_text: row.duration,
      classification: "REPORTED",
    });
    inserted++;
    if (usedRemote) await new Promise((r) => setTimeout(r, 1100));
  }

  return { success: true, inserted, skipped, geocoded, truncated, fetched_candidates: rows.length };
}

// ── GET — list sightings ──────────────────────────────────────
export async function GET(req: NextRequest) {
  try {
    const admin = getAdmin();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    const limit = Math.min(parseInt(searchParams.get("limit") ?? "60"), 200);
    const offset = parseInt(searchParams.get("offset") ?? "0");
    const shape = searchParams.get("shape");
    const since = searchParams.get("since"); // ISO date

    if (id) {
      const { data: sighting } = await admin
        .from("uap_sightings")
        .select("*")
        .eq("id", id)
        .eq("status", "active")
        .single();
      const { data: comments } = await admin
        .from("uap_sighting_comments")
        .select("*")
        .eq("sighting_id", id)
        .order("created_at", { ascending: true });
      return NextResponse.json({ sighting, comments: comments ?? [] });
    }

    let q = admin
      .from("uap_sightings")
      .select("*")
      .eq("status", "active")
      .order("event_date", { ascending: false })
      .range(offset, offset + limit - 1);

    if (shape) q = q.eq("shape", shape);
    if (since) q = q.gte("event_date", since);

    const { data, count } = await q;
    return NextResponse.json({ sightings: data ?? [], total: count ?? 0 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { error: msg, sightings: [] },
      { status: 500 }
    );
  }
}

// ── POST — scrape | add_comment | react ──────────────────────
export async function POST(req: NextRequest) {
  try {
    const admin = getAdmin();
    const body = await req.json() as Record<string, unknown>;
    const action = (body.action as string) ?? "add_comment";
    const userFp = fp(req);

    // ── scrape action (called from cron or admin) ─────────────
    if (action === "scrape") {
      const secret = body.secret as string | undefined;
      if (secret !== process.env.SCRAPER_SECRET) {
        return NextResponse.json({ error: "unauthorized" }, { status: 401 });
      }

      const maxNew = Math.min(
        Math.max(parseInt(String(body.max_new ?? "70"), 10) || 70, 1),
        120
      );

      const rows = await scrapeNUFORC();
      let inserted = 0;
      let skipped = 0;
      let geocoded = 0;
      let truncated = false;

      for (const row of rows) {
        if (inserted >= maxNew) {
          truncated = true;
          break;
        }
        // Check duplicate
        const { data: existing } = await admin
          .from("uap_sightings")
          .select("id")
          .eq("source", "nuforc")
          .eq("source_id", row.source_id)
          .maybeSingle();
        if (existing) {
          skipped++;
          continue;
        }

        const eventDate = parseEventDate(row.dateRaw);
        const geoQ = row.location; // already extracted — may be null
        let coords: GeoCoords | null = null;
        let usedRemote = false;
        if (geoQ) {
          const res2 = await geocode(geoQ);
          coords = res2.coords;
          usedRemote = res2.usedRemote;
        }
        if (coords) geocoded++;

        await admin.from("uap_sightings").insert({
          source: "nuforc",
          source_id: row.source_id,
          source_url: row.source_url,
          title: row.displayTitle.slice(0, 200),
          description:
            row.summary ??
            `${row.displayTitle} — sourced from NUFORC.org.`,
          // Store human-readable display name; fall back to geocoding query
          location_name: (row.locationDisplay ?? geoQ) ?? null,
          lat: coords?.lat ?? null,
          lng: coords?.lng ?? null,
          geocoded: !!coords,
          event_date: eventDate,
          shape: row.shape?.toLowerCase() ?? null,
          duration_text: row.duration,
          classification: "REPORTED",
        });
        inserted++;

        if (usedRemote) {
          await new Promise((r) => setTimeout(r, 1100));
        }
      }

      return NextResponse.json({
        success: true,
        inserted,
        skipped,
        geocoded,
        truncated,
        fetched_candidates: rows.length,
      });
    }

    // ── re_geocode — fill lat/lng for rows missing coordinates ─
    if (action === "re_geocode") {
      const secret = body.secret as string | undefined;
      if (secret !== process.env.SCRAPER_SECRET) {
        return NextResponse.json({ error: "unauthorized" }, { status: 401 });
      }

      const batchLimit = Math.min(
        Math.max(parseInt(String(body.limit ?? "60"), 10) || 60, 1),
        120
      );

      const { data: withCoords, error: selErr } = await admin
        .from("uap_sightings")
        .select("id, title, description, location_name, lat, lng")
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(500);

      if (selErr) {
        return NextResponse.json({ error: selErr.message }, { status: 500 });
      }

      const missing = (withCoords ?? []).filter(
        (r: { lat: number | null; lng: number | null }) =>
          r.lat == null || r.lng == null
      );

      let updated = 0;
      let stillMissing = 0;
      let processed = 0;

      for (const row of missing) {
        if (processed >= batchLimit) break;
        processed++;

        const title = (row.title as string)?.trim() ?? "";
        const desc = ((row.description as string) ?? "").replace(/\n+/g, " ").trim();

        // Re-derive a short geocodable query from title + description
        const smartQ = extractGeoQuery(title, desc);

        // Also try the stored location_name IF it looks like a short real location
        const locHint = (row.location_name as string | null) ?? "";
        const locQ =
          locHint.length > 3 && locHint.length < 120 && !/\b(NUFORC|received|reported|featured)\b/i.test(locHint)
            ? locHint
            : null;

        const queries = [smartQ, locQ].filter(Boolean) as string[];
        if (queries.length === 0) { stillMissing++; continue; }

        let coords: GeoCoords | null = null;
        let rowUsedRemote = false;
        let usedQuery: string | null = null;
        for (const q of queries) {
          const { coords: c, usedRemote } = await geocode(q);
          if (usedRemote) rowUsedRemote = true;
          coords = c;
          if (coords) { usedQuery = q; break; }
          if (usedRemote) await new Promise((r) => setTimeout(r, 1100));
        }

        if (coords) {
          const { error: upErr } = await admin
            .from("uap_sightings")
            .update({
              lat: coords.lat,
              lng: coords.lng,
              geocoded: true,
              // Also fix the stored location_name to be human-readable
              location_name: usedQuery ?? (locHint || null),
            })
            .eq("id", row.id);
          if (!upErr) updated++;
          else stillMissing++;
        } else {
          stillMissing++;
        }

        if (rowUsedRemote) await new Promise((r) => setTimeout(r, 1100));
      }

      return NextResponse.json({
        success: true,
        updated,
        still_missing: stillMissing,
        scanned: processed,
        total_missing_before: missing.length,
      });
    }

    // ── add_comment ───────────────────────────────────────────
    if (action === "add_comment") {
      const sightingId = body.sighting_id as string;
      const content = (body.content as string)?.trim();
      const authorName = ((body.author_name as string) ?? "Anonymous").slice(0, 40);

      if (!sightingId || !content || content.length < 2) {
        return NextResponse.json(
          { error: "sighting_id and content required" },
          { status: 400 }
        );
      }

      const { data: comment, error } = await admin
        .from("uap_sighting_comments")
        .insert({
          sighting_id: sightingId,
          author_name: authorName,
          author_fingerprint: userFp,
          content: content.slice(0, 1200),
        })
        .select()
        .single();

      if (error)
        return NextResponse.json({ error: error.message }, { status: 400 });
      return NextResponse.json({ comment, success: true });
    }

    // ── react (like/dislike comment) ──────────────────────────
    if (action === "react_comment") {
      const commentId = body.comment_id as string;
      const reaction = body.reaction as string;
      if (!commentId || !["like", "dislike"].includes(reaction)) {
        return NextResponse.json({ error: "invalid params" }, { status: 400 });
      }

      const { data: current } = await admin
        .from("uap_sighting_comments")
        .select("likes, dislikes")
        .eq("id", commentId)
        .single();

      if (reaction === "like") {
        await admin
          .from("uap_sighting_comments")
          .update({ likes: (current?.likes ?? 0) + 1 })
          .eq("id", commentId);
      } else {
        await admin
          .from("uap_sighting_comments")
          .update({ dislikes: (current?.dislikes ?? 0) + 1 })
          .eq("id", commentId);
      }
      return NextResponse.json({ success: true });
    }

    // ── upvote sighting ───────────────────────────────────────
    if (action === "upvote") {
      const sightingId = body.sighting_id as string;
      if (!sightingId)
        return NextResponse.json({ error: "sighting_id required" }, { status: 400 });

      const { data } = await admin
        .from("uap_sightings")
        .select("upvotes")
        .eq("id", sightingId)
        .single();
      await admin
        .from("uap_sightings")
        .update({ upvotes: (data?.upvotes ?? 0) + 1 })
        .eq("id", sightingId);

      return NextResponse.json({ success: true, upvotes: (data?.upvotes ?? 0) + 1 });
    }

    return NextResponse.json({ error: "unknown action" }, { status: 400 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
