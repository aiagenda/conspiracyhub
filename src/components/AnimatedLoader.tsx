"use client";

import { useEffect, useState } from "react";

const FONT = "var(--font-share-tech-mono), monospace";
const RAJ = "var(--font-raj), sans-serif";

const DEFAULT_LOADER_LOGS: string[] = [];

interface AnimatedLoaderProps {
  title?: string;
  subtitle?: string;
  logs?: string[];
  color?: string;
}

export default function AnimatedLoader({
  title = "PROCESSING",
  subtitle = "Please wait...",
  logs = DEFAULT_LOADER_LOGS,
  color = "#00ff88",
}: AnimatedLoaderProps) {
  const [logIdx, setLogIdx] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [scanAngle, setScanAngle] = useState(0);
  const [dots, setDots] = useState("");

  useEffect(() => {
    const start = Date.now();
    const iv = setInterval(() => setElapsed(Math.floor((Date.now() - start) / 1000)), 500);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    if (!logs.length) return;
    logs.forEach((_, i) => setTimeout(() => setLogIdx((p) => Math.max(p, i)), i * 650));
  }, [logs]);

  useEffect(() => {
    const iv = setInterval(() => setScanAngle((a) => (a + 2) % 360), 16);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    const iv = setInterval(() => setDots((d) => (d.length >= 3 ? "" : `${d}.`)), 400);
    return () => clearInterval(iv);
  }, []);

  const rad = (d: number) => (d * Math.PI) / 180;
  const dim = color === "#ffaa00" ? "#aa7700" : color === "#ff3333" ? "#aa2222" : "#00bb66";

  return (
    <div style={{ minHeight: "100vh", background: "#030806", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FONT }}>
      <style>{`
        @keyframes al-blink { 0%,100%{opacity:1} 50%{opacity:0} }
        @keyframes al-fadein { from{opacity:0;transform:translateY(5px)} to{opacity:1;transform:translateY(0)} }
        .al-blink { animation: al-blink 0.9s step-end infinite; }
        .al-log   { animation: al-fadein 0.3s ease forwards; }
      `}</style>

      <div style={{ maxWidth: 820, width: "100%", padding: "0 2rem", display: "grid", gridTemplateColumns: "1fr 300px", gap: "3rem", alignItems: "center" }}>
        <div>
          <div style={{ fontFamily: RAJ, fontSize: 10, fontWeight: 700, color: dim, letterSpacing: 5, marginBottom: 6, textTransform: "uppercase" }}>
            ■ CLASSIFIED INTELLIGENCE SYSTEM ■
          </div>
          <div style={{ fontFamily: RAJ, fontSize: 26, fontWeight: 700, color, letterSpacing: 2, textShadow: `0 0 18px ${color}44`, marginBottom: 2 }}>{title}</div>
          <div style={{ fontFamily: RAJ, fontSize: 11, color: "#5a8068", letterSpacing: 3, marginBottom: "1.5rem" }}>{subtitle}</div>

          <div style={{ background: "rgba(5,12,7,0.8)", border: "1px solid #1a3320", borderRadius: 4, padding: "14px 16px", minHeight: 200 }}>
            <div style={{ fontSize: 9, color: "#1a4a2a", letterSpacing: 3, marginBottom: 10 }}>
              SYSTEM LOG — {new Date().toISOString().split("T")[0]}
            </div>
            {logs.slice(0, logIdx + 1).map((l, i) => (
              <div key={i} className="al-log" style={{ fontSize: 11, color: i === logIdx ? color : "#5a8068", lineHeight: 1.8, letterSpacing: 0.5 }}>
                {l}
              </div>
            ))}
            {(logs.length === 0 || logIdx < logs.length - 1) && (
              <span style={{ fontSize: 11, color: "#5a8068" }}>
                <span className="al-blink" style={{ color }}>
                  ▌
                </span>
              </span>
            )}
          </div>

          <div style={{ marginTop: 10, display: "flex", justifyContent: "space-between", fontSize: 10, color: "#2a4a30", letterSpacing: 1 }}>
            <span>ELAPSED: {elapsed}s</span>
            <span className="al-blink" style={{ color }}>
              ● LIVE
            </span>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
          <svg width="260" height="260" viewBox="0 0 260 260">
            <defs>
              <radialGradient id="alGrad" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor={color} stopOpacity="0.15" />
                <stop offset="100%" stopColor={color} stopOpacity="0" />
              </radialGradient>
            </defs>
            {[30, 60, 95, 120].map((r) => (
              <circle key={r} cx="130" cy="130" r={r} fill="none" stroke="#0d2818" strokeWidth="0.8" strokeDasharray={r % 60 === 0 ? "none" : "4 8"} />
            ))}
            <g style={{ transformOrigin: "130px 130px", transform: `rotate(${scanAngle}deg)` }}>
              <line x1="130" y1="130" x2="130" y2="10" stroke={color} strokeWidth="1.5" strokeOpacity="0.7" />
              {[0, 12, 28, 48].map((o) => (
                <line
                  key={o}
                  x1="130"
                  y1="130"
                  x2={130 + 120 * Math.sin(rad(-o))}
                  y2={130 - 120 * Math.cos(rad(-o))}
                  stroke={color}
                  strokeWidth="1"
                  strokeOpacity={0.14 - o * 0.003}
                />
              ))}
              <path d="M130,130 L130,10" stroke="url(#alGrad)" strokeWidth="50" strokeOpacity="0.12" />
            </g>
            <line x1="130" y1="0" x2="130" y2="260" stroke="#0d2818" strokeWidth="0.5" />
            <line x1="0" y1="130" x2="260" y2="130" stroke="#0d2818" strokeWidth="0.5" />
            <line x1="122" y1="130" x2="138" y2="130" stroke={color} strokeWidth="1" strokeOpacity="0.4" />
            <line x1="130" y1="122" x2="130" y2="138" stroke={color} strokeWidth="1" strokeOpacity="0.4" />
            <text x="130" y="138" textAnchor="middle" fill={color} opacity="0.35" style={{ fontFamily: FONT, fontSize: 8, letterSpacing: 2 }}>
              SCANNING{dots}
            </text>
          </svg>

          <div style={{ display: "flex", gap: 6, flexDirection: "column", alignItems: "center" }}>
            {[
              { label: "DATA STREAM", pct: Math.min(100, elapsed * 8) },
              { label: "AI ANALYSIS", pct: Math.min(100, Math.max(0, elapsed * 8 - 25)) },
              { label: "PATTERN MATCH", pct: Math.min(100, Math.max(0, elapsed * 8 - 55)) },
            ].map(({ label, pct }) => (
              <div key={label} style={{ width: 220 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                  <span style={{ fontSize: 8, color: "#3a5040", letterSpacing: 1 }}>{label}</span>
                  <span style={{ fontSize: 8, color, letterSpacing: 1 }}>{pct}%</span>
                </div>
                <div style={{ height: 2, background: "#1a3320", borderRadius: 1, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: 1, transition: "width 0.5s ease" }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
