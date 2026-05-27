export const VISITOR_ID_KEY = "theorist_visitor_id";
const UTM_SESSION_KEY = "theorist_utm";

export type StoredUtm = {
  source?: string;
  medium?: string;
  campaign?: string;
};

export function getOrCreateVisitorId(): string {
  if (typeof window === "undefined") return "server";
  try {
    let id = localStorage.getItem(VISITOR_ID_KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(VISITOR_ID_KEY, id);
    }
    return id;
  } catch {
    return "anonymous";
  }
}

/** Persist UTM params from landing URL for SPA navigations. */
export function captureUtmFromUrl(): void {
  if (typeof window === "undefined") return;
  try {
    const params = new URLSearchParams(window.location.search);
    const next: StoredUtm = {
      source: params.get("utm_source")?.trim() || undefined,
      medium: params.get("utm_medium")?.trim() || undefined,
      campaign: params.get("utm_campaign")?.trim() || undefined,
    };
    if (next.source || next.medium || next.campaign) {
      sessionStorage.setItem(UTM_SESSION_KEY, JSON.stringify(next));
    }
  } catch {
    /* private mode */
  }
}

export function getStoredUtm(): StoredUtm {
  if (typeof window === "undefined") return {};
  try {
    const raw = sessionStorage.getItem(UTM_SESSION_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as StoredUtm;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function deviceTypeFromUserAgent(ua: string): "mobile" | "desktop" | "tablet" | "unknown" {
  if (!ua) return "unknown";
  if (/ipad|tablet|kindle|playbook/i.test(ua)) return "tablet";
  if (/mobile|iphone|ipod|android.*mobile|blackberry|windows phone/i.test(ua)) return "mobile";
  if (/android/i.test(ua)) return "tablet";
  return "desktop";
}
