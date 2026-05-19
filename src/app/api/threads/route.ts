import { NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import { createHash } from "crypto";
import { ARTICLE_THREAD_STARTER_FP, buildArticleThreadStarterRow } from "@/lib/articleThreadStarters";
import { callOpenAIJSON } from "@/lib/openai";
import { userHasEffectivePro } from "@/lib/server/requireEffectivePro";

function getAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) throw new Error("Missing Supabase env");
  return createClient(url, key);
}

type AuthResult = { user: User } | { response: NextResponse };

async function requireRegisteredUser(req: NextRequest, admin: SupabaseClient): Promise<AuthResult> {
  const auth = req.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) {
    return { response: NextResponse.json({ error: "missing_token" }, { status: 401 }) };
  }
  const token = auth.replace(/^Bearer\s+/i, "");
  const {
    data: { user },
    error,
  } = await admin.auth.getUser(token);
  if (error || !user) {
    return { response: NextResponse.json({ error: "invalid_token" }, { status: 401 }) };
  }
  return { user };
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(s: string) {
  return UUID_RE.test(s);
}

function fp(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for") ?? req.headers.get("x-real-ip") ?? "unknown";
  const ua = req.headers.get("user-agent") ?? "";
  return createHash("sha256").update(ip + ua).digest("hex").slice(0, 16);
}

const ORACLE_SYSTEM = `You are The Theorist's Oracle AI in a LIVE CHAT sidebar. Replies must be SHORT so users can read them without scrolling.

LANGUAGE: English only.

Brevity rules (strict):
- "analysis": at most 2 short paragraphs OR ~500 characters total — punchy, no filler, no repetition.
- "related_theories": 0–2 items, each max ~12 words.
- "key_sources": 0–2 items; "relevance" max ~50 characters each; URLs must be real https links when known, else omit that source.
- "questions": exactly 2 short lines (one sentence each).
- "next_steps": exactly 2 items, each one short phrase (max ~60 characters).

Return ONLY valid JSON:
{
  "analysis": "Very brief analysis for chat UI",
  "credibility": 45,
  "related_theories": ["optional short item"],
  "key_sources": [{"title": "Short", "url": "https://...", "relevance": "max 50 chars"}],
  "questions": ["Short Q1?", "Short Q2?"],
  "verdict": "CREDIBLE | POSSIBLE | UNLIKELY | UNVERIFIED",
  "next_steps": ["Short step 1", "Short step 2"]
}`;

const ORACLE_ANALYSIS_MAX_CHARS = 520;
const ORACLE_FIELD_TRUNC = { relevance: 52, theory: 90, question: 120, step: 72 };

function truncateChat(s: string, max: number): string {
  const t = s.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

// GET — list threads or single thread with posts (public read; POST still requires auth)
export async function GET(req: NextRequest) {
  try {
    const admin = getAdmin();

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    const category = searchParams.get("category");
    const sort = searchParams.get("sort") ?? "latest";

    if (id) {
      const { data: thread } = await admin.from("threads").select("*").eq("id", id).single();
      const { data: posts } = await admin
        .from("thread_posts")
        .select("*")
        .eq("thread_id", id)
        .order("created_at", { ascending: true });
      return NextResponse.json({ thread, posts: posts ?? [] });
    }

    const articleId = searchParams.get("article_id") ?? searchParams.get("news_id");
    const generatedArticleId = searchParams.get("generated_article_id");
    if (articleId && isUuid(articleId)) {
      const { data: threads, error } = await admin
        .from("threads")
        .select("*")
        .eq("linked_article_id", articleId)
        .neq("status", "removed")
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) return NextResponse.json({ error: error.message, threads: [] }, { status: 500 });
      return NextResponse.json({ threads: threads ?? [] });
    }
    if (generatedArticleId && isUuid(generatedArticleId)) {
      const { data: threads, error } = await admin
        .from("threads")
        .select("*")
        .eq("linked_generated_article_id", generatedArticleId)
        .neq("status", "removed")
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) return NextResponse.json({ error: error.message, threads: [] }, { status: 500 });
      return NextResponse.json({ threads: threads ?? [] });
    }

    let q = admin.from("threads").select("*").neq("status", "removed");
    if (category && category !== "all") q = q.eq("category", category);
    if (sort === "hot") q = q.order("post_count", { ascending: false });
    else if (sort === "credibility") q = q.order("credibility_score", { ascending: false });
    else q = q.order("created_at", { ascending: false });

    const { data } = await q.limit(50);
    return NextResponse.json({ threads: data ?? [] });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg, threads: [] }, { status: 500 });
  }
}

// POST — create thread or add post (optional @oracle) — registered users only
export async function POST(req: NextRequest) {
  try {
    const admin = getAdmin();
    const authResult = await requireRegisteredUser(req, admin);
    if ("response" in authResult) return authResult.response;
    const { user: authUser } = authResult;

    const body = await req.json();
    const action = body.action ?? "create_thread";
    const userFp = fp(req);

    if (action === "create_thread") {
      const {
        title,
        content,
        category,
        author_name,
        location,
        tags,
        linked_article_id,
        linked_generated_article_id,
        article_id,
      } = body;
      if (!title?.trim() || !content?.trim()) {
        return NextResponse.json({ error: "title and content required" }, { status: 400 });
      }

      const linkNewsRaw = linked_article_id ?? article_id;
      const linkNewsId = typeof linkNewsRaw === "string" && isUuid(linkNewsRaw) ? linkNewsRaw : null;
      const linkGenRaw = linked_generated_article_id;
      const linkGenId = typeof linkGenRaw === "string" && isUuid(linkGenRaw) ? linkGenRaw : null;

      if (linkNewsId && linkGenId) {
        return NextResponse.json({ error: "link only one of news article or generated article" }, { status: 400 });
      }

      if (linkNewsId) {
        const { data: newsRow } = await admin.from("news_items").select("id").eq("id", linkNewsId).maybeSingle();
        if (!newsRow) {
          return NextResponse.json({ error: "article not found" }, { status: 404 });
        }
        const { data: existing } = await admin
          .from("threads")
          .select("*")
          .eq("linked_article_id", linkNewsId)
          .neq("status", "removed")
          .maybeSingle();
        if (existing) {
          return NextResponse.json({ thread: existing, success: true, existing: true });
        }
      }

      if (linkGenId) {
        const { data: genRow } = await admin
          .from("generated_articles")
          .select("id")
          .eq("id", linkGenId)
          .eq("status", "published")
          .maybeSingle();
        if (!genRow) {
          return NextResponse.json({ error: "generated article not found" }, { status: 404 });
        }
        const { data: existing } = await admin
          .from("threads")
          .select("*")
          .eq("linked_generated_article_id", linkGenId)
          .neq("status", "removed")
          .maybeSingle();
        if (existing) {
          return NextResponse.json({ thread: existing, success: true, existing: true });
        }
      }

      const { data: thread, error } = await admin
        .from("threads")
        .insert({
          title: title.trim().slice(0, 120),
          body: content.trim().slice(0, 2000),
          author_name: (author_name ?? "Anonymous").slice(0, 40),
          author_fingerprint: userFp,
          category: category ?? "sighting",
          location: location?.slice(0, 80) ?? null,
          tags: tags ?? [],
          linked_article_id: linkNewsId,
          linked_generated_article_id: linkGenId,
        })
        .select()
        .single();

      if (error) return NextResponse.json({ error: error.message }, { status: 400 });

      await admin.from("thread_posts").insert({
        thread_id: thread.id,
        author_name: thread.author_name,
        author_fingerprint: userFp,
        author_type: "human",
        content: content.trim().slice(0, 2000),
      });

      if (linkNewsId || linkGenId) {
        const row = buildArticleThreadStarterRow(title.trim());
        const { error: stErr } = await admin.from("thread_posts").insert({
          thread_id: thread.id,
          author_name: row.author_name,
          author_fingerprint: row.author_fingerprint,
          author_type: row.author_type,
          content: row.content,
        });
        if (stErr) console.error("[threads] article starter insert", stErr);
      }

      return NextResponse.json({ thread, success: true });
    }

    if (action === "ensure_article_thread_starters") {
      const { thread_id } = body as { thread_id?: string };
      if (!thread_id || !isUuid(thread_id)) {
        return NextResponse.json({ error: "thread_id required" }, { status: 400 });
      }
      const { data: th, error: thErr } = await admin
        .from("threads")
        .select("id, linked_article_id, linked_generated_article_id, title")
        .eq("id", thread_id)
        .maybeSingle();
      if (thErr || (!th?.linked_article_id && !th?.linked_generated_article_id)) {
        return NextResponse.json({ error: "not_article_thread" }, { status: 400 });
      }
      const { count, error: cErr } = await admin
        .from("thread_posts")
        .select("id", { count: "exact", head: true })
        .eq("thread_id", thread_id)
        .eq("author_fingerprint", ARTICLE_THREAD_STARTER_FP);
      if (cErr) return NextResponse.json({ error: cErr.message }, { status: 500 });
      if ((count ?? 0) > 0) {
        return NextResponse.json({ ok: true, already: true });
      }
      const starterRow = buildArticleThreadStarterRow(String(th.title ?? ""));
      const { error: insErr } = await admin.from("thread_posts").insert({
        thread_id,
        author_name: starterRow.author_name,
        author_fingerprint: starterRow.author_fingerprint,
        author_type: starterRow.author_type,
        content: starterRow.content,
      });
      if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });
      return NextResponse.json({ ok: true, seeded: true });
    }

    if (action === "react_post") {
      const { post_id, reaction } = body;
      if (!post_id || !["like", "dislike"].includes(String(reaction))) {
        return NextResponse.json({ error: "post_id and reaction ('like'|'dislike') required" }, { status: 400 });
      }
      const col = reaction === "like" ? "likes" : "dislikes";
      const { data: result } = await admin.rpc("increment_post_reaction", {
        post_id_param: post_id,
        col_name: col,
      });
      const row = Array.isArray(result) ? result[0] : result;
      return NextResponse.json({ success: true, likes: row?.likes ?? 0, dislikes: row?.dislikes ?? 0 });
    }

    if (action === "add_post") {
      const { thread_id, content, author_name, attachment_url, parent_post_id } = body;
      const hasContent = typeof content === "string" && content.trim().length > 0;
      const hasAttachment = typeof attachment_url === "string" && attachment_url.trim().length > 0;
      if (!thread_id || (!hasContent && !hasAttachment)) {
        return NextResponse.json({ error: "thread_id and content (or attachment) required" }, { status: 400 });
      }

      const mentionsOracle = /@oracle\b/i.test(content ?? "");
      const apiKey = process.env.OPENAI_API_KEY;

      // Rate-limit @oracle for free users: max 3 per day per fingerprint
      const FREE_ORACLE_DAILY_LIMIT = 3;
      let oracleBlocked = false;
      if (mentionsOracle && apiKey) {
        const isPro = await userHasEffectivePro(admin, authUser.id);
        if (!isPro) {
          const since = new Date(Date.now() - 86_400_000).toISOString();
          const { count } = await admin
            .from("thread_posts")
            .select("id", { count: "exact", head: true })
            .eq("author_fingerprint", userFp)
            .eq("author_type", "oracle")
            .gte("created_at", since);
          // Note: count above counts oracle replies, but we need to count the user's oracle-triggering posts.
          // Simpler: count posts by this fingerprint that triggered oracle (contains "@oracle") in last 24h.
          const { count: triggerCount } = await admin
            .from("thread_posts")
            .select("id", { count: "exact", head: true })
            .eq("author_fingerprint", userFp)
            .eq("author_type", "human")
            .ilike("content", "%@oracle%")
            .gte("created_at", since);
          if ((triggerCount ?? 0) >= FREE_ORACLE_DAILY_LIMIT) {
            oracleBlocked = true;
          }
        }
      }

      const { data: post, error } = await admin
        .from("thread_posts")
        .insert({
          thread_id,
          author_name: (author_name ?? "Anonymous").slice(0, 40),
          author_fingerprint: userFp,
          author_type: "human",
          content: (content ?? "").trim().slice(0, 1000) || "🎞",
          attachment_url: attachment_url ?? null,
          parent_post_id: parent_post_id ?? null,
        })
        .select()
        .single();

      if (error) return NextResponse.json({ error: error.message }, { status: 400 });

      if (mentionsOracle && apiKey && !oracleBlocked) {
        try {
          const { data: thread } = await admin.from("threads").select("*").eq("id", thread_id).single();
          const { data: allPosts } = await admin
            .from("thread_posts")
            .select("*")
            .eq("thread_id", thread_id)
            .order("created_at", { ascending: true })
            .limit(20);

          const context = `Thread title: "${thread?.title}"\nThread description: "${thread?.body}"\n\nPosts:\n${(allPosts ?? []).map((p) => `[${p.author_name}]: ${p.content}`).join("\n")}`;

          const oracleResult = await callOpenAIJSON<{
            analysis: string;
            credibility: number;
            related_theories: string[];
            key_sources: Array<{ title: string; url: string; relevance: string }>;
            questions: string[];
            verdict: string;
            next_steps: string[];
          }>({
            apiKey,
            system: ORACLE_SYSTEM,
            user: context,
            maxTokens: 480,
            model: "gpt-4o-mini",
          });

          const analysisShort = truncateChat(String(oracleResult.analysis ?? ""), ORACLE_ANALYSIS_MAX_CHARS);
          const theories = (oracleResult.related_theories ?? [])
            .slice(0, 2)
            .map((t) => truncateChat(String(t), ORACLE_FIELD_TRUNC.theory))
            .filter(Boolean);
          const questions = (oracleResult.questions ?? [])
            .slice(0, 2)
            .map((q) => truncateChat(String(q), ORACLE_FIELD_TRUNC.question))
            .filter(Boolean);
          const steps = (oracleResult.next_steps ?? [])
            .slice(0, 2)
            .map((s) => truncateChat(String(s), ORACLE_FIELD_TRUNC.step))
            .filter(Boolean);
          const sources = (oracleResult.key_sources ?? []).slice(0, 2).filter((s) => s?.title && /^https?:\/\//i.test(String(s.url ?? "")));

          const parts: string[] = [
            `◈ ORACLE — ${Math.max(0, Math.min(100, Math.round(Number(oracleResult.credibility) || 0)))}% · **${String(oracleResult.verdict ?? "UNVERIFIED").slice(0, 24)}**`,
            analysisShort,
          ];
          if (theories.length) parts.push(`**Angles:** ${theories.join(" · ")}`);
          if (questions.length) parts.push(`**Ask:**\n${questions.map((q) => `▸ ${q}`).join("\n")}`);
          if (sources.length) {
            parts.push(
              `**Links:**\n${sources
                .map((s) => {
                  const rel = truncateChat(String(s.relevance ?? ""), ORACLE_FIELD_TRUNC.relevance);
                  return `↗ [${truncateChat(String(s.title), 48)}](${s.url})${rel ? ` — ${rel}` : ""}`;
                })
                .join("\n")}`
            );
          }
          if (steps.length) parts.push(`**Next:** ${steps.join(" · ")}`);

          const oracleContent = parts.join("\n\n").trim();

          await admin.from("thread_posts").insert({
            thread_id,
            author_name: "Oracle AI",
            author_fingerprint: "oracle-system",
            author_type: "oracle",
            content: oracleContent,
          });

          await admin
            .from("threads")
            .update({
              oracle_analyzed: true,
              credibility_score: Math.max(0, Math.min(100, Math.round(oracleResult.credibility))),
            })
            .eq("id", thread_id);
        } catch (e) {
          console.error("[oracle thread]", e);
        }
      }

      return NextResponse.json({ post, oracle_invoked: mentionsOracle && !oracleBlocked, oracle_rate_limited: oracleBlocked, success: true });
    }

    return NextResponse.json({ error: "unknown action" }, { status: 400 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
