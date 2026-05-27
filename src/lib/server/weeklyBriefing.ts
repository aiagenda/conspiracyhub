import type { SupabaseClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { isEffectivePro, type UserProfilePlanRow } from "@/lib/userPlan";

const SITE = () => (process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.the-theorist.com").replace(/\/$/, "");

function getResend() {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY missing");
  return new Resend(key);
}

function fromAddress() {
  return process.env.RESEND_FROM ?? "The Theorist <alerts@thetheorist.local>";
}

type BriefArticle = { id: string; title: string; score: number; angle: string };
type BriefThread = { id: string; title: string; post_count: number; upvotes: number };
type BriefUap = { id: string; title: string; location?: string };

export type WeeklyBriefingContent = {
  articles: BriefArticle[];
  thread: BriefThread | null;
  uap: BriefUap | null;
  weekLabel: string;
};

export async function gatherWeeklyBriefingContent(admin: SupabaseClient): Promise<WeeklyBriefingContent> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 7);
  const cutoffIso = cutoff.toISOString();

  const { data: articles } = await admin
    .from("news_items")
    .select("id, title, score, angle")
    .gte("published_at", cutoffIso)
    .order("score", { ascending: false })
    .limit(5);

  const { data: threads } = await admin
    .from("threads")
    .select("id, title, post_count, upvotes")
    .order("upvotes", { ascending: false })
    .order("post_count", { ascending: false })
    .limit(1);

  let uap: BriefUap | null = null;
  const { data: sightings } = await admin
    .from("uap_sightings")
    .select("id, title, location_name")
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1);
  if (sightings?.[0]) {
    const s = sightings[0] as { id: string; title: string; location_name?: string };
    uap = { id: s.id, title: s.title, location: s.location_name };
  }

  const weekLabel = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

  return {
    articles: (articles ?? []).map((a) => ({
      id: String(a.id),
      title: String(a.title),
      score: Number(a.score ?? 0),
      angle: String(a.angle ?? ""),
    })),
    thread: threads?.[0]
      ? {
          id: String(threads[0].id),
          title: String(threads[0].title),
          post_count: Number(threads[0].post_count ?? 0),
          upvotes: Number(threads[0].upvotes ?? 0),
        }
      : null,
    uap,
    weekLabel,
  };
}

function renderBriefingHtml(content: WeeklyBriefingContent, isPro: boolean): string {
  const base = SITE();
  const articlesHtml = content.articles
    .map(
      (a, i) =>
        `<li style="margin-bottom:12px"><a href="${base}/article/${a.id}" style="color:#00ff88;text-decoration:none"><strong>${i + 1}. ${escapeHtml(a.title)}</strong></a><br/><span style="color:#ff6666">${a.score}% threat</span> · <span style="color:#7aaa8a">${escapeHtml(a.angle.slice(0, 120))}</span></li>`,
    )
    .join("");

  const threadHtml = content.thread
    ? `<p style="margin:16px 0 8px"><a href="${base}/community?id=${content.thread.id}" style="color:#00ff88">${escapeHtml(content.thread.title)}</a> · ${content.thread.post_count} posts · ${content.thread.upvotes} upvotes</p>`
    : `<p style="color:#5a8068">No hot community thread this week.</p>`;

  const uapHtml = content.uap
    ? `<p style="margin:8px 0"><a href="${base}/uap/${content.uap.id}" style="color:#00ff88">${escapeHtml(content.uap.title)}</a>${content.uap.location ? ` · ${escapeHtml(content.uap.location)}` : ""}</p>`
    : `<p style="color:#5a8068">No new UAP highlight.</p>`;

  const proCta = isPro
    ? ""
    : `<div style="margin-top:20px;padding:14px;border:1px solid #ffaa00;border-radius:4px;background:rgba(255,170,0,0.06)">
        <strong style="color:#ffcc66">◈ PRO unlock</strong>
        <p style="color:#9ec8ae;font-size:13px;line-height:1.6;margin:8px 0 0">This week's #1 story has a full Investigation Board with federal spending data and Oracle analysis. <a href="${base}/account" style="color:#00ff88">Upgrade to PRO</a> or use your Analyst Pass trial.</p>
      </div>`;

  return `<div style="background:#050c07;color:#c8e8d0;font-family:monospace;padding:20px;max-width:560px">
    <h1 style="color:#00ff88;font-size:18px;letter-spacing:2px">◈ WEEKLY INTELLIGENCE BRIEFING</h1>
    <p style="color:#5a8068;font-size:11px;margin-bottom:20px">${content.weekLabel}</p>
    <h2 style="color:#ff6666;font-size:13px;letter-spacing:1px">TOP 5 SIGNALS</h2>
    <ol style="padding-left:18px;line-height:1.5">${articlesHtml || "<li>No articles this week.</li>"}</ol>
    <h2 style="color:#c94dff;font-size:13px;letter-spacing:1px;margin-top:20px">COMMUNITY PULSE</h2>
    ${threadHtml}
    <h2 style="color:#00bb66;font-size:13px;letter-spacing:1px;margin-top:20px">UAP RADAR</h2>
    ${uapHtml}
    ${proCta}
    <p style="margin-top:24px;font-size:10px;color:#3a5040"><a href="${base}/account" style="color:#5a8068">Email preferences</a> · <a href="${base}" style="color:#5a8068">Open feed</a></p>
  </div>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function sendBatch(resend: Resend, emails: string[], subject: string, html: string) {
  if (!emails.length) return 0;
  const BATCH = 50;
  let sent = 0;
  for (let i = 0; i < emails.length; i += BATCH) {
    const chunk = emails.slice(i, i + BATCH);
    await resend.emails.send({
      from: fromAddress(),
      to: chunk,
      subject,
      html,
    });
    sent += chunk.length;
    if (i + BATCH < emails.length) await new Promise((r) => setTimeout(r, 300));
  }
  return sent;
}

/** Send weekly briefing to opted-in users (personalized PRO CTA per recipient). */
export async function sendWeeklyBriefing(admin: SupabaseClient): Promise<{ sent: number; articles: number }> {
  const content = await gatherWeeklyBriefingContent(admin);
  if (!content.articles.length) return { sent: 0, articles: 0 };

  const { data: users } = await admin
    .from("user_profiles")
    .select("email, plan, stripe_subscription_id, subscription_status, pro_trial_ends_at, pro_trial_granted_at, pro_trial_redeemed, email_weekly_briefing")
    .eq("email_weekly_briefing", true);

  const resend = getResend();
  const subject = `◈ Weekly Intelligence Briefing — ${content.articles[0]?.score ?? ""}% top signal`;

  let sent = 0;
  const proEmails: string[] = [];
  const freeEmails: string[] = [];

  for (const u of users ?? []) {
    const email = String(u.email ?? "").trim();
    if (!email) continue;
    const pro = isEffectivePro(u as UserProfilePlanRow);
    if (pro) proEmails.push(email);
    else freeEmails.push(email);
  }

  if (proEmails.length) {
    sent += await sendBatch(resend, proEmails, subject, renderBriefingHtml(content, true));
  }
  if (freeEmails.length) {
    sent += await sendBatch(resend, freeEmails, subject, renderBriefingHtml(content, false));
  }

  return { sent, articles: content.articles.length };
}
