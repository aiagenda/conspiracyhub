import type { SupabaseClient } from "@supabase/supabase-js";

/** Single row per fingerprint per target; value +1 / -1 (clear = delete row). */
export const READER_REACTION_VOTE_TYPE = "reader_reaction";

export type ReaderReactionStats = { score: number; up: number; down: number };

export function aggregateReactionValues(values: number[]): ReaderReactionStats {
  let score = 0;
  let up = 0;
  let down = 0;
  for (const v of values) {
    if (v === 1) {
      score += 1;
      up += 1;
    } else if (v === -1) {
      score -= 1;
      down += 1;
    }
  }
  return { score, up, down };
}

export async function loadReaderReactionsForNewsIds(
  admin: SupabaseClient,
  ids: string[],
): Promise<Record<string, ReaderReactionStats>> {
  const out: Record<string, ReaderReactionStats> = {};
  if (ids.length === 0) return out;
  for (const id of ids) out[id] = { score: 0, up: 0, down: 0 };
  const { data } = await admin
    .from("votes")
    .select("article_id,value")
    .eq("vote_type", READER_REACTION_VOTE_TYPE)
    .in("article_id", ids);
  const buckets: Record<string, number[]> = {};
  for (const id of ids) buckets[id] = [];
  for (const row of data ?? []) {
    const aid = row.article_id as string | null;
    if (aid && typeof row.value === "number") buckets[aid]?.push(row.value);
  }
  for (const id of ids) out[id] = aggregateReactionValues(buckets[id] ?? []);
  return out;
}

export async function loadReaderReactionsForGeneratedIds(
  admin: SupabaseClient,
  ids: string[],
): Promise<Record<string, ReaderReactionStats>> {
  const out: Record<string, ReaderReactionStats> = {};
  if (ids.length === 0) return out;
  for (const id of ids) out[id] = { score: 0, up: 0, down: 0 };
  const { data } = await admin
    .from("votes")
    .select("generated_article_id,value")
    .eq("vote_type", READER_REACTION_VOTE_TYPE)
    .in("generated_article_id", ids);
  const buckets: Record<string, number[]> = {};
  for (const id of ids) buckets[id] = [];
  for (const row of data ?? []) {
    const gid = row.generated_article_id as string | null;
    if (gid && typeof row.value === "number") buckets[gid]?.push(row.value);
  }
  for (const id of ids) out[id] = aggregateReactionValues(buckets[id] ?? []);
  return out;
}
