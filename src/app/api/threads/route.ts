import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createHash } from "crypto";
import { callOpenAIJSON } from "@/lib/openai";

function getAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) throw new Error("Missing Supabase env");
  return createClient(url, key);
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

const ORACLE_SYSTEM = `You are The Theorist's Oracle AI, participating in a community investigation thread.
Analyze the submitted topic and posts. Provide:
1. What conspiracy theories or documented incidents relate to this
2. Relevant patents, FOIA documents, or government records
3. Key questions the community should investigate
4. Your assessment of credibility (0-100%)
5. Suggested next steps for investigation

LANGUAGE: Output MUST be English only.

Be direct, cite real sources where possible, and engage with specific claims made in the thread.
Return ONLY valid JSON:
{
  "analysis": "3-4 paragraphs of analysis",
  "credibility": 45,
  "related_theories": ["theory 1", "theory 2"],
  "key_sources": [{"title": "Source name", "url": "https://...", "relevance": "Why relevant"}],
  "questions": ["Question 1?", "Question 2?"],
  "verdict": "CREDIBLE | POSSIBLE | UNLIKELY | UNVERIFIED",
  "next_steps": ["Step 1", "Step 2"]
}`;

// GET — list threads or single thread with posts
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

// POST — create thread or add post (optional @oracle)
export async function POST(req: NextRequest) {
  try {
    const admin = getAdmin();
    const body = await req.json();
    const action = body.action ?? "create_thread";
    const userFp = fp(req);

    if (action === "create_thread") {
      const { title, content, category, author_name, location, tags, linked_article_id, article_id } = body;
      if (!title?.trim() || !content?.trim()) {
        return NextResponse.json({ error: "title and content required" }, { status: 400 });
      }

      const linkRaw = linked_article_id ?? article_id;
      const linkId = typeof linkRaw === "string" && isUuid(linkRaw) ? linkRaw : null;

      if (linkId) {
        const { data: newsRow } = await admin.from("news_items").select("id").eq("id", linkId).maybeSingle();
        if (!newsRow) {
          return NextResponse.json({ error: "article not found" }, { status: 404 });
        }
        const { data: existing } = await admin
          .from("threads")
          .select("*")
          .eq("linked_article_id", linkId)
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
          linked_article_id: linkId,
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

      return NextResponse.json({ thread, success: true });
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

      // Rate-limit @oracle for free/anonymous users: max 3 per day per fingerprint
      const FREE_ORACLE_DAILY_LIMIT = 3;
      let oracleBlocked = false;
      if (mentionsOracle && apiKey) {
        // Check auth to see if PRO
        const authHeader = req.headers.get("authorization") ?? "";
        let isPro = false;
        if (authHeader.startsWith("Bearer ")) {
          try {
            const { data: { user: authUser } } = await admin.auth.getUser(authHeader.replace("Bearer ", ""));
            if (authUser) {
              const { data: prof } = await admin.from("user_profiles").select("plan").eq("id", authUser.id).single();
              isPro = prof?.plan === "pro";
            }
          } catch { /* ignore */ }
        }
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
            maxTokens: 1200,
            model: "gpt-4o-mini",
          });

          const oracleContent = [
            `**◈ ORACLE ANALYSIS** — Credibility: ${oracleResult.credibility}% · Verdict: **${oracleResult.verdict}**`,
            "",
            oracleResult.analysis,
            "",
            oracleResult.related_theories?.length
              ? `**Related theories:** ${oracleResult.related_theories.join(" · ")}`
              : "",
            "",
            oracleResult.questions?.length
              ? `**Key questions for investigation:**\n${oracleResult.questions.map((q) => `▸ ${q}`).join("\n")}`
              : "",
            "",
            oracleResult.key_sources?.length
              ? `**Sources:**\n${oracleResult.key_sources.map((s) => `↗ [${s.title}](${s.url}) — ${s.relevance}`).join("\n")}`
              : "",
            "",
            oracleResult.next_steps?.length
              ? `**Next steps:**\n${oracleResult.next_steps.map((s) => `→ ${s}`).join("\n")}`
              : "",
          ]
            .filter(Boolean)
            .join("\n")
            .trim();

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
