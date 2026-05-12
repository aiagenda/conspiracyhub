import { createClient } from "@supabase/supabase-js";
import FeedScreen from "@/components/FeedScreen";
import { omitIfHungarianScript } from "@/lib/locale";
import type { NewsItem } from "@/types";

export const revalidate = 900;

/** Returns an ISO cutoff string 7 days in the past. Extracted from the component to satisfy purity rules. */
function sevenDaysAgo(): string {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  return d.toISOString();
}

export default async function Home() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) {
    return <FeedScreen initialItems={[]} feedNotice="missing_supabase_env" />;
  }
  const supabase = createClient(url, key);
  // Show articles from the last 7 days sorted by freshest first.
  const cutoff = sevenDaysAgo();
  let { data } = await supabase
    .from("news_items")
    .select("*")
    .gte("published_at", cutoff)
    .order("published_at", { ascending: false })
    .order("score", { ascending: false })
    .limit(200);
  if (!data || data.length === 0) {
    ({ data } = await supabase.from("news_items").select("*").order("published_at", { ascending: false }).limit(100));
  }

  const items: NewsItem[] =
    (data ?? []).map((row) => ({
      id: row.id,
      guardian_id: row.guardian_id,
      title: row.title,
      summary: row.summary ?? "",
      url: row.url,
      image: row.image ?? null,
      date: row.published_at,
      section: row.section,
      score: row.score ?? 0,
      angle: omitIfHungarianScript(row.angle ?? ""),
    })) ?? [];

  return (
    <FeedScreen
      initialItems={items}
      feedNotice={items.length === 0 ? "empty_database" : undefined}
    />
  );
}
