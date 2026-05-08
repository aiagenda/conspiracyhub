export async function callOpenAIJSON<T>({
  apiKey,
  system,
  user,
  maxTokens = 1800,
}: {
  apiKey: string;
  system: string;
  user: string;
  maxTokens?: number;
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
    const cleaned = input.replace(/```json|```/g, "").trim();
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("OpenAI response is not valid JSON.");

    try {
      return JSON.parse(match[0]) as T;
    } catch {
      // Common model artifact: trailing comma before } or ]
      const normalized = match[0]
        .replace(/,\s*([}\]])/g, "$1")
        .replace(/[“”]/g, '"')
        .replace(/[‘’]/g, "'");
      try {
        return JSON.parse(normalized) as T;
      } catch {
        const salvaged = salvageScores(cleaned);
        if (salvaged) return salvaged;
        throw new Error("JSON parse hiba");
      }
    }
  }

  let lastError: string | null = null;
  for (let attempt = 1; attempt <= 2; attempt += 1) {
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

    try {
      return parseJSONSafely(raw);
    } catch (error) {
      lastError = error instanceof Error ? error.message : "JSON parse hiba";
      if (attempt === 2) break;
    }
  }

  throw new Error(`OpenAI JSON parse hiba: ${lastError ?? "ismeretlen hiba"}`);
}
