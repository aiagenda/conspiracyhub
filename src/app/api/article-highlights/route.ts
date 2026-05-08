import { NextRequest, NextResponse } from "next/server";
import { callOpenAIJSON } from "@/lib/openai";

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

export async function POST(req: NextRequest) {
  try {
    const { text, title } = await req.json();
    if (!text) return NextResponse.json({ error: "text_required" }, { status: 400 });

    const highlights = await callOpenAIJSON<{
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

    return NextResponse.json(highlights);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[article-highlights]", msg);
    return NextResponse.json({ error: "highlights_failed", message: msg }, { status: 500 });
  }
}
