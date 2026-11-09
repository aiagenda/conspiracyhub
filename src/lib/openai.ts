/** First top-level `{ ... }` with string-aware brace matching (handles nested objects). */
function extractBalancedJsonObject(raw: string): string | null {
  const cleaned = raw.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
  const start = cleaned.indexOf("{");
  if (start === -1) return null;
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < cleaned.length; i++) {
    const c = cleaned[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (inString) {
      if (c === "\\") {
        escape = true;
        continue;
      }
      if (c === '"') inString = false;
      continue;
    }
    if (c === '"') {
      inString = true;
      continue;
    }
    if (c === "{") depth += 1;
    else if (c === "}") {
      depth -= 1;
      if (depth === 0) return cleaned.slice(start, i + 1);
    }
  }
  return null;
}

/**
 * Every model choice in the app resolves to one of these four roles, so a migration is a
 * change here rather than a sweep over nineteen call sites. Prices per 1M tokens
 * (input / cached / output) as of 2026-11:
 *
 *   gpt-6-luna      $0.10 / $0.01 / $0.50   — cheaper than gpt-4o-mini on every axis
 *   gpt-4o-mini     $0.15 / $0.075 / $0.60
 *   gpt-6.1-terra   $1.00 / $0.05 / $5.00
 *   gpt-4o          $2.50 / $1.25 / $10.00
 */

/** Mechanical JSON: filtering, classification, short summaries. Variance is harmless here. */
export const FAST_MODEL = "gpt-6-luna";

/**
 * Lead ranking. Deliberately still gpt-4o-mini: the GPT-5/6 families force temperature
 * back to 1, and these scores decide what gets published, so the extra spread needs
 * measuring before it ships. `npm run compare:scoring` does that measurement.
 */
export const SCORING_MODEL = "gpt-4o-mini";

/**
 * Long-form drafting for generated_articles, which is what /blog publishes. Measured
 * against gpt-4o on three researched topics via `npm run compare:writing`: 42-58%
 * cheaper per article, no citations invented outside the research allowlist by either
 * model, and drafts of 366-585 words against gpt-4o's steady 320-348. Length matters
 * because expandArticleIfShort is deliberately inert for the automatic writers, so the
 * first draft is the published article, and ARTICLE_TARGET_WORDS asks for 600-1200.
 * It also attributes far more carefully, naming and dating a source and stating what
 * the source cannot establish, where gpt-4o reports a single news item as settled fact.
 * The tradeoff: it returns `faqs: []`, which the prompt permits, so pieces carry fewer
 * FAQ rich snippets.
 */
export const WRITING_MODEL = "gpt-6.1-terra";

/**
 * Evidence review and the brag pipeline. These ride on the writing tier but are not
 * drafting tasks — one is a fact-checking gate, the other drives video — and neither was
 * part of the comparison above, so they stay on gpt-4o until measured on their own work.
 */
export const REVIEW_MODEL = "gpt-4o";

/**
 * Oracle graphs and article highlights. Pinned rather than left to a default: these four
 * call sites named no model at all and so silently inherited the most expensive one, and
 * analyze-url caps at maxDuration 60 while still having to fetch a URL and run a
 * follow-up call. gpt-6.1-terra takes 56s on this prompt alone — it emits twice the
 * output tokens for an oracle graph — so it cannot go here on latency, whatever it costs.
 */
export const ORACLE_MODEL = "gpt-4o";

/** Models that bill reasoning tokens and reject the GPT-4o parameter names. */
function isReasoningEra(model: string): boolean {
  return /^(gpt-[56]|o[1345])/.test(model);
}

/**
 * GPT-4o and the GPT-5/6 families disagree about how a completion is bounded, so the
 * budget has to be spelled differently per model:
 *
 *  - `max_tokens` is rejected outright by GPT-5/6 in favour of `max_completion_tokens`.
 *  - `temperature` only accepts its default of 1 there, so the 0.2 used to keep GPT-4o's
 *    JSON predictable has to be dropped rather than translated.
 *  - Reasoning tokens bill as output *and* count against the completion cap. A tight
 *    budget can be spent entirely on reasoning: gpt-6-luna with a 200-token cap returns
 *    `finish_reason: "length"` and an empty message. Every caller here wants a
 *    mechanical JSON transform, where reasoning buys nothing, so effort defaults to
 *    "none" — that keeps the existing budgets honest and the spend at the listed price.
 */
function budgetFor(model: string, maxTokens: number, reasoningEffort: ReasoningEffort) {
  if (!isReasoningEra(model)) return { max_tokens: maxTokens, temperature: 0.2 };
  return { max_completion_tokens: maxTokens, reasoning_effort: reasoningEffort };
}

export type ReasoningEffort = "none" | "low" | "medium" | "high";

export async function callOpenAIJSON<T>({
  apiKey,
  system,
  user,
  maxTokens = 1800,
  maxAttempts = 3,
  model,
  reasoningEffort = "none",
}: {
  apiKey: string;
  system: string;
  user: string;
  maxTokens?: number;
  /** Number of completion attempts on parse failure (default 3). */
  maxAttempts?: number;
  /**
   * OpenAI chat model id. Required on purpose: four call sites once omitted it and ran
   * on the gpt-4o default unnoticed, at 60x the cost of the work beside them.
   */
  model: string;
  /** GPT-5/6 only, ignored by GPT-4o. Raise it where the task is genuinely analytical. */
  reasoningEffort?: ReasoningEffort;
}): Promise<T> {
  function salvageScores(input: string): T | null {
    const scores: Array<{ index: number; score: number; angle: string }> = [];
    const normalized = input.replace(/```json|```/g, "").replace(/\r/g, " ");
    const rx =
      /"index"\s*:\s*(\d+)[\s\S]*?"score"\s*:\s*(\d+)[\s\S]*?"angle"\s*:\s*"((?:[^"\\]|\\.)*)"/g;
    let m: RegExpExecArray | null = rx.exec(normalized);
    while (m) {
      scores.push({
        index: Number(m[1]),
        score: Number(m[2]),
        angle: m[3].replace(/\\"/g, '"').trim(),
      });
      m = rx.exec(normalized);
    }

    if (!scores.length) return null;
    scores.sort((a, b) => a.index - b.index);
    return { scores } as T;
  }

  function parseJSONSafely(input: string) {
    const balanced = extractBalancedJsonObject(input);
    const blob = balanced ?? input.replace(/```json|```/g, "").trim();
    const fallbackMatch = blob.match(/\{[\s\S]*\}/);
    const candidate = balanced ?? (fallbackMatch ? fallbackMatch[0] : "");
    if (!candidate) throw new Error("OpenAI response did not contain a JSON object.");

    try {
      return JSON.parse(candidate) as T;
    } catch {
      // Common model artifact: trailing comma before } or ]
      const normalized = candidate
        .replace(/,\s*([}\]])/g, "$1")
        .replace(/[“”]/g, '"')
        .replace(/[‘’]/g, "'");
      try {
        return JSON.parse(normalized) as T;
      } catch {
        const salvaged = salvageScores(blob);
        if (salvaged) return salvaged;
        throw new Error("Could not parse model JSON.");
      }
    }
  }

  let lastError: string | null = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        ...budgetFor(model, maxTokens, reasoningEffort),
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error?.message ?? `OpenAI HTTP ${res.status}`);
    }

    const data = await res.json();
    const raw = data.choices?.[0]?.message?.content ?? "";

    const finishReason = data.choices?.[0]?.finish_reason as string | undefined;

    try {
      return parseJSONSafely(raw);
    } catch (error) {
      let msg = error instanceof Error ? error.message : "JSON parse failed";
      if (finishReason === "length") {
        const budgetName = isReasoningEra(model) ? "maxTokens (max_completion_tokens)" : "max_tokens";
        msg = `${msg} (finish_reason=length — output truncated; raise ${budgetName}).`;
      }
      lastError = msg;
      if (attempt === maxAttempts) break;
      await new Promise((r) => setTimeout(r, 400));
    }
  }

  throw new Error(`OpenAI JSON parse failed: ${lastError ?? "unknown error"}`);
}
