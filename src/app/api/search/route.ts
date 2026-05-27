import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { callOpenAIJSON } from "@/lib/openai";
import { omitIfHungarianScript } from "@/lib/locale";
import { sortByPublishedAtDesc } from "@/lib/sortByPubDate";
import { getPostHogClient } from "@/lib/posthog-server";

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) throw new Error("Supabase env missing");
  return createClient(url, key);
}

async function isRegisteredUser(auth: string | null): Promise<boolean> {
  if (!auth?.startsWith("Bearer ")) return false;
  try {
    const admin = getAdminClient();
    const { data: { user }, error } = await admin.auth.getUser(auth.replace("Bearer ", ""));
    return !error && !!user;
  } catch {
    return false;
  }
}

/** Avoid breaking PostgREST `or` / ilike when users type %, _, or commas. */
function sanitizeIlike(q: string): string {
  return q.replace(/[%_,]/g, " ").trim();
}

const SYSTEM_SEARCH = `You are a conspiracy research assistant. LANGUAGE: All readable text in your JSON response MUST be English only.

Given a search query, return structured results about:
1. Known conspiracy theories related to the query
2. Relevant patents (USPTO) with real patent numbers
3. Key figures associated with this topic
4. Related historical events

Return ONLY valid JSON:
{
  "theories": [
    {
      "name": "Theory name",
      "summary": "2-3 sentence description",
      "probability": 35,
      "sources": ["https://..."],
      "tags": ["surveillance", "government"]
    }
  ],
  "patents": [
    {
      "number": "US10966620B2",
      "title": "Patent title",
      "assignee": "Company name",
      "year": 2021,
      "relevance": "Why this patent is relevant",
      "url": "https://patents.google.com/patent/US10966620B2"
    }
  ],
  "people": [
    {
      "name": "Full Name",
      "role": "Their role in this topic",
      "affiliation": "Organization",
      "significance": "Why they matter"
    }
  ],
  "events": [
    {
      "date": "2019-03-15",
      "title": "Event title",
      "description": "What happened and why it matters"
    }
  ]
}`;

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const rawQ = searchParams.get("q") ?? "";
    const q = sanitizeIlike(rawQ);
    const type = searchParams.get("type") ?? "all";
    const threat = searchParams.get("threat") ?? "";

    if (!q.trim()) return NextResponse.json({ error: "query_required" }, { status: 400 });

    const admin = getAdminClient();

    const pattern = `%${q}%`;
    const { data: newsResults } = await admin
      .from("news_items")
      .select("id, title, summary, section, score, angle, published_at")
      .or(`title.ilike.${pattern},summary.ilike.${pattern},angle.ilike.${pattern}`)
      .order("score", { ascending: false })
      .limit(10);

    const newsSanitized = sortByPublishedAtDesc(
      (newsResults ?? []).map((row: { angle?: string | null; summary?: string | null; published_at?: string | null; [k: string]: unknown }) => ({
        ...row,
        angle: omitIfHungarianScript(row.angle ?? ""),
        summary: omitIfHungarianScript(row.summary ?? ""),
      })),
    );

    // AI enrichment (theories / patents / people / events) requires a registered account
    const registered = await isRegisteredUser(req.headers.get("authorization"));

    if (!registered) {
      getPostHogClient().capture({
        distinctId: "anonymous",
        event: "search_performed",
        properties: { query: rawQ, type, threat, registered: false, news_count: newsSanitized.length },
      });
      return NextResponse.json({
        query: rawQ,
        news: newsSanitized,
        theories: [],
        patents: [],
        people: [],
        events: [],
        requires_login: true,
      });
    }

    const aiResults = await callOpenAIJSON<{
      theories: Array<{ name: string; summary: string; probability: number; sources: string[]; tags: string[] }>;
      patents: Array<{ number: string; title: string; assignee: string; year: number; relevance: string; url: string }>;
      people: Array<{ name: string; role: string; affiliation: string; significance: string }>;
      events: Array<{ date: string; title: string; description: string }>;
    }>({
      apiKey: process.env.OPENAI_API_KEY!,
      system: SYSTEM_SEARCH,
      user: `Search query: "${q}"\nType filter: ${type}\nThreat filter: ${threat || "none"}`,
      maxTokens: 4096,
      maxAttempts: 3,
    });

    let theories = aiResults.theories ?? [];
    if (threat === "high") theories = theories.filter((t) => t.probability >= 60);
    if (threat === "medium") theories = theories.filter((t) => t.probability >= 30 && t.probability < 60);
    if (threat === "low") theories = theories.filter((t) => t.probability < 30);

    getPostHogClient().capture({
      distinctId: "registered",
      event: "search_performed",
      properties: { query: rawQ, type, threat, registered: true, news_count: newsSanitized.length },
    });
    return NextResponse.json({
      query: rawQ,
      news: newsSanitized,
      theories: type === "patents" || type === "people" ? [] : theories,
      patents: type === "theories" || type === "people" ? [] : (aiResults.patents ?? []),
      people: type === "theories" || type === "patents" ? [] : (aiResults.people ?? []),
      events: aiResults.events ?? [],
      requires_login: false,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[search]", msg);
    return NextResponse.json({ error: "search_failed", message: msg }, { status: 500 });
  }
}
