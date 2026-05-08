"use client";

import { useEffect, useRef, useState } from "react";

const FONT = "'Share Tech Mono', monospace";
const RAJ  = "'Rajdhani', sans-serif";

const LOG_LINES = [
  { text: "INITIALIZING ORACLE INTELLIGENCE ENGINE...", color: "#00ff88", delay: 0 },
  { text: "> CIA FOIA database — cross-reference active", color: "#7aaa8a", delay: 600 },
  { text: "> USPTO patent corpus — 14.2M records indexed", color: "#7aaa8a", delay: 1300 },
  { text: "> Guardian feed — article parsed + tokenized", color: "#7aaa8a", delay: 2000 },
  { text: "> Bayesian inference network — compiling...", color: "#7aaa8a", delay: 2800 },
  { text: "> Source-tier confidence weighting applied", color: "#7aaa8a", delay: 3700 },
  { text: "> Node graph topology — resolving edges...", color: "#7aaa8a", delay: 4600 },
  { text: "> [CLASSIFIED SIGNAL DETECTED] ████████████", color: "#ff3333", delay: 5500 },
  { text: "> Conspiracy pattern matching — 3 theories found", color: "#ffaa00", delay: 6400 },
  { text: "> Streaming structured intelligence...", color: "#00ff88", delay: 7200 },
];

const GRAPH_NODES = [
  { id: 0, x: 200, y: 200, r: 22, type: "center", label: "ARTICLE", delay: 0 },
  { id: 1, x: 200, y: 68,  r: 14, type: "foia",   label: "CIA FOIA", delay: 800 },
  { id: 2, x: 316, y: 134, r: 14, type: "patent",  label: "USPTO",    delay: 1400 },
  { id: 3, x: 316, y: 266, r: 14, type: "company", label: "CORP",     delay: 2100 },
  { id: 4, x: 200, y: 332, r: 14, type: "event",   label: "EVENT",    delay: 2800 },
  { id: 5, x: 84,  y: 266, r: 14, type: "person",  label: "AGENT",    delay: 3500 },
  { id: 6, x: 84,  y: 134, r: 14, type: "theory",  label: "THEORY",   delay: 4300 },
];

const GRAPH_EDGES = [
  { from: 0, to: 1, delay: 1200 },
  { from: 0, to: 2, delay: 1800 },
  { from: 0, to: 3, delay: 2500 },
  { from: 0, to: 4, delay: 3100 },
  { from: 0, to: 5, delay: 3800 },
  { from: 0, to: 6, delay: 4600 },
  { from: 1, to: 6, delay: 5200 },
  { from: 2, to: 3, delay: 5600 },
];

const NODE_COLORS: Record<string, string> = {
  center: "#00ff88", foia: "#ff3333", patent: "#ff5555",
  company: "#ffaa00", event: "#ffcc44", person: "#00bb66", theory: "#c94dff",
};

// Mock image URLs — free unsplash/picsum images that look like surveillance/data/tech
const SCAN_IMAGES = [
  { src: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=480&h=360&fit=crop", label: "SATELLITE FEED #A1" },
  { src: "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=480&h=360&fit=crop", label: "SERVER INFRA #B4" },
  { src: "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=480&h=360&fit=crop", label: "DATA STREAM #C2" },
  { src: "https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=480&h=360&fit=crop", label: "AERIAL SCAN #D7" },
  { src: "https://images.unsplash.com/photo-1518770660439-4636190af475?w=480&h=360&fit=crop", label: "CIRCUIT TRACE #E3" },
  { src: "https://images.unsplash.com/photo-1542903660-eedba2cda473?w=480&h=360&fit=crop", label: "NETWORK MAP #F9" },
  { src: "https://images.unsplash.com/photo-1563986768494-4dee2763ff3f?w=480&h=360&fit=crop", label: "SIGNAL TRACE #G1" },
  { src: "https://images.unsplash.com/photo-1510511459019-5dda7724fd87?w=480&h=360&fit=crop", label: "URBAN SCAN #H5" },
  { src: "https://images.unsplash.com/photo-1569012871812-f38ee64cd54c?w=480&h=360&fit=crop", label: "SURVEILLANCE #I2" },
  { src: "https://images.unsplash.com/photo-1531297484001-80022131f5a1?w=480&h=360&fit=crop", label: "TERMINAL #J6" },
  { src: "https://images.unsplash.com/photo-1614064641938-3bbee52942c7?w=480&h=360&fit=crop", label: "NETWORK NODE #K3" },
  { src: "https://images.unsplash.com/photo-1639762681485-074b7f938ba0?w=480&h=360&fit=crop", label: "CRYPTO TRACE #L8" },
  { src: "https://images.unsplash.com/photo-1579548122080-c35fd6820ecb?w=480&h=360&fit=crop", label: "SIGNAL MAP #M1" },
  { src: "https://images.unsplash.com/photo-1506792006437-256b665541e2?w=480&h=360&fit=crop", label: "ORBITAL SCAN #N4" },
  { src: "https://images.unsplash.com/photo-1548092372-0d1bd40894a3?w=480&h=360&fit=crop", label: "DATA CLUSTER #O7" },
  { src: "https://images.unsplash.com/photo-1504384308090-c894fdcc538d?w=480&h=360&fit=crop", label: "OPS CENTER #P2" },
];

interface ScanImage {
  id: number;
  src: string;
  label: string;
  // Start position: far outside, random angle
  startX: number;
  startY: number;
  // End position: near center
  endX: number;
  endY: number;
  scale: number;
  rotation: number;
  duration: number;
  born: number;
}

export default function OracleLoadingScreen() {
  const [elapsed, setElapsed]           = useState(0);
  const [visibleLogs, setVisibleLogs]   = useState<number[]>([]);
  const [visibleNodes, setVisibleNodes] = useState<number[]>([]);
  const [visibleEdges, setVisibleEdges] = useState<number[]>([]);
  const [glitch, setGlitch]             = useState(false);
  const [scanAngle, setScanAngle]       = useState(0);
  const [dataStream, setDataStream]     = useState<string[]>([]);
  const [scanImages, setScanImages]     = useState<ScanImage[]>([]);
  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const startRef   = useRef(Date.now());
  const imgCounter = useRef(0);

  // Elapsed timer
  useEffect(() => {
    const iv = setInterval(() => setElapsed(Math.floor((Date.now() - startRef.current) / 1000)), 500);
    return () => clearInterval(iv);
  }, []);

  // Log lines
  useEffect(() => {
    LOG_LINES.forEach((l, i) => setTimeout(() => setVisibleLogs(p => [...p, i]), l.delay));
  }, []);

  // Nodes
  useEffect(() => {
    GRAPH_NODES.forEach((n, i) => setTimeout(() => setVisibleNodes(p => [...p, i]), n.delay));
  }, []);

  // Edges
  useEffect(() => {
    GRAPH_EDGES.forEach((e, i) => setTimeout(() => setVisibleEdges(p => [...p, i]), e.delay));
  }, []);

  // Radar sweep
  useEffect(() => {
    const iv = setInterval(() => setScanAngle(a => (a + 1.5) % 360), 16);
    return () => clearInterval(iv);
  }, []);

  // Glitch
  useEffect(() => {
    const iv = setInterval(() => {
      setGlitch(true);
      setTimeout(() => setGlitch(false), 100);
    }, 3000 + Math.random() * 2000);
    return () => clearInterval(iv);
  }, []);

  // Data stream
  useEffect(() => {
    const chars = "01アイウエオカキクケコABCDEF0123456789█▓▒░";
    const iv = setInterval(() => {
      const line = Array.from({ length: 28 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
      setDataStream(prev => [line, ...prev.slice(0, 18)]);
    }, 80);
    return () => clearInterval(iv);
  }, []);

  // Scanning images — accelerating spawn, big→small, fast
  useEffect(() => {
    const cx = window.innerWidth / 2;
    const cy = window.innerHeight / 2;
    let spawnInterval = 900; // starts at 900ms
    let ivRef: ReturnType<typeof setInterval>;

    function spawn() {
      const idx = imgCounter.current % SCAN_IMAGES.length;
      imgCounter.current += 1;
      const img = SCAN_IMAGES[idx];

      const angle = Math.random() * Math.PI * 2;
      const dist = 900 + Math.random() * 300;
      const startX = cx + Math.cos(angle) * dist;
      const startY = cy + Math.sin(angle) * dist;

      // End: spread wider around center
      const endX = cx + (Math.random() - 0.5) * 320;
      const endY = cy + (Math.random() - 0.5) * 280;

      const newImg: ScanImage = {
        id: Date.now() + Math.random(),
        src: img.src,
        label: img.label,
        startX, startY, endX, endY,
        // Start LARGE (screen-filling feel), shrink to small
        scale: 1.4 + Math.random() * 0.6,
        rotation: (Math.random() - 0.5) * 18,
        duration: 1800 + Math.random() * 800,
        born: Date.now(),
      };

      setScanImages(prev => [...prev.slice(-12), newImg]);
    }

    function startInterval() {
      clearInterval(ivRef);
      ivRef = setInterval(() => {
        spawn();
        // Accelerate: shrink interval down to 280ms
        if (spawnInterval > 280) {
          spawnInterval = Math.max(280, spawnInterval * 0.88);
          startInterval();
        }
      }, spawnInterval);
    }

    // Burst of 3 immediately
    spawn(); spawn(); spawn();
    startInterval();
    return () => clearInterval(ivRef);
  }, []);

  // Matrix canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    canvas.width  = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    const cols = Math.floor(canvas.width / 14);
    const drops = Array(cols).fill(1).map(() => Math.random() * canvas.height / 14);
    let raf: number;
    function draw() {
      ctx!.fillStyle = "rgba(3,8,6,0.07)";
      ctx!.fillRect(0, 0, canvas!.width, canvas!.height);
      ctx!.fillStyle = "rgba(0,255,136,0.1)";
      ctx!.font = "11px monospace";
      drops.forEach((y, i) => {
        const char = String.fromCharCode(0x30A0 + Math.random() * 96);
        ctx!.fillText(char, i * 14, y * 14);
        if (y * 14 > canvas!.height && Math.random() > 0.975) drops[i] = 0;
        drops[i] += 0.35;
      });
      raf = requestAnimationFrame(draw);
    }
    draw();
    return () => cancelAnimationFrame(raf);
  }, []);

  const rad = (deg: number) => (deg * Math.PI) / 180;

  return (
    <div style={{ position: "relative", minHeight: "100vh", background: "#030806", overflow: "hidden", fontFamily: FONT }}>

      {/* Matrix canvas */}
      <canvas ref={canvasRef} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0.55 }} />

      {/* Vignette */}
      <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at center, transparent 25%, rgba(3,8,6,0.88) 100%)", pointerEvents: "none" }} />

      {/* Grid */}
      <div style={{ position: "absolute", inset: 0, opacity: 0.07, backgroundImage: "linear-gradient(#0d2818 1px, transparent 1px), linear-gradient(90deg, #0d2818 1px, transparent 1px)", backgroundSize: "32px 32px", pointerEvents: "none" }} />

      {/* ── SCANNING IMAGES ─────────────────────────────────────── */}
      {scanImages.map((img) => {
        const progress = Math.min((Date.now() - img.born) / img.duration, 1);
        const x = img.startX + (img.endX - img.startX) * progress;
        const y = img.startY + (img.endY - img.startY) * progress;
        // Scale: starts HUGE, shrinks dramatically as it zooms in
        const scale = img.scale * (2.2 - progress * 1.9);
        // Opacity: fade in then fade out near end
        const opacity = progress < 0.1
          ? progress / 0.1 * 0.72
          : progress > 0.72
          ? (1 - progress) / 0.28 * 0.72
          : 0.72;
        const w = 320;
        const h = 230;

        return (
          <div
            key={img.id}
            style={{
              position: "fixed",
              left: x - (w * scale) / 2,
              top: y - (h * scale) / 2,
              width: w,
              height: h,
              transform: `scale(${scale}) rotate(${img.rotation * (1 - progress * 0.5)}deg)`,
              transformOrigin: "center center",
              opacity,
              pointerEvents: "none",
              zIndex: 5,
              transition: "none",
            }}
          >
            {/* Scanlines overlay */}
            <div style={{
              position: "absolute", inset: 0, zIndex: 2, pointerEvents: "none",
              background: "repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,255,136,0.06) 3px, rgba(0,255,136,0.06) 4px)",
            }} />
            {/* Green tint overlay */}
            <div style={{
              position: "absolute", inset: 0, zIndex: 3,
              background: "linear-gradient(135deg, rgba(0,255,136,0.08) 0%, rgba(0,0,0,0.4) 100%)",
              mixBlendMode: "screen",
            }} />
            {/* Border */}
            <div style={{
              position: "absolute", inset: 0, zIndex: 4,
              border: "1px solid rgba(0,255,136,0.4)",
              boxShadow: "0 0 12px rgba(0,255,136,0.15), inset 0 0 8px rgba(0,255,136,0.05)",
            }} />
            {/* Corner brackets */}
            {[{top:0,left:0},{top:0,right:0},{bottom:0,left:0},{bottom:0,right:0}].map((pos,i) => (
              <div key={i} style={{ position:"absolute", width:12, height:12, zIndex:5, ...pos,
                borderTop: i < 2 ? "1.5px solid #00ff88" : undefined,
                borderBottom: i >= 2 ? "1.5px solid #00ff88" : undefined,
                borderLeft: i % 2 === 0 ? "1.5px solid #00ff88" : undefined,
                borderRight: i % 2 === 1 ? "1.5px solid #00ff88" : undefined,
              }} />
            ))}
            {/* Image */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={img.src} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", filter: "saturate(0.15) brightness(0.6) contrast(1.2)", display: "block" }} />
            {/* Label */}
            <div style={{
              position: "absolute", bottom: 4, left: 6, zIndex: 5,
              fontSize: 8, color: "rgba(0,255,136,0.7)", letterSpacing: 1.5,
              fontFamily: FONT, textShadow: "0 0 6px rgba(0,255,136,0.5)",
            }}>
              {img.label}
            </div>
            {/* Scan line sweep */}
            <div style={{
              position: "absolute", left: 0, right: 0, height: 2, zIndex: 6,
              top: `${(progress * 200) % 100}%`,
              background: "linear-gradient(90deg, transparent, rgba(0,255,136,0.6), transparent)",
            }} />
          </div>
        );
      })}

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Share+Tech+Mono&family=Rajdhani:wght@700&display=swap');
        @keyframes oracle-dash { to { stroke-dashoffset: -32; } }
        @keyframes oracle-glow { 0%,100%{opacity:0.5;filter:drop-shadow(0 0 3px currentColor)} 50%{opacity:1;filter:drop-shadow(0 0 12px currentColor)} }
        @keyframes oracle-pulse { 0%,100%{transform:scale(1);opacity:0.7} 50%{transform:scale(1.15);opacity:1} }
        @keyframes oracle-ring { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        @keyframes oracle-ring-rev { from{transform:rotate(0deg)} to{transform:rotate(-360deg)} }
        @keyframes oracle-fade-in { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
        @keyframes oracle-blink { 0%,100%{opacity:1} 50%{opacity:0} }
        .oracle-log-line { animation: oracle-fade-in 0.35s ease forwards; }
        .oracle-blink { animation: oracle-blink 0.9s step-end infinite; }
      `}</style>

      <div style={{ position: "relative", zIndex: 10, maxWidth: 1200, margin: "0 auto", minHeight: "100vh", display: "flex", alignItems: "center", padding: "2rem 1.5rem", gap: "3rem" }}>

        {/* LEFT: Log terminal */}
        <div style={{ flex: "0 0 400px", display: "flex", flexDirection: "column", gap: 0 }}>
          <div style={{ marginBottom: "2rem" }}>
            <div style={{ fontFamily: RAJ, fontSize: 10, fontWeight: 700, color: "#1a4a2a", letterSpacing: 6, marginBottom: 8, textTransform: "uppercase" }}>■ CLASSIFIED INTELLIGENCE SYSTEM ■</div>
            <div style={{ fontFamily: RAJ, fontSize: glitch ? 27 : 28, fontWeight: 700, color: glitch ? "#ff3333" : "#00ff88", letterSpacing: 2, textTransform: "uppercase", textShadow: "0 0 20px rgba(0,255,136,0.35)", lineHeight: 1.1, transform: glitch ? "translateX(2px)" : "none" }}>
              {glitch ? "0R4CLE" : "ORACLE"}
            </div>
            <div style={{ fontFamily: RAJ, fontSize: 13, fontWeight: 700, color: "#5a8068", letterSpacing: 4, textTransform: "uppercase", marginTop: 2 }}>INVESTIGATION ENGINE</div>
          </div>

          <div style={{ background: "rgba(5,12,7,0.75)", border: "1px solid #1a3320", borderRadius: 4, padding: "14px 16px", minHeight: 260, display: "flex", flexDirection: "column", gap: 2 }}>
            <div style={{ fontSize: 9, color: "#1a4a2a", letterSpacing: 3, marginBottom: 10, textTransform: "uppercase" }}>
              SYSTEM LOG — {new Date().toISOString().split("T")[0]}
            </div>
            {LOG_LINES.map((line, i) =>
              visibleLogs.includes(i) ? (
                <div key={i} className="oracle-log-line" style={{ fontSize: 11, color: line.color, lineHeight: 1.8, letterSpacing: 0.5 }}>
                  {line.text}
                </div>
              ) : null
            )}
            {visibleLogs.length < LOG_LINES.length && (
              <span style={{ fontSize: 11, color: "#7aaa8a" }}>
                <span className="oracle-blink" style={{ color: "#00ff88" }}>▌</span>
              </span>
            )}
          </div>

          <div style={{ marginTop: 10, background: "rgba(5,12,7,0.6)", border: "1px solid #0d1f12", borderRadius: 3, padding: "8px 12px", overflow: "hidden", height: 90 }}>
            <div style={{ fontSize: 9, color: "#0d2818", letterSpacing: 2, marginBottom: 5 }}>RAW DATA STREAM</div>
            {dataStream.slice(0, 6).map((line, i) => (
              <div key={i} style={{ fontSize: 9, color: `rgba(0,187,102,${0.14 - i * 0.02})`, letterSpacing: 1, lineHeight: 1.5, whiteSpace: "nowrap" }}>{line}</div>
            ))}
          </div>

          <div style={{ marginTop: 12, display: "flex", justifyContent: "space-between", fontSize: 10, color: "#2a4a30", letterSpacing: 1 }}>
            <span>ELAPSED: {elapsed}s</span>
            <span>ETA: 15–45s</span>
            <span className="oracle-blink" style={{ color: "#00bb66" }}>● LIVE</span>
          </div>
        </div>

        {/* CENTER: Graph */}
        <div style={{ flex: 1, display: "flex", justifyContent: "center", alignItems: "center" }}>
          <div style={{ position: "relative", width: 440, height: 440 }}>
            <div style={{ position: "absolute", inset: -20, borderRadius: "50%", background: "radial-gradient(circle, rgba(0,255,136,0.05) 0%, transparent 70%)", pointerEvents: "none" }} />

            <svg width="440" height="440" viewBox="0 0 400 400" style={{ position: "absolute", inset: 0 }}>
              <defs>
                <radialGradient id="radarG" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#00ff88" stopOpacity="0.15" />
                  <stop offset="100%" stopColor="#00ff88" stopOpacity="0" />
                </radialGradient>
                <filter id="glow2">
                  <feGaussianBlur stdDeviation="3" result="blur" />
                  <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
                </filter>
              </defs>

              {[40, 80, 130, 170].map((r, i) => (
                <circle key={r} cx="200" cy="200" r={r} fill="none" stroke="#0d2818" strokeWidth={i === 3 ? 1.5 : 0.8} strokeDasharray={i % 2 === 0 ? "4 8" : "none"} />
              ))}
              <g style={{ animation: "oracle-ring 12s linear infinite", transformOrigin: "200px 200px" }}>
                <circle cx="200" cy="200" r="155" fill="none" stroke="#1a3320" strokeWidth="1" strokeDasharray="3 12" />
              </g>
              <g style={{ animation: "oracle-ring-rev 18s linear infinite", transformOrigin: "200px 200px" }}>
                <circle cx="200" cy="200" r="185" fill="none" stroke="#0d1f12" strokeWidth="1" strokeDasharray="6 20" />
              </g>

              {/* Radar sweep */}
              <g style={{ transformOrigin: "200px 200px", transform: `rotate(${scanAngle}deg)` }}>
                <path d="M200,200 L200,30" stroke="#00ff88" strokeWidth="1.5" strokeOpacity="0.6" />
                {[0, 10, 20, 30, 40].map(offset => (
                  <path key={offset}
                    d={`M200,200 L${200 + 170 * Math.sin(rad(-offset))},${200 - 170 * Math.cos(rad(-offset))}`}
                    stroke="#00ff88" strokeWidth="1" strokeOpacity={0.14 - offset * 0.003}
                  />
                ))}
                <path d="M200,200 L200,30" stroke="url(#radarG)" strokeWidth="40" strokeOpacity="0.1" />
              </g>

              <line x1="200" y1="0" x2="200" y2="400" stroke="#0d2818" strokeWidth="0.5" />
              <line x1="0" y1="200" x2="400" y2="200" stroke="#0d2818" strokeWidth="0.5" />

              {GRAPH_EDGES.map((e, i) => {
                if (!visibleEdges.includes(i)) return null;
                const from = GRAPH_NODES[e.from];
                const to   = GRAPH_NODES[e.to];
                const col  = NODE_COLORS[GRAPH_NODES[e.from].type] ?? "#00bb66";
                return (
                  <line key={i} x1={from.x} y1={from.y} x2={to.x} y2={to.y}
                    stroke={col} strokeWidth="1.5" strokeOpacity="0.5" strokeDasharray="6 10"
                    style={{ animation: `oracle-dash ${1.8 + i * 0.2}s linear infinite` }}
                  />
                );
              })}

              {GRAPH_NODES.map((n, i) => {
                if (!visibleNodes.includes(i)) return null;
                const col = NODE_COLORS[n.type] ?? "#00bb66";
                return (
                  <g key={n.id} style={{ animation: "oracle-fade-in 0.4s ease forwards" }}>
                    <circle cx={n.x} cy={n.y} r={n.r + 8} fill={col} opacity="0.06"
                      style={{ animation: `oracle-pulse ${1.8 + i * 0.3}s ease-in-out infinite` }} />
                    <circle cx={n.x} cy={n.y} r={n.r} fill="#030806" stroke={col}
                      strokeWidth={n.type === "center" ? 2 : 1.5}
                      style={{ animation: `oracle-glow ${2 + i * 0.25}s ease-in-out infinite`, color: col }}
                      filter="url(#glow2)" />
                    <circle cx={n.x} cy={n.y} r={n.type === "center" ? 5 : 3} fill={col} opacity="0.8" />
                    <text x={n.x} y={n.y + n.r + 14} textAnchor="middle" fill={col} opacity="0.7"
                      style={{ fontFamily: FONT, fontSize: n.type === "center" ? 9 : 8, letterSpacing: 1 }}>
                      {n.label}
                    </text>
                  </g>
                );
              })}

              <line x1="188" y1="200" x2="212" y2="200" stroke="#00ff88" strokeWidth="1" strokeOpacity="0.4" />
              <line x1="200" y1="188" x2="200" y2="212" stroke="#00ff88" strokeWidth="1" strokeOpacity="0.4" />
            </svg>

            <div style={{ position: "absolute", top: 8, left: 8, fontSize: 9, color: "#1a4a2a", letterSpacing: 2, fontFamily: FONT }}>TGT: ARTICLE/{Math.max(0, visibleNodes.length - 1)} NODES</div>
            <div style={{ position: "absolute", top: 8, right: 8, fontSize: 9, color: "#1a4a2a", letterSpacing: 2, fontFamily: FONT, textAlign: "right" }}>{visibleEdges.length} LINKS</div>
            <div style={{ position: "absolute", bottom: 8, left: 8, fontSize: 9, color: "#1a4a2a", letterSpacing: 2, fontFamily: FONT }}>SCAN: {Math.round(scanAngle)}°</div>
            <div style={{ position: "absolute", bottom: 8, right: 8, fontSize: 9, color: "#00bb66", letterSpacing: 2, fontFamily: FONT }}><span className="oracle-blink">◉</span> LIVE</div>

            {[{top:0,left:0},{top:0,right:0},{bottom:0,left:0},{bottom:0,right:0}].map((style, i) => (
              <div key={i} style={{ position: "absolute", width: 20, height: 20, ...style,
                borderTop: i < 2 ? "1px solid #1a4a2a" : undefined,
                borderBottom: i >= 2 ? "1px solid #1a4a2a" : undefined,
                borderLeft: i % 2 === 0 ? "1px solid #1a4a2a" : undefined,
                borderRight: i % 2 === 1 ? "1px solid #1a4a2a" : undefined,
              }} />
            ))}
          </div>
        </div>

        {/* RIGHT: Stats */}
        <div style={{ flex: "0 0 150px", display: "flex", flexDirection: "column", gap: 10 }}>
          {[
            { label: "NODES",   value: visibleNodes.length,                                  max: GRAPH_NODES.length, color: "#00ff88" },
            { label: "EDGES",   value: visibleEdges.length,                                  max: GRAPH_EDGES.length, color: "#00bb66" },
            { label: "SOURCES", value: Math.min(Math.floor(elapsed * 0.8), 12),              max: 12,                 color: "#ffaa00" },
            { label: "THEORIES",value: Math.min(Math.floor(elapsed * 0.15), 3),              max: 3,                  color: "#c94dff" },
          ].map(({ label, value, max, color }) => (
            <div key={label} style={{ border: "1px solid #1a3320", borderRadius: 3, padding: "10px 12px", background: "rgba(5,12,7,0.75)" }}>
              <div style={{ fontSize: 9, color: "#3a5040", letterSpacing: 2, marginBottom: 5 }}>{label}</div>
              <div style={{ fontFamily: RAJ, fontSize: 26, fontWeight: 700, color, lineHeight: 1, marginBottom: 6 }}>{value}</div>
              <div style={{ height: 2, background: "#0d1f12", borderRadius: 1, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${(value / max) * 100}%`, background: color, borderRadius: 1, transition: "width 0.5s ease" }} />
              </div>
            </div>
          ))}
          <div style={{ border: "1px solid rgba(255,51,51,0.2)", borderRadius: 3, padding: "10px 12px", background: "rgba(255,51,51,0.04)", marginTop: 4 }}>
            <div style={{ fontSize: 9, color: "#3a2020", letterSpacing: 2, marginBottom: 5 }}>THREAT LEVEL</div>
            <div style={{ fontFamily: RAJ, fontSize: 26, fontWeight: 700, color: "#ff3333", lineHeight: 1, marginBottom: 2 }}><span className="oracle-blink">?</span></div>
            <div style={{ fontSize: 9, color: "#5a2020", letterSpacing: 1 }}>COMPUTING...</div>
          </div>
        </div>
      </div>
    </div>
  );
}
