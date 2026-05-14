import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import FeedScreen, { type FeedPagination } from "@/components/FeedScreen";
import { loadReaderReactionsForNewsIds } from "@/lib/readerReactionVote";
import { omitIfHungarianScript } from "@/lib/locale";
import type { NewsItem } from "@/types";

export const revalidate = 900;

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://conspiracyhub.vercel.app";

export async function generateMetadata({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}): Promise<Metadata> {
  const sp = (await searchParams) ?? {};
  const page = parsePage(sp.page);
  const canonical = page <= 1 ? SITE_URL : `${SITE_URL}/?page=${page}`;
  return {
    alternates: {
      canonical,
      ...(page > 1 ? { prev: page === 2 ? SITE_URL : `${SITE_URL}/?page=${page - 1}` } : {}),
    },
    ...(page > 1
      ? {
          title: `Feed — Page ${page}`,
          robots: { index: false, follow: true },
        }
      : {}),
  };
}

const PAGE_SIZE = 12;

/** Returns an ISO cutoff string 7 days in the past. Extracted from the component to satisfy purity rules. */
function sevenDaysAgo(): string {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  return d.toISOString();
}

function parsePage(raw: string | string[] | undefined): number {
  const s = Array.isArray(raw) ? raw[0] : raw;
  const n = parseInt(String(s ?? "1"), 10);
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1;
}

export default async function Home({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = (await searchParams) ?? {};
  const requestedPage = parsePage(sp.page);

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) {
    return <FeedScreen initialItems={[]} feedNotice="missing_supabase_env" />;
  }
  const supabase = createClient(url, key);
  const cutoff = sevenDaysAgo();

  const { count: countSeven } = await supabase
    .from("news_items")
    .select("*", { count: "exact", head: true })
    .gte("published_at", cutoff);

  const sevenDayTotal = countSeven ?? 0;
  const useSevenDayWindow = sevenDayTotal > 0;

  let totalCount = sevenDayTotal;
  if (!useSevenDayWindow) {
    const { count: countAll } = await supabase.from("news_items").select("*", { count: "exact", head: true });
    totalCount = countAll ?? 0;
  }

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const currentPage = Math.min(requestedPage, totalPages);
  if (totalCount > 0 && requestedPage !== currentPage) {
    redirect(currentPage <= 1 ? "/" : `/?page=${currentPage}`);
  }
  const from = (currentPage - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  let q = supabase.from("news_items").select("*");
  if (useSevenDayWindow) {
    q = q.gte("published_at", cutoff).order("published_at", { ascending: false }).order("score", { ascending: false });
  } else {
    q = q.order("published_at", { ascending: false });
  }

  const { data } = await q.range(from, to);

  const rowIds = (data ?? []).map((row) => row.id as string);
  const reactions = await loadReaderReactionsForNewsIds(supabase, rowIds);

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
      reader_reaction: reactions[row.id as string],
    })) ?? [];

  const feedPagination: FeedPagination | undefined =
    totalCount > 0
      ? { page: currentPage, pageSize: PAGE_SIZE, totalCount, totalPages }
      : undefined;

  return (
    <FeedScreen
      initialItems={items}
      feedNotice={items.length === 0 ? "empty_database" : undefined}
      feedPagination={feedPagination}
    />
  );
}
