"use client";
import type { CSSProperties } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import * as d3 from "d3";
import * as topojson from "topojson-client";
import PolymarketWidget from "@/components/PolymarketWidget";
import { pageContentShellStyle } from "@/lib/pageShell";

const FONT = "var(--font-share-tech-mono), monospace";
const RAJ  = "var(--font-raj), sans-serif";

interface UAPData {
  incidents: Incident[]; people: Person[]; organizations: Org[];
  documents: Document[]; news: News[]; stats?: Record<string,number>; generated_at: string;
}
type Classification = "DECLASSIFIED"|"CONFIRMED"|"REPORTED"|"ALLEGED";
type EvidenceLevel  = "HIGH"|"MEDIUM"|"LOW";

interface Incident { id:string; name:string; date:string; location:string; lat:number; lng:number; classification:Classification; evidenceLevel:EvidenceLevel; description:string; witnesses:string[]; documents:string[]; relatedOrgs:string[]; tags:string[]; }
interface Person   { id:string; name:string; role:string; affiliation:string; clearance:string; bio:string; significance:string; linkedIncidents:string[]; linkedOrgs:string[]; }
interface Org      { id:string; name:string; fullName:string; type:string; founded:string; status:string; description:string; transparency:string; url:string; }
interface Document { id:string; name:string; year:number; type:string; classification:string; url:string; description:string; }
interface News     { title:string; url:string; source:string; pubDate:string; type?: string }

interface Sighting {
  id: string; source: string; source_url: string | null;
  title: string; description: string; location_name: string | null;
  lat: number | null; lng: number | null;
  event_date: string | null; shape: string | null; duration_text: string | null;
  classification: string; upvotes: number; comment_count: number; created_at: string;
}
interface SightingComment {
  id: string; author_name: string; content: string; likes: number; dislikes: number; created_at: string;
}

const CLASS_COL: Record<Classification,string> = { DECLASSIFIED:"#00ff88", CONFIRMED:"#00bb66", REPORTED:"#ffaa00", ALLEGED:"#5a8068" };
const EVD_COL:   Record<EvidenceLevel,string>  = { HIGH:"#ff3333", MEDIUM:"#ffaa00", LOW:"#00bb66" };
const SIGHTING_COL = "#ffcc00";

function classStyle(c:Classification) {
  const col = CLASS_COL[c]??"#5a8068";
  return { color:col, border:`1px solid ${col}`, background:`${col}18`, padding:"2px 7px", borderRadius:2, fontSize:9, letterSpacing:1 };
}

function timeAgo(d: string) {
  const diff = Date.now() - new Date(d).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

/** Legacy one-line bodies: split at sentence starts so paragraphs can render. */
function softBreakLongProse(text: string, minLen = 380): string {
  const t = text.replace(/\r\n/g, "\n").trim();
  if (t.length < minLen || /\n/.test(t)) return t;
  return t.replace(/(?<=[.!?])\s+(?=[A-Z0-9("“„])/g, "\n\n");
}

/** Plain / near-plain text with real line breaks and comfortable paragraph spacing. */
function ReadableProse({
  text,
  softBreak = false,
  style,
}: {
  text: string;
  softBreak?: boolean;
  style?: CSSProperties;
}) {
  const raw = (softBreak ? softBreakLongProse(text) : text).replace(/\r\n/g, "\n").trim();
  if (!raw) return null;
  const blocks = raw.split(/\n{2,}/).map((b) => b.trim()).filter(Boolean);
  const base: CSSProperties = {
    lineHeight: 1.85,
    wordBreak: "break-word",
    overflowWrap: "break-word",
    ...style,
  };
  return (
    <div style={base}>
      {blocks.map((block, i) => (
        <p
          key={i}
          style={{
            margin: i === blocks.length - 1 ? 0 : "0 0 1em 0",
            whiteSpace: "pre-wrap",
          }}
        >
          {block}
        </p>
      ))}
    </div>
  );
}

// ── WORLD MAP (zoom + sightings layer) ────────────────────────
interface TooltipData {
  x: number; y: number;
  kind: "incident" | "sighting";
  i?: Incident;
  s?: Sighting;
}

function UAPMap({
  incidents, selected, onSelect,
  sightings, onSelectSighting, showSightings,
  mapTab, selectedSighting,
}: {
  incidents: Incident[]; selected: Incident | null; onSelect: (i: Incident) => void;
  sightings: Sighting[]; onSelectSighting: (s: Sighting) => void; showSightings: boolean;
  mapTab: "incidents" | "sightings" | "people" | "orgs" | "documents" | "news";
  selectedSighting: Sighting | null;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const gRef   = useRef<SVGGElement | null>(null);
  const zoomTransformRef = useRef<d3.ZoomTransform>(d3.zoomIdentity);
  const [world, setWorld] = useState<unknown>(null);
  const [tooltip, setTooltip] = useState<TooltipData | null>(null);
  const projRef = useRef<d3.GeoProjection | null>(null);

  useEffect(()=>{ fetch("https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json").then(r=>r.json()).then(setWorld).catch(()=>{}); },[]);

  useEffect(()=>{
    if (!world||!svgRef.current) return;
    const svgEl = svgRef.current;

    function paint() {
      if (!svgEl || !world) return;
      const W = Math.max(svgEl.getBoundingClientRect().width || svgEl.clientWidth, 280);
      const H = 380;
      svgEl.setAttribute("width", String(W));
      svgEl.setAttribute("height", String(H));

      const svg = d3.select(svgEl);
      svg.selectAll("*").remove();

      const proj = d3.geoNaturalEarth1();
      proj.fitSize([W, H], { type: "Sphere" });
      projRef.current = proj;
      const path = d3.geoPath().projection(proj);

      svg.append("rect").attr("width",W).attr("height",H).attr("fill","#030806");

      /** Map + markers share zoom on `geoG`; each pin uses translate(x,y) scale(1/k) so size stays ~constant in px. */
      const geoG = svg.append("g").attr("class", "uap-geo");
      gRef.current = geoG.node();

      const grat = d3.geoGraticule()();
      geoG.append("path").datum(grat).attr("d",path as d3.ValueFn<SVGPathElement,unknown,string>).attr("fill","none").attr("stroke","#0a1f0d").attr("stroke-width","0.3");
      // @ts-expect-error TopoJSON topology typed loosely vs GeoJSON
      const countries = topojson.feature(world, world.objects.countries);
      geoG.append("g").selectAll("path")
        // @ts-expect-error features from topojson.feature
        .data(countries.features).enter().append("path")
        .attr("d",path as d3.ValueFn<SVGPathElement,unknown,string>)
        .attr("fill","#0a160c").attr("stroke","#1a3320").attr("stroke-width","0.4");

      const markersG = geoG.append("g").attr("class", "uap-markers");

      const sightingsView = mapTab === "sightings";
      const showSightingPins = sightingsView || showSightings;
      const showIncidentPins = !sightingsView;

      function pulseRing(parent: d3.Selection<SVGGElement, any, null, undefined>, r: number, stroke: string) {
        parent
          .append("circle")
          .attr("r", r)
          .attr("cx", 0)
          .attr("cy", 0)
          .attr("fill", "none")
          .attr("stroke", stroke)
          .attr("stroke-width", 0.85)
          .attr("stroke-opacity", 0.2)
          .append("animate")
          .attr("attributeName", "stroke-opacity")
          .attr("values", "0.1;0.32;0.1")
          .attr("dur", "2.6s")
          .attr("repeatCount", "indefinite");
      }

      if (showSightingPins) {
        for (const s of sightings) {
          if (s.lat == null || s.lng == null) continue;
          const pos = proj([s.lng, s.lat]);
          if (!pos) continue;
          const [x, y] = pos;
          const isSel = selectedSighting?.id === s.id;
          const r = sightingsView ? (isSel ? 6 : 4.5) : (isSel ? 5 : 3.8);
          const mg = markersG
            .append("g")
            .datum({ x, y })
            .attr("class", "uap-marker")
            .attr("transform", `translate(${x},${y}) scale(1)`);
          pulseRing(mg, r + 4, SIGHTING_COL);
          if (isSel) {
            mg.append("circle").attr("cx", 0).attr("cy", 0).attr("r", r + 6).attr("fill", "none").attr("stroke", SIGHTING_COL).attr("stroke-width", 1).attr("stroke-opacity", 0.45);
          }
          mg.append("circle")
            .attr("cx", 0)
            .attr("cy", 0)
            .attr("r", r)
            .attr("fill", SIGHTING_COL)
            .attr("fill-opacity", isSel ? 0.95 : 0.68)
            .attr("stroke", SIGHTING_COL)
            .attr("stroke-width", isSel ? 1.6 : 0.75)
            .style("cursor", "pointer")
            .on("mouseenter", function (event) {
              setTooltip({ x: event.offsetX, y: event.offsetY, kind: "sighting", s });
              d3.select(this).attr("fill-opacity", "1");
            })
            .on("mouseleave", function () {
              setTooltip(null);
              d3.select(this).attr("fill-opacity", isSel ? "0.95" : "0.68");
            })
            .on("click", () => onSelectSighting(s));
        }
      }

      // Official incident pins (hidden on SIGHTINGS tab)
      if (showIncidentPins) {
        for (const inc of incidents) {
          if (inc.lat == null || inc.lng == null) continue;
          const pos = proj([inc.lng, inc.lat]);
          if (!pos) continue;
          const [x, y] = pos;
          const col = CLASS_COL[inc.classification] ?? "#5a8068";
          const isSel = selected?.id === inc.id;
          const r = isSel ? 7 : 5;
          const mg = markersG
            .append("g")
            .datum({ x, y })
            .attr("class", "uap-marker")
            .attr("transform", `translate(${x},${y}) scale(1)`);
          pulseRing(mg, r + 3, col);
          mg.append("circle")
            .attr("cx", 0)
            .attr("cy", 0)
            .attr("r", r + 3)
            .attr("fill", "none")
            .attr("stroke", col)
            .attr("stroke-width", 0.7)
            .attr("stroke-opacity", 0.18);
          mg.append("circle")
            .attr("cx", 0)
            .attr("cy", 0)
            .attr("r", r)
            .attr("fill", col)
            .attr("fill-opacity", isSel ? 0.95 : 0.78)
            .attr("stroke", col)
            .attr("stroke-width", isSel ? 1.8 : 0.9)
            .style("cursor", "pointer")
            .on("mouseenter", function (event) {
              setTooltip({ x: event.offsetX, y: event.offsetY, kind: "incident", i: inc });
              d3.select(this).attr("fill-opacity", "1");
            })
            .on("mouseleave", function () {
              setTooltip(null);
              d3.select(this).attr("fill-opacity", isSel ? "0.95" : "0.78");
            })
            .on("click", () => onSelect(inc));
          if (isSel || inc.evidenceLevel === "HIGH") {
            mg.append("text")
              .attr("x", r + 5)
              .attr("y", 3)
              .attr("fill", col)
              .attr("font-size", "7")
              .attr("font-family", "'Share Tech Mono',monospace")
              .attr("letter-spacing", "1")
              .text(inc.name.toUpperCase().slice(0, 16));
          }
        }
      }

      function applyMarkerScale(t: d3.ZoomTransform) {
        const k = t.k || 1;
        markersG.selectAll<SVGGElement, { x: number; y: number }>("g.uap-marker").attr("transform", (d) => `translate(${d.x},${d.y}) scale(${1 / k})`);
      }

      // Zoom on geoG (map + markers); marker groups counter-scale so radii stay ~px-stable
      const zoom = d3.zoom<SVGSVGElement, unknown>()
        .extent([[0, 0], [W, H]])
        .scaleExtent([1, 12])
        .on("zoom", (event: d3.D3ZoomEvent<SVGSVGElement, unknown>) => {
          zoomTransformRef.current = event.transform;
          geoG.attr("transform", String(event.transform));
          applyMarkerScale(event.transform);
          setTooltip(null);
        });
      svg.call(zoom);
      svg.call(zoom.transform, zoomTransformRef.current);

      // Zoom controls (+ / − / reset)
      const ctrl = svg.append("g").attr("transform", `translate(${W-36},10)`);
      [
        { dy:0, label:"+", delta:1.6 },
        { dy:22, label:"−", delta:1/1.6 },
        { dy:44, label:"⌂", delta:null },
      ].forEach(({ dy, label, delta }) => {
        const btn = ctrl.append("g").attr("transform",`translate(0,${dy})`).style("cursor","pointer");
        btn.append("rect").attr("width",22).attr("height",18).attr("rx",2).attr("fill","rgba(9,15,11,0.85)").attr("stroke","#1a3320");
        btn.append("text").attr("x",11).attr("y",13).attr("text-anchor","middle").attr("fill","#5a8068").attr("font-size","12").attr("font-family","monospace").text(label);
        btn.on("click", () => {
          if (delta === null) {
            svg.transition().duration(400).call(zoom.transform, d3.zoomIdentity);
          } else {
            svg.transition().duration(250).call(zoom.scaleBy, delta as number);
          }
        });
        btn.on("mouseenter", function(){ d3.select(this).select("rect").attr("stroke","#00bb66"); d3.select(this).select("text").attr("fill","#00ff88"); });
        btn.on("mouseleave", function(){ d3.select(this).select("rect").attr("stroke","#1a3320"); d3.select(this).select("text").attr("fill","#5a8068"); });
      });
    }

    paint();
    const ro = new ResizeObserver(() => paint());
    ro.observe(svgEl);
    return () => ro.disconnect();
  }, [world, incidents, selected, onSelect, sightings, showSightings, onSelectSighting, mapTab, selectedSighting]);

  return (
    <div style={{position:"relative"}}>
      <svg ref={svgRef} style={{width:"100%",height:380,maxWidth:"100%",background:"#030806",borderRadius:4,border:"1px solid #1a3320",display:"block"}}/>
      {tooltip&&(
        <div style={{position:"absolute",left:tooltip.x+12,top:Math.max(4,tooltip.y-10),background:"#090f0b",border:`1px solid ${tooltip.kind==="sighting"?SIGHTING_COL:(CLASS_COL[tooltip.i!.classification]??"#5a8068")}`,borderRadius:3,padding:"8px 10px",pointerEvents:"none",zIndex:20,maxWidth:240}}>
          {tooltip.kind==="incident"&&tooltip.i&&(
            <>
              <div style={{fontFamily:RAJ,fontSize:12,fontWeight:700,color:"#e8ffe8",marginBottom:3}}>{tooltip.i.name}</div>
              <div style={{fontSize:9,color:"#5a8068",marginBottom:5}}>{tooltip.i.date} · {tooltip.i.location}</div>
              <div style={{display:"flex",gap:5}}>
                <span style={classStyle(tooltip.i.classification)}>{tooltip.i.classification}</span>
                <span style={{...classStyle("REPORTED" as Classification),color:EVD_COL[tooltip.i.evidenceLevel],border:`1px solid ${EVD_COL[tooltip.i.evidenceLevel]}`}}>{tooltip.i.evidenceLevel}</span>
              </div>
            </>
          )}
          {tooltip.kind==="sighting"&&tooltip.s&&(
            <>
              <div style={{fontSize:8,color:SIGHTING_COL,letterSpacing:1,marginBottom:3}}>◈ NUFORC SIGHTING</div>
              <div style={{fontFamily:RAJ,fontSize:12,fontWeight:700,color:"#ffe8a0",marginBottom:3}}>{tooltip.s.title}</div>
              <div style={{fontSize:9,color:"#5a8068",marginBottom:3}}>{tooltip.s.event_date} · {tooltip.s.location_name}</div>
              {tooltip.s.shape&&<div style={{fontSize:9,color:"#ffaa00"}}>Shape: {tooltip.s.shape}</div>}
              <div style={{fontSize:8,color:"#3a5040",marginTop:4}}>Click to open</div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ── SIGHTING DETAIL + COMMENTS ────────────────────────────────
function SightingDetail({ sighting, onBack }: { sighting: Sighting; onBack: () => void }) {
  const [comments, setComments] = useState<SightingComment[]>([]);
  const [loadingComments, setLoadingComments] = useState(true);
  const [text, setText] = useState("");
  const [name, setName] = useState("Anonymous");
  const [posting, setPosting] = useState(false);
  const [upvotes, setUpvotes] = useState(sighting.upvotes);
  const [voted, setVoted] = useState(false);
  const [reactions, setReactions] = useState<Record<string,"like"|"dislike">>({});

  useEffect(() => {
    setLoadingComments(true);
    fetch(`/api/uap-sightings?id=${sighting.id}`)
      .then(r => r.json())
      .then((d: { comments?: SightingComment[] }) => setComments(d.comments ?? []))
      .catch(() => {})
      .finally(() => setLoadingComments(false));
    try {
      const stored = localStorage.getItem("theorist-uap-reactions");
      if (stored) setReactions(JSON.parse(stored) as Record<string,"like"|"dislike">);
    } catch {}
  }, [sighting.id]);

  async function upvote() {
    if (voted) return;
    setVoted(true);
    setUpvotes(u => u + 1);
    await fetch("/api/uap-sightings", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ action:"upvote", sighting_id:sighting.id }) }).catch(()=>{});
  }

  async function postComment() {
    if (!text.trim() || posting) return;
    setPosting(true);
    try {
      const res = await fetch("/api/uap-sightings", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ action:"add_comment", sighting_id:sighting.id, content:text.trim(), author_name:name }) });
      const d = await res.json() as { comment?: SightingComment };
      if (d.comment) { setComments(c => [...c, d.comment!]); setText(""); }
    } catch {}
    setPosting(false);
  }

  function reactComment(id: string, reaction: "like"|"dislike") {
    if (reactions[id] === reaction) return;
    const next = { ...reactions, [id]: reaction };
    setReactions(next);
    try { localStorage.setItem("theorist-uap-reactions", JSON.stringify(next)); } catch {}
    setComments(cs => cs.map(c => c.id !== id ? c : {
      ...c,
      likes: reaction === "like" ? c.likes + 1 : (reactions[id]==="like" ? Math.max(0,c.likes-1) : c.likes),
      dislikes: reaction === "dislike" ? c.dislikes + 1 : (reactions[id]==="dislike" ? Math.max(0,c.dislikes-1) : c.dislikes),
    }));
    fetch("/api/uap-sightings", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ action:"react_comment", comment_id:id, reaction }) }).catch(()=>{});
  }

  return (
    <div style={{display:"flex",flexDirection:"column",gap:12}}>
      {/* Back */}
      <button onClick={onBack} style={{alignSelf:"flex-start",background:"transparent",border:"1px solid #1a3320",color:"#5a8068",fontFamily:FONT,fontSize:10,padding:"4px 12px",borderRadius:3,cursor:"pointer",letterSpacing:1}}>
        ← BACK TO SIGHTINGS
      </button>

      {/* Header card */}
      <div style={{border:`1px solid ${SIGHTING_COL}44`,borderRadius:4,background:"#090f0b",overflow:"hidden"}}>
        <div style={{padding:"10px 14px",borderBottom:`1px solid ${SIGHTING_COL}22`,background:"rgba(255,204,0,0.04)"}}>
          <div style={{display:"flex",gap:8,marginBottom:6,flexWrap:"wrap",alignItems:"center"}}>
            <span style={{fontSize:9,color:SIGHTING_COL,border:`1px solid ${SIGHTING_COL}`,padding:"1px 7px",borderRadius:2,letterSpacing:1}}>NUFORC REPORT</span>
            {sighting.shape&&<span style={{fontSize:9,color:"#ffaa00",border:"1px solid rgba(255,170,0,0.4)",padding:"1px 7px",borderRadius:2,letterSpacing:1}}>{sighting.shape.toUpperCase()}</span>}
            {sighting.source_url&&<a href={sighting.source_url} target="_blank" rel="noreferrer" style={{marginLeft:"auto",fontSize:9,color:"#00bb66",textDecoration:"none"}}>↗ SOURCE</a>}
          </div>
          <div style={{fontFamily:RAJ,fontSize:18,fontWeight:700,color:"#ffe8a0",lineHeight:1.3,marginBottom:6}}>{sighting.title}</div>
          <div style={{fontSize:11,color:"#5a8068",letterSpacing:1,marginBottom:8}}>
            {sighting.event_date} · {sighting.location_name}
            {sighting.duration_text&&<> · Duration: {sighting.duration_text}</>}
          </div>
          <ReadableProse
            text={sighting.description}
            softBreak
            style={{ fontFamily: FONT, fontSize: 12, color: "#c8e8d0", marginBottom: 10 }}
          />
          <div style={{display:"flex",gap:10,alignItems:"center"}}>
            <button onClick={upvote} disabled={voted} style={{background:voted?"rgba(255,204,0,0.1)":"transparent",border:`1px solid ${voted?SIGHTING_COL:"#1a3320"}`,color:voted?SIGHTING_COL:"#5a8068",fontFamily:FONT,fontSize:10,padding:"4px 12px",borderRadius:3,cursor:voted?"default":"pointer",letterSpacing:1}}>
              ▲ {upvotes}
            </button>
            <span style={{fontSize:9,color:"#3a5040"}}>💬 {comments.length} comments</span>
          </div>
        </div>
      </div>

      {/* Comments */}
      <div style={{border:"1px solid #1a3320",borderRadius:4,background:"#090f0b",overflow:"hidden"}}>
        <div style={{padding:"10px 14px",borderBottom:"1px solid #1a3320",background:"#050c07"}}>
          <div style={{fontFamily:FONT,fontSize:10,color:"#00bb66",letterSpacing:2}}>◈ COMMUNITY ANALYSIS ({comments.length})</div>
        </div>
        {loadingComments ? (
          <div style={{padding:"16px",fontSize:10,color:"#3a5040",letterSpacing:1,textAlign:"center"}}>LOADING...</div>
        ) : (
          <>
            {comments.length === 0 && (
              <div style={{padding:"16px",fontSize:10,color:"#3a5040",letterSpacing:1,textAlign:"center"}}>No comments yet — be the first to analyze this sighting</div>
            )}
            {comments.map(c => (
              <div key={c.id} style={{padding:"10px 14px",borderBottom:"1px solid #0d1a10"}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
                  <span style={{fontFamily:RAJ,fontSize:11,fontWeight:700,color:"#c8e8d0"}}>{c.author_name}</span>
                  <span style={{fontSize:9,color:"#3a5040"}}>{timeAgo(c.created_at)}</span>
                </div>
                <ReadableProse
                  text={c.content}
                  style={{ fontFamily: FONT, fontSize: 11, color: "#c8e8d0", marginBottom: 8 }}
                />
                <div style={{display:"flex",gap:8}}>
                  {(["like","dislike"] as const).map(rt => {
                    const active = reactions[c.id] === rt;
                    const col = rt === "like" ? "#00ff88" : "#ff3333";
                    const count = rt === "like" ? c.likes : c.dislikes;
                    return (
                      <button key={rt} onClick={() => reactComment(c.id, rt)} style={{display:"flex",alignItems:"center",gap:4,background:active?`${col}12`:"transparent",border:`1px solid ${active?col:"#1a3320"}`,borderRadius:3,padding:"3px 9px",color:active?col:"#3a5040",fontFamily:FONT,fontSize:9,cursor:"pointer"}}>
                        {rt==="like"?"↑":"↓"} {count}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
            {/* New comment form */}
            <div style={{padding:"12px 14px",borderTop:"1px solid #1a3320",background:"#050c07"}}>
              <div style={{display:"flex",gap:6,marginBottom:6}}>
                <input value={name} onChange={e=>setName(e.target.value)} placeholder="Your name"
                  style={{width:120,background:"#090f0b",border:"1px solid #1a3320",borderRadius:3,padding:"6px 10px",color:"#c8e8d0",fontFamily:FONT,fontSize:10,outline:"none"}} />
              </div>
              <div style={{display:"flex",gap:6}}>
                <textarea value={text} onChange={e=>setText(e.target.value)}
                  onKeyDown={e=>{if(e.key==="Enter"&&(e.ctrlKey||e.metaKey)) void postComment();}}
                  placeholder="Share your analysis… (Ctrl+Enter to post)" rows={2}
                  style={{flex:1,background:"#090f0b",border:"1px solid #1a3320",borderRadius:3,padding:"8px 10px",color:"#c8e8d0",fontFamily:FONT,fontSize:11,outline:"none",resize:"none"}} />
                <button onClick={()=>void postComment()} disabled={!text.trim()||posting}
                  style={{padding:"6px 14px",background:"transparent",border:"1px solid #00bb66",color:"#00ff88",fontFamily:RAJ,fontSize:11,fontWeight:700,letterSpacing:2,borderRadius:3,cursor:"pointer",opacity:(!text.trim()||posting)?0.4:1,alignSelf:"flex-end"}}>
                  POST ▶
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── INCIDENT NODE GRAPH ────────────────────────────────────────
function IncidentGraph({ incident, orgs }: { incident: Incident; orgs: Org[] }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const col = CLASS_COL[incident.classification]??"#5a8068";

  // Build nodes
  const cx=400,cy=200;
  interface GraphNode { id:string; x:number; y:number; label:string; color:string; type:string }
  const nodes: GraphNode[] = [{ id:"center", x:cx, y:cy, label:incident.name.split("/")[0].trim(), color:col, type:"incident" }];

  // Place witnesses in a ring
  const witnessCount = Math.min(incident.witnesses.length,4);
  incident.witnesses.slice(0,witnessCount).forEach((w,i)=>{
    const angle = (i/witnessCount)*Math.PI*2 - Math.PI/2 + (witnessCount===1?0:0);
    nodes.push({ id:`w${i}`, x:cx+160*Math.cos(angle), y:cy+130*Math.sin(angle), label:w.split(" ").slice(-1)[0].toUpperCase(), color:"#00bb66", type:"witness" });
  });
  // Related orgs
  const relatedOrgs = orgs.filter(o=>incident.relatedOrgs.includes(o.name)).slice(0,3);
  relatedOrgs.forEach((o,i)=>{
    const angle = Math.PI/4 + (i/3)*Math.PI*1.2;
    nodes.push({ id:`o${i}`, x:cx+220*Math.cos(angle), y:cy+170*Math.sin(angle), label:o.name, color:"#ffaa00", type:"org" });
  });
  // Documents
  incident.documents.slice(0,3).forEach((d,i)=>{
    const angle = -Math.PI/4 - (i/3)*Math.PI;
    nodes.push({ id:`d${i}`, x:cx+190*Math.cos(angle), y:cy+140*Math.sin(angle), label:d.split(" ").slice(0,2).join(" ").toUpperCase(), color:"#c94dff", type:"document" });
  });

  return (
    <div style={{border:"1px solid #1a3320",borderRadius:4,background:"#090f0b",overflow:"hidden"}}>
      <div style={{padding:"8px 12px",borderBottom:"1px solid #1a3320",display:"flex",gap:8,alignItems:"center"}}>
        <div style={{fontFamily:FONT,fontSize:9,color:"#5a8068",letterSpacing:2}}>◈ INVESTIGATION GRAPH</div>
        <div style={{display:"flex",gap:8,marginLeft:"auto"}}>
          {[["#00bb66","WITNESS"],["#ffaa00","ORGANIZATION"],["#c94dff","DOCUMENT"]].map(([c,l])=>(
            <span key={l} style={{display:"flex",alignItems:"center",gap:4,fontSize:8,color:"#5a8068"}}>
              <span style={{width:6,height:6,borderRadius:"50%",background:c,display:"inline-block"}}/>
              {l}
            </span>
          ))}
        </div>
      </div>
      <svg ref={svgRef} style={{width:"100%",height:280}} viewBox="0 0 800 280">
        <defs>
          <radialGradient id="incGrad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={col} stopOpacity="0.08"/>
            <stop offset="100%" stopColor={col} stopOpacity="0"/>
          </radialGradient>
        </defs>
        <rect width="800" height="280" fill="#090f0b"/>
        {/* Center glow */}
        <circle cx={cx} cy={cy} r={60} fill="url(#incGrad)"/>
        {/* Edges */}
        {nodes.slice(1).map(n=>(
          <line key={n.id} x1={cx} y1={cy} x2={n.x} y2={n.y} stroke={n.color} strokeWidth="1" strokeOpacity="0.3" strokeDasharray="4 6"/>
        ))}
        {/* Nodes */}
        {nodes.map((n,i)=>(
          <g key={n.id}>
            <circle cx={n.x} cy={n.y} r={i===0?24:14} fill="#090f0b" stroke={n.color} strokeWidth={i===0?2:1.5} style={{filter:`drop-shadow(0 0 ${i===0?8:3}px ${n.color})`}}/>
            <text x={n.x} y={n.y+4} textAnchor="middle" fill={n.color} style={{fontFamily:FONT,fontSize:i===0?9:7,letterSpacing:0.5}} >{n.label.slice(0,10)}</text>
            {i>0&&<text x={n.x} y={n.y+n.type==="witness"?26:24} textAnchor="middle" fill={n.color} opacity="0.5" style={{fontFamily:FONT,fontSize:6,letterSpacing:1}}>{n.type.toUpperCase()}</text>}
          </g>
        ))}
      </svg>
    </div>
  );
}

// ── INCIDENT DETAIL ────────────────────────────────────────────
function IncidentDetail({ incident, people, orgs, docs }:{ incident:Incident; people:Person[]; orgs:Org[]; docs:Document[] }) {
  const [analysis, setAnalysis] = useState<{summary:string;conspiracy_angle:string;probability:number;key_connections:string[];verdict:string}|null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const col = CLASS_COL[incident.classification]??"#5a8068";
  const evdCol = EVD_COL[incident.evidenceLevel];
  const relPeople = people.filter(p=>p.linkedIncidents.includes(incident.id));
  const relDocs = docs.filter(d=>incident.documents.some(name=>name.toLowerCase().includes(d.name.toLowerCase().split(" ")[0].toLowerCase())));

  async function analyze() {
    setAnalyzing(true);
    try {
      const res = await fetch(`/api/uap?type=analyze&id=${incident.id}`);
      const data = await res.json();
      if (data.analysis) setAnalysis(data.analysis);
    } catch {}
    setAnalyzing(false);
  }

  return (
    <div style={{display:"flex",flexDirection:"column",gap:12}}>
      {/* Header */}
      <div style={{border:`1px solid ${col}`,borderRadius:4,padding:"12px 14px",background:"#090f0b"}}>
        <div style={{display:"flex",gap:8,marginBottom:6,flexWrap:"wrap"}}>
          <span style={classStyle(incident.classification)}>{incident.classification}</span>
          <span style={{...classStyle("REPORTED" as Classification),color:evdCol,border:`1px solid ${evdCol}`}}>EVIDENCE: {incident.evidenceLevel}</span>
          {incident.tags.slice(0,3).map(t=>(
            <span key={t} style={{fontSize:9,color:"#5a8068",border:"1px solid #1a3320",padding:"1px 6px",borderRadius:2}}>{t}</span>
          ))}
        </div>
        <div style={{fontFamily:FONT,fontSize:12,color:"#5a8068",marginBottom:8,letterSpacing:1}}>{incident.date} · {incident.location}</div>
        <ReadableProse
          text={incident.description}
          softBreak
          style={{ fontFamily: FONT, fontSize: 14, color: "#c8e8d0" }}
        />
      </div>

      {/* Investigation graph */}
      <IncidentGraph incident={incident} orgs={orgs} />

      {/* Witnesses */}
      <div style={{border:"1px solid #1a3320",borderRadius:4,padding:"12px 14px",background:"#090f0b"}}>
        <div style={{fontFamily:FONT,fontSize:9,color:"#00bb66",letterSpacing:2,marginBottom:8}}>◈ WITNESSES ({incident.witnesses.length})</div>
        <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
          {incident.witnesses.map(w=>{
            const person = relPeople.find(p=>p.name===w);
            return (
              <div key={w} style={{padding:"4px 10px",border:`1px solid ${person?"#00bb66":"#1a3320"}`,borderRadius:3,background:person?"rgba(0,187,102,0.06)":"transparent"}}>
                <div style={{fontFamily:RAJ,fontSize:11,fontWeight:700,color:person?"#00ff88":"#c8e8d0"}}>{w}</div>
                {person&&<div style={{fontSize:9,color:"#5a8068"}}>{person.role}</div>}
              </div>
            );
          })}
        </div>
      </div>

      {/* Documents */}
      {incident.documents.length>0&&(
        <div style={{border:"1px solid #1a3320",borderRadius:4,padding:"12px 14px",background:"#090f0b"}}>
          <div style={{fontFamily:FONT,fontSize:9,color:"#c94dff",letterSpacing:2,marginBottom:8}}>◈ DOCUMENTS & EVIDENCE</div>
          {incident.documents.map((d,i)=>{
            const doc = relDocs.find(rd=>d.toLowerCase().includes(rd.name.toLowerCase().split(" ")[0].toLowerCase()));
            return (
              <div key={i} style={{marginBottom:7}}>
                {doc
                  ? <a href={doc.url} target="_blank" rel="noreferrer" style={{display:"flex",gap:8,color:"#c94dff",textDecoration:"none",fontSize:11,padding:"5px 8px",border:"1px solid rgba(201,77,255,0.2)",borderRadius:3,background:"rgba(20,8,28,0.5)"}}>
                      <span style={{flexShrink:0}}>↗</span><span>{d}</span>
                    </a>
                  : <div style={{display:"flex",gap:8,color:"#5a8068",fontSize:11,padding:"4px 0"}}>
                      <span style={{color:"#3a3040"}}>⟨{i+1}⟩</span><span>{d}</span>
                    </div>
                }
              </div>
            );
          })}
        </div>
      )}

      {/* AI Analysis */}
      <div style={{border:"1px solid #1a3320",borderRadius:4,overflow:"hidden"}}>
        {!analysis&&!analyzing&&(
          <button onClick={analyze} style={{width:"100%",padding:"12px",background:"transparent",border:"none",color:"#5a8068",fontFamily:RAJ,fontSize:12,fontWeight:700,letterSpacing:2,cursor:"pointer",textTransform:"uppercase",transition:"all 0.15s"}}
            onMouseEnter={e=>{(e.currentTarget as HTMLButtonElement).style.color="#00ff88";(e.currentTarget as HTMLButtonElement).style.background="rgba(0,255,136,0.04)";}}
            onMouseLeave={e=>{(e.currentTarget as HTMLButtonElement).style.color="#5a8068";(e.currentTarget as HTMLButtonElement).style.background="transparent";}}>
            ◈ RUN ORACLE ANALYSIS ▶
          </button>
        )}
        {analyzing&&(
          <div style={{padding:14,textAlign:"center"}}>
            <div style={{fontSize:10,color:"#00bb66",letterSpacing:2,marginBottom:8}}>[ ANALYZING INCIDENT... ]</div>
            {["> Cross-referencing CIA FOIA...","> Evaluating witness credibility...","> Pattern analysis running..."].map((l,i)=>(
              <div key={i} style={{fontSize:10,color:"#3a5040",marginBottom:4}}>{l}</div>
            ))}
          </div>
        )}
        {analysis&&(
          <div style={{padding:"12px 14px"}}>
            <div style={{fontFamily:FONT,fontSize:9,color:"#00ff88",letterSpacing:2,marginBottom:10}}>◈ ORACLE ANALYSIS</div>
            <div style={{display:"flex",gap:12,alignItems:"center",marginBottom:10}}>
              <div>
                <div style={{fontSize:9,color:"#5a8068",letterSpacing:2,marginBottom:3}}>NON-HUMAN PROBABILITY</div>
                <div style={{fontFamily:RAJ,fontSize:36,fontWeight:700,color:analysis.probability>=50?"#ff3333":analysis.probability>=30?"#ffaa00":"#00bb66",lineHeight:1}}>{analysis.probability}%</div>
              </div>
              <div style={{flex:1}}>
                <div style={{height:4,background:"#1a3320",borderRadius:2,overflow:"hidden"}}>
                  <div style={{height:"100%",width:`${analysis.probability}%`,background:analysis.probability>=50?"#ff3333":analysis.probability>=30?"#ffaa00":"#00bb66",borderRadius:2}}/>
                </div>
                <div style={{marginTop:6,fontSize:9,color:"#3a5040",letterSpacing:1,padding:"2px 7px",border:"1px solid #1a3320",borderRadius:2,display:"inline-block"}}>{analysis.verdict?.replace(/_/g," ")}</div>
              </div>
            </div>
            <ReadableProse
              text={analysis.summary}
              softBreak
              style={{ fontFamily: FONT, fontSize: 11, color: "#7aaa8a", marginBottom: 10 }}
            />
            <div style={{padding:"8px 10px",background:"rgba(201,77,255,0.06)",border:"1px solid rgba(201,77,255,0.2)",borderRadius:3,marginBottom:10}}>
              <div style={{fontSize:9,color:"#c94dff",letterSpacing:2,marginBottom:4}}>CONSPIRACY ANGLE</div>
              <ReadableProse
                text={analysis.conspiracy_angle}
                softBreak
                style={{ fontFamily: FONT, fontSize: 10, color: "#e9b3ff" }}
              />
            </div>
            {analysis.key_connections?.length>0&&(
              <div>
                <div style={{fontSize:9,color:"#5a8068",letterSpacing:2,marginBottom:6}}>KEY CONNECTIONS</div>
                {analysis.key_connections.map((c,i)=>(
                  <div key={i} style={{display:"flex",gap:7,color:"#7aaa8a",fontSize:10,marginBottom:4,lineHeight:1.6}}>
                    <span style={{color:"#00bb66",flexShrink:0}}>▸</span><span>{c}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Polymarket */}
      <PolymarketWidget
        query={`${incident.name} UFO UAP`}
        context={
          [
            incident.description,
            incident.location,
            incident.tags.join(" "),
            analysis?.summary,
            analysis?.conspiracy_angle,
            ...(analysis?.key_connections ?? []),
          ]
            .filter(Boolean)
            .join(" ")
            .slice(0, 2000) || undefined
        }
      />
    </div>
  );
}

// ── MAIN ───────────────────────────────────────────────────────
export default function UAPTracker() {
  const [data, setData]     = useState<{incidents:Incident[];people:Person[];organizations:Org[];documents:Document[];news:News[];generated_at:string}|null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab]       = useState<"incidents"|"sightings"|"people"|"orgs"|"documents"|"news">("incidents");
  const [selected, setSelected] = useState<Incident|null>(null);

  // Sightings state
  const [sightings, setSightings] = useState<Sighting[]>([]);
  const [sightingsLoading, setSightingsLoading] = useState(false);
  const [selectedSighting, setSelectedSighting] = useState<Sighting|null>(null);
  const [showSightings, setShowSightings] = useState(true);

  const loadSightings = useCallback(() => {
    setSightingsLoading(true);
    fetch("/api/uap-sightings?limit=200")
      .then(r=>r.json())
      .then((d:{sightings?:Sighting[]})=>setSightings(d.sightings??[]))
      .catch(()=>{})
      .finally(()=>setSightingsLoading(false));
  }, []);

  useEffect(()=>{
    fetch("/api/uap").then(r=>r.json()).then(d=>{ setData(d); if(d.incidents?.length) setSelected(d.incidents[0]); }).catch(()=>{}).finally(()=>setLoading(false));
    loadSightings();
  },[loadSightings]);

  if (loading) return (
    <div style={{minHeight:"100vh",background:"#030806",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:FONT}}>
      <style>{`@keyframes uap-blink{0%,100%{opacity:1}50%{opacity:0}}.uap-blink{animation:uap-blink 0.9s step-end infinite}`}</style>
      <div style={{textAlign:"center"}}>
        <div style={{fontFamily:RAJ,fontSize:26,fontWeight:700,color:"#00ff88",letterSpacing:2,marginBottom:8}}>UAP INTELLIGENCE</div>
        <div style={{fontSize:11,color:"#3a6040",letterSpacing:2,marginBottom:20}}>[ LOADING CLASSIFIED DATABASE... ]</div>
        {["> Connecting to FOIA archives...",">" +" Parsing declassified documents...",">" +" Cross-referencing witness testimony...",">" +" Building investigation network..."].map((l,i)=>(
          <div key={i} style={{fontSize:10,color:"#1a4a2a",marginBottom:4,letterSpacing:0.5}}>{l}</div>
        ))}
        <div style={{marginTop:16}}><span className="uap-blink" style={{color:"#00ff88",fontSize:14}}>▌</span></div>
      </div>
    </div>
  );

  if (!data) return null;

  const TABS = [
    { key:"incidents",  label:`INCIDENTS (${data.incidents.length})` },
    { key:"sightings",  label:`SIGHTINGS (${sightings.length})` },
    { key:"people",     label:`PEOPLE (${data.people.length})` },
    { key:"orgs",       label:`ORGS (${data.organizations.length})` },
    { key:"documents",  label:`DOCUMENTS (${data.documents.length})` },
    { key:"news",       label:`LIVE FEED (${data.news.length})` },
  ];

  return (
    <div style={{minHeight:"100vh",background:"#050c07",color:"#c8e8d0",fontFamily:FONT}}>
      <div className="scanline"/>
      <style>{`@keyframes uap-blink{0%,100%{opacity:1}50%{opacity:0}}.uap-blink{animation:uap-blink 0.9s step-end infinite}`}</style>
      <div style={{position:"relative",zIndex:1}}>

        {/* NAV */}
        <div style={{height:44,background:"#050c07",borderBottom:"1px solid #1a3320",display:"flex",alignItems:"center",padding:"0 16px",gap:12}}>
          <Link href="/" style={{fontSize:10,color:"#5a8068",textDecoration:"none",letterSpacing:2,border:"1px solid #1a3320",padding:"4px 10px",borderRadius:3}}>← FEED</Link>
          <Link href="/account" style={{fontSize:10,color:"#5a8068",textDecoration:"none",letterSpacing:2,border:"1px solid #1a3320",padding:"4px 10px",borderRadius:3}}>ACCOUNT</Link>
          <div style={{width:1,height:20,background:"#1a3320"}}/>
          <div style={{fontFamily:RAJ,fontSize:14,fontWeight:700,color:"#00ff88",letterSpacing:2}}>THE THEORIST</div>
          <div style={{width:1,height:20,background:"#1a3320"}}/>
          <div style={{fontFamily:RAJ,fontSize:11,color:"#5a8068",letterSpacing:2}}>UAP INTELLIGENCE</div>
          <div style={{marginLeft:"auto",fontSize:10,color:"#3a5040",letterSpacing:1}}>FOIA · PENTAGON · CONGRESS · {new Date(data.generated_at).toLocaleTimeString()}</div>
        </div>

        <div style={pageContentShellStyle()}>

          {/* HEADER */}
          <div style={{marginBottom:"1.25rem",paddingBottom:"1rem",borderBottom:"1px solid #1a3320"}}>
            <div style={{fontFamily:RAJ,fontSize:10,letterSpacing:5,color:"#5a8068",marginBottom:5,textTransform:"uppercase"}}>■ UNIDENTIFIED AERIAL PHENOMENA — INTELLIGENCE DATABASE ■</div>
            <h1 style={{fontFamily:RAJ,fontSize:24,fontWeight:700,color:"#00ff88",letterSpacing:2,textTransform:"uppercase",textShadow:"0 0 16px rgba(0,255,136,0.2)",margin:"0 0 4px"}}>UAP Intelligence</h1>
            <div style={{fontSize:9,color:"#3a5040",letterSpacing:2}}>
              DECLASSIFIED DOCUMENTS · CONGRESSIONAL TESTIMONY · WHISTLEBLOWER REPORTS · LIVE NEWS FEED
              <span style={{display:"block",marginTop:6,color:SIGHTING_COL,letterSpacing:1}}>
                ◈ On <strong style={{color:"#5a8068"}}>INCIDENTS</strong> the map shows curated cases + optional NUFORC overlay. On <strong style={{color:SIGHTING_COL}}>SIGHTINGS</strong> the map shows <strong style={{color:SIGHTING_COL}}>NUFORC pins only</strong> (geocoded). {sightings.length} sightings in DB.
              </span>
            </div>
          </div>

          {/* STATS */}
          <div style={{display:"flex",gap:10,marginBottom:"1.25rem",flexWrap:"wrap"}}>
            {([
              {label:"INCIDENTS",value:data.incidents.length,col:"#00ff88"},
              {label:"DECLASSIFIED",value:data.incidents.filter(i=>i.classification==="DECLASSIFIED"||i.classification==="CONFIRMED").length,col:"#00bb66"},
              {label:"HIGH EVIDENCE",value:data.incidents.filter(i=>i.evidenceLevel==="HIGH").length,col:"#ff3333"},
              {label:"KEY WITNESSES",value:data.people.length,col:"#ffaa00"},
              {label:"DOCUMENTS",value:data.documents.length,col:"#c94dff"},
              {label:"LIVE ITEMS",value:data.news.length,col:"#00bb66"},
              {label:"NUFORC SIGHTINGS",value:sightings.length,col:SIGHTING_COL,onPress:()=>{setTab("sightings");}},
              {label:"FOIA/BLACKVAULT",value:((data as UAPData).stats?.blackvault_items??0)+((data as UAPData).stats?.muckrock_items??0),col:"#c94dff"},
            ] as Array<{label:string;value:number;col:string;onPress?:()=>void}>).map(({label,value,col,onPress})=>(
              <div
                key={label}
                role={onPress?"button":undefined}
                tabIndex={onPress?0:undefined}
                onClick={onPress}
                onKeyDown={onPress?(e)=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();onPress();}}:undefined}
                style={{
                  border:`1px solid ${onPress&&label==="NUFORC SIGHTINGS"?`${SIGHTING_COL}55`:"#1a3320"}`,
                  borderRadius:3,padding:"8px 14px",background:onPress&&label==="NUFORC SIGHTINGS"?"rgba(255,204,0,0.04)":"#090f0b",
                  cursor:onPress?"pointer":undefined,
                }}
              >
                <div style={{fontSize:9,color:"#3a5040",letterSpacing:2,marginBottom:3}}>{label}{onPress?" · click":""}</div>
                <div style={{fontFamily:RAJ,fontSize:22,fontWeight:700,color:col,lineHeight:1}}>{value}</div>
              </div>
            ))}
          </div>

          {/* WORLD MAP */}
          <div style={{marginBottom:"1.25rem"}}>
            <div style={{display:"flex",gap:12,alignItems:"center",marginBottom:8,flexWrap:"wrap"}}>
              <div style={{fontFamily:FONT,fontSize:10,color:"#5a8068",letterSpacing:2}}>
                {tab==="sightings"
                  ? "◈ NUFORC MAP · geocoded reports only · ZOOM: scroll/pinch or +/−"
                  : "◈ GLOBAL MAP · ZOOM: scroll/pinch or use +/− buttons"}
              </div>
              <div style={{display:"flex",gap:8,flexWrap:"wrap",marginLeft:"auto",alignItems:"center"}}>
                {tab==="sightings" ? (
                  <>
                    <span style={{display:"inline-flex",alignItems:"center",gap:4,fontSize:9,color:SIGHTING_COL}}>
                      <span style={{width:8,height:8,borderRadius:"50%",background:SIGHTING_COL,display:"inline-block",boxShadow:`0 0 6px ${SIGHTING_COL}`}}/>
                      NUFORC ({sightings.filter(s=>s.lat!=null&&s.lng!=null).length} on map)
                    </span>
                    <span style={{fontSize:8,color:"#3a5040",letterSpacing:0.5,maxWidth:200}}>Incident pins hidden here</span>
                  </>
                ) : (
                  <>
                    {[["#00ff88","DECLASSIFIED"],["#00bb66","CONFIRMED"],["#ffaa00","REPORTED"],["#5a8068","ALLEGED"]].map(([col,label])=>(
                      <span key={label} style={{display:"inline-flex",alignItems:"center",gap:4,fontSize:9,color:"#5a8068"}}>
                        <span style={{width:7,height:7,borderRadius:"50%",background:col,display:"inline-block"}}/>
                        {label}
                      </span>
                    ))}
                    <button type="button" onClick={()=>setShowSightings(s=>!s)}
                      style={{display:"inline-flex",alignItems:"center",gap:4,fontSize:9,color:showSightings?SIGHTING_COL:"#3a5040",background:"transparent",border:`1px solid ${showSightings?SIGHTING_COL+"44":"#1a3320"}`,padding:"2px 8px",borderRadius:2,cursor:"pointer",letterSpacing:1}}>
                      <span style={{width:7,height:7,borderRadius:"50%",background:showSightings?SIGHTING_COL:"#3a5040",display:"inline-block"}}/>
                      NUFORC {showSightings?"ON":"OFF"}
                    </button>
                  </>
                )}
              </div>
            </div>
            <UAPMap
              incidents={data.incidents} selected={selected}
              onSelect={s=>{setSelected(s);setSelectedSighting(null);setTab("incidents");}}
              sightings={sightings} showSightings={showSightings}
              onSelectSighting={s=>{setSelectedSighting(s);setTab("sightings");}}
              mapTab={tab}
              selectedSighting={selectedSighting}
            />
          </div>

          {/* TABS + CONTENT */}
          <div style={{display:"grid",gridTemplateColumns:"minmax(0,1fr) minmax(360px,420px)",gap:"clamp(1rem,2.5vw,1.75rem)"}}>

            {/* LEFT */}
            <div>
              {/* Tab bar */}
              <div style={{display:"flex",gap:4,marginBottom:"1rem",flexWrap:"wrap"}}>
                {TABS.map(t=>(
                  <button key={t.key} onClick={()=>setTab(t.key as typeof tab)}
                    style={{fontFamily:RAJ,fontSize:11,fontWeight:700,letterSpacing:1,textTransform:"uppercase",padding:"6px 14px",borderRadius:2,cursor:"pointer",border:`1px solid ${tab===t.key?"#00bb66":"#1a3320"}`,background:tab===t.key?"rgba(0,255,136,0.06)":"transparent",color:tab===t.key?"#00ff88":"#5a8068"}}>
                    {t.label}
                  </button>
                ))}
              </div>

              {/* INCIDENTS TAB */}
              {tab==="incidents"&&(
                <div style={{display:"flex",flexDirection:"column",gap:8}}>
                  {data.incidents.map(inc=>{
                    const col=CLASS_COL[inc.classification]??"#5a8068";
                    const isSel=selected?.id===inc.id;
                    return (
                      <div key={inc.id} onClick={()=>setSelected(inc)}
                        style={{border:`1px solid ${isSel?col:"#1a3320"}`,borderRadius:4,background:isSel?`${col}0a`:"#090f0b",cursor:"pointer",transition:"all 0.15s",overflow:"hidden"}}
                        onMouseEnter={e=>{if(!isSel)(e.currentTarget as HTMLDivElement).style.borderColor=col;}}
                        onMouseLeave={e=>{if(!isSel)(e.currentTarget as HTMLDivElement).style.borderColor="#1a3320";}}>
                        <div style={{padding:"8px 12px",borderBottom:"1px solid #1a3320",display:"flex",alignItems:"center",gap:8,background:"rgba(0,0,0,0.3)"}}>
                          <span style={{fontSize:10,color:col,border:`1px solid ${col}`,padding:"1px 7px",borderRadius:2,letterSpacing:1,fontFamily:RAJ,fontWeight:700,flexShrink:0}}>{inc.classification}</span>
                          <span style={{fontSize:10,color:EVD_COL[inc.evidenceLevel],border:`1px solid ${EVD_COL[inc.evidenceLevel]}`,padding:"1px 7px",borderRadius:2,letterSpacing:1,fontFamily:RAJ,fontWeight:700,flexShrink:0}}>EVD: {inc.evidenceLevel}</span>
                          <span style={{fontSize:10,color:"#3a5040",letterSpacing:1,marginLeft:"auto"}}>{inc.date}</span>
                        </div>
                        <div style={{padding:"10px 12px"}}>
                          <div style={{fontFamily:RAJ,fontSize:15,fontWeight:700,color:"#e8ffe8",lineHeight:1.3,marginBottom:3}}>{inc.name}</div>
                          <div style={{fontSize:11,color:"#5a8068",letterSpacing:1,marginBottom:7}}>{inc.location}</div>
                          <div style={{fontSize:12,color:"#7aaa8a",lineHeight:1.65,marginBottom:8}}>{inc.description.slice(0,110)}...</div>
                          <div style={{display:"flex",gap:5,flexWrap:"wrap",alignItems:"center"}}>
                            {inc.tags.slice(0,4).map(t=><span key={t} style={{fontSize:8,color:"#2a4030",border:"1px solid #0d1a10",padding:"1px 5px",borderRadius:1,letterSpacing:0.5}}>{t}</span>)}
                            <Link href={`/uap/${inc.id}`} onClick={e=>e.stopPropagation()} style={{marginLeft:"auto",fontSize:9,color:col,border:`1px solid ${col}`,padding:"3px 10px",borderRadius:2,textDecoration:"none",letterSpacing:1,fontFamily:RAJ,fontWeight:700,flexShrink:0,background:`${col}10`}}>
                              ◈ BOARD ▶
                            </Link>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* SIGHTINGS TAB */}
              {tab==="sightings"&&(
                <div>
                  <div style={{marginBottom:12,fontSize:9,color:"#5a8068",letterSpacing:1}}>
                    Source: NUFORC (National UFO Reporting Center) · Auto-geocoded via OpenStreetMap · ingest runs from Admin → Scrapers
                  </div>

                  {selectedSighting ? (
                    <SightingDetail sighting={selectedSighting} onBack={()=>setSelectedSighting(null)} />
                  ) : (
                    <>
                      {sightingsLoading&&<div style={{textAlign:"center",padding:"2rem",fontSize:10,color:"#3a5040",letterSpacing:2}}>LOADING SIGHTINGS...</div>}
                      {!sightingsLoading&&sightings.length===0&&(
                        <div style={{textAlign:"center",padding:"3rem",fontSize:10,color:"#3a5040",letterSpacing:2}}>
                          NO SIGHTINGS YET<br/>
                          <span style={{fontSize:9,color:"#2a4030"}}>Data is updated from the admin scraper schedule.</span>
                        </div>
                      )}
                      <div style={{display:"flex",flexDirection:"column",gap:8}}>
                        {sightings.map(s=>(
                          <div key={s.id} onClick={()=>setSelectedSighting(s)}
                            style={{border:`1px solid ${SIGHTING_COL}22`,borderRadius:4,background:"#090f0b",cursor:"pointer",transition:"all 0.15s",overflow:"hidden"}}
                            onMouseEnter={e=>{(e.currentTarget as HTMLDivElement).style.borderColor=`${SIGHTING_COL}66`;(e.currentTarget as HTMLDivElement).style.background="rgba(255,204,0,0.04)";}}
                            onMouseLeave={e=>{(e.currentTarget as HTMLDivElement).style.borderColor=`${SIGHTING_COL}22`;(e.currentTarget as HTMLDivElement).style.background="#090f0b";}}>
                            <div style={{padding:"8px 12px",borderBottom:`1px solid ${SIGHTING_COL}11`,background:"rgba(255,204,0,0.02)",display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
                              <span style={{fontSize:9,color:SIGHTING_COL,border:`1px solid ${SIGHTING_COL}44`,padding:"1px 7px",borderRadius:2,letterSpacing:1}}>NUFORC</span>
                              {s.shape&&<span style={{fontSize:9,color:"#ffaa00",border:"1px solid rgba(255,170,0,0.3)",padding:"1px 6px",borderRadius:2}}>{s.shape.toUpperCase()}</span>}
                              <span style={{fontSize:9,color:"#3a5040",letterSpacing:1,marginLeft:"auto"}}>{s.event_date??""}</span>
                            </div>
                            <div style={{padding:"10px 12px"}}>
                              <div style={{fontFamily:RAJ,fontSize:14,fontWeight:700,color:"#ffe8a0",lineHeight:1.3,marginBottom:3}}>{s.title}</div>
                              <div style={{fontSize:11,color:"#5a8068",letterSpacing:1,marginBottom:6}}>{s.location_name}</div>
                              <div style={{fontSize:11,color:"#7aaa8a",lineHeight:1.6,marginBottom:6}}>{s.description.slice(0,120)}{s.description.length>120?"...":""}</div>
                              <div style={{display:"flex",gap:10,fontSize:9,color:"#3a5040"}}>
                                <span>▲ {s.upvotes}</span>
                                <span>💬 {s.comment_count}</span>
                                {s.source_url&&<a href={s.source_url} target="_blank" rel="noreferrer" onClick={e=>e.stopPropagation()} style={{color:"#00bb66",textDecoration:"none",marginLeft:"auto"}}>↗ NUFORC</a>}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* PEOPLE TAB */}
              {tab==="people"&&(
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                  {data.people.map(p=>(
                    <div key={p.id} style={{border:"1px solid #1a3320",borderRadius:4,padding:"11px 13px",background:"#090f0b"}}>
                      <div style={{fontFamily:RAJ,fontSize:13,fontWeight:700,color:"#00ff88",marginBottom:2}}>{p.name}</div>
                      <div style={{fontSize:9,color:"#5a8068",letterSpacing:1,marginBottom:5}}>{p.role}</div>
                      <div style={{fontSize:9,color:"#3a5040",marginBottom:6}}>CLEARANCE: <span style={{color:"#ffaa00"}}>{p.clearance}</span></div>
                      <div style={{fontFamily:FONT,fontSize:10,color:"#7aaa8a",lineHeight:1.6,marginBottom:8}}>{p.bio.slice(0,150)}...</div>
                      {p.linkedIncidents.length>0&&(
                        <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
                          {p.linkedIncidents.map(id=>{
                            const inc=data.incidents.find(i=>i.id===id);
                            return inc?<span key={id} onClick={()=>{setSelected(inc);setTab("incidents");}} style={{fontSize:8,color:"#00bb66",border:"1px solid rgba(0,187,102,0.3)",padding:"1px 6px",borderRadius:2,cursor:"pointer"}}>{inc.name.split("/")[0].trim()}</span>:null;
                          })}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* ORGS TAB */}
              {tab==="orgs"&&(
                <div style={{display:"flex",flexDirection:"column",gap:8}}>
                  {data.organizations.map(o=>(
                    <div key={o.id} style={{border:"1px solid #1a3320",borderRadius:4,padding:"11px 13px",background:"#090f0b",display:"flex",gap:14}}>
                      <div style={{flex:1}}>
                        <div style={{display:"flex",gap:8,marginBottom:4,alignItems:"center"}}>
                          <div style={{fontFamily:RAJ,fontSize:14,fontWeight:700,color:"#ffaa00"}}>{o.name}</div>
                          <span style={{fontSize:9,color:"#5a8068",border:"1px solid #1a3320",padding:"1px 6px",borderRadius:2}}>{o.type}</span>
                          <span style={{fontSize:9,color:o.status==="ACTIVE"?"#00bb66":"#5a8068",border:`1px solid ${o.status==="ACTIVE"?"rgba(0,187,102,0.3)":"#1a3320"}`,padding:"1px 6px",borderRadius:2}}>{o.status}</span>
                        </div>
                        <div style={{fontFamily:RAJ,fontSize:11,color:"#5a8068",marginBottom:6}}>{o.fullName} · Est. {o.founded}</div>
                        <ReadableProse
                          text={o.description}
                          softBreak
                          style={{ fontFamily: FONT, fontSize: 10, color: "#7aaa8a", marginBottom: 6 }}
                        />
                        <div style={{display:"flex",gap:10,alignItems:"center"}}>
                          <span style={{fontSize:9,color:"#3a5040",letterSpacing:1}}>TRANSPARENCY: <span style={{color:o.transparency==="VERY LOW"||o.transparency==="LOW"?"#ff3333":"#ffaa00"}}>{o.transparency}</span></span>
                          <a href={o.url} target="_blank" rel="noreferrer" style={{fontSize:9,color:"#00bb66",textDecoration:"none",marginLeft:"auto"}}>↗ official site</a>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* DOCUMENTS TAB */}
              {tab==="documents"&&(
                <div style={{display:"flex",flexDirection:"column",gap:8}}>
                  {data.documents.map(d=>(
                    <a key={d.id} href={d.url} target="_blank" rel="noreferrer"
                      style={{display:"block",border:"1px solid rgba(201,77,255,0.2)",borderRadius:4,padding:"11px 13px",background:"rgba(20,8,28,0.6)",textDecoration:"none",transition:"border-color 0.15s"}}
                      onMouseEnter={e=>{(e.currentTarget as HTMLAnchorElement).style.borderColor="rgba(201,77,255,0.5)";}}
                      onMouseLeave={e=>{(e.currentTarget as HTMLAnchorElement).style.borderColor="rgba(201,77,255,0.2)";}}>
                      <div style={{display:"flex",gap:8,marginBottom:5,alignItems:"center"}}>
                        <span style={{fontSize:9,color:"#c94dff",letterSpacing:1}}>{d.year}</span>
                        <span style={{fontSize:9,color:"#5a8068",border:"1px solid #1a3320",padding:"1px 6px",borderRadius:2}}>{d.type}</span>
                        <span style={{fontSize:9,color:d.classification==="DECLASSIFIED"||d.classification==="PUBLIC"?"#00bb66":"#ffaa00",border:"1px solid currentColor",padding:"1px 6px",borderRadius:2,opacity:0.8}}>{d.classification}</span>
                        <span style={{marginLeft:"auto",fontSize:9,color:"#c94dff"}}>↗ VIEW</span>
                      </div>
                      <div style={{fontFamily:RAJ,fontSize:13,fontWeight:700,color:"#e9b3ff",marginBottom:5}}>{d.name}</div>
                      <ReadableProse
                        text={d.description}
                        softBreak
                        style={{ fontFamily: FONT, fontSize: 10, color: "#7a5a88" }}
                      />
                    </a>
                  ))}
                </div>
              )}

              {/* NEWS TAB */}
              {tab==="news"&&(
                <div style={{display:"flex",flexDirection:"column",gap:6}}>
                  <div style={{fontSize:9,color:"#5a8068",letterSpacing:2,marginBottom:4}}>LIVE UAP NEWS FEED · GOOGLE NEWS · UPDATED {new Date(data.generated_at).toLocaleTimeString()}</div>
                  {data.news.length===0&&<div style={{color:"#3a5040",fontSize:11,padding:16,textAlign:"center"}}>No live news available.</div>}
                  {data.news.map((n,i)=>{
                    const typeCol = n.type==="foia"?"#c94dff":n.type==="report"?"#ff3333":n.type==="social"?"#ffaa00":"#00bb66";
                    return (
                    <a key={i} href={n.url} target="_blank" rel="noreferrer"
                      style={{display:"block",border:`1px solid ${n.type==="foia"?"rgba(201,77,255,0.2)":n.type==="report"?"rgba(255,51,51,0.2)":"#1a3320"}`,borderRadius:3,padding:"9px 11px",textDecoration:"none",transition:"border-color 0.15s",background:n.type==="foia"?"rgba(20,8,28,0.5)":n.type==="report"?"rgba(26,10,10,0.4)":"#090f0b",marginBottom:6}}
                      onMouseEnter={e=>{(e.currentTarget as HTMLAnchorElement).style.borderColor=typeCol;}}
                      onMouseLeave={e=>{(e.currentTarget as HTMLAnchorElement).style.borderColor=n.type==="foia"?"rgba(201,77,255,0.2)":n.type==="report"?"rgba(255,51,51,0.2)":"#1a3320";}}>
                      <div style={{display:"flex",gap:6,marginBottom:5,alignItems:"center"}}>
                        <span style={{fontSize:8,color:typeCol,border:`1px solid ${typeCol}`,padding:"1px 5px",borderRadius:2,letterSpacing:1,textTransform:"uppercase",flexShrink:0}}>{n.type==="foia"?"FOIA":n.type==="report"?"OFFICIAL":n.type==="social"?"COMMUNITY":"NEWS"}</span>
                        <span style={{fontSize:9,color:"#5a8068",letterSpacing:1}}>{n.source}</span>
                        <span style={{fontSize:9,color:"#3a5040",marginLeft:"auto"}}>{n.pubDate?new Date(n.pubDate).toLocaleDateString():""}</span>
                      </div>
                      <div style={{fontFamily:RAJ,fontSize:12,fontWeight:700,color:"#c8e8d0",lineHeight:1.35}}>{n.title}</div>
                    </a>
                    );
                  })}
                </div>
              )}
            </div>

            {/* RIGHT: Detail panel */}
            <div>
              {selected&&tab==="incidents"&&(
                <div>
                  <div style={{padding:"10px 14px",marginBottom:"0.75rem",border:"1px solid #1a3320",borderRadius:4,background:"#090f0b"}}>
                    <div style={{fontFamily:RAJ,fontSize:17,fontWeight:700,color:"#e8ffe8",marginBottom:6}}>{selected.name}</div>
                    <div style={{display:"flex",gap:6,marginBottom:6,flexWrap:"wrap"}}>
                      <span style={{fontSize:10,color:CLASS_COL[selected.classification as Classification]??"#5a8068",border:`1px solid ${CLASS_COL[selected.classification as Classification]??"#5a8068"}`,padding:"2px 8px",borderRadius:2,fontFamily:RAJ,fontWeight:700}}>{selected.classification}</span>
                      <span style={{fontSize:10,color:EVD_COL[selected.evidenceLevel],border:`1px solid ${EVD_COL[selected.evidenceLevel]}`,padding:"2px 8px",borderRadius:2,fontFamily:RAJ,fontWeight:700}}>EVIDENCE: {selected.evidenceLevel}</span>
                    </div>
                    <div style={{fontSize:12,color:"#5a8068",letterSpacing:1,marginBottom:8}}>{selected.date} · {selected.location}</div>
                    <Link href={`/uap/${selected.id}`} style={{display:"block",padding:"10px",background:"rgba(0,255,136,0.06)",border:"1px solid #00bb66",borderRadius:3,textAlign:"center",textDecoration:"none",fontFamily:RAJ,fontSize:13,fontWeight:700,color:"#00ff88",letterSpacing:2}}>
                      ◈ OPEN INVESTIGATION BOARD ▶
                    </Link>
                  </div>
                  <IncidentDetail incident={selected} people={data.people} orgs={data.organizations} docs={data.documents}/>
                </div>
              )}
              {tab==="sightings"&&!selectedSighting&&(
                <div style={{border:`1px solid ${SIGHTING_COL}33`,borderRadius:4,padding:"1.5rem",textAlign:"center",color:"#5a6030",fontSize:10,letterSpacing:2,background:"rgba(255,204,0,0.02)"}}>
                  <div style={{color:SIGHTING_COL,fontSize:20,marginBottom:10}}>◈</div>
                  SELECT A SIGHTING<br/>FROM THE LIST OR MAP
                  <div style={{fontSize:9,color:"#3a5040",marginTop:8}}>This tab: map shows <span style={{color:SIGHTING_COL}}>NUFORC</span> only (geocoded).<br/>Incident pins return on the INCIDENTS tab.</div>
                </div>
              )}
              {tab!=="incidents"&&tab!=="sightings"&&(
                <div style={{border:"1px solid #1a3320",borderRadius:4,padding:"1.5rem",textAlign:"center",color:"#3a5040",fontSize:10,letterSpacing:2}}>
                  SELECT AN INCIDENT<br/>FROM THE MAP OR LIST
                  <button onClick={()=>setTab("incidents")} style={{display:"block",margin:"12px auto 0",fontFamily:RAJ,fontSize:11,fontWeight:700,color:"#00bb66",background:"transparent",border:"1px solid #00bb66",borderRadius:3,padding:"5px 14px",cursor:"pointer",letterSpacing:2}}>VIEW INCIDENTS ▶</button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* COMMUNITY CTA */}
        <div style={{margin:"1.5rem 1.25rem",padding:"14px 18px",border:"1px solid #1a3320",borderRadius:4,background:"#090f0b",display:"flex",alignItems:"center",gap:14,flexWrap:"wrap"}}>
          <div style={{flex:1}}>
            <div style={{fontFamily:RAJ,fontSize:12,fontWeight:700,color:"#c8e8d0",letterSpacing:2,marginBottom:4}}>SEEN SOMETHING? SHARE IT.</div>
            <div style={{fontFamily:FONT,fontSize:11,color:"#5a8068",lineHeight:1.6}}>Report a sighting, upload a document or tag <span style={{color:"#00ff88"}}>@oracle</span> for AI analysis in the community intelligence board.</div>
          </div>
          <a href="/community" style={{fontFamily:RAJ,fontSize:11,fontWeight:700,letterSpacing:2,textTransform:"uppercase",padding:"9px 18px",border:"1px solid #00bb66",background:"rgba(0,255,136,0.06)",color:"#00ff88",borderRadius:3,textDecoration:"none",flexShrink:0}}>◈ DISCUSS IN COMMUNITY ▸</a>
        </div>

      </div>
    </div>
  );
}
