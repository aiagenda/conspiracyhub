"use client";

import type { PostHogAdminStats } from "@/lib/posthogAdminStats";
import { cardBg, muted } from "@/components/admin/constants";

function TableShell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col rounded-lg" style={{ background: cardBg, border: "1px solid #1a2a22" }}>
      <div className="border-b px-4 py-3" style={{ borderColor: "#1a2a22" }}>
        <span className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: muted }}>
          {title}
        </span>
      </div>
      <div className="min-h-0 flex-1 overflow-auto">{children}</div>
    </div>
  );
}

export function PostHogAdminSection({ data }: { data: PostHogAdminStats | null }) {
  if (!data) {
    return (
      <p className="text-[13px]" style={{ color: muted }}>
        Loading PostHog metrics…
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[12px] leading-relaxed" style={{ color: muted }}>
          Live data from PostHog EU. Custom events (signup, checkout, votes) appear in Top events.
        </p>
        <a
          href={data.dashboardUrl}
          target="_blank"
          rel="noreferrer"
          className="rounded-md border px-3 py-2 text-[10px] font-semibold uppercase tracking-wider no-underline"
          style={{ borderColor: "#c94dff", color: "#c94dff", background: "rgba(201,77,255,0.08)" }}
        >
          Open PostHog ↗
        </a>
      </div>

      {!data.configured ? (
        <div className="rounded-lg border px-4 py-3 text-[13px] leading-relaxed" style={{ borderColor: "#3a2a4a", background: "rgba(201,77,255,0.06)", color: "#d4a8ff" }}>
          <strong style={{ color: "#e8ccff" }}>PostHog admin read API not configured.</strong>
          <p className="mt-2" style={{ color: muted }}>
            Site tracking works with <code className="text-[var(--green-dim)]">NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN</code>.
            For admin stats, add to Vercel:
          </p>
          <ul className="mt-2 list-inside list-disc space-y-1 font-mono text-[11px]" style={{ color: "var(--foreground)" }}>
            <li>POSTHOG_PROJECT_ID=187712</li>
            <li>POSTHOG_PERSONAL_API_KEY=phx_… (PostHog → Settings → Personal API Keys)</li>
          </ul>
          {data.setupHint ? <p className="mt-2 text-[11px]" style={{ color: muted }}>{data.setupHint}</p> : null}
        </div>
      ) : null}

      {data.error ? (
        <div className="rounded-lg border px-4 py-3 text-[12px]" style={{ borderColor: "#4a1a1a", background: "rgba(255,51,51,0.08)", color: "#ff8888" }}>
          PostHog API: {data.error}
        </div>
      ) : null}

      {data.configured ? (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: "Pageviews (24h)", value: data.pageViews24h, sub: `7d: ${data.pageViews7d}`, color: "var(--green)" },
              { label: "Unique visitors (24h)", value: data.unique24h, sub: `7d: ${data.unique7d}`, color: "#00ff88" },
              { label: "Top pages (7d)", value: data.topPages.length, sub: "distinct paths", color: "var(--foreground)" },
              { label: "Custom events (7d)", value: data.topEvents.length, sub: "tracked actions", color: "#c94dff" },
            ].map((tile) => (
              <div key={tile.label} className="rounded-lg p-4" style={{ background: cardBg, border: "1px solid #1a2a22" }}>
                <div className="mb-1 text-[10px] uppercase tracking-widest" style={{ color: muted }}>{tile.label}</div>
                <div className="font-raj text-3xl font-bold tabular-nums" style={{ color: tile.color }}>{tile.value}</div>
                <div className="mt-1 text-[11px]" style={{ color: muted }}>{tile.sub}</div>
              </div>
            ))}
          </div>

          <div className="grid w-full grid-cols-1 gap-4 xl:grid-cols-3">
            <TableShell title="PostHog — top pages (7d)">
              <table className="w-full border-collapse text-left text-[13px]">
                <thead>
                  <tr className="sticky top-0 z-[1]" style={{ background: "#0a100c" }}>
                    <th className="border-b px-4 py-2 font-semibold uppercase tracking-wide" style={{ borderColor: "#1a2a22", color: muted }}>Path</th>
                    <th className="border-b px-4 py-2 text-right font-semibold uppercase tracking-wide" style={{ borderColor: "#1a2a22", color: muted }}>Views</th>
                  </tr>
                </thead>
                <tbody>
                  {data.topPages.map((p) => (
                    <tr key={p.path} className="hover:bg-[#0f1510]">
                      <td className="max-w-[1px] truncate border-b px-4 py-3 font-mono text-[12px]" style={{ borderColor: "#111816", color: "var(--foreground)" }}>{p.path}</td>
                      <td className="border-b px-4 py-3 text-right tabular-nums" style={{ borderColor: "#111816", color: "var(--green)" }}>{p.count}</td>
                    </tr>
                  ))}
                  {data.topPages.length === 0 ? (
                    <tr><td colSpan={2} className="px-4 py-8 text-center text-[13px]" style={{ color: muted }}>No pageviews yet — visit the live site after deploy</td></tr>
                  ) : null}
                </tbody>
              </table>
            </TableShell>

            <TableShell title="PostHog — referrers (7d)">
              <table className="w-full border-collapse text-left text-[13px]">
                <thead>
                  <tr className="sticky top-0 z-[1]" style={{ background: "#0a100c" }}>
                    <th className="border-b px-4 py-2 font-semibold uppercase tracking-wide" style={{ borderColor: "#1a2a22", color: muted }}>Source</th>
                    <th className="border-b px-4 py-2 text-right font-semibold uppercase tracking-wide" style={{ borderColor: "#1a2a22", color: muted }}>Views</th>
                  </tr>
                </thead>
                <tbody>
                  {data.topReferrers.map((r) => (
                    <tr key={r.referrer} className="hover:bg-[#0f1510]">
                      <td className="border-b px-4 py-3" style={{ borderColor: "#111816", color: "var(--foreground)" }}>{r.referrer}</td>
                      <td className="border-b px-4 py-3 text-right tabular-nums" style={{ borderColor: "#111816", color: "var(--green)" }}>{r.count}</td>
                    </tr>
                  ))}
                  {data.topReferrers.length === 0 ? (
                    <tr><td colSpan={2} className="px-4 py-8 text-center text-[13px]" style={{ color: muted }}>No referrer data yet</td></tr>
                  ) : null}
                </tbody>
              </table>
            </TableShell>

            <TableShell title="PostHog — custom events (7d)">
              <table className="w-full border-collapse text-left text-[13px]">
                <thead>
                  <tr className="sticky top-0 z-[1]" style={{ background: "#0a100c" }}>
                    <th className="border-b px-4 py-2 font-semibold uppercase tracking-wide" style={{ borderColor: "#1a2a22", color: muted }}>Event</th>
                    <th className="border-b px-4 py-2 text-right font-semibold uppercase tracking-wide" style={{ borderColor: "#1a2a22", color: muted }}>Count</th>
                  </tr>
                </thead>
                <tbody>
                  {data.topEvents.map((e) => (
                    <tr key={e.event} className="hover:bg-[#0f1510]">
                      <td className="border-b px-4 py-3 font-mono text-[11px]" style={{ borderColor: "#111816", color: "#c94dff" }}>{e.event}</td>
                      <td className="border-b px-4 py-3 text-right tabular-nums" style={{ borderColor: "#111816", color: "var(--foreground)" }}>{e.count}</td>
                    </tr>
                  ))}
                  {data.topEvents.length === 0 ? (
                    <tr><td colSpan={2} className="px-4 py-8 text-center text-[13px]" style={{ color: muted }}>No custom events yet</td></tr>
                  ) : null}
                </tbody>
              </table>
            </TableShell>
          </div>
        </>
      ) : null}
    </div>
  );
}
