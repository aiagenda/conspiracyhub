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

/** Named subjects that must not get a second public URL. */
const STORY_TOPICS: Array<[string, RegExp]> = [
  ["adrenochrome", /\badrenochrome\b/],
  ["mkultra", /\bmk[\s-]?ultra\b/],
  ["prism", /\b(?:project\s+)?prism\b/],
  ["echelon", /\bechelon\b/],
  ["paperclip", /\bpaperclip\b/],
  ["northwoods", /\bnorthwoods\b/],
  ["mockingbird", /\bmockingbird\b/],
  ["tartaria", /\btartaria(?:n)?\b/],
  ["cia-reading-room", /cia electronic reading room/],
  ["openai-influencer", /openai\b.{0,40}\binfluencer/],
];

export function storyTopicKey(text: string): string | null {
  const normalized = text.toLowerCase();
  for (const [key, pattern] of STORY_TOPICS) {
    if (pattern.test(normalized)) return key;
  }
  return null;
}
