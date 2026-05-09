/** Canonical verdict values stored and shown in English only. */
export type VerdictEnglish = "TRUE" | "PARTIALLY_TRUE" | "QUESTIONABLE" | "DISINFORMATION";

export function normalizeVerdict(input: unknown): VerdictEnglish {
  const raw = String(input ?? "").trim();
  if (!raw) return "QUESTIONABLE";
  const upper = raw.toUpperCase().replace(/\s+/g, "_");
  if (upper === "TRUE" || upper === "PARTIALLY_TRUE" || upper === "QUESTIONABLE" || upper === "DISINFORMATION") {
    return upper as VerdictEnglish;
  }
  return "QUESTIONABLE";
}
