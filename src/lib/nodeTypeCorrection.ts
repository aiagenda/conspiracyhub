import type { NodeType } from "@/types";

/**
 * Sovereign nations / territories — lowercase keys for lookup.
 * Includes UK constituent nations (Scotland, Wales, England, Northern Ireland),
 * which the board legitimately renders as COUNTRY · "UK Region".
 */
export const KNOWN_COUNTRY_NAMES = new Set([
  "russia", "china", "usa", "united states", "uk", "united kingdom", "great britain",
  "england", "scotland", "wales", "northern ireland",
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
  "qatar", "kuwait", "oman", "bahrain", "jordan", "lebanon", "yemen", "palestine",
  "united arab emirates", "uae",
]);

/**
 * Exact-label government acronyms / bodies (case-insensitive, matched against the whole
 * label or its first segment). Used for short tokens that would cause false positives as
 * `\bword\b` regexes — e.g. "WHO" is also the English word "who", "FED" appears in text.
 * Derived from real Oracle boards where these were mislabelled as company/country.
 */
export const GOV_ACRONYM_LABELS = new Set([
  "who", "fed", "federal reserve", "fomc", "jioa", "fisa", "epa", "cdc", "osha", "nsa",
  "fbi", "cia", "fda", "atf", "dea", "ice", "cbp", "tsa", "fema", "sec", "irs", "faa",
  "unfccc", "ofcom", "ofgem", "ofsted", "nhs", "gchq", "darpa", "nasa", "nih",
  "us house", "us senate", "us govt", "us government", "us military", "us doj",
  "uk parliament", "uk govt",
]);

/** Regex patterns for government agencies / institutions (intelligence, ministries, departments). */
export const GOVERNMENT_PATTERNS = [
  /\bcia\b/i, /\bgchq\b/i, /\bfbi\b/i, /\bnsa\b/i, /\bmi[56]\b/i, /\bkgb\b/i, /\bfsb\b/i,
  /\bsvr\b/i, /\bmossad\b/i, /\bbnd\b/i, /\bdgse\b/i, /\bgru\b/i, /\bpentagon\b/i,
  /\bdarpa\b/i, /\bnasa\b/i, /\bnih\b/i, /\bdod\b/i, /\binterpol\b/i, /\beuropol\b/i,
  /department of (defense|state|justice|energy|homeland)/i,
  /ministry of (defense|defence|foreign|interior|intelligence|justice|health)/i,
  /intelligence (agenc|service|committee)/i,
  /\bnato\b/i, /\bhomeland security\b/i, /\b(fema|atf|dea|ice|cbp|tsa)\b/i,
  /\bsecurity service\b/i, /\bforeign office\b/i, /\bstate department\b/i,
  // UK government bodies (common on this feed via the Guardian source)
  /\bhome office\b/i, /\bborder force\b/i, /\bukvi\b/i, /uk visas (and|&) immigration/i,
  /\bdwp\b/i, /\bhmrc\b/i, /hm (revenue|treasury)/i, /\bcabinet office\b/i,
  /foreign,? commonwealth/i, /department for [a-z]/i, /\bdowning street\b/i, /number 10/i,
  /\bnhs\b/i, /\bofcom\b/i, /\bofgem\b/i, /\bofsted\b/i, /environment agency/i,
  // Generic explicit markers (kept narrow to avoid matching media/company "agency" names)
  /\bgovernment agency\b/i, /\bgov(ernment)? department\b/i, /\bregulatory (body|agency)\b/i,
  /\bgovernment\b/i, /\bparliament\b/i, /\bwhite house\b/i, /\bkremlin\b/i,
  /\b(senate|congress|politburo)\b/i,
  // From real Oracle boards: legislatures, military branches, law enforcement, abbreviations.
  /\bfederal reserve\b/i, /\bcentral bank\b/i, /\bgovt\b/i, /\bgov\b/i,
  /\b(us |u\.s\. )?military\b/i, /\b(navy|army|air force|marines|armed forces)\b/i,
  /\bhouse of (representatives|commons|lords)\b/i, /\bus house\b/i,
  /\bprison system\b/i, /\b(dept|department)\.? of corrections\b/i, /\bpenitentiary\b/i,
  /\blaw enforcement\b/i, /\b(police|constabulary)\b/i,
  /\bcommission\b/i, // regulators / statutory bodies (Charity Commission, Electoral Commission, etc.)
];

/** Policy / law / operation / topic markers — a "country"-typed node matching these is a concept, not a place. */
export const CONCEPT_PATTERNS = [
  /\bpolicy\b/i, /\bclampdown\b/i, /\bcrackdown\b/i, /\blegislation\b/i, /\bregulation\b/i,
  /\b(act|bill|law|treaty|accord|doctrine|sanctions?)\b/i, /\bimmigration\b/i,
  /\bprogram(me)?\b/i, /\binitiative\b/i, /\bscandal\b/i, /\boperation\b/i, /\bscheme\b/i,
];

/**
 * Collective / role labels that the model sometimes types as "person" but are really groups,
 * not individuals (from real boards: "Health Advocates", "Conspiracy Theorists",
 * "Alleged Victims", "Alleged Backers", "Board of Gov"). Matched against the LABEL only
 * (a real person's name will not match these plurals).
 */
export const COLLECTIVE_PATTERNS = [
  /\b(advocates|theorists|victims|backers|donors|activists|officials|lawyers|residents|protesters|supporters|experts|scientists|members|associates|operatives|theorists|witnesses|investigators|authorities)\b/i,
  /\bboard of\b/i, /\b(orgs|organizations|organisations|groups|parties|committees)\b/i,
];

function norm(s: string): string {
  return s.toLowerCase().trim().replace(/^the\s+/, "");
}

function isCountryName(text: string): boolean {
  const n = norm(text);
  if (!n) return false;
  if (KNOWN_COUNTRY_NAMES.has(n)) return true;
  // Country name appears as a whole word (e.g. "RUSSIA — Foreign Actor" → country).
  // NOTE: we deliberately do NOT match a short leading token like "uk"/"us", because
  // labels such as "UK IMMIGRATION" or "US POLICY" are concepts, not countries — those
  // are handled by the concept demotion below. Only names ≥4 chars match here.
  for (const country of KNOWN_COUNTRY_NAMES) {
    if (country.length < 4) continue;
    if (new RegExp(`\\b${country.replace(/\s+/g, "\\s+")}\\b`, "i").test(n)) return true;
  }
  return false;
}

function matchesAny(patterns: RegExp[], text: string): boolean {
  if (!text.trim()) return false;
  return patterns.some((pat) => pat.test(text));
}

/** Exact-label (or first-segment) match against known government acronyms / bodies. */
function isGovAcronymLabel(text: string): boolean {
  const n = norm(text);
  if (!n) return false;
  if (GOV_ACRONYM_LABELS.has(n)) return true;
  const first = n.split(/[\s—–\-:,|/]+/).slice(0, 2).join(" ").trim();
  return GOV_ACRONYM_LABELS.has(first) || GOV_ACRONYM_LABELS.has(n.split(/[\s—–\-:,|/]+/)[0] ?? "");
}

/** The `sub` line often literally states the kind ("UK Gov Agency", "Policy Clampdown"). */
function subSignalsGovernment(sub: string): boolean {
  return /\b(gov(ernment|'?t)?|agency|ministry|department|administration|bureau|regulator|intelligence|police|military|armed forces|parliament|home office)\b/i.test(
    sub,
  );
}

/**
 * Correct misclassified node types.
 *
 * Handles both directions:
 *  - promotion: a sovereign nation mislabelled as company/event → country;
 *    a government body mislabelled as company/event → government.
 *  - demotion (the previously-missing case): a node the model typed as `country`
 *    that is NOT a real nation — e.g. "Home Office" (agency) or "UK Immigration"
 *    (policy) — gets reclassified to government or event.
 *
 * Applied on Oracle pipeline insert AND when loading cached boards.
 */
export function correctNodeType(opts: {
  type: NodeType;
  label: string;
  title?: string;
  sub?: string;
}): NodeType {
  const { type, label, title = "", sub = "" } = opts;
  if (type === "article" || type === "theory" || type === "patent" || type === "foia") return type;

  const labelTitle = `${label} ${title}`;
  // Name-based government signal (label/title only). This is strong and always wins —
  // unlike the sub, which describes attributes ("CIA Director") and must not flip a person.
  const govByName =
    isGovAcronymLabel(label) || isGovAcronymLabel(title) || matchesAny(GOVERNMENT_PATTERNS, labelTitle);
  const isCountry = isCountryName(label) || isCountryName(title);

  // 1. A "person" is an individual. Only its own NAME (not an agency in its sub) can
  //    reclassify it: to government if the name IS a body (e.g. "FBI"), or to company if
  //    the name is a collective/group ("Alleged Victims"). Otherwise it stays a person —
  //    "Allen Dulles" / sub "CIA Director" remains a person, not the CIA.
  if (type === "person") {
    if (govByName) return "government";
    if (matchesAny(COLLECTIVE_PATTERNS, label)) return "company";
    return "person";
  }

  // 2. Name-based government body (CIA, Home Office, US Military) — wins over everything.
  if (govByName) return "government";

  // 3. Genuine sovereign nation / region — attributes in the sub do NOT demote it
  //    ("Iran" stays a country even if its sub mentions "Military").
  if (isCountry) return "country";

  // 4. Government signalled only by the sub line (non-country nodes) — e.g. an event whose
  //    sub is "1975 Senate Investigation" → government body.
  if (matchesAny(GOVERNMENT_PATTERNS, sub) || subSignalsGovernment(sub)) return "government";

  // 5. Demote a node wrongly typed as `country` that is not an actual nation.
  if (type === "country") {
    if (matchesAny(CONCEPT_PATTERNS, `${label} ${sub}`)) return "event"; // policy / law / operation
    // Sub-national place (US state, province, region) — keep as country, like "Scotland".
    if (/\b(state|province|region|territory|county|municipality|prefecture|district|nation)\b/i.test(`${label} ${sub}`)) {
      return "country";
    }
    return "company"; // organisation / entity — anything but a sovereign state
  }

  return type;
}
