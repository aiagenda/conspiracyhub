#!/usr/bin/env node
/**
 * Apply the PDF links resolved by scripts/browser/resolve-cia-legacy-pdfs.js.
 *
 * Usage: node scripts/import_cia_pdf_links.mjs <dir-or-file.jsonl>
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

function envValue(name) {
  for (const line of readFileSync(".env.local", "utf8").split("\n")) {
    if (line.startsWith(`${name}=`)) return line.slice(name.length + 1).trim().replace(/^[`"']|[`"']$/g, "");
  }
  return "";
}

const target = process.argv[2];
if (!target) { console.error("usage: node scripts/import_cia_pdf_links.mjs <dir-or-file.jsonl>"); process.exit(1); }
const files = statSync(target).isDirectory()
  ? readdirSync(target).filter((f) => f.endsWith(".jsonl")).map((f) => join(target, f))
  : [target];

const byId = new Map();
for (const file of files) {
  for (const line of readFileSync(file, "utf8").split("\n")) {
    if (!line.trim()) continue;
    const { id, pdf } = JSON.parse(line);
    if (id && pdf) byId.set(id, pdf.startsWith("http") ? pdf : `https://www.cia.gov${pdf}`);
  }
}
console.log(`${byId.size} resolved links from ${files.length} file(s)`);

const supabaseUrl = envValue("NEXT_PUBLIC_SUPABASE_URL");
const serviceKey = envValue("SUPABASE_SERVICE_KEY");
const rest = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` };

let written = 0;
for (const [id, pdf] of byId) {
  const canonical = `https://www.cia.gov/readingroom/document/${id}`;
  const res = await fetch(
    `${supabaseUrl}/rest/v1/reference_documents?canonical_url=eq.${encodeURIComponent(canonical)}&pdf_url=is.null`,
    {
      method: "PATCH",
      headers: { ...rest, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({ pdf_url: pdf }),
    },
  );
  if (!res.ok) { console.error(`  ${id}: ${res.status}`); continue; }
  if (++written % 100 === 0) console.log(`  patched ${written}/${byId.size}`);
}
console.log(`DONE — ${written} records patched`);
