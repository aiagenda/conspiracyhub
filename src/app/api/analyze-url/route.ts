import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { callOpenAIJSON } from "@/lib/openai";
import { SYSTEM_ORACLE } from "@/lib/prompts";
import { normalizeVerdict } from "@/lib/verdict";
import type { OracleAnalysis } from "@/types";

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) throw new Error("Supabase env missing");
  return createClient(url, key);
}

async function scrapeArticle(url: string) {
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; TheTheorist/1.0)", Accept: "text/html" },
    signal: AbortSignal.timeout(12000),
  });
  if (!res.ok) throw new Error(`Cannot fetch URL: HTTP ${res.status}`);
  const html = await res.text();

  const title =
    html.match(/<meta[^>]+property="og:title"[^>]+content="([^"]+)"/i)?.[1] ||
    html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1] ||
    "Unknown Article";

  const desc = html.match(/<meta[^>]+(?:name="description"|property="og:description")[^>]+content="([^"]+)"/i)?.[1] ?? "";

  const bodyText = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 5000);

  return { title: title.trim(), text: (desc ? `${desc} ` : "") + bodyText };
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

    const { data: profile } = await admin.from("user_profiles").select("plan").eq("id", user.id).single();
    if (profile?.plan !== "pro") return NextResponse.json({ error: "upgrade_required" }, { status: 403 });

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

    const article = await scrapeArticle(urlStr);

    const analysis = await callOpenAIJSON<OracleAnalysis>({
      apiKey: process.env.OPENAI_API_KEY!,
      system: SYSTEM_ORACLE,
      user: `Article URL: ${urlStr}\nTitle: ${article.title}\n\nContent:\n${article.text}`,
      maxTokens: 8192,
      maxAttempts: 4,
    });

    const payload = {
      source_url: urlStr,
      title: article.title,
      nodes: analysis.nodes ?? [],
      edges: analysis.edges ?? [],
      theories: analysis.theories ?? [],
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
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[analyze-url]", msg);
    return NextResponse.json({ error: "analysis_failed", message: msg }, { status: 500 });
  }
}
