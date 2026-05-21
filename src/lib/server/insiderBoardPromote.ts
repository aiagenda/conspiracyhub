import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { callOpenAIJSON } from "@/lib/openai";
import {
  INSIDER_CACHE_ID,
  type InsiderPostRow,
  type InsiderRadarPayload,
} from "@/lib/server/insiderRadarIngest";

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.the-theorist.com").replace(/\/$/, "");
const SIGNAL_MAX_AGE_DAYS = 7;

const INSIDER_BOARD_SYSTEM = `You turn an insider social post (X/Twitter or YouTube) into a feed board article for The Theorist — an investigation platform for UAP, conspiracy, and outbreak news.

LANGUAGE: English only.

Given the post text and author, write a board entry — NOT a copy-paste of the post.

Return ONLY valid JSON:
{
  "title": "clear headline under 120 chars — news style, not tweet voice",
  "summary": "2-3 sentences expanding context and why investigators care",
  "angle": "one-line conspiracy/investigation angle max 12 words",
  "score": 0-100
}

Rules:
- title must stand alone as a feed headline
- summary adds context the tweet doesn't spell out
- score reflects conspiracy/investigation relevance (most insider UAP posts: 55-85)
- do NOT use marketing language`;

export type InsiderSignalRow = {
  signal_key: string;
  tracker_id: string;
  tracker_name: string;
  tracker_type: string;
  category: string;
  title: string;
  url: string;
  published: string;
  promoted: boolean;
  board_id: string | null;
  board_url: string | null;
};

function adminClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) throw new Error("Missing Supabase env");
  return createClient(url, key);
}

export function insiderGuardianId(postUrl: string): string {
  const statusMatch = postUrl.match(/status\/(\d+)/i);
  if (statusMatch) return `insider-x-${statusMatch[1]}`;
  const ytMatch = postUrl.match(/[?&]v=([^&]+)/) ?? postUrl.match(/youtu\.be\/([^?]+)/);
  if (ytMatch) return `insider-yt-${ytMatch[1]}`;
  const b64 = Buffer.from(postUrl).toString("base64url").slice(0, 40);
  return `insider-${b64}`;
}

function sectionForCategory(category: string): string {
  const c = category.toLowerCase();
  if (c.includes("uap") || c.includes("ufo")) return "uap";
  if (c.includes("outbreak") || c.includes("health")) return "health";
  if (c.includes("intel")) return "intelligence";
  return "insider";
}

function isFreshSignal(published: string): boolean {
  const ts = new Date(published).getTime();
  if (Number.isNaN(ts)) return false;
  return Date.now() - ts <= SIGNAL_MAX_AGE_DAYS * 24 * 3600_000;
}

async function loadInsiderPosts(admin: SupabaseClient): Promise<InsiderPostRow[]> {
  const { data } = await admin
    .from("insider_radar_cache")
    .select("data")
    .eq("id", INSIDER_CACHE_ID)
    .maybeSingle();
  const payload = data?.data as InsiderRadarPayload | undefined;
  return payload?.posts ?? [];
}

async function loadPromotedKeys(admin: SupabaseClient): Promise<Map<string, string>> {
  const { data } = await admin
    .from("news_items")
    .select("id, guardian_id")
    .like("guardian_id", "insider-%")
    .limit(500);
  const map = new Map<string, string>();
  for (const row of data ?? []) {
    const gid = String(row.guardian_id ?? "");
    if (gid) map.set(gid, String(row.id));
  }
  return map;
}

export async function listInsiderSignals(limit = 20): Promise<{
  signals: InsiderSignalRow[];
  total: number;
}> {
  const admin = adminClient();
  const [posts, promoted] = await Promise.all([loadInsiderPosts(admin), loadPromotedKeys(admin)]);

  const signals: InsiderSignalRow[] = [];
  for (const post of posts) {
    if (post.tracker_type !== "twitter") continue;
    if (!isFreshSignal(post.published)) continue;
    const title = String(post.title ?? "").trim();
    if (title.length < 12) continue;

    const signalKey = insiderGuardianId(post.url);
    const boardId = promoted.get(signalKey) ?? null;

    signals.push({
      signal_key: signalKey,
      tracker_id: post.tracker_id,
      tracker_name: post.tracker_name,
      tracker_type: post.tracker_type,
      category: post.category,
      title,
      url: post.url,
      published: post.published,
      promoted: Boolean(boardId),
      board_id: boardId,
      board_url: boardId ? `${SITE_URL}/board/${boardId}` : null,
    });
  }

  signals.sort((a, b) => new Date(b.published).getTime() - new Date(a.published).getTime());

  const unpromotedFirst = [
    ...signals.filter((s) => !s.promoted),
    ...signals.filter((s) => s.promoted),
  ];

  return {
    signals: unpromotedFirst.slice(0, limit),
    total: signals.length,
  };
}

export async function promoteInsiderToBoard(signalKey: string): Promise<{
  ok: boolean;
  board_id: string;
  board_url: string;
  title: string;
  already_existed: boolean;
}> {
  const admin = adminClient();
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY missing");

  const { data: existing } = await admin
    .from("news_items")
    .select("id, title")
    .eq("guardian_id", signalKey)
    .maybeSingle();

  if (existing?.id) {
    return {
      ok: true,
      board_id: String(existing.id),
      board_url: `${SITE_URL}/board/${existing.id}`,
      title: String(existing.title),
      already_existed: true,
    };
  }

  const posts = await loadInsiderPosts(admin);
  const post = posts.find((p) => insiderGuardianId(p.url) === signalKey);
  if (!post) throw new Error("signal_not_found");

  const generated = await callOpenAIJSON<{
    title: string;
    summary: string;
    angle: string;
    score: number;
  }>({
    apiKey,
    system: INSIDER_BOARD_SYSTEM,
    user: `Author: ${post.tracker_name} (@${post.tracker_id})\nCategory: ${post.category}\nPlatform: ${post.tracker_type}\nPost URL: ${post.url}\nPost text:\n${post.title}`,
    maxTokens: 500,
    model: "gpt-4o-mini",
  });

  const title = String(generated.title ?? "").trim().slice(0, 200);
  const summary = String(generated.summary ?? "").trim();
  const angle = String(generated.angle ?? "").trim();
  const score = Math.min(100, Math.max(0, Math.round(Number(generated.score ?? 65))));

  if (!title) throw new Error("generate_failed");

  const row = {
    guardian_id: signalKey,
    title,
    summary: summary || post.title.slice(0, 400),
    url: post.url,
    image: post.thumbnail ?? null,
    published_at: post.published ? new Date(post.published).toISOString() : new Date().toISOString(),
    section: sectionForCategory(post.category),
    score,
    angle,
    source: `insider:${post.tracker_type}`,
  };

  const { data: inserted, error } = await admin.from("news_items").insert(row).select("id, title").single();
  if (error) throw new Error(error.message);

  return {
    ok: true,
    board_id: String(inserted.id),
    board_url: `${SITE_URL}/board/${inserted.id}`,
    title: String(inserted.title),
    already_existed: false,
  };
}
