"use client";
import { useEffect, useState } from "react";

const RAJ = "var(--font-raj), sans-serif";
const FONT = "var(--font-share-tech-mono), monospace";

interface PM { id:string; question:string; yesPrice:number; noPrice:number; volume:number; volume24h:number; liquidity:number; endDate:string; url:string; }

function fmt(v:number) { return v>=1e6?`$${(v/1e6).toFixed(1)}M`:v>=1e3?`$${(v/1e3).toFixed(0)}K`:`$${v}`; }
function days(d:string) { if(!d)return""; const n=Math.ceil((new Date(d).getTime()-Date.now())/86400000); return n<0?"expired":n===0?"today":`${n}d`; }

export default function PolymarketWidget({ query }:{ query:string }) {
  const [markets, setMarkets] = useState<PM[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/polymarket?q=${encodeURIComponent(query)}`).then(r=>r.json()).then(d=>setMarkets(d.markets??[])).catch(()=>{}).finally(()=>setLoading(false));
  }, [query]);

  if (loading) return (
    <div style={{border:"1px solid rgba(201,77,255,0.2)",borderRadius:4,padding:"10px 12px",background:"rgba(20,8,28,0.5)"}}>
      <div style={{display:"flex",alignItems:"center",gap:7}}>
        <span style={{width:6,height:6,borderRadius:"50%",background:"#c94dff",display:"inline-block",animation:"bannerDot 0.9s step-end infinite"}}/>
        <span style={{fontFamily:FONT,fontSize:9,color:"#c94dff",letterSpacing:2}}>SCANNING POLYMARKET...</span>
      </div>
    </div>
  );
  if (!markets.length) return null;

  return (
    <div>
      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
        <span style={{width:6,height:6,borderRadius:"50%",background:"#c94dff",display:"inline-block"}}/>
        <span style={{fontFamily:FONT,fontSize:9,color:"#c94dff",letterSpacing:3}}>◈ POLYMARKET — {markets.length} ACTIVE BET{markets.length>1?"S":""}</span>
        <a href="https://polymarket.com" target="_blank" rel="noreferrer" style={{marginLeft:"auto",fontSize:8,color:"#5a8068",textDecoration:"none"}}>polymarket.com ↗</a>
      </div>
      {markets.map(m => (
        <div key={m.id} style={{border:"1px solid rgba(201,77,255,0.25)",borderRadius:4,background:"rgba(20,8,28,0.8)",marginBottom:8,overflow:"hidden"}}>
          <div style={{padding:"9px 12px",borderBottom:"1px solid rgba(201,77,255,0.15)",display:"flex",justifyContent:"space-between",gap:8}}>
            <div style={{fontFamily:RAJ,fontSize:12,fontWeight:700,color:"#e9b3ff",lineHeight:1.3,flex:1}}>{m.question}</div>
            <a href={m.url} target="_blank" rel="noreferrer" style={{fontSize:9,color:"#c94dff",border:"1px solid rgba(201,77,255,0.3)",padding:"2px 7px",borderRadius:2,textDecoration:"none",whiteSpace:"nowrap",letterSpacing:1,flexShrink:0}}>↗ BET</a>
          </div>
          <div style={{padding:"10px 12px"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end",marginBottom:8}}>
              <div style={{textAlign:"center"}}>
                <div style={{fontFamily:RAJ,fontSize:26,fontWeight:700,color:"#00ff88",lineHeight:1}}>{m.yesPrice}¢</div>
                <div style={{fontSize:8,color:"#5a8068",letterSpacing:1}}>YES</div>
              </div>
              <div style={{flex:1,padding:"0 10px"}}>
                <div style={{display:"flex",height:4,borderRadius:2,overflow:"hidden"}}>
                  <div style={{width:`${m.yesPrice}%`,background:"#00bb66"}}/>
                  <div style={{width:`${m.noPrice}%`,background:"#ff3333"}}/>
                </div>
              </div>
              <div style={{textAlign:"center"}}>
                <div style={{fontFamily:RAJ,fontSize:26,fontWeight:700,color:"#ff3333",lineHeight:1}}>{m.noPrice}¢</div>
                <div style={{fontSize:8,color:"#5a8068",letterSpacing:1}}>NO</div>
              </div>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:5,marginBottom:8}}>
              <a href={m.url} target="_blank" rel="noreferrer" style={{display:"block",textAlign:"center",padding:"6px",borderRadius:3,border:"1px solid rgba(0,187,102,0.35)",background:"rgba(0,187,102,0.08)",color:"#00ff88",fontFamily:RAJ,fontSize:11,fontWeight:700,letterSpacing:1,textDecoration:"none"}}>BUY YES {m.yesPrice}¢</a>
              <a href={m.url} target="_blank" rel="noreferrer" style={{display:"block",textAlign:"center",padding:"6px",borderRadius:3,border:"1px solid rgba(255,51,51,0.35)",background:"rgba(255,51,51,0.08)",color:"#ff3333",fontFamily:RAJ,fontSize:11,fontWeight:700,letterSpacing:1,textDecoration:"none"}}>BUY NO {m.noPrice}¢</a>
            </div>
            <div style={{display:"flex",gap:10,fontSize:9,color:"#5a8068",letterSpacing:1}}>
              <span>VOL {fmt(m.volume)}</span>
              <span>24H {fmt(m.volume24h)}</span>
              <span>LIQ {fmt(m.liquidity)}</span>
              {m.endDate&&<span style={{marginLeft:"auto",color:"#3a5040"}}>{days(m.endDate)}</span>}
            </div>
          </div>
        </div>
      ))}
      <div style={{fontSize:9,color:"#3a3040",letterSpacing:1,textAlign:"center",marginTop:4}}>Prediction market · Not financial advice</div>
    </div>
  );
}
