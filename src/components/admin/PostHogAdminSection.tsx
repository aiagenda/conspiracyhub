"use client";

import type { PostHogAdminStats } from "@/lib/posthogAdminStats";
import { muted } from "@/components/admin/constants";

function referrerLabel(value: string): string {
  if (value === "$direct" || value === "(direct)" || value === "(none)") return "Direct";
  return value.replace(/^www\./, "");
}

function ShareRows({
  rows,
  accent = "#00bb66",
}: {
  rows: { key: string; label: string; count: number }[];
  accent?: string;
}) {
  const max = Math.max(...rows.map((row) => row.count), 1);
  if (!rows.length) {
    return <p className="py-6 text-[13px]" style={{ color: muted }}>Nothing in this window.</p>;
  }
  return (
    <ul className="space-y-3.5">
      {rows.map((row) => (
        <li key={row.key}>
          <div className="mb-1.5 flex items-baseline justify-between gap-3 text-[13px]">
            <span className="min-w-0 truncate" style={{ color: "var(--foreground)" }}>{row.label}</span>
            <span className="shrink-0 tabular-nums" style={{ color: muted }}>{row.count}</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full" style={{ background: "#121a14" }}>
            <div
              className="h-full rounded-full"
              style={{ width: `${Math.max(6, (row.count / max) * 100)}%`, background: accent }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

function Metric({
  label,
  value,
  detail,
}: {
  label: string;
  value: number;
  detail: string;
}) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] uppercase tracking-[0.16em]" style={{ color: muted }}>{label}</p>
      <p className="font-raj mt-1 text-4xl font-bold tabular-nums tracking-tight" style={{ color: "var(--foreground)" }}>
        {value}
      </p>
      <p className="mt-1 text-[12px]" style={{ color: muted }}>{detail}</p>
    </div>
  );
}

export function PostHogAdminSection({ data }: { data: PostHogAdminStats | null }) {
  if (!data) {
    return <p className="text-[13px]" style={{ color: muted }}>Loading audience…</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.18em]" style={{ color: "#7dffb3" }}>Readers</p>
          <h2 className="font-raj mt-1 text-2xl font-bold tracking-tight" style={{ color: "var(--foreground)" }}>
            Who showed up
          </h2>
          <p className="mt-1 max-w-xl text-[13px] leading-relaxed" style={{ color: muted }}>
            PostHog, last 24 hours. Your own admin browser is left out.
          </p>
        </div>
        <a
          href={data.dashboardUrl}
          target="_blank"
          rel="noreferrer"
          className="rounded-full border px-4 py-2 text-[11px] font-semibold uppercase tracking-wider no-underline"
          style={{ borderColor: "#1e3a2a", color: "#c8e8d0" }}
        >
          Open PostHog
        </a>
      </div>

      {!data.configured ? (
        <p className="text-[13px]" style={{ color: muted }}>{data.setupHint ?? "PostHog read API is not configured."}</p>
      ) : null}
      {data.error ? (
        <p className="text-[13px]" style={{ color: "#ff8888" }}>{data.error}</p>
      ) : null}

      {data.configured ? (
        <>
          <div className="grid grid-cols-2 gap-6 rounded-2xl border p-6 sm:grid-cols-4" style={{ borderColor: "#1a2a22", background: "linear-gradient(180deg, #0c1410 0%, #080c09 100%)" }}>
            <Metric label="Pageviews" value={data.pageViews24h} detail={`${data.pageViews7d} in 7 days`} />
            <Metric label="People" value={data.unique24h} detail={`${data.unique7d} in 7 days`} />
            <Metric label="Pages seen" value={data.topPages.length} detail="distinct paths, 7 days" />
            <Metric label="Actions" value={data.topEvents.reduce((sum, event) => sum + event.count, 0)} detail="signups, votes, checks" />
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <section className="rounded-2xl border p-5 lg:col-span-1" style={{ borderColor: "#1a2a22", background: "#080c09" }}>
              <h3 className="mb-4 text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: muted }}>Where they came from</h3>
              <ShareRows
                accent="#7dffb3"
                rows={data.topReferrers.map((row) => ({ key: row.referrer, label: referrerLabel(row.referrer), count: row.count }))}
              />
            </section>
            <section className="rounded-2xl border p-5 lg:col-span-1" style={{ borderColor: "#1a2a22", background: "#080c09" }}>
              <h3 className="mb-4 text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: muted }}>What they opened</h3>
              <ShareRows
                rows={data.topPages.map((row) => ({ key: row.path, label: row.path, count: row.count }))}
              />
            </section>
            <section className="rounded-2xl border p-5 lg:col-span-1" style={{ borderColor: "#1a2a22", background: "#080c09" }}>
              <h3 className="mb-4 text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: muted }}>What they did</h3>
              <ShareRows
                accent="#d7c4ff"
                rows={data.topEvents.map((row) => ({ key: row.event, label: row.event.replaceAll("_", " "), count: row.count }))}
              />
            </section>
          </div>
        </>
      ) : null}
    </div>
  );
}
