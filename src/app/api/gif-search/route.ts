import { NextRequest, NextResponse } from "next/server";

export const revalidate = 300;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim() ?? "";
  if (!q) return NextResponse.json({ gifs: [] });

  // Uses Tenor v1 API. Set TENOR_API_KEY in env for production quota.
  // Falls back to the public demo key which works for development.
  const key = process.env.TENOR_API_KEY ?? "LIVDSRZULELA";
  const url = `https://api.tenor.com/v1/search?q=${encodeURIComponent(q)}&key=${key}&limit=12&media_filter=minimal&contentfilter=low`;

  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(6000) });
    if (!r.ok) return NextResponse.json({ gifs: [] });
    const data = (await r.json()) as { results?: unknown[] };

    const gifs = (data.results ?? [])
      .map((item) => {
        const it = item as Record<string, unknown>;
        const media = ((it.media as Record<string, unknown>[])?.[0]) ?? {};
        return {
          id: it.id as string,
          url: ((media.gif as Record<string, unknown>)?.url as string) ?? "",
          preview: ((media.tinygif as Record<string, unknown>)?.url as string) ?? "",
        };
      })
      .filter((g) => g.url);

    return NextResponse.json({ gifs });
  } catch (e) {
    return NextResponse.json({ gifs: [], error: String(e) });
  }
}
