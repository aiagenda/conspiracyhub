import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) throw new Error("Supabase env missing");
  return createClient(url, key);
}

function sanitizeQ(q: string): string {
  return q.replace(/[%_,]/g, " ").trim().toLowerCase();
}

/** GET — public list of curated official / declassified reference links (A–Z in UI). */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const agency = searchParams.get("agency") ?? "";
    const letter = (searchParams.get("letter") ?? "").trim().toUpperCase();
    const q = sanitizeQ(searchParams.get("q") ?? "");

    const admin = getAdmin();

    let query = admin.from("reference_documents").select("id, agency, title, canonical_url, excerpt, year").order("title", { ascending: true });

    if (agency && agency !== "all") {
      query = query.eq("agency", agency);
    }

    const { data: rows, error } = await query;
    if (error) return NextResponse.json({ error: error.message, documents: [], agencies: [] }, { status: 500 });

    let documents = rows ?? [];

    if (q.length > 0) {
      documents = documents.filter(
        (d) =>
          (d.title ?? "").toLowerCase().includes(q) ||
          (d.excerpt ?? "").toLowerCase().includes(q) ||
          (d.canonical_url ?? "").toLowerCase().includes(q),
      );
    }

    if (letter.length === 1 && letter >= "A" && letter <= "Z") {
      documents = documents.filter((d) => {
        const c = (d.title?.trim().charAt(0) ?? "").toUpperCase();
        return c === letter;
      });
    }

    const { data: allAgencies } = await admin.from("reference_documents").select("agency");
    const agencies = [...new Set((allAgencies ?? []).map((r) => r.agency))].sort();

    return NextResponse.json({ documents, agencies });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg, documents: [], agencies: [] }, { status: 500 });
  }
}
