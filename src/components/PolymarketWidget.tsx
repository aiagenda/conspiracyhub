"use client";
import { useEffect, useMemo, useState } from "react";
import { combinePolymarketQuery } from "@/lib/polymarketQuery";
import { getSupabaseBrowserClient } from "@/lib/supabase";

const RAJ = "var(--font-raj), sans-serif";
const FONT = "var(--font-share-tech-mono), monospace";

interface PM { id:string; question:string; yesPrice:number; noPrice:number; volume:number; volume24h:number; liquidity:number; endDate:string; url:string; }

function fmt(v:number) { return v>=1e6?`$${(v/1e6).toFixed(1)}M`:v>=1e3?`$${(v/1e3).toFixed(0)}K`:`$${v}`; }
function days(d:string) { if(!d)return""; const n=Math.ceil((new Date(d).getTime()-Date.now())/86400000); return n<0?"expired":n===0?"today":`${n}d`; }

export default function PolymarketWidget({
  query,
  context,
  variant = "sidebar",
}: {
  query: string;
  context?: string;
  /** "board" = horizontal always-open card strip; "sidebar" = collapsible (default) */
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

  if (loading) return (
    <div style={{ border: "1px solid rgba(201,77,255,0.15)", borderRadius: 4, padding: "8px 12px", background: "rgba(20,8,28,0.4)", display: "flex", alignItems: "center", gap: 8 }}>
      <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#c94dff", display: "inline-block", animation: "bannerDot 0.9s step-end infinite" }} />
      <span style={{ fontFamily: FONT, fontSize: 9, color: "#5a8068", letterSpacing: 2 }}>CHECKING POLYMARKET...</span>
    </div>
  );

  if (requiresPro) return (
    <div style={{ border: "1px solid rgba(201,77,255,0.25)", borderRadius: 4, overflow: "hidden", background: "rgba(20,8,28,0.5)", padding: "10px 14px", display: "flex", alignItems: "center", gap: 10 }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#c94dff", flexShrink: 0 }} />
      <div style={{ flex: 1 }}>
        <div style={{ fontFamily: FONT, fontSize: 9, color: "#c94dff", letterSpacing: 2, marginBottom: 3 }}>◈ POLYMARKET REAL-TIME ODDS</div>
        <div style={{ fontFamily: FONT, fontSize: 9, color: "#5a8068", letterSpacing: 1 }}>Live prediction markets — PRO feature</div>
      </div>
      <a href="/account" style={{ fontFamily: RAJ, fontSize: 10, fontWeight: 700, letterSpacing: 2, color: "#c94dff", border: "1px solid rgba(201,77,255,0.4)", padding: "4px 10px", borderRadius: 2, textDecoration: "none", flexShrink: 0, textTransform: "uppercase" }}>UNLOCK PRO</a>
    </div>
  );

  if (!markets.length) return null;

  // ── BOARD VARIANT — horizontal card strip, always open ─────────────────
  if (variant === "board") {
    return (
      <div>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#c94dff", display: "inline-block", flexShrink: 0, boxShadow: "0 0 6px rgba(201,77,255,0.6)" }} />
            <span style={{ fontFamily: FONT, fontSize: 9, color: "#c94dff", letterSpacing: 3, textTransform: "uppercase" }}>
              Prediction Intelligence
            </span>
            <span style={{ fontFamily: FONT, fontSize: 9, color: "#3a2a4a", letterSpacing: 1 }}>
              — {markets.length} active market{markets.length > 1 ? "s" : ""}
            </span>
          </div>
          <a
            href="https://polymarket.com"
            target="_blank"
            rel="noreferrer"
            style={{ fontFamily: FONT, fontSize: 8, color: "#4a3060", letterSpacing: 1, textDecoration: "none" }}
          >
            polymarket.com ↗
          </a>
        </div>

        {/* Cards — horizontal row */}
        <div style={{
          display: "grid",
          gridTemplateColumns: `repeat(${Math.min(markets.length, 2)}, 1fr)`,
          gap: 10,
        }}>
          {markets.map((m) => {
            const yesWins = m.yesPrice >= m.noPrice;
            return (
              <a
                key={m.id}
                href={m.url}
                target="_blank"
                rel="noreferrer"
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                  padding: "12px 14px",
                  background: "rgba(20,8,28,0.6)",
                  border: "1px solid rgba(201,77,255,0.18)",
                  borderRadius: 4,
                  textDecoration: "none",
                  transition: "border-color 0.15s, background 0.15s",
                  cursor: "pointer",
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLAnchorElement).style.borderColor = "rgba(201,77,255,0.45)";
                  (e.currentTarget as HTMLAnchorElement).style.background = "rgba(20,8,28,0.85)";
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLAnchorElement).style.borderColor = "rgba(201,77,255,0.18)";
                  (e.currentTarget as HTMLAnchorElement).style.background = "rgba(20,8,28,0.6)";
                }}
              >
                {/* Question */}
                <div style={{ fontFamily: RAJ, fontSize: 13, fontWeight: 700, color: "#d8a8ff", lineHeight: 1.4, flex: 1 }}>
                  {m.question.length > 90 ? `${m.question.slice(0, 89)}…` : m.question}
                </div>

                {/* Progress bar */}
                <div style={{ display: "flex", height: 6, borderRadius: 3, overflow: "hidden", gap: 1 }}>
                  <div style={{ width: `${m.yesPrice}%`, background: "linear-gradient(90deg, #00aa55, #00ff88)", transition: "width 0.6s ease", borderRadius: "3px 0 0 3px" }} />
                  <div style={{ width: `${m.noPrice}%`, background: "linear-gradient(90deg, #cc2222, #ff4444)", transition: "width 0.6s ease", borderRadius: "0 3px 3px 0" }} />
                </div>

                {/* Prices + meta */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ display: "flex", gap: 14, alignItems: "baseline" }}>
                    <span>
                      <span style={{ fontFamily: RAJ, fontSize: 20, fontWeight: 700, color: "#00ff88", lineHeight: 1 }}>{m.yesPrice}¢</span>
                      <span style={{ fontFamily: FONT, fontSize: 8, color: "#3a6a4a", marginLeft: 3, letterSpacing: 1 }}>YES</span>
                    </span>
                    <span>
                      <span style={{ fontFamily: RAJ, fontSize: 20, fontWeight: 700, color: "#ff4444", lineHeight: 1 }}>{m.noPrice}¢</span>
                      <span style={{ fontFamily: FONT, fontSize: 8, color: "#6a3a3a", marginLeft: 3, letterSpacing: 1 }}>NO</span>
                    </span>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2 }}>
                    <span style={{ fontFamily: FONT, fontSize: 8, color: "#4a3060", letterSpacing: 1 }}>VOL {fmt(m.volume)}</span>
                    {m.endDate && (
                      <span style={{ fontFamily: FONT, fontSize: 8, color: "#4a3060", letterSpacing: 1 }}>
                        {days(m.endDate) === "expired" ? (
                          <span style={{ color: "#6a3a3a" }}>expired</span>
                        ) : `closes ${days(m.endDate)}`}
                      </span>
                    )}
                  </div>
                </div>

                {/* Dominant outcome label */}
                <div style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  paddingTop: 6,
                  borderTop: "1px solid rgba(201,77,255,0.1)",
                }}>
                  <span style={{ fontFamily: FONT, fontSize: 8, letterSpacing: 2, color: yesWins ? "#00aa55" : "#cc2222" }}>
                    MARKET LEANS {yesWins ? "YES" : "NO"} — {yesWins ? m.yesPrice : m.noPrice}%
                  </span>
                  <span style={{ fontFamily: FONT, fontSize: 8, color: "#c94dff", letterSpacing: 1 }}>BET ↗</span>
                </div>
              </a>
            );
          })}
        </div>

        <div style={{ marginTop: 6, fontFamily: FONT, fontSize: 7, color: "#2a1a3a", letterSpacing: 1, textAlign: "right" }}>
          Prediction market data · Not financial advice
        </div>
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

