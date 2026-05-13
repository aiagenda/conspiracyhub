"use client";

import { useEffect, useRef, useState } from "react";
import PolymarketWidget from "@/components/PolymarketWidget";
import Link from "next/link";
import * as d3 from "d3";
import * as topojson from "topojson-client";
import { pageContentShellStyle } from "@/lib/pageShell";

const FONT = "var(--font-share-tech-mono), monospace";
const RAJ  = "var(--font-raj), sans-serif";

type Theory   = { name:string; summary:string; probability:number; sources:string[] };
type Patent   = { number:string; title:string; assignee:string; url:string };
type LocalNews= { title:string; url:string; source:string; pubDate:string };
type AffectedCoord = { country:string; lat:number; lng:number };
type Outbreak = {
  id:string; title:string; description:string; source_url:string; published_at:string;
  disease:string; location:string; origin_country:string; affected_countries?:string[];
  lat:number; lng:number; affectedCoords?:AffectedCoord[];
  conspiracy_score:number; has_conspiracy:boolean;
  theories:Theory[]; patents:Patent[]; key_facts:string[];
  verdict:string; risk_level:string;
  localNews?: LocalNews[];
};

/** Queued for D3 paint: lines drawn first, then all markers on top. */
type ObMapMarkerDraw = {
  o: Outbreak;
  x: number;
  y: number;
  isPrimary: boolean;
  dotR: number;
  col: string;
  isSel: boolean;
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
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14, justifySelf: "start" }}>
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

          <div style={{display:"flex",gap:12,fontSize:9,color:"#3a5040",letterSpacing:1}}>
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
function WorldMap({outbreaks,selected,onSelect}:{outbreaks:Outbreak[];selected:Outbreak|null;onSelect:(o:Outbreak)=>void}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [world, setWorld] = useState<unknown>(null);
  const [tooltip, setTooltip] = useState<{x:number;y:number;o:Outbreak}|null>(null);

  useEffect(()=>{
    fetch("https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json")
      .then(r=>r.json()).then(setWorld).catch(()=>{});
  },[]);

  useEffect(()=>{
    if (!world||!svgRef.current) return;
    const svgEl = svgRef.current;

    function paint() {
      if (!svgEl || !world) return;
      const W = Math.max(svgEl.getBoundingClientRect().width || svgEl.clientWidth, 280);
      const H = 360;
      svgEl.setAttribute("width", String(W));
      svgEl.setAttribute("height", String(H));
      const svg = d3.select(svgEl);
      svg.selectAll("*").remove();

      const proj = d3.geoNaturalEarth1();
      proj.fitSize([W, H], { type: "Sphere" });
      const path = d3.geoPath().projection(proj);

      svg.append("rect").attr("width",W).attr("height",H).attr("fill","#030806");

      const geoG = svg.append("g").attr("class", "ob-geo");
      const linesG = geoG.append("g").attr("class", "ob-lines");
      const markersG = geoG.append("g").attr("class", "ob-markers");

      const graticule = d3.geoGraticule()();
      geoG.append("path").datum(graticule)
        .attr("d", path as d3.ValueFn<SVGPathElement,unknown,string>)
        .attr("fill","none").attr("stroke","#0a1f0d").attr("stroke-width","0.3");

      // @ts-expect-error TopoJSON topology typed loosely vs geojson
      const countries = topojson.feature(world, world.objects.countries);
      geoG.append("g").selectAll("path")
        // @ts-expect-error features from topojson.feature
        .data(countries.features).enter().append("path")
        .attr("d", path as d3.ValueFn<SVGPathElement,unknown,string>)
        .attr("fill","#0a160c").attr("stroke","#1a3320").attr("stroke-width","0.4");

      // Country borders
      // @ts-expect-error TopoJSON mesh callback types
      const borders = topojson.mesh(world, world.objects.countries, (a:unknown,b:unknown)=>a!==b);
      geoG.append("path").datum(borders)
        .attr("d", path as d3.ValueFn<SVGPathElement,unknown,string>)
        .attr("fill","none").attr("stroke","#1a3320").attr("stroke-width","0.3");

      function pulseHalo(parent: d3.Selection<SVGGElement, any, null, undefined>, ringR: number, stroke: string) {
        parent.append("circle")
          .attr("r", ringR)
          .attr("cx", 0).attr("cy", 0)
          .attr("fill", "none").attr("stroke", stroke).attr("stroke-width", 0.75).attr("stroke-opacity", 0.18)
          .append("animate")
          .attr("attributeName", "stroke-opacity")
          .attr("values", "0.08;0.28;0.08")
          .attr("dur", "2.4s")
          .attr("repeatCount", "indefinite");
      }

      const markerQueue: ObMapMarkerDraw[] = [];

      for (const o of outbreaks) {
        const lat = Number(o.lat);
        const lng = Number(o.lng);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;

        const col = RISK_COL(o.risk_level, o.conspiracy_score);
        const isSel = selected?.id === o.id;
        // Larger floor radius so pins stay visible on wide maps (was ~4–9px, easy to lose on dark landmass).
        const r = Math.max(8, 6 + Math.min(10, (o.conspiracy_score || 0) / 7));

        const mainPos = proj([lng, lat]);
        if (!mainPos) continue;

        const allPositions: Array<[number, number, string]> = [[mainPos[0], mainPos[1], "primary"]];

        if (o.affectedCoords && o.affectedCoords.length > 1) {
          for (const ac of o.affectedCoords) {
            if (Math.abs(ac.lat - lat) < 0.1 && Math.abs(ac.lng - lng) < 0.1) continue;
            const ap = proj([ac.lng, ac.lat]);
            if (ap) allPositions.push([ap[0], ap[1], ac.country]);
          }
        }

        // All connector lines first so later outbreaks' lines are not painted over pins.
        if (allPositions.length > 1) {
          for (let i = 1; i < allPositions.length; i++) {
            const [x1, y1] = allPositions[0];
            const [x2, y2] = allPositions[i];
            linesG
              .append("line")
              .attr("x1", x1)
              .attr("y1", y1)
              .attr("x2", x2)
              .attr("y2", y2)
              .attr("stroke", col)
              .attr("stroke-width", isSel ? 1.1 : 0.85)
              .attr("stroke-opacity", isSel ? 0.5 : 0.22)
              .attr("stroke-dasharray", "4 6");
          }
        }

        for (let pi = 0; pi < allPositions.length; pi++) {
          const [x, y] = allPositions[pi];
          const isPrimary = pi === 0;
          const dotR = isPrimary ? r : Math.max(5, r - 2);
          markerQueue.push({ o, x, y, isPrimary, dotR, col, isSel });
        }
      }

      for (const m of markerQueue) {
        const { o, x, y, isPrimary, dotR, col, isSel } = m;

        const mg = markersG
          .append("g")
          .datum({ x, y })
          .attr("class", "ob-marker")
          .attr("transform", `translate(${x},${y}) scale(1)`);

        pulseHalo(mg, dotR + 6, col);
        mg.append("circle")
          .attr("cx", 0)
          .attr("cy", 0)
          .attr("r", dotR + 3)
          .attr("fill", col)
          .attr("fill-opacity", "0.12");
        // High-contrast rim on dark map
        mg.append("circle")
          .attr("cx", 0)
          .attr("cy", 0)
          .attr("r", dotR + 1.2)
          .attr("fill", "none")
          .attr("stroke", "#e8ffe8")
          .attr("stroke-opacity", isPrimary ? 0.55 : 0.35)
          .attr("stroke-width", isSel && isPrimary ? 2.2 : 1.4);
        mg.append("circle")
          .attr("cx", 0)
          .attr("cy", 0)
          .attr("r", isSel && isPrimary ? dotR + 1.5 : dotR)
          .attr("fill", col)
          .attr("fill-opacity", isPrimary ? 0.95 : 0.72)
          .attr("stroke", "#030806")
          .attr("stroke-width", isSel && isPrimary ? 1.4 : 1)
          .style("cursor", "pointer")
          .on("mouseenter", function (event) {
            setTooltip({ x: event.offsetX, y: event.offsetY, o });
            d3.select(this).attr("fill-opacity", "1");
          })
          .on("mouseleave", function () {
            setTooltip(null);
            d3.select(this).attr("fill-opacity", isPrimary ? "0.95" : "0.72");
          })
          .on("click", () => onSelect(o));

        if (isPrimary && (isSel || o.conspiracy_score >= 40)) {
          // Outer glow circle uses r = dotR + 3; keep label clear of that + glyph stroke.
          const labelX = dotR + 3 + 12;
          mg.append("text")
            .attr("x", labelX)
            .attr("y", 0)
            .attr("dominant-baseline", "middle")
            .attr("fill", col)
            .attr("font-size", "9")
            .attr("font-weight", "700")
            .attr("font-family", "'Share Tech Mono',monospace")
            .attr("letter-spacing", "0.5")
            .attr("paint-order", "stroke")
            .attr("stroke", "#030806")
            .attr("stroke-width", 3)
            .attr("stroke-opacity", 0.85)
            .text(o.disease.toUpperCase().slice(0, 14));
        }
      }

      function applyObMarkerScale(t: d3.ZoomTransform) {
        const k = t.k || 1;
        markersG.selectAll<SVGGElement, { x: number; y: number }>("g.ob-marker").attr("transform", (d) => `translate(${d.x},${d.y}) scale(${1 / k})`);
      }

      const zoom = d3.zoom<SVGSVGElement, unknown>()
        .extent([[0, 0], [W, H]])
        .scaleExtent([1, 10])
        .on("zoom", (event: d3.D3ZoomEvent<SVGSVGElement, unknown>) => {
          geoG.attr("transform", String(event.transform)); // lines + map + markers (markers counter-scale inside)
          applyObMarkerScale(event.transform);
          setTooltip(null);
        });
      svg.call(zoom);
      geoG.attr("transform", String(d3.zoomIdentity));
      applyObMarkerScale(d3.zoomIdentity);

      const ctrl = svg.append("g").attr("transform", `translate(${W - 36}, 10)`);
      [
        { dy: 0, label: "+", delta: 1.5 },
        { dy: 22, label: "−", delta: 1 / 1.5 },
        { dy: 44, label: "⌂", delta: null as number | null },
      ].forEach(({ dy, label, delta }) => {
        const btn = ctrl.append("g").attr("transform", `translate(0,${dy})`).style("cursor", "pointer");
        btn.append("rect").attr("width", 22).attr("height", 18).attr("rx", 2).attr("fill", "rgba(9,15,11,0.85)").attr("stroke", "#1a3320");
        btn.append("text").attr("x", 11).attr("y", 13).attr("text-anchor", "middle").attr("fill", "#5a8068").attr("font-size", "12").attr("font-family", "monospace").text(label);
        btn.on("click", () => {
          if (delta === null) svg.transition().duration(400).call(zoom.transform, d3.zoomIdentity);
          else svg.transition().duration(220).call(zoom.scaleBy, delta);
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

    }

    paint();
    const ro = new ResizeObserver(() => paint());
    ro.observe(svgEl);
    return () => ro.disconnect();
  },[world,outbreaks,selected,onSelect]);

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
        <div style={{position:"absolute",left:tooltip.x+12,top:tooltip.y-20,background:"#090f0b",border:`1px solid ${RISK_COL(tooltip.o.risk_level,tooltip.o.conspiracy_score)}`,borderRadius:3,padding:"8px 10px",pointerEvents:"none",zIndex:20,maxWidth:200}}>
          <div style={{fontFamily:RAJ,fontSize:12,fontWeight:700,color:"#e8ffe8",marginBottom:3}}>{tooltip.o.disease}</div>
          <div style={{fontSize:9,color:"#5a8068",letterSpacing:1,marginBottom:5}}>{tooltip.o.location.toUpperCase()}</div>
          <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
            <span style={{fontSize:9,color:RISK_COL(tooltip.o.risk_level,tooltip.o.conspiracy_score),border:`1px solid ${RISK_COL(tooltip.o.risk_level,tooltip.o.conspiracy_score)}`,padding:"1px 5px",borderRadius:2}}>{tooltip.o.risk_level}</span>
            {tooltip.o.has_conspiracy&&<span style={{fontSize:9,color:"#c94dff",border:"1px solid rgba(201,77,255,0.4)",padding:"1px 5px",borderRadius:2}}>CONSPIRACY</span>}
          </div>
        </div>
      )}
    </div>
  );
}

// ── OUTBREAK CARD ──────────────────────────────────────────────
function OutbreakCard({o,selected,onClick}:{o:Outbreak;selected:boolean;onClick:()=>void}) {
  const col = RISK_COL(o.risk_level, o.conspiracy_score);
  const vs  = VERDICT_STYLE(o.verdict);
  return (
    <div onClick={onClick} style={{border:`1px solid ${selected?col:"#1a3320"}`,borderRadius:4,background:selected?"rgba(0,0,0,0.5)":"#090f0b",padding:"13px 15px",cursor:"pointer",transition:"border-color 0.15s"}}
      onMouseEnter={e=>{(e.currentTarget as HTMLDivElement).style.borderColor=col;}}
      onMouseLeave={e=>{if(!selected)(e.currentTarget as HTMLDivElement).style.borderColor="#1a3320";}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:7}}>
        <div>
          <div style={{fontFamily:RAJ,fontSize:15,fontWeight:700,color:"#e8ffe8",lineHeight:1.3}}>{o.disease}</div>
          <div style={{fontSize:11,color:"#5a8068",letterSpacing:1,marginTop:3}}>{o.location.toUpperCase()}</div>
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:4,alignItems:"flex-end"}}>
          <span style={{fontSize:11,color:col,border:`1px solid ${col}`,padding:"2px 7px",borderRadius:2,fontFamily:RAJ,fontWeight:700,letterSpacing:1}}>{o.risk_level}</span>
          {o.has_conspiracy&&<span style={{fontSize:11,color:"#c94dff",border:"1px solid rgba(201,77,255,0.3)",padding:"2px 7px",borderRadius:2,letterSpacing:1}}>⚠ CONSPIRACY</span>}
          {o.localNews&&o.localNews.length>0&&<span style={{fontSize:11,color:"#00bb66",border:"1px solid rgba(0,187,102,0.3)",padding:"2px 7px",borderRadius:2,letterSpacing:1}}>◉ {o.localNews.length} LOCAL NEWS</span>}
        </div>
      </div>
      <div style={{fontSize:11,color:"#5a8068",lineHeight:1.65,marginBottom:9}}>
        {o.description.slice(0,110)}{o.description.length>110?"...":""}
      </div>
      <div style={{display:"flex",alignItems:"center",gap:8}}>
        <div style={{fontSize:10,color:"#3a5040",letterSpacing:1,flexShrink:0}}>THREAT</div>
        <div style={{flex:1,height:2,background:"#1a3320",borderRadius:1,overflow:"hidden"}}>
          <div style={{height:"100%",width:`${o.conspiracy_score}%`,background:col,borderRadius:1}}/>
        </div>
        <div style={{fontFamily:RAJ,fontSize:14,fontWeight:700,color:col,flexShrink:0}}>{o.conspiracy_score}%</div>
      </div>
      <div style={{marginTop:8,padding:"3px 8px",display:"inline-block",background:vs.bg,border:`1px solid ${vs.border}`,borderRadius:2,fontSize:10,color:vs.col,letterSpacing:1}}>
        {o.verdict.replace(/_/g," ")}
      </div>
    </div>
  );
}

// ── OUTBREAK DETAIL ────────────────────────────────────────────
function OutbreakDetail({o}:{o:Outbreak}) {
  const col = RISK_COL(o.risk_level, o.conspiracy_score);
  const vs  = VERDICT_STYLE(o.verdict);

  return (
    <div style={{border:"1px solid #1a3320",borderRadius:4,background:"#090f0b",overflow:"hidden"}}>
      <div style={{padding:"14px 16px",borderBottom:"1px solid #1a3320",background:"#050c07"}}>
        <div style={{fontFamily:RAJ,fontSize:18,fontWeight:700,color:"#e8ffe8",marginBottom:6}}>{o.disease}</div>
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          <span style={{fontSize:11,color:"#5a8068",letterSpacing:1}}>{o.location.toUpperCase()}</span>
          <span style={{fontSize:11,color:col,border:`1px solid ${col}`,padding:"2px 7px",borderRadius:2}}>{o.risk_level}</span>
          <span style={{fontSize:11,padding:"2px 8px",background:vs.bg,border:`1px solid ${vs.border}`,borderRadius:2,color:vs.col,letterSpacing:1}}>{o.verdict.replace(/_/g," ")}</span>
        </div>
      </div>

      <div style={{padding:"14px 16px",display:"flex",flexDirection:"column",gap:14,maxHeight:580,overflowY:"auto"}}>

        {/* Score */}
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div>
            <div style={{fontSize:10,color:"#5a8068",letterSpacing:2,marginBottom:4}}>CONSPIRACY SCORE</div>
            <div style={{fontFamily:RAJ,fontSize:36,fontWeight:700,color:col,lineHeight:1}}>{o.conspiracy_score}%</div>
          </div>
          <div style={{width:120}}>
            <div style={{height:4,background:"#1a3320",borderRadius:2,overflow:"hidden"}}>
              <div style={{height:"100%",width:`${o.conspiracy_score}%`,background:col,borderRadius:2}}/>
            </div>
          </div>
        </div>

        <div style={{fontSize:12,color:"#7aaa8a",lineHeight:1.7}}>{o.description}</div>

        {/* Key facts */}
        {o.key_facts?.length>0&&(
          <div>
            <div style={{fontSize:10,color:"#5a8068",letterSpacing:2,marginBottom:8,textTransform:"uppercase"}}>Key Facts</div>
            {o.key_facts.map((f,i)=>(
              <div key={i} style={{display:"flex",gap:8,color:"#7aaa8a",fontSize:12,marginBottom:6,lineHeight:1.6,alignItems:"flex-start"}}>
                <span style={{color:"#00bb66",flexShrink:0}}>▸</span><span>{f}</span>
              </div>
            ))}
          </div>
        )}

        {/* LOCAL NEWS — the smart part */}
        {o.localNews&&o.localNews.length>0&&(
          <div>
            <div style={{fontSize:10,color:"#00bb66",letterSpacing:2,marginBottom:8,textTransform:"uppercase"}}>
              ◉ LOCAL COVERAGE FROM ORIGIN COUNTRY ({o.localNews.length} articles)
            </div>
            <div style={{fontSize:11,color:"#3a5040",marginBottom:8,letterSpacing:1,lineHeight:1.6}}>
              Articles published in or about {o.origin_country?.toUpperCase()||o.location.toUpperCase()} — early signals appear here first
            </div>
            {o.localNews.map((n,i)=>(
              <a key={i} href={n.url} target="_blank" rel="noreferrer"
                style={{display:"block",border:"1px solid #1a3320",borderRadius:3,padding:"10px 12px",marginBottom:7,textDecoration:"none",background:"rgba(0,255,136,0.02)",transition:"border-color 0.15s"}}
                onMouseEnter={e=>{(e.currentTarget as HTMLAnchorElement).style.borderColor="#00bb66";}}
                onMouseLeave={e=>{(e.currentTarget as HTMLAnchorElement).style.borderColor="#1a3320";}}>
                <div style={{fontFamily:RAJ,fontSize:13,fontWeight:700,color:"#c8e8d0",lineHeight:1.35,marginBottom:5}}>{n.title}</div>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <span style={{fontSize:11,color:"#5a8068",letterSpacing:1}}>{n.source}</span>
                  <span style={{fontSize:11,color:"#3a5040"}}>{n.pubDate?new Date(n.pubDate).toLocaleDateString():""}</span>
                </div>
              </a>
            ))}
          </div>
        )}

        {/* Theories */}
        {o.theories?.length>0&&(
          <div>
            <div style={{fontSize:10,color:"#c94dff",letterSpacing:2,marginBottom:8,textTransform:"uppercase"}}>◈ Conspiracy Theories ({o.theories.length})</div>
            {o.theories.map((t,i)=>(
              <div key={i} style={{border:"1px solid rgba(201,77,255,0.2)",borderRadius:3,padding:"11px 13px",background:"rgba(20,8,24,0.6)",marginBottom:8}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
                  <div style={{fontFamily:RAJ,fontSize:13,fontWeight:700,color:"#e9b3ff"}}>{t.name}</div>
                  <div style={{fontFamily:RAJ,fontSize:18,fontWeight:700,color:RISK_COL("",t.probability),flexShrink:0}}>{t.probability}%</div>
                </div>
                <div style={{fontSize:11,color:"#7a5a88",lineHeight:1.65,marginBottom:7}}>{t.summary}</div>
                {t.sources?.filter(s=>/^https?:\/\//.test(s)).map((s,j)=>(
                  <a key={j} href={s} target="_blank" rel="noreferrer"
                    style={{display:"flex",gap:6,color:"#00bb66",fontSize:10,textDecoration:"none",marginBottom:4,wordBreak:"break-all"}}>
                    <span style={{flexShrink:0}}>↗</span><span>{s}</span>
                  </a>
                ))}
              </div>
            ))}
          </div>
        )}

        {/* Patents */}
        {o.patents?.length>0&&(
          <div>
            <div style={{fontSize:10,color:"#ff5555",letterSpacing:2,marginBottom:8,textTransform:"uppercase"}}>◈ Related Patents ({o.patents.length})</div>
            {o.patents.map((p,i)=>(
              <a key={i} href={p.url} target="_blank" rel="noreferrer"
                style={{display:"block",border:"1px solid rgba(255,85,85,0.2)",borderRadius:3,padding:"10px 12px",background:"rgba(26,10,10,0.6)",marginBottom:7,textDecoration:"none",transition:"border-color 0.15s"}}
                onMouseEnter={e=>{(e.currentTarget as HTMLAnchorElement).style.borderColor="#ff5555";}}
                onMouseLeave={e=>{(e.currentTarget as HTMLAnchorElement).style.borderColor="rgba(255,85,85,0.2)";}}>
                <div style={{fontSize:10,color:"#ff5555",letterSpacing:1,marginBottom:4}}>{p.number} · {p.assignee}</div>
                <div style={{fontFamily:RAJ,fontSize:12,fontWeight:700,color:"#ffe8e8"}}>{p.title}</div>
                <div style={{fontSize:10,color:"#5a4040",marginTop:4}}>↗ View on Google Patents</div>
              </a>
            ))}
          </div>
        )}

        {/* Polymarket */}
        <PolymarketWidget
          query={`${o.disease} ${o.origin_country || o.location}`}
          context={[o.title, o.description, o.key_facts?.join(" ")].filter(Boolean).join(" ").slice(0, 2000)}
        />

        {/* Source */}
        <div style={{paddingTop:8,borderTop:"1px solid #1a3320",display:"flex",gap:12}}>
          <a href={o.source_url} target="_blank" rel="noreferrer"
            style={{fontSize:9,color:"#00bb66",textDecoration:"none",letterSpacing:1}}>↗ WHO SOURCE</a>
          <Link href={`/search?q=${encodeURIComponent(o.disease)}`}
            style={{fontSize:9,color:"#5a8068",textDecoration:"none",letterSpacing:1}}>◈ SEARCH DATABASE</Link>
        </div>
      </div>
    </div>
  );
}

// ── MAIN ───────────────────────────────────────────────────────
export default function OutbreakTracker() {
  const [data, setData]         = useState<{outbreaks:Outbreak[];generated_at:string}|null>(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState("");
  const [selected, setSelected] = useState<Outbreak|null>(null);
  const [filter, setFilter]     = useState<"all"|"conspiracy"|"high">("all");

  useEffect(()=>{
    fetch("/api/outbreaks")
      .then(r=>r.json())
      .then(d=>{setData(d);if(d.outbreaks?.length)setSelected(d.outbreaks[0]);})
      .catch(()=>setError("Failed to load outbreak data."))
      .finally(()=>setLoading(false));
  },[]);

  if (loading) return <OutbreakLoadingScreen/>;

  const outbreaks = data?.outbreaks??[];
  const visible = outbreaks.filter(o=>{
    if (filter==="conspiracy") return o.has_conspiracy;
    if (filter==="high") return o.risk_level==="HIGH"||o.risk_level==="CRITICAL";
    return true;
  });

  return (
    <div style={{minHeight:"100vh",background:"#050c07",color:"#c8e8d0",fontFamily:FONT}}>
      <div className="scanline"/>
      <div style={{position:"relative",zIndex:1}}>

        {/* NAV */}
        <div style={{height:44,background:"#050c07",borderBottom:"1px solid #1a3320",display:"flex",alignItems:"center",padding:"0 16px",gap:12}}>
          <Link href="/" style={{fontSize:10,color:"#5a8068",textDecoration:"none",letterSpacing:2,border:"1px solid #1a3320",padding:"4px 10px",borderRadius:3}}>← FEED</Link>
          <div style={{width:1,height:20,background:"#1a3320"}}/>
          <div style={{fontFamily:RAJ,fontSize:14,fontWeight:700,color:"#00ff88",letterSpacing:2}}>THE THEORIST</div>
          <div style={{width:1,height:20,background:"#1a3320"}}/>
          <div style={{fontFamily:RAJ,fontSize:11,color:"#5a8068",letterSpacing:2}}>OUTBREAK TRACKER</div>
          <div style={{marginLeft:"auto",fontSize:10,color:"#3a5040",letterSpacing:1}}>
            WHO · GNEWS · {data?`Updated ${new Date(data.generated_at).toLocaleTimeString()}`:""}
          </div>
        </div>

        <div style={pageContentShellStyle()}>

          {/* HEADER */}
          <div style={{marginBottom:"1.25rem",paddingBottom:"1rem",borderBottom:"1px solid #1a3320"}}>
            <div style={{fontFamily:RAJ,fontSize:11,letterSpacing:5,color:"#5a8068",marginBottom:5,textTransform:"uppercase"}}>■ AI-POWERED GLOBAL DISEASE SURVEILLANCE ■</div>
            <h1 style={{fontFamily:RAJ,fontSize:26,fontWeight:700,color:"#00ff88",letterSpacing:2,textTransform:"uppercase",textShadow:"0 0 16px rgba(0,255,136,0.2)",margin:"0 0 4px"}}>Outbreak Tracker</h1>
            <div style={{fontSize:11,color:"#3a5040",letterSpacing:2}}>WHO FEED · LOCAL NEWS EARLY SIGNALS · CONSPIRACY PATTERN DETECTION · USPTO PATENTS</div>
          </div>

          {/* STATS */}
          {data&&(
            <div style={{display:"flex",gap:10,marginBottom:"1.25rem",flexWrap:"wrap"}}>
              {[
                {label:"ACTIVE OUTBREAKS",value:outbreaks.length,col:"#00ff88"},
                {label:"HIGH/CRITICAL",value:outbreaks.filter(o=>o.risk_level==="HIGH"||o.risk_level==="CRITICAL").length,col:"#ff3333"},
                {label:"CONSPIRACY FLAGS",value:outbreaks.filter(o=>o.has_conspiracy).length,col:"#c94dff"},
                {label:"LOCAL NEWS FEEDS",value:outbreaks.reduce((a,o)=>a+(o.localNews?.length??0),0),col:"#00bb66"},
              ].map(({label,value,col})=>(
                <div key={label} style={{border:"1px solid #1a3320",borderRadius:3,padding:"8px 14px",background:"#090f0b"}}>
                  <div style={{fontSize:9,color:"#3a5040",letterSpacing:2,marginBottom:3}}>{label}</div>
                  <div style={{fontFamily:RAJ,fontSize:22,fontWeight:700,color:col,lineHeight:1}}>{value}</div>
                </div>
              ))}
            </div>
          )}

          {/* FILTERS */}
          <div style={{display:"flex",gap:6,marginBottom:"1rem"}}>
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

          {error&&<div style={{padding:12,border:"1px solid rgba(255,51,51,0.3)",borderRadius:3,color:"#ff3333",fontSize:11}}>[ERROR] {error}</div>}

          {/* MAIN GRID */}
          {data&&(
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(0, 1fr) minmax(260px, 320px)",
                gap: "1.25rem",
                alignItems: "start",
              }}
            >
              <div style={{ display: "flex", flexDirection: "column", gap: "1.75rem", minWidth: 0 }}>
                <WorldMap outbreaks={visible} selected={selected} onSelect={setSelected} />
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
                  {visible.map(o=>(
                    <OutbreakCard key={o.id} o={o} selected={selected?.id===o.id} onClick={()=>setSelected(o)}/>
                  ))}
                </div>
              </div>
              <div>
                {selected
                  ? <OutbreakDetail o={selected}/>
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
