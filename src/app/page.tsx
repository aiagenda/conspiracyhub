import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { Suspense } from "react";
import FeedScreen from "@/components/FeedScreen";
import { loadReaderReactionsForNewsIds } from "@/lib/readerReactionVote";
import { getFeedMinScore } from "@/lib/feedMinScore";
import { omitIfHungarianScript } from "@/lib/locale";
import { TOPICS } from "@/lib/topics";
import { getSiteUrl } from "@/lib/siteUrl";
import type { NewsItem } from "@/types";
export const revalidate = 900;
const PAGE_SIZE = 12;
type Query = Record<string, string | string[] | undefined>;
const single = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;
function filters(sp: Query) {
  const rawPage = Number(single(sp.page) ?? 1);
  return {
    page: Number.isSafeInteger(rawPage) && rawPage > 0 ? rawPage : 1,
    sort: single(sp.sort) === "priority" ? "priority" as const : "latest" as const,
    topic: TOPICS.find(t => t.slug === single(sp.topic)),
    range: single(sp.range) === "all" ? "all" as const : "week" as const,
  };
}
function feedUrl(input: ReturnType<typeof filters>, page = input.page) {
  const params = new URLSearchParams();
  if (input.sort === "priority") params.set("sort", input.sort);
  if (input.topic) params.set("topic", input.topic.slug);
  if (input.range === "all") params.set("range", input.range);
  if (page > 1) params.set("page", String(page));
  return params.size ? `/?${params}` : "/";
}
export async function generateMetadata({ searchParams }: { searchParams?: Promise<Query> }): Promise<Metadata> {
  const input = filters((await searchParams) ?? {});
  return { alternates: { canonical: `${getSiteUrl()}${feedUrl(input)}` }, ...(input.page > 1 || input.topic || input.sort !== "latest" || input.range !== "week" ? { robots: { index: false, follow: true } } : {}) };
}
export default async function Home({ searchParams }: { searchParams?: Promise<Query> }) {
  const input = filters((await searchParams) ?? {});
  const feedProps = { sort: input.sort, topic: input.topic?.slug ?? "", range: input.range };
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) return <Suspense fallback={null}><FeedScreen initialItems={[]} feedNotice="missing_supabase_env" {...feedProps} /></Suspense>;
  const supabase = createClient(url, key);
  // Server request time scopes the feed, not client rendering.
  // eslint-disable-next-line react-hooks/purity
  const cutoff = new Date(Date.now() - 7 * 86400000).toISOString();
  const minScore = getFeedMinScore();
  // Apply the same scope to the count and rows. Sorting happens BEFORE pagination.
  function scopedQuery(countOnly = false) {
    // Only finished work is listed. An item without a rewrite has no article of our own
    // behind it — it would open on the publisher's summary and a link out, which is not
    // something to surface as a story in the feed.
    let query = supabase
      .from("news_items")
      .select("*", { count: "exact", head: countOnly })
      .gte("score", minScore)
      .eq("rewrite_status", "ready");
    if (input.range === "week") query = query.gte("published_at", cutoff);
    if (input.topic) query = query.in("section", [...input.topic.sections]);
    return query;
  }
  const countResult = await scopedQuery(true);
  if (countResult.error) return <Suspense fallback={null}><FeedScreen initialItems={[]} feedNotice="load_error" {...feedProps} /></Suspense>;
  const totalCount = countResult.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const page = Math.min(input.page, totalPages);
  if (input.page !== page) redirect(feedUrl(input, page));
  let query = scopedQuery();
  query = input.sort === "priority" ? query.order("score", { ascending: false }).order("published_at", { ascending: false }) : query.order("published_at", { ascending: false }).order("score", { ascending: false });
  const { data, error } = await query.order("id", { ascending: true }).range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  const reactions = await loadReaderReactionsForNewsIds(supabase, (data ?? []).map(row => row.id as string));
  const items: NewsItem[] = (data ?? []).map(row => ({ id: row.id, guardian_id: row.guardian_id, title: row.title, summary: omitIfHungarianScript(row.summary ?? ""), url: row.url, image: row.image ?? null, date: row.published_at, section: row.section, score: row.score ?? 0, angle: omitIfHungarianScript(row.angle ?? ""), source: row.source ?? undefined, reader_reaction: reactions[row.id as string] }));
  return <Suspense fallback={null}><FeedScreen initialItems={items} feedNotice={error ? "load_error" : items.length ? undefined : "empty_database"} feedPagination={{ page, pageSize: PAGE_SIZE, totalCount, totalPages }} {...feedProps} /></Suspense>;
}
