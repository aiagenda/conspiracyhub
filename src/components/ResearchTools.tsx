"use client";
import { useState } from "react";
import Link from "next/link";
import ReferenceDocumentIndex from "@/components/ReferenceDocumentIndex";
import { fetchWithSupabaseAuth } from "@/lib/authFetch";

type UrlAnalysis = { id: string | null; title: string; conclusion: string };
export default function ResearchTools() {
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<UrlAnalysis | null>(null);
  async function analyze(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError(""); setResult(null);
    try {
      const response = await fetchWithSupabaseAuth("/api/analyze-url", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(response.status === 401 ? "Sign in to investigate a source URL." : "This source could not be analyzed. Please try another public article.");
      setResult(payload);
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to analyze this source."); }
    finally { setBusy(false); }
  }
  return <section id="research" className="journal-tools" aria-label="Research tools"><h2>Go back to the source.</h2><p>Explore public records or open an investigation around a specific article.</p>
    <details><summary>Investigate an article URL</summary><p className="journal-muted">Requires a free account. AI analysis provides leads to examine; check its claims against the original material.</p><form onSubmit={analyze} className="journal-url-form"><label>Public article URL<input type="url" required value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://…" maxLength={2000} /></label><button className="journal-button" disabled={busy}>{busy ? "Analyzing…" : "Investigate →"}</button></form>{error && <p role="alert">{error}</p>}{result && <div aria-live="polite"><h3>{result.title}</h3><p>{result.conclusion}</p>{result.id && <Link href={`/board/url/${result.id}`}>Open investigation board →</Link>}</div>}</details>
    <details><summary>Browse the public document index</summary><ReferenceDocumentIndex /></details>
  </section>;
}
