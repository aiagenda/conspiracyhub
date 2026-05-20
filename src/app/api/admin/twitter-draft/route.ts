import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { callOpenAIJSON } from "@/lib/openai";

export const maxDuration = 60;

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://the-theorist.com";

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!,
  );
}

const TWEET_SYSTEM = `You are a social media strategist for The Theorist — an AI-powered conspiracy investigation platform.
Write 3 tweet variants for the given news article. Each must:
- Be under 240 characters (leave room for URL)
- Hook the reader immediately — question, shocking claim, or mystery
- NOT sound like a bot or marketing copy
- Reference the specific article content, not generic conspiracy claims
- End naturally (no "Check it out!" type phrases)

Return ONLY valid JSON:
{
  "variants": [
    { "style": "shocking", "text": "tweet text without URL" },
    { "style": "question", "text": "tweet text without URL" },
    { "style": "investigative", "text": "tweet text without URL" }
  ],
  "hashtags": ["tag1", "tag2", "tag3"],
  "best_time": "morning|afternoon|evening"
}`;

/** Open access for now — same as other /api/admin/* routes. */
export async function GET(req: NextRequest) {
  const admin = getAdmin();
  const { searchParams } = new URL(req.url);
  const articleId = searchParams.get("id");

  let article: Record<string, unknown> | null = null;

  if (articleId) {
    const { data } = await admin
      .from("news_items")
      .select("id, title, summary, angle, score, section, url")
      .eq("id", articleId)
      .single();
    article = data;
  } else {
    const { data } = await admin
      .from("news_items")
      .select("id, title, summary, angle, score, section, url")
      .gte("published_at", new Date(Date.now() - 24 * 3600000).toISOString())
      .gte("score", 70)
      .order("score", { ascending: false })
      .limit(1)
      .single();
    article = data;
  }

  if (!article) {
    return NextResponse.json({ error: "no_article_found" }, { status: 404 });
  }

  const result = await callOpenAIJSON<{
    variants: Array<{ style: string; text: string }>;
    hashtags: string[];
    best_time: string;
  }>({
    apiKey: process.env.OPENAI_API_KEY!,
    system: TWEET_SYSTEM,
    user: `Title: ${article.title}\nConspiracy angle: ${article.angle}\nThreat score: ${article.score}%\nSection: ${article.section}\nSummary: ${article.summary}`,
    maxTokens: 600,
    model: "gpt-4o-mini",
  });

  const boardUrl = `${SITE_URL}/board/${article.id}`;

  return NextResponse.json({
    article: {
      id: article.id,
      title: article.title,
      score: article.score,
      section: article.section,
      board_url: boardUrl,
    },
    variants: result.variants.map((v) => ({
      style: v.style,
      text: v.text,
      full_tweet: `${v.text}\n\n${boardUrl}\n\n${result.hashtags.map((h: string) => `#${h.replace(/^#/, "")}`).join(" ")}`,
      char_count: `${v.text}\n\n${boardUrl}\n\n${result.hashtags.map((h: string) => `#${h.replace(/^#/, "")}`).join(" ")}`.length,
      twitter_intent_url: `https://twitter.com/intent/tweet?text=${encodeURIComponent(`${v.text}\n\n${boardUrl}\n\n${result.hashtags.map((h: string) => `#${h.replace(/^#/, "")}`).join(" ")}`)}`,
    })),
    hashtags: result.hashtags,
    best_time: result.best_time,
  });
}
