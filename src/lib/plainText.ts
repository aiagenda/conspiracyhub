function decodeHtmlEntitiesOnce(raw: string): string {
  return raw
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&(lt|gt|quot|apos|nbsp);/gi, (_, name: string) => {
      const map: Record<string, string> = {
        lt: "<",
        gt: ">",
        quot: '"',
        apos: "'",
        nbsp: " ",
      };
      return map[name.toLowerCase()] ?? `&${name};`;
    })
    .replace(/&amp;/gi, "&");
}

/** Strip tags and decode HTML entities (including double-encoded RSS/XML) for plain-text display. */
export function plainTextFromHtml(raw: string): string {
  let t = String(raw ?? "");
  for (let i = 0; i < 6; i++) {
    const next = decodeHtmlEntitiesOnce(t);
    if (next === t) break;
    t = next;
  }
  t = t.replace(/<[^>]+>/g, " ");
  t = t.replace(/<[^>]*$/g, " ");
  return t.replace(/\s+/g, " ").trim();
}

/** Outbreak card/detail blurbs: decode HTML and drop WHO feed metadata noise. */
export function cleanOutbreakBlurb(raw: string): string {
  let t = plainTextFromHtml(raw);
  t = t.replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "");
  t = t.replace(
    /\b(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun),?\s+\d{1,2}[/-]\d{1,2}[/-]\d{2,4}(?:\s*[-–]\s*\d{1,2}:\d{2})?/gi,
    "",
  );
  return t.replace(/\s+/g, " ").trim();
}
