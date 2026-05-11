"use client";
import { useEffect, useRef, useState } from "react";
import { pageContentShellStyle } from "@/lib/pageShell";

const FONT = "var(--font-share-tech-mono), monospace";
const RAJ = "var(--font-raj), sans-serif";

const LOG_LINES = [
  { text: "INITIALIZING ORACLE INTELLIGENCE ENGINE...", color: "#00ff88", delay: 0 },
  { text: "> CIA FOIA database — cross-reference active", color: "#7aaa8a", delay: 700 },
  { text: "> USPTO patent corpus — 14.2M records indexed", color: "#7aaa8a", delay: 1500 },
  { text: "> Guardian API — article content parsed", color: "#7aaa8a", delay: 2300 },
  { text: "> Bayesian inference network — compiling...", color: "#7aaa8a", delay: 3200 },
  { text: "> Source-tier confidence weighting applied", color: "#7aaa8a", delay: 4100 },
  { text: "> Node graph topology — resolving edges...", color: "#7aaa8a", delay: 5000 },
  { text: "> [CLASSIFIED SIGNAL DETECTED] ████████████", color: "#ff3333", delay: 5900 },
  { text: "> Conspiracy pattern matching — 3 theories found", color: "#ffaa00", delay: 6800 },
  { text: "> Streaming structured intelligence...", color: "#00ff88", delay: 7600 },
];

const GRAPH_NODES = [
  { x: 200, y: 200, r: 22, color: "#00ff88", label: "ARTICLE", delay: 0 },
  { x: 200, y: 68, r: 14, color: "#ff3333", label: "CIA FOIA", delay: 900 },
  { x: 316, y: 134, r: 14, color: "#ff5555", label: "USPTO", delay: 1600 },
  { x: 316, y: 266, r: 14, color: "#ffaa00", label: "CORP", delay: 2400 },
  { x: 200, y: 332, r: 14, color: "#ffcc44", label: "EVENT", delay: 3100 },
  { x: 84, y: 266, r: 14, color: "#00bb66", label: "AGENT", delay: 3900 },
  { x: 84, y: 134, r: 14, color: "#c94dff", label: "THEORY", delay: 4700 },
];

export default function OracleLoadingScreen() {
  const [elapsed, setElapsed] = useState(0);
  const [visibleLogs, setVisibleLogs] = useState<number[]>([]);
  const [visibleNodes, setVisibleNodes] = useState<number[]>([]);
  const [scanAngle, setScanAngle] = useState(0);
  const [glitch, setGlitch] = useState(false);
  const [dataStream, setDataStream] = useState<string[]>([]);
  const startRef = useRef(0);

  useEffect(() => {
    startRef.current = Date.now();
  }, []);

  useEffect(() => {
    const iv = setInterval(() => setElapsed(Math.floor((Date.now() - startRef.current) / 1000)), 500);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    LOG_LINES.forEach((l, i) => setTimeout(() => setVisibleLogs((p) => [...p, i]), l.delay));
  }, []);

  useEffect(() => {
    GRAPH_NODES.forEach((n, i) => setTimeout(() => setVisibleNodes((p) => [...p, i]), n.delay));
  }, []);

  useEffect(() => {
    const iv = setInterval(() => setScanAngle((a) => (a + 2) % 360), 16);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    const chars = "01ABCDEF0123456789█▓▒░";
    const iv = setInterval(() => {
      const line = Array.from({ length: 24 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
      setDataStream((p) => [line, ...p.slice(0, 10)]);
    }, 100);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    const iv = setInterval(() => {
      setGlitch(true);
      setTimeout(() => setGlitch(false), 80);
    }, 5000 + Math.random() * 3000);
    return () => clearInterval(iv);
  }, []);

  const rad = (d: number) => (d * Math.PI) / 180;

  return (
    <div style={{ minHeight: "100vh", background: "#030806", fontFamily: FONT, position: "relative", overflow: "hidden" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Share+Tech+Mono&family=Rajdhani:wght@700&display=swap');
        @keyframes ol-dash{to{stroke-dashoffset:-20}}
        @keyframes ol-fadein{from{opacity:0;transform:translateY(5px)}to{opacity:1;transform:translateY(0)}}
        @keyframes ol-blink{0%,100%{opacity:1}50%{opacity:0}}
        .ol-log{animation:ol-fadein 0.3s ease forwards}
        .ol-blink{animation:ol-blink 0.9s step-end infinite}
      `}</style>

      <div
        style={{
          position: "absolute",
          inset: 0,
          opacity: 0.06,
          backgroundImage: "linear-gradient(#0d2818 1px,transparent 1px),linear-gradient(90deg,#0d2818 1px,transparent 1px)",
          backgroundSize: "32px 32px",
          pointerEvents: "none",
        }}
      />

      <div
        style={{
          position: "relative",
          zIndex: 1,
          ...pageContentShellStyle(),
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          gap: "3rem",
        }}
      >
        <div style={{ flex: "0 0 400px", display: "flex", flexDirection: "column", gap: 0 }}>
          <div style={{ marginBottom: "2rem" }}>
            <div style={{ fontFamily: RAJ, fontSize: 10, fontWeight: 700, color: "#1a4a2a", letterSpacing: 5, marginBottom: 6, textTransform: "uppercase" }}>
              ■ CLASSIFIED INTELLIGENCE SYSTEM ■
            </div>
            <div
              style={{
                fontFamily: RAJ,
                fontSize: 26,
                fontWeight: 700,
                color: glitch ? "#ff3333" : "#00ff88",
                letterSpacing: 2,
                textTransform: "uppercase",
                textShadow: "0 0 18px rgba(0,255,136,0.25)",
                lineHeight: 1.1,
                transform: glitch ? "translateX(2px)" : "none",
              }}
            >
              {glitch ? "0R4CLE" : "ORACLE"}
            </div>
            <div style={{ fontFamily: RAJ, fontSize: 12, fontWeight: 700, color: "#5a8068", letterSpacing: 3, textTransform: "uppercase", marginTop: 2 }}>INVESTIGATION ENGINE</div>
          </div>

          <div
            style={{
              background: "rgba(5,12,7,0.8)",
              border: "1px solid #1a3320",
              borderRadius: 4,
              padding: "14px 16px",
              minHeight: 260,
              display: "flex",
              flexDirection: "column",
              gap: 2,
            }}
          >
            <div style={{ fontSize: 9, color: "#1a4a2a", letterSpacing: 3, marginBottom: 10, textTransform: "uppercase" }}>
              SYSTEM LOG — {new Date().toISOString().split("T")[0]}
            </div>
            {LOG_LINES.map((line, i) =>
              visibleLogs.includes(i) ? (
                <div key={i} className="ol-log" style={{ fontSize: 11, color: line.color, lineHeight: 1.8, letterSpacing: 0.5 }}>
                  {line.text}
                </div>
              ) : null,
            )}
            {visibleLogs.length < LOG_LINES.length && (
              <span style={{ fontSize: 11, color: "#7aaa8a" }}>
                <span className="ol-blink" style={{ color: "#00ff88" }}>
                  ▌
                </span>
              </span>
            )}
          </div>

          <div
            style={{
              marginTop: 10,
              background: "rgba(5,12,7,0.5)",
              border: "1px solid #0d1f12",
              borderRadius: 3,
              padding: "8px 12px",
              overflow: "hidden",
              height: 80,
            }}
          >
            <div style={{ fontSize: 9, color: "#0d2818", letterSpacing: 2, marginBottom: 5 }}>RAW DATA STREAM</div>
            {dataStream.slice(0, 5).map((l, i) => (
              <div key={i} style={{ fontSize: 9, color: `rgba(0,187,102,${0.12 - i * 0.02})`, letterSpacing: 1, lineHeight: 1.5, whiteSpace: "nowrap" }}>
                {l}
              </div>
            ))}
          </div>

          <div style={{ marginTop: 10, display: "flex", justifyContent: "space-between", fontSize: 10, color: "#2a4a30", letterSpacing: 1 }}>
            <span>ELAPSED: {elapsed}s</span>
            <span>ETA: 15–45s</span>
            <span className="ol-blink" style={{ color: "#00bb66" }}>
              ● LIVE
            </span>
          </div>
        </div>

        <div style={{ flex: 1, display: "flex", justifyContent: "center", alignItems: "center" }}>
          <div style={{ position: "relative", width: 440, height: 440 }}>
            <svg width="440" height="440" viewBox="0 0 400 400" style={{ position: "absolute", inset: 0 }}>
              <defs>
                <radialGradient id="olRadar" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#00ff88" stopOpacity="0.15" />
                  <stop offset="100%" stopColor="#00ff88" stopOpacity="0" />
                </radialGradient>
              </defs>

              {[40, 80, 130, 170].map((r) => (
                <circle key={r} cx="200" cy="200" r={r} fill="none" stroke="#0d2818" strokeWidth="0.8" strokeDasharray={r % 80 === 0 ? "none" : "4 8"} />
              ))}

              <g style={{ transformOrigin: "200px 200px", transform: `rotate(${scanAngle}deg)` }}>
                <line x1="200" y1="200" x2="200" y2="30" stroke="#00ff88" strokeWidth="1.5" strokeOpacity="0.7" />
                <line x1="200" y1="200" x2="200" y2="30" stroke="url(#olRadar)" strokeWidth="50" strokeOpacity="0.15" />
                {[0, 12, 28].map((o) => (
                  <line
                    key={o}
                    x1="200"
                    y1="200"
                    x2={200 + 170 * Math.sin(rad(-o))}
                    y2={200 - 170 * Math.cos(rad(-o))}
                    stroke="#00ff88"
                    strokeWidth="1"
                    strokeOpacity={0.12 - o * 0.004}
                  />
                ))}
              </g>

              <line x1="200" y1="0" x2="200" y2="400" stroke="#0d2818" strokeWidth="0.5" />
              <line x1="0" y1="200" x2="400" y2="200" stroke="#0d2818" strokeWidth="0.5" />

              {GRAPH_NODES.slice(1).map((n, i) => {
                if (!visibleNodes.includes(i + 1)) return null;
                return (
                  <line
                    key={i}
                    x1="200"
                    y1="200"
                    x2={n.x}
                    y2={n.y}
                    stroke={n.color}
                    strokeWidth="1.5"
                    strokeOpacity="0.45"
                    strokeDasharray="5 8"
                    style={{ animation: "ol-dash 2s linear infinite" }}
                  />
                );
              })}

              {GRAPH_NODES.map((n, i) => {
                if (!visibleNodes.includes(i)) return null;
                return (
                  <g key={i} style={{ animation: "ol-fadein 0.4s ease forwards" }}>
                    <circle cx={n.x} cy={n.y} r={n.r + 7} fill={n.color} opacity="0.05" />
                    <circle
                      cx={n.x}
                      cy={n.y}
                      r={n.r}
                      fill="#030806"
                      stroke={n.color}
                      strokeWidth={i === 0 ? 2 : 1.5}
                      style={{ filter: `drop-shadow(0 0 ${i === 0 ? 6 : 3}px ${n.color})` }}
                    />
                    <circle cx={n.x} cy={n.y} r={i === 0 ? 5 : 3} fill={n.color} opacity="0.8" />
                    <text x={n.x} y={n.y + n.r + 12} textAnchor="middle" fill={n.color} opacity="0.6" style={{ fontFamily: FONT, fontSize: 8, letterSpacing: 1 }}>
                      {n.label}
                    </text>
                  </g>
                );
              })}
            </svg>

            {[{ top: 0, left: 0 }, { top: 0, right: 0 }, { bottom: 0, left: 0 }, { bottom: 0, right: 0 }].map((s, i) => (
              <div
                key={i}
                style={{
                  position: "absolute",
                  width: 20,
                  height: 20,
                  ...s,
                  borderTop: i < 2 ? "1px solid #1a4a2a" : undefined,
                  borderBottom: i >= 2 ? "1px solid #1a4a2a" : undefined,
                  borderLeft: i % 2 === 0 ? "1px solid #1a4a2a" : undefined,
                  borderRight: i % 2 === 1 ? "1px solid #1a4a2a" : undefined,
                }}
              />
            ))}

            <div style={{ position: "absolute", bottom: 8, left: 8, fontSize: 9, color: "#1a4a2a", letterSpacing: 2, fontFamily: FONT }}>{visibleNodes.length} NODES MAPPED</div>
          </div>
        </div>

        <div style={{ flex: "0 0 150px", display: "flex", flexDirection: "column", gap: 10 }}>
          {[
            { label: "NODES", value: visibleNodes.length, max: GRAPH_NODES.length, color: "#00ff88" },
            { label: "SOURCES", value: Math.min(Math.floor(elapsed * 0.8), 12), max: 12, color: "#ffaa00" },
            { label: "THEORIES", value: Math.min(Math.floor(elapsed * 0.15), 3), max: 3, color: "#c94dff" },
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
            <div style={{ fontSize: 9, color: "#3a2020", letterSpacing: 2, marginBottom: 5 }}>THREAT</div>
            <div style={{ fontFamily: RAJ, fontSize: 26, fontWeight: 700, color: "#ff3333", lineHeight: 1, marginBottom: 2 }}>
              <span className="ol-blink">?</span>
            </div>
            <div style={{ fontSize: 9, color: "#5a2020", letterSpacing: 1 }}>COMPUTING</div>
          </div>
        </div>
      </div>
    </div>
  );
}
