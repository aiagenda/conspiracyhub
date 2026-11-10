import { callOpenAIJSON, ORACLE_MODEL } from "@/lib/openai";
import { ensureOracleTheoriesAtLeastOne } from "@/lib/oracleTheories";
import { SYSTEM_ORACLE } from "@/lib/prompts";
import { createSourceUrlAllowlist, mergeUrlSeeds, type SourceUrlAllowlist } from "@/lib/sourceUrlAllowlist";
import { layoutOracleNodes } from "@/lib/oracleLayout";
import { gatherOracleEvidence, type OracleEvidence } from "@/lib/server/oracleEvidence";
import type { OracleAnalysis } from "@/types";

export type OracleGraphResult = {
  analysis: OracleAnalysis;
  allow: SourceUrlAllowlist;
  evidence: OracleEvidence;
};

/**
 * Retrieve evidence, then draw the graph from it.
 *
 * Both Oracle entry points — the `/api/oracle` pipeline and `/api/analyze-url` — used to
 * carry their own copy of this sequence, which is how one of them kept an `ensureTheories`
 * call the other had dropped. They share it now, so an improvement to the graph reaches
 * both and the retrieval stage cannot be enabled in one place only.
 *
 * Ordering is the point. The evidence is gathered first so the model reads it before
 * deciding what connects to what, and the citation allowlist is built from the seeds *plus*
 * what was retrieved — without that, an edge between two entities has no citable source and
 * `applyToOracleAnalysis` strips it, which is exactly why 71% of the stored analyses have
 * no entity-to-entity link at all.
 */
export async function buildOracleGraph(params: {
  apiKey: string;
  /** Story title, used as the search topic when entity extraction returns none. */
  title: string;
  /** The article block the model analyses (title, summary/body, URL). */
  articleLine: string;
  seedUrls: string[];
  maxTokens?: number;
  maxAttempts?: number;
  freshness?: "pd" | "pw" | "pm" | "py" | null;
}): Promise<OracleGraphResult> {
  const { apiKey, title, articleLine, seedUrls, maxTokens = 8192, maxAttempts = 4, freshness = null } = params;

  const evidence = await gatherOracleEvidence({ apiKey, title, articleLine, seedUrls, freshness });

  const allow = createSourceUrlAllowlist(mergeUrlSeeds(seedUrls, evidence.allowUrls));
  const user = articleLine + evidence.promptBlock + allow.promptBlock;

  const raw = await callOpenAIJSON<OracleAnalysis>({
    apiKey,
    system: SYSTEM_ORACLE,
    user,
    maxTokens,
    model: ORACLE_MODEL,
    maxAttempts,
  });

  const merged = await ensureOracleTheoriesAtLeastOne(raw, user, { apiKey });
  const analysis = allow.applyToOracleAnalysis(merged);

  return {
    analysis: { ...analysis, nodes: layoutOracleNodes(analysis.nodes ?? [], analysis.edges ?? []) },
    allow,
    evidence,
  };
}
