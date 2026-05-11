/** Fired on same tab when user reads an article (localStorage updated). */
export const READ_ARTICLES_EVENT = "theorist-read-articles-changed";

const STORAGE_KEY = "theorist-read-articles";
const MAX_IDS = 600;

function parseMap(raw: string | null): Record<string, number> {
  if (!raw) return {};
  try {
    const o = JSON.parse(raw) as unknown;
    if (!o || typeof o !== "object" || Array.isArray(o)) return {};
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(o as Record<string, unknown>)) {
      const n = typeof v === "number" ? v : Number(v);
      if (k && Number.isFinite(n)) out[k] = n;
    }
    return out;
  } catch {
    return {};
  }
}

/** Article ids the user has opened (newest first after prune). */
export function getReadIds(): string[] {
  if (typeof window === "undefined") return [];
  try {
    return Object.keys(parseMap(localStorage.getItem(STORAGE_KEY)));
  } catch {
    return [];
  }
}

export function isArticleRead(id: string): boolean {
  if (typeof window === "undefined" || !id) return false;
  try {
    const m = parseMap(localStorage.getItem(STORAGE_KEY));
    return id in m;
  } catch {
    return false;
  }
}

/** Mark article as read (opened). Prunes to last MAX_IDS by recency. */
export function markArticleRead(id: string): void {
  if (typeof window === "undefined" || !id) return;
  try {
    const map = parseMap(localStorage.getItem(STORAGE_KEY));
    map[id] = Date.now();
    const sorted = Object.entries(map).sort((a, b) => b[1] - a[1]);
    const pruned = Object.fromEntries(sorted.slice(0, MAX_IDS));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(pruned));
    window.dispatchEvent(new CustomEvent(READ_ARTICLES_EVENT));
  } catch {
    /* quota / private mode */
  }
}
