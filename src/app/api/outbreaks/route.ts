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
  kazakhstan: [48.01, 66.92],
  argentina: [-38.41, -63.61],
  chile: [-35.67, -71.54],
  bolivia: [-16.29, -63.58],
  venezuela: [6.42, -66.58],
  panama: [8.53, -80.78],
  "costa rica": [9.74, -83.75],
  nicaragua: [12.86, -85.2],
  tanzania: [-6.36, 34.89],
  rwanda: [-1.94, 29.87],
  uganda: [1.37, 32.29],
  ghana: [7.95, -1.02],
  "sierra leone": [8.46, -11.78],
  liberia: [6.43, -9.43],
  global: [20, 0],
};

type CuratedItem = { title: string; description: string; link: string; pubDate: string };

const CURATED_DISEASES: CuratedItem[] = [
  {
    title: "Hantavirus — South America & Central Asia",
    description:
      "Hantavirus cases reported. Spread via rodent contact. No human-to-human transmission confirmed. Early warning clusters detected.",
    link: "https://www.who.int/emergencies/disease-outbreak-news",
    pubDate: new Date().toISOString(),
  },
  {
    title: "H5N1 Avian Influenza — Human Cases",
    description:
      "H5N1 bird flu human infections confirmed in multiple countries. WHO monitoring for sustained human-to-human transmission.",
    link: "https://www.who.int/emergencies/disease-outbreak-news",
    pubDate: new Date().toISOString(),
  },
  {
    title: "Mpox — Clade Ib Ongoing Outbreak",
    description:
      "Mpox clade Ib spreading across Central Africa. New variants show higher transmissibility. WHO declared public health emergency.",
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
    title: "Dengue Fever — Record Cases South America",
    description:
      "Brazil reports over 3 million dengue cases. Aedes aegypti mosquito range expanding due to climate change.",
    link: "https://www.who.int/emergencies/disease-outbreak-news",
    pubDate: new Date().toISOString(),
  },
  {
    title: "Cholera — Sub-Saharan Africa",
    description: "Cholera spreading across multiple African countries. WHO reports over 500,000 cases this year.",
    link: "https://www.who.int/emergencies/disease-outbreak-news",
    pubDate: new Date().toISOString(),
  },
];

async function fetchLocalNews(
  disease: string,
  country: string,
): Promise<Array<{ title: string; url: string; source: string; pubDate: string }>> {
  try {
    const query = encodeURIComponent(`${disease} ${country}`);
    const url = `https://news.google.com/rss/search?q=${query}&hl=en-US&gl=US&ceid=US:en&num=5`;
    const res = await fetch(url, {
      headers: { "User-Agent": "TheTheorist/1.0" },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return [];
    const xml = await res.text();
    const items: Array<{ title: string; url: string; source: string; pubDate: string }> = [];
    for (const m of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
      const x = m[1];
      const title = x.match(/<title>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/title>/)?.[1]?.trim() ?? "";
      const link = x.match(/<link>(.*?)<\/link>/)?.[1]?.trim() ?? "";
      const pub = x.match(/<pubDate>(.*?)<\/pubDate>/)?.[1]?.trim() ?? "";
      const source = x.match(/<source[^>]*>(.*?)<\/source>/)?.[1]?.trim() ?? "";
      if (title && link) items.push({ title, url: link, source, pubDate: pub });
    }
    return items.slice(0, 5);
  } catch {
    return [];
  }
}

const SYS = `You are a disease outbreak intelligence analyst. Analyze the outbreak for conspiracy relevance, patents, and geopolitical context.
LANGUAGE: All JSON string values MUST be English only.

Return ONLY valid JSON:
{
  "disease":"short disease name (1-3 words)",
  "location":"primary affected country (lowercase, single country or 'multiple countries')",
  "lat":0.0,"lng":0.0,
  "conspiracy_score":0,
  "has_conspiracy":false,
  "theories":[{"name":"","summary":"2-3 sentences","probability":20,"sources":["https://"]}],
  "patents":[{"number":"US...","title":"","assignee":"","url":"https://patents.google.com/patent/..."}],
  "key_facts":["fact1","fact2","fact3"],
  "verdict":"NATURAL",
  "risk_level":"MEDIUM",
  "origin_country":"lowercase country name where outbreak originated"
}
verdict: NATURAL|SUSPICIOUS|HIGHLY_SUSPICIOUS|UNKNOWN
risk_level: LOW|MEDIUM|HIGH|CRITICAL
Only cite real patent numbers and real URLs. conspiracy_score based on documented theories only.`;

type AnalysisRow = {
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
  origin_country: string;
};

async function fetchWHO(): Promise<CuratedItem[]> {
  try {
    const res = await fetch(WHO_RSS, {
      headers: { "User-Agent": "TheTheorist/1.0" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return CURATED_DISEASES;
    const xml = await res.text();
    const items: CuratedItem[] = [];
    for (const m of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
      const x = m[1];
      const title = x.match(/<title>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/title>/)?.[1]?.trim() ?? "";
      const desc =
        x.match(/<description>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/)?.[1]?.replace(/<[^>]+>/g, "").trim() ?? "";
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
    const combined = [...CURATED_DISEASES];
    for (const item of items) {
      const alreadyHave = combined.some(
        (c) => c.title.toLowerCase().split(" ")[0] === item.title.toLowerCase().split(" ")[0],
      );
      if (!alreadyHave) combined.push(item);
    }
    return combined.slice(0, 10);
  } catch {
    return CURATED_DISEASES;
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
      items.slice(0, 8).map(async (item) => {
        const analysis = await callOpenAIJSON<AnalysisRow>({
          apiKey: process.env.OPENAI_API_KEY!,
          system: SYS,
          user: `"${item.title}"\n\n${item.description}\n\nSource: ${item.link}`,
          maxTokens: 900,
          model: "gpt-4o-mini",
          maxAttempts: 2,
        });
        const localNews = await fetchLocalNews(analysis.disease, analysis.origin_country || analysis.location);
        return { ...analysis, localNews, rawItem: item };
      }),
    );

    const outbreaks = settled
      .map((r, i) => {
        if (r.status === "rejected") return null;
        const { rawItem, ...rest } = r.value;
        const loc = rest.location?.toLowerCase() ?? "";
        const origin = rest.origin_country?.toLowerCase() ?? "";
        const ck = Object.keys(COORDS).find((k) => loc.includes(k) || origin.includes(k));
        const [lat, lng] = ck ? COORDS[ck]! : [rest.lat ?? 0, rest.lng ?? 0];
        return {
          id: `ob-${i}-${Date.now()}`,
          title: rawItem.title,
          description: rawItem.description,
          source_url: rawItem.link,
          published_at: rawItem.pubDate,
          ...rest,
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
