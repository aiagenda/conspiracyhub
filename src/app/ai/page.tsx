import type { Metadata } from "next";
import PublicationArchive from "@/components/PublicationArchive";
import { getSiteUrl } from "@/lib/siteUrl";
export const revalidate = 60;
export const metadata: Metadata = { title: "AI & technology", description: "Analysis of AI, technology and the institutions shaping their use.", alternates: { canonical: `${getSiteUrl()}/ai` } };
export default async function AiPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return <PublicationArchive title="AI & technology intelligence" description="How the systems work. Who makes the decisions. What the available evidence can tell us." path="/ai" params={await searchParams} defaults={{ type: "analysis", topic: "technology" }} />;
}
