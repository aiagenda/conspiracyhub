import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  analyticsExcludedFingerprints,
  pageViewFingerprintFromRequest,
} from "@/lib/analyticsExclude";

function anon() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

export async function POST(req: NextRequest) {
  try {
    const { path } = (await req.json()) as { path: string };
    const fingerprint = pageViewFingerprintFromRequest(req);
    const excluded = analyticsExcludedFingerprints();
    if (excluded.includes(fingerprint)) {
      return NextResponse.json({ ok: true, skipped: true });
    }

    await anon().from("page_views").insert({
      path: (path ?? "/").slice(0, 200),
      fingerprint,
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false });
  }
}
