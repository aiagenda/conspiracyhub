import type { Metadata } from "next";
import PublicationArchive from "@/components/PublicationArchive";
import { getSiteUrl } from "@/lib/siteUrl";
export const revalidate = 60;
export const metadata: Metadata = { title: "Investigations & analysis", description: "Explore the evidence, public records and open questions behind the story.", alternates: { canonical: `${getSiteUrl()}/blog` } };
export default async function BlogPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return <PublicationArchive title="Investigations & analysis" description="Longer reads, public records and competing explanations. Trace the evidence and see which questions remain open." path="/blog" params={await searchParams} defaults={{ type: "analysis" }} />;
}
