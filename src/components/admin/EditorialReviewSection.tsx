"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchWithSupabaseAuth } from "@/lib/authFetch";

type Article = {
  id: string; title: string; slug: string; content: string; excerpt?: string; meta_description?: string;
  status: string; updated_at?: string; sources: Array<{title: string; url: string; description: string}>;
  editorial_checks?: { passed?: boolean; issues?: string[]; method?: string };
  quality_issues?: string[];
};
const checks = { sources_opened: "I opened the original sources", claims_checked: "I checked the material claims and quotations", dates_checked: "I checked event dates and publication dates", uncertainty_labelled: "Analysis and uncertainty are clearly labelled" };

export default function EditorialReviewSection() {
  const [rows, setRows] = useState<Article[]>([]);
  const [article, setArticle] = useState<Article | null>(null);
  const [filter, setFilter] = useState("draft");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [confirmed, setConfirmed] = useState<Record<string, boolean>>({});
  const [sourceText, setSourceText] = useState("");
  const [dirty, setDirty] = useState(false);
  const load = useCallback(async () => {
    const response = await fetchWithSupabaseAuth(`/api/admin/generated-articles?status=${filter}&page=${page}`);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Could not load articles");
    setRows(data.posts ?? []); setTotal(data.total ?? 0);
  }, [filter, page]);
  useEffect(() => { let active = true; queueMicrotask(() => { if (active) load().catch(e => setError(String(e))); }); return () => { active = false; }; }, [load]);
  function select(next: Article) {
    setArticle(next); setSourceText(JSON.stringify(next.sources ?? [], null, 2));
    setDirty(false); setConfirmed({}); setNote(""); setError("");
  }
  async function act(action: string) {
    if (!article) return;
    setBusy(true); setError("");
    try {
      const body = { action, id: article.id, updated_at: article.updated_at,
        ...(action === "save" ? { title: article.title, content: article.content, excerpt: article.excerpt, meta_description: article.meta_description, sources: JSON.parse(sourceText) } : {}),
        ...(action === "review" ? { checks: confirmed, review_note: note } : {}) };
      const response = await fetchWithSupabaseAuth("/api/admin/generated-articles", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const result = await response.json();
      if (!response.ok) throw new Error([result.error, ...(result.issues ?? [])].join(" · "));
      const refreshed = await fetchWithSupabaseAuth(`/api/admin/generated-articles?id=${article.id}`);
      const data = await refreshed.json();
      if (!refreshed.ok) throw new Error(data.error || "Reload failed");
      select({ ...data.article, quality_issues: data.quality_issues });
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  }
  const inputClass = "w-full rounded border border-emerald-900 bg-black/30 p-3 text-sm text-stone-200";
  const buttonClass = "rounded border border-emerald-800 px-4 py-2 text-sm disabled:opacity-40";
  const issues = [...new Set([...(article?.editorial_checks?.issues ?? []), ...(article?.quality_issues ?? [])])];
  return <section className="space-y-5 text-stone-200">
    <div><h2 className="text-2xl">Editorial review</h2><p className="mt-2 text-sm text-stone-400">Open sources, edit the draft, then review this version before publishing. Automated checks support editorial judgement.</p></div>
    <label className="block">Show <select className="ml-3 rounded bg-stone-900 p-2" value={filter} onChange={e => {setFilter(e.target.value);setPage(1);}}><option value="draft">Drafts awaiting review</option><option value="published">Published articles</option><option value="all">All articles</option></select></label>
    {error && <p role="alert" className="rounded border border-amber-800 p-3 text-amber-200">{error}</p>}
    <div className="grid gap-6 lg:grid-cols-[minmax(220px,1fr)_minmax(0,3fr)]">
      <div className="space-y-3">{rows.map(row => <button key={row.id} type="button" className={`block w-full rounded border p-3 text-left ${article?.id === row.id ? 'border-emerald-400' : 'border-stone-800'}`} onClick={() => {if (!dirty || window.confirm("Discard unsaved changes?")) select(row);}}><span className="block text-xs uppercase text-stone-400">{row.status} · {row.editorial_checks?.passed ? "checks passed" : "review needed"}</span>{row.title}</button>)}{!rows.length && <p>No articles in this queue.</p>}
        <div className="flex gap-3"><button className={buttonClass} disabled={page === 1} onClick={() => setPage(p => p - 1)}>Previous</button><button className={buttonClass} disabled={page * 10 >= total} onClick={() => setPage(p => p + 1)}>Next</button></div><p className="text-sm text-stone-400">Page {page} · {total} articles</p>
      </div>
      {article && <div className="min-w-0 space-y-4">
        <label className="block">Title<input className={inputClass} value={article.title} onChange={e => {setArticle({...article,title:e.target.value});setDirty(true);}} /></label>
        <label className="block">Excerpt<textarea className={inputClass} rows={3} value={article.excerpt ?? ""} onChange={e => {setArticle({...article,excerpt:e.target.value});setDirty(true);}} /></label>
        <label className="block">Article (Markdown)<textarea className={inputClass} rows={22} value={article.content} onChange={e => {setArticle({...article,content:e.target.value});setDirty(true);}} /></label>
        <label className="block">Sources (JSON: title, url, description)<textarea className={inputClass} rows={7} value={sourceText} onChange={e => {setSourceText(e.target.value);setDirty(true);}} /></label>
        <ul className="space-y-2">{(article.sources ?? []).map((s,i) => /^https?:\/\//.test(s.url) && <li key={i}><a className="text-emerald-300 underline" href={s.url} target="_blank" rel="noopener noreferrer">{s.title || s.url} ↗</a></li>)}</ul>
        <button className={buttonClass} disabled={busy || !dirty} onClick={() => void act("save")}>Save as draft</button>
        {dirty && <p className="text-amber-200">Save your changes before reviewing. Saving removes any previous approval and unpublishes this version.</p>}
        {issues.length > 0 && <ul className="list-inside list-disc text-sm text-amber-200">{issues.map(issue => <li key={issue}>{issue}</li>)}</ul>}
        <fieldset disabled={busy || dirty} className="space-y-3 rounded border border-stone-800 p-4"><legend>Review this version</legend>{Object.entries(checks).map(([key,label]) => <label key={key} className="flex gap-3"><input type="checkbox" checked={!!confirmed[key]} onChange={e => setConfirmed({...confirmed,[key]:e.target.checked})} />{label}</label>)}<label className="block">Review note<textarea className={inputClass} value={note} onChange={e => setNote(e.target.value)} placeholder="Evidence checked, limitations, and corrections (at least 20 characters)" /></label><button className={buttonClass} disabled={note.trim().length < 20 || !Object.keys(checks).every(k => confirmed[k])} onClick={() => void act("review")}>Record human review</button></fieldset>
        <div className="flex gap-3"><button className={buttonClass} disabled={busy || dirty || !article.editorial_checks?.passed || article.status === "published"} onClick={() => void act("publish")}>Publish reviewed article</button>{article.status === "published" && <><a className={buttonClass} href={`/blog/${article.slug}`} target="_blank" rel="noreferrer">Open article ↗</a><button className={buttonClass} disabled={busy || dirty} onClick={() => void act("unpublish")}>Return to draft</button></>}</div>
      </div>}
    </div>
  </section>;
}
