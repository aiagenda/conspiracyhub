"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchWithSupabaseAuth } from "@/lib/authFetch";
import { muted } from "@/components/admin/constants";

type Row = {
  email: string;
  source: string | null;
  created_at: string;
  confirmed_at: string | null;
  unsubscribed_at: string | null;
};

type Payload = {
  counts: { confirmed: number; pending: number; left: number; total: number };
  rows: Row[];
  job: { enabled: boolean; schedule_cron: string; next_run_at: string | null } | null;
  preview: { subject: string; articles: number; weekLabel: string };
  senderConfigured: boolean;
  sender: string;
};

const card = { background: "#080c09", borderColor: "#1a2a22" } as const;
const btn = "rounded-md border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider";

function when(value: string | null): string {
  return value ? new Date(value).toLocaleString("en-GB", { dateStyle: "short", timeStyle: "short" }) : "—";
}

/**
 * The mailing list, which is now the only thing the site asks readers for.
 *
 * This replaced a revenue panel — MRR, ARR, paying users — that counted a
 * subscription product the site does not sell.
 */
export default function NewsletterPanel() {
  const [data, setData] = useState<Payload | null>(null);
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [testEmail, setTestEmail] = useState("");

  const load = useCallback(async () => {
    const res = await fetchWithSupabaseAuth("/api/admin/newsletter");
    if (!res.ok) {
      setNotice({ kind: "error", text: (await res.json()).error ?? res.statusText });
      return;
    }
    setData(await res.json());
  }, []);

  // Wrapped rather than called straight from the effect body: the first load
  // resolves after an await, so none of its setState calls run synchronously.
  useEffect(() => {
    void (async () => { await load(); })();
  }, [load]);

  async function act(action: string, email?: string) {
    setBusy(action);
    setNotice(null);
    try {
      const res = await fetchWithSupabaseAuth("/api/admin/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, email }),
      });
      const json = (await res.json()) as { message?: string; error?: string };
      setNotice(res.ok
        ? { kind: "ok", text: json.message ?? "Done." }
        : { kind: "error", text: json.error ?? res.statusText });
      if (res.ok) await load();
    } catch (e) {
      setNotice({ kind: "error", text: e instanceof Error ? e.message : "Request failed." });
    } finally {
      setBusy("");
    }
  }

  const counts = data?.counts;
  const tiles = [
    { label: "Confirmed", value: counts?.confirmed ?? 0, detail: "receive the brief" },
    { label: "Pending", value: counts?.pending ?? 0, detail: "awaiting confirmation" },
    { label: "Unsubscribed", value: counts?.left ?? 0, detail: "opted out" },
    { label: "This week", value: data?.preview.articles ?? 0, detail: "articles in the brief" },
  ];

  return (
    <section id="newsletter" className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.18em]" style={{ color: "#7dffb3" }}>Mailing list</p>
          <h2 className="font-raj mt-1 text-2xl font-bold tracking-tight" style={{ color: "var(--foreground)" }}>
            The Weekly Oracle Brief
          </h2>
        </div>
        <button type="button" onClick={() => void load()} className={btn} style={{ borderColor: "#1a2a22", color: muted }}>
          Refresh
        </button>
      </div>

      {notice && (
        <div className="rounded-lg border px-4 py-3 text-[13px]" style={
          notice.kind === "ok"
            ? { borderColor: "var(--green-dark)", background: "rgba(0,187,102,0.08)", color: "var(--green)" }
            : { borderColor: "#4a1a1a", background: "rgba(255,51,51,0.08)", color: "#ff8888" }
        }>
          {notice.text}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {tiles.map((tile) => (
          <div key={tile.label} className="rounded-2xl border p-4" style={card}>
            <div className="text-[11px] uppercase tracking-[0.16em]" style={{ color: muted }}>{tile.label}</div>
            <div className="font-raj mt-1 text-3xl font-bold tabular-nums" style={{ color: "var(--foreground)" }}>{tile.value}</div>
            <div className="mt-1 text-[12px]" style={{ color: muted }}>{tile.detail}</div>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border p-4 space-y-3" style={card}>
        <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1 text-[12px]" style={{ color: muted }}>
          <span>Sender: <span style={{ color: "var(--foreground)" }}>{data?.sender ?? "—"}</span></span>
          <span>Schedule: <span style={{ color: "var(--foreground)" }}>{data?.job?.enabled ? data.job.schedule_cron : "disabled"}</span></span>
          <span>Next run: <span style={{ color: "var(--foreground)" }}>{when(data?.job?.next_run_at ?? null)}</span></span>
        </div>
        <div className="text-[12px]" style={{ color: muted }}>
          {data?.preview.articles
            ? <>Next issue — <span style={{ color: "var(--foreground)" }}>{data.preview.subject}</span></>
            : "Nothing to send this week: no articles have scored into the brief yet."}
        </div>
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <input
            type="email"
            value={testEmail}
            onChange={(e) => setTestEmail(e.target.value)}
            placeholder="you@example.com"
            className="rounded-md border px-3 py-1.5 text-[12px]"
            style={{ borderColor: "#1a2a22", background: "#050807", color: "var(--foreground)", minWidth: 220 }}
          />
          <button
            type="button"
            disabled={!testEmail || busy !== "" || !data?.preview.articles}
            onClick={() => void act("send_test", testEmail)}
            className={`${btn} disabled:opacity-40`}
            style={{ borderColor: "#1a2a22", color: muted }}
          >
            {busy === "send_test" ? "Sending…" : "Send test"}
          </button>
          <button
            type="button"
            disabled={busy !== "" || !data?.counts.confirmed || !data?.preview.articles}
            onClick={() => {
              if (confirm(`Send this week's briefing to ${data?.counts.confirmed} confirmed subscribers now?`)) void act("send_now");
            }}
            className={`${btn} disabled:opacity-40`}
            style={{ borderColor: "var(--green-dark)", color: "var(--green)" }}
          >
            {busy === "send_now" ? "Sending…" : "Send now"}
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border" style={card}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-left text-[13px]">
            <thead>
              <tr style={{ background: "#0a100c" }}>
                {["Email", "State", "Source", "Signed up", "Actions"].map((h) => (
                  <th key={h} className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider" style={{ color: muted }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(data?.rows ?? []).map((row) => {
                const state = row.unsubscribed_at ? "unsubscribed" : row.confirmed_at ? "confirmed" : "pending";
                const colour = state === "confirmed" ? "var(--green)" : state === "pending" ? "#ffaa00" : muted;
                return (
                  <tr key={row.email} className="border-t" style={{ borderColor: "#121b16" }}>
                    <td className="px-4 py-2.5" style={{ color: "var(--foreground)" }}>{row.email}</td>
                    <td className="px-4 py-2.5 text-[11px] uppercase tracking-wider" style={{ color: colour }}>{state}</td>
                    <td className="px-4 py-2.5" style={{ color: muted }}>{row.source ?? "—"}</td>
                    <td className="px-4 py-2.5 tabular-nums" style={{ color: muted }}>{when(row.created_at)}</td>
                    <td className="px-4 py-2.5">
                      {state === "pending" ? (
                        <button
                          type="button"
                          disabled={busy !== ""}
                          onClick={() => void act("resend_confirmation", row.email)}
                          className={`${btn} disabled:opacity-40`}
                          style={{ borderColor: "#1a2a22", color: muted }}
                        >
                          Resend
                        </button>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
              {data && data.rows.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-6 text-center text-[13px]" style={{ color: muted }}>Nobody has subscribed yet.</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
