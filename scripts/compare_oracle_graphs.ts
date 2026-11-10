/**
 * Does the evidence-first Oracle actually find connections?
 *
 * The complaint the rewrite answers is measurable: over 300 stored `oracle_analyses` the
 * median graph has 3 nodes, 2 edges and 0 lateral edges, 27% have no edge at all, and 71%
 * contain no entity-to-entity link — only spokes from the centre article. So the metric
 * that matters is not node count but LATERAL edges: a connection between two entities,
 * which is the thing a reader cannot get from the article itself.
 *
 * Four variants per story, so the two changes can be told apart:
 *   blind/<model>     the old prompt — article text only, allowlist from the article's URLs
 *   evidence/<model>  retrieval first, allowlist widened to what was retrieved
 *
 * Usage:  npm run compare:oracle -- [--rows 2]
 *          npm run compare:oracle -- --generated <slug>   (an archival /blog investigation,
 *          which is where the declassified document index actually has material)
 */
import { createClient } from "@supabase/supabase-js";
import { SYSTEM_ORACLE } from "../src/lib/prompts";
import { createSourceUrlAllowlist, extractHttpsUrlsFromText, mergeUrlSeeds } from "../src/lib/sourceUrlAllowlist";
import { gatherOracleEvidence } from "../src/lib/server/oracleEvidence";
import { layoutOracleNodes } from "../src/lib/oracleLayout";
import type { OracleAnalysis } from "../src/types";

/** Per 1M tokens, from developers.openai.com/api/docs/pricing (2026-11). */
const PRICES: Record<string, { in: number; out: number }> = {
  "gpt-4o": { in: 2.5, out: 10 },
  "gpt-6.1-terra": { in: 1.0, out: 5.0 },
};
const MODELS = ["gpt-4o", "gpt-6.1-terra"];

function argStr(name: string): string | null {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? null : (process.argv[i + 1] ?? null);
}

function arg(name: string, fallback: number): number {
  const i = process.argv.indexOf(`--${name}`);
  const n = i === -1 ? NaN : Number.parseInt(process.argv[i + 1] ?? "", 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

const strip = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

type Metrics = {
  variant: string;
  nodes: number;
  edges: number;
  lateral: number;
  centreEdges: number;
  spokeOnly: boolean;
  centreOrphan: boolean;
  nodesWithUrl: number;
  edgesWithUrl: number;
  docNodes: number;
  theories: number;
  maxDepth: number;
  inTok: number;
  outTok: number;
  usd: number;
  secs: number;
  verdict: string;
};

/** Depth of the deepest node from the centre — the prompt asks for three layers. */
function graphDepth(analysis: OracleAnalysis): number {
  const nodes = analysis.nodes ?? [];
  const edges = analysis.edges ?? [];
  if (!nodes.length) return 0;
  const root = (nodes.find((n) => n.id === "center") ?? nodes[0]).id;
  const adj = new Map<string, string[]>(nodes.map((n) => [n.id, []] as const));
  for (const e of edges) {
    if (adj.has(e.from) && adj.has(e.to)) {
      adj.get(e.from)!.push(e.to);
      adj.get(e.to)!.push(e.from);
    }
  }
  const depth = new Map([[root, 0]]);
  const queue = [root];
  for (let i = 0; i < queue.length; i += 1) {
    for (const next of adj.get(queue[i]) ?? []) {
      if (depth.has(next)) continue;
      depth.set(next, depth.get(queue[i])! + 1);
      queue.push(next);
    }
  }
  return Math.max(0, ...depth.values());
}

function measure(
  variant: string,
  analysis: OracleAnalysis,
  usage: { inTok: number; outTok: number; usd: number; secs: number },
  docUrls: Set<string>,
): Metrics {
  const nodes = analysis.nodes ?? [];
  const edges = analysis.edges ?? [];
  const centre = new Set(nodes.filter((n) => n.id === "center" || n.type === "article").map((n) => n.id));
  const lateral = edges.filter((e) => !centre.has(e.from) && !centre.has(e.to)).length;
  const centreEdges = edges.filter((e) => centre.has(e.from) || centre.has(e.to)).length;
  return {
    variant,
    nodes: nodes.length,
    edges: edges.length,
    lateral,
    centreEdges,
    spokeOnly: edges.length > 0 && lateral === 0,
    // The opposite defect, and the one the first measurement found: a fine entity web
    // with no edge back to the story it is supposed to explain.
    centreOrphan: nodes.length > 1 && centreEdges === 0,
    nodesWithUrl: nodes.filter((n) => /^https?:\/\//i.test(String(n.detail?.source_url ?? ""))).length,
    edgesWithUrl: edges.filter((e) => /^https?:\/\//i.test(String(e.source_url ?? ""))).length,
    docNodes: nodes.filter((n) => docUrls.has(String(n.detail?.source_url ?? ""))).length,
    theories: (analysis.theories ?? []).length,
    maxDepth: graphDepth(analysis),
    verdict: String(analysis.verdict ?? "—"),
    ...usage,
  };
}

async function runGraph(model: string, system: string, user: string, maxTokens: number) {
  const era = /^gpt-[56]/.test(model);
  const t0 = Date.now();
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: JSON.stringify({
      model,
      ...(era ? { max_completion_tokens: maxTokens, reasoning_effort: "none" } : { max_tokens: maxTokens, temperature: 0.2 }),
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message ?? `OpenAI HTTP ${res.status}`);
  const raw = String(data.choices?.[0]?.message?.content ?? "").replace(/```json|```/g, "").trim();
  let analysis: OracleAnalysis | null = null;
  try {
    analysis = JSON.parse(raw) as OracleAnalysis;
  } catch {
    /* finish_reason=length truncates mid-object */
  }
  const u = data.usage ?? {};
  const inTok = Number(u.prompt_tokens ?? 0);
  const outTok = Number(u.completion_tokens ?? 0);
  const p = PRICES[model];
  return {
    analysis,
    finish: data.choices?.[0]?.finish_reason as string | undefined,
    usage: {
      inTok,
      outTok,
      usd: (inTok / 1e6) * p.in + (outTok / 1e6) * p.out,
      secs: (Date.now() - t0) / 1000,
    },
  };
}

async function main() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is required.");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_KEY are required.");

  const client = createClient(url, key);
  const slug = argStr("generated");
  let rows: Array<{ title: string; summary: string | null; url: string; body_html: string | null }>;

  if (slug) {
    const { data, error } = await client
      .from("generated_articles")
      .select("title,excerpt,meta_description,content,slug")
      .eq("slug", slug)
      .eq("status", "published")
      .maybeSingle();
    if (error || !data) throw new Error(`Could not load generated_articles slug "${slug}": ${error?.message ?? "not found"}`);
    rows = [{
      title: String(data.title),
      summary: String(data.excerpt ?? data.meta_description ?? ""),
      url: `${(process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.the-theorist.com").replace(/\/$/, "")}/blog/${data.slug}`,
      body_html: String(data.content ?? ""),
    }];
  } else {
    const { data, error } = await client
      .from("news_items")
      .select("title,summary,url,body_html")
      .not("body_html", "is", null)
      .order("published_at", { ascending: false })
      .limit(arg("rows", 2));
    if (error) throw new Error(`Could not load news_items: ${error.message}`);
    rows = (data ?? []) as typeof rows;
  }
  if (!rows.length) throw new Error("No rows with a body to measure against.");

  const all: Metrics[] = [];

  for (const row of rows) {
    const body = strip(String(row.body_html ?? "")).slice(0, 6500);
    const articleLine = `Article: ${row.title}\nSummary: ${row.summary ?? ""}\nBody:\n${body}\nURL: ${row.url}`;
    const seeds = mergeUrlSeeds([String(row.url)], extractHttpsUrlsFromText(articleLine));

    console.log(`\n${"=".repeat(104)}\n${row.title}\n${"=".repeat(104)}`);

    process.stdout.write("retrieving evidence … ");
    const t0 = Date.now();
    const evidence = await gatherOracleEvidence({ apiKey, title: String(row.title), articleLine, seedUrls: seeds });
    console.log(
      `${((Date.now() - t0) / 1000).toFixed(1)}s — ${evidence.entities.length} entities, ` +
        `${evidence.findings.length} source bodies, ${evidence.documents.length} documents, ` +
        `${evidence.allowUrls.length} citable URLs`,
    );
    if (evidence.entities.length) {
      console.log(`  entities: ${evidence.entities.map((e) => `${e.name} [${e.type}]`).join(", ")}`);
    }
    const docUrls = new Set(
      evidence.documents.flatMap((d) => [d.pdf_url, d.canonical_url]).filter((u): u is string => Boolean(u)),
    );

    const blindAllow = createSourceUrlAllowlist(seeds);
    const evidenceAllow = createSourceUrlAllowlist(mergeUrlSeeds(seeds, evidence.allowUrls));

    const variants = [
      { tag: "blind", user: articleLine + blindAllow.promptBlock, allow: blindAllow },
      { tag: "evidence", user: articleLine + evidence.promptBlock + evidenceAllow.promptBlock, allow: evidenceAllow },
    ];

    for (const variant of variants) {
      for (const model of MODELS) {
        const label = `${variant.tag}/${model}`;
        process.stdout.write(`  ${label.padEnd(26)} … `);
        try {
          const run = await runGraph(model, SYSTEM_ORACLE, variant.user, 8192);
          if (!run.analysis) {
            console.log(`UNPARSEABLE (finish=${run.finish})`);
            continue;
          }
          // Measured after the allowlist, because a stripped citation is the defect: an
          // uncitable lateral edge is exactly what used to disappear here.
          const applied = variant.allow.applyToOracleAnalysis(run.analysis);
          const laidOut = { ...applied, nodes: layoutOracleNodes(applied.nodes ?? [], applied.edges ?? []) };
          const m = measure(label, laidOut, run.usage, docUrls);
          all.push(m);
          console.log(
            `${m.nodes} nodes, ${m.edges} edges (${m.lateral} lateral), depth ${m.maxDepth}, ` +
              `${m.docNodes} doc nodes, $${m.usd.toFixed(4)}, ${m.secs.toFixed(1)}s`,
          );
        } catch (e) {
          console.log(`FAILED — ${e instanceof Error ? e.message : e}`);
        }
      }
    }
  }

  const header =
    `\n${"variant".padEnd(26)}${"nodes".padEnd(7)}${"edges".padEnd(7)}${"lateral".padEnd(9)}` +
    `${"centre".padEnd(8)}${"depth".padEnd(7)}${"node URLs".padEnd(11)}${"docs".padEnd(6)}` +
    `${"theories".padEnd(10)}${"$".padEnd(10)}time`;
  console.log(`\n${"=".repeat(104)}\nPER RUN${header}`);
  console.log("-".repeat(104));
  for (const m of all) {
    console.log(
      m.variant.padEnd(26) +
        `${m.nodes}`.padEnd(7) +
        `${m.edges}`.padEnd(7) +
        `${m.lateral}`.padEnd(9) +
        `${m.centreEdges}${m.centreOrphan ? " !" : ""}`.padEnd(8) +
        `${m.maxDepth}`.padEnd(7) +
        `${m.nodesWithUrl}/${m.nodes}`.padEnd(11) +
        `${m.docNodes}`.padEnd(6) +
        `${m.theories}`.padEnd(10) +
        `$${m.usd.toFixed(4)}`.padEnd(10) +
        `${m.secs.toFixed(1)}s`,
    );
  }

  const avg = (xs: number[]) => (xs.length ? xs.reduce((s, v) => s + v, 0) / xs.length : 0);
  console.log(`\nMEANS BY VARIANT${header}`);
  console.log("-".repeat(104));
  for (const tag of ["blind", "evidence"]) {
    for (const model of MODELS) {
      const group = all.filter((m) => m.variant === `${tag}/${model}`);
      if (!group.length) continue;
      console.log(
        `${tag}/${model}`.padEnd(26) +
          avg(group.map((m) => m.nodes)).toFixed(1).padEnd(7) +
          avg(group.map((m) => m.edges)).toFixed(1).padEnd(7) +
          avg(group.map((m) => m.lateral)).toFixed(1).padEnd(9) +
          avg(group.map((m) => m.centreEdges)).toFixed(1).padEnd(8) +
          avg(group.map((m) => m.maxDepth)).toFixed(1).padEnd(7) +
          avg(group.map((m) => m.nodesWithUrl)).toFixed(1).padEnd(11) +
          avg(group.map((m) => m.docNodes)).toFixed(1).padEnd(6) +
          avg(group.map((m) => m.theories)).toFixed(1).padEnd(10) +
          `$${avg(group.map((m) => m.usd)).toFixed(4)}`.padEnd(10) +
          `${avg(group.map((m) => m.secs)).toFixed(1)}s`,
      );
    }
  }

  console.log(`
  lateral     edges where neither end is the centre article. This is the number the
              rewrite exists to move: the live median is 0, and 71% of stored analyses
              have none at all.
  centre      edges touching the article node. "!" marks a centre with none: a tidy
              entity web that never links back to the story is the opposite defect, and
              the first run of this script is what found it.
  depth       hops from the centre to the furthest node. The prompt asks for 3 layers,
              and depth 0 means the centre is orphaned.
  docs        nodes citing The Theorist's own declassified index — LAYER 3 evidence that
              the old pipeline never had, because it never queried that index.
  node/edge URLs  citations surviving the allowlist. An uncitable edge gets stripped.
`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
