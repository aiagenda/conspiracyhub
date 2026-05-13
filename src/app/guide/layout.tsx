import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Investigation Guide",
  description: "Learn how to use The Theorist's AI tools to investigate conspiracy theories, cross-reference UAP incidents, and decode classified documents.",
  openGraph: {
    title: "Investigation Guide | The Theorist",
    description: "Learn how to use The Theorist's AI tools to investigate conspiracy theories and decode classified documents.",
  },
};

export default function GuideLayout({ children }: { children: React.ReactNode }) {
  return children;
}
