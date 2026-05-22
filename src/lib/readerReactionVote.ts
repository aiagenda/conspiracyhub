import type { SupabaseClient } from "@supabase/supabase-js";

/** Single row per fingerprint per target; value +1 / -1 (clear = delete row). */
export const READER_REACTION_VOTE_TYPE = "reader_reaction";

export type ReaderReactionStats = { score: number; up: number; down: number };

function hashSeed(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Deterministic baseline up/down so empty articles still look active (display-only). */
export function computeSeedReaction(
  itemId: string,
  relevanceScore = 50,
): Pick<ReaderReactionStats, "up" | "down"> {
  const h = hashSeed(itemId);
  const tier = relevanceScore >= 70 ? 2 : relevanceScore >= 50 ? 1 : 0;
  const upRanges: [number, number][] = [
    [3, 10],
    [6, 18],
    [12, 35],
  ];
  const downRanges: [number, number][] = [
    [0, 3],
    [1, 5],
    [2, 8],
  ];
  const [upMin, upMax] = upRanges[tier];
  const [downMin, downMax] = downRanges[tier];
  const up = upMin + (h % (upMax - upMin + 1));
  const down = downMin + ((h >>> 8) % (downMax - downMin + 1));
  return { up, down };
}

/** Merge real vote totals with display seed — real votes stack on top. */
export function displayReaderReaction(
  real: ReaderReactionStats | undefined,
  itemId: string,
  relevanceScore = 50,
): ReaderReactionStats {
  const base = real ?? { score: 0, up: 0, down: 0 };
  if (!itemId) return base;
  const seed = computeSeedReaction(itemId, relevanceScore);
  const up = base.up + seed.up;
  const down = base.down + seed.down;
  return { up, down, score: up - down };
}

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
