import { NextResponse } from "next/server";
import { loadSeismicPayload } from "@/lib/server/seismicFeeds";

export const revalidate = 300;

export async function GET() {
  try {
    const payload = await loadSeismicPayload();
    return NextResponse.json(payload);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
