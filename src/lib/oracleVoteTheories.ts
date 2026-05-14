/** Shapes stored `oracle_analyses.theories` JSON for `VotePanel` props. */
export type VoteTheoryChip = { name: string; probability: number };

export function voteTheoriesFromOracleJson(theories: unknown): VoteTheoryChip[] {
  if (!Array.isArray(theories)) return [];
  const out: VoteTheoryChip[] = [];
  for (const t of theories) {
    if (!t || typeof t !== "object") continue;
    const o = t as Record<string, unknown>;
    const name = typeof o.name === "string" ? o.name.trim() : "";
    if (!name) continue;
    const raw = o.probability;
    const p =
      typeof raw === "number" && Number.isFinite(raw)
        ? Math.round(raw)
        : typeof raw === "string" && Number.isFinite(Number(raw))
          ? Math.round(Number(raw))
          : 50;
    out.push({ name, probability: Math.max(0, Math.min(100, p)) });
    if (out.length >= 5) break;
  }
  return out;
}
