/** Brave search query tailored to investigation board node type. */
export function buildBraveQuery(type: string, nodeTitle: string, topic: string): string {
  const t = nodeTitle.slice(0, 50);
  const ctx = topic.slice(0, 40);
  switch (type) {
    case "person":
      return `"${t}" ${ctx} investigation connections profile background`;
    case "company":
      return `"${t}" ${ctx} federal contract award USASpending funding`;
    case "government":
      return `"${t}" ${ctx} government agency intelligence operation investigation`;
    case "country":
      return `"${t}" ${ctx} state actor foreign interference geopolitics intelligence`;
    case "event":
      return `"${t}" ${ctx} evidence timeline what really happened`;
    case "theory":
      return `"${t}" ${ctx} conspiracy evidence proof claims`;
    case "foia":
      return `"${t}" ${ctx} declassified document FOIA leaked`;
    case "patent":
      return `"${t}" ${ctx} patent secret technology hidden`;
    case "article":
    default:
      return `"${t}" ${ctx} investigation report`;
  }
}
