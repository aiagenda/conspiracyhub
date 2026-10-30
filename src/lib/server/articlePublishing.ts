import type { SupabaseClient } from "@supabase/supabase-js";
import { canonicalSourceUrl, type EditorialChecks } from "@/lib/editorialQuality";
import { sameStoryTitle, storySlug, storyTopicKey } from "@/lib/server/storyIdentity";

/** Stable story identity and legacy title/source checks; existing editorial work is never overwritten. */
export async function findExistingStory(admin: SupabaseClient, topic: string, primaryUrl?: string) {
  const slug = storySlug(topic, primaryUrl);
  const { data: exact, error } = await admin.from("generated_articles").select("id,title,slug,status").eq("slug", slug).maybeSingle();
  if (error) throw new Error(error.message);
  if (exact) return exact;
  const { data: candidates, error: queryError } = await admin.from("generated_articles")
    .select("id,title,slug,status,focus_keyword,sources").order("created_at", { ascending: false }).limit(1000);
  if (queryError) throw new Error(queryError.message);
  const topicKey = storyTopicKey(topic);
  return (candidates ?? []).find((row) => sameStoryTitle(row.title, topic) || sameStoryTitle(row.focus_keyword || "", topic)
    || (topicKey !== null && (storyTopicKey(row.title) === topicKey || storyTopicKey(row.focus_keyword || "") === topicKey))
    || (primaryUrl && Array.isArray(row.sources) && row.sources.some((source: { url?: string }) => canonicalSourceUrl(source.url || "") === canonicalSourceUrl(primaryUrl)))) ?? null;
}

/** Older databases retain generated work as a draft until the quality migration is applied. */
export async function saveReviewedArticle(admin: SupabaseClient, row: Record<string, unknown>, checks: EditorialChecks) {
  let result = await admin.from("generated_articles").insert(row).select().single();
  if (result.error && /editorial_checks|source_published_at|verified_at|updated_at|faqs/i.test(result.error.message)) {
    const base = { ...row };
    for (const key of ["editorial_checks", "source_published_at", "verified_at", "updated_at"]) delete base[key];
    if (/faqs/i.test(result.error.message)) delete base.faqs;
    base.status = "draft";
    console.warn("[editorial] Migration missing; preserving draft", { issues: checks.issues, passed: checks.passed });
    result = await admin.from("generated_articles").insert(base).select().single();
  }
  if (result.error?.code === "23505") {
    // A concurrent worker won. Return its unchanged record, never upsert generated prose.
    return admin.from("generated_articles").select().eq("slug", row.slug).single();
  }
  return result;
}
