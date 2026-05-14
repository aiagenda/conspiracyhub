import { callOpenAIJSON } from "@/lib/openai";
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

const SYSTEM_THEORIES_RETRY = `You output ONLY valid JSON: {"theories":[ ... ]}.

Each theory object must include:
- name: non-empty string — the real name of a conspiracy theory or well-documented critical narrative
- summary: string (2-4 sentences)
- full_explanation: string
- evidence: array of strings (specific points people cite)
- counter_evidence: array of strings (mainstream pushback)
- sources: array of https URLs you are confident exist; each must be a **specific** page (non-empty path, query, or hash), not only the domain root — omit entries rather than using a homepage
- key_people: array of strings
- probability: number 0-100
- timeline: array of { "date": string, "event": string }

Rules:
- Minimum 1 theory, maximum 5.
- English only. Do not invent theory names.
- Never return "theories": [].

Return ONLY the JSON object, no markdown.`;

/**
 * Oracle board expects at least one theory. If the main response has none,
 * one follow-up call fills only the theories array (cheap vs re-running full graph).
 */
export async function ensureOracleTheoriesAtLeastOne(
  analysis: OracleAnalysis,
  articleLine: string,
  opts: { apiKey: string; model?: string; maxTokens?: number }
): Promise<OracleAnalysis> {
  const normalized = normalizeOracleTheories(analysis.theories);
  if (normalized.length > 0) {
    return { ...analysis, theories: normalized.slice(0, 5) };
  }

  const mini = await callOpenAIJSON<{ theories: OracleTheory[] }>({
    apiKey: opts.apiKey,
    system: SYSTEM_THEORIES_RETRY,
    user: `${articleLine}\n\nReturn only {"theories":[...]} with at least one real theory related to this article.`,
    maxTokens: opts.maxTokens ?? 3500,
    maxAttempts: 3,
    model: opts.model ?? "gpt-4o-mini",
  });

  const fixed = normalizeOracleTheories(mini.theories);
  if (fixed.length === 0) {
    throw new Error("oracle_no_theories");
  }
  return { ...analysis, theories: fixed.slice(0, 5) };
}
