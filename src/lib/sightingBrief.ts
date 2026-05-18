import { callOpenAIJSON } from "@/lib/openai";
import type { NuforcContentKind } from "@/lib/nuforcContent";

export const SIGHTING_BRIEF_MIN_PLAIN = 1200;
export const SIGHTING_PREVIEW_CHARS = 580;

const SYSTEM_BRIEF = `You write factual intelligence briefs for a UAP research site. LANGUAGE: English only.

Given a NUFORC post title and body text, produce a SHORT site summary — not creative writing, not speculation beyond the source.

Rules:
- 3 to 6 bullet points, each one short sentence (max ~22 words)
- Stick to facts stated in the source (who, what, where, when, shape, outcome)
- For multi-case digest posts, summarize the theme plus 1 line per highlighted case if space allows
- Do NOT invent witnesses, agencies, or conclusions not in the text
- End with nothing — bullets only

Return ONLY valid JSON:
{ "bullets": ["...", "..."] }`;

export function shouldStoreBrief(
  contentKind: NuforcContentKind,
  plainLength: number,
): boolean {
  if (plainLength < SIGHTING_BRIEF_MIN_PLAIN) return false;
  return contentKind === "blog" || contentKind === "case" || contentKind === "report";
}

export function bulletsToBriefText(bullets: string[]): string {
  return bullets
    .map((b) => b.trim())
    .filter(Boolean)
    .map((b) => (b.startsWith("-") || b.startsWith("•") ? b : `- ${b}`))
    .join("\n");
}

export function parseBriefBullets(brief: string): string[] {
  return brief
    .split(/\n+/)
    .map((l) => l.replace(/^[-•*]\s*/, "").trim())
    .filter(Boolean);
}

/** Heuristic brief when OpenAI is unavailable. */
export function buildLocalBrief(plain: string, title: string): string {
  const t = plain.replace(/\r\n/g, "\n").trim();
  const paras = t.split(/\n{2,}/).map((p) => p.replace(/\s+/g, " ").trim()).filter(Boolean);
  const bullets: string[] = [];

  if (title.length > 8 && title.length < 120) {
    bullets.push(title.replace(/\s+/g, " "));
  }

  for (const p of paras.slice(0, 4)) {
    if (bullets.length >= 5) break;
    const sentences = p.match(/[^.!?]+[.!?]+/g) ?? [p];
    const s = (sentences[0] ?? p).trim();
    if (s.length > 30 && s.length < 220) bullets.push(s);
  }

  if (bullets.length === 0 && t.length > 40) {
    bullets.push(t.slice(0, 200).trim() + (t.length > 200 ? "…" : ""));
  }

  return bulletsToBriefText(bullets.slice(0, 5));
}

export async function generateSightingBrief(
  plain: string,
  title: string,
  contentKind: NuforcContentKind,
): Promise<string | null> {
  const trimmed = plain.replace(/\r\n/g, "\n").trim();
  if (!shouldStoreBrief(contentKind, trimmed.length)) return null;

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return buildLocalBrief(trimmed, title);
  }

  const excerpt = trimmed.length > 12000 ? trimmed.slice(0, 12000) + "…" : trimmed;

  try {
    const result = await callOpenAIJSON<{ bullets: string[] }>({
      apiKey,
      system: SYSTEM_BRIEF,
      user: `Title: ${title}\nContent kind: ${contentKind}\n\nBody:\n${excerpt}`,
      maxTokens: 450,
      model: "gpt-4o-mini",
    });
    const bullets = (result.bullets ?? []).filter((b) => typeof b === "string" && b.trim());
    if (bullets.length === 0) return buildLocalBrief(trimmed, title);
    return bulletsToBriefText(bullets.slice(0, 6));
  } catch {
    return buildLocalBrief(trimmed, title);
  }
}

export function previewPlainText(plain: string, maxChars = SIGHTING_PREVIEW_CHARS): string {
  const t = plain.replace(/\r\n/g, "\n").trim();
  if (t.length <= maxChars) return t;
  let cut = t.slice(0, maxChars);
  const sent = cut.lastIndexOf(". ");
  if (sent > maxChars * 0.55) cut = cut.slice(0, sent + 1);
  else {
    const sp = cut.lastIndexOf(" ");
    if (sp > maxChars * 0.7) cut = cut.slice(0, sp);
  }
  return cut.trim() + "…";
}

export function shouldDefaultToBriefView(
  summaryBrief: string | null | undefined,
  bodyLength: number,
): boolean {
  if (!summaryBrief?.trim()) return false;
  return bodyLength >= SIGHTING_BRIEF_MIN_PLAIN;
}
