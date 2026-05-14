import type { ReaderReactionStats } from "@/lib/readerReactionVote";

export type NodeType = "article" | "patent" | "foia" | "company" | "event" | "person" | "theory";

export interface NodeDetail {
  title: string;
  body: string;
  source: string;
  threat: number;
  /** Direct quote or key passage from the primary source (Oracle / board). */
  excerpt?: string;
  source_url?: string;
  source_tier?: "A" | "B" | "C";
  source_type?: "official" | "media" | "research" | "archive" | "testimony";
  why_it_matters?: string;
  key_claims?: string[];
  uncertainties?: string[];
  counter_evidence?: string[];
  timeline?: Array<{ date: string; event: string }>;
  actors?: string[];
  confidence?: number;
  open_questions?: string[];
  /** Citations / URLs mentioned for this conspiracy hypothesis (theory nodes). */
  theory_sources?: string[];
  /** Web search enrichment (Brave); stored when Oracle re-runs with search. */
  brave_sources?: Array<{ title: string; url: string; description: string }>;
}

export interface Node {
  id: string;
  type: NodeType;
  x: number;
  y: number;
  label: string;
  sub: string;
  detail: NodeDetail;
}

export interface Edge {
  from: string;
  to: string;
  color: string;
  label: string;
  strength: number;
  confidence?: number;
  evidence_source_ids?: string[];
}

export interface NewsItem {
  id: string;
  guardian_id?: string;
  title: string;
  summary: string;
  url: string;
  image: string | null;
  date: string;
  section: string;
  score: number;
  angle: string;
  /** Server-fetched Reddit-style reader reaction totals for this news item. */
  reader_reaction?: ReaderReactionStats;
  /** Ingest origin: guardian, gnews:…, reddit:…, etc. */
  source?: string;
  nodes?: Node[];
  edges?: Edge[];
}

export interface OracleTheory {
  name: string;
  summary: string;
  full_explanation?: string;
  evidence: string[];
  counter_evidence?: string[];
  sources: string[];  // real URLs
  key_people?: string[];
  probability: number;
  timeline?: Array<{ date: string; event: string }>;
}

export interface OracleSource {
  id: string;
  title: string;
  url: string;
  domain: string;
  tier: "A" | "B" | "C";
  source_type: "official" | "media" | "research" | "archive" | "testimony";
  excerpt?: string;
}

export interface OracleAnalysis {
  id?: string;
  news_id?: string;
  generated_article_id?: string;
  nodes: Node[];
  edges: Edge[];
  sources?: OracleSource[];
  theories: OracleTheory[];
  conclusion: string;
  verdict:
    | "TRUE"
    | "PARTIALLY_TRUE"
    | "QUESTIONABLE"
    | "DISINFORMATION"
    | "VALÓS"
    | "RÉSZBEN VALÓS"
    | "MEGKÉRDŐJELEZHETŐ"
    | "TERJESZTETT DEZINFO";
  created_at?: string;
}
