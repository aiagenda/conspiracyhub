import type { SupabaseClient } from "@supabase/supabase-js";
import { callOpenAIJSON } from "@/lib/openai";
import { readInsiderRadarCache, type InsiderPostRow } from "@/lib/server/insiderRadarIngest";
import { loadSeismicPayload, pickSeismicHighlight } from "@/lib/server/seismicFeeds";
import { SHOW_COMMUNITY } from "@/lib/featureFlags";
import { sendEmail } from "@/lib/server/email";
import { activeSubscribers, unsubscribeUrl } from "@/lib/server/newsletter";

const SITE = () => (process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.the-theorist.com").replace(/\/$/, "");

const RISK_RANK: Record<string, number> = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };

type BriefArticle = { id: string; title: string; score: number; angle: string };
type BriefThread = { id: string; title: string; post_count: number; upvotes: number };
type BriefUap = { id: string; title: string; location?: string };
type BriefOutbreak = { title: string; risk_level: string; location: string; description: string };
type BriefSeismic = { title: string; mag: number; place: string };
type BriefInsider = { title: string; tracker_name: string; url: string };

export type WeeklyBriefingContent = {
  hero: BriefArticle | null;
  moreArticles: BriefArticle[];
  leadSummary: string;
  thread: BriefThread | null;
  uap: BriefUap | null;
  outbreak: BriefOutbreak | null;
  seismic: BriefSeismic | null;
  insider: BriefInsider[];
  weekLabel: string;
};

function weekCutoffIso(days = 7): string {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  return cutoff.toISOString();
}

function mapArticles(rows: unknown[]): BriefArticle[] {
  return rows.map((a) => {
    const row = a as { id: string; title: string; score?: number; angle?: string };
    return {
      id: String(row.id),
      title: String(row.title),
      score: Number(row.score ?? 0),
      angle: String(row.angle ?? ""),
    };
  });
}

async function fetchActiveCommunityThread(
  admin: SupabaseClient,
  cutoffIso: string,
): Promise<BriefThread | null> {
  const { data: posts } = await admin
    .from("thread_posts")
    .select("thread_id")
    .gte("created_at", cutoffIso);

  if (!posts?.length) return null;

  const counts = new Map<string, number>();
  for (const p of posts) {
    const id = String(p.thread_id);
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }

  const topThreadId = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  if (!topThreadId) return null;

  const { data: thread } = await admin
    .from("threads")
    .select("id, title, post_count, upvotes")
    .eq("id", topThreadId)
    .maybeSingle();

  if (!thread) return null;

  return {
    id: String(thread.id),
    title: String(thread.title),
    post_count: Number(thread.post_count ?? 0),
    upvotes: Number(thread.upvotes ?? 0),
  };
}

async function fetchRecentUap(admin: SupabaseClient, cutoffIso: string): Promise<BriefUap | null> {
  const { data: sightings } = await admin
    .from("uap_sightings")
    .select("id, title, location_name")
    .eq("status", "active")
    .gte("created_at", cutoffIso)
    .order("created_at", { ascending: false })
    .limit(1);

  if (!sightings?.[0]) return null;

  const s = sightings[0] as { id: string; title: string; location_name?: string };
  return { id: s.id, title: s.title, location: s.location_name };
}

async function fetchOutbreakHighlight(admin: SupabaseClient): Promise<BriefOutbreak | null> {
  try {
    const { data: cacheRow } = await admin
      .from("outbreak_cache")
      .select("data")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const outbreaks = (cacheRow?.data as { outbreaks?: unknown[] } | null)?.outbreaks ?? [];
    if (!outbreaks.length) return null;

    let best: BriefOutbreak | null = null;
    let bestRank = 0;

    for (const raw of outbreaks) {
      const row = raw as Record<string, unknown>;
      const risk = String(row.risk_level ?? "LOW").toUpperCase();
      const rank = RISK_RANK[risk] ?? 0;
      if (rank < bestRank) continue;

      const title = String(row.title ?? row.disease ?? "Outbreak watch");
      const location = String(row.location ?? row.origin_country ?? row.country ?? "");
      const description = String(row.description ?? "").slice(0, 160);

      bestRank = rank;
      best = { title, risk_level: risk, location, description };
    }

    return best;
  } catch {
    return null;
  }
}

function pickInsiderHighlights(posts: InsiderPostRow[], limit = 2): BriefInsider[] {
  return [...posts]
    .sort((a, b) => new Date(b.published).getTime() - new Date(a.published).getTime())
    .slice(0, limit)
    .map((p) => ({
      title: p.title,
      tracker_name: p.tracker_name,
      url: p.url,
    }));
}

function buildFallbackLeadSummary(hero: BriefArticle | null, more: BriefArticle[]): string {
  const titles = [hero, ...more].filter(Boolean).map((a) => a!.title);
  if (!titles.length) {
    return "This week's intelligence sweep is live on The Theorist — open the feed for the latest priority signals.";
  }
  if (titles.length === 1) {
    return `The highest-priority signal this week centers on "${titles[0]}". Open the full briefing for Investigation Board links and supporting context.`;
  }
  return `This week's top signals span ${titles.slice(0, 3).join("; ")}. The #1 story leads the priority queue — details and board links are below.`;
}

async function generateLeadSummary(hero: BriefArticle | null, more: BriefArticle[]): Promise<string> {
  const articles = [hero, ...more].filter(Boolean) as BriefArticle[];
  if (!articles.length) return buildFallbackLeadSummary(hero, more);

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return buildFallbackLeadSummary(hero, more);

  const lines = articles.map(
    (a, i) => `${i + 1}. [${a.score}% priority] ${a.title}${a.angle ? ` — ${a.angle.slice(0, 100)}` : ""}`,
  );

  try {
    const result = await callOpenAIJSON<{ summary: string }>({
      apiKey,
      model: "gpt-4o-mini",
      maxTokens: 220,
      system: `You write the opening paragraph for a weekly intelligence email for The Theorist — a conspiracy/UAP/outbreak research site.

Rules:
- English only, 3–4 sentences, ~70–110 words
- Summarize the week's narrative arc from the listed signals (themes, connections, what matters most)
- Use "priority" or "signal" language — never "threat"
- No markdown, no bullet points, no hype or clickbait
- Do not invent facts beyond the titles/angles provided

Return ONLY valid JSON: { "summary": "..." }`,
      user: `Weekly top signals:\n${lines.join("\n")}`,
    });

    const summary = result.summary?.trim();
    if (summary && summary.length > 40) return summary;
  } catch {
    /* fall through */
  }

  return buildFallbackLeadSummary(hero, more);
}

export async function gatherWeeklyBriefingContent(admin: SupabaseClient): Promise<WeeklyBriefingContent> {
  const cutoffIso = weekCutoffIso(7);

  const [articlesRes, thread, uap, outbreak, insiderCache, seismicPayload] = await Promise.all([
    admin
      .from("news_items")
      .select("id, title, score, angle")
      .gte("published_at", cutoffIso)
      .order("score", { ascending: false })
      .limit(5),
    SHOW_COMMUNITY ? fetchActiveCommunityThread(admin, cutoffIso) : Promise.resolve(null),
    fetchRecentUap(admin, cutoffIso),
    fetchOutbreakHighlight(admin),
    readInsiderRadarCache(),
    loadSeismicPayload().catch(() => null),
  ]);

  const articles = mapArticles(articlesRes.data ?? []);
  const hero = articles[0] ?? null;
  const moreArticles = articles.slice(1);
  const leadSummary = await generateLeadSummary(hero, moreArticles);
  const insider = pickInsiderHighlights(insiderCache?.posts ?? []);
  const seismicHit = seismicPayload ? pickSeismicHighlight(seismicPayload) : null;
  const seismic = seismicHit
    ? { title: seismicHit.title, mag: seismicHit.mag, place: seismicHit.place }
    : null;

  const weekLabel = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

  return {
    hero,
    moreArticles,
    leadSummary,
    thread,
    uap,
    outbreak,
    seismic,
    insider,
    weekLabel,
  };
}

function riskColor(level: string): string {
  switch (level.toUpperCase()) {
    case "CRITICAL":
      return "#ff4444";
    case "HIGH":
      return "#ff8844";
    case "MEDIUM":
      return "#ffaa44";
    default:
      return "#7aaa8a";
  }
}

function renderBriefingHtml(content: WeeklyBriefingContent, optOut: string): string {
  const base = SITE();

  const heroHtml = content.hero
    ? `<div style="margin:16px 0 20px;padding:16px;border:1px solid #00bb66;border-radius:4px;background:rgba(0,187,102,0.06)">
        <p style="color:#5a8068;font-size:10px;letter-spacing:1px;margin:0 0 8px">#1 PRIORITY SIGNAL · ${content.hero.score}%</p>
        <h2 style="color:#00ff88;font-size:16px;line-height:1.4;margin:0 0 10px">${escapeHtml(content.hero.title)}</h2>
        <p style="color:#7aaa8a;font-size:12px;line-height:1.5;margin:0 0 14px">${escapeHtml(content.hero.angle.slice(0, 180))}</p>
        <p style="margin:0">
          <a href="${base}/article/${content.hero.id}" style="display:inline-block;margin-right:10px;padding:8px 14px;background:#00bb66;color:#050c07;text-decoration:none;font-size:11px;font-weight:bold;letter-spacing:1px;border-radius:2px">READ ANALYSIS</a>
          <a href="${base}/board/${content.hero.id}" style="display:inline-block;padding:8px 14px;border:1px solid #00bb66;color:#00ff88;text-decoration:none;font-size:11px;letter-spacing:1px;border-radius:2px">◈ OPEN BOARD</a>
        </p>
      </div>`
    : "";

  const leadHtml = `<p style="color:#9ec8ae;font-size:13px;line-height:1.65;margin:0 0 20px">${escapeHtml(content.leadSummary)}</p>`;

  const moreHtml = content.moreArticles.length
    ? `<h2 style="color:#ff6666;font-size:13px;letter-spacing:1px;margin-top:4px">MORE PRIORITY SIGNALS</h2>
       <ol start="2" style="padding-left:18px;line-height:1.5">${content.moreArticles
         .map(
           (a) =>
             `<li style="margin-bottom:12px"><a href="${base}/article/${a.id}" style="color:#00ff88;text-decoration:none"><strong>${escapeHtml(a.title)}</strong></a><br/><span style="color:#ff6666">${a.score}% priority</span> · <span style="color:#7aaa8a">${escapeHtml(a.angle.slice(0, 120))}</span></li>`,
         )
         .join("")}</ol>`
    : "";

  const seismicHtml = content.seismic
    ? `<h2 style="color:#ff8844;font-size:13px;letter-spacing:1px;margin-top:20px">SEISMIC WATCH</h2>
       <p style="margin:8px 0"><strong style="color:#ff6633">M${content.seismic.mag.toFixed(1)}</strong> · ${escapeHtml(content.seismic.place)}</p>
       <p style="margin:4px 0 8px"><a href="${base}/seismic" style="color:#00ff88;text-decoration:none">${escapeHtml(content.seismic.title)}</a></p>`
    : "";

  const outbreakHtml = content.outbreak
    ? `<h2 style="color:#ff8844;font-size:13px;letter-spacing:1px;margin-top:20px">OUTBREAK WATCH</h2>
       <p style="margin:8px 0"><strong style="color:${riskColor(content.outbreak.risk_level)}">${content.outbreak.risk_level}</strong>${content.outbreak.location ? ` · ${escapeHtml(content.outbreak.location)}` : ""}</p>
       <p style="margin:4px 0 8px"><a href="${base}/outbreaks" style="color:#00ff88;text-decoration:none">${escapeHtml(content.outbreak.title)}</a></p>
       ${content.outbreak.description ? `<p style="color:#7aaa8a;font-size:12px;line-height:1.5;margin:0">${escapeHtml(content.outbreak.description)}</p>` : ""}`
    : "";

  const insiderHtml = content.insider.length
    ? `<h2 style="color:#c94dff;font-size:13px;letter-spacing:1px;margin-top:20px">INSIDER RADAR</h2>
       <ul style="padding-left:18px;line-height:1.5;margin:8px 0">${content.insider
         .map(
           (p) =>
             `<li style="margin-bottom:10px"><a href="${escapeHtml(p.url)}" style="color:#00ff88;text-decoration:none">${escapeHtml(p.title)}</a><br/><span style="color:#7aaa8a;font-size:11px">${escapeHtml(p.tracker_name)}</span></li>`,
         )
         .join("")}</ul>
       <p style="margin:4px 0"><a href="${base}/insider-radar" style="color:#5a8068;font-size:11px">View all trackers →</a></p>`
    : "";

  const threadHtml =
    SHOW_COMMUNITY && content.thread
      ? `<h2 style="color:#c94dff;font-size:13px;letter-spacing:1px;margin-top:20px">COMMUNITY PULSE</h2>
       <p style="margin:8px 0"><a href="${base}/community?id=${content.thread.id}" style="color:#00ff88">${escapeHtml(content.thread.title)}</a> · ${content.thread.post_count} posts · ${content.thread.upvotes} upvotes</p>`
      : "";

  const uapHtml = content.uap
    ? `<h2 style="color:#00bb66;font-size:13px;letter-spacing:1px;margin-top:20px">UAP RADAR</h2>
       <p style="margin:8px 0"><a href="${base}/uap/${content.uap.id}" style="color:#00ff88">${escapeHtml(content.uap.title)}</a>${content.uap.location ? ` · ${escapeHtml(content.uap.location)}` : ""}</p>`
    : "";

  return `<div style="background:#050c07;color:#c8e8d0;font-family:monospace;padding:20px;max-width:560px">
    <h1 style="color:#00ff88;font-size:18px;letter-spacing:2px">◈ WEEKLY INTELLIGENCE BRIEFING</h1>
    <p style="color:#5a8068;font-size:11px;margin-bottom:12px">${content.weekLabel}</p>
    ${heroHtml}
    ${leadHtml}
    ${moreHtml}
    ${outbreakHtml}
    ${seismicHtml}
    ${insiderHtml}
    ${threadHtml}
    ${uapHtml}
    <p style="margin-top:24px;font-size:10px;color:#3a5040"><a href="${optOut}" style="color:#5a8068">Unsubscribe</a> · <a href="${base}" style="color:#5a8068">Open feed</a></p>
  </div>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildSubject(content: WeeklyBriefingContent): string {
  if (!content.hero) return `◈ Weekly Intelligence Briefing — ${content.weekLabel}`;
  const shortTitle =
    content.hero.title.length > 52 ? `${content.hero.title.slice(0, 49).trim()}…` : content.hero.title;
  return `◈ Weekly Brief — ${shortTitle} · ${content.hero.score}% priority`;
}

/**
 * One message per recipient, each carrying its own unsubscribe link.
 *
 * This used to put fifty addresses in a single `to:`, which showed every
 * subscriber the whole batch's email addresses. It also cannot work now: an
 * opt-out link is specific to the person holding it.
 */
async function sendIndividually(
  recipients: { email: string; token: string }[],
  subject: string,
  content: WeeklyBriefingContent,
): Promise<number> {
  let sent = 0;
  for (const { email, token } of recipients) {
    const optOut = unsubscribeUrl(token);
    const result = await sendEmail({
      to: email,
      subject,
      html: renderBriefingHtml(content, optOut),
      headers: {
        // RFC 8058: lets the mail client offer a one-click unsubscribe of its own.
        "List-Unsubscribe": `<${SITE()}/api/newsletter/unsubscribe?token=${encodeURIComponent(token)}>, <${optOut}>`,
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      },
    });
    if (result.ok) sent += 1;
    else console.warn("[weeklyBriefing] send failed for one recipient:", result.reason);
    // Resend's free tier allows two requests a second.
    await new Promise((r) => setTimeout(r, 600));
  }
  return sent;
}

/**
 * What this week's issue would look like, without sending anything.
 *
 * The admin panel needs to answer "is there even a briefing to send" before the
 * button is pressed, and a test send needs the same HTML the real one uses.
 */
export async function buildWeeklyBriefingPreview(
  admin: SupabaseClient,
): Promise<{ subject: string; html: string; articles: number; weekLabel: string }> {
  const content = await gatherWeeklyBriefingContent(admin);
  const articles = (content.hero ? 1 : 0) + content.moreArticles.length;
  if (!articles) return { subject: "", html: "", articles: 0, weekLabel: content.weekLabel };
  return {
    subject: buildSubject(content),
    html: renderBriefingHtml(content, `${SITE()}/newsletter/unsubscribe?token=preview`),
    articles,
    weekLabel: content.weekLabel,
  };
}

/** Send the weekly briefing to everyone on the confirmed mailing list. */
export async function sendWeeklyBriefing(admin: SupabaseClient): Promise<{ sent: number; articles: number }> {
  const content = await gatherWeeklyBriefingContent(admin);
  if (!content.hero && !content.moreArticles.length) return { sent: 0, articles: 0 };

  const recipients = await activeSubscribers(admin);
  const articleCount = (content.hero ? 1 : 0) + content.moreArticles.length;
  if (!recipients.length) return { sent: 0, articles: articleCount };

  const sent = await sendIndividually(recipients, buildSubject(content), content);
  return { sent, articles: articleCount };
}
