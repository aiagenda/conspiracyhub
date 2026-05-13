"use client";
import { useEffect, useMemo, useState } from "react";
import { combinePolymarketQuery } from "@/lib/polymarketQuery";
import { getSupabaseBrowserClient } from "@/lib/supabase";

const RAJ = "var(--font-raj), sans-serif";
const FONT = "var(--font-share-tech-mono), monospace";

interface PM { id:string; question:string; yesPrice:number; noPrice:number; volume:number; volume24h:number; liquidity:number; endDate:string; url:string; }

function fmt(v:number) { return v>=1e6?`$${(v/1e6).toFixed(1)}M`:v>=1e3?`$${(v/1e3).toFixed(0)}K`:`$${v}`; }
function days(d:string) { if(!d)return""; const n=Math.ceil((new Date(d).getTime()-Date.now())/86400000); return n<0?"expired":n===0?"today":`${n}d`; }

const BOARD_EXPAND_MAX_PX = 280;

function BoardMarketCard({ m }: { m: PM }) {
  const yesWins = m.yesPrice >= m.noPrice;
  return (
    <a
      href={m.url}
      target="_blank"
      rel="noreferrer"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 8,
        padding: "10px 12px",
        background: "rgba(20,8,28,0.55)",
        border: "1px solid rgba(201,77,255,0.16)",
        borderRadius: 4,
        textDecoration: "none",
        transition: "border-color 0.15s, background 0.15s",
        cursor: "pointer",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLAnchorElement).style.borderColor = "rgba(201,77,255,0.38)";
        (e.currentTarget as HTMLAnchorElement).style.background = "rgba(24,10,32,0.75)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLAnchorElement).style.borderColor = "rgba(201,77,255,0.16)";
        (e.currentTarget as HTMLAnchorElement).style.background = "rgba(20,8,28,0.55)";
      }}
    >
      <div style={{ fontFamily: RAJ, fontSize: 12, fontWeight: 700, color: "#d0a0f0", lineHeight: 1.35 }}>
        {m.question.length > 100 ? `${m.question.slice(0, 99)}…` : m.question}
      </div>
      <div style={{ display: "flex", height: 5, borderRadius: 2, overflow: "hidden", gap: 1 }}>
        <div style={{ width: `${m.yesPrice}%`, background: "linear-gradient(90deg, #00aa55, #00dd77)" }} />
        <div style={{ width: `${m.noPrice}%`, background: "linear-gradient(90deg, #aa2222, #ee4444)" }} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 6 }}>
        <div style={{ display: "flex", gap: 12, alignItems: "baseline" }}>
          <span style={{ fontFamily: RAJ, fontSize: 15, fontWeight: 700, color: "#00ff88" }}>{m.yesPrice}¢</span>
          <span style={{ fontFamily: RAJ, fontSize: 15, fontWeight: 700, color: "#ff6b6b" }}>{m.noPrice}¢</span>
        </div>
        <span style={{ fontFamily: FONT, fontSize: 8, color: "#5a4a68", letterSpacing: 1 }}>
          VOL {fmt(m.volume)}
          {m.endDate ? ` · ${days(m.endDate)}` : ""}
        </span>
      </div>
      <div style={{ fontFamily: FONT, fontSize: 7, letterSpacing: 1.5, color: yesWins ? "#4a8060" : "#805050" }}>
        LEANS {yesWins ? "YES" : "NO"} · OPEN ON POLYMARKET ↗
      </div>
    </a>
  );
}

export default function PolymarketWidget({
  query,
  context,
  variant = "sidebar",
}: {
  query: string;
  context?: string;
  /** "board" = investigation footer: thin collapsed bar, expand for compact cards; "sidebar" = article sidebar (default) */
  variant?: "board" | "sidebar";
}) {
  const q = useMemo(() => combinePolymarketQuery(query, context), [query, context]);
  return <PolymarketFetch key={q} q={q} variant={variant} />;
}

/** Remount when `q` changes so loading state resets without setState-in-effect. */
function PolymarketFetch({ q, variant }: { q: string; variant: "board" | "sidebar" }) {
  const [markets, setMarkets] = useState<PM[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [requiresPro, setRequiresPro] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const supabase = getSupabaseBrowserClient();
        const { data: { session } } = await supabase.auth.getSession();
        const headers: HeadersInit = session?.access_token
          ? { Authorization: `Bearer ${session.access_token}` }
          : {};
        const r = await fetch(`/api/polymarket?q=${encodeURIComponent(q)}`, { headers });
        const d = await r.json();
        if (d.requires_pro) { setRequiresPro(true); return; }
        setMarkets(d.markets ?? []);
      } catch { /* ignore */ }
      finally { setLoading(false); }
    })();
  }, [q]);

  if (loading) {
    const rowPad = variant === "board" ? "6px 12px" : "8px 12px";
    return (
      <div
        style={{
          border: "1px solid rgba(201,77,255,0.15)",
          borderRadius: 4,
          padding: rowPad,
          background: "rgba(20,8,28,0.4)",
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <span
          style={{
            width: 5,
            height: 5,
            borderRadius: "50%",
            background: "#c94dff",
            display: "inline-block",
            animation: "bannerDot 0.9s step-end infinite",
          }}
        />
        <span style={{ fontFamily: FONT, fontSize: variant === "board" ? 8 : 9, color: "#5a8068", letterSpacing: 2 }}>
          CHECKING POLYMARKET…
        </span>
      </div>
    );
  }

  if (requiresPro) {
    if (variant === "board") {
      return (
        <div
          style={{
            border: "1px solid rgba(201,77,255,0.22)",
            borderRadius: 4,
            background: "rgba(20,8,28,0.45)",
            padding: "6px 12px",
            display: "flex",
            alignItems: "center",
            gap: 10,
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
            <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#c94dff", flexShrink: 0 }} />
            <span style={{ fontFamily: FONT, fontSize: 8, color: "#7a6088", letterSpacing: 1.5 }}>
              Polymarket odds — <span style={{ color: "#c94dff" }}>PRO</span>
            </span>
          </div>
          <a
            href="/account"
            style={{
              fontFamily: RAJ,
              fontSize: 9,
              fontWeight: 700,
              letterSpacing: 2,
              color: "#c94dff",
              border: "1px solid rgba(201,77,255,0.35)",
              padding: "3px 8px",
              borderRadius: 2,
              textDecoration: "none",
              flexShrink: 0,
              textTransform: "uppercase",
            }}
          >
            Unlock
          </a>
        </div>
      );
    }
    return (
      <div style={{ border: "1px solid rgba(201,77,255,0.25)", borderRadius: 4, overflow: "hidden", background: "rgba(20,8,28,0.5)", padding: "10px 14px", display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#c94dff", flexShrink: 0 }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: FONT, fontSize: 9, color: "#c94dff", letterSpacing: 2, marginBottom: 3 }}>◈ POLYMARKET REAL-TIME ODDS</div>
          <div style={{ fontFamily: FONT, fontSize: 9, color: "#5a8068", letterSpacing: 1 }}>Live prediction markets — PRO feature</div>
        </div>
        <a href="/account" style={{ fontFamily: RAJ, fontSize: 10, fontWeight: 700, letterSpacing: 2, color: "#c94dff", border: "1px solid rgba(201,77,255,0.4)", padding: "4px 10px", borderRadius: 2, textDecoration: "none", flexShrink: 0, textTransform: "uppercase" }}>UNLOCK PRO</a>
      </div>
    );
  }

  if (!markets.length) return null;

  // ── BOARD VARIANT — thin collapsed bar; expand shows scrollable compact cards ─
  if (variant === "board") {
    return (
      <div
        style={{
          border: "1px solid rgba(201,77,255,0.2)",
          borderRadius: 4,
          overflow: "hidden",
          background: "rgba(12,6,18,0.75)",
        }}
      >
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          style={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "6px 12px",
            background: "transparent",
            border: "none",
            cursor: "pointer",
            textAlign: "left",
          }}
        >
          <span
            style={{
              width: 5,
              height: 5,
              borderRadius: "50%",
              background: "#c94dff",
              flexShrink: 0,
              boxShadow: "0 0 5px rgba(201,77,255,0.45)",
            }}
          />
          <span style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontFamily: FONT, fontSize: 8, color: "#c94dff", letterSpacing: 2.5, textTransform: "uppercase" }}>
              Prediction intel
            </span>
            <span style={{ fontFamily: FONT, fontSize: 8, color: "#4a3558", letterSpacing: 1 }}>
              {markets.length} market{markets.length > 1 ? "s" : ""}
            </span>
            {!open && (
              <span style={{ fontFamily: FONT, fontSize: 7, color: "#3a5040", letterSpacing: 1 }}>— expand</span>
            )}
          </span>
          <span style={{ fontFamily: FONT, fontSize: 9, color: "#5a8068", flexShrink: 0 }}>{open ? "▲" : "▼"}</span>
          <a
            href="https://polymarket.com"
            target="_blank"
            rel="noreferrer"
            onClick={(e) => e.stopPropagation()}
            style={{ fontSize: 7, color: "#4a3060", textDecoration: "none", letterSpacing: 1, flexShrink: 0 }}
          >
            polymarket ↗
          </a>
        </button>

        {open && (
          <div
            style={{
              borderTop: "1px solid rgba(201,77,255,0.12)",
              maxHeight: BOARD_EXPAND_MAX_PX,
              overflowY: "auto",
              padding: "8px 10px 10px",
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            {markets.map((m) => (
              <BoardMarketCard key={m.id} m={m} />
            ))}
            <div style={{ fontFamily: FONT, fontSize: 7, color: "#2a2030", letterSpacing: 0.8, textAlign: "center", paddingTop: 2 }}>
              Not financial advice · crowd odds
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── SIDEBAR VARIANT — collapsible (default) ─────────────────────────────
  return (
    <div style={{ border: "1px solid rgba(201,77,255,0.25)", borderRadius: 4, overflow: "hidden", background: "rgba(20,8,28,0.5)" }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "flex-start",
          gap: 8,
          padding: "9px 12px",
          background: "transparent",
          border: "none",
          cursor: "pointer",
          textAlign: "left",
        }}
      >
        <span style={{ width: 6, height: 6, marginTop: 3, borderRadius: "50%", background: "#c94dff", display: "inline-block", flexShrink: 0 }} />
        <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 3 }}>
          <span style={{ fontFamily: FONT, fontSize: 9, color: "#c94dff", letterSpacing: 2 }}>
            ◈ POLYMARKET — {markets.length} ACTIVE BET{markets.length > 1 ? "S" : ""}
          </span>
          {!open && (
            <span style={{ fontFamily: FONT, fontSize: 8, color: "#5a8068", letterSpacing: 1, opacity: 0.92 }}>
              Click to expand prediction markets
            </span>
          )}
        </span>
        <span style={{ fontSize: 9, color: "#5a8068", flexShrink: 0 }}>{open ? "▲" : "▼"}</span>
        <a
          href="https://polymarket.com"
          target="_blank"
          rel="noreferrer"
          onClick={(e) => e.stopPropagation()}
          style={{ fontSize: 8, color: "#5a8068", textDecoration: "none", letterSpacing: 1 }}
        >
          polymarket.com ↗
        </a>
      </button>

      {open && (
        <div style={{ borderTop: "1px solid rgba(201,77,255,0.15)" }}>
          {markets.map((m) => (
            <div key={m.id} style={{ padding: "10px 12px", borderBottom: "1px solid rgba(201,77,255,0.1)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 8 }}>
                <div style={{ fontFamily: RAJ, fontSize: 12, fontWeight: 700, color: "#e9b3ff", lineHeight: 1.3, flex: 1 }}>
                  {m.question.length > 78 ? `${m.question.slice(0, 77)}…` : m.question}
                </div>
                <a
                  href={m.url}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    fontSize: 9,
                    color: "#c94dff",
                    border: "1px solid rgba(201,77,255,0.3)",
                    padding: "2px 8px",
                    borderRadius: 2,
                    textDecoration: "none",
                    letterSpacing: 1,
                    flexShrink: 0,
                    alignSelf: "flex-start",
                  }}
                >
                  BET ↗
                </a>
              </div>
              <div style={{ display: "flex", height: 4, borderRadius: 2, overflow: "hidden", marginBottom: 6 }}>
                <div style={{ width: `${m.yesPrice}%`, background: "#00bb66", transition: "width 0.5s ease" }} />
                <div style={{ width: `${m.noPrice}%`, background: "#ff3333", transition: "width 0.5s ease" }} />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                <div style={{ display: "flex", gap: 12 }}>
                  <span style={{ fontFamily: RAJ, fontSize: 16, fontWeight: 700, color: "#00ff88", lineHeight: 1 }}>
                    {m.yesPrice}¢ <span style={{ fontSize: 9, color: "#5a8068" }}>YES</span>
                  </span>
                  <span style={{ fontFamily: RAJ, fontSize: 16, fontWeight: 700, color: "#ff3333", lineHeight: 1 }}>
                    {m.noPrice}¢ <span style={{ fontSize: 9, color: "#5a8068" }}>NO</span>
                  </span>
                </div>
                <span style={{ fontSize: 9, color: "#5a8068", letterSpacing: 1 }}>
                  VOL {fmt(m.volume)}
                  {m.endDate ? ` · ${days(m.endDate)}` : ""}
                </span>
              </div>
            </div>
          ))}
          <div style={{ padding: "6px 12px", fontSize: 8, color: "#3a3040", letterSpacing: 1, textAlign: "center" }}>
            Prediction market · Not financial advice
          </div>
        </div>
      )}
    </div>
  );
}

