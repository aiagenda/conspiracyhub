import { NextRequest, NextResponse } from "next/server";
import {
  generateRedditDraft,
  listRedditMatches,
  runRedditRadarScan,
  updateRedditMatchStatus,
} from "@/lib/server/redditRadar";

export const maxDuration = 120;

/** List matches, scan Reddit, generate drafts, or update status. */
export async function GET() {
  try {
    const data = await listRedditMatches(30);
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Record<string, unknown>;
    const action = String(body.action ?? "scan");

    if (action === "scan") {
      const result = await runRedditRadarScan();
      return NextResponse.json(result);
    }

    const matchId = String(body.matchId ?? body.id ?? "");
    if (!matchId) {
      return NextResponse.json({ error: "matchId required" }, { status: 400 });
    }

    if (action === "draft") {
      const result = await generateRedditDraft(matchId);
      return NextResponse.json(result);
    }

    if (action === "dismiss") {
      await updateRedditMatchStatus(matchId, "dismissed");
      return NextResponse.json({ ok: true });
    }

    if (action === "posted") {
      await updateRedditMatchStatus(matchId, "posted");
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "unknown action" }, { status: 400 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const status = msg === "match_not_found" ? 404 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
