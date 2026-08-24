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

function regionOf(place: string): string {
  const parts = place.split(",").map((s) => s.trim()).filter(Boolean);
  return (parts[parts.length - 1] || "Unknown").toUpperCase();
}

function groupByRegion(events: SeismicEvent[]): Array<{ region: string; events: SeismicEvent[] }> {
  const map = new Map<string, SeismicEvent[]>();
  for (const ev of events) {
    const key = regionOf(ev.place);
    const list = map.get(key) ?? [];
    list.push(ev);
    map.set(key, list);
  }
  return [...map.entries()]
    .map(([region, list]) => ({
      region,
      events: [...list].sort((a, b) => b.mag - a.mag || new Date(b.time).getTime() - new Date(a.time).getTime()),
    }))
    .sort((a, b) => b.events[0].mag - a.events[0].mag || b.events.length - a.events.length);
}

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

function EventRow({
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
      onClick={onClick}
      style={{
        display: "flex",
        width: "100%",
        gap: 8,
        alignItems: "center",
        textAlign: "left",
        background: selected ? "rgba(255,136,68,0.1)" : "transparent",
        border: "none",
        borderBottom: "1px solid #0d1a10",
        padding: "8px 4px",
        cursor: "pointer",
        fontFamily: FONT,
      }}
    >
      <span style={{ fontFamily: RAJ, fontSize: 15, fontWeight: 700, color: col, minWidth: 36 }}>
        {ev.mag.toFixed(1)}
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: "block", fontSize: 11, color: selected ? "#e8ffe8" : "#c8e8d0", lineHeight: 1.3 }}>
          {ev.place}
        </span>
        <span style={{ fontSize: 9, color: "#5a8068" }}>
          {seismicTimeAgo(ev.time)}
          {ev.depthKm != null ? ` · ${ev.depthKm.toFixed(0)} km` : ""}
        </span>
      </span>
    </button>
  );
}

function RegionFold({
  region,
  events,
  selectedId,
  onSelect,
}: {
  region: string;
  events: SeismicEvent[];
  selectedId: string | null;
  onSelect: (ev: SeismicEvent) => void;
}) {
  const PREVIEW = 8;
  const containsSelected = events.some((e) => e.id === selectedId);
  const [open, setOpen] = useState(containsSelected);
  const [showAll, setShowAll] = useState(false);
  const topMag = events[0]?.mag ?? 0;
  const listed = showAll || events.length <= PREVIEW ? events : events.slice(0, PREVIEW);

  useEffect(() => {
    if (!containsSelected) return;
    setOpen(true);
    const idx = events.findIndex((e) => e.id === selectedId);
    if (idx >= PREVIEW) setShowAll(true);
  }, [containsSelected, selectedId, events]);

  return (
    <div style={{ border: `1px solid ${containsSelected ? magColor(topMag) : "#1a3320"}`, borderRadius: 4, overflow: "hidden", background: "#090f0b" }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "9px 11px",
          background: open ? "rgba(0,0,0,0.25)" : "transparent",
          border: "none",
          cursor: "pointer",
          textAlign: "left",
          fontFamily: FONT,
        }}
      >
        <span style={{ color: magColor(topMag), fontSize: 12, flexShrink: 0, width: 14 }}>{open ? "▾" : "▸"}</span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span
            style={{
              display: "block",
              fontFamily: RAJ,
              fontSize: 11,
              fontWeight: 700,
              color: magColor(topMag),
              letterSpacing: 1.5,
              textTransform: "uppercase",
            }}
          >
            {region}
          </span>
          {!open ? (
            <span style={{ display: "block", fontSize: 9, color: "#3a5040", marginTop: 2 }}>
              M{topMag.toFixed(1)} top · {events.length === 1 ? "1 event" : `${events.length} events`}
            </span>
          ) : null}
        </span>
        <span style={{ fontFamily: RAJ, fontSize: 12, fontWeight: 700, color: magColor(topMag), flexShrink: 0 }}>
          {events.length}
        </span>
      </button>
      {open ? (
        <div>
          {listed.map((ev) => (
            <EventRow key={ev.id} ev={ev} selected={ev.id === selectedId} onClick={() => onSelect(ev)} />
          ))}
          {events.length > PREVIEW && !showAll ? (
            <button
              type="button"
              onClick={() => setShowAll(true)}
              style={{
                width: "100%",
                background: "transparent",
                border: "none",
                borderTop: "1px solid #0d1a10",
                padding: "8px 4px",
                cursor: "pointer",
                fontFamily: RAJ,
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: 1.5,
                color: "#5a8068",
              }}
            >
              SHOW ALL {events.length}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export default function SeismicTracker() {
  const [data, setData] = useState<SeismicPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<SeismicEvent | null>(null);
  const [filter, setFilter] = useState<Filter>("24h");
  const [query, setQuery] = useState("");
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
        const day = Date.now() - 24 * 3600_000;
        const recent = json.events.filter((e) => new Date(e.time).getTime() >= day);
        const pick = recent.find((e) => e.mag >= 5) ?? recent[0] ?? json.events[0] ?? null;
        if (pick) setSelected(pick);
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
    const q = query.trim().toLowerCase();
    return all.filter((e) => {
      if (filter === "m45" && e.mag < 4.5) return false;
      if (filter === "m5" && e.mag < 5) return false;
      if (filter === "m6" && e.mag < 6) return false;
      if (filter === "significant" && !e.significant) return false;
      if (filter === "tsunami" && !e.tsunami) return false;
      if (filter === "24h" && new Date(e.time).getTime() < day) return false;
      if (q && !e.place.toLowerCase().includes(q) && !e.title.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [data, filter, query]);

  const groups = useMemo(() => groupByRegion(visible), [visible]);

  useEffect(() => {
    if (!visible.length) return;
    if (selected && visible.some((e) => e.id === selected.id)) return;
    setSelected(visible[0]);
  }, [visible, selected]);

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
                { label: "EVENTS IN VIEW", value: visible.length, col: ACCENT },
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

          <div style={{ display: "flex", gap: 6, marginBottom: "0.75rem", flexWrap: "wrap", alignItems: "center" }}>
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

          <div style={{ display: "flex", gap: 8, marginBottom: "1rem", flexWrap: "wrap", alignItems: "center" }}>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter by place — Japan, Chile…"
              style={{
                flex: "1 1 220px",
                minWidth: 180,
                background: "#090f0b",
                border: "1px solid #1a3320",
                borderRadius: 3,
                color: "#c8e8d0",
                fontFamily: FONT,
                fontSize: 12,
                padding: "8px 10px",
                outline: "none",
              }}
            />
            <select
              value={selected?.id ?? ""}
              onChange={(e) => {
                const hit = visible.find((ev) => ev.id === e.target.value);
                if (hit) selectEvent(hit);
              }}
              style={{
                flex: "1 1 260px",
                minWidth: 200,
                background: "#090f0b",
                border: `1px solid ${ACCENT}66`,
                borderRadius: 3,
                color: "#c8e8d0",
                fontFamily: FONT,
                fontSize: 12,
                padding: "8px 10px",
              }}
            >
              <option value="">Jump to event…</option>
              {groups.map((g) => (
                <optgroup key={g.region} label={`${g.region} (${g.events.length})`}>
                  {g.events.map((ev) => (
                    <option key={ev.id} value={ev.id}>
                      M{ev.mag.toFixed(1)} · {ev.place} · {seismicTimeAgo(ev.time)}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
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
                <div style={{ border: `1px solid ${magColor(selected.mag)}`, borderRadius: 4, padding: "14px 16px", background: "#090f0b" }}>
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

              <div style={{ fontFamily: RAJ, fontSize: 10, fontWeight: 700, letterSpacing: 2, color: "#5a8068" }}>
                {visible.length} MATCHES · {groups.length} REGIONS
              </div>

              {visible.length === 0 ? (
                <div style={{ fontSize: 12, color: "#5a8068", padding: "16px 8px" }}>No events match this filter.</div>
              ) : (
                <div style={{ maxHeight: 520, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6, paddingRight: 2 }}>
                  {groups.map((g) => (
                    <RegionFold
                      key={g.region}
                      region={g.region}
                      events={g.events}
                      selectedId={selected?.id ?? null}
                      onSelect={selectEvent}
                    />
                  ))}
                </div>
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
