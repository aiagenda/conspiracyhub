/**
 * One-off: expand the most-viewed short blog posts in place.
 * Usage: npx tsx --env-file=.env.local scripts/expand-top-short.ts [limit]
 */
import { createClient } from "@supabase/supabase-js";
import { countArticleWords } from "../src/lib/server/articleExpand";
import { runExpandExistingArticleCore } from "../src/lib/server/generateArticleCore";

const limit = Math.min(10, Math.max(1, parseInt(process.argv[2] ?? "3", 10)));
const maxWords = 1000;

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) throw new Error("Missing Supabase env");

  const admin = createClient(url, key);
  const { data: rows, error } = await admin
    .from("generated_articles")
    .select("id, slug, title, content")
    .eq("status", "published");
  if (error) throw error;

  const { data: pvs } = await admin.from("page_views").select("path, fingerprint").like("path", "/blog/%");
  const views = new Map<string, Set<string>>();
  for (const pv of pvs ?? []) {
    if (!views.has(pv.path)) views.set(pv.path, new Set());
    views.get(pv.path)!.add(pv.fingerprint);
  }

  const candidates = (rows ?? [])
    .map((r) => ({
      id: r.id,
      title: r.title,
      slug: r.slug,
      words: countArticleWords(r.content ?? ""),
      viewers: views.get(`/blog/${r.slug}`)?.size ?? 0,
    }))
    .filter((r) => r.words < maxWords && r.viewers > 0)
    .sort((a, b) => b.viewers - a.viewers)
    .slice(0, limit);

  if (!candidates.length) {
    console.log("No short posts with views to expand.");
    return;
  }

  console.log(`Expanding ${candidates.length} posts…`);
  for (const c of candidates) {
    console.log(`\n→ ${c.title} (${c.words} w, ${c.viewers} readers)`);
    const { status, payload } = await runExpandExistingArticleCore(c.id);
    console.log(status, JSON.stringify(payload, null, 2));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
