import Link from "next/link";
import type { Metadata } from "next";
import PublicationHeader from "@/components/PublicationHeader";
import { getSiteUrl } from "@/lib/siteUrl";
import "@/app/publication-pages.css";
export const metadata: Metadata = { title: "Data & public records", description: "Explore the source material with UAP records, seismic observations, outbreak reports and public spending tools.", alternates: { canonical: `${getSiteUrl()}/data` } };
const TOOLS = [
  { href:"/uap", title:"UAP files", label:"Witness reports & records", description:"Browse sightings and their reported context. A submitted observation is a report to examine, not confirmation of its explanation." },
  { href:"/seismic", title:"Seismic monitor", label:"Earthquake observations", description:"Explore earthquake records with the location, time and magnitude supplied by their data sources." },
  { href:"/outbreaks", title:"Outbreak reports", label:"Public health updates", description:"Read reported outbreaks and follow the original public health notices for current details." },
  { href:"/insider-radar", title:"Insider radar", label:"Contracts & public disclosures", description:"Explore public records and institutional connections. A financial or organizational connection alone does not establish wrongdoing." },
  { href:"/search#research", title:"Document index", label:"Public records", description:"Find official reading rooms and research archives, or investigate a specific source article." },
  { href:"/toolkit", title:"Research toolkit", label:"Methods & tools", description:"Tools for following a source, finding public records and building an investigation of your own." },
];
export default function DataPage() { return <div className="journal-page"><PublicationHeader section="Data" /><div className="journal-shell"><header className="journal-hero"><span className="journal-kicker">Research systems</span><h1>Data & intelligence tools</h1><p>Explore the records behind the questions. Each tool has its own sources, update cycle and limits.</p></header><div className="journal-topic-grid">{TOOLS.map(tool => <article className="journal-topic" key={tool.href}><span className="journal-kicker">{tool.label}</span><h2><Link href={tool.href}>{tool.title}</Link></h2><p>{tool.description}</p><Link href={tool.href}>Open the tool →</Link></article>)}</div></div></div>; }
