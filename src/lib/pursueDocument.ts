/** Detect PURSUE / war.gov UAP file releases in document payloads. */
export function isPursueDocument(doc: {
  name?: string;
  url?: string;
  description?: string;
  source?: string;
  id?: string;
}): boolean {
  const haystack = `${doc.id ?? ""} ${doc.name ?? ""} ${doc.url ?? ""} ${doc.description ?? ""} ${doc.source ?? ""}`;
  return /PURSUE|DOW-UAP|war\.gov\/UFO|war\.gov\/medialink|pursue\.report|pursueindex\.com/i.test(haystack);
}
