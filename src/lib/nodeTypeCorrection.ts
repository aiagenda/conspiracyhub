import type { NodeType } from "@/types";

/** Sovereign nations / territories — lowercase keys for lookup. */
export const KNOWN_COUNTRY_NAMES = new Set([
  "russia", "china", "usa", "united states", "uk", "united kingdom", "great britain",
  "france", "germany", "iran", "israel", "ukraine", "taiwan", "north korea", "south korea",
  "india", "pakistan", "turkey", "saudi arabia", "australia", "canada", "japan", "brazil",
  "mexico", "italy", "spain", "poland", "netherlands", "sweden", "norway", "finland",
  "denmark", "belgium", "switzerland", "austria", "czech republic", "hungary", "romania",
  "greece", "syria", "iraq", "afghanistan", "venezuela", "cuba", "belarus", "georgia",
  "armenia", "azerbaijan", "kazakhstan", "serbia", "croatia", "slovenia", "slovakia",
  "estonia", "latvia", "lithuania", "moldova", "bulgaria", "albania", "egypt", "libya",
  "sudan", "ethiopia", "kenya", "nigeria", "ghana", "south africa", "indonesia", "malaysia",
  "philippines", "vietnam", "thailand", "myanmar", "cambodia", "bangladesh", "sri lanka",
  "new zealand", "ireland", "portugal", "morocco", "algeria",
]);

/** Regex patterns for government agencies / institutions. */
export const GOVERNMENT_PATTERNS = [
  /\bcia\b/i, /\bgchq\b/i, /\bfbi\b/i, /\bnsa\b/i, /\bmi[56]\b/i, /\bkgb\b/i, /\bfsb\b/i,
  /\bsvr\b/i, /\bmossad\b/i, /\bbnd\b/i, /\bdgse\b/i, /\bgru\b/i, /\bpentagon\b/i,
  /\bdarpa\b/i, /\bnasa\b/i, /\bnih\b/i, /\bdod\b/i, /\binterpol\b/i, /\beuropol\b/i,
  /department of (defense|state|justice|energy|homeland)/i,
  /ministry of (defense|foreign|interior|intelligence)/i,
  /intelligence (agenc|service|committee)/i,
  /\bnato\b/i, /\bhomeland security\b/i, /\b(fema|atf|dea|ice|cbp|tsa)\b/i,
  /\bsecurity service\b/i, /\bforeign office\b/i, /\bstate department\b/i,
];

function norm(s: string): string {
  return s.toLowerCase().trim().replace(/^the\s+/, "");
}

function isCountryName(text: string): boolean {
  const n = norm(text);
  if (!n) return false;
  if (KNOWN_COUNTRY_NAMES.has(n)) return true;
  // First token only (e.g. "RUSSIA — Foreign Actor" → "russia")
  const first = n.split(/[\s—–\-:,|]+/)[0]?.trim();
  if (first && KNOWN_COUNTRY_NAMES.has(first)) return true;
  // Country name appears as a whole word inside longer label/title
  for (const country of KNOWN_COUNTRY_NAMES) {
    if (country.length < 4) continue;
    if (new RegExp(`\\b${country.replace(/\s+/g, "\\s+")}\\b`, "i").test(n)) return true;
  }
  return false;
}

function isGovernmentEntity(text: string): boolean {
  if (!text.trim()) return false;
  return GOVERNMENT_PATTERNS.some((pat) => pat.test(text));
}

/**
 * Correct misclassified node types (e.g. Russia/China as company).
 * Applied on Oracle pipeline insert AND when loading cached boards.
 */
export function correctNodeType(opts: {
  type: NodeType;
  label: string;
  title?: string;
}): NodeType {
  const { type, label, title = "" } = opts;
  if (type === "article" || type === "theory" || type === "patent" || type === "foia") return type;

  const combined = `${label} ${title}`;

  if (isCountryName(label) || isCountryName(title)) return "country";

  if (type === "company" || type === "event") {
    if (isGovernmentEntity(combined)) return "government";
  }

  return type;
}
