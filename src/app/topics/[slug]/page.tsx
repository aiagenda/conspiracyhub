import { notFound } from "next/navigation";
import type { Metadata } from "next";
import PublicationArchive from "@/components/PublicationArchive";
import { findTopic, TOPICS } from "@/lib/topics";
import { getSiteUrl } from "@/lib/siteUrl";
type Props = { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };
export function generateStaticParams() { return TOPICS.map(({ slug }) => ({ slug })); }
export async function generateMetadata({ params }: Props): Promise<Metadata> { const topic = findTopic((await params).slug); return topic ? { title: topic.title, description: topic.description, alternates: { canonical: `${getSiteUrl()}/topics/${topic.slug}` } } : {}; }
export default async function TopicPage({ params, searchParams }: Props) {
  const topic = findTopic((await params).slug); if (!topic) notFound();
  return <PublicationArchive title={topic.title} description={topic.description} path={`/topics/${topic.slug}`} params={await searchParams} defaults={{ topic: topic.slug }} />;
}
