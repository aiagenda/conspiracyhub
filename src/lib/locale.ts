/**
 * Drop user-facing copy that uses non–Latin-alphabet scripts (Cyrillic, Arabic, CJK, etc.).
 * Latin + European accents (ä, ö, ü, é, ő, …) are kept so summaries / bodies still render.
 */
const NON_LATIN_SCRIPTS =
  /[\u0400-\u04FF\u0600-\u06FF\u0590-\u05FF\u3040-\u30FF\u4E00-\u9FFF\uAC00-\uD7AF\u0E00-\u0E7F\u0900-\u097F\u0980-\u09FF]/;

/** @deprecated misleading name — filters non-Western scripts only, not “Hungarian”. */
export function omitIfHungarianScript(text: string): string {
  if (!text?.trim()) return "";
  if (NON_LATIN_SCRIPTS.test(text)) return "";
  return text.trim();
}
