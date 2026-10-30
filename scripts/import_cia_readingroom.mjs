#!/usr/bin/env node
/**
 * Import harvested CIA Electronic Reading Room records into reference_documents.
 *
 * The reading room cannot be crawled from a server: Akamai answers non-browser TLS
 * clients with a bot challenge and then 403s them. The records are collected in the
 * browser instead (see docs/cia-reading-room-harvest.md) and land here as JSONL —
 * one {id,title,snippet,topic} per line.
 *
 *   node scripts/import_cia_readingroom.mjs <dir-or-file> [--dry]
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_KEY;
if (!url || !key) {
  console.error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_KEY are required");
  process.exit(1);
}

const target = process.argv[2];
const dry = process.argv.includes("--dry");
if (!target) {
  console.error("usage: import_cia_readingroom.mjs <dir-or-file> [--dry]");
  process.exit(1);
}

const files = statSync(target).isDirectory()
  ? readdirSync(target).filter((f) => f.endsWith(".jsonl")).map((f) => join(target, f))
  : [target];

/** Document numbers of this shape have a predictable PDF; the numeric ids do not. */
function pdfUrl(id) {
  return /^cia-rdp[a-z0-9-]+$/i.test(id)
    ? `https://www.cia.gov/readingroom/docs/${id.toUpperCase()}.pdf`
    : null;
}

/** Snippets are search excerpts, so they carry the elision marks of the match context. */
function cleanExcerpt(text) {
  if (!text) return null;
  const trimmed = text.replace(/\s+/g, " ").replace(/\s*\.\.\.\s*/g, " … ").trim();
  return trimmed.length > 24 ? trimmed.slice(0, 500) : null;
}

const byUrl = new Map();
let read = 0;
for (const file of files) {
  for (const line of readFileSync(file, "utf8").split("\n")) {
    if (!line.trim()) continue;
    read += 1;
    let row;
    try { row = JSON.parse(line); } catch { continue; }
    const id = String(row.id || "").trim();
    const title = String(row.title || "").replace(/\s+/g, " ").trim();
    if (!id || !title) continue;
    const canonical = `https://www.cia.gov/readingroom/document/${id}`;
    const existing = byUrl.get(canonical);
    // Later files win only when they add an excerpt the earlier pass lacked.
    if (existing && (existing.excerpt || !cleanExcerpt(row.snippet))) continue;
    byUrl.set(canonical, {
      agency: "CIA",
      title: title.slice(0, 400),
      canonical_url: canonical,
      excerpt: cleanExcerpt(row.snippet),
      year: null,
      doc_id: id.toUpperCase(),
      collection: "CIA Electronic Reading Room",
      pdf_url: pdfUrl(id),
    });
  }
}

const rows = [...byUrl.values()];
console.log(`read ${read} lines from ${files.length} file(s) → ${rows.length} unique documents`);
if (dry) {
  console.log(JSON.stringify(rows.slice(0, 3), null, 2));
  process.exit(0);
}

let written = 0;
for (let i = 0; i < rows.length; i += 500) {
  const batch = rows.slice(i, i + 500);
  const res = await fetch(`${url}/rest/v1/reference_documents?on_conflict=canonical_url`, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      // Without on_conflict above, PostgREST treats this as a plain insert and the
      // unique constraint on canonical_url raises 23505 on the first repeat.
      Prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify(batch),
  });
  if (!res.ok) {
    console.error(`batch ${i}: ${res.status} ${await res.text()}`);
    process.exit(1);
  }
  written += batch.length;
  process.stdout.write(`\rupserted ${written}/${rows.length}`);
}
console.log(`\nDONE — ${written} documents upserted`);
