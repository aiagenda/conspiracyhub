/** Last opened article/board — localStorage for guests; sync via API when signed in. */

export const CONTINUE_READING_EVENT = "theorist-continue-reading-changed";
const STORAGE_KEY = "theorist-continue-reading";

export type ContinueReadingEntry = {
  newsId?: string;
  generatedArticleId?: string;
  title: string;
  path: string;
  score?: number;
  at: number;
};

function readRaw(): ContinueReadingEntry | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const o = JSON.parse(raw) as ContinueReadingEntry;
    if (!o?.title || !o?.path) return null;
    return o;
  } catch {
    return null;
  }
}

export function getContinueReading(): ContinueReadingEntry | null {
  return readRaw();
}

export function setContinueReading(entry: Omit<ContinueReadingEntry, "at">): void {
  if (typeof window === "undefined") return;
  try {
    const payload: ContinueReadingEntry = { ...entry, at: Date.now() };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    window.dispatchEvent(new CustomEvent(CONTINUE_READING_EVENT));
  } catch {
    /* ignore */
  }
}

export function clearContinueReading(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(STORAGE_KEY);
    window.dispatchEvent(new CustomEvent(CONTINUE_READING_EVENT));
  } catch {
    /* ignore */
  }
}

export async function pushContinueReadingToServer(entry: Omit<ContinueReadingEntry, "at">): Promise<void> {
  try {
    const { getSupabaseBrowserClient } = await import("@/lib/supabase");
    const supabase = getSupabaseBrowserClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.access_token) return;
    await fetch("/api/reading-state", {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        newsId: entry.newsId,
        generatedArticleId: entry.generatedArticleId,
        title: entry.title,
        path: entry.path,
        score: entry.score,
      }),
    });
  } catch {
    /* ignore */
  }
}

/** Persist locally and sync to account when signed in. */
export function trackContinueReading(entry: Omit<ContinueReadingEntry, "at">): void {
  setContinueReading(entry);
  void pushContinueReadingToServer(entry);
}
