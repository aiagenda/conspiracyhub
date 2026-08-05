import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createHash } from "crypto";

function admin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);
}

function ipHash(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for") ?? "";
  const ip = forwarded.split(",")[0].trim() || "unknown";
  return createHash("sha256").update(ip).digest("hex").slice(0, 16);
}

/** Public newsletter signup — stored in contact_messages until a dedicated list exists. */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { email?: string; source?: string };
    const email = body.email?.trim().toLowerCase() ?? "";
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Invalid email" }, { status: 400 });
    }

    const hash = ipHash(req);
    const cutoff = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count } = await admin()
      .from("contact_messages")
      .select("*", { count: "exact", head: true })
      .eq("ip_hash", hash)
      .gte("created_at", cutoff);

    if ((count ?? 0) >= 5) {
      return NextResponse.json({ error: "Too many requests — try again later." }, { status: 429 });
    }

    const source = (body.source ?? "feed").slice(0, 80);
    const { error } = await admin().from("contact_messages").insert({
      name: "Newsletter subscriber",
      email: email.slice(0, 200),
      category: "other",
      subject: "Weekly Oracle Brief — subscribe",
      message: `Newsletter signup from ${source}. Add to weekly briefing list.`,
      ip_hash: hash,
    });

    if (error) {
      console.error("[newsletter/subscribe]", error.message);
      return NextResponse.json({ error: "Could not save subscription" }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[newsletter/subscribe]", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
