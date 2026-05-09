import { createClient } from "@supabase/supabase-js";
import FeedScreen from "@/components/FeedScreen";
import { omitIfHungarianScript } from "@/lib/locale";
import type { NewsItem } from "@/types";

export const revalidate = 1800;

export default async function Home() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) {
    return <FeedScreen initialItems={[]} />;
  }
  const supabase = createClient(url, key);
  const { data } = await supabase.from("news_items").select("*").order("score", { ascending: false }).limit(50);

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

  return <FeedScreen initialItems={items} />;
}
