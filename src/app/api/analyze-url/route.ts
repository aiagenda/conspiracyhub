import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { callOpenAIJSON } from "@/lib/openai";
import { ensureOracleTheoriesAtLeastOne } from "@/lib/oracleTheories";
import { SYSTEM_ORACLE } from "@/lib/prompts";
import { sanitizeOracleTheoryUrlStrings } from "@/lib/oracleSourceUrls";
import { createSourceUrlAllowlist, extractHttpsUrlsFromText, mergeUrlSeeds } from "@/lib/sourceUrlAllowlist";
import { normalizeVerdict } from "@/lib/verdict";
import { fetchUrlContent } from "@/lib/urlContent";
import type { OracleAnalysis } from "@/types";
import { userHasEffectivePro } from "@/lib/server/requireEffectivePro";

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) throw new Error("Supabase env missing");
  return createClient(url, key);
}

export async function POST(req: NextRequest) {
  try {
    const admin = getAdminClient();

    const auth = req.headers.get("authorization") ?? "";
    if (!auth.startsWith("Bearer ")) return NextResponse.json({ error: "missing_token" }, { status: 401 });
    const {
      data: { user },
      error: userErr,
    } = await admin.auth.getUser(auth.replace("Bearer ", ""));
    if (userErr || !user) return NextResponse.json({ error: "invalid_token" }, { status: 401 });

    if (!(await userHasEffectivePro(admin, user.id))) {
      return NextResponse.json({ error: "upgrade_required" }, { status: 403 });
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
    if (cached) return NextResponse.json(cached);

    const article = await fetchUrlContent(urlStr);

    const articleLine = `Source URL: ${urlStr}\nContent extraction: ${article.source}\nTitle: ${article.title}\n\nContent:\n${article.text}`;

    const oracleSeeds = mergeUrlSeeds([urlStr], extractHttpsUrlsFromText(articleLine));
    const oracleAllow = createSourceUrlAllowlist(oracleSeeds);
    const oracleUserMessage = articleLine + oracleAllow.promptBlock;

    const analysisRaw = await callOpenAIJSON<OracleAnalysis>({
      apiKey: process.env.OPENAI_API_KEY!,
      system: SYSTEM_ORACLE,
      user: oracleUserMessage,
      maxTokens: 8192,
      maxAttempts: 4,
    });

    const analysisMerged = await ensureOracleTheoriesAtLeastOne(analysisRaw, oracleUserMessage, {
      apiKey: process.env.OPENAI_API_KEY!,
    });

    const analysis = oracleAllow.applyToOracleAnalysis(analysisMerged);

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
      return NextResponse.json({ ...payload, id: null });
    }
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
