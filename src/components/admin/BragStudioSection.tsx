"use client";

import { useCallback, useEffect, useState } from "react";
import { muted } from "@/components/admin/constants";

type BragJob = {
  id: string;
  status: string;
  tone: string;
  format: string;
  title: string | null;
  creative_direction: string | null;
  share_copy: string | null;
  video_path: string | null;
  duration_sec: number | null;
  error_text: string | null;
  created_at: string;
  finished_at: string | null;
};

const TONES = ["default", "polished", "yc-parody", "chaotic", "deadpan", "cinematic", "app-store"] as const;

const TOOL_RADAR: Array<{ name: string; url: string; why: string }> = [
  { name: "/brag + Hyperframes", url: "https://github.com/latent-spaces/brag", why: "Launch videók — ezt integráljuk ide." },
  { name: "Firecrawl", url: "https://www.firecrawl.dev/", why: "Scrape + LLM-ready markdown — kiegészítheti a Brave searchöt." },
  { name: "Sherlock", url: "https://github.com/sherlock-project/sherlock", why: "OSINT: username keresés 400+ platformon." },
  { name: "SomaliScan Epstein Index", url: "https://www.somaliscan.com/investigation/epstein-index", why: "Kutatási index — story seed / reference." },
  { name: "browser-use", url: "https://github.com/browser-use/browser-use", why: "AI browser agent — automatizált OSINT flow." },
  { name: "Coolify", url: "https://github.com/coollabsio/coolify", why: "Self-host deploy — ha kikerülünk Vercel Hobby limitből." },
  { name: "Dify", url: "https://github.com/langgenius/dify", why: "Visual AI workflow — Oracle pipeline prototípus." },
  { name: "AdKit", url: "https://adkit.so/", why: "Meta/Google hirdetés kreatívok — growth layer." },
  { name: "Cursor Automations", url: "https://cursor.com/docs/cloud-agent/automations", why: "Cron agentek — scraper/briefing backup." },
  { name: "MoneyPrinterTurbo", url: "https://github.com/harry0703/MoneyPrinterTurbo", why: "Alternatív short video pipeline (TikTok/Reels)." },
];

function statusColor(status: string): string {
  if (status === "ready") return "#00ff88";
  if (status === "failed") return "#ff8888";
  if (status === "rendering" || status === "planning") return "#ffaa00";
  return muted;
}

export function BragStudioSection() {
  const [jobs, setJobs] = useState<BragJob[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [tone, setTone] = useState<(typeof TONES)[number]>("cinematic");
  const [format, setFormat] = useState<"landscape" | "vertical" | "square">("landscape");
  const [title, setTitle] = useState("");
  const [creativeDirection, setCreativeDirection] = useState("");
  const [copied, setCopied] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/brag");
      const d = (await res.json()) as { jobs?: BragJob[]; error?: string };
      if (!res.ok) throw new Error(d.error ?? res.statusText);
      setJobs(d.jobs ?? []);
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
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/admin/brag", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tone, format, title: title.trim() || undefined, creativeDirection: creativeDirection.trim() || undefined }),
      });
      const d = (await res.json()) as { error?: string; job?: BragJob };
      if (!res.ok) throw new Error(d.error ?? res.statusText);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function rerender(jobId: string) {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/admin/brag", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "rerender", jobId }),
      });
      const d = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(d.error ?? res.statusText);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  function copy(text: string, key: string) {
    void navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg border p-5" style={{ borderColor: "#1a2a22", background: "#080c09" }}>
        <h3 className="font-raj text-[13px] font-bold uppercase tracking-[0.14em]" style={{ color: "#00ff88" }}>
          ◈ Brag Studio
        </h3>
        <p className="mt-2 text-[12px] leading-relaxed" style={{ color: muted }}>
          15–22 mp launch videó Hyperframes-szel — terminal green aesthetic, Oracle/Feed feature-ök, share copy.
          Lokálisan FFmpeg + <code className="text-[#3a5040]">~/.claude/skills/brag/assets</code> music kell a teljes renderhez.
          Vercelen csak plan + composition készül; render: <code className="text-[#3a5040]">npm run brag:render -- &lt;job-id&gt;</code>
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="block text-[10px] uppercase tracking-widest" style={{ color: muted }}>
            Tone
            <select
              value={tone}
              onChange={(e) => setTone(e.target.value as (typeof TONES)[number])}
              className="mt-1 w-full rounded border px-2 py-2 text-[12px]"
              style={{ borderColor: "#1a3320", background: "#050c07", color: "#c8e8d0" }}
            >
              {TONES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </label>
          <label className="block text-[10px] uppercase tracking-widest" style={{ color: muted }}>
            Format
            <select
              value={format}
              onChange={(e) => setFormat(e.target.value as typeof format)}
              className="mt-1 w-full rounded border px-2 py-2 text-[12px]"
              style={{ borderColor: "#1a3320", background: "#050c07", color: "#c8e8d0" }}
            >
              <option value="landscape">Landscape 16:9</option>
              <option value="vertical">Vertical 9:16</option>
              <option value="square">Square 1:1</option>
            </select>
          </label>
          <label className="block text-[10px] uppercase tracking-widest sm:col-span-2" style={{ color: muted }}>
            Title override (optional)
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="The Theorist — Oracle Intelligence"
              className="mt-1 w-full rounded border px-2 py-2 text-[12px]"
              style={{ borderColor: "#1a3320", background: "#050c07", color: "#c8e8d0" }}
            />
          </label>
        </div>
        <label className="mt-3 block text-[10px] uppercase tracking-widest" style={{ color: muted }}>
          Creative direction (optional)
          <textarea
            value={creativeDirection}
            onChange={(e) => setCreativeDirection(e.target.value)}
            rows={2}
            placeholder='e.g. "declassified briefing reel" or "fake Pentagon press leak"'
            className="mt-1 w-full rounded border px-2 py-2 text-[12px]"
            style={{ borderColor: "#1a3320", background: "#050c07", color: "#c8e8d0" }}
          />
        </label>
        <button
          type="button"
          disabled={busy}
          onClick={() => void generate()}
          className="mt-4 rounded-md border px-5 py-3 text-[11px] font-semibold uppercase tracking-wider disabled:opacity-50"
          style={{ borderColor: "#00bb66", color: "#00ff88", background: "rgba(0,255,136,0.08)" }}
        >
          {busy ? "Generating… (1–5 min)" : "Generate launch video"}
        </button>
        {error ? <p className="mt-3 text-[12px]" style={{ color: "#ff8888" }}>{error}</p> : null}
      </div>

      <div className="rounded-lg border overflow-hidden" style={{ borderColor: "#1a2a22", background: "#080c09" }}>
        <div className="border-b px-4 py-3 text-[11px] uppercase tracking-widest" style={{ borderColor: "#1a2a22", color: muted }}>
          Recent jobs {loading ? "…" : `(${jobs.length})`}
        </div>
        {jobs.length === 0 && !loading ? (
          <p className="px-4 py-8 text-center text-[13px]" style={{ color: muted }}>No brag jobs yet.</p>
        ) : (
          <div className="divide-y" style={{ borderColor: "#111816" }}>
            {jobs.map((j) => (
              <div key={j.id} className="px-4 py-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-raj text-[12px] font-bold" style={{ color: statusColor(j.status) }}>{j.status}</span>
                  <span className="text-[10px] uppercase" style={{ color: muted }}>{j.tone} · {j.format}</span>
                  <span className="text-[10px]" style={{ color: muted }}>{new Date(j.created_at).toLocaleString("en-GB")}</span>
                </div>
                {j.share_copy ? (
                  <p className="mt-2 text-[12px] leading-relaxed" style={{ color: "#c8e8d0" }}>{j.share_copy}</p>
                ) : null}
                <div className="mt-2 flex flex-wrap gap-2">
                  {j.share_copy ? (
                    <button type="button" onClick={() => copy(j.share_copy!, j.id)} className="rounded border px-3 py-1.5 text-[10px] uppercase" style={{ borderColor: "#1a3320", color: muted }}>
                      {copied === j.id ? "Copied" : "Copy share text"}
                    </button>
                  ) : null}
                  {j.video_path ? (
                    <a href={j.video_path} target="_blank" rel="noreferrer" className="rounded border px-3 py-1.5 text-[10px] uppercase no-underline" style={{ borderColor: "#00bb66", color: "#00ff88" }}>
                      Download MP4 ↗
                    </a>
                  ) : null}
                  {(j.status === "plan_ready" || j.status === "failed") && (
                    <button type="button" disabled={busy} onClick={() => void rerender(j.id)} className="rounded border px-3 py-1.5 text-[10px] uppercase disabled:opacity-40" style={{ borderColor: "#3a4020", color: "#ccaa44" }}>
                      Re-render locally
                    </button>
                  )}
                </div>
                {j.error_text && j.status !== "ready" ? (
                  <p className="mt-2 text-[11px]" style={{ color: "#aa8866" }}>{j.error_text}</p>
                ) : null}
                <p className="mt-1 text-[10px] font-mono" style={{ color: "#3a5040" }}>{j.id}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      <details className="rounded-lg border" style={{ borderColor: "#1a2a22", background: "#080c09" }}>
        <summary className="cursor-pointer px-4 py-3 text-[11px] uppercase tracking-widest" style={{ color: muted }}>
          Tool radar — hasznos linkek a listádról
        </summary>
        <ul className="divide-y px-4 pb-2" style={{ borderColor: "#111816" }}>
          {TOOL_RADAR.map((t) => (
            <li key={t.url} className="py-3">
              <a href={t.url} target="_blank" rel="noreferrer" className="text-[12px] no-underline" style={{ color: "#00bb66" }}>{t.name} ↗</a>
              <p className="mt-1 text-[11px]" style={{ color: muted }}>{t.why}</p>
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}
