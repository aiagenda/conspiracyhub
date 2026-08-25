import { searchBraveImages } from "@/lib/braveImageSearch";

/** Extract inline images from HTML and inject into markdown after H2 sections (Medium-style). */

export type SourceImage = {
  url: string;
  caption?: string;
  credit?: string;
};

export type ImageSlot = {
  /** 1-based index of ## section after whose first paragraph to place the image. */
  after_h2_index: number;
  search_query: string;
  caption: string;
};

export type ResolvedImagePlacement = {
  afterH2Index: number;
  url: string;
  caption: string;
};

const BLOCKED_HOSTS = /(?:gravatar|pixel|tracking|analytics|doubleclick|facebook\.com|fbcdn)/i;
const BLOCKED_EXT = /\.(?:svg|gif|ico)(?:\?|$)/i;
/** Skip obvious thumbs / tracking pixels in article inline slots. */
function isLikelyTinyImageUrl(url: string): boolean {
  const pathDim = url.match(/(?:^|[/?&=])(\d{1,3})x(\d{1,3})(?:[/?&]|$)/i);
  if (pathDim) {
    const w = parseInt(pathDim[1], 10);
    const h = parseInt(pathDim[2], 10);
    if (w < 320 || h < 200) return true;
  }
  const wParam = url.match(/(?:^|[?&])width=(\d{1,3})(?:&|$)/i)?.[1];
  if (wParam && parseInt(wParam, 10) < 320) return true;
  return false;
}

export function isUsableArticleImageUrl(url: string): boolean {
  if (!url || !/^https?:\/\//i.test(url)) return false;
  if (BLOCKED_HOSTS.test(url) || BLOCKED_EXT.test(url)) return false;
  if (isLikelyTinyImageUrl(url)) return false;
  return true;
}

/** og:image / twitter:image from full page HTML (head — not inside `<article>`). */
export function extractOgImageFromHtml(html: string): string | null {
  const patterns = [
    /<meta[^>]+property=["']og:image(?::secure_url)?["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image(?::secure_url)?["']/i,
    /<meta[^>]+name=["']twitter:image(?::src)?["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image(?::src)?["']/i,
  ];
  for (const re of patterns) {
    const m = html.match(re);
    const u = normalizeImageUrl(m?.[1] ?? "");
    if (u) return u;
  }
  return null;
}

export function normalizeImageUrl(raw: string, baseUrl?: string): string | null {
  let url = raw.replace(/&amp;/g, "&").trim();
  if (!url) return null;
  if (url.startsWith("//")) url = `https:${url}`;
  if (url.startsWith("/") && baseUrl) {
    try {
      url = new URL(url, baseUrl).href;
    } catch {
      return null;
    }
  }
  if (!/^https?:\/\//i.test(url)) return null;
  if (BLOCKED_HOSTS.test(url) || BLOCKED_EXT.test(url)) return null;
  if (!isUsableArticleImageUrl(url)) return null;
  return url;
}

/** Pull `<img>` and Guardian-style `<figure>` images from article HTML. */
export function extractImagesFromHtml(html: string, pageUrl?: string): SourceImage[] {
  const seen = new Set<string>();
  const out: SourceImage[] = [];

  const push = (url: string, caption?: string, credit?: string) => {
    const norm = normalizeImageUrl(url, pageUrl);
    if (!norm || seen.has(norm)) return;
    seen.add(norm);
    out.push({ url: norm, caption: caption?.trim(), credit: credit?.trim() });
  };

  for (const m of html.matchAll(/<figure[^>]*>([\s\S]*?)<\/figure>/gi)) {
    const block = m[1];
    const src =
      block.match(/<img[^>]+src=["']([^"']+)["']/i)?.[1] ??
      block.match(/data-src=["']([^"']+)["']/i)?.[1];
    const cap = block.match(/<figcaption[^>]*>([\s\S]*?)<\/figcaption>/i)?.[1];
    if (src) push(src, cap ? stripTags(cap) : undefined);
  }

  for (const m of html.matchAll(/<img[^>]+>/gi)) {
    const tag = m[0];
    const src = tag.match(/(?:src|data-src)=["']([^"']+)["']/i)?.[1];
    const alt = tag.match(/alt=["']([^"']*)["']/i)?.[1];
    if (src) push(src, alt ? stripTags(alt) : undefined);
  }

  return out.slice(0, 8);
}

function stripTags(s: string): string {
  return s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

export function countH2Sections(markdown: string): number {
  return (markdown.match(/^## /gm) ?? []).length;
}

/** H2 section indices (1-based) suitable for inline photos — skips TL;DR / FAQ blocks. */
export function pickImageH2Targets(markdown: string, max = 3): number[] {
  const skip = /^(tl;dr|faq|related investigations|related articles|sources)/i;
  const headings: number[] = [];
  let n = 0;
  for (const m of markdown.matchAll(/^## +(.+)$/gm)) {
    n += 1;
    const title = m[1]?.trim() ?? "";
    if (!skip.test(title)) headings.push(n);
  }
  if (!headings.length) return [];
  if (headings.length <= max) return headings;
  const out = [headings[0]];
  if (max >= 2) out.push(headings[Math.floor(headings.length / 2)]);
  if (max >= 3) out.push(headings[headings.length - 1]);
  return [...new Set(out)].slice(0, max);
}

/** Map planned slots onto real content H2 indices (skip TL;DR / FAQ). */
export function remapSlotsToContentH2(slots: ImageSlot[], markdown: string): ImageSlot[] {
  const targets = pickImageH2Targets(markdown, slots.length);
  if (!targets.length) return [];
  return slots.slice(0, targets.length).map((slot, i) => ({
    ...slot,
    after_h2_index: targets[i] ?? slot.after_h2_index,
  }));
}

/** Adjust slot indices when the article has fewer H2 sections than planned. */
export function normalizeImageSlots(slots: ImageSlot[], h2Count: number): ImageSlot[] {
  if (h2Count <= 0) return [];
  return slots.slice(0, 3).map((slot, i) => {
    let idx = slot.after_h2_index;
    if (i === 2 && idx > h2Count) idx = h2Count;
    if (i === 1 && idx > h2Count) idx = Math.max(1, h2Count - 1);
    if (idx < 1) idx = 1;
    if (idx > h2Count) idx = h2Count;
    return { ...slot, after_h2_index: idx };
  });
}

/** First markdown image URL in content, if any. */
export function firstMarkdownImageUrl(markdown: string): string | null {
  const m = markdown.match(/!\[[^\]]*\]\((https?:\/\/[^)\s]+)\)/);
  return m?.[1] ?? null;
}

/** Insert markdown image + italic caption after the first paragraph of selected H2 sections. */
export function injectInlineImages(
  markdown: string,
  placements: ResolvedImagePlacement[],
): string {
  if (!placements.length) return markdown;

  const sections = markdown.split(/(?=^## )/m);
  const hasLeadingIntro = sections.length > 0 && !sections[0].trimStart().startsWith("##");
  const h2SectionOffset = hasLeadingIntro ? 1 : 0;

  const sorted = [...placements].sort((a, b) => b.afterH2Index - a.afterH2Index);

  for (const p of sorted) {
    const sectionIdx = h2SectionOffset + (p.afterH2Index - 1);
    if (sectionIdx < 0 || sectionIdx >= sections.length) continue;

    const section = sections[sectionIdx];
    if (!section.trimStart().startsWith("##")) continue;

    const lines = section.split("\n");
    let i = 1;
    while (i < lines.length && lines[i].trim() === "") i++;
    while (i < lines.length && lines[i].trim() !== "" && !lines[i].startsWith("#")) i++;

    const safeCaption = p.caption.replace(/[\[\]*_`]/g, "").trim() || "Illustration";
    const block = `\n\n![${safeCaption}](${p.url})\n\n*${safeCaption}*\n`;

    sections[sectionIdx] = [...lines.slice(0, i), block.trim(), ...lines.slice(i)].join("\n");
  }

  return sections.join("");
}

/** Resolve image slots: prefer source photos, then Brave Image Search. */
export async function resolveImagePlacements(
  slots: ImageSlot[],
  sourceImages: SourceImage[],
  sourceLabel: string,
): Promise<ResolvedImagePlacement[]> {
  const used = new Set<string>();
  const out: ResolvedImagePlacement[] = [];
  let sourceIdx = 0;

  for (const slot of slots.slice(0, 3)) {
    let url: string | null = null;
    let caption = slot.caption?.trim() || slot.search_query;

    while (sourceIdx < sourceImages.length && !url) {
      const candidate = sourceImages[sourceIdx++];
      if (!used.has(candidate.url)) {
        url = candidate.url;
        if (candidate.caption) caption = candidate.caption;
        else if (candidate.credit) caption = `${candidate.credit} — via ${sourceLabel}`;
      }
    }

    if (!url && slot.search_query?.trim()) {
      const results = await searchBraveImages(slot.search_query, 4);
      for (const r of results) {
        if (!used.has(r.url)) {
          url = r.url;
          if (r.title && !slot.caption) caption = r.title;
          break;
        }
      }
    }

    if (!url) continue;
    used.add(url);
    if (
      sourceLabel.trim() &&
      !caption.toLowerCase().includes("source") &&
      !caption.toLowerCase().includes("via")
    ) {
      caption = `${caption} — via ${sourceLabel}`;
    }
    out.push({
      afterH2Index: slot.after_h2_index,
      url,
      caption,
    });
  }

  return out;
}

/** Tech articles: Brave for every slot; at most one source photo on the first slot. */
export async function resolveTechImagePlacements(
  slots: ImageSlot[],
  sourceImages: SourceImage[],
  sourceLabel: string,
  fallbackKeyword: string,
): Promise<ResolvedImagePlacement[]> {
  const used = new Set<string>();
  const out: ResolvedImagePlacement[] = [];
  const usableSource = sourceImages.filter((s) => isUsableArticleImageUrl(s.url));

  async function braveFor(query: string): Promise<string | null> {
    const q = query.trim();
    if (!q) return null;
    for (const searchQ of [q, `${fallbackKeyword} ${q}`.trim(), fallbackKeyword.trim()]) {
      if (!searchQ) continue;
      const results = await searchBraveImages(searchQ, 6);
      for (const r of results) {
        if (!used.has(r.url) && isUsableArticleImageUrl(r.url)) return r.url;
      }
    }
    return null;
  }

  for (let i = 0; i < slots.slice(0, 3).length; i += 1) {
    const slot = slots[i];
    let url: string | null = null;
    let caption = slot.caption?.trim() || slot.search_query;

    if (i === 0 && usableSource.length) {
      url = usableSource.find((s) => !used.has(s.url))?.url ?? null;
      if (url) {
        const src = usableSource.find((s) => s.url === url);
        if (src?.caption) caption = src.caption;
      }
    }

    if (!url) url = await braveFor(slot.search_query);

    if (!url) continue;
    used.add(url);
    out.push({ afterH2Index: slot.after_h2_index, url, caption });
  }

  if (out.length === 0 && slots.length > 0) {
    const url = await braveFor(fallbackKeyword || "artificial intelligence technology");
    if (url) {
      out.push({
        afterH2Index: slots[0].after_h2_index,
        url,
        caption: `${fallbackKeyword || "Technology"} — illustration`,
      });
    }
  }

  return out;
}
