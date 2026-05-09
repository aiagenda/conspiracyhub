"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import PolymarketWidget from "@/components/PolymarketWidget";

const FONT = "var(--font-share-tech-mono), monospace";
const RAJ = "var(--font-raj), sans-serif";

type Classification = "DECLASSIFIED" | "CONFIRMED" | "REPORTED" | "ALLEGED";
const CLASS_COL: Record<Classification, string> = {
  DECLASSIFIED: "#00ff88",
  CONFIRMED: "#00bb66",
  REPORTED: "#ffaa00",
  ALLEGED: "#5a8068",
};
const EVD_COL: Record<string, string> = { HIGH: "#ff3333", MEDIUM: "#ffaa00", LOW: "#00bb66" };

interface Incident {
  id: string;
  name: string;
  date: string;
  location: string;
  lat: number;
  lng: number;
  classification: Classification;
  evidenceLevel: string;
  description: string;
  witnesses: string[];
  documents: string[];
  relatedOrgs: string[];
  tags: string[];
}
interface Person {
  id: string;
  name: string;
  role: string;
  affiliation: string;
  clearance: string;
  bio: string;
  significance: string;
  linkedIncidents: string[];
}
interface Org {
  id: string;
  name: string;
  fullName: string;
  type: string;
  url: string;
  transparency: string;
}
interface Doc {
  id: string;
  name: string;
  year: number;
  type: string;
  classification: string;
  url: string;
  description: string;
}

function IncidentBoard({
  incident,
  people,
  orgs,
  docs,
}: {
  incident: Incident;
  people: Person[];
  orgs: Org[];
  docs: Doc[];
}) {
  const [selectedNode, setSelectedNode] = useState<{ label: string; detail: string; url?: string; type: string } | null>(null);
  const [analysis, setAnalysis] = useState<{
    summary: string;
    conspiracy_angle: string;
    probability: number;
    key_connections: string[];
    verdict: string;
  } | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [hint, setHint] = useState(true);

  const col = CLASS_COL[incident.classification] ?? "#5a8068";
  const cx = 600,
    cy = 300;

  interface GNode {
    id: string;
    x: number;
    y: number;
    label: string;
    sub: string;
    color: string;
    type: string;
    detail: string;
    url?: string;
    r: number;
  }
  const nodes: GNode[] = [
    {
      id: "center",
      x: cx,
      y: cy,
      r: 32,
      label: incident.name.split("/")[0].trim().toUpperCase().slice(0, 14),
      sub: incident.date,
      color: col,
      type: "incident",
      detail: incident.description,
    },
  ];

  const relPeople = people.filter((p) => p.linkedIncidents.includes(incident.id)).slice(0, 4);
  const relOrgs = orgs.filter((o) => incident.relatedOrgs.includes(o.name)).slice(0, 3);
  const relDocs = docs
    .filter((d) => incident.documents.some((n) => n.toLowerCase().includes(d.name.toLowerCase().split(" ")[0])))
    .slice(0, 3);

  const totalSatellites = relPeople.length + relOrgs.length + relDocs.length + Math.min(incident.witnesses.length, 3);
  let satIdx = 0;
  const angleStep = (2 * Math.PI) / Math.max(totalSatellites, 1);

  incident.witnesses
    .slice(0, 3)
    .filter((w) => !relPeople.find((p) => p.name === w))
    .forEach((w) => {
      const angle = satIdx * angleStep - Math.PI / 2;
      nodes.push({
        id: `w${satIdx}`,
        x: cx + 220 * Math.cos(angle),
        y: cy + 180 * Math.sin(angle),
        r: 18,
        label: w.split(" ").slice(-1)[0].toUpperCase(),
        sub: "WITNESS",
        color: "#00bb66",
        type: "witness",
        detail: `${w} — witness to the ${incident.name} incident.`,
      });
      satIdx++;
    });
  relPeople.forEach((p) => {
    const angle = satIdx * angleStep - Math.PI / 2;
    nodes.push({
      id: p.id,
      x: cx + 220 * Math.cos(angle),
      y: cy + 180 * Math.sin(angle),
      r: 20,
      label: p.name.split(" ").slice(-1)[0].toUpperCase(),
      sub: p.role.split("/")[0].trim().slice(0, 12).toUpperCase(),
      color: "#00ff88",
      type: "person",
      detail: `${p.name} — ${p.role}. Clearance: ${p.clearance}. ${p.bio.slice(0, 120)}...`,
    });
    satIdx++;
  });
  relOrgs.forEach((o) => {
    const angle = satIdx * angleStep - Math.PI / 2;
    nodes.push({
      id: o.id,
      x: cx + 260 * Math.cos(angle),
      y: cy + 200 * Math.sin(angle),
      r: 18,
      label: o.name,
      sub: o.type.toUpperCase(),
      color: "#ffaa00",
      type: "org",
      detail: `${o.fullName} — Transparency: ${o.transparency}`,
      url: o.url,
    });
    satIdx++;
  });
  relDocs.forEach((d) => {
    const angle = satIdx * angleStep - Math.PI / 2;
    nodes.push({
      id: d.id,
      x: cx + 240 * Math.cos(angle),
      y: cy + 185 * Math.sin(angle),
      r: 16,
      label: d.name
        .split(" ")
        .slice(0, 2)
        .join(" ")
        .toUpperCase()
        .slice(0, 12),
      sub: d.type.toUpperCase(),
      color: "#c94dff",
      type: "document",
      detail: `${d.name} (${d.year}) — ${d.description}`,
      url: d.url,
    });
    satIdx++;
  });

  async function runAnalysis() {
    setAnalyzing(true);
    try {
      const res = await fetch(`/api/uap?type=analyze&id=${incident.id}`);
      const data = await res.json();
      if (data.analysis) setAnalysis(data.analysis);
    } catch {
      /* optional */
    }
    setAnalyzing(false);
  }

  const EDGE_COLORS: Record<string, string> = { witness: "#00bb66", person: "#00ff88", org: "#ffaa00", document: "#c94dff" };

  return (
    <div style={{ position: "relative", width: "100%", height: "100%", background: "#030806", display: "flex", minHeight: 0 }}>
      <style>{`
        @keyframes board-dash{to{stroke-dashoffset:-20}}
        @keyframes board-fadein{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
      `}</style>

      <div style={{ flex: 1, position: "relative", minHeight: "60vh" }}>
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

        {hint && (
          <div
            onClick={() => setHint(false)}
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%,-50%)",
              zIndex: 10,
              background: "rgba(5,12,7,0.9)",
              border: "1px solid #1a3320",
              borderRadius: 4,
              padding: "12px 20px",
              textAlign: "center",
              cursor: "pointer",
              pointerEvents: "all",
            }}
          >
            <div style={{ fontFamily: RAJ, fontSize: 13, fontWeight: 700, color: "#00ff88", marginBottom: 4 }}>◈ INVESTIGATION BOARD</div>
            <div style={{ fontFamily: FONT, fontSize: 10, color: "#5a8068", letterSpacing: 1 }}>CLICK ANY NODE FOR DETAILS</div>
          </div>
        )}

        <svg viewBox="0 0 1200 600" style={{ width: "100%", height: "100%", display: "block" }} onClick={() => setHint(false)}>
          <defs>
            <radialGradient id="uapGrad" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor={col} stopOpacity="0.1" />
              <stop offset="100%" stopColor={col} stopOpacity="0" />
            </radialGradient>
          </defs>

          <circle cx={cx} cy={cy} r={80} fill="url(#uapGrad)" />

          {nodes.slice(1).map((n) => (
            <line
              key={n.id}
              x1={cx}
              y1={cy}
              x2={n.x}
              y2={n.y}
              stroke={EDGE_COLORS[n.type] ?? col}
              strokeWidth="1.5"
              strokeOpacity="0.4"
              strokeDasharray="5 8"
              style={{ animation: "board-dash 2s linear infinite" }}
            />
          ))}

          {nodes.map((n, i) => (
            <g
              key={n.id}
              style={{ cursor: "pointer" }}
              onClick={(e) => {
                e.stopPropagation();
                setSelectedNode({ label: n.label, detail: n.detail, url: n.url, type: n.type });
              }}
            >
              <circle cx={n.x} cy={n.y} r={n.r + 8} fill={n.color} opacity="0.06" />
              <circle cx={n.x} cy={n.y} r={n.r + 2} fill="none" stroke={n.color} strokeWidth="0.8" strokeOpacity="0.25" />
              <circle
                cx={n.x}
                cy={n.y}
                r={n.r}
                fill="#080f09"
                stroke={n.color}
                strokeWidth={i === 0 ? 2.5 : 1.5}
                style={{ filter: `drop-shadow(0 0 ${i === 0 ? 8 : 4}px ${n.color})` }}
              />
              <text x={n.x} y={n.y + (i === 0 ? 2 : 1)} textAnchor="middle" fill={n.color} style={{ fontFamily: FONT, fontSize: i === 0 ? 9 : 7, letterSpacing: 0.5 }}>
                {n.label.slice(0, i === 0 ? 12 : 10)}
              </text>
              <text x={n.x} y={n.y + n.r + 14} textAnchor="middle" fill={n.color} opacity="0.5" style={{ fontFamily: FONT, fontSize: 7, letterSpacing: 1 }}>
                {n.sub}
              </text>
            </g>
          ))}
        </svg>

        <div
          style={{
            position: "absolute",
            bottom: 16,
            left: 16,
            display: "flex",
            gap: 12,
            background: "rgba(4,11,6,0.85)",
            border: "1px solid #1a3320",
            borderRadius: 4,
            padding: "8px 12px",
          }}
        >
          {[
            ["#00ff88", "PERSON/WITNESS"],
            ["#ffaa00", "ORGANIZATION"],
            ["#c94dff", "DOCUMENT"],
            ["#5a8068", "ALLEGED"],
          ].map(([c, l]) => (
            <span key={l} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 8, color: "#5a8068", letterSpacing: 1 }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: c, display: "inline-block" }} />
              {l}
            </span>
          ))}
        </div>

        <div style={{ position: "absolute", bottom: 16, right: 16 }}>
          {!analysis && !analyzing && (
            <button
              type="button"
              onClick={runAnalysis}
              style={{
                background: "rgba(0,255,136,0.06)",
                border: "1px solid #00bb66",
                color: "#00ff88",
                fontFamily: RAJ,
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: 2,
                padding: "8px 16px",
                borderRadius: 3,
                cursor: "pointer",
                textTransform: "uppercase",
              }}
            >
              ◈ RUN ORACLE ANALYSIS ▶
            </button>
          )}
          {analyzing && <div style={{ fontFamily: FONT, fontSize: 10, color: "#00bb66", letterSpacing: 2 }}>[ ANALYZING... ]</div>}
        </div>
      </div>

      <div
        style={{
          width: 320,
          flexShrink: 0,
          background: "#090f0b",
          borderLeft: "1px solid #1a3320",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        <div style={{ padding: "14px 16px", borderBottom: "1px solid #1a3320", background: "#050c07" }}>
          <div style={{ fontFamily: RAJ, fontSize: 15, fontWeight: 700, color: "#e8ffe8", marginBottom: 5, lineHeight: 1.3 }}>{incident.name}</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 6 }}>
            <span style={{ fontSize: 9, color: col, border: `1px solid ${col}`, padding: "1px 6px", borderRadius: 2 }}>{incident.classification}</span>
            <span
              style={{
                fontSize: 9,
                color: EVD_COL[incident.evidenceLevel] ?? "#5a8068",
                border: `1px solid ${EVD_COL[incident.evidenceLevel] ?? "#5a8068"}`,
                padding: "1px 6px",
                borderRadius: 2,
              }}
            >
              EVD: {incident.evidenceLevel}
            </span>
          </div>
          <div style={{ fontFamily: FONT, fontSize: 10, color: "#5a8068", letterSpacing: 1 }}>
            {incident.date} · {incident.location}
          </div>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "12px 14px", display: "flex", flexDirection: "column", gap: 12 }}>
          {selectedNode ? (
            <div style={{ animation: "board-fadein 0.25s ease" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <div style={{ fontFamily: FONT, fontSize: 8, color: EDGE_COLORS[selectedNode.type] ?? "#5a8068", letterSpacing: 3 }}>
                  {selectedNode.type.toUpperCase()}
                </div>
                <button type="button" onClick={() => setSelectedNode(null)} style={{ background: "transparent", border: "none", color: "#5a8068", cursor: "pointer", fontSize: 10, fontFamily: FONT }}>
                  ✕
                </button>
              </div>
              <div style={{ fontFamily: RAJ, fontSize: 14, fontWeight: 700, color: "#e8ffe8", marginBottom: 8 }}>{selectedNode.label}</div>
              <div style={{ fontFamily: FONT, fontSize: 11, color: "#7aaa8a", lineHeight: 1.75, marginBottom: 10 }}>{selectedNode.detail}</div>
              {selectedNode.url && (
                <a
                  href={selectedNode.url}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    display: "flex",
                    gap: 7,
                    color: "#00bb66",
                    fontSize: 10,
                    textDecoration: "none",
                    padding: "6px 10px",
                    border: "1px solid rgba(0,187,102,0.25)",
                    borderRadius: 3,
                    background: "rgba(0,187,102,0.04)",
                  }}
                >
                  <span style={{ flexShrink: 0 }}>↗</span>
                  <span style={{ wordBreak: "break-all" }}>{selectedNode.url}</span>
                </a>
              )}
            </div>
          ) : (
            <div style={{ fontFamily: FONT, fontSize: 11, color: "#c8e8d0", lineHeight: 1.8 }}>{incident.description}</div>
          )}

          {analysis && (
            <div style={{ border: "1px solid #1a3320", borderRadius: 4, padding: "12px", background: "rgba(0,255,136,0.02)" }}>
              <div style={{ fontFamily: FONT, fontSize: 9, color: "#00ff88", letterSpacing: 2, marginBottom: 8 }}>◈ ORACLE ANALYSIS</div>
              <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 8 }}>
                <div style={{ fontFamily: RAJ, fontSize: 32, fontWeight: 700, color: analysis.probability >= 50 ? "#ff3333" : analysis.probability >= 30 ? "#ffaa00" : "#00bb66", lineHeight: 1 }}>
                  {analysis.probability}%
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ height: 3, background: "#1a3320", borderRadius: 2, overflow: "hidden", marginBottom: 5 }}>
                    <div
                      style={{
                        height: "100%",
                        width: `${analysis.probability}%`,
                        background: analysis.probability >= 50 ? "#ff3333" : analysis.probability >= 30 ? "#ffaa00" : "#00bb66",
                        borderRadius: 2,
                      }}
                    />
                  </div>
                  <div style={{ fontSize: 8, color: "#3a5040", border: "1px solid #1a3320", borderRadius: 2, padding: "1px 5px", display: "inline-block", letterSpacing: 1 }}>
                    {analysis.verdict?.replace(/_/g, " ")}
                  </div>
                </div>
              </div>
              <div style={{ fontFamily: FONT, fontSize: 10, color: "#7aaa8a", lineHeight: 1.7, marginBottom: 8 }}>{analysis.summary}</div>
              <div style={{ padding: "7px 9px", background: "rgba(201,77,255,0.06)", border: "1px solid rgba(201,77,255,0.2)", borderRadius: 3, marginBottom: 8 }}>
                <div style={{ fontSize: 8, color: "#c94dff", letterSpacing: 2, marginBottom: 3 }}>CONSPIRACY ANGLE</div>
                <div style={{ fontFamily: FONT, fontSize: 10, color: "#e9b3ff", lineHeight: 1.6 }}>{analysis.conspiracy_angle}</div>
              </div>
              {analysis.key_connections?.map((c, i) => (
                <div key={i} style={{ display: "flex", gap: 6, color: "#7aaa8a", fontSize: 10, marginBottom: 4, lineHeight: 1.6 }}>
                  <span style={{ color: "#00bb66", flexShrink: 0 }}>▸</span>
                  <span>{c}</span>
                </div>
              ))}
            </div>
          )}

          <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
            {incident.tags.map((t) => (
              <span key={t} style={{ fontSize: 8, color: "#3a5040", border: "1px solid #0d1a10", padding: "2px 6px", borderRadius: 2, letterSpacing: 0.5 }}>
                {t}
              </span>
            ))}
          </div>

          <PolymarketWidget query={`${incident.name} UFO UAP`} />
        </div>
      </div>
    </div>
  );
}

export default function UAPIncidentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [data, setData] = useState<{ incidents: Incident[]; people: Person[]; organizations: Org[]; documents: Doc[] } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/uap")
      .then((r) => r.json())
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const incident = data?.incidents.find((i) => i.id === id);

  if (loading)
    return (
      <div style={{ minHeight: "100vh", background: "#030806", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FONT, color: "#00ff88" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontFamily: RAJ, fontSize: 20, fontWeight: 700, letterSpacing: 2, marginBottom: 8 }}>LOADING INCIDENT DATA</div>
          <div style={{ fontSize: 10, color: "#3a6040", letterSpacing: 2 }}>ACCESSING CLASSIFIED FILES...</div>
        </div>
      </div>
    );

  if (!incident)
    return (
      <div style={{ minHeight: "100vh", background: "#030806", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FONT, color: "#ff3333" }}>
        <div style={{ textAlign: "center" }}>
          <div>[ERROR] INCIDENT NOT FOUND</div>
          <Link href="/uap" style={{ display: "block", marginTop: 12, color: "#00bb66", textDecoration: "none", fontSize: 11 }}>
            ← RETURN TO UAP DATABASE
          </Link>
        </div>
      </div>
    );

  return (
    <div style={{ minHeight: "100vh", background: "#050c07", display: "flex", flexDirection: "column", fontFamily: FONT }}>
      <div className="scanline" />
      <div
        style={{
          height: 44,
          background: "#050c07",
          borderBottom: "1px solid #1a3320",
          display: "flex",
          alignItems: "center",
          padding: "0 16px",
          gap: 12,
          position: "sticky",
          top: 0,
          zIndex: 20,
          flexShrink: 0,
        }}
      >
        <Link href="/uap" style={{ fontSize: 10, color: "#5a8068", textDecoration: "none", letterSpacing: 2, border: "1px solid #1a3320", padding: "4px 10px", borderRadius: 3 }}>
          ← UAP DATABASE
        </Link>
        <div style={{ width: 1, height: 20, background: "#1a3320" }} />
        <div style={{ fontFamily: RAJ, fontSize: 13, fontWeight: 700, color: "#00ff88", letterSpacing: 2 }}>THE THEORIST</div>
        <div style={{ width: 1, height: 20, background: "#1a3320" }} />
        <div style={{ fontFamily: RAJ, fontSize: 11, color: "#00ff88", letterSpacing: 1 }}>{incident.name}</div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
          <span style={{ fontSize: 9, color: CLASS_COL[incident.classification], border: `1px solid ${CLASS_COL[incident.classification]}`, padding: "3px 8px", borderRadius: 2 }}>{incident.classification}</span>
          <span
            style={{
              fontSize: 9,
              color: EVD_COL[incident.evidenceLevel] ?? "#5a8068",
              border: `1px solid ${EVD_COL[incident.evidenceLevel] ?? "#5a8068"}`,
              padding: "3px 8px",
              borderRadius: 2,
            }}
          >
            EVIDENCE: {incident.evidenceLevel}
          </span>
        </div>
      </div>

      <div style={{ flex: 1, position: "relative", overflow: "hidden", minHeight: 0 }}>
        <IncidentBoard incident={incident} people={data?.people ?? []} orgs={data?.organizations ?? []} docs={data?.documents ?? []} />
      </div>
    </div>
  );
}
