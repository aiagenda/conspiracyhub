/** Detect PURSUE / war.gov UAP file releases in document payloads. */
export function isPursueDocument(doc: {
  name?: string;
  url?: string;
  description?: string;
  source?: string;
}): boolean {
  const haystack = `${doc.name ?? ""} ${doc.url ?? ""} ${doc.description ?? ""} ${doc.source ?? ""}`;
  return /PURSUE|war\.gov\/UFO|war\.gov/i.test(haystack);
}
