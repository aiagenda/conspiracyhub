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

const NODES = [
  { id: 0, x: 200, y: 200, r: 22, type: "center", label: "ARTICLE", delay: 0 },
  { id: 1, x: 200, y: 68,  r: 14, type: "foia",   label: "CIA FOIA", delay: 800 },
  { id: 2, x: 316, y: 134, r: 14, type: "patent",  label: "USPTO",    delay: 1400 },
  { id: 3, x: 316, y: 266, r: 14, type: "company", label: "CORP",     delay: 2100 },
  { id: 4, x: 200, y: 332, r: 14, type: "event",   label: "EVENT",    delay: 2800 },
  { id: 5, x: 84,  y: 266, r: 14, type: "person",  label: "AGENT",    delay: 3500 },
  { id: 6, x: 84,  y: 134, r: 14, type: "theory",  label: "THEORY",   delay: 4300 },
];

const EDGES = [
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

export default function OracleLoadingScreen() {
  const [elapsed, setElapsed]         = useState(0);
  const [visibleLogs, setVisibleLogs] = useState<number[]>([]);
  const [visibleNodes, setVisibleNodes] = useState<number[]>([]);
  const [visibleEdges, setVisibleEdges] = useState<number[]>([]);
  const [glitch, setGlitch]           = useState(false);
  const [scanAngle, setScanAngle]     = useState(0);
  const [dataStream, setDataStream]   = useState<string[]>([]);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const startRef  = useRef(Date.now());

  // Elapsed timer
  useEffect(() => {
    const iv = setInterval(() => setElapsed(Math.floor((Date.now() - startRef.current) / 1000)), 500);
    return () => clearInterval(iv);
  }, []);

  // Log lines appearance
  useEffect(() => {
    LOG_LINES.forEach((l, i) => {
      setTimeout(() => setVisibleLogs(prev => [...prev, i]), l.delay);
    });
  }, []);

  // Node appearance
  useEffect(() => {
    NODES.forEach((n, i) => {
      setTimeout(() => setVisibleNodes(prev => [...prev, i]), n.delay);
    });
  }, []);

  // Edge appearance
  useEffect(() => {
    EDGES.forEach((e, i) => {
      setTimeout(() => setVisibleEdges(prev => [...prev, i]), e.delay);
    });
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
    const chars = "01アイウエオカキクケコサシスセソタチツテトABCDEF0123456789█▓▒░";
    const iv = setInterval(() => {
      const line = Array.from({ length: 28 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
      setDataStream(prev => [line, ...prev.slice(0, 18)]);
    }, 80);
    return () => clearInterval(iv);
  }, []);

  // Canvas: animated matrix rain background
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
      ctx!.fillStyle = "rgba(5,12,7,0.07)";
      ctx!.fillRect(0, 0, canvas!.width, canvas!.height);
      ctx!.fillStyle = "rgba(0,255,136,0.12)";
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

      {/* Matrix canvas background */}
      <canvas ref={canvasRef} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0.6 }} />

      {/* Vignette */}
      <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at center, transparent 30%, rgba(3,8,6,0.85) 100%)", pointerEvents: "none" }} />

      {/* Grid */}
      <div style={{ position: "absolute", inset: 0, opacity: 0.08, backgroundImage: "linear-gradient(#0d2818 1px, transparent 1px), linear-gradient(90deg, #0d2818 1px, transparent 1px)", backgroundSize: "32px 32px", pointerEvents: "none" }} />

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Share+Tech+Mono&family=Rajdhani:wght@700&display=swap');
        @keyframes oracle-dash { to { stroke-dashoffset: -32; } }
        @keyframes oracle-glow { 0%,100%{opacity:0.5;filter:drop-shadow(0 0 3px currentColor)} 50%{opacity:1;filter:drop-shadow(0 0 12px currentColor)} }
        @keyframes oracle-pulse { 0%,100%{transform:scale(1);opacity:0.7} 50%{transform:scale(1.15);opacity:1} }
        @keyframes oracle-ring { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        @keyframes oracle-ring-rev { from{transform:rotate(0deg)} to{transform:rotate(-360deg)} }
        @keyframes oracle-fade-in { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
        @keyframes oracle-scan { 0%{opacity:0} 10%{opacity:1} 90%{opacity:1} 100%{opacity:0} }
        @keyframes oracle-blink { 0%,100%{opacity:1} 50%{opacity:0} }
        .oracle-log-line { animation: oracle-fade-in 0.35s ease forwards; }
        .oracle-blink { animation: oracle-blink 0.9s step-end infinite; }
      `}</style>

      <div style={{ position: "relative", zIndex: 10, maxWidth: 1200, margin: "0 auto", minHeight: "100vh", display: "flex", alignItems: "center", padding: "2rem 1.5rem", gap: "3rem" }}>

        {/* LEFT: Log terminal */}
        <div style={{ flex: "0 0 420px", display: "flex", flexDirection: "column", gap: 0 }}>

          {/* Title */}
          <div style={{ marginBottom: "2rem" }}>
            <div style={{ fontFamily: RAJ, fontSize: 11, fontWeight: 700, color: "#1a4a2a", letterSpacing: 6, marginBottom: 8, textTransform: "uppercase" }}>
              ■ CLASSIFIED INTELLIGENCE SYSTEM ■
            </div>
            <div style={{ fontFamily: RAJ, fontSize: glitch ? 27 : 28, fontWeight: 700, color: glitch ? "#ff3333" : "#00ff88", letterSpacing: 2, textTransform: "uppercase", textShadow: "0 0 20px rgba(0,255,136,0.35)", lineHeight: 1.1, transform: glitch ? "translateX(2px)" : "none", transition: "none" }}>
              {glitch ? "0R4CLE" : "ORACLE"}
            </div>
            <div style={{ fontFamily: RAJ, fontSize: 13, fontWeight: 700, color: "#5a8068", letterSpacing: 4, textTransform: "uppercase", marginTop: 2 }}>
              INVESTIGATION ENGINE
            </div>
          </div>

          {/* Log lines */}
          <div style={{ background: "rgba(5,12,7,0.7)", border: "1px solid #1a3320", borderRadius: 4, padding: "14px 16px", minHeight: 280, display: "flex", flexDirection: "column", gap: 2 }}>
            <div style={{ fontSize: 9, color: "#1a4a2a", letterSpacing: 3, marginBottom: 10, textTransform: "uppercase" }}>
              SYSTEM LOG — {new Date().toISOString().split("T")[0]}
            </div>
            {LOG_LINES.map((line, i) => (
              visibleLogs.includes(i) ? (
                <div key={i} className="oracle-log-line" style={{ fontSize: 11, color: line.color, lineHeight: 1.8, letterSpacing: 0.5 }}>
                  {line.text}
                </div>
              ) : null
            ))}
            {visibleLogs.length < LOG_LINES.length && (
              <span style={{ fontSize: 11, color: "#7aaa8a" }}>
                <span className="oracle-blink" style={{ color: "#00ff88" }}>▌</span>
              </span>
            )}
          </div>

          {/* Data stream */}
          <div style={{ marginTop: 12, background: "rgba(5,12,7,0.6)", border: "1px solid #0d1f12", borderRadius: 3, padding: "8px 12px", overflow: "hidden", height: 100 }}>
            <div style={{ fontSize: 9, color: "#0d2818", letterSpacing: 2, marginBottom: 6 }}>RAW DATA STREAM</div>
            {dataStream.slice(0, 7).map((line, i) => (
              <div key={i} style={{ fontSize: 9, color: `rgba(0,187,102,${0.15 - i * 0.018})`, letterSpacing: 1, lineHeight: 1.5, whiteSpace: "nowrap", overflow: "hidden" }}>{line}</div>
            ))}
          </div>

          {/* Timer */}
          <div style={{ marginTop: 14, display: "flex", justifyContent: "space-between", fontSize: 10, color: "#2a4a30", letterSpacing: 1 }}>
            <span>ELAPSED: {elapsed}s</span>
            <span>ORACLE ETA: 15–45s</span>
            <span className="oracle-blink" style={{ color: "#00bb66" }}>● LIVE</span>
          </div>
        </div>

        {/* CENTER / RIGHT: Investigation graph visualization */}
        <div style={{ flex: 1, display: "flex", justifyContent: "center", alignItems: "center" }}>
          <div style={{ position: "relative", width: 460, height: 460 }}>

            {/* Outer glow ring */}
            <div style={{ position: "absolute", inset: -20, borderRadius: "50%", background: "radial-gradient(circle, rgba(0,255,136,0.04) 0%, transparent 70%)", pointerEvents: "none" }} />

            <svg width="460" height="460" viewBox="0 0 400 400" style={{ position: "absolute", inset: 0 }}>
              <defs>
                <radialGradient id="radarGrad" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#00ff88" stopOpacity="0.12" />
                  <stop offset="100%" stopColor="#00ff88" stopOpacity="0" />
                </radialGradient>
                <filter id="glow">
                  <feGaussianBlur stdDeviation="3" result="blur" />
                  <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
                </filter>
              </defs>

              {/* Concentric rings */}
              {[40, 80, 130, 170].map((r, i) => (
                <circle key={r} cx="200" cy="200" r={r}
                  fill="none" stroke="#0d2818" strokeWidth={i === 3 ? 1.5 : 0.8}
                  strokeDasharray={i % 2 === 0 ? "4 8" : "none"}
                  style={i === 3 ? { animation: `oracle-ring ${20 + i * 5}s linear infinite`, transformOrigin: "200px 200px" } : {}}
                />
              ))}

              {/* Rotating rings */}
              <g style={{ animation: "oracle-ring 12s linear infinite", transformOrigin: "200px 200px" }}>
                <circle cx="200" cy="200" r="155" fill="none" stroke="#1a3320" strokeWidth="1" strokeDasharray="3 12" />
              </g>
              <g style={{ animation: "oracle-ring-rev 18s linear infinite", transformOrigin: "200px 200px" }}>
                <circle cx="200" cy="200" r="185" fill="none" stroke="#0d1f12" strokeWidth="1" strokeDasharray="6 20" />
              </g>

              {/* Radar sweep */}
              <g style={{ transformOrigin: "200px 200px", transform: `rotate(${scanAngle}deg)` }}>
                <path d={`M200,200 L200,30`} stroke="#00ff88" strokeWidth="1.5" strokeOpacity="0.6" />
                {[0, 10, 20, 30, 40].map(offset => (
                  <path key={offset}
                    d={`M200,200 L${200 + 170 * Math.sin(rad(-offset))},${200 - 170 * Math.cos(rad(-offset))}`}
                    stroke="#00ff88" strokeWidth="1"
                    strokeOpacity={0.15 - offset * 0.003}
                  />
                ))}
                <path d={`M200,200 L200,30`} stroke="url(#radarGrad)" strokeWidth="40" strokeOpacity="0.08" />
              </g>

              {/* Crosshair */}
              <line x1="200" y1="0" x2="200" y2="400" stroke="#0d2818" strokeWidth="0.5" />
              <line x1="0" y1="200" x2="400" y2="200" stroke="#0d2818" strokeWidth="0.5" />

              {/* Edges */}
              {EDGES.map((e, i) => {
                if (!visibleEdges.includes(i)) return null;
                const from = NODES[e.from];
                const to   = NODES[e.to];
                const col  = NODE_COLORS[NODES[e.from].type] ?? "#00bb66";
                return (
                  <line key={i}
                    x1={from.x} y1={from.y} x2={to.x} y2={to.y}
                    stroke={col} strokeWidth="1.5" strokeOpacity="0.5"
                    strokeDasharray="6 10"
                    style={{ animation: `oracle-dash ${1.8 + i * 0.2}s linear infinite` }}
                  />
                );
              })}

              {/* Nodes */}
              {NODES.map((n, i) => {
                if (!visibleNodes.includes(i)) return null;
                const col = NODE_COLORS[n.type] ?? "#00bb66";
                return (
                  <g key={n.id} style={{ animation: "oracle-fade-in 0.4s ease forwards" }}>
                    {/* Glow circle */}
                    <circle cx={n.x} cy={n.y} r={n.r + 8} fill={col} opacity="0.06"
                      style={{ animation: `oracle-pulse ${1.8 + i * 0.3}s ease-in-out infinite` }}
                    />
                    {/* Node border */}
                    <circle cx={n.x} cy={n.y} r={n.r} fill="#030806" stroke={col} strokeWidth={n.type === "center" ? 2 : 1.5}
                      style={{ animation: `oracle-glow ${2 + i * 0.25}s ease-in-out infinite`, color: col }}
                      filter="url(#glow)"
                    />
                    {/* Inner dot */}
                    <circle cx={n.x} cy={n.y} r={n.type === "center" ? 5 : 3} fill={col} opacity="0.8" />
                    {/* Label */}
                    <text x={n.x} y={n.y + n.r + 14} textAnchor="middle" fill={col} opacity="0.7"
                      style={{ fontFamily: FONT, fontSize: n.type === "center" ? 9 : 8, letterSpacing: 1 }}>
                      {n.label}
                    </text>
                  </g>
                );
              })}

              {/* Center cross */}
              <line x1="188" y1="200" x2="212" y2="200" stroke="#00ff88" strokeWidth="1" strokeOpacity="0.4" />
              <line x1="200" y1="188" x2="200" y2="212" stroke="#00ff88" strokeWidth="1" strokeOpacity="0.4" />
            </svg>

            {/* HUD overlays */}
            <div style={{ position: "absolute", top: 8, left: 8, fontSize: 9, color: "#1a4a2a", letterSpacing: 2, fontFamily: FONT }}>
              TGT: ARTICLE/{visibleNodes.length - 1 > 0 ? visibleNodes.length - 1 : 0} NODES
            </div>
            <div style={{ position: "absolute", top: 8, right: 8, fontSize: 9, color: "#1a4a2a", letterSpacing: 2, fontFamily: FONT, textAlign: "right" }}>
              {visibleEdges.length} LINKS
            </div>
            <div style={{ position: "absolute", bottom: 8, left: 8, fontSize: 9, color: "#1a4a2a", letterSpacing: 2, fontFamily: FONT }}>
              SCAN: {Math.round(scanAngle)}°
            </div>
            <div style={{ position: "absolute", bottom: 8, right: 8, fontSize: 9, color: "#00bb66", letterSpacing: 2, fontFamily: FONT }}>
              <span className="oracle-blink">◉</span> LIVE
            </div>

            {/* Corner brackets */}
            {[
              { top: 0, left: 0, borderTop: "1px solid #1a4a2a", borderLeft: "1px solid #1a4a2a" },
              { top: 0, right: 0, borderTop: "1px solid #1a4a2a", borderRight: "1px solid #1a4a2a" },
              { bottom: 0, left: 0, borderBottom: "1px solid #1a4a2a", borderLeft: "1px solid #1a4a2a" },
              { bottom: 0, right: 0, borderBottom: "1px solid #1a4a2a", borderRight: "1px solid #1a4a2a" },
            ].map((style, i) => (
              <div key={i} style={{ position: "absolute", width: 20, height: 20, ...style }} />
            ))}
          </div>
        </div>

        {/* RIGHT: Stats panel */}
        <div style={{ flex: "0 0 160px", display: "flex", flexDirection: "column", gap: 10 }}>
          {[
            { label: "NODES", value: visibleNodes.length, max: NODES.length, color: "#00ff88" },
            { label: "EDGES", value: visibleEdges.length, max: EDGES.length, color: "#00bb66" },
            { label: "SOURCES", value: Math.min(Math.floor(elapsed * 0.8), 12), max: 12, color: "#ffaa00" },
            { label: "THEORIES", value: Math.min(Math.floor(elapsed * 0.15), 3), max: 3, color: "#c94dff" },
          ].map(({ label, value, max, color }) => (
            <div key={label} style={{ border: "1px solid #1a3320", borderRadius: 3, padding: "10px 12px", background: "rgba(5,12,7,0.7)" }}>
              <div style={{ fontSize: 9, color: "#3a5040", letterSpacing: 2, marginBottom: 5 }}>{label}</div>
              <div style={{ fontFamily: RAJ, fontSize: 28, fontWeight: 700, color, lineHeight: 1, marginBottom: 6 }}>{value}</div>
              <div style={{ height: 2, background: "#0d1f12", borderRadius: 1, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${(value / max) * 100}%`, background: color, borderRadius: 1, transition: "width 0.5s ease" }} />
              </div>
            </div>
          ))}

          {/* Threat indicator */}
          <div style={{ border: "1px solid rgba(255,51,51,0.2)", borderRadius: 3, padding: "10px 12px", background: "rgba(255,51,51,0.04)", marginTop: 4 }}>
            <div style={{ fontSize: 9, color: "#3a2020", letterSpacing: 2, marginBottom: 5 }}>THREAT LEVEL</div>
            <div style={{ fontFamily: RAJ, fontSize: 28, fontWeight: 700, color: "#ff3333", lineHeight: 1, marginBottom: 2 }}>
              <span className="oracle-blink">?</span>
            </div>
            <div style={{ fontSize: 9, color: "#5a2020", letterSpacing: 1 }}>COMPUTING...</div>
          </div>
        </div>
      </div>
    </div>
  );
}
