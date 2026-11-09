/**
 * Long-form quality and cost comparison for the WRITING_MODEL tier.
 *
 * The generated_articles pipeline is what /blog publishes, so moving it is an editorial
 * decision, not an arithmetic one. This runs the real ARTICLE_SYSTEM prompt — including
 * the live researchTopic step, so both models see identical retrieved source text — and
 * prints the measurables plus the articles themselves, because the only honest way to
 * judge prose is to read it.
 *
 * What the measurables mean here: the pipeline already fights short articles
 * (expandArticleIfShort, scripts/expand-top-short.ts), so a more verbose model is not
 * automatically worse. Citation density and whether every cited URL came from the
 * allowlist matter more — an article that invents a source is a defect regardless of
 * how well it reads.
 *
 * Usage:  npm run compare:writing -- --topic "MKULTRA subproject 68" [--full]
 */
import { ARTICLE_SYSTEM } from "../src/lib/server/generateArticleCore";
import { researchTopic, researchPromptBlock } from "../src/lib/server/articleResearch";
import { createSourceUrlAllowlist, mergeUrlSeeds, extractHttpsUrlsFromText } from "../src/lib/sourceUrlAllowlist";

type Usd = { in: number; out: number };

/** Per 1M tokens, from developers.openai.com/api/docs/pricing (2026-11). */
const PRICES: Record<string, Usd> = {
  "gpt-4o": { in: 2.5, out: 10 },
  "gpt-6.1-terra": { in: 1.0, out: 5.0 },
};

const MODELS = ["gpt-4o", "gpt-6.1-terra"];

function argStr(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? fallback : (process.argv[i + 1] ?? fallback);
}

type Article = {
  title?: string;
  meta_description?: string;
  content?: string;
  excerpt?: string;
  sources?: Array<{ title?: string; url?: string }>;
  faqs?: Array<{ question: string; answer: string }>;
};

const words = (t: string) => t.split(/\s+/).filter(Boolean).length;

async function run(model: string, system: string, user: string) {
  const era = /^gpt-[56]/.test(model);
  const t0 = Date.now();
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: JSON.stringify({
      model,
      ...(era ? { max_completion_tokens: 9000, reasoning_effort: "none" } : { max_tokens: 9000, temperature: 0.2 }),
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message ?? `OpenAI HTTP ${res.status}`);
  const u = data.usage ?? {};
  const inTok = Number(u.prompt_tokens ?? 0);
  const outTok = Number(u.completion_tokens ?? 0);
  const p = PRICES[model];
  const raw = String(data.choices?.[0]?.message?.content ?? "").replace(/```json|```/g, "").trim();
  let article: Article | null = null;
  try {
    article = JSON.parse(raw) as Article;
  } catch {
    /* finish_reason=length truncates mid-object */
  }
  return {
    model,
    article,
    inTok,
    outTok,
    usd: (inTok / 1e6) * p.in + (outTok / 1e6) * p.out,
    ms: Date.now() - t0,
    finish: data.choices?.[0]?.finish_reason as string | undefined,
  };
}

async function main() {
  if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is required.");
  const topic = argStr("topic", "CIA MKULTRA subproject records released under FOIA");
  const full = process.argv.includes("--full");

  console.log(`\nTopic: ${topic}`);
  process.stdout.write("Researching the live web (same findings for both models) … ");
  const findings = await researchTopic(topic, null, "investigation", []);
  console.log(`${findings.length} source(s) retrieved`);
  if (!findings.length) console.log("  ! no sources — the prompt will ask for a thin draft, which is not a fair comparison");

  const prompt = `Write an evidence-led article about: "${topic}"

Internal link: reference "https://the-theorist.com/board" for investigation tools.`;
  const allow = createSourceUrlAllowlist(
    mergeUrlSeeds(findings.map((f) => f.url), extractHttpsUrlsFromText(prompt)),
    "article",
  );
  const user = prompt + researchPromptBlock(findings) + allow.promptBlock;
  const allowed = new Set(findings.map((f) => f.url));

  const results = [];
  for (const model of MODELS) {
    process.stdout.write(`  ${model} … `);
    try {
      const r = await run(model, ARTICLE_SYSTEM, user);
      results.push(r);
      console.log(`${(r.ms / 1000).toFixed(1)}s, ${r.outTok} out tok, $${r.usd.toFixed(4)}${r.article ? "" : `, UNPARSEABLE (finish=${r.finish})`}`);
    } catch (e) {
      console.log(`FAILED — ${e instanceof Error ? e.message : e}`);
    }
  }

  console.log(`\n${"model".padEnd(16)}${"words".padEnd(8)}${"H2".padEnd(5)}${"links".padEnd(7)}${"off-list".padEnd(10)}${"sources".padEnd(9)}${"faqs".padEnd(6)}${"$/article".padEnd(11)}time`);
  console.log("-".repeat(86));
  for (const r of results) {
    const c = r.article?.content ?? "";
    const links = [...c.matchAll(/(?<!!)\[[^\]]+\]\((https?:\/\/[^\s)]+)\)/g)].map((m) => m[1]);
    // A citation outside the allowlist is a URL the model supplied itself: the defect the
    // allowlist exists to catch, and the one that matters most in a sourced article.
    const offList = links.filter((u) => !allowed.has(u) && !u.includes("the-theorist.com")).length;
    console.log(
      r.model.padEnd(16) +
        `${words(c)}`.padEnd(8) +
        `${(c.match(/^##\s/gm) ?? []).length}`.padEnd(5) +
        `${links.length}`.padEnd(7) +
        `${offList}`.padEnd(10) +
        `${r.article?.sources?.length ?? 0}`.padEnd(9) +
        `${r.article?.faqs?.length ?? 0}`.padEnd(6) +
        `$${r.usd.toFixed(4)}`.padEnd(11) +
        `${(r.ms / 1000).toFixed(1)}s`,
    );
  }
  console.log(`
  off-list   citations the model supplied itself rather than taking from the research
             block. Anything above 0 is a sourcing defect, whatever the prose is like.
  words      the pipeline expands short articles anyway, so longer is not worse here.
`);

  for (const r of results) {
    const a = r.article;
    if (!a) continue;
    console.log("=".repeat(100));
    console.log(`${r.model}\n`);
    console.log(`TITLE: ${a.title}`);
    console.log(`META:  ${a.meta_description}`);
    console.log("=".repeat(100));
    const c = a.content ?? "";
    console.log(full ? c : c.slice(0, 2600) + (c.length > 2600 ? `\n\n[… ${words(c.slice(2600))} more words — pass --full to print all]` : ""));
    console.log();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
