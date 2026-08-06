"use client";

import { useCallback, useEffect, useState } from "react";
import { muted } from "@/components/admin/constants";

const ACCENT = "#00d4ff";

type TechArticle = {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  status: string;
  published_at: string | null;
  word_count: number;
  source_count: number;
  sources_with_links: number;
};

type GenerateResult = {
  id: string;
  title: string;
  slug: string;
  status: string;
  url: string;
  word_count: number;
  words_before_expand: number;
  expanded: boolean;
  expand_passes: number;
  verbatim_overlap_percent: number;
  source_count: number;
  sources_with_links: number;
  research_findings: number;
};

type DraftDetail = {
  id: string;
  title: string;
  slug: string;
  content: string;
  meta_description: string | null;
  focus_keyword: string | null;
  tags: string[] | null;
  sources: Array<{ title: string; url: string; description: string }> | null;
};

const inputCls =
  "w-full rounded border bg-transparent px-3 py-2 text-[12px] outline-none focus:border-[#00d4ff]";
const inputStyle = { borderColor: "#1a2a22", color: "#c8e8d0" } as const;

/** Under ~5% is what independently written prose about the same facts looks like. */
function overlapColor(pct: number): string {
  if (pct < 5) return "#00ff88";
  if (pct < 12) return "#ffaa00";
  return "#ff8888";
}

export function TechDeskSection() {
  const [sourceUrl, setSourceUrl] = useState("");
  const [sourceText, setSourceText] = useState("");
  const [angle, setAngle] = useState("");
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<GenerateResult | null>(null);
  const [error, setError] = useState("");

  const [articles, setArticles] = useState<TechArticle[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [preview, setPreview] = useState<DraftDetail | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/generate-tech");
      const d = (await res.json()) as { articles?: TechArticle[]; error?: string };
      if (!res.ok) throw new Error(d.error ?? res.statusText);
      setArticles(d.articles ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function generate() {
    if (!sourceUrl.trim() && !sourceText.trim()) {
      setError("Add a source URL or paste the article text.");
      return;
    }
    setGenerating(true);
    setError("");
    setResult(null);
    try {
      const res = await fetch("/api/admin/generate-tech", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceUrl: sourceUrl.trim() || undefined,
          sourceText: sourceText.trim() || undefined,
          angle: angle.trim() || undefined,
        }),
      });
      const d = (await res.json()) as { article?: GenerateResult; error?: string; message?: string };
      if (!res.ok || !d.article) throw new Error(d.message ?? d.error ?? res.statusText);
      setResult(d.article);
      setSourceUrl("");
      setSourceText("");
      setAngle("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setGenerating(false);
    }
  }

  async function act(id: string, action: "publish" | "unpublish" | "delete") {
    if (action === "delete" && !confirm("Delete this article permanently?")) return;
    setBusyId(id);
    setError("");
    try {
      const res = await fetch("/api/admin/generate-tech", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, id }),
      });
      const d = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok) throw new Error(d.error ?? res.statusText);
      if (preview?.id === id && action === "delete") setPreview(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyId(null);
    }
  }

  async function openPreview(id: string) {
    if (preview?.id === id) {
      setPreview(null);
      return;
    }
    setPreviewLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/generate-tech?id=${encodeURIComponent(id)}`);
      const d = (await res.json()) as { article?: DraftDetail; error?: string };
      if (!res.ok || !d.article) throw new Error(d.error ?? res.statusText);
      setPreview(d.article);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setPreviewLoading(false);
    }
  }

  const drafts = articles.filter((a) => a.status === "draft");

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-[13px] font-semibold uppercase tracking-wider" style={{ color: ACCENT }}>
          AI &amp; Tech Desk — Source-Grounded Writer
        </h2>
        <p className="mt-1 text-[11px] leading-relaxed" style={{ color: muted }}>
          Paste a source article. The writer extracts its <em>facts</em>, runs its own web research,
          then writes an original {"≥"}2000-word piece with its own structure and inline citations —
          it does not paraphrase the source. Published articles appear at{" "}
          <a href="/ai" target="_blank" rel="noreferrer" style={{ color: ACCENT }}>/ai</a>.
        </p>
      </div>

      {/* ── Composer ── */}
      <div className="rounded-lg border p-4" style={{ borderColor: "#1a2a22", background: "#080c09" }}>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-[10px] uppercase tracking-wider" style={{ color: muted }}>
              Source URL
            </label>
            <input
              className={inputCls}
              style={inputStyle}
              placeholder="https://techcrunch.com/..."
              value={sourceUrl}
              onChange={(e) => setSourceUrl(e.target.value)}
            />
          </div>

          <div>
            <label className="mb-1 block text-[10px] uppercase tracking-wider" style={{ color: muted }}>
              Or paste the article text <span style={{ opacity: 0.6 }}>(use for paywalled pages; wins over the URL fetch)</span>
            </label>
            <textarea
              className={inputCls}
              style={{ ...inputStyle, minHeight: 110, resize: "vertical" }}
              placeholder="Paste the full article text here…"
              value={sourceText}
              onChange={(e) => setSourceText(e.target.value)}
            />
          </div>

          <div>
            <label className="mb-1 block text-[10px] uppercase tracking-wider" style={{ color: muted }}>
              Angle <span style={{ opacity: 0.6 }}>(optional)</span>
            </label>
            <input
              className={inputCls}
              style={inputStyle}
              placeholder="e.g. what this means for small dev teams"
              value={angle}
              onChange={(e) => setAngle(e.target.value)}
            />
          </div>

          <button
            type="button"
            onClick={() => void generate()}
            disabled={generating}
            className="rounded border px-4 py-2 text-[11px] font-semibold uppercase tracking-wider transition-colors disabled:opacity-50"
            style={{
              borderColor: ACCENT,
              background: "rgba(0,212,255,0.1)",
              color: ACCENT,
              cursor: generating ? "wait" : "pointer",
            }}
          >
            {generating ? "Researching + writing… (up to ~3 min)" : "Write draft"}
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded border px-3 py-2 text-[11px]" style={{ borderColor: "#5a2a2a", background: "rgba(255,80,80,0.08)", color: "#ff8888" }}>
          {error}
        </div>
      )}

      {/* ── Generation report ── */}
      {result && (
        <div className="rounded-lg border p-4" style={{ borderColor: "#1a3a2a", background: "rgba(0,212,255,0.04)" }}>
          <div className="text-[12px] font-semibold" style={{ color: ACCENT }}>
            Draft created: {result.title}
          </div>
          <div className="mt-2 grid gap-2 text-[11px] sm:grid-cols-2" style={{ color: muted }}>
            <div>
              Words: <strong style={{ color: "#c8e8d0" }}>{result.word_count}</strong>
              {result.expanded && (
                <span style={{ opacity: 0.7 }}> (expanded from {result.words_before_expand} in {result.expand_passes} pass{result.expand_passes === 1 ? "" : "es"})</span>
              )}
            </div>
            <div>
              Verbatim overlap with source:{" "}
              <strong style={{ color: overlapColor(result.verbatim_overlap_percent) }}>
                {result.verbatim_overlap_percent}%
              </strong>
            </div>
            <div>
              Sources: <strong style={{ color: "#c8e8d0" }}>{result.source_count}</strong>{" "}
              ({result.sources_with_links} with live links)
            </div>
            <div>
              Research findings used: <strong style={{ color: "#c8e8d0" }}>{result.research_findings}</strong>
            </div>
          </div>
          <p className="mt-2 text-[10px] leading-relaxed" style={{ color: muted }}>
            Overlap is the share of 8-word sequences shared with the source. Under 5% is normal for
            independently written prose; above ~12% means review the wording before publishing.
          </p>
        </div>
      )}

      {/* ── Review queue ── */}
      <div className="rounded-lg border p-4" style={{ borderColor: "#1a2a22", background: "#080c09" }}>
        <div className="mb-3 flex items-center justify-between">
          <div className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: muted }}>
            Review queue · {drafts.length} draft{drafts.length === 1 ? "" : "s"} / {articles.length} total
          </div>
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="rounded border px-2 py-1 text-[10px] uppercase tracking-wider disabled:opacity-50"
            style={{ borderColor: "#1a2a22", color: muted }}
          >
            {loading ? "…" : "Refresh"}
          </button>
        </div>

        {articles.length === 0 && !loading && (
          <div className="py-6 text-center text-[11px]" style={{ color: "#3a5040" }}>
            No AI &amp; Tech articles yet.
          </div>
        )}

        <div className="space-y-2">
          {articles.map((a) => {
            const isDraft = a.status === "draft";
            const open = preview?.id === a.id;
            return (
              <div key={a.id} className="rounded border p-3" style={{ borderColor: open ? ACCENT : "#1a2a22" }}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div className="text-[12px]" style={{ color: "#c8e8d0" }}>{a.title}</div>
                    <div className="mt-1 flex flex-wrap gap-2 text-[10px]" style={{ color: muted }}>
                      <span
                        className="rounded px-1.5 py-0.5"
                        style={{
                          background: isDraft ? "rgba(255,170,0,0.15)" : "rgba(0,255,136,0.12)",
                          color: isDraft ? "#ffaa00" : "#00ff88",
                        }}
                      >
                        {a.status}
                      </span>
                      <span>{a.word_count} words</span>
                      <span>{a.sources_with_links}/{a.source_count} linked sources</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() => void openPreview(a.id)}
                      disabled={previewLoading}
                      className="rounded border px-2 py-1 text-[10px] uppercase tracking-wider disabled:opacity-50"
                      style={{ borderColor: "#1a2a22", color: muted }}
                    >
                      {open ? "Close" : "Review"}
                    </button>
                    {isDraft ? (
                      <button
                        type="button"
                        onClick={() => void act(a.id, "publish")}
                        disabled={busyId === a.id}
                        className="rounded border px-2 py-1 text-[10px] font-semibold uppercase tracking-wider disabled:opacity-50"
                        style={{ borderColor: "#00ff88", background: "rgba(0,255,136,0.1)", color: "#00ff88" }}
                      >
                        {busyId === a.id ? "…" : "Publish"}
                      </button>
                    ) : (
                      <>
                        <a
                          href={`/blog/${a.slug}`}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded border px-2 py-1 text-[10px] uppercase tracking-wider"
                          style={{ borderColor: "#1a2a22", color: ACCENT }}
                        >
                          View
                        </a>
                        <button
                          type="button"
                          onClick={() => void act(a.id, "unpublish")}
                          disabled={busyId === a.id}
                          className="rounded border px-2 py-1 text-[10px] uppercase tracking-wider disabled:opacity-50"
                          style={{ borderColor: "#1a2a22", color: "#ffaa00" }}
                        >
                          {busyId === a.id ? "…" : "Unpublish"}
                        </button>
                      </>
                    )}
                    <button
                      type="button"
                      onClick={() => void act(a.id, "delete")}
                      disabled={busyId === a.id}
                      className="rounded border px-2 py-1 text-[10px] uppercase tracking-wider disabled:opacity-50"
                      style={{ borderColor: "#5a2a2a", color: "#ff8888" }}
                    >
                      Del
                    </button>
                  </div>
                </div>

                {open && preview && (
                  <div className="mt-3 border-t pt-3" style={{ borderColor: "#1a2a22" }}>
                    <div className="mb-2 text-[10px]" style={{ color: muted }}>
                      <div>Focus keyword: <span style={{ color: "#c8e8d0" }}>{preview.focus_keyword || "—"}</span></div>
                      <div>Meta: <span style={{ color: "#c8e8d0" }}>{preview.meta_description || "—"}</span></div>
                      <div>Tags: <span style={{ color: "#c8e8d0" }}>{(preview.tags ?? []).join(", ") || "—"}</span></div>
                    </div>
                    <div
                      className="overflow-auto rounded border p-3 text-[11px] leading-relaxed"
                      style={{ borderColor: "#1a2a22", background: "#050807", color: "#c8e8d0", maxHeight: 420, whiteSpace: "pre-wrap" }}
                    >
                      {preview.content}
                    </div>
                    {(preview.sources ?? []).length > 0 && (
                      <div className="mt-2">
                        <div className="mb-1 text-[10px] uppercase tracking-wider" style={{ color: muted }}>
                          Sources ({(preview.sources ?? []).length})
                        </div>
                        <ul className="space-y-1 text-[10px]">
                          {(preview.sources ?? []).map((s, i) => (
                            <li key={i} style={{ color: muted }}>
                              {s.url ? (
                                <a href={s.url} target="_blank" rel="noreferrer" style={{ color: ACCENT }}>
                                  {s.title}
                                </a>
                              ) : (
                                <span style={{ color: "#ffaa00" }}>{s.title} (no link)</span>
                              )}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
