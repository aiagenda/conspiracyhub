/** Merge headline with optional body/context for `/api/polymarket` keyword extraction (GET URL limit). */
export function combinePolymarketQuery(primary: string, context?: string, maxLen = 1800): string {
  const p = primary.trim();
  const c = context?.trim();
  if (!c) return p.slice(0, maxLen);
  return `${p} · ${c}`.slice(0, maxLen);
}
