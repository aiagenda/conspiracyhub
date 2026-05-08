import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { callOpenAIJSON } from "@/lib/openai";
import { SYSTEM_SCORE } from "@/lib/prompts";
import type { NewsItem } from "@/types";

const sections = ["technology", "science", "world", "politics", "environment", "society"];

type GuardianApiResult = {
  id: string;
  webTitle: string;
  webUrl: string;
  webPublicationDate: string;
  fields?: {
    trailText?: string;
    thumbnail?: string;
  };
};

function getAdminClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);
}

export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const guardianKey = process.env.GUARDIAN_API_KEY!;
    const openAiKey = process.env.OPENAI_API_KEY!;
    const supabase = getAdminClient();

    const all: NewsItem[] = [];
    for (const section of sections) {
      const url = `https://content.guardianapis.com/search?section=${section}&show-fields=headline,trailText,thumbnail,webUrl,webPublicationDate&page-size=8&api-key=${guardianKey}`;
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) continue;
      const data = await res.json();
      (data?.response?.results ?? []).forEach((a: GuardianApiResult) =>
        all.push({
          id: a.id,
          guardian_id: a.id,
          title: a.webTitle ?? "",
          summary: a.fields?.trailText ?? "",
          url: a.webUrl ?? "",
          image: a.fields?.thumbnail ?? null,
          date: a.webPublicationDate ?? new Date().toISOString(),
          section,
          score: 0,
          angle: "",
        }),
      );
    }

    const { data: existing } = await supabase.from("news_items").select("guardian_id");
    const existingIds = new Set((existing ?? []).map((x) => x.guardian_id));
    const fresh = all.filter((item) => !existingIds.has(item.guardian_id));
    if (!fresh.length) {
      return NextResponse.json({ inserted: 0, skipped: all.length, timestamp: new Date().toISOString() });
    }

    const headlines = fresh.map((f, i) => `${i}: ${f.title}`).join("\n");
    const scored = await callOpenAIJSON<{ scores: Array<{ index: number; score: number; angle: string }> }>({
      apiKey: openAiKey,
      system: SYSTEM_SCORE,
      user: `Score these headlines:\n${headlines}`,
      maxTokens: 1200,
    });

    const scoreMap = new Map<number, { score: number; angle: string }>();
    (scored.scores ?? []).forEach((s) => scoreMap.set(s.index, { score: s.score, angle: s.angle }));
    const insertables = fresh
      .map((f, i) => ({ ...f, ...(scoreMap.get(i) ?? { score: 0, angle: "" }) }))
      .filter((f) => f.score >= 55)
      .map((f) => ({
        guardian_id: f.guardian_id,
        title: f.title,
        summary: f.summary,
        url: f.url,
        image: f.image,
        published_at: f.date,
        section: f.section,
        score: f.score,
        angle: f.angle,
      }));

    if (insertables.length) {
      const { error } = await supabase.from("news_items").insert(insertables);
      if (error) throw error;
    }

    return NextResponse.json({
      inserted: insertables.length,
      skipped: all.length - insertables.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[scraper]", error);
    const maybePg = error as { code?: string; message?: string };
    if (maybePg?.code === "PGRST205") {
      return NextResponse.json(
        {
          error: "schema_missing",
          message: "Supabase tables are missing. Run: supabase db push",
        },
        { status: 500 },
      );
    }
    return NextResponse.json({ error: "scraper_failed", message: maybePg?.message ?? "ismeretlen hiba" }, { status: 500 });
  }
}
