#!/usr/bin/env npx tsx
/**
 * Backfill SEO rewrites for high-score feed articles missing body_html.
 * Usage: npm run rewrite:news [--limit=5]
 */
import { createClient } from "@supabase/supabase-js";
import { loadPendingRewriteCandidates, rewriteNewsItemsBatch } from "@/lib/server/newsArticleRewrite";

async function main() {
  const limitArg = process.argv.find((a) => a.startsWith("--limit="));
  const limit = limitArg ? parseInt(limitArg.split("=")[1] ?? "5", 10) : 5;
  const force = process.argv.includes("--force");

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  const openAiKey = process.env.OPENAI_API_KEY;
  if (!url || !key || !openAiKey) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_KEY, or OPENAI_API_KEY");
    process.exit(1);
  }

  const admin = createClient(url, key);

  if (force) {
    const { data: rows } = await admin
      .from("news_items")
      .select("id")
      .eq("rewrite_status", "ready")
      .order("published_at", { ascending: false })
      .limit(limit);
    const ids = (rows ?? []).map((r) => r.id);
    if (ids.length) {
      await admin.from("news_items").update({ rewrite_status: "pending", body_html: null }).in("id", ids);
      console.log(`Reset ${ids.length} ready article(s) for re-rewrite.`);
    }
  }

  const rows = await loadPendingRewriteCandidates(admin, limit);
  if (!rows.length) {
    console.log("No pending rewrite candidates.");
    return;
  }

  console.log(`Rewriting ${rows.length} article(s)...`);
  const stats = await rewriteNewsItemsBatch(admin, openAiKey, rows, limit);
  console.log(JSON.stringify(stats, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
