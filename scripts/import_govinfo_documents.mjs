#!/usr/bin/env node
/**
 * Import primary sources from GovInfo (US Government Publishing Office) into
 * `reference_documents`.
 *
 * Searches are scoped to the TITLE field. A full-text search for "MKULTRA" returns
 * anything that merely mentions it — unrelated court filings included — while
 * `title:MKULTRA` returns the 1977 Senate hearing itself. Precision matters more than
 * volume here: this index is the one part of the site made entirely of primary sources.
 *
 * Usage: node scripts/import_govinfo_documents.mjs [--dry-run] [--per-topic N]
 */
import { readFileSync } from "node:fs";

const API = "https://api.govinfo.gov";

function envValue(name) {
  for (const line of readFileSync(".env.local", "utf8").split("\n")) {
    if (line.startsWith(`${name}=`)) return line.slice(name.length + 1).trim().replace(/^[`"']|[`"']$/g, "");
  }
  return "";
}

/** Title terms per beat. Quoted phrases stay phrases. */
const TOPICS = [
  ["MKULTRA", "CIA"], ["COINTELPRO", "FBI"], ["\"Church Committee\"", "CONGRESS"],
  ["\"Operation Paperclip\"", "ARCHIVES"], ["\"Iran-Contra\"", "CONGRESS"],
  ["\"assassination records\"", "NARA"], ["\"Warren Commission\"", "NARA"],
  ["\"intelligence activities\"", "CONGRESS"], ["\"covert action\"", "CIA"],
  ["\"intelligence oversight\"", "CONGRESS"], ["\"classified information\"", "CONGRESS"],
  ["\"declassification\"", "NARA"], ["\"Freedom of Information Act\"", "CONGRESS"],
  ["\"inspector general\"", "GAO"], ["whistleblower", "CONGRESS"],
  ["\"Foreign Intelligence Surveillance\"", "CONGRESS"], ["\"Section 702\"", "CONGRESS"],
  ["\"warrantless surveillance\"", "CONGRESS"], ["\"domestic surveillance\"", "CONGRESS"],
  ["\"electronic surveillance\"", "CONGRESS"], ["\"USA PATRIOT Act\"", "CONGRESS"],
  ["\"facial recognition\"", "CONGRESS"], ["\"cell-site simulator\"", "CONGRESS"],
  ["\"data broker\"", "CONGRESS"], ["\"privacy and civil liberties\"", "CONGRESS"],
  ["\"unidentified aerial phenomena\"", "DOD"], ["\"unidentified anomalous phenomena\"", "DOD"],
  ["\"unidentified flying\"", "DOD"], ["\"Project Blue Book\"", "DOD"],
  ["\"biological weapons\"", "DOD"], ["\"chemical weapons\"", "DOD"],
  ["\"gain of function\"", "NIH"], ["\"human experimentation\"", "DOE"],
  ["\"human radiation experiments\"", "DOE"], ["\"Tuskegee\"", "NIH"],
  ["\"select agent\"", "CDC"], ["bioterrorism", "CDC"], ["\"public health emergency\"", "CDC"],
  ["\"artificial intelligence\"", "NIST"], ["\"algorithmic accountability\"", "CONGRESS"],
  ["\"autonomous weapons\"", "DOD"], ["\"export controls\"", "TREASURY"],
  ["\"critical infrastructure\"", "CISA"], ["cybersecurity", "CISA"],
  ["\"nuclear weapons\"", "DOE"], ["\"government ethics\"", "GAO"],
  ["\"lobbying disclosure\"", "CONGRESS"], ["\"campaign finance\"", "CONGRESS"],
];

/** Readable source label per GovInfo collection. */
const COLLECTION_LABEL = {
  CHRG: "Congressional hearing", CRPT: "Congressional report", CPRT: "Committee print",
  CDOC: "Congressional document", SERIALSET: "Congressional Serial Set",
  GAOREPORTS: "GAO report", USCOURTS: "Federal court opinion", FR: "Federal Register notice",
  USCODE: "United States Code", CFR: "Code of Federal Regulations", BILLS: "Congressional bill",
  GOVPUB: "Government publication", CRECB: "Congressional Record", COMPS: "Statute compilation",
};

async function search(key, query, pageSize) {
  const res = await fetch(`${API}/search?api_key=${key}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, pageSize, offsetMark: "*", sorts: [{ field: "score", sortOrder: "DESC" }] }),
  });
  if (!res.ok) throw new Error(`GovInfo ${res.status} for ${query}`);
  return (await res.json()).results ?? [];
}

function toDocument(row, fallbackAgency) {
  const packageId = row.packageId;
  if (!packageId || !row.title) return null;
  const collection = String(row.collectionCode ?? "").split(";")[0];
  const label = COLLECTION_LABEL[collection] ?? "Government publication";
  const authors = Array.isArray(row.governmentAuthor) ? row.governmentAuthor.filter(Boolean) : [];
  const year = row.dateIssued ? Number(String(row.dateIssued).slice(0, 4)) : null;

  // Collection decides the agency where it is unambiguous; otherwise keep the beat's own
  // label so a reader filtering by CIA still finds the CIA hearings.
  const agency =
    collection === "GAOREPORTS" ? "GAO" :
    collection === "USCOURTS" ? "COURTS" :
    collection === "FR" || collection === "CFR" ? "FEDREG" :
    ["CHRG", "CRPT", "CPRT", "CDOC", "SERIALSET", "CRECB", "BILLS"].includes(collection) ? "CONGRESS" :
    fallbackAgency;

  return {
    agency,
    title: String(row.title).replace(/\s+/g, " ").trim().slice(0, 300),
    canonical_url: `https://www.govinfo.gov/app/details/${packageId}`,
    excerpt: [label, authors.join(" · "), row.dateIssued ? `issued ${row.dateIssued}` : ""]
      .filter(Boolean).join(" — ").slice(0, 400),
    year: Number.isFinite(year) ? year : null,
  };
}

const key = envValue("GOVINFO_API_KEY");
if (!key) { console.error("GOVINFO_API_KEY missing from .env.local"); process.exit(1); }
const supabaseUrl = envValue("NEXT_PUBLIC_SUPABASE_URL");
const serviceKey = envValue("SUPABASE_SERVICE_KEY");

const dryRun = process.argv.includes("--dry-run");
const perTopicIdx = process.argv.indexOf("--per-topic");
const perTopic = perTopicIdx > -1 ? Number(process.argv[perTopicIdx + 1]) : 15;

const existing = new Set();
if (!dryRun) {
  const res = await fetch(`${supabaseUrl}/rest/v1/reference_documents?select=canonical_url`, {
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
  });
  for (const row of await res.json()) existing.add(row.canonical_url);
  console.log(`already in the index: ${existing.size}`);
}

const byUrl = new Map();
// Same title in the same year is the same document reaching us twice — typically the
// House and Senate copies of one Congressional Record item. A bill reintroduced in a
// later Congress keeps its own entry, because that is a different document.
const seenTitleYear = new Set();
for (const [term, agency] of TOPICS) {
  try {
    const rows = await search(key, `title:(${term})`, perTopic);
    let kept = 0;
    for (const row of rows) {
      const doc = toDocument(row, agency);
      if (!doc || existing.has(doc.canonical_url) || byUrl.has(doc.canonical_url)) continue;
      const titleYear = `${doc.title.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()}|${doc.year ?? ""}`;
      if (seenTitleYear.has(titleYear)) continue;
      seenTitleYear.add(titleYear);
      byUrl.set(doc.canonical_url, doc);
      kept++;
    }
    console.log(`  ${term.padEnd(38)} ${String(rows.length).padStart(3)} hits → ${kept} new`);
  } catch (e) {
    console.warn(`  ${term}: ${e.message}`);
  }
}

const documents = [...byUrl.values()];
console.log(`\n${documents.length} new documents collected`);
if (dryRun) {
  for (const d of documents.slice(0, 10)) console.log(`  [${d.agency}] ${d.year ?? "----"} ${d.title.slice(0, 70)}`);
  process.exit(0);
}

let inserted = 0;
for (let i = 0; i < documents.length; i += 100) {
  const chunk = documents.slice(i, i + 100);
  const res = await fetch(`${supabaseUrl}/rest/v1/reference_documents?on_conflict=canonical_url`, {
    method: "POST",
    headers: {
      apikey: serviceKey, Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
      Prefer: "resolution=ignore-duplicates,return=representation",
    },
    body: JSON.stringify(chunk),
  });
  const out = await res.json();
  if (!res.ok) { console.error("insert failed:", JSON.stringify(out).slice(0, 200)); break; }
  inserted += out.length;
  console.log(`  inserted ${inserted}/${documents.length}`);
}
console.log(`DONE — ${inserted} documents added`);
