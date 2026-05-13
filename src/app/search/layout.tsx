import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Search",
  description: "Search The Theorist's AI-curated archive of conspiracy investigations, UAP incidents, declassified documents, and high-priority news signals.",
  openGraph: {
    title: "Search | The Theorist",
    description: "Search the AI-curated archive of conspiracy investigations, UAP incidents, and declassified documents.",
  },
};

export default function SearchLayout({ children }: { children: React.ReactNode }) {
  return children;
}
