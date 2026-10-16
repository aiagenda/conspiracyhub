import Link from "next/link";
import type { Metadata } from "next";
import PublicationHeader from "@/components/PublicationHeader";
import { TOPICS } from "@/lib/topics";
import { getSiteUrl } from "@/lib/siteUrl";
import "@/app/publication-pages.css";
export const metadata: Metadata = { title: "Topics", description: "Explore The Theorist by subject: public records, surveillance, UAP, technology, science and environment.", alternates: { canonical: `${getSiteUrl()}/topics` } };
export default function TopicsPage() {
  return <div className="journal-page"><PublicationHeader section="Topics" /><div className="journal-shell"><header className="journal-hero"><span className="journal-kicker">Subject directories</span><h1>Investigation topics</h1><p>Follow a subject across the headlines, the analysis and the public records. Start with the question that interests you.</p></header><div className="journal-topic-grid">{TOPICS.map((topic) => <article className="journal-topic" key={topic.slug}><h2><Link href={`/topics/${topic.slug}`}>{topic.title}</Link></h2><p>{topic.description}</p><Link href={`/topics/${topic.slug}`}>Open topic files →</Link></article>)}</div></div></div>;
}
