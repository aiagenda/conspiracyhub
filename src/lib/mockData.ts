import type { Edge, Node } from "@/types";

export const MOCK_NODES: Node[] = [
  {
    id: "center",
    type: "article",
    x: 500,
    y: 320,
    label: "NEURALINK APPROVAL",
    sub: "FDA approved human\ntrials — 2024 Q1",
    detail: {
      title: "FDA authorizes Neuralink human implant trials",
      body: "Elon Musk's Neuralink Corp. received FDA clearance in January 2024 to begin first-in-human clinical testing.",
      source: "Reuters, 2024.01.29",
      threat: 78,
    },
  },
  {
    id: "patent1",
    type: "patent",
    x: 160,
    y: 130,
    label: "USPTO #10,966,620",
    sub: "Neural interface\ndata transfer protocol",
    detail: {
      title: "Neural signal encryption and transfer patent",
      body: "The patent describes real-time streaming of neural signals to external systems.",
      source: "USPTO, filed: 2021.03.15",
      threat: 71,
    },
  },
  {
    id: "foia1",
    type: "foia",
    x: 840,
    y: 110,
    label: "CIA FOIA #C06541956",
    sub: "MKUltra successor programs\n[PARTIALLY REDACTED]",
    detail: {
      title: "CIA internal memo — neural control research",
      body: "Documents from 1977 indicate active CIA research into influence techniques involving neural interfaces.",
      source: "CIA FOIA Reading Room, 1977",
      threat: 65,
    },
  },
  {
    id: "company1",
    type: "company",
    x: 190,
    y: 490,
    label: "SYNCHRON INC.",
    sub: "Competitor — Pentagon\ncontract $18.4M",
    detail: {
      title: "Synchron Inc. — DARPA funding",
      body: "Neuralink competitor Synchron received an $18.4M DARPA contract for neural interface development.",
      source: "USASpending.gov, DARPA-HR001120S0089",
      threat: 60,
    },
  },
];

export const MOCK_EDGES: Edge[] = [
  { from: "center", to: "patent1", color: "#ff3333", label: "Related patent evidence", strength: 0.9 },
  { from: "center", to: "foia1", color: "#ff3333", label: "CIA historical link", strength: 0.75 },
  { from: "center", to: "company1", color: "#ffaa00", label: "Industry actor connection", strength: 0.7 },
];
