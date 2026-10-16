import PublicationArchive from "@/components/PublicationArchive";
import ResearchTools from "@/components/ResearchTools";
export default async function SearchPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return <PublicationArchive title="Intelligence search" description="Search news briefings, original analysis and hypotheses in one place. Every result leads to a published story." path="/search" params={await searchParams}><ResearchTools /></PublicationArchive>;
}
