"use client";

import { startTransition, useCallback, useEffect, useRef, useState } from "react";
import PolymarketWidget from "@/components/PolymarketWidget";
import SiteNav from "@/components/SiteNav";
import Link from "next/link";
import * as d3 from "d3";
import * as topojson from "topojson-client";
import { pageContentShellStyle } from "@/lib/pageShell";
import { cleanOutbreakBlurb } from "@/lib/plainText";
import { CollapsibleSection, IntelExpandBar, IntelSectionChips } from "@/components/IntelAccordion";
import { sortByPubDateDesc, sortByPublishedAtDesc } from "@/lib/sortByPubDate";

const FONT = "var(--font-share-tech-mono), monospace";
const RAJ  = "var(--font-raj), sans-serif";

function isMobileViewport(): boolean {
  return typeof window !== "undefined" && window.innerWidth <= 768;
}

const COUNTRY_FLAGS: Record<string, string> = {
  "drc": "🇨🇩", "congo": "🇨🇬", "united states": "🇺🇸", "usa": "🇺🇸",
  "china": "🇨🇳", "india": "🇮🇳", "brazil": "🇧🇷", "russia": "🇷🇺",
  "kenya": "🇰🇪", "uganda": "🇺🇬", "rwanda": "🇷🇼", "ethiopia": "🇪🇹",
  "nigeria": "🇳🇬", "somalia": "🇸🇴", "sudan": "🇸🇩", "chad": "🇹🇩",
  "tanzania": "🇹🇿", "ghana": "🇬🇭", "guinea": "🇬🇳",
  "sierra leone": "🇸🇱", "liberia": "🇱🇷",
  "pakistan": "🇵🇰", "indonesia": "🇮🇩", "philippines": "🇵🇭",
  "cambodia": "🇰🇭", "myanmar": "🇲🇲", "bangladesh": "🇧🇩",
  "ukraine": "🇺🇦", "iran": "🇮🇷", "egypt": "🇪🇬",
  "south africa": "🇿🇦", "mexico": "🇲🇽", "colombia": "🇨🇴",
  "peru": "🇵🇪", "argentina": "🇦🇷", "chile": "🇨🇱",
  "bolivia": "🇧🇴", "venezuela": "🇻🇪", "panama": "🇵🇦",
  "costa rica": "🇨🇷", "nicaragua": "🇳🇮", "kazakhstan": "🇰🇿",
  "global": "🌍",
};

function countryFlag(country: string): string {
  const c = (country ?? "").toLowerCase().trim();
  for (const [k, v] of Object.entries(COUNTRY_FLAGS)) {
    if (c === k || c.includes(k)) return v;
  }
  return "🌐";
}

function countryLabel(country: string): string {
  if (!country) return "";
  return country
    .split(" ")
    .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : ""))
    .join(" ");
}

const ARROW_IDS: Array<[string, string]> = [
  ["ob-arrow-ff3333", "#ff3333"],
  ["ob-arrow-ff6633", "#ff6633"],
  ["ob-arrow-ffaa00", "#ffaa00"],
  ["ob-arrow-00bb66", "#00bb66"],
];

function arrowMarkerId(col: string): string {
  const map: Record<string, string> = {
    "#ff3333": "ob-arrow-ff3333",
    "#ff6633": "ob-arrow-ff6633",
    "#ffaa00": "ob-arrow-ffaa00",
    "#00bb66": "ob-arrow-00bb66",
  };
  return map[col] ?? "ob-arrow-00bb66";
}

type Theory   = { name:string; summary:string; probability:number; sources:string[] };
type Patent   = { number:string; title:string; assignee:string; url:string };
type LocalNews= { title:string; url:string; source:string; pubDate:string; country?:string };
type AffectedCoord = { country:string; lat:number; lng:number };
type Outbreak = {
  id:string; title:string; description:string; source_url:string; published_at:string;
  disease:string; location:string; origin_country:string; affected_countries?:string[];
  lat:number; lng:number; affectedCoords?:AffectedCoord[];
  conspiracy_score:number; has_conspiracy:boolean;
  theories:Theory[]; patents:Patent[]; key_facts:string[];
  verdict:string; risk_level:string;
  localNews?: LocalNews[];
  merged_count?: number;
};

function outbreakOrigin(o: Outbreak): string {
  return (o.origin_country || o.location || "").toLowerCase();
}

type ObMapTooltip = {
  x: number;
  y: number;
  o: Outbreak;
  country: string;
  isOrigin: boolean;
};

/** Queued for D3 paint: lines drawn first, then all markers on top. */
type ObMapMarkerDraw = {
  o: Outbreak;
  x: number;
  y: number;
  isPrimary: boolean;
  country: string;
  isOrigin: boolean;
  dotR: number;
  col: string;
  isSel: boolean;
};

type SpreadMarkerSlot = {
  x: number;
  y: number;
  country: string;
  isOrigin: boolean;
};

const RISK_COL = (risk:string, score:number) => {
  if (risk==="CRITICAL" || score>=70) return "#ff3333";
  if (risk==="HIGH"     || score>=45) return "#ff6633";
  if (risk==="MEDIUM"   || score>=25) return "#ffaa00";
  return "#00bb66";
};
const VERDICT_STYLE = (v:string) => {
  if (v==="HIGHLY_SUSPICIOUS") return {bg:"rgba(255,51,51,0.15)",col:"#ff3333",border:"rgba(255,51,51,0.4)"};
  if (v==="SUSPICIOUS")        return {bg:"rgba(255,170,0,0.12)",col:"#ffaa00",border:"rgba(255,170,0,0.4)"};
  if (v==="NATURAL")           return {bg:"rgba(0,187,102,0.1)", col:"#00bb66",border:"rgba(0,187,102,0.3)"};
  return {bg:"rgba(90,128,104,0.1)",col:"#5a8068",border:"#1a3320"};
};

// ── LOADING SCREEN ─────────────────────────────────────────────
const OUTBREAK_LOADING_LOGS = [
  {text:"CONNECTING TO WHO DISEASE OUTBREAK DATABASE...", col:"#00ff88"},
  {text:"> Fetching live outbreak reports...",            col:"#7aaa8a"},
  {text:"> Scanning curated disease watchlist...",        col:"#7aaa8a"},
  {text:"> Hantavirus · H5N1 · Mpox · Marburg · Cholera...", col:"#ffaa00"},
  {text:"> Cross-referencing Google News local feeds...", col:"#7aaa8a"},
  {text:"> USPTO biotech patent corpus — scanning...",    col:"#7aaa8a"},
  {text:"> [CLASSIFIED BIOWEAPON SIGNAL] ██████████",    col:"#ff3333"},
  {text:"> Conspiracy pattern analysis running...",       col:"#ffaa00"},
  {text:"> Building global outbreak map...",              col:"#00ff88"},
];

function OutbreakLoadingScreen() {
  const [logIdx, setLogIdx] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [scanAngle, setScanAngle] = useState(0);
  const startRef = useRef(0);

  useEffect(() => {
    startRef.current = Date.now();
    const iv = setInterval(() => setElapsed(Math.floor((Date.now()-startRef.current)/1000)), 500);
    return () => clearInterval(iv);
  }, []);
  useEffect(() => {
    OUTBREAK_LOADING_LOGS.forEach((_,i) => setTimeout(() => setLogIdx(p => Math.max(p,i)), i*700));
  }, []);
  useEffect(() => {
    const iv = setInterval(() => setScanAngle(a => (a+1.8)%360), 16);
    return () => clearInterval(iv);
  }, []);

  const rad = (d:number) => d*Math.PI/180;

  return (
    <div style={{minHeight:"100vh",background:"#030806",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:FONT}}>
      <style>{`
        @keyframes ob-dash{to{stroke-dashoffset:-20}}
        @keyframes ob-glow{0%,100%{opacity:0.5}50%{opacity:1}}
        @keyframes ob-blink{0%,100%{opacity:1}50%{opacity:0}}
        @keyframes ob-fadein{from{opacity:0;transform:translateY(5px)}to{opacity:1;transform:translateY(0)}}
        .ob-blink{animation:ob-blink 0.9s step-end infinite}
        .ob-log{animation:ob-fadein 0.3s ease forwards}
      `}</style>

      <div
        className="ob-load-shell"
        style={{
          maxWidth: 1520,
          width: "100%",
          padding: "0 clamp(1rem, 3vw, 2rem)",
          display: "grid",
          gridTemplateColumns: "minmax(0, 400px) minmax(240px, 280px)",
          gap: "clamp(1.5rem, 4vw, 2.5rem)",
          alignItems: "center",
          justifyContent: "center",
          justifyItems: "center",
        }}
      >
        {/* LEFT: terminal — fixed max width (same idea as Oracle / AnimatedLoader), not 1fr full-bleed */}
        <div style={{ width: "100%", maxWidth: 400, justifySelf: "end" }}>
          <div style={{fontFamily:RAJ,fontSize:10,fontWeight:700,color:"#1a4a2a",letterSpacing:5,marginBottom:6,textTransform:"uppercase"}}>■ GLOBAL DISEASE SURVEILLANCE ■</div>
          <div style={{fontFamily:RAJ,fontSize:26,fontWeight:700,color:"#00ff88",letterSpacing:2,textShadow:"0 0 18px rgba(0,255,136,0.3)",marginBottom:2}}>OUTBREAK TRACKER</div>
          <div style={{fontFamily:RAJ,fontSize:11,color:"#5a8068",letterSpacing:3,marginBottom:"1.25rem"}}>INITIALIZING INTELLIGENCE ENGINE</div>

          <div
            style={{
              background: "rgba(5,12,7,0.8)",
              border: "1px solid #1a3320",
              borderRadius: 4,
              padding: "12px 14px",
              width: "100%",
              boxSizing: "border-box",
            }}
          >
            <div style={{fontSize:9,color:"#1a4a2a",letterSpacing:3,marginBottom:8}}>SYSTEM LOG — {new Date().toISOString().split("T")[0]}</div>
            {OUTBREAK_LOADING_LOGS.slice(0,logIdx+1).map((l,i) => (
              <div key={i} className="ob-log" style={{fontSize:11,color:l.col,lineHeight:1.65,letterSpacing:0.5}}>{l.text}</div>
            ))}
            {logIdx < OUTBREAK_LOADING_LOGS.length-1 && <span style={{fontSize:11,color:"#7aaa8a"}}><span className="ob-blink" style={{color:"#00ff88"}}>▌</span></span>}
            <div
              style={{
                marginTop: 12,
                paddingTop: 10,
                borderTop: "1px solid #0d1f12",
                display: "flex",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: "6px 10px",
                fontSize: 9,
                color: "#2a4a30",
                letterSpacing: 1,
              }}
            >
              <span>ELAPSED: {elapsed}s</span>
              <span>WHO · CDC · GNEWS</span>
              <span className="ob-blink" style={{ color: "#00bb66" }}>
                ● LIVE
              </span>
            </div>
          </div>
        </div>

        {/* RIGHT: animated radar */}
        <div className="ob-load-radar-wrap" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14, justifySelf: "start" }}>
          <svg width="260" height="260" viewBox="0 0 320 320">
            <defs>
              <radialGradient id="obGrad" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#00ff88" stopOpacity="0.12"/>
                <stop offset="100%" stopColor="#00ff88" stopOpacity="0"/>
              </radialGradient>
            </defs>
            {[40,80,120,150].map(r => (
              <circle key={r} cx="160" cy="160" r={r} fill="none" stroke="#0d2818" strokeWidth="0.8" strokeDasharray={r%80===0?"none":"4 8"}/>
            ))}
            <g style={{transformOrigin:"160px 160px",transform:`rotate(${scanAngle}deg)`}}>
              <line x1="160" y1="160" x2="160" y2="10" stroke="#00ff88" strokeWidth="1.5" strokeOpacity="0.7"/>
              {[0,10,25,45].map(o => (
                <line key={o} x1="160" y1="160"
                  x2={160+150*Math.sin(rad(-o))} y2={160-150*Math.cos(rad(-o))}
                  stroke="#00ff88" strokeWidth="1" strokeOpacity={0.15-o*0.003}/>
              ))}
              <path d="M160,160 L160,10" stroke="url(#obGrad)" strokeWidth="50" strokeOpacity="0.12"/>
            </g>
            <line x1="160" y1="0" x2="160" y2="320" stroke="#0d2818" strokeWidth="0.5"/>
            <line x1="0" y1="160" x2="320" y2="160" stroke="#0d2818" strokeWidth="0.5"/>
            {/* Disease dots appearing */}
            {[[120,80,"#ff3333"],[200,140,"#ffaa00"],[100,200,"#ff6633"],[240,100,"#ffaa00"],[160,240,"#ff3333"],[80,150,"#00bb66"]].slice(0,Math.floor(logIdx/1.5)).map(([x,y,col],i) => (
              <g key={i}>
                <circle cx={x as number} cy={y as number} r={9} fill={col as string} fillOpacity="0.06" stroke={col as string} strokeOpacity="0.2" strokeWidth="0.6">
                  <animate attributeName="stroke-opacity" values="0.12;0.35;0.12" dur={`${2.4 + i * 0.15}s`} repeatCount="indefinite" />
                </circle>
                <circle cx={x as number} cy={y as number} r={5} fill={col as string} fillOpacity="0.72" stroke={col as string} strokeWidth="0.5" strokeOpacity="0.35"/>
              </g>
            ))}
            <text x="160" y="168" textAnchor="middle" fill="#00ff88" opacity="0.4" style={{fontFamily:FONT,fontSize:9,letterSpacing:2}}>SCANNING</text>
          </svg>

          <div className="ob-load-legend" style={{display:"flex",gap:12,fontSize:9,color:"#3a5040",letterSpacing:1}}>
            {[["#ff3333","CRITICAL"],["#ff6633","HIGH"],["#ffaa00","MEDIUM"],["#00bb66","LOW"]].map(([col,label]) => (
              <span key={label} style={{display:"flex",alignItems:"center",gap:4}}>
                <span style={{width:7,height:7,borderRadius:"50%",background:col,display:"inline-block"}}/>
                {label}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── WORLD MAP ──────────────────────────────────────────────────
type ObMapCtx = {
  svg: d3.Selection<SVGSVGElement, unknown, null, undefined>;
  geoG: d3.Selection<SVGGElement, unknown, null, undefined>;
  linesG: d3.Selection<SVGGElement, unknown, null, undefined>;
  markersG: d3.Selection<SVGGElement, unknown, null, undefined>;
  proj: d3.GeoProjection;
  W: number;
  H: number;
  zoom: d3.ZoomBehavior<SVGSVGElement, unknown>;
};

type ObMarkerDatum = ObMapMarkerDraw & { x: number; y: number };

function pulseHalo(parent: d3.Selection<SVGGElement, unknown, null, undefined>, ringR: number, stroke: string) {
  parent
    .append("circle")
    .attr("r", ringR)
    .attr("cx", 0)
    .attr("cy", 0)
    .attr("fill", "none")
    .attr("stroke", stroke)
    .attr("stroke-width", 0.75)
    .attr("stroke-opacity", 0.18)
    .append("animate")
    .attr("attributeName", "stroke-opacity")
    .attr("values", "0.08;0.28;0.08")
    .attr("dur", "2.4s")
    .attr("repeatCount", "indefinite");
}

const COORD_EPS = 0.15;

function isSameGeo(aLat: number, aLng: number, bLat: number, bLng: number): boolean {
  return Math.abs(aLat - bLat) < COORD_EPS && Math.abs(aLng - bLng) < COORD_EPS;
}

/** Origin + unique affected-country screen positions for spread lines. */
function collectSpreadMarkerSlots(
  o: Outbreak,
  proj: d3.GeoProjection,
): SpreadMarkerSlot[] {
  const lat = Number(o.lat);
  const lng = Number(o.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return [];

  const mainPos = proj([lng, lat]);
  if (!mainPos) return [];

  const origin = outbreakOrigin(o);
  const slots: SpreadMarkerSlot[] = [
    { x: mainPos[0], y: mainPos[1], country: origin, isOrigin: true },
  ];

  for (const ac of o.affectedCoords ?? []) {
    if (isSameGeo(ac.lat, lat, ac.lng, lng)) continue;
    const ap = proj([ac.lng, ac.lat]);
    if (!ap) continue;
    const country = (ac.country || "").toLowerCase();
    const dup = slots.some((s) => Math.hypot(s.x - ap[0], s.y - ap[1]) < 6);
    if (!dup) slots.push({ x: ap[0], y: ap[1], country, isOrigin: false });
  }
  return slots;
}

function obLineStyle(
  outbreakId: string,
  selectedId: string | null,
): { opacity: number; width: number } {
  if (!selectedId) return { opacity: 0.4, width: 1 };
  if (outbreakId === selectedId) return { opacity: 0.88, width: 1.65 };
  return { opacity: 0, width: 0 };
}

function outbreakMapVisible(outbreakId: string, selectedId: string | null): boolean {
  if (!selectedId) return true;
  return outbreakId === selectedId;
}

function applyObMarkerStyles(
  g: d3.Selection<SVGGElement, ObMarkerDatum, SVGGElement, unknown>,
  selectedId: string | null,
  focusCountry: string | null,
) {
  g.each(function (d) {
    const isSel = d.o.id === selectedId;
    const isFocused = isSel && focusCountry != null && d.country === focusCountry;
    const node = d3.select(this);
    const visible = outbreakMapVisible(d.o.id, selectedId);
    node.style("display", visible ? "" : "none");
    node.style("opacity", visible ? (selectedId ? "1" : isSel ? "1" : "0.82") : "0");
    node
      .select(".ob-rim")
      .attr("stroke-width", isFocused ? 2.2 : isSel && d.isPrimary ? 2.2 : 1.4);
    node
      .select(".ob-dot")
      .attr("r", isFocused ? d.dotR + 1.5 : isSel && d.isPrimary ? d.dotR + 1.5 : d.dotR)
      .attr("stroke-width", isFocused ? 1.4 : isSel && d.isPrimary ? 1.4 : 1);
    node
      .select(".ob-label")
      .style(
        "display",
        isFocused ||
          (d.isPrimary && (isSel || !selectedId || d.o.conspiracy_score >= 65))
          ? "block"
          : "none",
      );
  });
}

function WorldMap({
  outbreaks,
  selected,
  focusCountry,
  onSelect,
}: {
  outbreaks: Outbreak[];
  selected: Outbreak | null;
  focusCountry: string | null;
  onSelect: (o: Outbreak, country?: string) => void;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const zoomTransformRef = useRef<d3.ZoomTransform>(d3.zoomIdentity);
  const mapCtxRef = useRef<ObMapCtx | null>(null);
  const worldRef = useRef<unknown>(null);
  const outbreaksRef = useRef(outbreaks);
  const selectedIdRef = useRef<string | null>(selected?.id ?? null);
  const focusCountryRef = useRef<string | null>(focusCountry);
  const onSelectRef = useRef(onSelect);
  const setTooltipRef = useRef<(t: ObMapTooltip | null) => void>(() => {});
  const [world, setWorld] = useState<unknown>(null);
  const [tooltip, setTooltip] = useState<ObMapTooltip | null>(null);

  outbreaksRef.current = outbreaks;
  selectedIdRef.current = selected?.id ?? null;
  focusCountryRef.current = focusCountry;
  onSelectRef.current = onSelect;
  setTooltipRef.current = setTooltip;
  worldRef.current = world;

  useEffect(() => {
    fetch("https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json")
      .then((r) => r.json())
      .then(setWorld)
      .catch(() => {});
  }, []);

  const paintMarkers = useCallback((ctx: ObMapCtx, selectedId: string | null, focus: string | null) => {
    const { linesG, markersG, proj } = ctx;
    const list = outbreaksRef.current;

    linesG.selectAll("*").remove();
    markersG.selectAll("*").remove();

    const markerQueue: ObMapMarkerDraw[] = [];

    for (const o of list) {
      if (!outbreakMapVisible(o.id, selectedId)) continue;

      const lat = Number(o.lat);
      const lng = Number(o.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;

      const col = RISK_COL(o.risk_level, o.conspiracy_score);
      const isSel = o.id === selectedId;
      const r = Math.max(6, 5 + Math.min(7, (o.conspiracy_score || 0) / 10));
      const lineStyle = obLineStyle(o.id, selectedId);

      const slots = collectSpreadMarkerSlots(o, proj);
      if (!slots.length) continue;

      if (slots.length > 1) {
        const [x1, y1] = [slots[0].x, slots[0].y];
        for (let i = 1; i < slots.length; i++) {
          const { x: x2, y: y2 } = slots[i];
          const mx = (x1 + x2) / 2;
          const my = (y1 + y2) / 2;
          const dx = x2 - x1;
          const dy = y2 - y1;
          const len = Math.sqrt(dx * dx + dy * dy) || 1;
          const perpX = -dy / len;
          const perpY = dx / len;
          const curve = Math.min(len * 0.16, 22);
          const qx = mx + perpX * curve;
          const qy = my + perpY * curve;
          linesG
            .append("path")
            .attr("class", "ob-line")
            .attr("data-outbreak-id", o.id)
            .attr("d", `M${x1},${y1} Q${qx},${qy} ${x2},${y2}`)
            .attr("fill", "none")
            .attr("stroke", col)
            .attr("stroke-width", isSel ? lineStyle.width + 0.4 : lineStyle.width)
            .attr("stroke-opacity", lineStyle.opacity)
            .attr("stroke-dasharray", isSel ? "none" : "5 5")
            .attr("marker-end", lineStyle.opacity > 0 ? `url(#${arrowMarkerId(col)})` : "none")
            .style("pointer-events", lineStyle.opacity > 0 ? "stroke" : "none");
        }
      }

      for (let pi = 0; pi < slots.length; pi++) {
        const { x, y, country, isOrigin } = slots[pi];
        const isPrimary = pi === 0;
        const dotR = isPrimary ? r : Math.max(4, r - 2);
        markerQueue.push({ o, x, y, isPrimary, country, isOrigin, dotR, col, isSel });
      }
    }

    const MIN_DIST = 18;
    for (let i = 0; i < markerQueue.length; i++) {
      for (let j = i + 1; j < markerQueue.length; j++) {
        const a = markerQueue[i];
        const b = markerQueue[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < MIN_DIST && dist > 0) {
          const push = (MIN_DIST - dist) / 2 + 1;
          const nx = dx / dist;
          const ny = dy / dist;
          markerQueue[i] = { ...a, x: a.x - nx * push, y: a.y - ny * push };
          markerQueue[j] = { ...b, x: b.x + nx * push, y: b.y + ny * push };
        } else if (dist === 0) {
          const angle = (j * Math.PI * 2) / markerQueue.length;
          markerQueue[j] = { ...b, x: b.x + Math.cos(angle) * MIN_DIST, y: b.y + Math.sin(angle) * MIN_DIST };
        }
      }
    }

    const markerData: ObMarkerDatum[] = markerQueue.map((m) => ({ ...m }));

    const mg = markersG
      .selectAll<SVGGElement, ObMarkerDatum>("g.ob-marker")
      .data(markerData, (d) => `${d.o.id}-${d.country}-${d.isOrigin ? "o" : "s"}`)
      .join("g")
      .attr("class", "ob-marker")
      .attr("data-outbreak-id", (d) => d.o.id)
      .attr("transform", (d) => {
        const k = zoomTransformRef.current.k || 1;
        return `translate(${d.x},${d.y}) scale(${1 / k})`;
      });

    mg.each(function (d) {
      const group = d3.select(this);
      group.selectAll("*").remove();

      pulseHalo(group, d.dotR + 6, d.col);
      group
        .append("circle")
        .attr("cx", 0)
        .attr("cy", 0)
        .attr("r", d.dotR + 3)
        .attr("fill", d.col)
        .attr("fill-opacity", "0.12");
      group
        .append("circle")
        .attr("class", "ob-rim")
        .attr("cx", 0)
        .attr("cy", 0)
        .attr("r", d.dotR + 1.2)
        .attr("fill", "none")
        .attr("stroke", "#e8ffe8")
        .attr("stroke-opacity", d.isPrimary ? 0.55 : 0.35)
        .attr("stroke-width", d.isSel && d.isPrimary ? 2.2 : 1.4);
      group
        .append("circle")
        .attr("class", "ob-dot")
        .attr("cx", 0)
        .attr("cy", 0)
        .attr("r", d.isSel && d.isPrimary ? d.dotR + 1.5 : d.dotR)
        .attr("fill", d.col)
        .attr("fill-opacity", d.isPrimary ? 0.95 : 0.72)
        .attr("stroke", "#030806")
        .attr("stroke-width", d.isSel && d.isPrimary ? 1.4 : 1)
        .style("cursor", "pointer")
        .on("mouseenter", function (event) {
          setTooltipRef.current({
            x: event.offsetX,
            y: event.offsetY,
            o: d.o,
            country: d.country,
            isOrigin: d.isOrigin,
          });
          d3.select(this).attr("fill-opacity", "1");
        })
        .on("mouseleave", function () {
          setTooltipRef.current(null);
          d3.select(this).attr("fill-opacity", d.isPrimary ? 0.95 : 0.72);
        })
        .on("click", (event) => {
          event.stopPropagation();
          onSelectRef.current(d.o, d.country);
        });

      const labelX = d.dotR + 3 + 10;
      const labelText = d.isOrigin
        ? d.o.disease.toUpperCase().slice(0, 14)
        : countryLabel(d.country).toUpperCase().slice(0, 12);
      group
        .append("text")
        .attr("class", "ob-label")
        .attr("x", labelX)
        .attr("y", 0)
        .attr("dominant-baseline", "middle")
        .attr("fill", d.col)
        .attr("font-size", "9")
        .attr("font-weight", "700")
        .attr("font-family", "'Share Tech Mono',monospace")
        .attr("letter-spacing", "0.5")
        .attr("paint-order", "stroke")
        .attr("stroke", "#030806")
        .attr("stroke-width", 3)
        .attr("stroke-opacity", 0.85)
        .text(labelText)
        .style(
          "display",
          (focus === d.country && d.isSel) ||
            (d.isPrimary && (d.isSel || !selectedId || d.o.conspiracy_score >= 65))
            ? "block"
            : "none",
        );
    });

    applyObMarkerStyles(mg, selectedId, focus);
  }, []);

  const updateSelectionOnly = useCallback(
    (selectedId: string | null, focus: string | null) => {
      const ctx = mapCtxRef.current;
      if (!ctx) return;
      paintMarkers(ctx, selectedId, focus);
    },
    [paintMarkers],
  );

  const paintBase = useCallback(() => {
    const svgEl = svgRef.current;
    const topo = worldRef.current;
    if (!svgEl || !topo) return;

    const W = Math.max(svgEl.getBoundingClientRect().width || svgEl.clientWidth, 280);
    const H = 360;
    svgEl.setAttribute("width", String(W));
    svgEl.setAttribute("height", String(H));

    const svg = d3.select(svgEl);
    svg.selectAll("*").remove();
    mapCtxRef.current = null;

    // Arrow marker defs for each risk color
    const defs = svg.append("defs");
    for (const [id, col] of ARROW_IDS) {
      defs.append("marker")
        .attr("id", id)
        .attr("viewBox", "0 -4 9 8")
        .attr("refX", 8)
        .attr("refY", 0)
        .attr("markerWidth", 5)
        .attr("markerHeight", 5)
        .attr("orient", "auto")
        .append("path")
        .attr("d", "M0,-4L9,0L0,4Z")
        .attr("fill", col)
        .attr("opacity", "0.8");
    }

    const proj = d3.geoNaturalEarth1();
    proj.fitSize([W, H], { type: "Sphere" });
    const path = d3.geoPath().projection(proj);

    svg.append("rect").attr("width", W).attr("height", H).attr("fill", "#030806");

    const geoG = svg.append("g").attr("class", "ob-geo");

    const graticule = d3.geoGraticule()();
    geoG
      .append("path")
      .datum(graticule)
      .attr("d", path as d3.ValueFn<SVGPathElement, unknown, string>)
      .attr("fill", "none")
      .attr("stroke", "#0a1f0d")
      .attr("stroke-width", "0.3");

    // @ts-expect-error TopoJSON topology typed loosely vs geojson
    const countries = topojson.feature(topo, topo.objects.countries);
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

    // @ts-expect-error TopoJSON mesh callback types
    const borders = topojson.mesh(topo, topo.objects.countries, (a: unknown, b: unknown) => a !== b);
    geoG
      .append("path")
      .datum(borders)
      .attr("d", path as d3.ValueFn<SVGPathElement, unknown, string>)
      .attr("fill", "none")
      .attr("stroke", "#1a3320")
      .attr("stroke-width", "0.3");

    const linesG = geoG.append("g").attr("class", "ob-lines");
    const markersG = geoG.append("g").attr("class", "ob-markers");

    function applyObMarkerScale(t: d3.ZoomTransform) {
      const k = t.k || 1;
      markersG
        .selectAll<SVGGElement, ObMarkerDatum>("g.ob-marker")
        .attr("transform", (d) => `translate(${d.x},${d.y}) scale(${1 / k})`);
    }

    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .extent([
        [0, 0],
        [W, H],
      ])
      .scaleExtent([1, 10])
      .on("zoom", (event: d3.D3ZoomEvent<SVGSVGElement, unknown>) => {
        zoomTransformRef.current = event.transform;
        geoG.attr("transform", String(event.transform));
        applyObMarkerScale(event.transform);
        setTooltipRef.current(null);
      });

    svg.on(".zoom", null);
    svg.call(zoom);
    svg.call(zoom.transform, zoomTransformRef.current);

    const ctrl = svg.append("g").attr("class", "ob-zoom-ctrl").attr("transform", `translate(${W - 36}, 10)`);
    [
      { dy: 0, label: "+", delta: 1.5 },
      { dy: 22, label: "−", delta: 1 / 1.5 },
      { dy: 44, label: "⌂", delta: null as number | null },
    ].forEach(({ dy, label, delta }) => {
      const btn = ctrl.append("g").attr("transform", `translate(0,${dy})`).style("cursor", "pointer");
      btn
        .append("rect")
        .attr("width", 22)
        .attr("height", 18)
        .attr("rx", 2)
        .attr("fill", "rgba(9,15,11,0.85)")
        .attr("stroke", "#1a3320");
      btn
        .append("text")
        .attr("x", 11)
        .attr("y", 13)
        .attr("text-anchor", "middle")
        .attr("fill", "#5a8068")
        .attr("font-size", "12")
        .attr("font-family", "monospace")
        .text(label);
      btn.on("click", () => {
        if (delta === null) {
          zoomTransformRef.current = d3.zoomIdentity;
          svg.transition().duration(400).call(zoom.transform, d3.zoomIdentity);
        } else svg.transition().duration(220).call(zoom.scaleBy, delta);
      });
      btn.on("mouseenter", function () {
        d3.select(this).select("rect").attr("stroke", "#00bb66");
        d3.select(this).select("text").attr("fill", "#00ff88");
      });
      btn.on("mouseleave", function () {
        d3.select(this).select("rect").attr("stroke", "#1a3320");
        d3.select(this).select("text").attr("fill", "#5a8068");
      });
    });

    const ctx: ObMapCtx = { svg, geoG, linesG, markersG, proj, W, H, zoom };
    mapCtxRef.current = ctx;
    paintMarkers(ctx, selectedIdRef.current, focusCountryRef.current);
  }, [paintMarkers]);

  useEffect(() => {
    if (!world || !svgRef.current) return;
    paintBase();

    let resizeTimer: ReturnType<typeof setTimeout> | undefined;
    const ro = new ResizeObserver(() => {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => paintBase(), 150);
    });
    ro.observe(svgRef.current);
    return () => {
      ro.disconnect();
      if (resizeTimer) clearTimeout(resizeTimer);
    };
  }, [world, paintBase]);

  useEffect(() => {
    const ctx = mapCtxRef.current;
    if (!ctx) return;
    paintMarkers(ctx, selectedIdRef.current, focusCountryRef.current);
  }, [outbreaks, paintMarkers]);

  useEffect(() => {
    updateSelectionOnly(selected?.id ?? null, focusCountry);
  }, [selected?.id, focusCountry, updateSelectionOnly]);

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        marginBottom: 4,
        isolation: "isolate",
        flexShrink: 0,
      }}
    >
      <svg
        ref={svgRef}
        style={{
          width: "100%",
          height: 360,
          maxWidth: "100%",
          background: "#030806",
          borderRadius: 4,
          border: "1px solid #1a3320",
          display: "block",
        }}
      />
      {tooltip && (
        <div style={{position:"absolute",left:tooltip.x+12,top:tooltip.y-20,background:"#090f0b",border:`1px solid ${RISK_COL(tooltip.o.risk_level,tooltip.o.conspiracy_score)}`,borderRadius:3,padding:"8px 10px",pointerEvents:"none",zIndex:20,maxWidth:240}}>
          <div style={{fontFamily:RAJ,fontSize:13,fontWeight:700,color:"#e8ffe8",marginBottom:2}}>
            {countryFlag(tooltip.country)} {tooltip.o.disease}
          </div>
          <div style={{fontSize:9,color:"#5a8068",letterSpacing:1,marginBottom:4}}>{countryLabel(tooltip.country).toUpperCase()}</div>
          {tooltip.isOrigin ? (
            <div style={{fontSize:9,color:"#ff6633",marginBottom:5,letterSpacing:1}}>ORIGIN</div>
          ) : (
            <div style={{fontSize:9,color:"#3a5040",marginBottom:5,letterSpacing:0.5}}>
              SPREAD · from {countryFlag(outbreakOrigin(tooltip.o))} {countryLabel(outbreakOrigin(tooltip.o))}
            </div>
          )}
          {(tooltip.o.affected_countries ?? []).length > 1 && (
            <div style={{fontSize:9,color:"#3a5040",marginBottom:5,letterSpacing:0.5}}>
              {countryFlag(outbreakOrigin(tooltip.o))} →{" "}
              {(tooltip.o.affected_countries ?? [])
                .filter(c => c !== outbreakOrigin(tooltip.o))
                .slice(0,3)
                .map(c => countryFlag(c))
                .join(" ")}
              {(tooltip.o.affected_countries ?? []).length > 4 ? ` +${(tooltip.o.affected_countries ?? []).length - 4}` : ""}
              {" "}· {(tooltip.o.affected_countries ?? []).length} countries
            </div>
          )}
          <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
            <span style={{fontSize:9,color:RISK_COL(tooltip.o.risk_level,tooltip.o.conspiracy_score),border:`1px solid ${RISK_COL(tooltip.o.risk_level,tooltip.o.conspiracy_score)}`,padding:"1px 5px",borderRadius:2}}>{tooltip.o.risk_level}</span>
            {tooltip.o.has_conspiracy&&<span style={{fontSize:9,color:"#c94dff",border:"1px solid rgba(201,77,255,0.4)",padding:"1px 5px",borderRadius:2}}>⚠ CONSPIRACY</span>}
            {(tooltip.o.localNews?.length ?? 0) > 0 && <span style={{fontSize:9,color:"#00bb66",border:"1px solid rgba(0,187,102,0.3)",padding:"1px 5px",borderRadius:2}}>◉ {tooltip.o.localNews!.length} news</span>}
          </div>
          <div style={{fontSize:8,color:"#3a5040",marginTop:6}}>Click to open dossier</div>
        </div>
      )}
      <div
        style={{
          fontFamily: FONT,
          fontSize: 9,
          color: "#3a5040",
          letterSpacing: 1.2,
          marginTop: 6,
          lineHeight: 1.5,
        }}
      >
        {selected
          ? (() => {
              const origin = outbreakOrigin(selected);
              const focus = (focusCountry ?? origin).toLowerCase();
              const isOrigin = focus === origin;
              return isOrigin
                ? `◈ ${selected.disease.toUpperCase()} — ${countryLabel(origin)} origin · curved arrows show spread direction`
                : `◈ ${selected.disease.toUpperCase()} — ${countryLabel(focus)} · spread from ${countryLabel(origin)}`;
            })()
          : "◈ Curved arrows show spread direction from origin · click any dot to isolate its network"}
      </div>
    </div>
  );
}

// ── OUTBREAK CARD ──────────────────────────────────────────────
function OutbreakCard({
  o,
  selected,
  detailLevel,
  onClick,
}: {
  o: Outbreak;
  selected: boolean;
  detailLevel?: "preview" | "full";
  onClick: () => void;
}) {
  const col = RISK_COL(o.risk_level, o.conspiracy_score);
  const vs = VERDICT_STYLE(o.verdict);
  const desc = cleanOutbreakBlurb(o.description);
  return (
    <div
      onClick={onClick}
      style={{
        border: `1px solid ${selected ? col : "#1a3320"}`,
        borderRadius: 4,
        background: selected ? "rgba(0,0,0,0.5)" : "#090f0b",
        padding: "13px 15px",
        cursor: "pointer",
        transition: "border-color 0.15s",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLDivElement).style.borderColor = col;
      }}
      onMouseLeave={(e) => {
        if (!selected) (e.currentTarget as HTMLDivElement).style.borderColor = "#1a3320";
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 7 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: RAJ, fontSize: 15, fontWeight: 700, color: "#e8ffe8", lineHeight: 1.3 }}>
            {o.disease}
          </div>
          {/* Spread chain: origin → affected */}
          {(() => {
            const origin = (o.origin_country || o.location || "").toLowerCase();
            const spread = (o.affected_countries ?? []).filter((c) => c !== origin).slice(0, 3);
            return (
              <div style={{ display: "flex", alignItems: "center", gap: 3, flexWrap: "wrap", marginTop: 4 }}>
                <span style={{ fontSize: 12 }}>{countryFlag(origin)}</span>
                <span style={{ fontSize: 10, color: "#ff6633", letterSpacing: 0.5, fontFamily: FONT }}>{countryLabel(origin)}</span>
                {spread.length > 0 && (
                  <>
                    <span style={{ color: "#1a5028", fontSize: 11, marginInline: 1 }}>──→</span>
                    {spread.map((c) => (
                      <span key={c} style={{ display: "flex", alignItems: "center", gap: 2 }}>
                        <span style={{ fontSize: 12 }}>{countryFlag(c)}</span>
                        <span style={{ fontSize: 10, color: "#5a8068", letterSpacing: 0.5, fontFamily: FONT }}>{countryLabel(c)}</span>
                      </span>
                    ))}
                    {(o.affected_countries ?? []).filter((c) => c !== origin).length > 3 && (
                      <span style={{ fontSize: 10, color: "#3a5040", fontFamily: FONT }}>
                        +{(o.affected_countries ?? []).filter((c) => c !== origin).length - 3}
                      </span>
                    )}
                  </>
                )}
              </div>
            );
          })()}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-end" }}>
          {selected ? (
            <span style={{ fontSize: 12, color: col, lineHeight: 1, marginBottom: 2 }}>
              {detailLevel === "full" ? "▴" : "▾"}
            </span>
          ) : null}
          <span
            style={{
              fontSize: 11,
              color: col,
              border: `1px solid ${col}`,
              padding: "2px 7px",
              borderRadius: 2,
              fontFamily: RAJ,
              fontWeight: 700,
              letterSpacing: 1,
            }}
          >
            {o.risk_level}
          </span>
          {o.has_conspiracy && (
            <span
              style={{
                fontSize: 11,
                color: "#c94dff",
                border: "1px solid rgba(201,77,255,0.3)",
                padding: "2px 7px",
                borderRadius: 2,
                letterSpacing: 1,
              }}
            >
              ⚠ CONSPIRACY
            </span>
          )}
          {o.localNews && o.localNews.length > 0 && (
            <span
              style={{
                fontSize: 11,
                color: "#00bb66",
                border: "1px solid rgba(0,187,102,0.3)",
                padding: "2px 7px",
                borderRadius: 2,
                letterSpacing: 1,
              }}
            >
              ◉ {o.localNews.length} LOCAL NEWS
            </span>
          )}
        </div>
      </div>
      <div
        className="ob-plain-text"
        style={{ fontSize: 11, color: "#5a8068", lineHeight: 1.65, marginBottom: 9, minWidth: 0 }}
      >
        {desc.slice(0, 110)}
        {desc.length > 110 ? "..." : ""}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ fontSize: 10, color: "#3a5040", letterSpacing: 1, flexShrink: 0 }}>
          THREAT
        </div>
        <div style={{ flex: 1, height: 2, background: "#1a3320", borderRadius: 1, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${o.conspiracy_score}%`, background: col, borderRadius: 1 }} />
        </div>
        <div style={{ fontFamily: RAJ, fontSize: 14, fontWeight: 700, color: col, flexShrink: 0 }}>
          {o.conspiracy_score}%
        </div>
      </div>
      <div
        style={{
          marginTop: 8,
          padding: "3px 8px",
          display: "inline-block",
          background: vs.bg,
          border: `1px solid ${vs.border}`,
          borderRadius: 2,
          fontSize: 10,
          color: vs.col,
          letterSpacing: 1,
        }}
      >
        {o.verdict.replace(/_/g, " ")}
      </div>
      {selected ? (
        <div style={{ fontSize: 9, color: "#3a5040", letterSpacing: 1.5, marginTop: 8, textAlign: "right" }}>
          {detailLevel === "full" ? "TAP TO CLOSE" : "TAP TO EXPAND"}
        </div>
      ) : null}
    </div>
  );
}

// ── OUTBREAK DETAIL ────────────────────────────────────────────
type OutbreakDetailVariant = "sidebar" | "inline-preview" | "inline-full";

function OutbreakLocalNews({ o, focusCountry }: { o: Outbreak; focusCountry?: string | null }) {
  if (!o.localNews?.length) return null;

  const origin = outbreakOrigin(o);
  const focus = (focusCountry ?? origin).toLowerCase();
  const countryOrder = [
    ...new Set([
      focus,
      origin,
      ...(o.affected_countries ?? []).map((c) => c.toLowerCase()),
      ...o.localNews.map((n) => (n.country ?? "").toLowerCase()).filter(Boolean),
    ].filter(Boolean)),
  ];

  const grouped = new Map<string, LocalNews[]>();
  for (const n of o.localNews) {
    const key = (n.country ?? (origin || "global")).toLowerCase();
    const arr = grouped.get(key) ?? [];
    arr.push(n);
    grouped.set(key, arr);
  }

  const renderArticle = (n: LocalNews, i: number) => (
    <a
      key={`${n.url}-${i}`}
      href={n.url}
      target="_blank"
      rel="noreferrer"
      style={{
        display: "block",
        border: "1px solid #1a3320",
        borderRadius: 3,
        padding: "10px 12px",
        marginBottom: 7,
        textDecoration: "none",
        background: "rgba(0,255,136,0.02)",
        transition: "border-color 0.15s",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLAnchorElement).style.borderColor = "#00bb66";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLAnchorElement).style.borderColor = "#1a3320";
      }}
    >
      <div
        style={{
          fontFamily: RAJ,
          fontSize: 13,
          fontWeight: 700,
          color: "#c8e8d0",
          lineHeight: 1.35,
          marginBottom: 5,
        }}
      >
        {n.title}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 11, color: "#5a8068", letterSpacing: 1 }}>{n.source}</span>
        <span style={{ fontSize: 11, color: "#3a5040" }}>
          {n.pubDate ? new Date(n.pubDate).toLocaleDateString() : ""}
        </span>
      </div>
    </a>
  );

  return (
    <>
      <div style={{ fontSize: 11, color: "#3a5040", marginBottom: 10, letterSpacing: 1, lineHeight: 1.6 }}>
        {o.localNews.length} signals from {grouped.size} region{grouped.size === 1 ? "" : "s"} — Google News · site feed · WHO/CDC sources
      </div>
      {countryOrder.map((country) => {
        const items = grouped.get(country);
        if (!items?.length) return null;
        const isOrigin = country === origin;
        const isFocused = country === focus;
        return (
          <div key={country} style={{ marginBottom: 16 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                marginBottom: 8,
                paddingBottom: 6,
                borderBottom: isFocused ? "1px solid rgba(255,102,51,0.35)" : "1px solid #1a3320",
                background: isFocused ? "rgba(255,102,51,0.04)" : undefined,
                borderRadius: isFocused ? 3 : undefined,
                padding: isFocused ? "6px 8px" : undefined,
              }}
            >
              <span style={{ fontSize: 16 }}>{countryFlag(country)}</span>
              <span style={{ fontFamily: RAJ, fontSize: 12, fontWeight: 700, color: isOrigin ? "#ff9966" : isFocused ? "#e8ffe8" : "#7aaa8a" }}>
                {countryLabel(country)}
              </span>
              {isOrigin && (
                <span style={{ fontSize: 9, color: "#ff6633", border: "1px solid rgba(255,102,51,0.35)", padding: "1px 5px", borderRadius: 2, letterSpacing: 1 }}>
                  ORIGIN
                </span>
              )}
              {!isOrigin && isFocused && (
                <span style={{ fontSize: 9, color: "#ffaa00", border: "1px solid rgba(255,170,0,0.35)", padding: "1px 5px", borderRadius: 2, letterSpacing: 1 }}>
                  SELECTED
                </span>
              )}
              <span style={{ marginLeft: "auto", fontSize: 10, color: "#3a5040", fontFamily: FONT }}>
                {items.length} article{items.length === 1 ? "" : "s"}
              </span>
            </div>
            {sortByPubDateDesc(items).map(renderArticle)}
          </div>
        );
      })}
    </>
  );
}

function OutbreakTheories({ o }: { o: Outbreak }) {
  if (!o.theories?.length) return null;
  return (
    <>
      {o.theories.map((t, i) => (
        <div
          key={i}
          style={{
            border: "1px solid rgba(201,77,255,0.2)",
            borderRadius: 3,
            padding: "11px 13px",
            background: "rgba(20,8,24,0.6)",
            marginBottom: 8,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
            <div style={{ fontFamily: RAJ, fontSize: 13, fontWeight: 700, color: "#e9b3ff" }}>{t.name}</div>
            <div
              style={{
                fontFamily: RAJ,
                fontSize: 18,
                fontWeight: 700,
                color: RISK_COL("", t.probability),
                flexShrink: 0,
              }}
            >
              {t.probability}%
            </div>
          </div>
          <div style={{ fontSize: 11, color: "#7a5a88", lineHeight: 1.65, marginBottom: 7 }}>{t.summary}</div>
          {t.sources
            ?.filter((s) => /^https?:\/\//.test(s))
            .map((s, j) => (
              <a
                key={j}
                href={s}
                target="_blank"
                rel="noreferrer"
                style={{
                  display: "flex",
                  gap: 6,
                  color: "#00bb66",
                  fontSize: 10,
                  textDecoration: "none",
                  marginBottom: 4,
                  wordBreak: "break-all",
                }}
              >
                <span style={{ flexShrink: 0 }}>↗</span>
                <span>{s}</span>
              </a>
            ))}
        </div>
      ))}
    </>
  );
}

function OutbreakPatents({ o }: { o: Outbreak }) {
  if (!o.patents?.length) return null;
  return (
    <>
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
            padding: "10px 12px",
            background: "rgba(26,10,10,0.6)",
            marginBottom: 7,
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
          <div style={{ fontSize: 10, color: "#ff5555", letterSpacing: 1, marginBottom: 4 }}>
            {p.number} · {p.assignee}
          </div>
          <div style={{ fontFamily: RAJ, fontSize: 12, fontWeight: 700, color: "#ffe8e8" }}>{p.title}</div>
          <div style={{ fontSize: 10, color: "#5a4040", marginTop: 4 }}>↗ View on Google Patents</div>
        </a>
      ))}
    </>
  );
}

function OutbreakDetail({
  o,
  focusCountry,
  variant = "sidebar",
  onExpand,
  onCollapse,
}: {
  o: Outbreak;
  focusCountry?: string | null;
  variant?: OutbreakDetailVariant;
  onExpand?: () => void;
  onCollapse?: () => void;
}) {
  const col = RISK_COL(o.risk_level, o.conspiracy_score);
  const vs = VERDICT_STYLE(o.verdict);
  const desc = cleanOutbreakBlurb(o.description);
  const isInline = variant.startsWith("inline");
  const isPreview = variant === "inline-preview";
  const useCollapsible = variant === "inline-full";
  const origin = outbreakOrigin(o);
  const focus = (focusCountry ?? origin).toLowerCase();
  const isFocusOrigin = focus === origin;

  const sectionChips = [
    o.localNews?.length ? { label: `◉ ${o.localNews.length} LOCAL NEWS`, color: "#00bb66" } : null,
    o.theories?.length ? { label: `◈ ${o.theories.length} THEORIES`, color: "#c94dff" } : null,
    o.patents?.length ? { label: `◈ ${o.patents.length} PATENTS`, color: "#ff5555" } : null,
  ].filter((c): c is { label: string; color: string } => c != null);

  const keyFactsBlock = (facts: string[]) =>
    facts.length > 0 ? (
      <div>
        <div
          style={{
            fontSize: 10,
            color: "#5a8068",
            letterSpacing: 2,
            marginBottom: 8,
            textTransform: "uppercase",
          }}
        >
          Key Facts
        </div>
        {facts.map((f, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              gap: 8,
              color: "#7aaa8a",
              fontSize: 12,
              marginBottom: 6,
              lineHeight: 1.6,
              alignItems: "flex-start",
              minWidth: 0,
            }}
          >
            <span style={{ color: "#00bb66", flexShrink: 0 }}>▸</span>
            <span className="ob-plain-text">{cleanOutbreakBlurb(f)}</span>
          </div>
        ))}
      </div>
    ) : null;

  return (
    <div style={{ border: "1px solid #1a3320", borderRadius: 4, background: "#090f0b", overflow: "hidden" }}>
      {!isInline ? (
        <div style={{ padding: "14px 16px", borderBottom: "1px solid #1a3320", background: "#050c07" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <span style={{ fontSize: 22 }}>{countryFlag(focus)}</span>
            <div>
              <div style={{ fontFamily: RAJ, fontSize: 18, fontWeight: 700, color: "#e8ffe8", lineHeight: 1.2 }}>
                {o.disease}
              </div>
              <div style={{ fontSize: 11, color: isFocusOrigin ? "#ff9966" : "#7aaa8a", letterSpacing: 1, marginTop: 2 }}>
                {countryLabel(focus)}
                {isFocusOrigin ? (
                  <span style={{ fontSize: 9, color: "#ff6633", marginLeft: 8, letterSpacing: 2 }}>ORIGIN</span>
                ) : (
                  <span style={{ fontSize: 9, color: "#5a8068", marginLeft: 8, letterSpacing: 1 }}>
                    SPREAD from {countryFlag(origin)} {countryLabel(origin)}
                  </span>
                )}
              </div>
              <div style={{ fontSize: 9, color: "#3a5040", letterSpacing: 2, textTransform: "uppercase" }}>
                WHO DISEASE DOSSIER
              </div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
            <span style={{ fontSize: 11, color: col, border: `1px solid ${col}`, padding: "2px 7px", borderRadius: 2 }}>
              {o.risk_level}
            </span>
            <span style={{ fontSize: 11, padding: "2px 8px", background: vs.bg, border: `1px solid ${vs.border}`, borderRadius: 2, color: vs.col, letterSpacing: 1 }}>
              {o.verdict.replace(/_/g, " ")}
            </span>
            {(o.affected_countries ?? []).length > 1 && (
              <span style={{ fontSize: 11, color: "#5a8068", border: "1px solid #1a3320", padding: "2px 7px", borderRadius: 2 }}>
                {(o.affected_countries ?? []).length} countries
              </span>
            )}
            {(o.merged_count ?? 1) > 1 && (
              <span style={{ fontSize: 11, color: "#ffaa00", border: "1px solid rgba(255,170,0,0.3)", padding: "2px 7px", borderRadius: 2 }}>
                {o.merged_count} active reports
              </span>
            )}
          </div>
          {/* Spread chain header */}
          {(() => {
            const spread = (o.affected_countries ?? []).filter((c) => c.toLowerCase() !== origin);
            if (!spread.length) return null;
            return (
              <div style={{ display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap", padding: "8px 10px", background: "rgba(255,102,51,0.04)", border: "1px solid rgba(255,102,51,0.12)", borderRadius: 3 }}>
                <span style={{ fontSize: 9, color: "#ff6633", letterSpacing: 2, marginRight: 4 }}>SPREAD</span>
                <span style={{ fontSize: 13 }}>{countryFlag(origin)}</span>
                <span style={{ fontSize: 11, color: origin === focus ? "#ff9966" : "#ff6633", fontFamily: RAJ, fontWeight: origin === focus ? 700 : 400 }}>{countryLabel(origin)}</span>
                <span style={{ color: "#ff6633", fontSize: 12, opacity: 0.5, marginInline: 2 }}>→</span>
                {spread.map((c, i) => {
                  const ck = c.toLowerCase();
                  const isFocused = ck === focus;
                  return (
                  <span key={c} style={{ display: "flex", alignItems: "center", gap: 3 }}>
                    {i > 0 && <span style={{ color: "#1a3320", fontSize: 11 }}>·</span>}
                    <span style={{ fontSize: 13 }}>{countryFlag(c)}</span>
                    <span style={{ fontSize: 11, color: isFocused ? "#e8ffe8" : "#7aaa8a", fontFamily: RAJ, fontWeight: isFocused ? 700 : 400 }}>{countryLabel(c)}</span>
                  </span>
                  );
                })}
              </div>
            );
          })()}
        </div>
      ) : null}

      <div
        style={{
          padding: "14px 16px",
          display: "flex",
          flexDirection: "column",
          gap: 14,
          maxHeight: variant === "sidebar" ? "min(580px, 70vh)" : undefined,
          overflowY: variant === "sidebar" ? "auto" : undefined,
          minWidth: 0,
        }}
      >
        {isPreview ? (
          <>
            <div className="intel-preview-panel" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: 10, color: "#5a8068", letterSpacing: 2, marginBottom: 4 }}>
                    CONSPIRACY SCORE
                  </div>
                  <div style={{ fontFamily: RAJ, fontSize: 28, fontWeight: 700, color: col, lineHeight: 1 }}>
                    {o.conspiracy_score}%
                  </div>
                </div>
                <div style={{ width: 96 }}>
                  <div style={{ height: 3, background: "#1a3320", borderRadius: 2, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${o.conspiracy_score}%`, background: col, borderRadius: 2 }} />
                  </div>
                </div>
              </div>
              <div className="ob-plain-text intel-preview-clamp" style={{ fontSize: 12, color: "#7aaa8a", lineHeight: 1.7 }}>
                {desc}
              </div>
              {keyFactsBlock(o.key_facts?.slice(0, 2) ?? [])}
              <IntelSectionChips chips={sectionChips} />
            </div>
            <IntelExpandBar expanded={false} onToggle={() => onExpand?.()} />
          </>
        ) : (
          <>
            {variant === "inline-full" ? (
              <IntelExpandBar expanded onToggle={() => onCollapse?.()} />
            ) : null}

            {!isInline ? (
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: 10, color: "#5a8068", letterSpacing: 2, marginBottom: 4 }}>
                    CONSPIRACY SCORE
                  </div>
                  <div style={{ fontFamily: RAJ, fontSize: 36, fontWeight: 700, color: col, lineHeight: 1 }}>
                    {o.conspiracy_score}%
                  </div>
                </div>
                <div style={{ width: 120 }}>
                  <div style={{ height: 4, background: "#1a3320", borderRadius: 2, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${o.conspiracy_score}%`, background: col, borderRadius: 2 }} />
                  </div>
                </div>
              </div>
            ) : null}

            <div className="ob-plain-text" style={{ fontSize: 12, color: "#7aaa8a", lineHeight: 1.7, minWidth: 0 }}>
              {desc}
            </div>

            {keyFactsBlock(o.key_facts ?? [])}

            {/* Spread Network diagram (full body, not just header) */}
            {(() => {
              const spread = (o.affected_countries ?? []).filter((c) => c.toLowerCase() !== origin);
              if (!spread.length) return null;
              const originFocused = isFocusOrigin;
              return (
                <div>
                  <div style={{ fontSize: 10, color: "#ff6633", letterSpacing: 2, marginBottom: 10, textTransform: "uppercase" }}>
                    ◈ Spread Network — {(o.affected_countries ?? []).length} affected countries
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", background: originFocused ? "rgba(255,102,51,0.12)" : "rgba(255,102,51,0.06)", border: originFocused ? "1px solid rgba(255,102,51,0.45)" : "1px solid rgba(255,102,51,0.2)", borderRadius: 3 }}>
                      <span style={{ fontSize: 9, color: "#ff6633", border: "1px solid rgba(255,102,51,0.4)", padding: "1px 5px", borderRadius: 2, letterSpacing: 1, flexShrink: 0 }}>ORIGIN</span>
                      <span style={{ fontSize: 18 }}>{countryFlag(origin)}</span>
                      <span style={{ fontFamily: RAJ, fontSize: 13, fontWeight: 700, color: "#ff9966" }}>{countryLabel(origin)}</span>
                    </div>
                    <div style={{ paddingLeft: 18, display: "flex", flexDirection: "column", gap: 0, borderLeft: "1px dashed rgba(255,102,51,0.2)", marginLeft: 16 }}>
                      {spread.map((c) => {
                        const ck = c.toLowerCase();
                        const isFocused = ck === focus;
                        return (
                        <div key={c} style={{ position: "relative" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", marginBottom: 4, background: isFocused ? "rgba(255,170,0,0.08)" : "rgba(90,128,104,0.04)", border: isFocused ? "1px solid rgba(255,170,0,0.35)" : "1px solid #1a3320", borderRadius: 3, marginLeft: -1 }}>
                            <span style={{ fontSize: 9, color: isFocused ? "#ffaa00" : "#5a8068", border: `1px solid ${isFocused ? "rgba(255,170,0,0.35)" : "#1a3320"}`, padding: "1px 5px", borderRadius: 2, letterSpacing: 1, flexShrink: 0 }}>→ SPREAD</span>
                            <span style={{ fontSize: 16 }}>{countryFlag(c)}</span>
                            <span style={{ fontFamily: RAJ, fontSize: 12, color: isFocused ? "#e8ffe8" : "#7aaa8a", fontWeight: isFocused ? 700 : 400 }}>{countryLabel(c)}</span>
                          </div>
                        </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })()}

            {o.localNews && o.localNews.length > 0 ? (
              useCollapsible ? (
                <CollapsibleSection
                  title="Intelligence — local signals"
                  count={o.localNews.length}
                  accent="#00bb66"
                  subtitle={`${o.localNews.length} articles from affected regions`}
                >
                  <OutbreakLocalNews o={o} focusCountry={focus} />
                </CollapsibleSection>
              ) : (
                <div>
                  <div style={{ fontSize: 10, color: "#00bb66", letterSpacing: 2, marginBottom: 8, textTransform: "uppercase" }}>
                    ◉ INTELLIGENCE — {o.localNews.length} ARTICLES FROM AFFECTED REGIONS
                  </div>
                  <OutbreakLocalNews o={o} focusCountry={focus} />
                </div>
              )
            ) : null}

            {o.theories && o.theories.length > 0 ? (
              useCollapsible ? (
                <CollapsibleSection
                  title="Conspiracy theories"
                  count={o.theories.length}
                  accent="#c94dff"
                  subtitle="Tap to read documented theories"
                >
                  <OutbreakTheories o={o} />
                </CollapsibleSection>
              ) : (
                <div>
                  <div
                    style={{
                      fontSize: 10,
                      color: "#c94dff",
                      letterSpacing: 2,
                      marginBottom: 8,
                      textTransform: "uppercase",
                    }}
                  >
                    ◈ Conspiracy Theories ({o.theories.length})
                  </div>
                  <OutbreakTheories o={o} />
                </div>
              )
            ) : null}

            {o.patents && o.patents.length > 0 ? (
              useCollapsible ? (
                <CollapsibleSection
                  title="Related patents"
                  count={o.patents.length}
                  accent="#ff5555"
                  subtitle="Tap to view patent records"
                >
                  <OutbreakPatents o={o} />
                </CollapsibleSection>
              ) : (
                <div>
                  <div
                    style={{
                      fontSize: 10,
                      color: "#ff5555",
                      letterSpacing: 2,
                      marginBottom: 8,
                      textTransform: "uppercase",
                    }}
                  >
                    ◈ Related Patents ({o.patents.length})
                  </div>
                  <OutbreakPatents o={o} />
                </div>
              )
            ) : null}

            <PolymarketWidget
              query={`${o.disease} ${o.origin_country || o.location}`}
              context={[o.title, o.description, o.key_facts?.join(" ")].filter(Boolean).join(" ").slice(0, 2000)}
            />

            <div style={{ paddingTop: 8, borderTop: "1px solid #1a3320", display: "flex", gap: 12 }}>
              <a
                href={o.source_url}
                target="_blank"
                rel="noreferrer"
                style={{ fontSize: 9, color: "#00bb66", textDecoration: "none", letterSpacing: 1 }}
              >
                ↗ WHO SOURCE
              </a>
              <Link
                href={`/search?q=${encodeURIComponent(o.disease)}`}
                style={{ fontSize: 9, color: "#5a8068", textDecoration: "none", letterSpacing: 1 }}
              >
                ◈ SEARCH DATABASE
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

type OutbreakData = {
  outbreaks: Outbreak[];
  generated_at: string;
  preview?: boolean;
  error?: string;
};

async function parseOutbreakJson(res: Response): Promise<Record<string, unknown>> {
  try {
    return (await res.json()) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function isOutbreakPayload(d: Record<string, unknown>): d is OutbreakData {
  return Array.isArray(d.outbreaks) && (d.outbreaks as unknown[]).length > 0;
}

function describeOutbreakApiFailure(res: Response, d: Record<string, unknown>): string {
  const code = typeof d.error === "string" ? d.error : "";
  if (res.status === 504 || res.status === 408) {
    return "The outbreak engine timed out (full run is heavy). Sample preview is shown below.";
  }
  if (!res.ok && res.status >= 500) {
    if (code === "openai_missing") return "Outbreak AI is not configured on the server.";
    if (code === "server_misconfigured") return "Server database configuration is incomplete.";
    return `Server error (${res.status}). Sample preview is shown below when available.`;
  }
  if (!res.ok) return `Request failed (${res.status}).`;
  if (code) return code;
  return "No outbreak rows returned.";
}

// ── MAIN ───────────────────────────────────────────────────────
export default function OutbreakTracker() {
  const [data, setData] = useState<OutbreakData | null>(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState("");
  const [selected, setSelected] = useState<Outbreak|null>(null);
  const [focusCountry, setFocusCountry] = useState<string | null>(null);
  const [detailLevel, setDetailLevel] = useState<"preview" | "full">("preview");
  const [filter, setFilter]     = useState<"all"|"conspiracy"|"high">("all");
  const [mapOpen, setMapOpen]   = useState(false);

  const selectOutbreak = useCallback((o: Outbreak, country?: string) => {
    const origin = outbreakOrigin(o);
    startTransition(() => {
      setSelected(o);
      setFocusCountry((country ?? origin).toLowerCase());
      setDetailLevel("preview");
      if (isMobileViewport()) setMapOpen(true);
    });
  }, []);

  const handleCardClick = useCallback(
    (o: Outbreak) => {
      startTransition(() => {
        if (selected?.id !== o.id) {
          setSelected(o);
          setFocusCountry(outbreakOrigin(o));
          setDetailLevel("preview");
          if (isMobileViewport()) setMapOpen(true);
          return;
        }
        if (detailLevel === "preview") {
          setDetailLevel("full");
          return;
        }
        setSelected(null);
        setFocusCountry(null);
        setDetailLevel("preview");
      });
    },
    [selected?.id, detailLevel],
  );

  useEffect(() => {
    if (!selected?.id || typeof window === "undefined" || window.innerWidth > 768) return;
    requestAnimationFrame(() => {
      document.getElementById(`ob-card-${selected.id}`)?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  }, [selected?.id]);

  useEffect(() => {
    let cancelled = false;

    const loadPreview = async (): Promise<boolean> => {
      const pr = await fetch("/api/outbreaks?preview=1");
      const pd = await parseOutbreakJson(pr);
      if (cancelled || !isOutbreakPayload(pd)) return false;
      setData(pd);
      if (pd.outbreaks.length) {
        setSelected(pd.outbreaks[0]);
        setFocusCountry(outbreakOrigin(pd.outbreaks[0]));
      }
      return true;
    };

    (async () => {
      setLoading(true);
      setError("");
      try {
        const res = await fetch("/api/outbreaks");
        const d = await parseOutbreakJson(res);
        if (cancelled) return;

        if (isOutbreakPayload(d)) {
          setData(d);
          if (d.outbreaks.length) {
            setSelected(d.outbreaks[0]);
            setFocusCountry(outbreakOrigin(d.outbreaks[0]));
          }
          return;
        }

        const previewOk = await loadPreview();
        if (cancelled) return;
        if (!previewOk) {
          setError(describeOutbreakApiFailure(res, d));
        }
      } catch {
        if (cancelled) return;
        const ok = await loadPreview().catch(() => false);
        if (!cancelled && !ok) setError("Network or parse error while loading outbreaks.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) return <OutbreakLoadingScreen/>;

  const outbreaks = data?.outbreaks??[];
  const visible = sortByPublishedAtDesc(
    outbreaks.filter((o) => {
      if (filter === "conspiracy") return o.has_conspiracy;
      if (filter === "high") return o.risk_level === "HIGH" || o.risk_level === "CRITICAL";
      return true;
    }),
  );

  /** Keep selected pin on map when filter changes (same idea as UAP: selection stays coherent). */
  const mapOutbreaks =
    selected && !visible.some((o) => o.id === selected.id) ? [...visible, selected] : visible;

  return (
    <div style={{minHeight:"100vh",background:"#050c07",color:"#c8e8d0",fontFamily:FONT}}>
      <div className="scanline"/>
      <div style={{position:"relative",zIndex:1}}>

        {/* NAV */}
        <div className="ob-tracker-nav intel-page-nav" style={{height:44,background:"#050c07",borderBottom:"1px solid #1a3320",display:"flex",alignItems:"center",padding:"0 16px",gap:12}}>
          <div className="intel-page-nav-start" style={{display:"flex",alignItems:"center",gap:8,flexShrink:0}}>
            <Link href="/" style={{fontSize:10,color:"#5a8068",textDecoration:"none",letterSpacing:2,border:"1px solid #1a3320",padding:"4px 10px",borderRadius:3}}>← FEED</Link>
          </div>
          <div className="intel-page-nav-divider" style={{width:1,height:20,background:"#1a3320",flexShrink:0}}/>
          <Link href="/" className="intel-page-nav-brand" style={{fontFamily:RAJ,fontSize:14,fontWeight:700,color:"#00ff88",letterSpacing:2,textDecoration:"none",textShadow:"0 0 14px rgba(0,255,136,0.3)",flexShrink:0}}>THE THEORIST</Link>
          <div className="intel-page-nav-divider" style={{width:1,height:20,background:"#1a3320",flexShrink:0}}/>
          <div className="intel-page-nav-section" style={{fontFamily:RAJ,fontSize:11,color:"#5a8068",letterSpacing:2,flexShrink:0}}>OUTBREAK TRACKER</div>
          <div className="intel-page-nav-menu" style={{marginLeft:"auto",flexShrink:0}}>
            <SiteNav />
          </div>
          <div className="ob-nav-time intel-page-nav-meta" style={{fontSize:10,color:"#3a5040",letterSpacing:1}}>
            WHO · GNEWS · {data?`Updated ${new Date(data.generated_at).toLocaleTimeString()}`:""}
          </div>
        </div>

        <div style={pageContentShellStyle()}>

          {/* HEADER */}
          <div style={{marginBottom:"1.25rem",paddingBottom:"1rem",borderBottom:"1px solid #1a3320"}}>
            <div className="page-hero-kicker" style={{fontFamily:RAJ,fontSize:11,letterSpacing:5,color:"#5a8068",marginBottom:5,textTransform:"uppercase"}}>■ AI-POWERED GLOBAL DISEASE SURVEILLANCE ■</div>
            <h1 className="ob-page-headline page-hero-title" style={{fontFamily:RAJ,fontSize:26,fontWeight:700,color:"#00ff88",letterSpacing:2,textTransform:"uppercase",textShadow:"0 0 16px rgba(0,255,136,0.2)",margin:"0 0 4px"}}>Outbreak Tracker</h1>
            <div className="ob-page-tagline page-hero-tagline" style={{fontSize:11,color:"#3a5040",letterSpacing:2}}>WHO FEED · LOCAL NEWS EARLY SIGNALS · CONSPIRACY PATTERN DETECTION · USPTO PATENTS</div>
          </div>

          {/* STATS */}
          {data&&(
            <div className="ob-stat-row intel-stat-row" style={{display:"flex",gap:10,marginBottom:"1.25rem",flexWrap:"wrap"}}>
              {[
                {label:"ACTIVE OUTBREAKS",value:outbreaks.length,col:"#00ff88"},
                {label:"HIGH/CRITICAL",value:outbreaks.filter(o=>o.risk_level==="HIGH"||o.risk_level==="CRITICAL").length,col:"#ff3333"},
                {label:"CONSPIRACY FLAGS",value:outbreaks.filter(o=>o.has_conspiracy).length,col:"#c94dff"},
                {label:"LOCAL NEWS FEEDS",value:outbreaks.reduce((a,o)=>a+(o.localNews?.length??0),0),col:"#00bb66"},
              ].map(({label,value,col})=>(
                <div key={label} style={{border:"1px solid #1a3320",borderRadius:3,padding:"8px 14px",background:"#090f0b",minWidth:0}}>
                  <div className="intel-stat-label" style={{fontSize:9,color:"#3a5040",letterSpacing:2,marginBottom:3}}>{label}</div>
                  <div className="intel-stat-value" style={{fontFamily:RAJ,fontSize:22,fontWeight:700,color:col,lineHeight:1}}>{value}</div>
                </div>
              ))}
            </div>
          )}

          {/* FILTERS */}
          <div className="ob-filter-row" style={{display:"flex",gap:6,marginBottom:"1rem"}}>
            {[
              {key:"all",label:"ALL OUTBREAKS"},
              {key:"conspiracy",label:"⚠ CONSPIRACY FLAGS"},
              {key:"high",label:"🔴 HIGH/CRITICAL RISK"},
            ].map(f=>(
              <button key={f.key} onClick={()=>setFilter(f.key as typeof filter)}
                style={{fontFamily:RAJ,fontSize:11,fontWeight:700,letterSpacing:1,textTransform:"uppercase",
                  padding:"6px 14px",borderRadius:2,cursor:"pointer",
                  border:`1px solid ${filter===f.key?"#00bb66":"#1a3320"}`,
                  background:filter===f.key?"rgba(0,255,136,0.06)":"transparent",
                  color:filter===f.key?"#00ff88":"#5a8068"}}>
                {f.label}
              </button>
            ))}
          </div>

          {data?.preview && (
            <div
              style={{
                marginBottom: "1rem",
                padding: "12px 14px",
                border: "1px solid rgba(255,170,0,0.45)",
                borderRadius: 4,
                background: "rgba(255,170,0,0.06)",
                fontSize: 11,
                color: "#ffcc88",
                lineHeight: 1.65,
              }}
            >
              <strong style={{ letterSpacing: 2 }}>PREVIEW MODE</strong> — Showing 2 sample WHO-style watchlist topics
              (no live OpenAI map build). This is <strong>not</strong> tied to sign-in: the full tracker can time out or fail
              when the server runs the heavy pipeline. Reload later for patents, local news, and full scoring.
            </div>
          )}

          {error&&<div style={{padding:12,border:"1px solid rgba(255,51,51,0.3)",borderRadius:3,color:"#ff3333",fontSize:11}}>[ERROR] {error}</div>}

          {/* MAIN GRID */}
          {data&&(
            <div
              className="ob-tracker-main"
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(0, 1fr) minmax(260px, 320px)",
                gap: "1.25rem",
                alignItems: "start",
              }}
            >
              <div style={{ display: "flex", flexDirection: "column", gap: "1.75rem", minWidth: 0 }}>
                <div className="ob-map-section intel-map-section" style={{ marginBottom: 0 }}>
                  <button
                    type="button"
                    className="intel-map-toggle ob-map-toggle"
                    onClick={() => setMapOpen((o) => !o)}
                    style={{
                      display: "none",
                      width: "100%",
                      background: "transparent",
                      border: "1px solid #1a3320",
                      borderRadius: 3,
                      padding: "8px 12px",
                      color: "#5a8068",
                      fontFamily: FONT,
                      fontSize: 10,
                      letterSpacing: 2,
                      cursor: "pointer",
                      textAlign: "left",
                      marginBottom: 8,
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <span style={{ color: "#00ff88", fontSize: 11 }}>{mapOpen ? "▼" : "▶"}</span>
                    {mapOpen ? "HIDE MAP" : "◈ SHOW OUTBREAK MAP"}
                    <span style={{ marginLeft: "auto", fontSize: 9, color: "#3a5040" }}>
                      {selected ? selected.disease : `${mapOutbreaks.length} active`}
                    </span>
                  </button>
                  <div
                    className={
                      mapOpen
                        ? "intel-map-body ob-map-body intel-map-body--open ob-map-body--open"
                        : "intel-map-body ob-map-body"
                    }
                  >
                    <WorldMap outbreaks={mapOutbreaks} selected={selected} focusCountry={focusCountry} onSelect={selectOutbreak} />
                  </div>
                </div>
                <div className="ob-card-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(280px, 100%), 1fr))", gap: 12 }}>
                  {visible.map(o=>(
                    <div key={o.id} id={`ob-card-${o.id}`} style={{ minWidth: 0 }}>
                      <OutbreakCard
                        o={o}
                        selected={selected?.id===o.id}
                        detailLevel={selected?.id === o.id ? detailLevel : undefined}
                        onClick={()=>handleCardClick(o)}
                      />
                      {selected?.id === o.id ? (
                        <div className="ob-detail-inline" style={{ marginTop: 10 }}>
                          <OutbreakDetail
                            o={o}
                            focusCountry={focusCountry}
                            variant={detailLevel === "full" ? "inline-full" : "inline-preview"}
                            onExpand={() => setDetailLevel("full")}
                            onCollapse={() => setDetailLevel("preview")}
                          />
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
              <div className="ob-detail-sidebar">
                {selected
                  ? <OutbreakDetail o={selected} focusCountry={focusCountry}/>
                  : <div style={{border:"1px solid #1a3320",borderRadius:4,padding:"2rem",textAlign:"center",color:"#3a5040",fontSize:12,letterSpacing:2}}>SELECT AN OUTBREAK<br/>ON THE MAP OR LIST</div>
                }
              </div>
            </div>
          )}

          {/* COMMUNITY CTA */}
          <div style={{marginTop:"1.5rem",padding:"14px 18px",border:"1px solid #1a3320",borderRadius:4,background:"#090f0b",display:"flex",alignItems:"center",gap:14,flexWrap:"wrap"}}>
            <div style={{flex:1}}>
              <div style={{fontFamily:"var(--font-raj), sans-serif",fontSize:12,fontWeight:700,color:"#c8e8d0",letterSpacing:2,marginBottom:4}}>HAVE INFORMATION? REPORT IT.</div>
              <div style={{fontFamily:FONT,fontSize:11,color:"#5a8068",lineHeight:1.6}}>Share documents, tips or first-hand reports in the community board. Tag <span style={{color:"#ff3333"}}>@oracle</span> to trigger AI analysis of any outbreak thread.</div>
            </div>
            <Link href="/community" style={{fontFamily:"var(--font-raj), sans-serif",fontSize:11,fontWeight:700,letterSpacing:2,textTransform:"uppercase",padding:"9px 18px",border:"1px solid #ff3333",background:"rgba(255,51,51,0.06)",color:"#ff5555",borderRadius:3,textDecoration:"none",flexShrink:0}}>◈ DISCUSS IN COMMUNITY ▸</Link>
          </div>

        </div>
      </div>
    </div>
  );
}
