/** Hide user-facing copy that contains non-ASCII script markers. */
const NON_ASCII_MARKERS = /[^\u0000-\u007F]/;

/** Drop text that contains non-ASCII characters (feed angle / summary lines). */
export function omitIfHungarianScript(text: string): string {
  if (!text?.trim()) return "";
  if (NON_ASCII_MARKERS.test(text)) return "";
  return text;
}
