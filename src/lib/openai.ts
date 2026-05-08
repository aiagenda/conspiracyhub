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

export async function callOpenAIJSON<T>({
  apiKey,
  system,
  user,
  maxTokens = 1800,
  maxAttempts = 3,
}: {
  apiKey: string;
  system: string;
  user: string;
  maxTokens?: number;
  /** Number of completion attempts on parse failure (default 3). */
  maxAttempts?: number;
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
        model: "gpt-4o",
        max_tokens: maxTokens,
        temperature: 0.2,
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
      if (finishReason === "length") msg = `${msg} (finish_reason=length — output truncated; raise max_tokens).`;
      lastError = msg;
      if (attempt === maxAttempts) break;
      await new Promise((r) => setTimeout(r, 400));
    }
  }

  throw new Error(`OpenAI JSON parse failed: ${lastError ?? "unknown error"}`);
}
