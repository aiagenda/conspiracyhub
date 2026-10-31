#!/usr/bin/env node
/**
 * Fill in `pdf_url` for records that only carry a landing page.
 *
 * A reader searching for "remote viewing" wants the scan, not the custodian's
 * record page with the scan linked from it. GovInfo serves every package's PDF at
 * a predictable path, so the link can be derived — but only derived links that
 * actually answer with a PDF are stored, because a package that has no
 * package-level PDF answers 200 with the site's HTML shell instead.
 *
 * Usage: node scripts/backfill_pdf_links.mjs [--dry-run] [--limit N]
 */
import { readFileSync } from "node:fs";

function envValue(name) {
  for (const line of readFileSync(".env.local", "utf8").split("\n")) {
    if (line.startsWith(`${name}=`)) return line.slice(name.length + 1).trim().replace(/^[`"']|[`"']$/g, "");
  }
  return "";
}

/** The PDF a record's own custodian publishes, or null when we cannot name it. */
function candidatePdf(canonicalUrl) {
  const govinfo = canonicalUrl.match(/^https:\/\/www\.govinfo\.gov\/app\/details\/([^/?#]+)/);
  if (govinfo) {
    const pkg = govinfo[1];
    return `https://www.govinfo.gov/content/pkg/${pkg}/pdf/${pkg}.pdf`;
  }
  return null;
}

/** One byte is enough: it is the content type that says whether the link is real. */
async function servesPdf(url) {
  try {
    const res = await fetch(url, { headers: { Range: "bytes=0-0" }, redirect: "follow" });
    return res.ok && (res.headers.get("content-type") ?? "").includes("application/pdf");
  } catch {
    return false;
  }
}

const supabaseUrl = envValue("NEXT_PUBLIC_SUPABASE_URL");
const serviceKey = envValue("SUPABASE_SERVICE_KEY");
if (!supabaseUrl || !serviceKey) { console.error("Supabase credentials missing from .env.local"); process.exit(1); }
const rest = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` };

const dryRun = process.argv.includes("--dry-run");
const limitIdx = process.argv.indexOf("--limit");
const limit = limitIdx > -1 ? Number(process.argv[limitIdx + 1]) : Infinity;

// PostgREST caps an unranged select at 1000 rows.
const rows = [];
for (let from = 0; ; from += 1000) {
  const res = await fetch(
    `${supabaseUrl}/rest/v1/reference_documents?select=id,canonical_url&pdf_url=is.null&order=id`,
    { headers: { ...rest, Range: `${from}-${from + 999}` } },
  );
  const page = await res.json();
  if (!Array.isArray(page) || page.length === 0) break;
  rows.push(...page);
  if (page.length < 1000) break;
}

const candidates = rows
  .map((row) => ({ id: row.id, url: candidatePdf(row.canonical_url), canonical: row.canonical_url }))
  .filter((row) => row.url)
  .slice(0, limit);
console.log(`${rows.length} records without a PDF, ${candidates.length} with a derivable link`);

let checked = 0, found = 0, written = 0;
const updates = [];
const workers = Array.from({ length: 8 }, async () => {
  for (;;) {
    const row = candidates[checked++];
    if (!row) return;
    if (await servesPdf(row.url)) { found++; updates.push(row); }
    if (checked % 100 === 0) console.log(`  checked ${checked}/${candidates.length}, ${found} real PDFs`);
  }
});
await Promise.all(workers);
console.log(`${found} of ${candidates.length} links serve a PDF`);

if (dryRun) {
  for (const row of updates.slice(0, 10)) console.log(`  ${row.canonical}\n    → ${row.url}`);
  process.exit(0);
}

for (const row of updates) {
  const res = await fetch(`${supabaseUrl}/rest/v1/reference_documents?id=eq.${row.id}`, {
    method: "PATCH",
    headers: { ...rest, "Content-Type": "application/json", Prefer: "return=minimal" },
    body: JSON.stringify({ pdf_url: row.url }),
  });
  if (!res.ok) { console.error(`  update failed for ${row.id}: ${res.status}`); continue; }
  if (++written % 200 === 0) console.log(`  updated ${written}/${updates.length}`);
}
console.log(`DONE — ${written} records now link straight to the document`);
