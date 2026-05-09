"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import * as d3 from "d3";
import * as topojson from "topojson-client";
import PolymarketWidget from "@/components/PolymarketWidget";

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

const CLASS_COL: Record<Classification,string> = { DECLASSIFIED:"#00ff88", CONFIRMED:"#00bb66", REPORTED:"#ffaa00", ALLEGED:"#5a8068" };
const EVD_COL:   Record<EvidenceLevel,string>  = { HIGH:"#ff3333", MEDIUM:"#ffaa00", LOW:"#00bb66" };

function classStyle(c:Classification) {
  const col = CLASS_COL[c]??"#5a8068";
  return { color:col, border:`1px solid ${col}`, background:`${col}18`, padding:"2px 7px", borderRadius:2, fontSize:9, letterSpacing:1 };
}

// ── WORLD MAP ──────────────────────────────────────────────────
function UAPMap({ incidents, selected, onSelect }:{ incidents:Incident[]; selected:Incident|null; onSelect:(i:Incident)=>void }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [world, setWorld] = useState<unknown>(null);
  const [tooltip, setTooltip] = useState<{x:number;y:number;i:Incident}|null>(null);

  useEffect(()=>{ fetch("https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json").then(r=>r.json()).then(setWorld).catch(()=>{}); },[]);

  useEffect(()=>{
    if (!world||!svgRef.current) return;
    const svg = d3.select(svgRef.current);
    const W = svgRef.current.clientWidth||700; const H=300;
    svg.selectAll("*").remove();
    const proj = d3.geoNaturalEarth1().scale(W/6.2).translate([W/2,H/2]);
    const path = d3.geoPath().projection(proj);
    svg.append("rect").attr("width",W).attr("height",H).attr("fill","#030806");
    const grat = d3.geoGraticule()();
    svg.append("path").datum(grat).attr("d",path as d3.ValueFn<SVGPathElement,unknown,string>).attr("fill","none").attr("stroke","#0a1f0d").attr("stroke-width","0.3");
    // @ts-expect-error TopoJSON topology typed loosely vs GeoJSON
    const countries = topojson.feature(world, world.objects.countries);
    svg.append("g").selectAll("path")
      // @ts-expect-error features from topojson.feature
      .data(countries.features).enter().append("path")
      .attr("d",path as d3.ValueFn<SVGPathElement,unknown,string>)
      .attr("fill","#0a160c").attr("stroke","#1a3320").attr("stroke-width","0.4");

    for (const inc of incidents) {
      const pos = proj([inc.lng,inc.lat]);
      if (!pos) continue;
      const [x,y]=pos;
      const col = CLASS_COL[inc.classification]??"#5a8068";
      const isSel = selected?.id===inc.id;
      const r = isSel?10:6;
      svg.append("circle").attr("cx",x).attr("cy",y).attr("r",r+6).attr("fill","none").attr("stroke",col).attr("stroke-width","0.8").attr("stroke-opacity","0.2");
      svg.append("circle").attr("cx",x).attr("cy",y).attr("r",r).attr("fill",col).attr("fill-opacity",isSel?0.95:0.75).attr("stroke",col).attr("stroke-width",isSel?2:1).style("cursor","pointer").style("filter",`drop-shadow(0 0 ${isSel?8:3}px ${col})`)
        .on("mouseenter",function(event){ setTooltip({x:event.offsetX,y:event.offsetY,i:inc}); d3.select(this).attr("fill-opacity","1"); })
        .on("mouseleave",function(){ setTooltip(null); d3.select(this).attr("fill-opacity",isSel?0.95:0.75); })
        .on("click",()=>onSelect(inc));
      if (isSel||inc.evidenceLevel==="HIGH") {
        svg.append("text").attr("x",x+r+4).attr("y",y+3).attr("fill",col).attr("font-size","7").attr("font-family","'Share Tech Mono',monospace").attr("letter-spacing","1").text(inc.name.toUpperCase().slice(0,16));
      }
    }
  }, [world, incidents, selected, onSelect]);

  return (
    <div style={{position:"relative"}}>
      <svg ref={svgRef} style={{width:"100%",height:300,background:"#030806",borderRadius:4,border:"1px solid #1a3320",display:"block"}}/>
      {tooltip&&(
        <div style={{position:"absolute",left:tooltip.x+12,top:tooltip.y-10,background:"#090f0b",border:`1px solid ${CLASS_COL[tooltip.i.classification]??"#5a8068"}`,borderRadius:3,padding:"8px 10px",pointerEvents:"none",zIndex:20,maxWidth:220}}>
          <div style={{fontFamily:RAJ,fontSize:12,fontWeight:700,color:"#e8ffe8",marginBottom:3}}>{tooltip.i.name}</div>
          <div style={{fontSize:9,color:"#5a8068",marginBottom:5}}>{tooltip.i.date} · {tooltip.i.location}</div>
          <div style={{display:"flex",gap:5}}>
            <span style={classStyle(tooltip.i.classification)}>{tooltip.i.classification}</span>
            <span style={{...classStyle("REPORTED" as Classification),color:EVD_COL[tooltip.i.evidenceLevel],border:`1px solid ${EVD_COL[tooltip.i.evidenceLevel]}`}}>{tooltip.i.evidenceLevel}</span>
          </div>
        </div>
      )}
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
        <div style={{fontFamily:FONT,fontSize:11,color:"#5a8068",marginBottom:8,letterSpacing:1}}>{incident.date} · {incident.location}</div>
        <div style={{fontFamily:FONT,fontSize:11,color:"#c8e8d0",lineHeight:1.8}}>{incident.description}</div>
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
            <div style={{fontFamily:FONT,fontSize:11,color:"#7aaa8a",lineHeight:1.7,marginBottom:10}}>{analysis.summary}</div>
            <div style={{padding:"8px 10px",background:"rgba(201,77,255,0.06)",border:"1px solid rgba(201,77,255,0.2)",borderRadius:3,marginBottom:10}}>
              <div style={{fontSize:9,color:"#c94dff",letterSpacing:2,marginBottom:4}}>CONSPIRACY ANGLE</div>
              <div style={{fontFamily:FONT,fontSize:10,color:"#e9b3ff",lineHeight:1.6}}>{analysis.conspiracy_angle}</div>
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
      <PolymarketWidget query={`${incident.name} UFO UAP`} />
    </div>
  );
}

// ── MAIN ───────────────────────────────────────────────────────
export default function UAPTracker() {
  const [data, setData]     = useState<{incidents:Incident[];people:Person[];organizations:Org[];documents:Document[];news:News[];generated_at:string}|null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab]       = useState<"incidents"|"people"|"orgs"|"documents"|"news">("incidents");
  const [selected, setSelected] = useState<Incident|null>(null);

  useEffect(()=>{
    fetch("/api/uap").then(r=>r.json()).then(d=>{ setData(d); if(d.incidents?.length) setSelected(d.incidents[0]); }).catch(()=>{}).finally(()=>setLoading(false));
  },[]);

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
          <div style={{width:1,height:20,background:"#1a3320"}}/>
          <div style={{fontFamily:RAJ,fontSize:14,fontWeight:700,color:"#00ff88",letterSpacing:2}}>THE THEORIST</div>
          <div style={{width:1,height:20,background:"#1a3320"}}/>
          <div style={{fontFamily:RAJ,fontSize:11,color:"#5a8068",letterSpacing:2}}>UAP INTELLIGENCE</div>
          <div style={{marginLeft:"auto",fontSize:10,color:"#3a5040",letterSpacing:1}}>FOIA · PENTAGON · CONGRESS · {new Date(data.generated_at).toLocaleTimeString()}</div>
        </div>

        <div style={{maxWidth:1200,margin:"0 auto",padding:"1.5rem 1.25rem 4rem"}}>

          {/* HEADER */}
          <div style={{marginBottom:"1.25rem",paddingBottom:"1rem",borderBottom:"1px solid #1a3320"}}>
            <div style={{fontFamily:RAJ,fontSize:10,letterSpacing:5,color:"#5a8068",marginBottom:5,textTransform:"uppercase"}}>■ UNIDENTIFIED AERIAL PHENOMENA — INTELLIGENCE DATABASE ■</div>
            <h1 style={{fontFamily:RAJ,fontSize:24,fontWeight:700,color:"#00ff88",letterSpacing:2,textTransform:"uppercase",textShadow:"0 0 16px rgba(0,255,136,0.2)",margin:"0 0 4px"}}>UAP Intelligence</h1>
            <div style={{fontSize:9,color:"#3a5040",letterSpacing:2}}>DECLASSIFIED DOCUMENTS · CONGRESSIONAL TESTIMONY · WHISTLEBLOWER REPORTS · LIVE NEWS FEED</div>
          </div>

          {/* STATS */}
          <div style={{display:"flex",gap:10,marginBottom:"1.25rem",flexWrap:"wrap"}}>
            {[
              {label:"INCIDENTS",value:data.incidents.length,col:"#00ff88"},
              {label:"DECLASSIFIED",value:data.incidents.filter(i=>i.classification==="DECLASSIFIED"||i.classification==="CONFIRMED").length,col:"#00bb66"},
              {label:"HIGH EVIDENCE",value:data.incidents.filter(i=>i.evidenceLevel==="HIGH").length,col:"#ff3333"},
              {label:"KEY WITNESSES",value:data.people.length,col:"#ffaa00"},
              {label:"DOCUMENTS",value:data.documents.length,col:"#c94dff"},
              {label:"LIVE ITEMS",value:data.news.length,col:"#00bb66"},
              {label:"AARO/PENTAGON",value:(data as UAPData).stats?.aaro_items??0,col:"#ffaa00"},
              {label:"FOIA/BLACKVAULT",value:((data as UAPData).stats?.blackvault_items??0)+((data as UAPData).stats?.muckrock_items??0),col:"#c94dff"},
            ].map(({label,value,col})=>(
              <div key={label} style={{border:"1px solid #1a3320",borderRadius:3,padding:"8px 14px",background:"#090f0b"}}>
                <div style={{fontSize:8,color:"#3a5040",letterSpacing:2,marginBottom:3}}>{label}</div>
                <div style={{fontFamily:RAJ,fontSize:22,fontWeight:700,color:col,lineHeight:1}}>{value}</div>
              </div>
            ))}
          </div>

          {/* WORLD MAP */}
          <div style={{marginBottom:"1.25rem"}}>
            <div style={{fontFamily:FONT,fontSize:9,color:"#5a8068",letterSpacing:2,marginBottom:8}}>
              ◈ GLOBAL INCIDENT MAP · {[["#00ff88","DECLASSIFIED"],["#00bb66","CONFIRMED"],["#ffaa00","REPORTED"],["#5a8068","ALLEGED"]].map(([col,label])=>(
                <span key={label} style={{display:"inline-flex",alignItems:"center",gap:4,marginLeft:12}}>
                  <span style={{width:7,height:7,borderRadius:"50%",background:col,display:"inline-block"}}/>
                  {label}
                </span>
              ))}
            </div>
            <UAPMap incidents={data.incidents} selected={selected} onSelect={s=>{setSelected(s);setTab("incidents");}}/>
          </div>

          {/* TABS + CONTENT */}
          <div style={{display:"grid",gridTemplateColumns:"1fr 340px",gap:"1.25rem"}}>

            {/* LEFT */}
            <div>
              {/* Tab bar */}
              <div style={{display:"flex",gap:4,marginBottom:"1rem",flexWrap:"wrap"}}>
                {TABS.map(t=>(
                  <button key={t.key} onClick={()=>setTab(t.key as typeof tab)}
                    style={{fontFamily:RAJ,fontSize:10,fontWeight:700,letterSpacing:1,textTransform:"uppercase",padding:"5px 12px",borderRadius:2,cursor:"pointer",border:`1px solid ${tab===t.key?"#00bb66":"#1a3320"}`,background:tab===t.key?"rgba(0,255,136,0.06)":"transparent",color:tab===t.key?"#00ff88":"#5a8068"}}>
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
                        style={{border:`1px solid ${isSel?col:"#1a3320"}`,borderRadius:4,padding:"11px 13px",background:isSel?"rgba(0,0,0,0.4)":"#090f0b",cursor:"pointer",transition:"border-color 0.15s"}}
                        onMouseEnter={e=>{if(!isSel)(e.currentTarget as HTMLDivElement).style.borderColor=col;}}
                        onMouseLeave={e=>{if(!isSel)(e.currentTarget as HTMLDivElement).style.borderColor="#1a3320";}}>
                        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:5}}>
                          <div>
                            <div style={{fontFamily:RAJ,fontSize:13,fontWeight:700,color:"#e8ffe8",lineHeight:1.3}}>{inc.name}</div>
                            <div style={{fontSize:9,color:"#5a8068",letterSpacing:1,marginTop:2}}>{inc.date} · {inc.location}</div>
                          </div>
                          <div style={{display:"flex",flexDirection:"column",gap:3,alignItems:"flex-end"}}>
                            <span style={classStyle(inc.classification)}>{inc.classification}</span>
                            <span style={{...classStyle("REPORTED" as Classification),color:EVD_COL[inc.evidenceLevel],border:`1px solid ${EVD_COL[inc.evidenceLevel]}`,fontSize:8}}>EVD: {inc.evidenceLevel}</span>
                          </div>
                        </div>
                        <div style={{fontSize:10,color:"#5a8068",lineHeight:1.6}}>{inc.description.slice(0,120)}...</div>
                        <div style={{display:"flex",gap:5,marginTop:7,flexWrap:"wrap"}}>
                          {inc.tags.map(t=><span key={t} style={{fontSize:8,color:"#3a5040",border:"1px solid #0d1a10",padding:"1px 5px",borderRadius:1,letterSpacing:0.5}}>{t}</span>)}
                        </div>
                      </div>
                    );
                  })}
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
                        <div style={{fontFamily:FONT,fontSize:10,color:"#7aaa8a",lineHeight:1.6,marginBottom:6}}>{o.description}</div>
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
                      <div style={{fontFamily:FONT,fontSize:10,color:"#7a5a88",lineHeight:1.6}}>{d.description}</div>
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
                  <div style={{fontFamily:RAJ,fontSize:15,fontWeight:700,color:"#00ff88",marginBottom:"1rem",paddingBottom:"0.5rem",borderBottom:"1px solid #1a3320"}}>{selected.name}</div>
                  <IncidentDetail incident={selected} people={data.people} orgs={data.organizations} docs={data.documents}/>
                </div>
              )}
              {tab!=="incidents"&&(
                <div style={{border:"1px solid #1a3320",borderRadius:4,padding:"1.5rem",textAlign:"center",color:"#3a5040",fontSize:10,letterSpacing:2}}>
                  SELECT AN INCIDENT<br/>FROM THE MAP OR LIST
                  <button onClick={()=>setTab("incidents")} style={{display:"block",margin:"12px auto 0",fontFamily:RAJ,fontSize:11,fontWeight:700,color:"#00bb66",background:"transparent",border:"1px solid #00bb66",borderRadius:3,padding:"5px 14px",cursor:"pointer",letterSpacing:2}}>VIEW INCIDENTS ▶</button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
