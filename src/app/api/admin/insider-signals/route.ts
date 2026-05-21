import { NextRequest, NextResponse } from "next/server";
import { listInsiderSignals, promoteInsiderToBoard } from "@/lib/server/insiderBoardPromote";

export const maxDuration = 60;

/** List unpromoted insider tweets + promote to feed board. */
export async function GET() {
  try {
    const data = await listInsiderSignals(25);
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Record<string, unknown>;
    const action = String(body.action ?? "promote");
    const signalKey = String(body.signalKey ?? body.signal_key ?? "");

    if (action !== "promote") {
      return NextResponse.json({ error: "unknown action" }, { status: 400 });
    }
    if (!signalKey) {
      return NextResponse.json({ error: "signalKey required" }, { status: 400 });
    }

    const result = await promoteInsiderToBoard(signalKey);
    return NextResponse.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const status = msg === "signal_not_found" ? 404 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
