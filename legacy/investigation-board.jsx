import { useState, useEffect, useRef } from "react";

const FONT = "'Share Tech Mono', monospace";
const RAJ = "'Rajdhani', sans-serif";

// ── NODE DATA ──────────────────────────────────────────────────────
const CENTER = { x: 500, y: 320 };

const NODES = [
  {
    id: "center",
    type: "article",
    x: CENTER.x, y: CENTER.y,
    label: "NEURALINK ENGEDÉLY",
    sub: "FDA jóváhagyta az emberi\nkísérleteket — 2024 Q1",
    detail: {
      title: "FDA engedélyezi a Neuralink emberi implantátum kísérleteit",
      body: "Az Elon Musk-féle Neuralink Corp. 2024 januárjában megkapta az FDA jóváhagyását az első emberi klinikai vizsgálatokra. A PRIME Study keretében agyi implantátumot helyeznek el ALS-ben szenvedő betegek koponyájában.",
      source: "Reuters, 2024.01.29",
      threat: 78,
    }
  },
  {
    id: "patent1",
    type: "patent",
    x: 160, y: 130,
    label: "USPTO #10,966,620",
    sub: "Neurális interfész\nadatátviteli protokoll",
    detail: {
      title: "Neurális jel titkosítási és adatátviteli szabadalom",
      body: "A 2021-ben benyújtott szabadalom részletezi, hogyan lehet a neurális jeleket valós időben streamelni külső szerverre. A dokumentum nem tartalmaz adatvédelmi korlátozást.",
      source: "USPTO, benyújtva: 2021.03.15",
      threat: 71,
    }
  },
  {
    id: "foia1",
    type: "foia",
    x: 840, y: 110,
    label: "CIA FOIA #C06541956",
    sub: "MKUltra utódprogramok\n[RÉSZBEN TITKOSÍTVA]",
    detail: {
      title: "CIA belső feljegyzés — Neurális kontroll kutatás",
      body: "1977-es szenátusi meghallgatások során feltárt dokumentumok bizonyítják, hogy a CIA aktívan kutatott agyi implantátumokon alapuló befolyásolási technikákat. A program lezárása soha nem lett megerősítve.",
      source: "CIA FOIA Reading Room, 1977",
      threat: 65,
    }
  },
  {
    id: "company1",
    type: "company",
    x: 190, y: 490,
    label: "SYNCHRON INC.",
    sub: "Versenytárs — Pentagon\nszerződés $18.4M",
    detail: {
      title: "Synchron Inc. — DARPA finanszírozás",
      body: "A Neuralink versenytársa, a Synchron 2022-ben 18.4 millió dolláros szerződést kötött a DARPA-val neurális interfész fejlesztésre. A cég befektetői között szerepel Jeff Bezos és Bill Gates is.",
      source: "USASpending.gov, DARPA-HR001120S0089",
      threat: 60,
    }
  },
  {
    id: "event1",
    type: "event",
    x: 820, y: 510,
    label: "WEF 2023",
    sub: "Yuval Harari: 'az emberek\nhackelhető állatok'",
    detail: {
      title: "World Economic Forum — Davos 2023",
      body: "Yuval Noah Harari nyilvánosan kijelentette Davosban, hogy az emberi agy hackelhető és manipulálható neurális interfészeken keresztül. A kijelentést a WEF saját YouTube csatornáján közvetítette.",
      source: "WEF YouTube, 2023.01.18",
      threat: 55,
    }
  },
  {
    id: "patent2",
    type: "patent",
    x: 115, y: 330,
    label: "USPTO #11,294,457",
    sub: "Bluetooth neurális\nstimulációs eszköz",
    detail: {
      title: "Vezeték nélküli neurális stimulátor szabadalom",
      body: "A szabadalom leírja egy olyan eszköz konstrukcióját, amely képes Bluetooth protokollon keresztül externálisan módosítani a neurális tüzelési mintázatokat. A feltaláló korábban DARPA-nál dolgozott.",
      source: "USPTO, benyújtva: 2020.11.03",
      threat: 68,
    }
  },
  {
    id: "person1",
    type: "person",
    x: 720, y: 180,
    label: "DR. RAFAEL YUSTE",
    sub: "Columbia — Neurorights\nFoundation alapítója",
    detail: {
      title: "Dr. Rafael Yuste — NeuroRights Foundation",
      body: "A Columbia Egyetem neurobiológus professzora 2021-ben létrehozta a NeuroRights Foundationt, amely az agyi adatok védelmére lobbizik. Nyíltan figyelmezteti, hogy az implantátumok adatai nem védettek az NSA megfigyeléstől.",
      source: "Nature, 2021.09.12",
      threat: 42,
    }
  },
  {
    id: "event2",
    type: "event",
    x: 640, y: 490,
    label: "NSA PRISM 2.0",
    sub: "Snowden: neurális adat\na következő határ",
    detail: {
      title: "Edward Snowden figyelmeztetése — 2023",
      body: "Snowden egy 2023-as interjúban kijelentette, hogy az NSA jelenlegi infrastruktúrája képes lenne neurális streaming adatok feldolgozására, ha azok elérhető hálózaton keresztül áramolnának.",
      source: "The Intercept, 2023.11.05",
      threat: 59,
    }
  },
];

const EDGES = [
  { from: "center", to: "patent1", color: "#ff3333", label: "KAPCSOLÓDÓ SZABADALOM", strength: 0.9 },
  { from: "center", to: "foia1",   color: "#ff3333", label: "CIA ELŐZMÉNY",          strength: 0.75 },
  { from: "center", to: "company1",color: "#ffaa00", label: "IPARÁGI SZEREPLŐ",      strength: 0.7 },
  { from: "center", to: "event1",  color: "#ffaa00", label: "NYILVÁNOS NYILATKOZAT", strength: 0.65 },
  { from: "center", to: "patent2", color: "#ff3333", label: "KAPCSOLÓDÓ SZABADALOM", strength: 0.85 },
  { from: "center", to: "person1", color: "#00bb66", label: "KRITIKUS HANG",         strength: 0.5 },
  { from: "center", to: "event2",  color: "#ff3333", label: "HÍRSZERZÉSI KOCKÁZAT",  strength: 0.8 },
  { from: "patent1", to: "patent2",color: "#5a8068", label: "KERESZTREFERENCIA",     strength: 0.4 },
  { from: "foia1",  to: "event2",  color: "#ff3333", label: "TÖRTÉNELMI MINTA",      strength: 0.6 },
  { from: "company1", to: "event1",color: "#5a8068", label: "FINANSZÍROZÓ",          strength: 0.35 },
];

const NODE_ICONS = {
  article: "📰",
  patent:  "⚗️",
  foia:    "🔒",
  company: "🏢",
  event:   "⚠️",
  person:  "👤",
};

const NODE_COLORS = {
  article: { bg: "#0a1a10", border: "#00ff88", text: "#00ff88", glow: "rgba(0,255,136,0.3)" },
  patent:  { bg: "#1a0a0a", border: "#ff3333", text: "#ff5555", glow: "rgba(255,51,51,0.25)" },
  foia:    { bg: "#1a0a0a", border: "#ff3333", text: "#ff3333", glow: "rgba(255,51,51,0.35)" },
  company: { bg: "#1a1200", border: "#ffaa00", text: "#ffaa00", glow: "rgba(255,170,0,0.25)" },
  event:   { bg: "#1a1200", border: "#ffaa00", text: "#ffcc44", glow: "rgba(255,170,0,0.2)" },
  person:  { bg: "#071510", border: "#00bb66", text: "#00bb66", glow: "rgba(0,187,102,0.2)" },
};

const TYPE_LABELS = {
  article: "HÍRCIKK",
  patent:  "SZABADALOM",
  foia:    "CIA FOIA",
  company: "VÁLLALAT",
  event:   "ESEMÉNY",
  person:  "SZEMÉLY",
};

// ── ANIMATED EDGE ─────────────────────────────────────────────────
function Edge({ edge, nodes, active }) {
  const from = nodes.find(n => n.id === edge.from);
  const to   = nodes.find(n => n.id === edge.to);
  if (!from || !to) return null;

  const id = `grad-${edge.from}-${edge.to}`;
  const dashId = `dash-${edge.from}-${edge.to}`;
  const opacity = active ? 1 : 0.35;
  const strokeW = active ? 2 : 1;

  return (
    <g>
      <defs>
        <linearGradient id={id} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor={edge.color} stopOpacity="0.8" />
          <stop offset="100%" stopColor={edge.color} stopOpacity="0.3" />
        </linearGradient>
      </defs>
      {/* Base line */}
      <line
        x1={from.x} y1={from.y} x2={to.x} y2={to.y}
        stroke={edge.color} strokeWidth={strokeW} strokeOpacity={opacity * 0.4}
      />
      {/* Animated dash */}
      <line
        x1={from.x} y1={from.y} x2={to.x} y2={to.y}
        stroke={edge.color} strokeWidth={active ? 1.5 : 1}
        strokeOpacity={opacity}
        strokeDasharray="6 14"
        style={{ animation: `dashMove ${2 / edge.strength}s linear infinite` }}
      />
    </g>
  );
}

// ── NODE ──────────────────────────────────────────────────────────
function Node({ node, onClick, selected, pulse }) {
  const c = NODE_COLORS[node.type];
  const isCenter = node.id === "center";
  const w = isCenter ? 130 : 110;
  const h = isCenter ? 64 : 54;

  return (
    <g
      transform={`translate(${node.x}, ${node.y})`}
      onClick={() => onClick(node)}
      style={{ cursor: "pointer" }}
    >
      {/* Glow */}
      <ellipse cx={0} cy={0} rx={w * 0.65} ry={h * 0.75}
        fill={c.glow}
        style={{ animation: selected || (isCenter && pulse) ? `glowPulse 1.5s ease-in-out infinite` : "none" }}
        filter="blur(8px)"
      />
      {/* Box */}
      <rect
        x={-w/2} y={-h/2} width={w} height={h}
        rx={4} ry={4}
        fill={c.bg}
        stroke={c.border}
        strokeWidth={selected ? 2 : isCenter ? 1.5 : 1}
        strokeOpacity={selected ? 1 : 0.7}
      />
      {/* Corner accents */}
      {[[-w/2,-h/2,1,1],[-w/2+10,-h/2,1,1],[w/2,-h/2,-1,1],[w/2-10,-h/2,-1,1]].map(([x,y,dx,dy],i) => (
        <line key={i} x1={x} y1={y} x2={x+dx*8} y2={y+dy*0} stroke={c.border} strokeWidth={1.5} strokeOpacity={0.5} />
      ))}

      {/* Type label */}
      <text x={0} y={-h/2 + 10} textAnchor="middle"
        fill={c.text} opacity={0.6}
        style={{ fontFamily: FONT, fontSize: 8, letterSpacing: 2 }}>
        {TYPE_LABELS[node.type]}
      </text>

      {/* Main label */}
      <text x={0} y={isCenter ? 4 : 2} textAnchor="middle"
        fill={c.text}
        style={{ fontFamily: RAJ, fontSize: isCenter ? 13 : 11, fontWeight: 700, letterSpacing: 1 }}>
        {node.label}
      </text>

      {/* Sub label */}
      {node.sub.split("\n").map((line, i) => (
        <text key={i} x={0} y={(isCenter ? 16 : 14) + i * 11} textAnchor="middle"
          fill={c.text} opacity={0.55}
          style={{ fontFamily: FONT, fontSize: 8 }}>
          {line}
        </text>
      ))}

      {/* Selected indicator */}
      {selected && (
        <rect x={-w/2} y={-h/2} width={w} height={h} rx={4} ry={4}
          fill="none" stroke={c.border} strokeWidth={3} strokeOpacity={0.4}
          style={{ animation: "glowPulse 1s ease-in-out infinite" }}
        />
      )}
    </g>
  );
}

// ── DETAIL PANEL ──────────────────────────────────────────────────
function DetailPanel({ node, onClose }) {
  if (!node) return null;
  const c = NODE_COLORS[node.type];
  const d = node.detail;

  return (
    <div style={{
      position: "absolute", right: 0, top: 0, bottom: 0, width: 300,
      background: "#06110a",
      borderLeft: `1px solid ${c.border}`,
      display: "flex", flexDirection: "column",
      animation: "slideIn 0.25s ease",
      zIndex: 10,
    }}>
      {/* Panel header */}
      <div style={{ padding: "12px 14px", borderBottom: "1px solid #1a3320", background: "#050c07", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontFamily: FONT, fontSize: 9, color: c.text, letterSpacing: 3, opacity: 0.7 }}>{TYPE_LABELS[node.type]}</div>
          <div style={{ fontFamily: RAJ, fontSize: 13, fontWeight: 700, color: c.text, letterSpacing: 1, marginTop: 2 }}>{node.label}</div>
        </div>
        <button onClick={onClose} style={{ background: "transparent", border: "1px solid #1a3320", color: "#5a8068", fontFamily: FONT, fontSize: 10, padding: "4px 8px", borderRadius: 3, cursor: "pointer", letterSpacing: 1 }}>✕</button>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: 14 }}>
        {/* Threat score */}
        {d.threat && (
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontFamily: FONT, fontSize: 9, color: "#5a8068", letterSpacing: 2, marginBottom: 5, textTransform: "uppercase" }}>Fenyegetési szint</div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ fontFamily: RAJ, fontSize: 28, fontWeight: 700, color: d.threat >= 65 ? "#ff3333" : d.threat >= 45 ? "#ffaa00" : "#00bb66" }}>{d.threat}%</div>
              <div style={{ flex: 1, height: 3, background: "#1a3320", borderRadius: 2, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${d.threat}%`, background: d.threat >= 65 ? "#ff3333" : d.threat >= 45 ? "#ffaa00" : "#00bb66", borderRadius: 2 }} />
              </div>
            </div>
          </div>
        )}

        {/* Title */}
        <div style={{ fontFamily: RAJ, fontSize: 14, fontWeight: 700, color: "#e8ffe8", lineHeight: 1.4, marginBottom: 10 }}>{d.title}</div>

        {/* Body */}
        <div style={{ fontFamily: FONT, fontSize: 11, color: "#7aaa8a", lineHeight: 1.75, marginBottom: 12 }}>{d.body}</div>

        {/* Source */}
        <div style={{ padding: "8px 10px", background: "rgba(0,255,136,0.04)", border: "1px solid #1a3320", borderRadius: 3 }}>
          <div style={{ fontFamily: FONT, fontSize: 9, color: "#5a8068", letterSpacing: 2, marginBottom: 3 }}>FORRÁS</div>
          <div style={{ fontFamily: FONT, fontSize: 10, color: c.text }}>{d.source}</div>
        </div>

        {/* Connections */}
        <div style={{ marginTop: 14 }}>
          <div style={{ fontFamily: FONT, fontSize: 9, color: "#5a8068", letterSpacing: 2, marginBottom: 8, textTransform: "uppercase" }}>Kapcsolatok</div>
          {EDGES.filter(e => e.from === node.id || e.to === node.id).map((e, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 6 }}>
              <div style={{ width: 20, height: 1.5, background: e.color, flexShrink: 0 }} />
              <div style={{ fontFamily: FONT, fontSize: 9, color: "#5a8068", letterSpacing: 1 }}>{e.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Action */}
      <div style={{ padding: "12px 14px", borderTop: "1px solid #1a3320" }}>
        <button style={{ width: "100%", padding: "9px", background: "transparent", border: `1px solid ${c.border}`, color: c.text, fontFamily: RAJ, fontSize: 12, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", borderRadius: 3, cursor: "pointer" }}>
          ◈ TELJES ELEMZÉS ▶
        </button>
      </div>
    </div>
  );
}

// ── MAIN ──────────────────────────────────────────────────────────
export default function InvestigationBoard() {
  const [selected,  setSelected]  = useState(null);
  const [pulse,     setPulse]     = useState(false);
  const [scanLine,  setScanLine]  = useState(0);
  const [glitch,    setGlitch]    = useState(false);
  const [activeEdges, setActiveEdges] = useState(new Set());
  const svgRef = useRef(null);
  const [viewBox, setViewBox] = useState("0 0 1000 640");

  // Scanline animation
  useEffect(() => {
    const iv = setInterval(() => setScanLine(l => (l + 2) % 640), 16);
    return () => clearInterval(iv);
  }, []);

  // Pulse center
  useEffect(() => {
    const iv = setInterval(() => setPulse(p => !p), 1500);
    return () => clearInterval(iv);
  }, []);

  // Glitch
  useEffect(() => {
    const iv = setInterval(() => {
      setGlitch(true);
      setTimeout(() => setGlitch(false), 120);
    }, 6000 + Math.random() * 4000);
    return () => clearInterval(iv);
  }, []);

  // Active edges on hover
  function handleNodeClick(node) {
    setSelected(s => s?.id === node.id ? null : node);
    const connected = new Set(
      EDGES.filter(e => e.from === node.id || e.to === node.id).map(e => `${e.from}-${e.to}`)
    );
    setActiveEdges(connected);
  }

  const selectedEdges = selected
    ? new Set(EDGES.filter(e => e.from === selected.id || e.to === selected.id).map(e => `${e.from}-${e.to}`))
    : new Set();

  return (
    <div style={{ fontFamily: FONT, background: "#040b06", minHeight: "100vh", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Share+Tech+Mono&family=Rajdhani:wght@400;600;700&display=swap');
        @keyframes dashMove { to { stroke-dashoffset: -20; } }
        @keyframes glowPulse { 0%,100%{opacity:0.6} 50%{opacity:1} }
        @keyframes slideIn { from{transform:translateX(20px);opacity:0} to{transform:translateX(0);opacity:1} }
        @keyframes ticker { from{transform:translateX(0)} to{transform:translateX(-50%)} }
        @keyframes fadeUp { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        * { box-sizing: border-box; }
        ::-webkit-scrollbar{width:3px} ::-webkit-scrollbar-track{background:#090f0b} ::-webkit-scrollbar-thumb{background:#1a3320}
      `}</style>

      {/* TOP BAR */}
      <div style={{ height: 44, background: "#050c07", borderBottom: "1px solid #1a3320", display: "flex", alignItems: "center", padding: "0 16px", gap: 14, flexShrink: 0, zIndex: 20, position: "relative" }}>
        <div style={{ fontFamily: RAJ, fontSize: 15, fontWeight: 700, color: "#00ff88", letterSpacing: 3, textTransform: "uppercase", textShadow: "0 0 12px rgba(0,255,136,0.4)" }}>
          {glitch ? "C0NSP1RACY 0RACLE" : "CONSPIRACY ORACLE"}
        </div>
        <div style={{ width: 1, height: 20, background: "#1a3320" }} />
        <div style={{ fontFamily: FONT, fontSize: 9, color: "#5a8068", letterSpacing: 2 }}>NYOMOZATI MÓD</div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 12, alignItems: "center" }}>
          {["CIA FOIA", "USPTO", "GUARDIAN"].map(s => (
            <span key={s} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 9, color: "#5a8068", letterSpacing: 1 }}>
              <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#00ff88", display: "inline-block", animation: "glowPulse 2s infinite" }} />
              {s}
            </span>
          ))}
          <span style={{ fontSize: 9, color: "#5a8068", letterSpacing: 1 }}>
            <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#ff3333", display: "inline-block", marginRight: 5 }} />
            DARPA <span style={{ background: "#1a3320", color: "transparent", userSelect: "none" }}>███</span>
          </span>
        </div>
      </div>

      {/* TICKER */}
      <div style={{ height: 24, background: "#030803", borderBottom: "1px solid #1a3320", overflow: "hidden", display: "flex", alignItems: "center", flexShrink: 0 }}>
        <div style={{ fontFamily: FONT, fontSize: 9, color: "#1a4a2a", letterSpacing: 1, padding: "0 8px", borderRight: "1px solid #1a3320", whiteSpace: "nowrap", flexShrink: 0 }}>LIVE</div>
        <div style={{ overflow: "hidden", flex: 1 }}>
          <div style={{ display: "flex", gap: 0, animation: "ticker 30s linear infinite", whiteSpace: "nowrap" }}>
            {["▸ NEURALINK: FDA jóváhagyás — emberi kísérletek megkezdve", "◈ USPTO #10,966,620 — neurális streaming protokoll szabadalom aktív", "▸ CIA FOIA: MKUltra utódprogramok részleges titkosítás feloldva", "◈ DARPA neurális interfész szerződés: $18.4M — Synchron Inc.", "▸ WEF Davos 2023 — 'az ember hackelhető' — Harari", "◈ NSA PRISM: neurális adatgyűjtési kapacitás megerősítve — Snowden", "▸ NEURALINK: FDA jóváhagyás — emberi kísérletek megkezdve", "◈ USPTO #10,966,620 — neurális streaming protokoll szabadalom aktív"].map((t,i) => (
              <span key={i} style={{ fontFamily: FONT, fontSize: 9, color: "#3a6040", letterSpacing: 1, padding: "0 24px" }}>{t}</span>
            ))}
          </div>
        </div>
      </div>

      {/* MAIN BOARD */}
      <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>

        {/* Grid background */}
        <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0.3 }} preserveAspectRatio="xMidYMid slice">
          <defs>
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#0d2015" strokeWidth="0.5"/>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>

        {/* Scanline */}
        <div style={{ position: "absolute", left: 0, right: 0, height: 2, top: scanLine, background: "rgba(0,255,136,0.04)", pointerEvents: "none", zIndex: 5 }} />

        {/* Graph SVG */}
        <svg
          ref={svgRef}
          viewBox={viewBox}
          style={{ position: "absolute", inset: 0, width: selected ? "calc(100% - 300px)" : "100%", height: "100%", transition: "width 0.25s ease" }}
          preserveAspectRatio="xMidYMid meet"
        >
          {/* Edges */}
          {EDGES.map((e, i) => (
            <Edge
              key={i}
              edge={e}
              nodes={NODES}
              active={!selected || selectedEdges.has(`${e.from}-${e.to}`)}
            />
          ))}

          {/* Edge labels on hover */}
          {selected && EDGES.filter(e => selectedEdges.has(`${e.from}-${e.to}`)).map((e, i) => {
            const from = NODES.find(n => n.id === e.from);
            const to   = NODES.find(n => n.id === e.to);
            const mx = (from.x + to.x) / 2;
            const my = (from.y + to.y) / 2;
            return (
              <g key={i}>
                <rect x={mx - 50} y={my - 10} width={100} height={16} rx={2} fill="#040b06" stroke={e.color} strokeWidth={0.5} strokeOpacity={0.5} />
                <text x={mx} y={my + 2} textAnchor="middle" fill={e.color} opacity={0.8}
                  style={{ fontFamily: FONT, fontSize: 7, letterSpacing: 1 }}>
                  {e.label}
                </text>
              </g>
            );
          })}

          {/* Nodes */}
          {NODES.map(node => (
            <Node
              key={node.id}
              node={node}
              onClick={handleNodeClick}
              selected={selected?.id === node.id}
              pulse={pulse}
            />
          ))}
        </svg>

        {/* Detail panel */}
        {selected && (
          <div style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: 300 }}>
            <DetailPanel node={selected} onClose={() => { setSelected(null); setActiveEdges(new Set()); }} />
          </div>
        )}

        {/* Legend */}
        <div style={{ position: "absolute", bottom: 16, left: 16, display: "flex", flexDirection: "column", gap: 5, background: "rgba(4,11,6,0.85)", border: "1px solid #1a3320", borderRadius: 4, padding: "10px 12px" }}>
          <div style={{ fontFamily: FONT, fontSize: 8, color: "#5a8068", letterSpacing: 2, marginBottom: 4, textTransform: "uppercase" }}>Kapcsolat típusok</div>
          {[["#ff3333","Közvetlen bizonyíték"], ["#ffaa00","Közvetett kapcsolat"], ["#00bb66","Ellenérv / kritika"], ["#5a8068","Keresztreferencia"]].map(([col, label]) => (
            <div key={label} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 18, height: 1.5, background: col }} />
              <span style={{ fontFamily: FONT, fontSize: 9, color: "#5a8068", letterSpacing: 1 }}>{label}</span>
            </div>
          ))}
        </div>

        {/* Stats */}
        <div style={{ position: "absolute", bottom: 16, right: selected ? 316 : 16, display: "flex", gap: 12 }}>
          {[["8", "CSOMÓPONT"], ["10", "KAPCSOLAT"], ["78%", "MAX THREAT"]].map(([val, label]) => (
            <div key={label} style={{ background: "rgba(4,11,6,0.85)", border: "1px solid #1a3320", borderRadius: 4, padding: "8px 12px", textAlign: "center" }}>
              <div style={{ fontFamily: RAJ, fontSize: 20, fontWeight: 700, color: "#00ff88", lineHeight: 1 }}>{val}</div>
              <div style={{ fontFamily: FONT, fontSize: 8, color: "#5a8068", letterSpacing: 2, marginTop: 3 }}>{label}</div>
            </div>
          ))}
        </div>

        {/* Hint */}
        {!selected && (
          <div style={{ position: "absolute", top: 16, left: "50%", transform: "translateX(-50%)", fontFamily: FONT, fontSize: 9, color: "#1a4a2a", letterSpacing: 2, textTransform: "uppercase", pointerEvents: "none" }}>
            ◈ kattints egy csomópontra a részletekhez ◈
          </div>
        )}
      </div>
    </div>
  );
}
