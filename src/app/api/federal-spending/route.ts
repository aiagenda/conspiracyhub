import { NextResponse } from "next/server";
import {
  fetchFederalSpendingForNode,
  formatFederalAwardUsd,
  shouldShowFederalSpending,
} from "@/lib/federalSpending";
import type { NodeDetail, NodeType } from "@/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const VALID_TYPES = new Set<NodeType>(["company", "government", "person", "event", "patent", "foia"]);

/** Full US federal spending for a board node (USASpending.gov — no API key). */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const name = searchParams.get("name")?.trim();
  const nodeType = (searchParams.get("nodeType") ?? "company") as NodeType;
  const label = searchParams.get("label")?.trim() ?? name ?? "";
  const title = searchParams.get("title")?.trim() ?? name ?? "";
  const source = searchParams.get("source")?.trim() || undefined;
  const sourceTypeRaw = searchParams.get("sourceType")?.trim();
  const source_type = sourceTypeRaw as NodeDetail["source_type"] | undefined;

  if (!name || name.length < 2) {
    return NextResponse.json({ error: "name required" }, { status: 400 });
  }
  if (!VALID_TYPES.has(nodeType)) {
    return NextResponse.json({ error: "invalid nodeType" }, { status: 400 });
  }
  if (!shouldShowFederalSpending(nodeType)) {
    return NextResponse.json({ error: "node_type_not_supported" }, { status: 400 });
  }

  const detail: Partial<Pick<NodeDetail, "source" | "source_type">> = {};
  if (source) detail.source = source;
  if (source_type) detail.source_type = source_type;

  const result = await fetchFederalSpendingForNode(nodeType, label, title, detail);

  if (!result) {
    return NextResponse.json({
      query: name,
      nodeType,
      awards: [],
      totalCount: 0,
      totalAmountFormatted: formatFederalAwardUsd(0),
      panelTitle: "Federal spending (US)",
      sourceNote: "No search strategy for this node.",
    });
  }

  return NextResponse.json({
    source: "USASpending.gov",
    nodeType,
    mode: result.mode,
    query: result.query,
    panelTitle: result.panelTitle,
    sourceNote: result.sourceNote,
    totalCount: result.totalCount,
    totalAmountListed: result.totalAmount,
    totalAmountFormatted: result.totalAmountFormatted,
    awards: result.awards.map((a) => ({
      ...a,
      amountFormatted: formatFederalAwardUsd(a.amount),
    })),
  });
}
