/** Shared, deterministic labels for the publication and its reading views. */
export function publicationDate(value?: string | null): string {
  if (!value) return "Date unavailable";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date unavailable";
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(date);
}
export function readingMinutes(text: string): number {
  const words = text.replace(/!\[[^\]]*\]\([^)]*\)/g, "").trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 220));
}
export function sourceDomain(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, ""); }
  catch { return "Original source"; }
}
export function safeSourceUrl(value?: string | null): string | undefined {
  if (!value) return undefined;
  try { const url = new URL(value); return /^(https?:)$/.test(url.protocol) ? url.toString() : undefined; }
  catch { return undefined; }
}
export function sectionLabel(value: string): string {
  if (value.toLowerCase() === "ai") return "AI & technology";
  if (/^(uap|ufo)$/i.test(value)) return value.toUpperCase();
  return value.replace(/[_-]/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}
