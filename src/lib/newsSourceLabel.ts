/** Human-readable outlet label for source attribution on feed articles. */
export function newsSourceLabel(source?: string | null, url?: string | null): string {
  const s = (source ?? "").toLowerCase();
  if (s === "guardian") return "The Guardian";
  if (s.startsWith("reddit")) return "Reddit";
  if (s.startsWith("gnews")) return "Google News";
  if (s === "muckrock") return "MuckRock";
  if (s === "intercept") return "The Intercept";
  if (s === "propublica") return "ProPublica";
  if (s === "bellingcat") return "Bellingcat";
  if (s === "eff") return "EFF";

  if (url) {
    try {
      const host = new URL(url).hostname.replace(/^www\./, "");
      if (host.includes("theguardian.com")) return "The Guardian";
      if (host.includes("reddit.com")) return "Reddit";
      if (host.includes("nytimes.com")) return "The New York Times";
      if (host.includes("reuters.com")) return "Reuters";
      if (host.includes("bbc.")) return "BBC";
      return host;
    } catch {
      /* ignore */
    }
  }

  return "Original source";
}
