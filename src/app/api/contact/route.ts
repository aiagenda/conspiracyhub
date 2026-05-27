import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createHash } from "crypto";
import { getPostHogClient } from "@/lib/posthog-server";

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!,
  );
}

function ipHash(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for") ?? "";
  const ip = forwarded.split(",")[0].trim() || "unknown";
  return createHash("sha256").update(ip).digest("hex").slice(0, 16);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, email, category, subject, message } = body as {
      name: string;
      email: string;
      category: string;
      subject: string;
      message: string;
    };

    if (!name?.trim() || !email?.trim() || !subject?.trim() || !message?.trim()) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const hash = ipHash(req);

    // Rate limit: max 3 messages per IP hash in the last hour
    const cutoff = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count } = await admin()
      .from("contact_messages")
      .select("*", { count: "exact", head: true })
      .eq("ip_hash", hash)
      .gte("created_at", cutoff);

    if ((count ?? 0) >= 3) {
      return NextResponse.json(
        { error: "Too many messages. Please wait before trying again." },
        { status: 429 },
      );
    }

    const { error } = await admin().from("contact_messages").insert({
      name: name.trim().slice(0, 120),
      email: email.trim().slice(0, 200),
      category: ["support", "business", "press", "other"].includes(category)
        ? category
        : "other",
      subject: subject.trim().slice(0, 200),
      message: message.trim().slice(0, 4000),
      ip_hash: hash,
    });

    if (error) throw error;

    getPostHogClient().capture({
      distinctId: hash,
      event: "contact_message_sent",
      properties: { category },
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("/api/contact error:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
