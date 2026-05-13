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
    // modes: 'news_jacking' | 'evergreen' | 'uap_incident' | 'oracle_deep_dive' | 'reference_doc'
    const mode = body.mode ?? "news_jacking";

    let prompt = "";

    if (mode === "news_jacking") {
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

    } else if (mode === "uap_incident") {
      // Pick a high-upvote UAP sighting and write a deep-dive around it
      const { data: sightings } = await admin
        .from("uap_sightings")
        .select("id, title, description, location_name, event_date, shape, duration_text, witness_count, classification, source_url")
        .eq("status", "active")
        .not("description", "eq", "")
        .order("upvotes", { ascending: false })
        .limit(20);

      if (!sightings?.length) {
        return NextResponse.json({ error: "no_uap_sightings" }, { status: 404 });
      }

      // Random pick from top 20 to avoid always writing about the same incident
      const pick = sightings[Math.floor(Math.random() * sightings.length)];
      const dateStr = pick.event_date ? new Date(pick.event_date).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }) : "unknown date";

      prompt = `Write a compelling investigative deep-dive article about this specific UAP incident.

Incident details:
- Title: "${pick.title}"
- Date: ${dateStr}
- Location: ${pick.location_name ?? "undisclosed location"}
- Object shape: ${pick.shape ?? "not specified"}
- Duration: ${pick.duration_text ?? "not recorded"}
- Witnesses: ${pick.witness_count ?? "unknown number of"}
- Classification: ${pick.classification}
- Witness description: "${pick.description?.slice(0, 500)}"
${pick.source_url ? `- Source report: ${pick.source_url}` : ""}

The article should:
1. Set the scene — location, date, what the witnesses reported
2. Compare this incident to known, documented UAP cases (AARO, Project Blue Book, NUFORC patterns)
3. Examine possible explanations: experimental craft, natural phenomena, misidentification — and why each falls short
4. Cross-reference with any known government programs or patents related to the object's described shape/behavior
5. Discuss what official bodies (AARO, DoD, FAA) have or haven't said about incidents in this area
6. End with open questions for readers to investigate

Internal links: reference "${SITE_URL}/uap" for the UAP files page.`;

    } else if (mode === "oracle_deep_dive") {
      // Take an existing Oracle AI analysis and expand it into a full article
      const { data: analyses } = await admin
        .from("oracle_analyses")
        .select("id, nodes, theories, conclusion, verdict, news_items(title, url, summary, angle, score, section)")
        .order("created_at", { ascending: false })
        .limit(30);

      if (!analyses?.length) {
        return NextResponse.json({ error: "no_oracle_analyses" }, { status: 404 });
      }

      const pick = analyses[Math.floor(Math.random() * analyses.length)];
      const newsRaw = pick.news_items;
      const news = (Array.isArray(newsRaw) ? newsRaw[0] : newsRaw) as { title: string; url: string; summary: string; angle: string; score: number; section: string } | null;
      const theories = Array.isArray(pick.theories) ? pick.theories.slice(0, 3) : [];
      const theoryNames = theories.map((t: { name?: string }) => t.name ?? "").filter(Boolean).join(", ");

      prompt = `Write a comprehensive investigative article that expands on an AI Oracle analysis of a news story.

Source article: "${news?.title ?? "Classified"}"
Original URL: ${news?.url ?? ""}
Threat assessment: ${news?.score ?? "?"}%
AI Oracle verdict: "${pick.verdict}"
AI Oracle conclusion: "${pick.conclusion}"
Identified conspiracy theories: ${theoryNames || "government cover-up"}
${news?.angle ? `Conspiracy angle: "${news.angle}"` : ""}

The article should:
1. Explain the original news story and its threat assessment context
2. Deep-dive into each identified conspiracy theory — its origins, evidence base, key proponents
3. Cross-reference with known declassified documents, FOIA releases, or Congressional testimony
4. Analyze the nodes in the investigation graph (key actors, organizations, technologies)
5. Present the AI Oracle verdict and explain why the evidence points this way
6. End with concrete steps readers can take to investigate further

Internal links: reference "${SITE_URL}/board" for the AI investigation board, "${SITE_URL}/uap" for UAP content.`;

    } else if (mode === "reference_doc") {
      // Pick a declassified document / agency from reference_documents and write about it
      const { data: docs } = await admin
        .from("reference_documents")
        .select("id, agency, title, canonical_url, excerpt, year")
        .order("id") // stable order, then random slice
        .limit(100);

      if (!docs?.length) {
        return NextResponse.json({ error: "no_reference_documents" }, { status: 404 });
      }

      const pick = docs[Math.floor(Math.random() * docs.length)];

      prompt = `Write a deep-dive investigative article about this declassified government document or program.

Document / program: "${pick.title}"
Agency: ${pick.agency}
Official URL: ${pick.canonical_url}
${pick.year ? `Year: ${pick.year}` : ""}
${pick.excerpt ? `Description: "${pick.excerpt}"` : ""}

The article should:
1. Explain what this document/program is and why it matters
2. Summarize the key declassified revelations — what was hidden and what we now know
3. Investigate the conspiracy theories that surround it — what critics and researchers claim
4. Cross-reference with other known programs, patents, or Congressional testimony from the same era
5. Explain why this is still relevant today — ongoing implications, unanswered questions
6. End with a call to readers to explore the original documents themselves

Include the official source URL prominently. Internal links: reference "${SITE_URL}/search" for the document search tool, "${SITE_URL}/board" for the investigation board.`;

    } else {
      // Evergreen: classic under-covered conspiracy topic
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
        "HAARP: ionospheric research weapon or weather control program?",
        "Project PRISM and mass surveillance: what Snowden's documents revealed",
        "The Pentagon's secret UFO program (AATIP): timeline and key witnesses",
        "MKNaomi and biological weapons: the CIA's secret experiments",
        "Operation Mockingbird: the CIA's media infiltration program",
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
