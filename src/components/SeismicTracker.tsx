"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import * as d3 from "d3";
import * as topojson from "topojson-client";
import SiteNav from "@/components/SiteNav";
import { pageContentShellStyle } from "@/lib/pageShell";
import {
  magBand,
  magColor,
  seismicTimeAgo,
  type SeismicEvent,
  type SeismicPayload,
} from "@/lib/seismic";

const FONT = "var(--font-share-tech-mono), monospace";
const RAJ = "var(--font-raj), sans-serif";
const ACCENT = "#ff8844";

type Filter = "all" | "m45" | "m5" | "m6" | "significant" | "tsunami" | "24h";

function isMobileViewport(): boolean {
  return typeof window !== "undefined" && window.innerWidth <= 768;
}

function useMapBodyVisible(mapOpen: boolean): boolean {
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 768px)");
    const sync = () => setMobile(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  return mobile ? mapOpen : true;
}

function SeismicMap({
  events,
  selected,
  onSelect,
}: {
  events: SeismicEvent[];
  selected: SeismicEvent | null;
  onSelect: (e: SeismicEvent) => void;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const zoomTransformRef = useRef<d3.ZoomTransform>(d3.zoomIdentity);
  const [world, setWorld] = useState<unknown>(null);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; e: SeismicEvent } | null>(null);

  useEffect(() => {
    fetch("https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json")
      .then((r) => r.json())
      .then(setWorld)
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!world || !svgRef.current) return;
    const svgEl = svgRef.current;

    function paint() {
      if (!svgEl || !world) return;
      const W = Math.max(svgEl.getBoundingClientRect().width || svgEl.clientWidth, 280);
      const H = 400;
      svgEl.setAttribute("width", String(W));
      svgEl.setAttribute("height", String(H));

      const svg = d3.select(svgEl);
      svg.selectAll("*").remove();

      const proj = d3.geoNaturalEarth1();
      proj.fitSize([W, H], { type: "Sphere" });
      const path = d3.geoPath().projection(proj);

      svg.append("rect").attr("width", W).attr("height", H).attr("fill", "#030806");
      const geoG = svg.append("g").attr("class", "seis-geo");

      const grat = d3.geoGraticule()();
      geoG
        .append("path")
        .datum(grat)
        .attr("d", path as d3.ValueFn<SVGPathElement, unknown, string>)
        .attr("fill", "none")
        .attr("stroke", "#0a1f0d")
        .attr("stroke-width", "0.3");

      // @ts-expect-error TopoJSON topology typed loosely vs GeoJSON
      const countries = topojson.feature(world, world.objects.countries);
      geoG
        .append("g")
        .selectAll("path")
        // @ts-expect-error features from topojson.feature
        .data(countries.features)
        .enter()
        .append("path")
        .attr("d", path as d3.ValueFn<SVGPathElement, unknown, string>)
        .attr("fill", "#0a160c")
        .attr("stroke", "#1a3320")
        .attr("stroke-width", "0.4");

      const markersG = geoG.append("g").attr("class", "seis-markers");
      const ranked = [...events].sort((a, b) => a.mag - b.mag);

      for (const ev of ranked) {
        const pos = proj([ev.lng, ev.lat]);
        if (!pos) continue;
        const [x, y] = pos;
        const col = magColor(ev.mag);
        const isSel = selected?.id === ev.id;
        const r = 3 + Math.min(10, ev.mag * 1.15);
        const mg = markersG
          .append("g")
          .datum({ x, y })
          .attr("class", "seis-marker")
          .attr("transform", `translate(${x},${y}) scale(1)`);

        if (ev.tsunami || ev.mag >= 6) {
          mg.append("circle")
            .attr("r", r + 6)
            .attr("fill", "none")
            .attr("stroke", ev.tsunami ? "#00d4ff" : col)
            .attr("stroke-width", 0.8)
            .attr("stroke-opacity", 0.35)
            .append("animate")
            .attr("attributeName", "stroke-opacity")
            .attr("values", "0.15;0.5;0.15")
            .attr("dur", "2.4s")
            .attr("repeatCount", "indefinite");
        }
        if (isSel) {
          mg.append("circle")
            .attr("r", r + 5)
            .attr("fill", "none")
            .attr("stroke", col)
            .attr("stroke-width", 1.2)
            .attr("stroke-opacity", 0.7);
        }
        mg.append("circle")
          .attr("r", r)
          .attr("fill", col)
          .attr("fill-opacity", isSel ? 0.95 : 0.72)
          .attr("stroke", col)
          .attr("stroke-width", isSel ? 1.6 : 0.7)
          .style("cursor", "pointer")
          .on("mouseenter", function (event) {
            setTooltip({ x: event.offsetX, y: event.offsetY, e: ev });
            d3.select(this).attr("fill-opacity", "1");
          })
          .on("mouseleave", function () {
            setTooltip(null);
            d3.select(this).attr("fill-opacity", isSel ? "0.95" : "0.72");
          })
          .on("click", () => onSelect(ev));
      }

      function applyMarkerScale(t: d3.ZoomTransform) {
        const k = t.k || 1;
        markersG
          .selectAll<SVGGElement, { x: number; y: number }>("g.seis-marker")
          .attr("transform", (d) => `translate(${d.x},${d.y}) scale(${1 / k})`);
      }

      const zoom = d3
        .zoom<SVGSVGElement, unknown>()
        .extent([
          [0, 0],
          [W, H],
        ])
        .scaleExtent([1, 12])
        .on("zoom", (event: d3.D3ZoomEvent<SVGSVGElement, unknown>) => {
          zoomTransformRef.current = event.transform;
          geoG.attr("transform", String(event.transform));
          applyMarkerScale(event.transform);
          setTooltip(null);
        });
      svg.call(zoom);
      svg.call(zoom.transform, zoomTransformRef.current);

      const ctrl = svg.append("g").attr("transform", `translate(${W - 36},10)`);
      [
        { dy: 0, label: "+", delta: 1.6 },
        { dy: 22, label: "−", delta: 1 / 1.6 },
        { dy: 44, label: "⌂", delta: null },
      ].forEach(({ dy, label, delta }) => {
        const btn = ctrl.append("g").attr("transform", `translate(0,${dy})`).style("cursor", "pointer");
        btn.append("rect").attr("width", 22).attr("height", 18).attr("rx", 2).attr("fill", "rgba(9,15,11,0.85)").attr("stroke", "#1a3320");
        btn.append("text").attr("x", 11).attr("y", 13).attr("text-anchor", "middle").attr("fill", "#5a8068").attr("font-size", "12").attr("font-family", "monospace").text(label);
        btn.on("click", () => {
          if (delta === null) svg.transition().duration(400).call(zoom.transform, d3.zoomIdentity);
          else svg.transition().duration(250).call(zoom.scaleBy, delta as number);
        });
        btn.on("mouseenter", function () {
          d3.select(this).select("rect").attr("stroke", ACCENT);
          d3.select(this).select("text").attr("fill", ACCENT);
        });
        btn.on("mouseleave", function () {
          d3.select(this).select("rect").attr("stroke", "#1a3320");
          d3.select(this).select("text").attr("fill", "#5a8068");
        });
      });
    }

    paint();
    const ro = new ResizeObserver(() => paint());
    ro.observe(svgEl);
    return () => ro.disconnect();
  }, [world, events, selected, onSelect]);

  return (
    <div style={{ position: "relative" }}>
      <svg
        ref={svgRef}
        style={{
          width: "100%",
          height: 400,
          maxWidth: "100%",
          background: "#030806",
          borderRadius: 4,
          border: "1px solid #1a3320",
          display: "block",
        }}
      />
      {tooltip ? (
        <div
          style={{
            position: "absolute",
            left: tooltip.x + 12,
            top: Math.max(4, tooltip.y - 10),
            background: "#090f0b",
            border: `1px solid ${magColor(tooltip.e.mag)}`,
            borderRadius: 3,
            padding: "8px 10px",
            pointerEvents: "none",
            zIndex: 20,
            maxWidth: 260,
          }}
        >
          <div style={{ fontFamily: RAJ, fontSize: 13, fontWeight: 700, color: magColor(tooltip.e.mag) }}>
            M{tooltip.e.mag.toFixed(1)} · {magBand(tooltip.e.mag)}
          </div>
          <div style={{ fontSize: 11, color: "#c8e8d0", marginTop: 3, lineHeight: 1.4 }}>{tooltip.e.place}</div>
          <div style={{ fontSize: 9, color: "#5a8068", marginTop: 4 }}>{seismicTimeAgo(tooltip.e.time)}</div>
        </div>
      ) : null}
    </div>
  );
}

function EventCard({
  ev,
  selected,
  onClick,
}: {
  ev: SeismicEvent;
  selected: boolean;
  onClick: () => void;
}) {
  const col = magColor(ev.mag);
  return (
    <button
      type="button"
      id={`seis-card-${ev.id}`}
      onClick={onClick}
      style={{
        display: "block",
        width: "100%",
        textAlign: "left",
        background: selected ? "rgba(255,136,68,0.06)" : "#090f0b",
        border: `1px solid ${selected ? col : "#1a3320"}`,
        borderRadius: 4,
        padding: "12px 14px",
        cursor: "pointer",
        fontFamily: FONT,
      }}
    >
      <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
        <div
          style={{
            fontFamily: RAJ,
            fontSize: 20,
            fontWeight: 700,
            color: col,
            minWidth: 58,
            lineHeight: 1,
          }}
        >
          {ev.mag.toFixed(1)}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: RAJ, fontSize: 13, fontWeight: 700, color: "#e8ffe8", lineHeight: 1.35 }}>
            {ev.place}
          </div>
          <div style={{ fontSize: 10, color: "#5a8068", marginTop: 5, letterSpacing: 0.6 }}>
            {seismicTimeAgo(ev.time)}
            {ev.depthKm != null ? ` · ${ev.depthKm.toFixed(0)} km depth` : ""}
            {` · ${ev.sources.join(" + ").toUpperCase()}`}
          </div>
          <div style={{ display: "flex", gap: 6, marginTop: 7, flexWrap: "wrap" }}>
            <span style={{ fontSize: 9, color: col, border: `1px solid ${col}`, padding: "1px 6px", borderRadius: 2, letterSpacing: 1 }}>
              {magBand(ev.mag)}
            </span>
            {ev.tsunami ? (
              <span style={{ fontSize: 9, color: "#00d4ff", border: "1px solid #00d4ff", padding: "1px 6px", borderRadius: 2, letterSpacing: 1 }}>
                TSUNAMI FLAG
              </span>
            ) : null}
            {ev.significant ? (
              <span style={{ fontSize: 9, color: "#ffaa00", border: "1px solid #ffaa00", padding: "1px 6px", borderRadius: 2, letterSpacing: 1 }}>
                SIGNIFICANT
              </span>
            ) : null}
            {ev.pager ? (
              <span style={{ fontSize: 9, color: "#c8e8d0", border: "1px solid #1a3320", padding: "1px 6px", borderRadius: 2, letterSpacing: 1 }}>
                PAGER {ev.pager.toUpperCase()}
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </button>
  );
}

export default function SeismicTracker() {
  const [data, setData] = useState<SeismicPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<SeismicEvent | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [mapOpen, setMapOpen] = useState(false);
  const mapVisible = useMapBodyVisible(mapOpen);

  const selectEvent = useCallback((ev: SeismicEvent) => {
    setSelected(ev);
    if (isMobileViewport()) setMapOpen(true);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/seismic", { cache: "no-store" });
        const json = (await res.json()) as SeismicPayload & { error?: string };
        if (cancelled) return;
        if (!res.ok || !Array.isArray(json.events)) {
          setError(json.error ?? "Could not load seismic feeds.");
          return;
        }
        setData(json);
        if (json.events.length) setSelected(json.events[0]);
      } catch {
        if (!cancelled) setError("Network error while loading seismic feeds.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const visible = useMemo(() => {
    const all = data?.events ?? [];
    const day = Date.now() - 24 * 3600_000;
    return all.filter((e) => {
      if (filter === "m45") return e.mag >= 4.5;
      if (filter === "m5") return e.mag >= 5;
      if (filter === "m6") return e.mag >= 6;
      if (filter === "significant") return e.significant;
      if (filter === "tsunami") return e.tsunami;
      if (filter === "24h") return new Date(e.time).getTime() >= day;
      return true;
    });
  }, [data, filter]);

  const mapEvents = useMemo(() => {
    if (selected && !visible.some((e) => e.id === selected.id)) return [...visible, selected];
    return visible;
  }, [visible, selected]);

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: "#050c07", color: "#3a5040", fontFamily: FONT, display: "flex", alignItems: "center", justifyContent: "center", letterSpacing: 3 }}>
        LOADING SEISMIC FEEDS…
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#050c07", color: "#c8e8d0", fontFamily: FONT }}>
      <div className="scanline" />
      <div style={{ position: "relative", zIndex: 1 }}>
        <div className="intel-page-nav" style={{ height: 44, background: "#050c07", borderBottom: "1px solid #1a3320", display: "flex", alignItems: "center", padding: "0 16px", gap: 12 }}>
          <div className="intel-page-nav-start" style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
            <Link href="/" style={{ fontSize: 10, color: "#5a8068", textDecoration: "none", letterSpacing: 2, border: "1px solid #1a3320", padding: "4px 10px", borderRadius: 3 }}>
              ← FEED
            </Link>
          </div>
          <div className="intel-page-nav-divider" style={{ width: 1, height: 20, background: "#1a3320", flexShrink: 0 }} />
          <Link href="/" className="intel-page-nav-brand" style={{ fontFamily: RAJ, fontSize: 14, fontWeight: 700, color: "#00ff88", letterSpacing: 2, textDecoration: "none", flexShrink: 0 }}>
            THE THEORIST
          </Link>
          <div className="intel-page-nav-divider" style={{ width: 1, height: 20, background: "#1a3320", flexShrink: 0 }} />
          <div className="intel-page-nav-section" style={{ fontFamily: RAJ, fontSize: 11, color: "#5a8068", letterSpacing: 2, flexShrink: 0 }}>
            SEISMIC MONITOR
          </div>
          <div className="intel-page-nav-menu" style={{ marginLeft: "auto", flexShrink: 0 }}>
            <SiteNav />
          </div>
          <div className="intel-page-nav-meta" style={{ fontSize: 10, color: "#3a5040", letterSpacing: 1 }}>
            USGS · EMSC{data ? ` · ${new Date(data.generated_at).toLocaleTimeString()}` : ""}
          </div>
        </div>

        <div style={pageContentShellStyle()}>
          <div style={{ marginBottom: "1.25rem", paddingBottom: "1rem", borderBottom: "1px solid #1a3320" }}>
            <div className="page-hero-kicker" style={{ fontFamily: RAJ, fontSize: 11, letterSpacing: 5, color: "#5a8068", marginBottom: 5, textTransform: "uppercase" }}>
              ■ LIVE GLOBAL EARTHQUAKE SURVEILLANCE ■
            </div>
            <h1 className="page-hero-title" style={{ fontFamily: RAJ, fontSize: 26, fontWeight: 700, color: ACCENT, letterSpacing: 2, textTransform: "uppercase", margin: "0 0 4px" }}>
              Seismic Monitor
            </h1>
            <div className="page-hero-tagline" style={{ fontSize: 11, color: "#3a5040", letterSpacing: 2 }}>
              USGS GEOJSON · EMSC FDSN · MAGNITUDE · DEPTH · TSUNAMI FLAG · PAGER
            </div>
          </div>

          {error ? (
            <div style={{ border: "1px solid #ff3333", color: "#ff8888", padding: "12px 14px", borderRadius: 4, marginBottom: "1rem", fontSize: 12 }}>
              {error}
            </div>
          ) : null}

          {data ? (
            <div className="intel-stat-row" style={{ display: "flex", gap: 10, marginBottom: "1.25rem", flexWrap: "wrap" }}>
              {[
                { label: "EVENTS IN VIEW", value: data.stats.total, col: ACCENT },
                { label: "LAST 24H", value: data.stats.last24h, col: "#00ff88" },
                { label: "M5+", value: data.stats.m5, col: "#ff6633" },
                { label: "M6+", value: data.stats.m6, col: "#ff3333" },
                { label: "TSUNAMI FLAGS", value: data.stats.tsunami, col: "#00d4ff" },
              ].map(({ label, value, col }) => (
                <div key={label} style={{ border: "1px solid #1a3320", borderRadius: 3, padding: "8px 14px", background: "#090f0b" }}>
                  <div className="intel-stat-label" style={{ fontSize: 9, color: "#3a5040", letterSpacing: 2, marginBottom: 3 }}>
                    {label}
                  </div>
                  <div className="intel-stat-value" style={{ fontFamily: RAJ, fontSize: 22, fontWeight: 700, color: col, lineHeight: 1 }}>
                    {value}
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          <div style={{ display: "flex", gap: 6, marginBottom: "1rem", flexWrap: "wrap" }}>
            {(
              [
                ["all", "ALL"],
                ["24h", "24H"],
                ["m45", "M4.5+"],
                ["m5", "M5+"],
                ["m6", "M6+"],
                ["significant", "SIGNIFICANT"],
                ["tsunami", "TSUNAMI"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setFilter(key)}
                style={{
                  fontFamily: RAJ,
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: 1,
                  textTransform: "uppercase",
                  padding: "6px 12px",
                  borderRadius: 2,
                  cursor: "pointer",
                  border: `1px solid ${filter === key ? ACCENT : "#1a3320"}`,
                  background: filter === key ? "rgba(255,136,68,0.08)" : "transparent",
                  color: filter === key ? ACCENT : "#5a8068",
                }}
              >
                {label}
              </button>
            ))}
            <button
              type="button"
              className="mobile-only"
              onClick={() => setMapOpen((o) => !o)}
              style={{
                display: "none",
                marginLeft: "auto",
                fontFamily: RAJ,
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: 1,
                padding: "6px 12px",
                border: "1px solid #1a3320",
                background: "transparent",
                color: "#7aaa8a",
                cursor: "pointer",
              }}
            >
              {mapOpen ? "HIDE MAP" : "SHOW MAP"}
            </button>
          </div>

          {data ? (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: "1rem" }}>
              {data.feeds.map((f) => (
                <span
                  key={f.id}
                  style={{
                    fontSize: 9,
                    letterSpacing: 1,
                    padding: "3px 8px",
                    borderRadius: 2,
                    border: `1px solid ${f.ok ? "#1a3320" : "#ff3333"}`,
                    color: f.ok ? "#5a8068" : "#ff8888",
                  }}
                >
                  {f.ok ? "●" : "○"} {f.label} · {f.count}
                </span>
              ))}
            </div>
          ) : null}

          <div
            style={{
              display: "grid",
              gridTemplateColumns: mapVisible ? "minmax(0, 1fr) minmax(280px, 360px)" : "1fr",
              gap: "1.25rem",
              alignItems: "start",
            }}
            className="seis-grid"
          >
            {mapVisible ? (
              <div>
                <SeismicMap events={mapEvents} selected={selected} onSelect={selectEvent} />
                <p style={{ fontSize: 10, color: "#3a5040", marginTop: 8, lineHeight: 1.6 }}>
                  Official USGS and EMSC catalogs — not a detection network. Marker size tracks magnitude. Cyan ring = tsunami flag on the USGS event.
                </p>
              </div>
            ) : null}

            <div style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 0 }}>
              {selected ? (
                <div style={{ border: `1px solid ${magColor(selected.mag)}`, borderRadius: 4, padding: "14px 16px", background: "#090f0b", marginBottom: 4 }}>
                  <div style={{ fontFamily: RAJ, fontSize: 22, fontWeight: 700, color: magColor(selected.mag) }}>
                    M{selected.mag.toFixed(1)} {selected.magType}
                  </div>
                  <div style={{ fontFamily: RAJ, fontSize: 15, fontWeight: 700, color: "#e8ffe8", marginTop: 6, lineHeight: 1.35 }}>
                    {selected.place}
                  </div>
                  <div style={{ fontSize: 11, color: "#7aaa8a", marginTop: 8, lineHeight: 1.7 }}>
                    {new Date(selected.time).toUTCString()}
                    <br />
                    {selected.lat.toFixed(3)}°, {selected.lng.toFixed(3)}°
                    {selected.depthKm != null ? ` · ${selected.depthKm.toFixed(1)} km depth` : ""}
                    {selected.felt != null ? ` · ${selected.felt} felt reports` : ""}
                  </div>
                  <a
                    href={selected.url}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      display: "inline-block",
                      marginTop: 12,
                      fontFamily: RAJ,
                      fontSize: 11,
                      fontWeight: 700,
                      letterSpacing: 2,
                      color: ACCENT,
                      textDecoration: "none",
                      border: `1px solid ${ACCENT}`,
                      padding: "6px 12px",
                      borderRadius: 3,
                    }}
                  >
                    SOURCE RECORD ↗
                  </a>
                </div>
              ) : null}

              {visible.length === 0 ? (
                <div style={{ fontSize: 12, color: "#5a8068", padding: "16px 8px" }}>No events match this filter.</div>
              ) : (
                visible.slice(0, 80).map((ev) => (
                  <EventCard
                    key={ev.id}
                    ev={ev}
                    selected={selected?.id === ev.id}
                    onClick={() => selectEvent(ev)}
                  />
                ))
              )}
            </div>
          </div>
        </div>
      </div>
      <style>{`
        @media (max-width: 768px) {
          .seis-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}
