"use client";
import { useEffect, useState } from "react";
import { publicationDate } from "@/lib/editorialPresentation";

const SOURCES = [
  ["ingest", "FEED"], ["guardian_api", "GUARDIAN"], ["gnews", "GNEWS"],
  ["reddit", "REDDIT"], ["rss", "RSS"], ["scraper", "INGEST WORKER"], ["uap", "UAP"],
] as const;
type HealthKey = typeof SOURCES[number][0];
type Health = Partial<Record<HealthKey, string>> & { last_at?: Partial<Record<HealthKey, string | null>> };

/** Content freshness and worker state are distinct; no decorative live/online claims. */
export default function IntelligenceStatus() {
  const [health, setHealth] = useState<Health | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/health", { signal: controller.signal }).then(async response => {
      if (response.ok) setHealth(await response.json());
      else setHealth({});
    }).catch(() => { if (!controller.signal.aborted) setHealth({}); });
    return () => controller.abort();
  }, []);
  return <div className="intelligence-status" aria-label="Source freshness and ingestion status">
    <div className="intelligence-status-inner"><span className="intelligence-status-label">SOURCE MONITOR</span>
      {SOURCES.map(([key, label]) => {
        const status = health?.[key] ?? "unknown";
        const tone = ["online", "fresh"].includes(status) ? "good" : ["stale", "idle", "degraded", "stalled"].includes(status) ? "warning" : status === "error" ? "error" : "unknown";
        const date = health?.last_at?.[key];
        return <span key={key} className="intelligence-status-item" data-state={tone} title={`${key === "scraper" ? "Ingestion worker" : "Source freshness"}: ${status}${date ? ` · ${publicationDate(date)}` : ""}`}><i aria-hidden="true" /><span>{label}</span><small>{health ? status : "…"}</small></span>;
      })}
    </div>
  </div>;
}
