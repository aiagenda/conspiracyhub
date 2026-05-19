import { NextRequest, NextResponse } from "next/server";
import { callOpenAIJSON } from "@/lib/openai";
import { findIncidentById, loadUapPayload } from "@/lib/server/uapIngest";

let uapCache: { data: unknown; ts: number } | null = null;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type") ?? "all";
  const id = searchParams.get("id") ?? "";
  const fresh = searchParams.get("fresh") === "1";

  if (type === "analyze" && id) {
    const incident = await findIncidentById(id);
    if (!incident) return NextResponse.json({ error: "not_found" }, { status: 404 });
    try {
      const analysis = await callOpenAIJSON<{
        summary: string;
        conspiracy_angle: string;
        probability: number;
        key_connections: string[];
        verdict: string;
      }>({
        apiKey: process.env.OPENAI_API_KEY!,
        system: `You are a UAP intelligence analyst. Analyze the given incident and return ONLY valid JSON:
{"summary":"3-4 sentences factual analysis referencing real evidence","conspiracy_angle":"specific cover-up or hidden program suggested by the evidence","probability":45,"key_connections":["connection1","connection2","connection3"],"verdict":"NATURAL_PHENOMENON|CLASSIFIED_TECHNOLOGY|NON_HUMAN_ORIGIN|UNKNOWN"}`,
        user: `Incident: ${incident.name}\nDate: ${incident.date}\nLocation: ${incident.location}\nDescription: ${incident.description}\nWitnesses: ${incident.witnesses.join(", ")}\nDocuments: ${incident.documents.join(", ")}`,
        maxTokens: 600,
        model: "gpt-4o-mini",
      });
      return NextResponse.json({ incident, analysis });
    } catch (e) {
      return NextResponse.json({ incident, analysis: null, error: String(e) });
    }
  }

  if (!fresh && uapCache && Date.now() - uapCache.ts < 1_800_000) {
    return NextResponse.json(uapCache.data);
  }

  const payload = await loadUapPayload({ liveFallback: true });
  uapCache = { data: payload, ts: Date.now() };
  return NextResponse.json(payload);
}
