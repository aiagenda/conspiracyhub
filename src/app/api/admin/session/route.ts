import { NextRequest, NextResponse } from "next/server";
import { requireAdminRequest } from "@/lib/server/requireAdminSession";

export async function GET(req: NextRequest) {
  const access = await requireAdminRequest(req);
  if ("response" in access) return access.response;
  return NextResponse.json({ userId: access.userId }, { headers: { "Cache-Control": "private, no-store" } });
}
