import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { callOpenAIJSON } from "@/lib/openai";

export const maxDuration = 120;

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://the-theorist.com";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80)
    .replace(/-$/, "");
}

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  );
}

const ARTICLE_SYSTEM = `You are a senior investigative journalist specializing in conspiracy theories, government cover-ups, and declassified intelligence. You write long-form SEO-optimized analysis articles for The Theorist.

Write in English. Be factual, reference real documents and events. Your articles should:
- Have a compelling, SEO-friendly title with the main topic keyword
- Be 1200-1600 words
- Use H2 and H3 subheadings naturally throughout
- Include real references (CIA FOIA, Pentagon, Congressional testimony, patents)
- Analyze conspiracy theories critically — what evidence exists, what is speculation
- End with open questions that invite readers to investigate further

Return ONLY valid JSON (no markdown outside the JSON):
{
  "title": "SEO-optimized title (60 chars max)",
  "slug": "url-friendly-slug",
  "meta_description": "155 char SEO description",
  "focus_keyword": "main keyword phrase",
  "secondary_keywords": ["keyword2", "keyword3", "keyword4"],
  "content": "Full article in markdown format with ## and ### headings",
  "excerpt": "2-3 sentence teaser for the article",
  "category": "uap|biotech|surveillance|finance|politics|technology",
  "tags": ["tag1", "tag2", "tag3", "tag4", "tag5"],
  "sources": [
    {"title": "Source name", "url": "https://...", "description": "Why cited"}
  ]
}`;

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const secret = authHeader?.replace(/^Bearer\s+/i, "") ?? "";
  if (secret !== process.env.CRON_SECRET && process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const admin = getAdmin();
    const body = await req.json().catch(() => ({}));
    const mode = body.mode ?? "news_jacking"; // 'news_jacking' | 'evergreen'

    let prompt = "";

    if (mode === "news_jacking") {
      // Get today's highest-scoring articles
      const { data: topNews } = await admin
        .from("news_items")
        .select("id, title, summary, angle, score, section, url")
        .gte("score", 65)
        .gte("published_at", new Date(Date.now() - 48 * 3600000).toISOString())
        .order("score", { ascending: false })
        .limit(5);

      if (!topNews?.length) {
        return NextResponse.json({ error: "no_qualifying_articles" }, { status: 404 });
      }

      const top = topNews[0];
      prompt = `Write a deep-dive investigative analysis article about this news story from a conspiracy theory angle.

News title: "${top.title}"
Conspiracy angle: "${top.angle || "Government cover-up or hidden agenda"}"
Threat score: ${top.score}%
Section: ${top.section}
Summary: ${top.summary}

The article should:
1. Start by explaining the news story and why it matters
2. Investigate the conspiracy angles — what do people claim, what evidence exists
3. Cross-reference with known government programs, patents, or declassified documents
4. Analyze who benefits from this if the conspiracy theory is true
5. Evaluate the credibility: what is documented vs speculative
6. End with open questions for readers to investigate

Internal link opportunity: reference "${SITE_URL}/board" for the AI investigation board.
Related article: ${top.url}`;

    } else {
      // Evergreen: pick a classic under-covered conspiracy topic
      const EVERGREEN_TOPICS = [
        "The CIA's MKULTRA program: what the declassified documents actually reveal",
        "Pentagon UAP programs: a complete timeline of what we know",
        "Operation Paperclip: how the US government recruited Nazi scientists",
        "The Church Committee revelations: how the CIA spied on Americans",
        "DARPA's most controversial projects: what they're working on right now",
        "The Tuskegee Syphilis Study and other real government medical experiments",
        "Echelon: the global surveillance network governments don't talk about",
        "Bioweapon treaties and violations: the documented history",
        "The Federal Reserve: who actually controls the US money supply",
        "Operation Northwoods: the declassified false flag plan the JFK administration rejected",
      ];
      const topic = EVERGREEN_TOPICS[Math.floor(Math.random() * EVERGREEN_TOPICS.length)];
      prompt = `Write a comprehensive, SEO-optimized deep-dive article about: "${topic}"

Requirements:
1. Use only verified, documented information — cite real declassified documents, FOIA releases, Congressional records
2. Be thorough and educational — readers should feel they learned something real
3. Include specific dates, names, document numbers where possible
4. Acknowledge what is proven vs what is still disputed
5. Include a section on why this matters today

Internal link: reference "${SITE_URL}/uap" for UAP topics, "${SITE_URL}/board" for investigation tools.`;
    }

    // Generate article
    const article = await callOpenAIJSON<{
      title: string; slug: string; meta_description: string;
      focus_keyword: string; secondary_keywords: string[];
      content: string; excerpt: string; category: string;
      tags: string[]; sources: Array<{title:string;url:string;description:string}>;
    }>({
      apiKey: process.env.OPENAI_API_KEY!,
      system: ARTICLE_SYSTEM,
      user: prompt,
      maxTokens: 3000,
      model: "gpt-4o",
    });

    // Ensure unique slug
    const baseSlug = slugify(article.slug || article.title);
    const finalSlug = `${baseSlug}-${Date.now().toString(36)}`;

    // Insert into DB
    const { data: inserted, error } = await admin
      .from("generated_articles")
      .insert({
        title: article.title,
        slug: finalSlug,
        meta_description: article.meta_description,
        focus_keyword: article.focus_keyword,
        secondary_keywords: article.secondary_keywords ?? [],
        content: article.content,
        excerpt: article.excerpt,
        category: article.category,
        tags: article.tags ?? [],
        sources: article.sources ?? [],
        mode,
        status: "published",
        published_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({
      success: true,
      article: { id: inserted.id, title: article.title, slug: finalSlug, url: `${SITE_URL}/blog/${finalSlug}` },
    });

  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  return POST(req);
}
