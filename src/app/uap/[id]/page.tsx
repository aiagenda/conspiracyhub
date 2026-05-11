"use client";

import { useEffect, useState, use, useMemo } from "react";
import Link from "next/link";
import InvestigationBoard from "@/components/InvestigationBoard";
import type { Node, Edge, OracleAnalysis, OracleSource } from "@/types";

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
  linkedIncidents: string[];
}
interface Org {
  id: string;
  name: string;
  fullName: string;
  type: string;
  url: string;
  transparency: string;
  description: string;
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

const DOC_EXCERPTS: Record<string, string> = {
  flir1:
    "The object appeared to be approximately 40 feet long, had no wings, no rotors, no exhaust plume. It was white, oblong, and moved in ways that defied conventional aerodynamics.",
  gimbal: "Look at that thing, dude! It's rotating! My gosh! They're all going against the wind. The wind's 120 knots to the west. Look at that thing!",
  gofast: "Wow, what is that man? Look at it fly!",
  uaptf2021:
    "Of the 144 UAP reports we are dealing with here, we have no clear indications that there is any non-terrestrial explanation — but we cannot rule that out.",
  aaro2024v1:
    "AARO has found no verifiable evidence for the claims that the U.S. government is hiding extraterrestrial technology and beings from Congress.",
  pbb: "Of the total 12,618 sightings reported to Project Blue Book, 701 remain listed as unidentified after all analysis was exhausted.",
  ciaufo:
    "Some of these phenomena defy analysis of available data. Flight characteristics are inconsistent with known aircraft or natural phenomena.",
  fbivault:
    "Three so-called flying saucers had been recovered in New Mexico. Each one was occupied by three bodies of human shape but only 3 feet tall, dressed in metallic cloth.",
  hottel:
    "Three so-called flying saucers had been recovered in New Mexico. They were described as being circular in shape with raised centers, approximately 50 feet in diameter.",
  dia_reports:
    "The body of the report describes anomalous phenomena including transmedium travel and biologics related to non-human intelligence.",
  grusch_testimony:
    "I was informed in the course of my official duties of a multi-decade UAP crash retrieval and reverse-engineering program to which I was denied access.",
  ndaa2024_uap:
    "The Secretary of Defense shall declassify and make available to the public records relating to unidentified aerial phenomena within 25 years.",
  grusch_ig:
    "The Inspector General found Mr. Grusch's complaint to be credible and urgent — alleging U.S. possession of non-human intelligence and associated biologics.",
  french_cometa:
    "COMETA concludes that UFOs are real, material objects of unexplained origin. The extraterrestrial hypothesis is the most scientifically coherent explanation.",
  uk_mod:
    "The MoD received numerous reports of UAP which remain unexplained after analysis. Some reports include structured craft with extraordinary performance characteristics.",
};

const HOUSE_UAP_HEARING_2023 =
  "https://oversight.house.gov/hearing/unidentified-anomalous-phenomena-implications-on-national-security-public-safety-and-government-transparency/";

/** Primary public record + key line for graph “person” nodes (IDs match `PEOPLE` in `/api/uap`). */
const TESTIMONY_SOURCES: Record<string, { source: string; url: string; excerpt: string }> = {
  grusch: {
    source: "U.S. House Committee on Oversight and Accountability — public hearing (July 26, 2023)",
    url: HOUSE_UAP_HEARING_2023,
    excerpt: DOC_EXCERPTS.grusch_testimony,
  },
  fravor: {
    source: "U.S. House Committee on Oversight and Accountability — public hearing (July 26, 2023)",
    url: HOUSE_UAP_HEARING_2023,
    excerpt:
      "We saw a little white object down by the water that looked like a Tic Tac… it was moving over the water, then it shot up and mirrored our aircraft before accelerating away faster than anything I had seen.",
  },
  graves: {
    source: "U.S. House Committee on Oversight and Accountability — public hearing (July 26, 2023)",
    url: HOUSE_UAP_HEARING_2023,
    excerpt:
      "We were seeing these objects on radar and with our own eyes on a near-daily basis; they had no transponder, no discernible propulsion, and posed a flight-safety risk we were not equipped to explain.",
  },
  elizondo: {
    source: "The New York Times — Pentagon UFO program (Dec. 16, 2017)",
    url: "https://www.nytimes.com/2017/12/16/us/politics/pentagon-ufo-harry-reid.html",
    excerpt:
      "Luis Elizondo, who led the Pentagon effort to investigate UAP under the Advanced Aerospace Threat Identification Program until October 2017, described continued resistance inside DoD to treating the issue with transparency.",
  },
  mellon: {
    source: "The New York Times — Pentagon UFO program (Dec. 16, 2017)",
    url: "https://www.nytimes.com/2017/12/16/us/politics/pentagon-ufo-harry-reid.html",
    excerpt:
      "Christopher Mellon, a former deputy assistant secretary of defense for intelligence, helped bring classified Navy encounter videos to wider attention and pressed Congress for disclosure.",
  },
  kirkpatrick: {
    source: "DoD AARO — Historical Record Report Vol. 1 (2024)",
    url: "https://www.aaro.mil/Portals/136/PDFs/FY2024/Historical_Record_Report_Volume_1_2024.pdf",
    excerpt: DOC_EXCERPTS.aaro2024v1,
  },
};

function safeHostname(url: string): string {
  const t = url.trim();
  if (!t) return "source";
  try {
    const u = t.startsWith("http") ? t : `https://${t}`;
    return new URL(u).hostname;
  } catch {
    return "source";
  }
}

/** Deterministic ring radius so layouts stay stable across re-renders (no Math.random). */
function ringRadius(base: number, si: number, incidentId: string): number {
  const salt = incidentId.charCodeAt(si % incidentId.length) ?? 0;
  return base + ((si * 47 + salt) % 45);
}

// Convert UAP incident data → InvestigationBoard Node/Edge format
function buildBoardData(
  incident: Incident,
  people: Person[],
  orgs: Org[],
  docs: Doc[]
): { nodes: Node[]; edges: Edge[] } {
  const cx = 500,
    cy = 320;
  const nodes: Node[] = [];
  const edges: Edge[] = [];

  // Center node — the incident itself
  nodes.push({
    id: "center",
    type: "article",
    x: cx,
    y: cy,
    label: incident.name.split("/")[0].trim().toUpperCase().slice(0, 16),
    sub: `${incident.classification}\n${incident.date}`,
    detail: {
      title: incident.name,
      body: incident.description,
      source: `${incident.location} · ${incident.date}`,
      source_url: undefined,
      source_tier: incident.evidenceLevel === "HIGH" ? "A" : incident.evidenceLevel === "MEDIUM" ? "B" : "C",
      source_type: "official",
      threat: incident.evidenceLevel === "HIGH" ? 75 : incident.evidenceLevel === "MEDIUM" ? 45 : 20,
      why_it_matters: `This incident has ${incident.evidenceLevel} evidence level and is ${incident.classification}.`,
      key_claims: incident.witnesses.slice(0, 4).map((w) => `${w} — direct witness`),
      uncertainties: ["Classification level limits full disclosure", "Some witness accounts differ on details"],
      counter_evidence: ["Official explanations include weather balloons, classified aircraft", "No physical evidence recovered publicly"],
      timeline: [{ date: incident.date, event: `Incident occurred at ${incident.location}` }],
      actors: incident.witnesses.slice(0, 5),
      confidence: incident.evidenceLevel === "HIGH" ? 80 : 50,
      open_questions: ["What was the propulsion system?", "Why was information withheld?"],
    },
  } as Node);

  const relPeople = people.filter((p) => p.linkedIncidents.includes(incident.id)).slice(0, 3);
  const relOrgs = orgs.filter((o) => incident.relatedOrgs.includes(o.name)).slice(0, 3);
  const relDocs = docs
    .filter((d) => incident.documents.some((n) => n.toLowerCase().includes(d.name.toLowerCase().split(" ")[0])))
    .slice(0, 4);
  const extraWitnesses = incident.witnesses.filter((w) => !relPeople.find((p) => p.name === w)).slice(0, 3);

  const total = Math.max(
    extraWitnesses.length + relPeople.length + relOrgs.length + relDocs.length,
    1
  );
  let si = 0;

  extraWitnesses.forEach((w) => {
    const angle = (si / total) * Math.PI * 2 - Math.PI / 2;
    const dist = ringRadius(200, si, incident.id);
    const x = cx + dist * Math.cos(angle);
    const y = cy + dist * Math.sin(angle);
    nodes.push({
      id: `w-${si}`,
      type: "person",
      x,
      y,
      label: w.split(" ").slice(-1)[0].toUpperCase(),
      sub: "WITNESS",
      detail: {
        title: w,
        body: `${w} was a direct witness to the ${incident.name} incident.`,
        source: "Witness testimony",
        threat: 40,
        source_tier: "B",
        source_type: "research",
        key_claims: [`${w} reported the incident directly`],
        uncertainties: [],
        counter_evidence: [],
        timeline: [{ date: incident.date, event: "Witnessed incident" }],
        actors: [w],
        confidence: 60,
        open_questions: [],
        why_it_matters: `Direct eyewitness testimony.`,
      },
    } as Node);
    edges.push({ from: "center", to: `w-${si}`, color: "#00bb66", label: "WITNESS", strength: 0.8 });
    si++;
  });

  relPeople.forEach((p) => {
    const angle = (si / total) * Math.PI * 2 - Math.PI / 2;
    const dist = ringRadius(210, si, incident.id);
    const x = cx + dist * Math.cos(angle);
    const y = cy + dist * Math.sin(angle);
    const ts = TESTIMONY_SOURCES[p.id];
    nodes.push({
      id: p.id,
      type: "person",
      x,
      y,
      label: p.name.split(" ").slice(-1)[0].toUpperCase(),
      sub: p.role.split("/")[0].trim().slice(0, 14).toUpperCase(),
      detail: {
        title: p.name,
        body: p.bio,
        source: ts?.source ?? p.affiliation,
        source_url: ts?.url,
        excerpt: ts?.excerpt,
        source_tier: "A",
        source_type: ts ? "testimony" : "official",
        threat: p.clearance.includes("TS") ? 70 : 45,
        why_it_matters: `${p.role} — Clearance: ${p.clearance}`,
        key_claims: [`${p.name} is ${p.role}`, `Affiliated with ${p.affiliation}`],
        uncertainties: ["Some statements made under NDA"],
        counter_evidence: [],
        timeline: [],
        actors: [p.name],
        confidence: 75,
        open_questions: [],
      },
    } as Node);
    edges.push({ from: "center", to: p.id, color: "#00ff88", label: "KEY WITNESS", strength: 0.9 });
    si++;
  });

  relOrgs.forEach((o) => {
    const angle = (si / total) * Math.PI * 2 - Math.PI / 2;
    const dist = ringRadius(220, si, incident.id);
    const x = cx + dist * Math.cos(angle);
    const y = cy + dist * Math.sin(angle);
    nodes.push({
      id: o.id,
      type: "company",
      x,
      y,
      label: o.name,
      sub: o.type.toUpperCase(),
      detail: {
        title: o.fullName,
        body: o.description,
        source: o.type,
        source_url: o.url,
        source_tier: o.transparency === "HIGH" ? "A" : "B",
        source_type: "official",
        threat: o.transparency === "VERY LOW" ? 65 : 35,
        why_it_matters: `Transparency: ${o.transparency}`,
        key_claims: [`${o.name} is a ${o.type} organization`, `Transparency level: ${o.transparency}`],
        uncertainties: ["Internal operations classified"],
        counter_evidence: [],
        timeline: [],
        actors: [],
        confidence: 60,
        open_questions: [`What does ${o.name} know?`],
      },
    } as Node);
    edges.push({ from: "center", to: o.id, color: "#ffaa00", label: "RELATED ORG", strength: 0.7 });
    si++;
  });

  relDocs.forEach((d) => {
    const angle = (si / total) * Math.PI * 2 - Math.PI / 2;
    const dist = ringRadius(205, si, incident.id);
    const x = cx + dist * Math.cos(angle);
    const y = cy + dist * Math.sin(angle);
    nodes.push({
      id: d.id,
      type: "foia",
      x,
      y,
      label: d.name
        .split(" ")
        .slice(0, 2)
        .join(" ")
        .toUpperCase()
        .slice(0, 12),
      sub: `${d.type} · ${d.year}`,
      detail: {
        title: d.name,
        body: d.description,
        source: `${d.type} (${d.year})`,
        source_url: d.url,
        excerpt: DOC_EXCERPTS[d.id],
        source_tier: d.classification === "DECLASSIFIED" ? "A" : "B",
        source_type: d.type === "Testimony" ? "testimony" : "official",
        threat: d.classification === "DECLASSIFIED" ? 60 : 40,
        why_it_matters: `${d.classification} ${d.type} from ${d.year}`,
        key_claims: [d.description.slice(0, 80)],
        uncertainties: d.classification !== "DECLASSIFIED" ? ["Parts still classified"] : [],
        counter_evidence: [],
        timeline: [{ date: String(d.year), event: `${d.name} released/created` }],
        actors: [],
        confidence: 80,
        open_questions: ["What remains classified?"],
      },
    } as Node);
    edges.push({ from: "center", to: d.id, color: "#ff3333", label: "EVIDENCE", strength: 0.85 });
    si++;
  });

  return { nodes, edges };
}

export default function UAPIncidentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [data, setData] = useState<{
    incidents: Incident[];
    people: Person[];
    organizations: Org[];
    documents: Doc[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [analysis, setAnalysis] = useState<{
    summary: string;
    conspiracy_angle: string;
    probability: number;
    key_connections: string[];
    verdict: string;
  } | null>(null);
  const [analyzing, setAnalyzing] = useState(false);

  useEffect(() => {
    fetch("/api/uap")
      .then((r) => r.json())
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const incident = data?.incidents.find((i) => i.id === id);

  const polymarketContext = useMemo(() => {
    if (!incident) return "";
    const people = (data?.people ?? []).filter((p) => p.linkedIncidents.includes(incident.id));
    const chunks = [
      incident.description,
      incident.location,
      incident.tags.join(" "),
      analysis?.summary,
      analysis?.conspiracy_angle,
      ...(analysis?.key_connections ?? []).slice(0, 12),
      ...people.slice(0, 8).map((p) => `${p.name} ${p.affiliation}`),
    ].filter((s): s is string => Boolean(s && String(s).trim()));
    return chunks.join(" ").slice(0, 2200);
  }, [incident, data?.people, analysis]);

  const col = incident ? (CLASS_COL[incident.classification] ?? "#5a8068") : "#00ff88";
  const evdCol = incident ? (EVD_COL[incident.evidenceLevel] ?? "#5a8068") : "#5a8068";

  async function runAnalysis() {
    if (!incident) return;
    setAnalyzing(true);
    try {
      const res = await fetch(`/api/uap?type=analyze&id=${incident.id}`);
      const d = await res.json();
      if (d.analysis) setAnalysis(d.analysis);
    } catch {
      /* optional */
    }
    setAnalyzing(false);
  }

  if (loading)
    return (
      <div style={{ minHeight: "100vh", background: "#030806", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FONT }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontFamily: RAJ, fontSize: 20, fontWeight: 700, color: "#00ff88", letterSpacing: 2, marginBottom: 8 }}>LOADING INCIDENT DATA</div>
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

  const { nodes, edges } = buildBoardData(incident, data?.people ?? [], data?.organizations ?? [], data?.documents ?? []);

  const sources: OracleSource[] = (data?.documents ?? [])
    .filter((d) => incident.documents.some((n) => n.toLowerCase().includes(d.name.toLowerCase().split(" ")[0])))
    .map((d) => ({
      id: d.id,
      title: d.name,
      url: d.url,
      domain: safeHostname(d.url),
      tier: "A" as const,
      source_type: "official" as const,
      excerpt: d.description,
    }));

  const oracleVerdict = analysis?.verdict as OracleAnalysis["verdict"] | undefined;

  const conclusion = analysis
    ? analysis.summary
    : `${incident.name} — ${incident.classification} incident with ${incident.evidenceLevel} evidence level. ${incident.description.slice(0, 120)}...`;

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
          zIndex: 30,
          flexShrink: 0,
        }}
      >
        <Link href="/uap" style={{ fontSize: 10, color: "#5a8068", textDecoration: "none", letterSpacing: 2, border: "1px solid #1a3320", padding: "4px 10px", borderRadius: 3 }}>
          ← UAP DATABASE
        </Link>
        <div style={{ width: 1, height: 20, background: "#1a3320" }} />
        <div style={{ fontFamily: RAJ, fontSize: 13, fontWeight: 700, color: "#00ff88", letterSpacing: 2 }}>THE THEORIST</div>
        <div style={{ width: 1, height: 20, background: "#1a3320" }} />
        <div style={{ fontFamily: RAJ, fontSize: 11, color: "#e8ffe8", letterSpacing: 1 }}>{incident.name}</div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 6, alignItems: "center" }}>
          <span
            style={{
              fontSize: 9,
              color: col,
              border: `1px solid ${col}`,
              padding: "3px 10px",
              borderRadius: 2,
              letterSpacing: 1,
              fontFamily: RAJ,
              fontWeight: 700,
            }}
          >
            {incident.classification}
          </span>
          <span
            style={{
              fontSize: 9,
              color: evdCol,
              border: `1px solid ${evdCol}`,
              padding: "3px 10px",
              borderRadius: 2,
              letterSpacing: 1,
              fontFamily: RAJ,
              fontWeight: 700,
            }}
          >
            EVIDENCE: {incident.evidenceLevel}
          </span>
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
                padding: "5px 14px",
                borderRadius: 3,
                cursor: "pointer",
                textTransform: "uppercase",
              }}
            >
              ◈ ORACLE ANALYSIS ▶
            </button>
          )}
          {analyzing && <span style={{ fontFamily: FONT, fontSize: 10, color: "#00bb66", letterSpacing: 2 }}>[ ANALYZING... ]</span>}
          {analysis && (
            <span
              style={{
                fontSize: 9,
                color: analysis.probability >= 50 ? "#ff3333" : "#ffaa00",
                border: `1px solid currentColor`,
                padding: "3px 10px",
                borderRadius: 2,
                letterSpacing: 1,
              }}
            >
              {analysis.probability}% NON-HUMAN
            </span>
          )}
        </div>
      </div>

      <div style={{ flex: 1, position: "relative", overflow: "hidden", minHeight: 0 }}>
        <InvestigationBoard
          nodes={nodes}
          edges={edges}
          selectedNode={null}
          onNodeClick={() => {}}
          conclusion={conclusion}
          verdict={oracleVerdict}
          analysisSources={sources}
          articleTitle={incident.name}
          polymarketContext={polymarketContext}
        />
      </div>
    </div>
  );
}
