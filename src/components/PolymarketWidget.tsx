"use client";
import { useEffect, useMemo, useState } from "react";
import { combinePolymarketQuery } from "@/lib/polymarketQuery";

const RAJ = "var(--font-raj), sans-serif";
const FONT = "var(--font-share-tech-mono), monospace";

interface PM { id:string; question:string; yesPrice:number; noPrice:number; volume:number; volume24h:number; liquidity:number; endDate:string; url:string; }

function fmt(v:number) { return v>=1e6?`$${(v/1e6).toFixed(1)}M`:v>=1e3?`$${(v/1e3).toFixed(0)}K`:`$${v}`; }
function days(d:string) { if(!d)return""; const n=Math.ceil((new Date(d).getTime()-Date.now())/86400000); return n<0?"expired":n===0?"today":`${n}d`; }

export default function PolymarketWidget({ query, context }: { query: string; context?: string }) {
  const q = useMemo(() => combinePolymarketQuery(query, context), [query, context]);
  return <PolymarketFetch key={q} q={q} />;
}

/** Remount when `q` changes so loading state resets without setState-in-effect. */
function PolymarketFetch({ q }: { q: string }) {
  const [markets, setMarkets] = useState<PM[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    fetch(`/api/polymarket?q=${encodeURIComponent(q)}`)
      .then((r) => r.json())
      .then((d) => {
        const list = d.markets ?? [];
        setMarkets(list);
        if (list.length) setOpen(true);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [q]);

  if (loading) return (
    <div style={{ border: "1px solid rgba(201,77,255,0.15)", borderRadius: 4, padding: "8px 12px", background: "rgba(20,8,28,0.4)", display: "flex", alignItems: "center", gap: 8 }}>
      <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#c94dff", display: "inline-block", animation: "bannerDot 0.9s step-end infinite" }} />
      <span style={{ fontFamily: FONT, fontSize: 9, color: "#5a8068", letterSpacing: 2 }}>CHECKING POLYMARKET...</span>
    </div>
  );
  if (!markets.length) return null;

  return (
    <div style={{ border: "1px solid rgba(201,77,255,0.25)", borderRadius: 4, overflow: "hidden", background: "rgba(20,8,28,0.5)" }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "9px 12px", background: "transparent", border: "none", cursor: "pointer", textAlign: "left" }}
      >
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#c94dff", display: "inline-block", flexShrink: 0 }} />
        <span style={{ fontFamily: FONT, fontSize: 9, color: "#c94dff", letterSpacing: 2, flex: 1 }}>
          ◈ POLYMARKET — {markets.length} ACTIVE BET{markets.length > 1 ? "S" : ""}
        </span>
        <span style={{ fontSize: 9, color: "#5a8068" }}>{open ? "▲" : "▼"}</span>
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

