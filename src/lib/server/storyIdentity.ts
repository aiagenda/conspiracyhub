import { createHash } from "node:crypto";
import { canonicalSourceUrl } from "../editorialQuality";

export function sourceIdentity(source: string, url: string): string {
  const canonical = canonicalSourceUrl(url);
  if (!canonical) throw new Error("invalid_source_url");
  return `${source}-${createHash("sha256").update(canonical).digest("hex")}`;
}

export function storySlug(topic: string, primaryUrl?: string): string {
  const title = topic.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 72) || "investigation";
  const identity = primaryUrl ? canonicalSourceUrl(primaryUrl) : topic.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  return `${title}-${createHash("sha256").update(identity).digest("hex").slice(0, 12)}`;
}

export function sameStoryTitle(a: string, b: string): boolean {
  const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  return normalize(a) === normalize(b);
}
