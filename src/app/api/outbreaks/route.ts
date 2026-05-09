import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { callOpenAIJSON } from "@/lib/openai";

const WHO_RSS = "https://www.who.int/rss-feeds/news-releases.xml";

const COORDS: Record<string, [number, number]> = {
  china: [35.86, 104.19],
  india: [20.59, 78.96],
  brazil: [-14.23, -51.92],
  congo: [-4.03, 21.75],
  drc: [-4.03, 21.75],
  nigeria: [9.08, 8.67],
  "united states": [37.09, -95.71],
  usa: [37.09, -95.71],
  kenya: [-0.02, 37.9],
  ethiopia: [9.14, 40.48],
  pakistan: [30.37, 69.34],
  indonesia: [-0.78, 113.92],
  philippines: [12.87, 121.77],
  ukraine: [48.37, 31.16],
  russia: [61.52, 105.31],
  iran: [32.42, 53.68],
  egypt: [26.82, 30.8],
  "south africa": [-30.55, 22.93],
  cambodia: [12.56, 104.99],
  myanmar: [21.91, 95.95],
  bangladesh: [23.68, 90.35],
  sudan: [12.86, 30.21],
  somalia: [5.15, 46.19],
  chad: [15.45, 18.73],
  guinea: [11.8, -15.18],
  peru: [-9.19, -75.01],
  colombia: [4.57, -74.29],
  mexico: [23.63, -102.55],
  global: [20, 0],
};

const FALLBACKS = [
  {
    title: "H5N1 Avian Influenza — Human Cases",
    description:
      "H5N1 bird flu human infections confirmed in multiple countries. WHO monitoring for sustained human-to-human transmission.",
    link: "https://www.who.int/emergencies/disease-outbreak-news",
    pubDate: new Date().toISOString(),
  },
  {
    title: "Mpox — Ongoing Outbreak Multiple Countries",
    description: "Mpox clade Ib spreading across Central Africa. New variants show higher transmissibility.",
    link: "https://www.who.int/emergencies/disease-outbreak-news",
    pubDate: new Date().toISOString(),
  },
  {
    title: "Dengue Fever — Record Cases South America",
    description: "Brazil reports over 3 million dengue cases. Aedes aegypti mosquito range expanding due to climate change.",
    link: "https://www.who.int/emergencies/disease-outbreak-news",
    pubDate: new Date().toISOString(),
  },
  {
    title: "Cholera — Sub-Saharan Africa",
    description: "Cholera spreading across multiple African countries. WHO reports over 500,000 cases.",
    link: "https://www.who.int/emergencies/disease-outbreak-news",
    pubDate: new Date().toISOString(),
  },
  {
    title: "Marburg Virus Disease — East Africa",
    description:
      "Marburg virus outbreak confirmed. Contact tracing underway. High fatality rate disease with no approved vaccine.",
    link: "https://www.who.int/emergencies/disease-outbreak-news",
    pubDate: new Date().toISOString(),
  },
  {
    title: "H5N2 Avian Influenza — United States",
    description: "H5N2 strain detected in poultry and dairy cattle workers. CDC investigating potential adaptation.",
    link: "https://www.who.int/emergencies/disease-outbreak-news",
    pubDate: new Date().toISOString(),
  },
];

const SYS = `You are a disease outbreak intelligence analyst. Analyze the given outbreak for conspiracy relevance.
LANGUAGE: All JSON string values MUST be English only.

Return ONLY valid JSON:
{
  "disease":"short disease name",
  "location":"primary country lowercase",
  "lat":0.0,"lng":0.0,
  "conspiracy_score":0,
  "has_conspiracy":false,
  "theories":[{"name":"","summary":"2 sentences","probability":20,"sources":["https://"]}],
  "patents":[{"number":"US...","title":"","assignee":"","url":"https://patents.google.com/patent/..."}],
  "key_facts":["fact1","fact2","fact3"],
  "verdict":"NATURAL",
  "risk_level":"MEDIUM"
}
verdict: NATURAL|SUSPICIOUS|HIGHLY_SUSPICIOUS|UNKNOWN
risk_level: LOW|MEDIUM|HIGH|CRITICAL
conspiracy_score 0-100 based only on real documented theories.
Only cite real patent numbers and real URLs.`;

async function fetchWHO() {
  try {
    const res = await fetch(WHO_RSS, {
      headers: { "User-Agent": "TheTheorist/1.0" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return FALLBACKS;
    const xml = await res.text();
    const items: typeof FALLBACKS = [];
    for (const m of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
      const x = m[1];
      const title = x.match(/<title>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/title>/)?.[1]?.trim() ?? "";
      const desc =
        x
          .match(/<description>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/)?.[1]
          ?.replace(/<[^>]+>/g, "")
          .trim() ?? "";
      const link = x.match(/<link>(.*?)<\/link>/)?.[1]?.trim() ?? "";
      const pub = x.match(/<pubDate>(.*?)<\/pubDate>/)?.[1]?.trim() ?? "";
      if (
        title &&
        /disease|outbreak|virus|infection|fever|flu|ebola|mpox|cholera|plague|epidemic|dengue|marburg|hanta|polio|measles/i.test(
          title + desc,
        )
      ) {
        items.push({ title, description: desc.slice(0, 300), link, pubDate: pub });
      }
    }
    return items.length ? items.slice(0, 10) : FALLBACKS;
  } catch {
    return FALLBACKS;
  }
}

export async function GET() {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_KEY;
    if (!url || !key) {
      return NextResponse.json({ error: "server_misconfigured" }, { status: 500 });
    }
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: "openai_missing" }, { status: 500 });
    }

    const admin = createClient(url, key);
    try {
      const { data: c } = await admin
        .from("outbreak_cache")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (c && Date.now() - new Date(c.created_at).getTime() < 3_600_000) {
        return NextResponse.json(c.data);
      }
    } catch {
      /* table may not exist until migration */
    }

    const items = await fetchWHO();
    const settled = await Promise.allSettled(
      items.slice(0, 8).map((item) =>
        callOpenAIJSON<{
          disease: string;
          location: string;
          lat: number;
          lng: number;
          conspiracy_score: number;
          has_conspiracy: boolean;
          theories: Array<{ name: string; summary: string; probability: number; sources: string[] }>;
          patents: Array<{ number: string; title: string; assignee: string; url: string }>;
          key_facts: string[];
          verdict: string;
          risk_level: string;
        }>({
          apiKey: process.env.OPENAI_API_KEY!,
          system: SYS,
          user: `"${item.title}"\n\n${item.description}\n\nSource: ${item.link}`,
          maxTokens: 900,
          model: "gpt-4o-mini",
          maxAttempts: 2,
        }),
      ),
    );

    const outbreaks = settled
      .map((r, i) => {
        if (r.status === "rejected") return null;
        const a = r.value;
        const ck = Object.keys(COORDS).find((k) => a.location?.toLowerCase().includes(k));
        const [lat, lng] = ck ? COORDS[ck]! : [a.lat ?? 0, a.lng ?? 0];
        return {
          id: `ob-${i}-${Date.now()}`,
          title: items[i]!.title,
          description: items[i]!.description,
          source_url: items[i]!.link,
          published_at: items[i]!.pubDate,
          ...a,
          lat,
          lng,
        };
      })
      .filter(Boolean);

    const payload = { outbreaks, generated_at: new Date().toISOString() };
    try {
      await admin.from("outbreak_cache").insert({ data: payload });
    } catch {
      /* ignore cache insert failure */
    }
    return NextResponse.json(payload);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
