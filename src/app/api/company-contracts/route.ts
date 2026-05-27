import { NextResponse } from "next/server";
import { fetchFederalSpendingForNode, formatFederalAwardUsd } from "@/lib/federalSpending";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Legacy alias — company recipient search. Prefer /api/federal-spending. */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const name = searchParams.get("name")?.trim();
  if (!name || name.length < 2) {
    return NextResponse.json({ error: "name required" }, { status: 400 });
  }

  const result = await fetchFederalSpendingForNode("company", name, name);

  if (!result) {
    return NextResponse.json({
      company: name,
      source: "USASpending.gov",
      totalListed: 0,
      totalAmountFormatted: formatFederalAwardUsd(0),
      awards: [],
    });
  }

  return NextResponse.json({
    company: name,
    source: "USASpending.gov",
    sourceNote: result.sourceNote,
    panelTitle: result.panelTitle,
    totalListed: result.totalCount,
    totalAmountListed: result.totalAmount,
    totalAmountFormatted: result.totalAmountFormatted,
    awards: result.awards.map((a) => ({
      ...a,
      amountFormatted: formatFederalAwardUsd(a.amount),
    })),
  });
}
