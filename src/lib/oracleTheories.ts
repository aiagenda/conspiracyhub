import type { OracleAnalysis, OracleTheory } from "@/types";

/** Keep only theory objects with a usable display name. */
export function normalizeOracleTheories(raw: unknown): OracleTheory[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((t): t is OracleTheory => {
    if (!t || typeof t !== "object") return false;
    const name = (t as OracleTheory).name;
    return typeof name === "string" && name.trim().length > 0;
  }) as OracleTheory[];
}

/** Compatibility name: empty theories are valid and never trigger invented filler. */
export async function ensureOracleTheoriesAtLeastOne(
  analysis: OracleAnalysis,
  articleLine: string,
  opts: { apiKey: string; model?: string; maxTokens?: number },
): Promise<OracleAnalysis> {
  void articleLine; void opts;
  return { ...analysis, theories: normalizeOracleTheories(analysis.theories).slice(0, 5) };
}
