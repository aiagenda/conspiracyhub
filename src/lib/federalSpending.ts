import type { NodeDetail, NodeType } from "@/types";

/** Public US federal spending — api.usaspending.gov, no API key. */

export type FederalAward = {
  awardId: string;
  recipient: string;
  amount: number;
  agency: string;
  startDate: string;
  description: string;
  usaspendingUrl: string;
};

export type FederalSpendingMode = "recipient" | "awarding_agency" | "keyword";

export type FederalSpendingResult = {
  mode: FederalSpendingMode;
  query: string;
  panelTitle: string;
  sourceNote: string;
  awards: FederalAward[];
  totalAmount: number;
  totalAmountFormatted: string;
  totalCount: number;
};

const USASPENDING_URL = "https://api.usaspending.gov/api/v2/search/spending_by_award/";
const PAGE_SIZE = 100;
/** Safety cap on pagination (20k awards) for very broad keyword queries. */
const MAX_PAGES = 200;

type CacheEntry = { at: number; result: FederalSpendingResult };
const cache = new Map<string, CacheEntry>();
const CACHE_MS = 24 * 60 * 60 * 1000;

const AGENCY_OFFICIAL_NAMES: Array<{ pattern: RegExp; name: string }> = [
  { pattern: /\bnasa\b|national aeronautics and space administration/i, name: "National Aeronautics and Space Administration" },
  { pattern: /\bdod\b|department of defense|\bpentagon\b/i, name: "Department of Defense" },
  { pattern: /\bdarpa\b|defense advanced research projects agency/i, name: "Department of Defense" },
  { pattern: /\bdhs\b|department of homeland security/i, name: "Department of Homeland Security" },
  { pattern: /\bdoe\b|department of energy/i, name: "Department of Energy" },
  { pattern: /\bhhs\b|department of health and human services|\bnih\b|national institutes of health|\bcdc\b/i, name: "Department of Health and Human Services" },
  { pattern: /\bfda\b|food and drug administration/i, name: "Department of Health and Human Services" },
  { pattern: /\bstate department\b|department of state/i, name: "Department of State" },
  { pattern: /\btreasury\b|department of the treasury/i, name: "Department of the Treasury" },
  { pattern: /\bjustice department\b|\bdoj\b|department of justice|\bfbi\b/i, name: "Department of Justice" },
  { pattern: /\bepa\b|environmental protection agency/i, name: "Environmental Protection Agency" },
  { pattern: /\bva\b|department of veterans affairs|\bveterans affairs\b/i, name: "Department of Veterans Affairs" },
  { pattern: /\busaid\b|agency for international development/i, name: "Agency for International Development" },
  { pattern: /\bgsa\b|general services administration/i, name: "General Services Administration" },
  { pattern: /\bnsf\b|national science foundation/i, name: "National Science Foundation" },
  { pattern: /\bnoaa\b|national oceanic and atmospheric administration/i, name: "Department of Commerce" },
  { pattern: /\bcommerce department\b|department of commerce/i, name: "Department of Commerce" },
  { pattern: /\btransportation department\b|\bdot\b|department of transportation|\bfaa\b/i, name: "Department of Transportation" },
  { pattern: /\busda\b|department of agriculture/i, name: "Department of Agriculture" },
  { pattern: /\binterior department\b|department of the interior/i, name: "Department of the Interior" },
  { pattern: /\blabor department\b|department of labor/i, name: "Department of Labor" },
  { pattern: /\beducation department\b|department of education/i, name: "Department of Education" },
  { pattern: /\bhud\b|housing and urban development/i, name: "Department of Housing and Urban Development" },
  { pattern: /\bssa\b|social security administration/i, name: "Social Security Administration" },
  { pattern: /\bsba\b|small business administration/i, name: "Small Business Administration" },
  { pattern: /\bcia\b|central intelligence agency|\bnsa\b|national security agency|\bnro\b/i, name: "Department of Defense" },
];

const AWARD_FIELDS = [
  "Award ID",
  "Recipient Name",
  "Award Amount",
  "Awarding Agency",
  "Start Date",
  "Description",
];

export function formatFederalAwardUsd(n: number): string {
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

function awardUrl(internalId: string): string {
  return `https://www.usaspending.gov/award/${encodeURIComponent(internalId)}`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export function detectUsAgency(text: string): string | null {
  const t = text.trim();
  if (!t) return null;
  for (const { pattern, name } of AGENCY_OFFICIAL_NAMES) {
    if (pattern.test(t)) return name;
  }
  return null;
}

export function shouldShowFederalSpending(nodeType: NodeType): boolean {
  return (
    nodeType === "company" ||
    nodeType === "person" ||
    nodeType === "event" ||
    nodeType === "patent" ||
    nodeType === "foia"
  );
}

export function resolveFederalSpendingQuery(
  nodeType: NodeType,
  label: string,
  title: string,
  detail?: Partial<Pick<NodeDetail, "body" | "source" | "actors" | "source_type">>,
): { mode: FederalSpendingMode; query: string; panelTitle: string; sourceNote: string } | null {
  const primary = (title || label).trim();
  if (primary.length < 2) return null;

  const blob = [title, label, detail?.source, detail?.body].filter(Boolean).join(" ");
  const agency = detectUsAgency(blob);

  if (nodeType === "foia" || (detail?.source_type === "official" && agency)) {
    if (agency) {
      return {
        mode: "awarding_agency",
        query: agency,
        panelTitle: `Federal contracts awarded (US) — ${agency}`,
        sourceNote: "Awards issued by this US federal agency; recipient shows who received funds.",
      };
    }
  }

  if (nodeType === "company") {
    if (agency) {
      return {
        mode: "awarding_agency",
        query: agency,
        panelTitle: `Federal spending — US agency (${label || agency})`,
        sourceNote: "Entity looks like a federal agency — showing awards it issued, not money it received.",
      };
    }
    return {
      mode: "recipient",
      query: primary,
      panelTitle: "Federal contracts received (US)",
      sourceNote: "All matching US federal awards received by this organization (USASpending.gov).",
    };
  }

  if (nodeType === "patent") {
    if (agency) {
      return {
        mode: "awarding_agency",
        query: agency,
        panelTitle: "Related federal agency spending (US)",
        sourceNote: "Agency-linked federal awards for this patent context.",
      };
    }
    return {
      mode: "recipient",
      query: primary,
      panelTitle: "Federal awards — patent org (US)",
      sourceNote: "Recipient search using the patent node title (often the assignee).",
    };
  }

  if (nodeType === "person") {
    return {
      mode: "keyword",
      query: primary,
      panelTitle: "Related federal awards (US)",
      sourceNote: "Combined keyword + recipient search for awards tied to this person.",
    };
  }

  if (nodeType === "event") {
    return {
      mode: "keyword",
      query: primary,
      panelTitle: "Related federal awards (US)",
      sourceNote: "Keyword search across award descriptions for this event.",
    };
  }

  return null;
}

function mapRow(row: Record<string, unknown>, fallbackRecipient: string): FederalAward | null {
  const awardId = String(row["Award ID"] ?? "").trim();
  const internalId = String(row.generated_internal_id ?? row.internal_id ?? awardId).trim();
  const amount = Number(row["Award Amount"] ?? 0);
  if (!internalId || !Number.isFinite(amount)) return null;
  return {
    awardId: awardId || internalId,
    recipient: String(row["Recipient Name"] ?? fallbackRecipient),
    amount,
    agency: String(row["Awarding Agency"] ?? "Federal agency"),
    startDate: String(row["Start Date"] ?? ""),
    description: String(row["Description"] ?? "").slice(0, 280),
    usaspendingUrl: awardUrl(internalId),
  };
}

function buildFilters(mode: FederalSpendingMode, query: string): Record<string, unknown> {
  const base: Record<string, unknown> = { award_type_codes: ["A", "B", "C", "D"] };
  if (mode === "recipient") return { ...base, recipient_search_text: [query.trim()] };
  if (mode === "awarding_agency") {
    return { ...base, agencies: [{ type: "awarding", tier: "toptier", name: query.trim() }] };
  }
  return { ...base, keywords: [query.trim()] };
}

async function fetchPage(mode: FederalSpendingMode, query: string, page: number): Promise<FederalAward[]> {
  const body = {
    filters: buildFilters(mode, query),
    fields: AWARD_FIELDS,
    limit: PAGE_SIZE,
    page,
    sort: "Award Amount",
    order: "desc",
  };

  const res = await fetch(USASPENDING_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(25_000),
  });
  if (!res.ok) return [];

  const json = (await res.json()) as { results?: Array<Record<string, unknown>> };
  return (json.results ?? []).map((row) => mapRow(row, query)).filter(Boolean) as FederalAward[];
}

export async function fetchAllFederalAwards(mode: FederalSpendingMode, query: string): Promise<FederalAward[]> {
  const all: FederalAward[] = [];
  const seen = new Set<string>();

  for (let page = 1; page <= MAX_PAGES; page++) {
    let batch: FederalAward[];
    try {
      batch = await fetchPage(mode, query, page);
    } catch {
      break;
    }
    if (!batch.length) break;

    for (const a of batch) {
      const id = a.awardId || a.usaspendingUrl;
      if (seen.has(id)) continue;
      seen.add(id);
      all.push(a);
    }

    if (batch.length < PAGE_SIZE) break;
    if (page < MAX_PAGES) await sleep(120);
  }

  return all;
}

async function fetchPersonAwards(name: string): Promise<FederalAward[]> {
  const [byKeyword, byRecipient] = await Promise.all([
    fetchAllFederalAwards("keyword", name),
    fetchAllFederalAwards("recipient", name),
  ]);
  const seen = new Set<string>();
  const merged: FederalAward[] = [];
  for (const a of [...byRecipient, ...byKeyword]) {
    const id = a.awardId || a.usaspendingUrl;
    if (seen.has(id)) continue;
    seen.add(id);
    merged.push(a);
  }
  merged.sort((a, b) => b.amount - a.amount);
  return merged;
}

export async function fetchFederalSpendingForNode(
  nodeType: NodeType,
  label: string,
  title: string,
  detail?: Partial<Pick<NodeDetail, "body" | "source" | "actors" | "source_type">>,
): Promise<FederalSpendingResult | null> {
  const resolved = resolveFederalSpendingQuery(nodeType, label, title, detail);
  if (!resolved) return null;

  const { mode, query, panelTitle, sourceNote } = resolved;
  const key = `${nodeType}:${mode}:${query.trim().toLowerCase()}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.result;

  const awards =
    nodeType === "person" ? await fetchPersonAwards(query) : await fetchAllFederalAwards(mode, query);

  const totalAmount = awards.reduce((s, a) => s + a.amount, 0);
  const result: FederalSpendingResult = {
    mode,
    query,
    panelTitle,
    sourceNote,
    awards,
    totalAmount,
    totalAmountFormatted: formatFederalAwardUsd(totalAmount),
    totalCount: awards.length,
  };

  cache.set(key, { at: Date.now(), result });
  return result;
}

export async function fetchFederalAwardsByRecipient(companyName: string): Promise<FederalAward[]> {
  return fetchAllFederalAwards("recipient", companyName);
}
