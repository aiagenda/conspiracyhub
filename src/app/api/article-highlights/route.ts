import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { callOpenAIJSON } from "@/lib/openai";

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) throw new Error("Supabase env missing");
  return createClient(url, key);
}

type UserTier = "guest" | "free" | "pro";

async function getUserTier(auth: string | null): Promise<UserTier> {
  if (!auth?.startsWith("Bearer ")) return "guest";
  try {
    const admin = getAdminClient();
    const { data: { user }, error } = await admin.auth.getUser(auth.replace("Bearer ", ""));
    if (error || !user) return "guest";
    const { data: profile } = await admin.from("user_profiles").select("plan").eq("id", user.id).single();
    return profile?.plan === "pro" ? "pro" : "free";
  } catch {
    return "guest";
  }
}

const SYSTEM_HIGHLIGHTS = `You are a conspiracy research analyst. LANGUAGE: All notes and category labels in your JSON output MUST be English only.

Given a news article, identify specific words, names, and phrases that are relevant to conspiracy theories, hidden agendas, surveillance, or unexplained connections.

For each highlight, assign a category and provide a brief, punchy note explaining the conspiracy relevance.

Return ONLY valid JSON:
{
  "highlights": [
    {
      "text": "exact phrase from article (case-sensitive, as it appears)",
      "category": "agency|company|person|technology|event|theory|location",
      "note": "1-2 sentence conspiracy relevance explanation",
      "severity": "high|medium|low"
    }
  ]
}

Category guide:
- agency: CIA, NSA, FBI, DARPA, WHO, WEF, Pentagon, government bodies
- company: corporations, tech giants, pharma companies, defense contractors
- person: politicians, billionaires, executives, scientists with suspicious connections
- technology: surveillance tech, biotech, AI, patents, experimental tech
- event: suspicious events, meetings, policy changes, accidents
- theory: direct references to known conspiracy theories
- location: significant locations (Area 51, Bilderberg, etc.)

Severity:
- high: direct link to well-documented conspiracy theory or known surveillance/control program
- medium: indirect connection, suspicious but not proven
- low: worth noting, context-dependent

Find 8-20 highlights. Only highlight phrases that ACTUALLY APPEAR verbatim in the article text.
Do not make up phrases — only use exact text from the article.`;

const HIGHLIGHT_LIMIT: Record<UserTier, number> = { guest: 3, free: 5, pro: Infinity };

export async function POST(req: NextRequest) {
  try {
    const { text, title } = await req.json();
    if (!text) return NextResponse.json({ error: "text_required" }, { status: 400 });

    const tier = await getUserTier(req.headers.get("authorization"));

    const result = await callOpenAIJSON<{
      highlights: Array<{
        text: string;
        category: string;
        note: string;
        severity: string;
      }>;
    }>({
      apiKey: process.env.OPENAI_API_KEY!,
      system: SYSTEM_HIGHLIGHTS,
      user: `Article title: ${title ?? ""}\n\nArticle text:\n${String(text).slice(0, 6000)}`,
      maxTokens: 1200,
    });

    const all = result.highlights ?? [];
    const limit = HIGHLIGHT_LIMIT[tier];

    if (limit === Infinity) {
      return NextResponse.json({ highlights: all, total: all.length, is_limited: false });
    }

    // Guests and free users: show only the highest-severity highlights as a teaser
    const sorted = [...all].sort((a, b) => {
      const order: Record<string, number> = { high: 0, medium: 1, low: 2 };
      return (order[a.severity] ?? 3) - (order[b.severity] ?? 3);
    });
    const teaser = sorted.slice(0, limit);
    return NextResponse.json({ highlights: teaser, total: all.length, is_limited: all.length > limit });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[article-highlights]", msg);
    return NextResponse.json({ error: "highlights_failed", message: msg }, { status: 500 });
  }
}
