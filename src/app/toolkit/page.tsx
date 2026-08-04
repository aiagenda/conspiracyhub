import type { Metadata } from "next";
import ToolkitPageClient from "@/components/ToolkitPage";
import { TOOLKIT_ITEM_COUNT } from "@/lib/toolkitCatalog";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://the-theorist.com";

export const metadata: Metadata = {
  title: "Investigator Toolkit",
  description: `Curated GitHub repos, OSINT tools, and AI agent stacks for research builders — ${TOOLKIT_ITEM_COUNT} annotated links.`,
  alternates: { canonical: `${SITE_URL}/toolkit` },
  openGraph: {
    title: "Investigator Toolkit — The Theorist",
    description: "GitHub repos, OSINT pivots, scrape stacks, and agent orchestration for hardcore researchers.",
    url: `${SITE_URL}/toolkit`,
  },
};

export default function ToolkitPage() {
  return <ToolkitPageClient />;
}
