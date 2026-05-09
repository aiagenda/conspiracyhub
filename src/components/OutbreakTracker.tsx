"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import * as d3 from "d3";
import * as topojson from "topojson-client";
import type { FeatureCollection } from "geojson";

const FONT = "var(--font-share-tech-mono), monospace";
const RAJ = "var(--font-raj), sans-serif";

type Theory = { name: string; summary: string; probability: number; sources: string[] };
type Patent = { number: string; title: string; assignee: string; url: string };
type Outbreak = {
  id: string;
  title: string;
  description: string;
  source_url: string;
  published_at: string;
  disease: string;
  location: string;
  lat: number;
  lng: number;
  conspiracy_score: number;
  has_conspiracy: boolean;
  theories: Theory[];
  patents: Patent[];
  key_facts: string[];
  verdict: string;
  risk_level: string;
};

function riskColor(risk: string, score: number) {
  if (risk === "CRITICAL" || score >= 70) return "#ff3333";
  if (risk === "HIGH" || score >= 45) return "#ff6633";
  if (risk === "MEDIUM" || score >= 25) return "#ffaa00";
  return "#00bb66";
}

function verdictBg(v: string) {
  if (v === "HIGHLY_SUSPICIOUS") return { bg: "rgba(255,51,51,0.15)", col: "#ff3333", border: "rgba(255,51,51,0.4)" };
  if (v === "SUSPICIOUS") return { bg: "rgba(255,170,0,0.12)", col: "#ffaa00", border: "rgba(255,170,0,0.4)" };
  if (v === "NATURAL") return { bg: "rgba(0,187,102,0.1)", col: "#00bb66", border: "rgba(0,187,102,0.3)" };
  return { bg: "rgba(90,128,104,0.1)", col: "#5a8068", border: "#1a3320" };
}

function scoreBar(score: number) {
  const col = score >= 70 ? "#ff3333" : score >= 45 ? "#ff6633" : score >= 25 ? "#ffaa00" : "#00bb66";
  return (
    <div style={{ height: 3, background: "#1a3320", borderRadius: 2, overflow: "hidden", marginTop: 4 }}>
      <div style={{ height: "100%", width: `${score}%`, background: col, borderRadius: 2, transition: "width 0.8s ease" }} />
    </div>
  );
}


function WorldMap({ outbreaks, selected, onSelect }: { outbreaks: Outbreak[]; selected: Outbreak | null; onSelect: (o: Outbreak) => void }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [world, setWorld] = useState<{ objects: { countries: unknown }; arcs: unknown[] } | null>(null);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; o: Outbreak } | null>(null);

  useEffect(() => {
    fetch("https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json")
      .then((r) => r.json())
      .then(setWorld)
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!world || !svgRef.current) return;
    const svg = d3.select(svgRef.current);
    const W = svgRef.current.clientWidth || 700;
    const H = svgRef.current.clientHeight || 380;

    svg.selectAll("*").remove();

    const projection = d3.geoNaturalEarth1().scale(W / 6.2).translate([W / 2, H / 2]);

    const path = d3.geoPath().projection(projection);

    svg.append("rect").attr("width", W).attr("height", H).attr("fill", "#030806");

    const graticule = d3.geoGraticule()();
    svg
      .append("path")
      .datum(graticule)
      .attr("d", path as d3.ValueFn<SVGPathElement, unknown, string>)
      .attr("fill", "none")
      .attr("stroke", "#0d2015")
      .attr("stroke-width", 0.3);

    const countries = topojson.feature(
      world as unknown as Parameters<typeof topojson.feature>[0],
      world.objects.countries as unknown as Parameters<typeof topojson.feature>[1],
    ) as unknown as FeatureCollection;
    svg
      .append("g")
      .selectAll("path")
      .data(countries.features)
      .enter()
      .append("path")
      .attr("d", path as d3.ValueFn<SVGPathElement, unknown, string>)
      .attr("fill", "#0a160c")
      .attr("stroke", "#1a3320")
      .attr("stroke-width", 0.4);

    for (const o of outbreaks) {
      if (!o.lat && !o.lng) continue;
      const pos = projection([o.lng, o.lat]);
      if (!pos) continue;
      const [x, y] = pos;
      const col = riskColor(o.risk_level, o.conspiracy_score);
      const isSelected = selected?.id === o.id;
      const r = isSelected ? 10 : 6 + Math.min(8, o.conspiracy_score / 12);

      svg
        .append("circle")
        .attr("cx", x)
        .attr("cy", y)
        .attr("r", r + 6)
        .attr("fill", "none")
        .attr("stroke", col)
        .attr("stroke-width", 1)
        .attr("stroke-opacity", 0.3)
        .style("animation", `outbreak-pulse ${1.5 + Math.random()}s ease-in-out infinite`);

      svg
        .append("circle")
        .attr("cx", x)
        .attr("cy", y)
        .attr("r", r)
        .attr("fill", col)
        .attr("fill-opacity", isSelected ? 0.95 : 0.75)
        .attr("stroke", col)
        .attr("stroke-width", isSelected ? 2 : 1)
        .style("cursor", "pointer")
        .style("filter", `drop-shadow(0 0 ${isSelected ? 8 : 4}px ${col})`)
        .on("mouseenter", function (event: MouseEvent) {
          setTooltip({ x: event.offsetX, y: event.offsetY, o });
          d3.select(this).attr("fill-opacity", 1).attr("r", r + 2);
        })
        .on("mouseleave", function () {
          setTooltip(null);
          d3.select(this).attr("fill-opacity", isSelected ? 0.95 : 0.75).attr("r", r);
        })
        .on("click", () => {
          onSelect(o);
        });

      if (isSelected || o.conspiracy_score >= 50) {
        svg
          .append("text")
          .attr("x", x + r + 4)
          .attr("y", y + 4)
          .attr("fill", col)
          .attr("font-size", 8)
          .attr("font-family", "'Share Tech Mono', monospace")
          .attr("letter-spacing", 1)
          .text(o.disease.toUpperCase().slice(0, 12));
      }
    }
  }, [world, outbreaks, selected, onSelect]);

  return (
    <div style={{ position: "relative" }}>
      <style>{`
        @keyframes outbreak-pulse { 0%,100%{opacity:0.3;transform:scale(1)} 50%{opacity:0.7;transform:scale(1.3)} }
      `}</style>
      <svg
        ref={svgRef}
        style={{ width: "100%", height: 380, background: "#030806", borderRadius: 4, border: "1px solid #1a3320", display: "block" }}
      />
      {tooltip && (
        <div
          style={{
            position: "absolute",
            left: tooltip.x + 12,
            top: tooltip.y - 20,
            background: "#090f0b",
            border: `1px solid ${riskColor(tooltip.o.risk_level, tooltip.o.conspiracy_score)}`,
            borderRadius: 3,
            padding: "8px 10px",
            pointerEvents: "none",
            zIndex: 20,
            maxWidth: 200,
          }}
        >
          <div style={{ fontFamily: RAJ, fontSize: 12, fontWeight: 700, color: "#e8ffe8", marginBottom: 3 }}>{tooltip.o.disease}</div>
          <div style={{ fontSize: 9, color: "#5a8068", letterSpacing: 1 }}>{tooltip.o.location.toUpperCase()}</div>
          <div style={{ display: "flex", gap: 6, marginTop: 5 }}>
            <span
              style={{
                fontSize: 9,
                color: riskColor(tooltip.o.risk_level, tooltip.o.conspiracy_score),
                border: `1px solid ${riskColor(tooltip.o.risk_level, tooltip.o.conspiracy_score)}`,
                padding: "1px 5px",
                borderRadius: 2,
              }}
            >
              {tooltip.o.risk_level}
            </span>
            {tooltip.o.has_conspiracy && (
              <span style={{ fontSize: 9, color: "#c94dff", border: "1px solid rgba(201,77,255,0.4)", padding: "1px 5px", borderRadius: 2 }}>
                CONSPIRACY
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function OutbreakCard({ o, selected, onClick }: { o: Outbreak; selected: boolean; onClick: () => void }) {
  const col = riskColor(o.risk_level, o.conspiracy_score);
  const vs = verdictBg(o.verdict);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onClick();
      }}
      style={{
        border: `1px solid ${selected ? col : "#1a3320"}`,
        borderRadius: 4,
        background: selected ? "rgba(0,255,136,0.03)" : "#090f0b",
        padding: "11px 13px",
        cursor: "pointer",
        transition: "all 0.15s",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLDivElement).style.borderColor = col;
      }}
      onMouseLeave={(e) => {
        if (!selected) (e.currentTarget as HTMLDivElement).style.borderColor = "#1a3320";
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
        <div>
          <div style={{ fontFamily: RAJ, fontSize: 13, fontWeight: 700, color: "#e8ffe8", lineHeight: 1.3 }}>{o.disease}</div>
          <div style={{ fontSize: 9, color: "#5a8068", letterSpacing: 1, marginTop: 2 }}>{o.location.toUpperCase()}</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 3, alignItems: "flex-end" }}>
          <span style={{ fontSize: 9, color: col, border: `1px solid ${col}`, padding: "1px 6px", borderRadius: 2, letterSpacing: 1, fontFamily: RAJ, fontWeight: 700 }}>
            {o.risk_level}
          </span>
          {o.has_conspiracy && (
            <span style={{ fontSize: 9, color: "#c94dff", border: "1px solid rgba(201,77,255,0.3)", padding: "1px 6px", borderRadius: 2, letterSpacing: 1 }}>
              ⚠ CONSPIRACY
            </span>
          )}
        </div>
      </div>

      <div style={{ fontSize: 10, color: "#5a8068", lineHeight: 1.6, marginBottom: 8 }}>
        {o.description.slice(0, 120)}
        {o.description.length > 120 ? "..." : ""}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ fontSize: 9, color: "#5a8068", letterSpacing: 1 }}>CONSPIRACY</div>
        <div style={{ flex: 1 }}>{scoreBar(o.conspiracy_score)}</div>
        <div style={{ fontFamily: RAJ, fontSize: 14, fontWeight: 700, color: col }}>{o.conspiracy_score}%</div>
      </div>

      <div
        style={{
          marginTop: 6,
          padding: "3px 8px",
          display: "inline-block",
          background: vs.bg,
          border: `1px solid ${vs.border}`,
          borderRadius: 2,
          fontSize: 8,
          color: vs.col,
          letterSpacing: 1,
        }}
      >
        {o.verdict.replace(/_/g, " ")}
      </div>
    </div>
  );
}

function OutbreakDetail({ o }: { o: Outbreak }) {
  const col = riskColor(o.risk_level, o.conspiracy_score);
  const vs = verdictBg(o.verdict);

  return (
    <div style={{ border: "1px solid #1a3320", borderRadius: 4, background: "#090f0b", overflow: "hidden" }}>
      <div style={{ padding: "12px 14px", borderBottom: "1px solid #1a3320", background: "#050c07" }}>
        <div style={{ fontFamily: RAJ, fontSize: 16, fontWeight: 700, color: "#e8ffe8", marginBottom: 4 }}>{o.disease}</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontSize: 9, color: "#5a8068", letterSpacing: 1 }}>{o.location.toUpperCase()}</span>
          <span style={{ fontSize: 9, color: col, border: `1px solid ${col}`, padding: "1px 6px", borderRadius: 2 }}>{o.risk_level}</span>
          <span style={{ fontSize: 9, padding: "1px 8px", background: vs.bg, border: `1px solid ${vs.border}`, borderRadius: 2, color: vs.col, letterSpacing: 1 }}>
            {o.verdict.replace(/_/g, " ")}
          </span>
        </div>
      </div>

      <div style={{ padding: "12px 14px", display: "flex", flexDirection: "column", gap: 12, maxHeight: 520, overflowY: "auto" }}>
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
            <div style={{ fontSize: 9, color: "#5a8068", letterSpacing: 2 }}>CONSPIRACY SCORE</div>
            <div style={{ fontFamily: RAJ, fontSize: 28, fontWeight: 700, color: col, lineHeight: 1 }}>{o.conspiracy_score}%</div>
          </div>
          {scoreBar(o.conspiracy_score)}
        </div>

        <div style={{ fontSize: 11, color: "#7aaa8a", lineHeight: 1.7 }}>{o.description}</div>

        {o.key_facts?.length > 0 && (
          <div>
            <div style={{ fontSize: 9, color: "#5a8068", letterSpacing: 2, marginBottom: 7, textTransform: "uppercase" }}>Key Facts</div>
            {o.key_facts.map((f, i) => (
              <div key={i} style={{ display: "flex", gap: 7, color: "#7aaa8a", fontSize: 11, marginBottom: 5, lineHeight: 1.6, alignItems: "flex-start" }}>
                <span style={{ color: "#00bb66", flexShrink: 0 }}>▸</span>
                <span>{f}</span>
              </div>
            ))}
          </div>
        )}

        {o.theories?.length > 0 && (
          <div>
            <div style={{ fontSize: 9, color: "#c94dff", letterSpacing: 2, marginBottom: 7, textTransform: "uppercase" }}>
              ◈ Conspiracy Theories ({o.theories.length})
            </div>
            {o.theories.map((t, i) => (
              <div key={i} style={{ border: "1px solid rgba(201,77,255,0.2)", borderRadius: 3, padding: "9px 11px", background: "rgba(20,8,24,0.6)", marginBottom: 7 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                  <div style={{ fontFamily: RAJ, fontSize: 12, fontWeight: 700, color: "#e9b3ff" }}>{t.name}</div>
                  <div style={{ fontFamily: RAJ, fontSize: 18, fontWeight: 700, color: riskColor("", t.probability), flexShrink: 0 }}>{t.probability}%</div>
                </div>
                <div style={{ fontSize: 10, color: "#7a5a88", lineHeight: 1.6, marginBottom: 6 }}>{t.summary}</div>
                {t.sources?.filter((s) => /^https?:\/\//.test(s)).map((s, j) => (
                  <a
                    key={j}
                    href={s}
                    target="_blank"
                    rel="noreferrer"
                    style={{ display: "flex", gap: 6, color: "#00bb66", fontSize: 9, textDecoration: "none", marginBottom: 3, wordBreak: "break-all" }}
                  >
                    <span style={{ flexShrink: 0 }}>↗</span>
                    <span>{s}</span>
                  </a>
                ))}
              </div>
            ))}
          </div>
        )}

        {o.patents?.length > 0 && (
          <div>
            <div style={{ fontSize: 9, color: "#ff5555", letterSpacing: 2, marginBottom: 7, textTransform: "uppercase" }}>
              ◈ Related Patents ({o.patents.length})
            </div>
            {o.patents.map((p, i) => (
              <a
                key={i}
                href={p.url}
                target="_blank"
                rel="noreferrer"
                style={{
                  display: "block",
                  border: "1px solid rgba(255,85,85,0.2)",
                  borderRadius: 3,
                  padding: "8px 10px",
                  background: "rgba(26,10,10,0.6)",
                  marginBottom: 6,
                  textDecoration: "none",
                  transition: "border-color 0.15s",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLAnchorElement).style.borderColor = "#ff5555";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLAnchorElement).style.borderColor = "rgba(255,85,85,0.2)";
                }}
              >
                <div style={{ fontSize: 9, color: "#ff5555", letterSpacing: 1, marginBottom: 3 }}>
                  {p.number} · {p.assignee}
                </div>
                <div style={{ fontFamily: RAJ, fontSize: 11, fontWeight: 700, color: "#ffe8e8" }}>{p.title}</div>
                <div style={{ fontSize: 9, color: "#5a4040", marginTop: 3 }}>↗ View patent</div>
              </a>
            ))}
          </div>
        )}

        <div style={{ paddingTop: 8, borderTop: "1px solid #1a3320", display: "flex", gap: 10 }}>
          <a href={o.source_url} target="_blank" rel="noreferrer" style={{ fontSize: 9, color: "#00bb66", textDecoration: "none", letterSpacing: 1 }}>
            ↗ WHO SOURCE
          </a>
          <Link href={`/search?q=${encodeURIComponent(o.disease)}`} style={{ fontSize: 9, color: "#5a8068", textDecoration: "none", letterSpacing: 1 }}>
            ◈ SEARCH DATABASE
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function OutbreakTracker() {
  const [data, setData] = useState<{ outbreaks: Outbreak[]; generated_at: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<Outbreak | null>(null);
  const [filter, setFilter] = useState<"all" | "conspiracy" | "high">("all");

  useEffect(() => {
    fetch("/api/outbreaks")
      .then((r) => r.json())
      .then((d: { outbreaks?: Outbreak[]; generated_at?: string; error?: string }) => {
        if (d.error) throw new Error(d.error);
        setData({ outbreaks: d.outbreaks ?? [], generated_at: d.generated_at ?? new Date().toISOString() });
        if (d.outbreaks?.length) setSelected(d.outbreaks[0]!);
      })
      .catch(() => setError("Failed to load outbreak data."))
      .finally(() => setLoading(false));
  }, []);

  const outbreaks = data?.outbreaks ?? [];
  const visible = outbreaks.filter((o) => {
    if (filter === "conspiracy") return o.has_conspiracy;
    if (filter === "high") return o.risk_level === "HIGH" || o.risk_level === "CRITICAL";
    return true;
  });

  const highRisk = outbreaks.filter((o) => o.risk_level === "HIGH" || o.risk_level === "CRITICAL").length;
  const withConspiracy = outbreaks.filter((o) => o.has_conspiracy).length;

  return (
    <div style={{ minHeight: "100vh", background: "#050c07", color: "#c8e8d0", fontFamily: FONT }}>
      <div className="scanline" />
      <div style={{ position: "relative", zIndex: 1 }}>
        <div style={{ height: 44, background: "#050c07", borderBottom: "1px solid #1a3320", display: "flex", alignItems: "center", padding: "0 16px", gap: 12 }}>
          <Link href="/" style={{ fontSize: 10, color: "#5a8068", textDecoration: "none", letterSpacing: 2, border: "1px solid #1a3320", padding: "4px 10px", borderRadius: 3 }}>
            ← FEED
          </Link>
          <div style={{ width: 1, height: 20, background: "#1a3320" }} />
          <div style={{ fontFamily: RAJ, fontSize: 15, fontWeight: 700, color: "#00ff88", letterSpacing: 2 }}>THE THEORIST</div>
          <div style={{ width: 1, height: 20, background: "#1a3320" }} />
          <div style={{ fontFamily: RAJ, fontSize: 11, fontWeight: 700, color: "#5a8068", letterSpacing: 2 }}>OUTBREAK TRACKER</div>
          <div style={{ marginLeft: "auto", fontSize: 10, color: "#3a5040", letterSpacing: 1 }}>
            WHO · CDC · {data ? `Updated ${new Date(data.generated_at).toLocaleTimeString()}` : "LOADING..."}
          </div>
        </div>

        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "1.5rem 1.25rem 4rem" }}>
          <div style={{ marginBottom: "1.25rem", paddingBottom: "1rem", borderBottom: "1px solid #1a3320" }}>
            <div style={{ fontFamily: RAJ, fontSize: 10, fontWeight: 600, letterSpacing: 5, color: "#5a8068", marginBottom: 5, textTransform: "uppercase" }}>
              ■ GLOBAL DISEASE SURVEILLANCE ■
            </div>
            <h1
              style={{
                fontFamily: RAJ,
                fontSize: 24,
                fontWeight: 700,
                color: "#00ff88",
                letterSpacing: 2,
                textTransform: "uppercase",
                textShadow: "0 0 16px rgba(0,255,136,0.2)",
                margin: "0 0 6px",
              }}
            >
              Outbreak Tracker
            </h1>
            <div style={{ fontSize: 9, color: "#3a5040", letterSpacing: 2 }}>AI-ANALYZED WHO DISEASE OUTBREAK FEED · CONSPIRACY PATTERN DETECTION · PATENT CROSS-REFERENCE</div>
          </div>

          {!loading && data && (
            <div style={{ display: "flex", gap: 10, marginBottom: "1.25rem", flexWrap: "wrap" }}>
              {[
                { label: "ACTIVE OUTBREAKS", value: outbreaks.length, col: "#00ff88" },
                { label: "HIGH RISK", value: highRisk, col: "#ff3333" },
                { label: "CONSPIRACY FLAGS", value: withConspiracy, col: "#c94dff" },
                {
                  label: "AVG THREAT SCORE",
                  value: `${Math.round(outbreaks.reduce((a, o) => a + o.conspiracy_score, 0) / Math.max(1, outbreaks.length))}%`,
                  col: "#ffaa00",
                },
              ].map(({ label, value, col }) => (
                <div key={label} style={{ border: "1px solid #1a3320", borderRadius: 3, padding: "8px 14px", background: "#090f0b" }}>
                  <div style={{ fontSize: 8, color: "#3a5040", letterSpacing: 2, marginBottom: 3 }}>{label}</div>
                  <div style={{ fontFamily: RAJ, fontSize: 22, fontWeight: 700, color: col, lineHeight: 1 }}>{value}</div>
                </div>
              ))}
            </div>
          )}

          <div style={{ display: "flex", gap: 6, marginBottom: "1rem", flexWrap: "wrap" }}>
            {[
              { key: "all" as const, label: "ALL OUTBREAKS" },
              { key: "conspiracy" as const, label: "⚠ CONSPIRACY FLAGS" },
              { key: "high" as const, label: "🔴 HIGH/CRITICAL RISK" },
            ].map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => setFilter(f.key)}
                style={{
                  fontFamily: RAJ,
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: 1,
                  textTransform: "uppercase",
                  padding: "5px 12px",
                  borderRadius: 2,
                  cursor: "pointer",
                  border: `1px solid ${filter === f.key ? "#00bb66" : "#1a3320"}`,
                  background: filter === f.key ? "rgba(0,255,136,0.06)" : "transparent",
                  color: filter === f.key ? "#00ff88" : "#5a8068",
                }}
              >
                {f.label}
              </button>
            ))}
          </div>

          {loading && (
            <div style={{ textAlign: "center", padding: "3rem 0", color: "#00bb66", fontSize: 11, letterSpacing: 2 }}>
              <div style={{ marginBottom: 14 }}>[ FETCHING WHO OUTBREAK DATABASE... ]</div>
              {["> Connecting to WHO Disease Outbreak News...", "> Parsing active outbreak reports...", "> Running conspiracy pattern analysis...", "> Cross-referencing USPTO patent database..."].map((l, i) => (
                <div key={i} style={{ color: "#2a5035", marginBottom: 5 }}>
                  {l}
                </div>
              ))}
            </div>
          )}

          {error && (
            <div style={{ padding: 12, border: "1px solid rgba(255,51,51,0.3)", borderRadius: 3, color: "#ff3333", fontSize: 11 }}>
              [ERROR] {error}
            </div>
          )}

          {!loading && data && (
            <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr)", gap: "1.25rem" }} className="outbreak-layout">
              <style>{`
                @media (min-width: 960px) {
                  .outbreak-layout { grid-template-columns: 1fr 320px !important; }
                }
              `}</style>

              <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                <WorldMap outbreaks={visible} selected={selected} onSelect={setSelected} />

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 8 }}>
                  {visible.map((o) => (
                    <OutbreakCard key={o.id} o={o} selected={selected?.id === o.id} onClick={() => setSelected(o)} />
                  ))}
                </div>
              </div>

              <div>
                {selected ? (
                  <OutbreakDetail o={selected} />
                ) : (
                  <div style={{ border: "1px solid #1a3320", borderRadius: 4, padding: "2rem", textAlign: "center", color: "#3a5040", fontSize: 10, letterSpacing: 2 }}>
                    SELECT AN OUTBREAK
                    <br />
                    ON THE MAP OR LIST
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
