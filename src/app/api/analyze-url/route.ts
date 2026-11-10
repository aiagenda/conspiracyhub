import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sanitizeOracleTheoryUrlStrings } from "@/lib/oracleSourceUrls";
import { extractHttpsUrlsFromText, mergeUrlSeeds } from "@/lib/sourceUrlAllowlist";
import { normalizeVerdict } from "@/lib/verdict";
import { fetchUrlContent } from "@/lib/urlContent";
import { buildOracleGraph } from "@/lib/server/oracleGraph";
import { getPostHogClient } from "@/lib/posthog-server";
import { checkRateLimit, ipHash } from "@/lib/server/rateLimit";

/**
 * Fetching the URL (PDF extraction for FOIA and patent documents is the slow case) is now
 * followed by a retrieval stage and the graph call, so 60s no longer fits. The ceiling is
 * generous rather than tuned: the work finishes when it finishes, and a graph truncated by
 * the platform is worth nothing.
 */
export const maxDuration = 300;

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) throw new Error("Supabase env missing");
  return createClient(url, key);
}

export async function POST(req: NextRequest) {
  try {
    const admin = getAdminClient();

    // Open to anyone. What the sign-in wall was really protecting is the OpenAI
    // bill, and a per-visitor limit protects that without asking for an account.
    const limiter = await checkRateLimit(admin, req, {
      bucket: "analyze_url",
      limit: 5,
      windowMinutes: 60,
    });
    if (!limiter.allowed) {
      return NextResponse.json(
        { error: "rate_limited", message: "That is five investigations this hour. Try again later." },
        { status: 429 },
      );
    }

    const body = await req.json();
    const urlStr: string = body.url ?? "";
    if (!urlStr || !/^https?:\/\//i.test(urlStr)) return NextResponse.json({ error: "invalid_url" }, { status: 400 });

    const { data: cached } = await admin
      .from("url_analyses")
      .select("*")
      .eq("source_url", urlStr)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    // A cached answer costs nothing to serve, so it does not spend the quota.
    if (cached) return NextResponse.json(cached);

    const article = await fetchUrlContent(urlStr);

    const articleLine = `Source URL: ${urlStr}\nContent extraction: ${article.source}\nTitle: ${article.title}\n\nContent:\n${article.text}`;

    const { analysis } = await buildOracleGraph({
      apiKey: process.env.OPENAI_API_KEY!,
      title: article.title,
      articleLine,
      seedUrls: mergeUrlSeeds([urlStr], extractHttpsUrlsFromText(articleLine)),
      maxTokens: 8192,
    });

    const theoriesOut = (analysis.theories ?? []).map((t) => ({
      ...t,
      sources: sanitizeOracleTheoryUrlStrings(t.sources),
    }));

    const payload = {
      source_url: urlStr,
      title: article.title,
      nodes: analysis.nodes ?? [],
      edges: analysis.edges ?? [],
      theories: theoriesOut,
      sources: analysis.sources ?? [],
      conclusion: analysis.conclusion ?? "",
      verdict: normalizeVerdict(analysis.verdict ?? "QUESTIONABLE"),
    };

    const { data: inserted, error: dbErr } = await admin.from("url_analyses").insert(payload).select("*").single();
    if (dbErr) {
      console.warn("[analyze-url] DB insert skipped:", dbErr.message);
      await limiter.record();
      return NextResponse.json({ ...payload, id: null });
    }
    await limiter.record();
    getPostHogClient().capture({
      distinctId: `guest_${ipHash(req)}`,
      event: "url_analyzed",
      properties: { source_url: urlStr, verdict: payload.verdict },
    });
    return NextResponse.json(inserted);
  } catch (err) {
    if (err instanceof Error && err.message === "oracle_no_theories") {
      return NextResponse.json({ error: "oracle_no_theories", message: "Model returned no usable theories." }, { status: 422 });
    }
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[analyze-url]", msg);
    return NextResponse.json({ error: "analysis_failed", message: msg }, { status: 500 });
  }
}
