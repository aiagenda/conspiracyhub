import { NextRequest, NextResponse } from "next/server";
import { parsePublicationFilters } from "@/lib/publicationSearch";
import { searchPublication } from "@/lib/server/publicationArchive";

/** Search actual published records, without generating answers or exposing drafts. */
export async function GET(req: NextRequest) {
  const filters = parsePublicationFilters(req.nextUrl.searchParams);
  try {
    const response = await searchPublication(filters);
    return NextResponse.json({ ...response, query: filters.q }, {
      status: response.unavailable ? 503 : 200,
      headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120" },
    });
  } catch {
    return NextResponse.json({ error: "search_unavailable", message: "The archive could not be loaded. Please try again." }, { status: 503 });
  }
}
