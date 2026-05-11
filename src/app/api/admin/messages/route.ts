import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!,
  );
}

// GET all messages (paginated) — open for now; protect with auth before production.
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get("page") ?? "1", 10);
  const limit = 30;
  const from = (page - 1) * limit;

  const { data, count, error } = await admin()
    .from("contact_messages")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, from + limit - 1);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ messages: data, total: count });
}

// PATCH mark as read
export async function PATCH(req: NextRequest) {
  const { id, read } = await req.json() as { id: string; read: boolean };
  const { error } = await admin()
    .from("contact_messages")
    .update({ read })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

// DELETE a message
export async function DELETE(req: NextRequest) {
  const { id } = await req.json() as { id: string };
  const { error } = await admin().from("contact_messages").delete().eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
